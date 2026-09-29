import { db, doc, getDoc, setDoc, serverTimestamp } from "./admin-firebase.js";
import { escapeHtml, showToast } from "./common.js";

export async function render(root) {
  root.innerHTML = `<div class="admin-panel"><div class="skeleton" style="height:300px;"></div></div>`;
  let settings = {};
  try {
    const snap = await getDoc(doc(db, "settings", "general"));
    settings = snap.exists() ? snap.data() : {};
  } catch (err) {
    console.error(err);
  }
  const pay = settings.paymentDetails || {};

  root.innerHTML = `
    <div class="admin-panel">
      <h3>Business Information</h3>
      <form id="settings-form" class="admin-form">
        <div class="form-row">
          <div class="form-field"><label>Business Name</label><input id="s-name" value="${escapeHtml(settings.businessName || "Code by Me")}"></div>
          <div class="form-field"><label>Motto</label><input id="s-motto" value="${escapeHtml(settings.motto || "Build. Simplify. Grow.")}"></div>
        </div>
        <div class="form-row">
          <div class="form-field"><label>WhatsApp Number</label><input id="s-whatsapp" value="${escapeHtml(settings.whatsapp || "2349053047349")}"></div>
          <div class="form-field"><label>Email</label><input id="s-email" value="${escapeHtml(settings.email || "codebymewd@gmail.com")}"></div>
        </div>
        <div class="form-field"><label>Telegram</label><input id="s-telegram" value="${escapeHtml(settings.telegram || "@codebymewd")}"></div>

        <h3 style="margin-top:26px;">Payment Details</h3>
        <p class="form-hint" style="margin-bottom:14px;">Shown to customers at checkout for manual bank transfer.</p>
        <div class="form-row">
          <div class="form-field"><label>Bank Name</label><input id="s-bank-name" value="${escapeHtml(pay.bankName || "")}"></div>
          <div class="form-field"><label>Account Name</label><input id="s-account-name" value="${escapeHtml(pay.accountName || "")}"></div>
        </div>
        <div class="form-field"><label>Account Number</label><input id="s-account-number" value="${escapeHtml(pay.accountNumber || "")}"></div>
        <div class="form-field"><label>Payment Instructions</label><textarea id="s-instructions" rows="2">${escapeHtml(pay.instructions || "")}</textarea></div>

        <button type="submit" class="btn btn-primary" style="margin-top:10px;">Save Settings</button>
      </form>
    </div>
  `;

  document.getElementById("settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      await setDoc(doc(db, "settings", "general"), {
        businessName: document.getElementById("s-name").value.trim(),
        motto: document.getElementById("s-motto").value.trim(),
        whatsapp: document.getElementById("s-whatsapp").value.trim(),
        email: document.getElementById("s-email").value.trim(),
        telegram: document.getElementById("s-telegram").value.trim(),
        paymentDetails: {
          bankName: document.getElementById("s-bank-name").value.trim(),
          accountName: document.getElementById("s-account-name").value.trim(),
          accountNumber: document.getElementById("s-account-number").value.trim(),
          instructions: document.getElementById("s-instructions").value.trim(),
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });
      showToast("Settings saved.", "success");
    } catch (err) {
      console.error(err);
      showToast("Couldn't save settings. Check your connection.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Save Settings";
    }
  });
}
