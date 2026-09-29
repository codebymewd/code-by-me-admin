import {
  db, collection, doc, getDoc, getDocs, updateDoc, query, orderBy, limit, serverTimestamp,
} from "./admin-firebase.js";
import {
  escapeHtml, formatNaira, statusPill, formatDate, buildWhatsAppLink, formatBytes,
  openModal, openLightbox, confirmDialog, showToast,
} from "./common.js";
import { notifyCBM } from "./notification-client.js";

const STATUS_FILTERS = [
  "Awaiting Verification", "Payment Submitted", "Under Review",
  "Payment Confirmed", "Payment Rejected", "Completed",
];

let allOrders = [];

export async function render(root) {
  root.innerHTML = `
    <div class="admin-panel">
      <div class="panel-head">
        <div class="panel-actions">
          <input type="text" id="order-search" class="admin-search" placeholder="Search Order ID, name, email, phone…">
          <select id="order-filter" class="admin-select">
            <option value="">All statuses</option>
            ${STATUS_FILTERS.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="table-scroll" id="orders-table"><div class="skeleton" style="height:260px;"></div></div>
      <p class="form-hint" style="margin-top:10px;">Showing the 200 most recent orders. Search and filter apply to this set.</p>
    </div>
  `;

  document.getElementById("order-search").addEventListener("input", renderTable);
  document.getElementById("order-filter").addEventListener("change", renderTable);

  await loadOrders();
  renderTable();
}

