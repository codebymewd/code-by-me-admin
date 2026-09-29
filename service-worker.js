importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDURpUWg06T_Vozq6IStAJkukTseJklsZc",
  authDomain: "codebyme-2d414.firebaseapp.com",
  projectId: "codebyme-2d414",
  storageBucket: "codebyme-2d414.firebasestorage.app",
  messagingSenderId: "19698503295",
  appId: "1:19698503295:web:edfc948d0c04e14cc9794a"
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "CBM";
  const body = payload.notification?.body || "";
  const link = payload.data?.link || "#dashboard";
  self.registration.showNotification(title, {
    body,
    icon: "./assets/icon-192.png",
    data: { link },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification?.data?.link || "#dashboard";
  const targetUrl = new URL(link, self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      if ("focus" in client) {
        client.focus();
        client.postMessage({ type: "CBM_NOTIFICATION_CLICK", link });
        return;
      }
    }
    if (clients.openWindow) return clients.openWindow(targetUrl);
  }));
});

const CACHE_NAME = "cbm-admin-shell-v1";
const SHELL_FILES = [
  "./index.html",
  "./login.html",
  "./manifest.json",
  "./css/admin.css",
  "./css/style.css",
  "./js/admin-app.js",
  "./js/admin-auth.js",
  "./js/admin-firebase.js",
  "./js/admin-cloudinary.js",
  "./js/firebase-config.js",
  "./js/shared.js",
  "./js/common.js",
  "./js/login.js",
  "./js/dashboard.js",
  "./js/orders.js",
  "./js/templates.js",
  "./js/projects.js",
  "./js/messages.js",
  "./js/media.js",
  "./js/settings.js",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first for the app shell only. Everything else (Firestore, Cloudinary,
// Google Fonts, the auth SDK) goes straight to the network — the dashboard
// must never render stale cloud data while offline; see admin-app.js's
// offline banner for how that's surfaced instead.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (!isSameOrigin || event.request.method !== "GET") return; // let network-only requests pass through untouched

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached);
    })
  );
});
