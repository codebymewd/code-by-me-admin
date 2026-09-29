import { requireAuth, logout } from "./admin-auth.js";
import { initNotificationCenter } from "./notifications.js";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch((err) => console.error("SW registration failed:", err));
}

const ROUTES = {
  dashboard: { title: "Dashboard", load: () => import("./dashboard.js") },
  orders: { title: "Orders", load: () => import("./orders.js") },
  templates: { title: "Templates", load: () => import("./templates.js") },
  projects: { title: "Projects", load: () => import("./projects.js") },
  messages: { title: "Messages", load: () => import("./messages.js") },
  media: { title: "Media", load: () => import("./media.js") },
  settings: { title: "Settings", load: () => import("./settings.js") },
};

const panelRoot = document.getElementById("panel-root");
const panelTitle = document.getElementById("panel-title");
const navLinks = document.querySelectorAll(".admin-nav a");

function setActiveNav(route) {
  navLinks.forEach((a) => a.classList.toggle("active", a.dataset.route === route));
}

async function renderRoute() {
  const hash = (location.hash || "#dashboard").replace("#", "");
  const route = ROUTES[hash] ? hash : "dashboard";
  setActiveNav(route);
  panelTitle.textContent = ROUTES[route].title;
  panelRoot.innerHTML = `<div class="skeleton skeleton-card"></div>`;
  try {
    const mod = await ROUTES[route].load();
    await mod.render(panelRoot);
  } catch (err) {
    console.error(err);
    panelRoot.innerHTML = `<div class="state-block"><h3>Something went wrong</h3><p>This section couldn't load. Refresh and try again.</p></div>`;
  }
}

function watchOffline() {
  const banner = document.getElementById("offline-banner");
  const update = () => banner.classList.toggle("show", !navigator.onLine);
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

async function init() {
  const user = await requireAuth(); // redirects to login.html if not an authorized owner
  document.getElementById("owner-chip").textContent = user.email || "";
  document.getElementById("logout-btn").addEventListener("click", logout);
  initNotificationCenter(user);
  watchOffline();
  window.addEventListener("hashchange", renderRoute);
  renderRoute();
}

init();
