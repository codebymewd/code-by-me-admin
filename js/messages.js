import {
  db, collection, doc, getDocs, updateDoc, deleteDoc, query, orderBy, serverTimestamp,
} from "./admin-firebase.js";
import { escapeHtml, statusPill, formatDate, openModal, confirmDialog, showToast } from "./common.js";

let allMessages = [];

export async function render(root) {
  root.innerHTML = `
    <div class="admin-panel">
      <h3>Contact Messages</h3>
      <div class="table-scroll" id="messages-table"><div class="skeleton" style="height:260px;"></div></div>
    </div>
  `;
  await loadMessages();
  renderTable();
}

async function loadMessages() {
  const snap = await getDocs(query(collection(db, "contactMessages"), orderBy("createdAt", "desc")));
  allMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderTable() {
  const mount = document.getElementById("messages-table");
  if (!allMessages.length) {
    mount.innerHTML = `<div class="state-block"><h3>No messages yet</h3><p>Messages from the Contact page will appear here.</p></div>`;
    return;
  }
  mount.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Name</th><th>Email</th><th>Message</th><th>Status</th><th>Date</th></tr></thead>
      <tbody>
        ${allMessages.map(m => `
          <tr style="${m.status === "New" ? "font-weight:600;" : ""}">
            <td><span class="row-link" data-open="${escapeHtml(m.id)}">${escapeHtml(m.name)}</span></td>
            <td>${escapeHtml(m.email)}</td>
            <td>${escapeHtml((m.message || "").slice(0, 60))}${(m.message || "").length > 60 ? "…" : ""}</td>
            <td>${statusPill(m.status || "New")}</td>
            <td>${formatDate(m.createdAt)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  mount.querySelectorAll("[data-open]").forEach(el => el.addEventListener("click", () => openMessage(el.dataset.open)));
}

function openMessage(id) {
  const m = allMessages.find(x => x.id === id);
  if (!m) return;

  const { close } = openModal(`
    <h3>${escapeHtml(m.name)}</h3>
    <p class="form-hint">${escapeHtml(m.email)}${m.phone ? " · " + escapeHtml(m.phone) : ""} · ${formatDate(m.createdAt)}</p>
    <p style="margin-top:16px;white-space:pre-wrap;">${escapeHtml(m.message)}</p>
    <div style="display:flex;gap:10px;margin-top:22px;">
      <a href="mailto:${escapeHtml(m.email)}" class="btn btn-outline btn-sm">Reply by Email</a>
      <button class="btn btn-outline btn-sm" id="archive-msg-btn" style="border-color:#B23A3A;color:#B23A3A;margin-left:auto;">Delete</button>
    </div>
  `);

  if (m.status !== "Read") {
    updateDoc(doc(db, "contactMessages", id), { status: "Read", updatedAt: serverTimestamp() });
    m.status = "Read";
    renderTable();
  }

  document.getElementById("archive-msg-btn").addEventListener("click", async () => {
    const ok = await confirmDialog("Delete this message permanently?", "Delete Message");
    if (!ok) return;
    await deleteDoc(doc(db, "contactMessages", id));
    allMessages = allMessages.filter(x => x.id !== id);
    close();
    renderTable();
    showToast("Message deleted.", "success");
  });
}