async function loadOrders() {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(200));
  const snap = await getDocs(q);
  allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderTable() {
  const mount = document.getElementById("orders-table");
  const search = document.getElementById("order-search").value.trim().toLowerCase();
  const filter = document.getElementById("order-filter").value;

  const rows = allOrders.filter(o => {
    const matchesSearch = !search || [o.orderId, o.customerName, o.email, o.phone]
      .some(v => String(v || "").toLowerCase().includes(search));
    const matchesFilter = !filter || o.paymentStatus === filter || o.orderStatus === filter;
    return matchesSearch && matchesFilter;
  });

  if (!rows.length) {
    mount.innerHTML = `<div class="state-block"><h3>No matching orders</h3><p>Try a different search or filter.</p></div>`;
    return;
  }

  mount.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Order ID</th><th>Customer</th><th>Item</th><th>Amount</th><th>Payment</th><th>Status</th><th>Date</th></tr></thead>
      <tbody>
        ${rows.map(o => `
          <tr>
            <td><span class="row-link" data-order-id="${escapeHtml(o.id)}">${escapeHtml(o.orderId)}</span></td>
            <td>${escapeHtml(o.customerName)}</td>
            <td>${escapeHtml(o.templateName)}${o.package ? ` <span class="form-hint">(${escapeHtml(o.package)})</span>` : ""}</td>
            <td>${formatNaira(o.amount)}</td>
            <td>${statusPill(o.paymentStatus)}</td>
            <td>${statusPill(o.orderStatus)}</td>
            <td>${formatDate(o.createdAt)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  mount.querySelectorAll("[data-order-id]").forEach(el => {
    el.addEventListener("click", () => openOrderDetail(el.dataset.orderId));
  });
}

function screenshotHtml(order) {
  if (!order.paymentScreenshot) {
    return `<div class="screenshot-frame"><div class="screenshot-state">No screenshot was uploaded for this order.</div></div>`;
  }
  return `
    <div class="screenshot-frame" id="ss-frame">
      <div class="screenshot-state" id="ss-loading">Loading screenshot…</div>
      <img id="ss-img" src="${escapeHtml(order.paymentScreenshot)}" alt="Payment screenshot" style="display:none;">
    </div>
    <div style="display:flex;gap:10px;margin-top:10px;">
      <a class="btn btn-outline btn-sm" href="${escapeHtml(order.paymentScreenshot)}" target="_blank" rel="noopener" download>Download</a>
    </div>
  `;
}

function wireScreenshot(order) {
  const img = document.getElementById("ss-img");
  const loading = document.getElementById("ss-loading");
  const frame = document.getElementById("ss-frame");
  if (!img) return;
  img.addEventListener("load", () => {
    loading.style.display = "none";
    img.style.display = "block";
  });
  img.addEventListener("error", () => {
    loading.textContent = "This image couldn't be loaded.";
  });
  frame.addEventListener("click", () => {
    if (order.paymentScreenshot) openLightbox(order.paymentScreenshot);
  });
}

function openOrderDetail(id) {
  const order = allOrders.find(o => o.id === id);
  if (!order) return;

  const waLink = buildWhatsAppLink({
    customerName: order.customerName, templateName: order.templateName,
    orderId: order.orderId, packageLabel: order.package || "",
    extra: "I'm reaching out to verify your payment.",
  });

  const { close } = openModal(`
    <h3>${escapeHtml(order.orderId)}</h3>
    <p class="form-hint">${escapeHtml(order.customerName)} · ${escapeHtml(order.email)} · ${escapeHtml(order.phone)}</p>

    <ul class="info-list" style="margin:16px 0;">
      <li>Template: ${escapeHtml(order.templateName)}</li>
      <li>Package: ${escapeHtml(order.package || "—")}</li>
      <li>Admin Dashboard: ${escapeHtml(order.adminDashboardType || "—")}</li>
      <li>API Requested: ${order.apiRequired ? "Yes" : "No"}</li>
      <li>Setup Requested: ${order.setupRequested ? "Yes" : "No"}</li>
      <li>Amount: ${formatNaira(order.amount)}</li>
      <li>Placed: ${formatDate(order.createdAt)}</li>
      ${order.declineReason ? `<li>Decline reason: ${escapeHtml(order.declineReason)}</li>` : ""}
    </ul>

    <h4>Payment Screenshot</h4>
    ${screenshotHtml(order)}

    <h4 style="margin-top:20px;">Purchased Files</h4>
    <div id="purchased-files">Loading…</div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px;">
      <a href="${waLink}" target="_blank" rel="noopener" class="btn whatsapp-btn btn-sm">Verify via WhatsApp</a>
      <select class="admin-select" id="order-status-select" style="margin-left:auto;">
        ${["Awaiting Verification", "Payment Submitted", "Under Review", "Processing", "Ready", "Completed", "Cancelled"]
          .map(s => `<option value="${escapeHtml(s)}" ${s === order.orderStatus ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}
      </select>
      <button class="btn btn-outline btn-sm" id="save-status-btn">Update Status</button>
    </div>
    <div style="display:flex;gap:10px;margin-top:12px;">
      <button class="btn btn-primary btn-sm btn-block" id="confirm-payment-btn" ${order.paymentStatus === "Payment Confirmed" ? "disabled" : ""}>Confirm Payment</button>
      <button class="btn btn-outline btn-sm btn-block" id="reject-payment-btn" style="border-color:#B23A3A;color:#B23A3A;">Reject Payment</button>
    </div>
  `, { wide: true });

  wireScreenshot(order);
  loadPurchasedFiles(order);

  document.getElementById("save-status-btn").addEventListener("click", async () => {
    const newStatus = document.getElementById("order-status-select").value;
    await updateOrder(order.id, { orderStatus: newStatus });
    showToast("Order status updated.", "success");
    close();
    renderTable();
  });

  document.getElementById("confirm-payment-btn").addEventListener("click", async () => {
    const ok = await confirmDialog(`Confirm that ${order.customerName}'s payment of ${formatNaira(order.amount)} has been received?`, "Confirm Payment");
    if (!ok) return;
    await updateOrder(order.id, { paymentStatus: "Payment Confirmed", orderStatus: "Processing", declineReason: null });
    showToast("Payment confirmed.", "success");
    close();
    renderTable();
  });

  document.getElementById("reject-payment-btn").addEventListener("click", async () => {
    const reason = window.prompt("Reason for rejecting this payment (shown internally, and referenced if you message the customer):");
    if (reason === null) return;
    await updateOrder(order.id, { paymentStatus: "Payment Rejected", orderStatus: "Declined", declineReason: reason || "Not specified" });
    showToast("Payment rejected.", "success");
    close();
    renderTable();
  });
}

function fileRow(label, file) {
  if (!file || !file.url) return `<li>${escapeHtml(label)}: <span class="form-hint">not uploaded for this template</span></li>`;
  return `<li>${escapeHtml(label)}: <a href="${escapeHtml(file.url)}" target="_blank" rel="noopener">${escapeHtml(file.fileName || "Download")}</a> ${file.size ? `<span class="form-hint">(${formatBytes(file.size)})</span>` : ""}</li>`;
}

async function loadPurchasedFiles(order) {
  const mount = document.getElementById("purchased-files");
  if (!mount) return;
  if (!order.templateId) {
    mount.innerHTML = `<p class="form-hint">No template is linked to this order.</p>`;
    return;
  }
  try {
    const snap = await getDoc(doc(db, "templates", order.templateId));
    if (!snap.exists()) {
      mount.innerHTML = `<p class="form-hint">The template for this order no longer exists.</p>`;
      return;
    }
    const t = snap.data();
    const confirmed = order.paymentStatus === "Payment Confirmed";
    mount.innerHTML = `
      <ul class="info-list">
        ${fileRow("Website", t.websiteFile)}
        ${t.adminDashboardIncluded ? fileRow("Admin Dashboard", t.adminDashboardFile) : `<li>Admin Dashboard: <span class="form-hint">not included with this template</span></li>`}
        ${fileRow("Setup Instructions", t.setupInstructionsFile)}
      </ul>
      <p class="form-hint">${confirmed
        ? "Payment is confirmed — the customer can now see these same links on the Check Order page."
        : "These links won't appear on the customer's Check Order page until payment is confirmed."}</p>
    `;
  } catch (err) {
    console.error(err);
    mount.innerHTML = `<p class="form-hint">Couldn't load file info for this order's template.</p>`;
  }
}

async function updateOrder(id, fields) {
  try {
    // Persist the order change first. Notifications are strictly secondary
    // and must never block or undo a successful admin update.
    await updateDoc(doc(db, "orders", id), { ...fields, updatedAt: serverTimestamp() });

    const idx = allOrders.findIndex(o => o.id === id);
    if (idx > -1) allOrders[idx] = { ...allOrders[idx], ...fields };

    const events = [];
    if (fields.paymentStatus === "Payment Confirmed") {
      events.push({ type: "payment.confirmed", orderId: id });
    }
    if (fields.paymentStatus === "Payment Rejected") {
      events.push({ type: "payment.rejected", orderId: id });
    }

    const statusEvents = {
      "Processing": "status.processing",
      "Ready": "status.ready",
      "Completed": "status.completed",
      "Declined": "status.declined",
      "Cancelled": "status.cancelled",
      "Dispatched": "status.dispatched",
      "Shipped": "status.shipped",
      "Out for Delivery": "status.out_for_delivery",
      "Delivered": "status.delivered",
    };
    if (fields.orderStatus && statusEvents[fields.orderStatus]) {
      events.push({ type: statusEvents[fields.orderStatus], orderId: id });
    }

    if (events.length) {
      void notifyCBM(events).catch((notificationError) => {
        console.warn("Order updated, but notification delivery failed:", notificationError);
      });
    }
  } catch (err) {
    console.error(err);
    showToast("Couldn't save that change. Check your connection.", "error");
  }
}
