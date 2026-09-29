import {
  db, collection, doc, getDocs, addDoc, deleteDoc, query, orderBy, limit, where, serverTimestamp,
} from "./admin-firebase.js";
import { uploadAdminMedia } from "./admin-cloudinary.js";
import { escapeHtml, formatDate, openLightbox, confirmDialog, showToast } from "./common.js";

// NOTE: Cloudinary doesn't expose a safe way to list "everything in a
// folder" from the browser without shipping the API secret client-side, so
// this section aggregates media Firestore already knows about (order
// screenshots, template/project fields, and a dedicated promoMedia
// collection for standalone marketing assets) rather than browsing the
// Cloudinary bucket directly.

let activeTab = "payments";

export async function render(root) {
  root.innerHTML = `
    <div class="admin-panel">
      <div class="panel-head">
        <div class="panel-actions">
          ${["payments", "templates", "projects", "promo"].map(t => `
            <button class="btn ${activeTab === t ? "btn-dark" : "btn-outline"} btn-sm" data-tab="${t}">${tabLabel(t)}</button>
          `).join("")}
        </div>
        <div id="promo-upload-wrap"></div>
      </div>
      <div id="media-content"><div class="skeleton" style="height:260px;"></div></div>
    </div>
  `;
  root.querySelectorAll("[data-tab]").forEach(btn => btn.addEventListener("click", () => {
    activeTab = btn.dataset.tab;
    render(root);
  }));
  await loadTab();
}

function tabLabel(t) {
  return { payments: "Payment Screenshots", templates: "Templates", projects: "Projects", promo: "Promotional Media" }[t];
}

async function loadTab() {
  const mount = document.getElementById("media-content");
  const promoUploadWrap = document.getElementById("promo-upload-wrap");
  promoUploadWrap.innerHTML = "";

  if (activeTab === "payments") return loadPayments(mount);
  if (activeTab === "templates") return loadTemplateMedia(mount);
  if (activeTab === "projects") return loadProjectMedia(mount);
  if (activeTab === "promo") return loadPromo(mount, promoUploadWrap);
}

function gridWrap(items) {
  if (!items.length) return `<div class="state-block"><h3>Nothing here yet</h3><p>Media will appear here as it's added.</p></div>`;
  return `<div class="grid grid-3">${items.join("")}</div>`;
}

function mediaTile(url, caption, isVideo = false) {
  return `
    <div class="media-card">
      <div class="media-card-thumb" data-open="${escapeHtml(url)}" style="cursor:zoom-in;">
        ${isVideo ? `<video src="${escapeHtml(url)}" style="width:100%;height:100%;object-fit:cover;" muted></video>` : `<img src="${escapeHtml(url)}" alt="">`}
      </div>
      <div class="media-card-body"><div class="media-card-desc">${escapeHtml(caption)}</div></div>
    </div>
  `;
}

function wireOpen(mount) {
  mount.querySelectorAll("[data-open]").forEach(el => el.addEventListener("click", () => openLightbox(el.dataset.open)));
}

async function loadPayments(mount) {
  const snap = await getDocs(query(collection(db, "orders"), where("paymentScreenshot", "!=", null), orderBy("paymentScreenshot"), limit(60)));
  const items = snap.docs.filter(d => d.data().paymentScreenshot).map(d => mediaTile(d.data().paymentScreenshot, `${d.data().orderId} — ${d.data().customerName}`));
  mount.innerHTML = gridWrap(items);
  wireOpen(mount);
}

async function loadTemplateMedia(mount) {
  const snap = await getDocs(collection(db, "templates"));
  const items = [];
  snap.docs.forEach(d => {
    const t = d.data();
    if (t.previewImage) items.push(mediaTile(t.previewImage, `${t.name} — preview`));
    (t.screenshots || []).forEach((s, i) => items.push(mediaTile(s, `${t.name} — screenshot ${i + 1}`)));
    if (t.promoVideo) items.push(mediaTile(t.promoVideo, `${t.name} — video`, true));
  });
  mount.innerHTML = gridWrap(items);
  wireOpen(mount);
}

async function loadProjectMedia(mount) {
  const snap = await getDocs(collection(db, "projects"));
  const items = [];
  snap.docs.forEach(d => {
    const p = d.data();
    if (p.thumbnail) items.push(mediaTile(p.thumbnail, `${p.title} — thumbnail`));
    (p.screenshots || []).forEach((s, i) => items.push(mediaTile(s, `${p.title} — screenshot ${i + 1}`)));
    if (p.video) items.push(mediaTile(p.video, `${p.title} — video`, true));
  });
  mount.innerHTML = gridWrap(items);
  wireOpen(mount);
}

async function loadPromo(mount, uploadWrap) {
  uploadWrap.innerHTML = `<button class="btn btn-primary btn-sm" id="promo-upload-btn">+ Upload Media</button>`;
  document.getElementById("promo-upload-btn").addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*,video/*";
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const { url, resourceType } = await uploadAdminMedia(file, "promo");
        await addDoc(collection(db, "promoMedia"), { url, type: resourceType, createdAt: serverTimestamp() });
        showToast("Uploaded.", "success");
        loadPromo(mount, uploadWrap);
      } catch (err) {
        console.error(err);
        showToast("Upload failed.", "error");
      }
    });
    input.click();
  });

  const snap = await getDocs(query(collection(db, "promoMedia"), orderBy("createdAt", "desc")));
  if (snap.empty) {
    mount.innerHTML = `<div class="state-block"><h3>No promotional media yet</h3><p>Upload marketing images or clips not tied to a specific template or project.</p></div>`;
    return;
  }
  mount.innerHTML = `<div class="grid grid-3">${snap.docs.map(d => {
    const m = d.data();
    return `
      <div class="media-card">
        <div class="media-card-thumb" data-open="${escapeHtml(m.url)}" style="cursor:zoom-in;">
          ${m.type === "video" ? `<video src="${escapeHtml(m.url)}" style="width:100%;height:100%;object-fit:cover;" muted></video>` : `<img src="${escapeHtml(m.url)}" alt="">`}
        </div>
        <div class="media-card-body">
          <div class="media-card-desc">${formatDate(m.createdAt)}</div>
          <button class="btn btn-outline btn-sm" data-delete="${escapeHtml(d.id)}" style="border-color:#B23A3A;color:#B23A3A;">Delete</button>
        </div>
      </div>
    `;
  }).join("")}</div>`;
  wireOpen(mount);
  mount.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", async () => {
    const ok = await confirmDialog("Remove this media item from the library?", "Delete");
    if (!ok) return;
    await deleteDoc(doc(db, "promoMedia", btn.dataset.delete));
    loadPromo(mount, uploadWrap);
  }));
}
