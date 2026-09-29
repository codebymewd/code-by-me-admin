export { escapeHtml, showToast, formatNaira, buildWhatsAppLink, isValidEmail, validateField } from "./shared.js";
import { escapeHtml } from "./shared.js";

export function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function fileSlotHtml(file, emptyLabel = "Click to upload a file") {
  if (!file || !file.url) {
    return `<div class="upload-mini" data-file-upload>${escapeHtml(emptyLabel)}</div>`;
  }
  return `
    <div class="file-slot">
      <div class="file-slot-info">
        <strong>${escapeHtml(file.fileName || "File")}</strong>
        <span class="form-hint">${file.size ? formatBytes(file.size) + " · " : ""}${file.uploadedAt ? formatDate(file.uploadedAt) : ""}</span>
      </div>
      <div class="file-slot-actions">
        <a href="${escapeHtml(file.url)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">Download</a>
        <button type="button" class="btn btn-outline btn-sm" data-file-upload>Replace</button>
        <button type="button" class="btn btn-outline btn-sm" data-file-remove style="border-color:#B23A3A;color:#B23A3A;">Remove</button>
      </div>
    </div>
  `;
}

const PILL_MAP = {
  "Awaiting Verification": "pill-yellow",
  "Payment Submitted": "pill-yellow",
  "Under Review": "pill-yellow",
  "Payment Confirmed": "pill-green",
  "Confirmed": "pill-green",
  "Processing": "pill-yellow",
  "Ready": "pill-yellow",
  "Completed": "pill-green",
  "Payment Rejected": "pill-red",
  "Declined": "pill-red",
  "Cancelled": "pill-grey",
  "New": "pill-yellow",
  "Read": "pill-grey",
  "Published": "pill-green",
  "Unpublished": "pill-grey",
};

export function statusPill(status) {
  const cls = PILL_MAP[status] || "pill-grey";
  return `<span class="pill ${cls}">${escapeHtml(status || "—")}</span>`;
}

/** Renders a modal with `bodyHtml` inside; returns the modal root element so
 * callers can wire up their own form listeners. Closes on backdrop click or
 * the × button. */
export function openModal(bodyHtml, { wide = false } = {}) {
  const backdrop = document.createElement("div");
  backdrop.className = "admin-modal-backdrop";
  backdrop.innerHTML = `
    <div class="admin-modal ${wide ? "admin-modal-wide" : ""}">
      <button class="admin-modal-close" data-close>&times;</button>
      ${bodyHtml}
    </div>
  `;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop || e.target.hasAttribute("data-close")) close();
  });
  return { el: backdrop, close };
}

export function openLightbox(imageUrl) {
  const backdrop = document.createElement("div");
  backdrop.className = "lightbox-backdrop";
  backdrop.innerHTML = `<button class="lightbox-close" data-close>&times;</button><img src="${escapeHtml(imageUrl)}" alt="Full size">`;
  document.body.appendChild(backdrop);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop || e.target.hasAttribute("data-close")) backdrop.remove();
  });
}

/** Simple confirm dialog returning a Promise<boolean>, so destructive
 * actions (delete/reject) aren't just a bare window.confirm(). */
export function confirmDialog(message, confirmLabel = "Confirm") {
  return new Promise((resolve) => {
    const { close } = openModal(`
      <h3>Are you sure?</h3>
      <p>${escapeHtml(message)}</p>
      <div style="display:flex;gap:10px;margin-top:20px;">
        <button class="btn btn-outline btn-block" data-cancel>Cancel</button>
        <button class="btn btn-dark btn-block" data-confirm>${escapeHtml(confirmLabel)}</button>
      </div>
    `);
    document.querySelector("[data-confirm]").addEventListener("click", () => { close(); resolve(true); });
    document.querySelector("[data-cancel]").addEventListener("click", () => { close(); resolve(false); });
  });
}
