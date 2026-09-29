// =====================================================================
// SHARED.JS — small standalone helpers the dashboard needs, copied out
// of the public site's js/common.js so this package has no dependency
// on anything outside its own folder.
// =====================================================================

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

let toastEl = null;
export function showToast(message, type = "default", duration = 3600) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    document.body.appendChild(toastEl);
  }
  toastEl.className = "toast " + (type === "error" ? "toast-error" : type === "success" ? "toast-success" : "");
  toastEl.textContent = message;
  requestAnimationFrame(() => toastEl.classList.add("show"));
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove("show"), duration);
}

export function formatNaira(amount) {
  const n = Number(amount || 0);
  return "₦" + n.toLocaleString("en-NG");
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export function validateField(fieldEl, condition, message) {
  const wrap = fieldEl.closest(".form-field");
  const errorEl = wrap.querySelector(".field-error");
  if (!condition) {
    wrap.classList.add("has-error");
    if (errorEl) errorEl.textContent = message;
    return false;
  }
  wrap.classList.remove("has-error");
  return true;
}

const CBM_WHATSAPP = "2349053047349";
export function buildWhatsAppLink({ customerName, templateName, orderId, packageLabel, extra = "" }) {
  let msg = `Hello Code by Me, I purchased ${templateName} with ${packageLabel}. My Order ID is ${orderId}.`;
  if (extra) msg += " " + extra;
  const encoded = encodeURIComponent(msg);
  return `https://wa.me/${CBM_WHATSAPP}?text=${encoded}`;
}
