import {
  db, collection, query, where, orderBy, limit, getDocs, getCountFromServer,
} from "./admin-firebase.js";
import { escapeHtml, formatNaira, statusPill, formatDate } from "./common.js";

export async function render(root) {
  root.innerHTML = `
    <div class="stat-grid" id="stat-grid">
      ${Array.from({ length: 6 }).map(() => `<div class="skeleton" style="height:78px;"></div>`).join("")}
    </div>
    <div class="admin-panel">
      <h3>Recent Orders</h3>
      <div class="table-scroll" id="recent-orders"><div class="skeleton" style="height:160px;"></div></div>
    </div>
    <div class="admin-panel">
      <h3>Recent Activity</h3>
      <div id="recent-activity"><div class="skeleton" style="height:160px;"></div></div>
    </div>
  `;

  loadStats();
  loadRecentOrders();
  loadRecentActivity();
}

async function countWhere(colName, field, op, value) {
  try {
    const q = field ? query(collection(db, colName), where(field, op, value)) : collection(db, colName);
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch (err) {
    console.error(colName, err);
    return "—";
  }
}

async function loadStats() {
  const mount = document.getElementById("stat-grid");
  const [
    totalTemplates, publishedTemplates, totalProjects,
    pendingOrders, screenshotsAwaiting, unreadMessages,
  ] = await Promise.all([
    countWhere("templates"),
    countWhere("templates", "active", "==", true),
    countWhere("projects"),
    countWhere("orders", "orderStatus", "==", "Awaiting Verification"),
    countWhere("orders", "paymentStatus", "==", "Payment Submitted"),
    countWhere("contactMessages", "status", "==", "New"),
  ]);

  const cards = [
    ["Total Templates", totalTemplates],
    ["Published Templates", publishedTemplates],
    ["Total Projects", totalProjects],
    ["Pending Orders", pendingOrders],
    ["Screenshots Awaiting Review", screenshotsAwaiting],
    ["Unread Messages", unreadMessages],
  ];
  mount.innerHTML = cards.map(([label, value]) => `
    <div class="stat-card">
      <div class="stat-value">${escapeHtml(String(value))}</div>
      <div class="stat-label">${escapeHtml(label)}</div>
    </div>
  `).join("");
}

async function loadRecentOrders() {
  const mount = document.getElementById("recent-orders");
  try {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(5));
    const snap = await getDocs(q);
    if (snap.empty) {
      mount.innerHTML = `<div class="state-block"><h3>No orders yet</h3><p>Orders placed on the public site will show up here.</p></div>`;
      return;
    }
    mount.innerHTML = `
      <table class="admin-table">
        <thead><tr><th>Order ID</th><th>Customer</th><th>Item</th><th>Amount</th><th>Payment</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>
          ${snap.docs.map(d => {
            const o = d.data();
            return `<tr>
              <td>${escapeHtml(o.orderId)}</td>
              <td>${escapeHtml(o.customerName)}</td>
              <td>${escapeHtml(o.templateName)}</td>
              <td>${formatNaira(o.amount)}</td>
              <td>${statusPill(o.paymentStatus)}</td>
              <td>${statusPill(o.orderStatus)}</td>
              <td>${formatDate(o.createdAt)}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error(err);
    mount.innerHTML = `<div class="state-block"><h3>Couldn't load orders</h3><p>Refresh to try again.</p></div>`;
  }
}

// There isn't a dedicated activity-log collection yet (Phase 3 could add one
// written by a Cloud Function on every write). For now this approximates a
// feed by merging the newest orders and messages by timestamp.
async function loadRecentActivity() {
  const mount = document.getElementById("recent-activity");
  try {
    const [ordersSnap, msgSnap] = await Promise.all([
      getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(5))),
      getDocs(query(collection(db, "contactMessages"), orderBy("createdAt", "desc"), limit(5))),
    ]);
    const items = [
      ...ordersSnap.docs.map(d => ({
        time: d.data().createdAt, text: `New order ${d.data().orderId} — ${d.data().templateName}`,
      })),
      ...msgSnap.docs.map(d => ({
        time: d.data().createdAt, text: `New message from ${d.data().name}`,
      })),
    ].filter(i => i.time).sort((a, b) => b.time.toMillis() - a.time.toMillis()).slice(0, 8);

    if (!items.length) {
      mount.innerHTML = `<div class="state-block"><h3>Nothing yet</h3><p>Activity will appear here as orders and messages come in.</p></div>`;
      return;
    }
    mount.innerHTML = items.map(i => `
      <div class="activity-item">
        <div class="activity-dot"></div>
        <div>${escapeHtml(i.text)}<div class="activity-time">${formatDate(i.time)}</div></div>
      </div>
    `).join("");
  } catch (err) {
    console.error(err);
    mount.innerHTML = `<div class="state-block"><h3>Couldn't load activity</h3><p>Refresh to try again.</p></div>`;
  }
}
