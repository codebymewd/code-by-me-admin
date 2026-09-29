// =====================================================================
// NOTIFICATIONS.JS — CBM Admin notification center.
//
// Two independent things live here:
// 1. A realtime Firestore listener on `notifications` (written by the
//    Cloud Functions in /functions — see that folder's README) that
//    drives the bell badge + dropdown panel.
// 2. FCM push registration: on first load, asks the browser for
//    notification permission and, if granted, saves a token to
//    admins/{uid}/fcmTokens/{tokenId} so the CBM notification Worker can push to it.
//
// Both fail silently (console.error only) if unsupported/denied — the
// dashboard must work exactly as before for an admin who never enables
// push, or on a browser without FCM support.
// =====================================================================

import {
  app, db, auth, collection, doc, setDoc, updateDoc, query, orderBy, limit, onSnapshot, VAPID_KEY,
} from "./admin-firebase.js";
import { escapeHtml, formatDate } from "./common.js";

let unsubscribeSnapshot = null;
let notifications = [];

function tokenDocId(token) {
  // Firestore doc IDs can't contain "/" and FCM tokens sometimes do —
  // derive a safe, stable id from the token itself (not random) so the
  // same browser/device doesn't accumulate duplicate token docs.
  const safe = token.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 300);
  return safe || `tok_${Date.now()}`;
}

// ---------------------------------------------------------------------
// Push registration (best-effort, never blocks the dashboard)
// ---------------------------------------------------------------------
async function registerPushToken(uid) {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
  if (!VAPID_KEY || VAPID_KEY.startsWith("PASTE_")) {
    console.warn("Push notifications not configured yet — VAPID_KEY is a placeholder in js/firebase-config.js.");
    return;
  }
  try {
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") return;

    const [{ getMessaging, getToken, onMessage, isSupported }, registration] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging.js"),
      navigator.serviceWorker.ready,
    ]);

    if (!(await isSupported())) return;

    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) return;

    await setDoc(doc(db, "admins", uid, "fcmTokens", tokenDocId(token)), {
      token,
      userAgent: navigator.userAgent,
      updatedAt: new Date().toISOString(),
    });

    // Foreground toast for pushes that arrive while the dashboard tab is
    // open and focused (background/closed-tab pushes are handled by
    // service-worker.js instead).
    onMessage(messaging, (payload) => {
      const title = payload.notification?.title || "CBM";
      const body = payload.notification?.body || "";
      showBellPulse();
      console.info(`${title}: ${body}`);
    });
  } catch (err) {
    console.error("Push registration failed:", err);
  }
}

function showBellPulse() {
  const bell = document.getElementById("notif-bell-btn");
  if (!bell) return;
  bell.classList.add("notif-pulse");
  setTimeout(() => bell.classList.remove("notif-pulse"), 1200);
}

// ---------------------------------------------------------------------
// Bell + panel UI
// ---------------------------------------------------------------------
function updateBadge() {
  const badge = document.getElementById("notif-badge");
  if (!badge) return;
  const unread = notifications.filter((n) => !n.read).length;
  badge.hidden = unread === 0;
  badge.textContent = unread > 9 ? "9+" : String(unread);
}

function renderPanel() {
  const panel = document.getElementById("notif-panel");
  if (!panel) return;

  if (!notifications.length) {
    panel.innerHTML = `
      <div class="notif-panel-head"><span>Notifications</span></div>
      <div class="notif-empty">No notifications yet.</div>
    `;
    return;
  }

  panel.innerHTML = `
    <div class="notif-panel-head">
      <span>Notifications</span>
      <button type="button" class="notif-markall" id="notif-markall-btn">Mark all as read</button>
    </div>
    <div class="notif-list">
      ${notifications.map((n) => `
        <div class="notif-item ${n.read ? "" : "unread"}" data-id="${escapeHtml(n.id)}" data-link="${escapeHtml(n.link || "")}">
          <div class="notif-item-title">${escapeHtml(n.title)}</div>
          <div class="notif-item-msg">${escapeHtml(n.message)}</div>
          <div class="notif-item-time">${formatDate(n.createdAt)}</div>
        </div>
      `).join("")}
    </div>
  `;

  panel.querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("click", () => handleNotifClick(el.dataset.id, el.dataset.link));
  });
  document.getElementById("notif-markall-btn")?.addEventListener("click", markAllRead);
}

async function handleNotifClick(id, link) {
  const n = notifications.find((x) => x.id === id);
  if (n && !n.read) {
    updateDoc(doc(db, "notifications", id), { read: true, readAt: new Date().toISOString() }).catch((err) =>
      console.error("Couldn't mark notification read:", err)
    );
  }
  closePanel();
  if (link) location.hash = link.replace(/^#/, "");
}

async function markAllRead() {
  const unread = notifications.filter((n) => !n.read);
  await Promise.all(
    unread.map((n) =>
      updateDoc(doc(db, "notifications", n.id), { read: true, readAt: new Date().toISOString() }).catch((err) =>
        console.error("Couldn't mark notification read:", err)
      )
    )
  );
}

function togglePanel() {
  const panel = document.getElementById("notif-panel");
  if (panel) panel.hidden = !panel.hidden;
}

function closePanel() {
  const panel = document.getElementById("notif-panel");
  if (panel) panel.hidden = true;
}

// ---------------------------------------------------------------------
// Entry point — called once from admin-app.js after requireAuth() resolves
// ---------------------------------------------------------------------
export function initNotificationCenter(user) {
  const bellBtn = document.getElementById("notif-bell-btn");
  bellBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePanel();
  });
  document.addEventListener("click", (e) => {
    const wrap = document.getElementById("notif-wrap");
    if (wrap && !wrap.contains(e.target)) closePanel();
  });

  if (unsubscribeSnapshot) unsubscribeSnapshot();
  const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"), limit(30));
  unsubscribeSnapshot = onSnapshot(
    q,
    (snap) => {
      notifications = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      updateBadge();
      renderPanel();
    },
    (err) => console.error("Notification listener failed:", err)
  );

  registerPushToken(user.uid);
}
