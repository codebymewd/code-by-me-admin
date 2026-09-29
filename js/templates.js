import {
  db, collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp,
} from "./admin-firebase.js";
import { uploadAdminMedia, uploadDeliverableFile} from "./admin-cloudinary.js";
import { escapeHtml, formatNaira, statusPill, openModal, confirmDialog, showToast, fileSlotHtml } from "./common.js";

const TEMPLATE_CATEGORIES = ["Business", "Portfolio", "Restaurant", "Fashion", "Beauty", "Gadgets"];

let allTemplates = [];
let formState = null; // in-memory state for the open add/edit modal

export async function render(root) {
  root.innerHTML = `
    <div class="admin-panel">
      <div class="panel-head">
        <h3 style="margin:0;">Templates</h3>
        <button class="btn btn-primary btn-sm" id="add-template-btn">+ Add Template</button>
      </div>
      <div class="table-scroll" id="templates-table"><div class="skeleton" style="height:260px;"></div></div>
    </div>
  `;
  document.getElementById("add-template-btn").addEventListener("click", () => openTemplateForm(null));
  await loadTemplates();
  renderTable();
}

async function loadTemplates() {
  const snap = await getDocs(query(collection(db, "templates"), orderBy("createdAt", "desc")));
  allTemplates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderTable() {
  const mount = document.getElementById("templates-table");
  if (!allTemplates.length) {
    mount.innerHTML = `<div class="state-block"><h3>No templates yet</h3><p>Add your first ready-made template.</p></div>`;
    return;
  }
  mount.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Name</th><th>Type</th><th>Price</th><th>Status</th><th>Featured</th><th>Dashboard</th><th></th></tr></thead>
      <tbody>
        ${allTemplates.map(t => `
          <tr>
            <td><span class="row-link" data-edit="${escapeHtml(t.id)}">${escapeHtml(t.name || "Untitled")}</span></td>
            <td>${escapeHtml(t.category || "—")}</td>
            <td>${formatNaira(t.price)}</td>
            <td>${statusPill(t.active ? "Published" : "Unpublished")}</td>
            <td>${t.featured ? "★" : "—"}</td>
            <td>${escapeHtml(t.adminDashboardType === "installable" ? "Installable" : `Hosted (${t.hostedType || "static"})`)}</td>
            <td style="display:flex;gap:8px;">
              <button class="btn btn-outline btn-sm" data-toggle="${escapeHtml(t.id)}">${t.active ? "Unpublish" : "Publish"}</button>
              <button class="btn btn-outline btn-sm" data-delete="${escapeHtml(t.id)}" style="border-color:#B23A3A;color:#B23A3A;">Delete</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  mount.querySelectorAll("[data-edit]").forEach(el => el.addEventListener("click", () => openTemplateForm(el.dataset.edit)));
  mount.querySelectorAll("[data-toggle]").forEach(el => el.addEventListener("click", () => toggleActive(el.dataset.toggle)));
  mount.querySelectorAll("[data-delete]").forEach(el => el.addEventListener("click", () => deleteTemplate(el.dataset.delete)));
}

async function toggleActive(id) {
  const t = allTemplates.find(x => x.id === id);
  await updateDoc(doc(db, "templates", id), { active: !t.active, updatedAt: serverTimestamp() });
  t.active = !t.active;
  renderTable();
}

async function deleteTemplate(id) {
  const ok = await confirmDialog("This permanently deletes the template record. Customers will no longer be able to view or purchase it.", "Delete Template");
  if (!ok) return;
  await deleteDoc(doc(db, "templates", id));
  allTemplates = allTemplates.filter(x => x.id !== id);
  renderTable();
  showToast("Template deleted.", "success");
}

function defaultState() {
  return {
    id: null, active: false, featured: false, category: "Business", name: "", slug: "", description: "",
    price: 0, technologies: "", featuresText: "", previewImage: "", screenshots: [],
    promoVideo: "", livePreview: "", adminDashboardType: "hosted", hostedType: "static",
    apiRequired: false, apiService: "", apiSetupPrice: 0, setupAvailable: false,
    setupPrice: 0, setupDocumentation: "", packages: [],
    adminDashboardIncluded: false, websiteFile: null, adminDashboardFile: null, setupInstructionsFile: null,
  };
}

function toState(t) {
  return {
    id: t.id, active: !!t.active, featured: !!t.featured, category: t.category || "Business", name: t.name || "", slug: t.slug || "",
    description: t.description || "", price: t.price || 0,
    technologies: (t.technologies || []).join(", "),
    featuresText: (t.features || []).join("\n"),
    previewImage: t.previewImage || "", screenshots: t.screenshots || [], promoVideo: t.promoVideo || "",
    livePreview: t.livePreview || "", adminDashboardType: t.adminDashboardType || "hosted",
    hostedType: t.hostedType || "static", apiRequired: !!t.apiRequired,
    apiService: (t.apiService || []).join(", "), apiSetupPrice: t.apiSetupPrice || 0,
    setupAvailable: !!t.setupAvailable, setupPrice: t.setupPrice || 0,
    setupDocumentation: t.setupDocumentation || "", packages: t.packages || [],
    adminDashboardIncluded: !!t.adminDashboardIncluded,
    websiteFile: t.websiteFile || null, adminDashboardFile: t.adminDashboardFile || null,
    setupInstructionsFile: t.setupInstructionsFile || null,
  };
}

function slugify(str) {
  return String(str).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function openTemplateForm(id) {
  const existing = id ? allTemplates.find(t => t.id === id) : null;
  formState = existing ? toState(existing) : defaultState();

  const { close } = openModal(`
    <h3>${formState.id ? "Edit Template" : "Add Template"}</h3>
    <form id="template-form" class="admin-form">
      <div class="form-row">
        <div class="form-field"><label>Name</label><input id="f-name" value="${escapeHtml(formState.name)}" required></div>
        <div class="form-field"><label>Slug</label><input id="f-slug" value="${escapeHtml(formState.slug)}" placeholder="auto-generated from name"></div>
      </div>
      <div class="form-field"><label>Description</label><textarea id="f-description" rows="3">${escapeHtml(formState.description)}</textarea></div>
      <div class="form-field">
        <label>Template Type</label>
        <select id="f-category" class="admin-select" style="width:100%;">
          ${TEMPLATE_CATEGORIES.map(category => `<option value="${category}" ${formState.category === category ? "selected" : ""}>${category}</option>`).join("")}
        </select>
      </div>
      <div class="form-row">
        <div class="form-field"><label>Base Price (₦)</label><input id="f-price" type="number" min="0" value="${formState.price}"></div>
        <div class="form-field"><label>Live Preview URL</label><input id="f-livepreview" value="${escapeHtml(formState.livePreview)}"></div>
      </div>
      <div class="form-field"><label>Technologies (comma separated)</label><input id="f-tech" value="${escapeHtml(formState.technologies)}"></div>
      <div class="form-field"><label>Features (one per line)</label><textarea id="f-features" rows="3">${escapeHtml(formState.featuresText)}</textarea></div>

      <div class="form-field">
        <label>Preview Image</label>
        <div id="preview-image-area"></div>
      </div>
      <div class="form-field">
        <label>Screenshots</label>
        <div id="screenshots-area"></div>
      </div>
      <div class="form-field">
        <label>Promotional Video</label>
        <div id="promo-video-area"></div>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label>Admin Dashboard Type</label>
          <select id="f-dashboard-type" class="admin-select" style="width:100%;">
            <option value="hosted" ${formState.adminDashboardType === "hosted" ? "selected" : ""}>Hosted</option>
            <option value="installable" ${formState.adminDashboardType === "installable" ? "selected" : ""}>Installable</option>
          </select>
        </div>
        <div class="form-field" id="hosted-type-field">
          <label>Hosted Type</label>
          <select id="f-hosted-type" class="admin-select" style="width:100%;">
            <option value="static" ${formState.hostedType === "static" ? "selected" : ""}>Static</option>
            <option value="custom" ${formState.hostedType === "custom" ? "selected" : ""}>Custom Domain</option>
          </select>
        </div>
      </div>

      <label style="display:flex;gap:10px;align-items:center;margin:14px 0;">
        <input type="checkbox" id="f-active" style="width:auto;" ${formState.active ? "checked" : ""}> Published (visible on public site)
      </label>
      <label style="display:flex;gap:10px;align-items:center;margin-bottom:14px;">
        <input type="checkbox" id="f-featured" style="width:auto;" ${formState.featured ? "checked" : ""}> Featured on Home
      </label>

      <label style="display:flex;gap:10px;align-items:center;margin-bottom:10px;">
        <input type="checkbox" id="f-api-required" style="width:auto;" ${formState.apiRequired ? "checked" : ""}> API Setup Required
      </label>
      <div id="api-fields" style="display:${formState.apiRequired ? "block" : "none"};">
        <div class="form-row">
          <div class="form-field"><label>API Service(s) (comma separated)</label><input id="f-api-service" value="${escapeHtml(formState.apiService)}"></div>
          <div class="form-field"><label>API Setup Price (₦)</label><input id="f-api-price" type="number" min="0" value="${formState.apiSetupPrice}"></div>
        </div>
      </div>

      <label style="display:flex;gap:10px;align-items:center;margin-bottom:10px;">
        <input type="checkbox" id="f-setup-available" style="width:auto;" ${formState.setupAvailable ? "checked" : ""}> Template Setup Service Available
      </label>
      <div id="setup-fields" style="display:${formState.setupAvailable ? "block" : "none"};">
        <div class="form-row">
          <div class="form-field"><label>Setup Price (₦)</label><input id="f-setup-price" type="number" min="0" value="${formState.setupPrice}"></div>
          <div class="form-field"><label>Setup Documentation URL</label><input id="f-setup-doc" value="${escapeHtml(formState.setupDocumentation)}"></div>
        </div>
      </div>

      <h4 style="margin-top:10px;">Deliverable Files</h4>
      <p class="form-hint">These are the actual downloadable packages customers receive after payment is confirmed — separate from the preview images above.</p>
      <div class="form-field">
        <label>Website Files (ZIP)</label>
        <div id="website-file-area"></div>
      </div>
      <label style="display:flex;gap:10px;align-items:center;margin:14px 0 10px;">
        <input type="checkbox" id="f-dashboard-included" style="width:auto;" ${formState.adminDashboardIncluded ? "checked" : ""}> Admin Dashboard Included (as a downloadable file)
      </label>
      <div class="form-field" id="dashboard-file-field" style="display:${formState.adminDashboardIncluded ? "block" : "none"};">
        <label>Admin Dashboard Files (ZIP)</label>
        <div id="dashboard-file-area"></div>
        <p class="form-hint">Only needed if this template's admin dashboard is delivered as an installable package. If the dashboard type above is "Hosted," you usually don't need a file here — CBM manages hosting directly instead.</p>
      </div>
      <div class="form-field">
        <label>Setup Instructions (optional)</label>
        <div id="setup-file-area"></div>
      </div>

      <h4 style="margin-top:10px;">Packages</h4>
      <p class="form-hint">If none are added, the public site falls back to a single "Template Only" package using the base price above.</p>
      <div id="packages-area"></div>
      <button type="button" class="btn btn-outline btn-sm" id="add-package-btn" style="margin-top:8px;">+ Add Package</button>

      <button type="submit" class="btn btn-primary btn-block" style="margin-top:24px;">Save Template</button>
    </form>
  `, { wide: true });

  renderMediaAreas();
  renderPackagesArea();
  renderFileAreas();

  document.getElementById("f-name").addEventListener("input", (e) => {
    const slugField = document.getElementById("f-slug");
    if (!slugField.dataset.touched) slugField.value = slugify(e.target.value);
  });
  document.getElementById("f-slug").addEventListener("input", (e) => { e.target.dataset.touched = "1"; });

  document.getElementById("f-dashboard-type").addEventListener("change", (e) => {
    document.getElementById("hosted-type-field").style.display = e.target.value === "hosted" ? "block" : "none";
  });
  document.getElementById("f-api-required").addEventListener("change", (e) => {
    document.getElementById("api-fields").style.display = e.target.checked ? "block" : "none";
  });
  document.getElementById("f-setup-available").addEventListener("change", (e) => {
    document.getElementById("setup-fields").style.display = e.target.checked ? "block" : "none";
  });
  document.getElementById("f-dashboard-included").addEventListener("change", (e) => {
    document.getElementById("dashboard-file-field").style.display = e.target.checked ? "block" : "none";
  });
  document.getElementById("add-package-btn").addEventListener("click", () => {
    formState.packages.push({ id: "pkg-" + Date.now(), name: "New Package", price: 0, includes: [] });
    renderPackagesArea();
  });

  document.getElementById("template-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveTemplate(close);
  });
}

function renderMediaAreas() {
  document.getElementById("preview-image-area").innerHTML = mediaSlotHtml(formState.previewImage, "single");
  wireUpload("preview-image-area", "template", (url) => { formState.previewImage = url; renderMediaAreas(); }, () => { formState.previewImage = ""; renderMediaAreas(); });

  document.getElementById("screenshots-area").innerHTML = `
    <div class="thumb-strip">
      ${formState.screenshots.map((url, i) => `
        <div class="thumb"><img src="${escapeHtml(url)}"><button type="button" data-remove-shot="${i}">&times;</button></div>
      `).join("")}
      <div class="upload-mini" id="add-screenshot-btn" style="width:70px;height:70px;display:flex;align-items:center;justify-content:center;">+ Add</div>
    </div>
    <input type="file" id="screenshot-file-input" accept="image/*" style="display:none;">
  `;
  document.getElementById("add-screenshot-btn").addEventListener("click", () => document.getElementById("screenshot-file-input").click());
  document.getElementById("screenshot-file-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { url } = await uploadAdminMedia(file, "template");
      formState.screenshots.push(url);
      renderMediaAreas();
    } catch (err) {
      console.error(err);
      showToast("Screenshot upload failed.", "error");
    }
  });
  document.querySelectorAll("[data-remove-shot]").forEach(btn => {
    btn.addEventListener("click", () => {
      formState.screenshots.splice(Number(btn.dataset.removeShot), 1);
      renderMediaAreas();
    });
  });

  document.getElementById("promo-video-area").innerHTML = formState.promoVideo
    ? `<video src="${escapeHtml(formState.promoVideo)}" controls style="width:100%;border-radius:6px;margin-bottom:8px;"></video>
       <button type="button" class="btn btn-outline btn-sm" id="remove-video-btn">Remove Video</button>`
    : `<div class="upload-mini" id="add-video-btn">Click to upload a promotional video</div>`;
  const videoInputTrigger = document.getElementById("add-video-btn");
  if (videoInputTrigger) {
    videoInputTrigger.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file"; input.accept = "video/*";
      input.addEventListener("change", async () => {
        const file = input.files[0];
        if (!file) return;
        try {
          const { url } = await uploadAdminMedia(file, "template");
          formState.promoVideo = url;
          renderMediaAreas();
        } catch (err) {
          console.error(err);
          showToast("Video upload failed.", "error");
        }
      });
      input.click();
    });
  }
  const removeVideoBtn = document.getElementById("remove-video-btn");
  if (removeVideoBtn) removeVideoBtn.addEventListener("click", () => { formState.promoVideo = ""; renderMediaAreas(); });
}

function renderFileAreas() {
  document.getElementById("website-file-area").innerHTML = fileSlotHtml(formState.websiteFile, "Click to upload the website ZIP");
  wireFileSlot("website-file-area", "templateFile", (file) => { formState.websiteFile = file; renderFileAreas(); }, () => { formState.websiteFile = null; renderFileAreas(); });

  document.getElementById("dashboard-file-area").innerHTML = fileSlotHtml(formState.adminDashboardFile, "Click to upload the admin dashboard ZIP");
  wireFileSlot("dashboard-file-area", "templateFile", (file) => { formState.adminDashboardFile = file; renderFileAreas(); }, () => { formState.adminDashboardFile = null; renderFileAreas(); });

  document.getElementById("setup-file-area").innerHTML = fileSlotHtml(formState.setupInstructionsFile, "Click to upload setup instructions (PDF, etc.)");
  wireFileSlot("setup-file-area", "templateFile", (file) => { formState.setupInstructionsFile = file; renderFileAreas(); }, () => { formState.setupInstructionsFile = null; renderFileAreas(); });
}

function wireFileSlot(areaId, kind, onUploaded, onRemoved) {
  const area = document.getElementById(areaId);
  const uploadTrigger = area.querySelector("[data-file-upload]");
  if (uploadTrigger) {
    uploadTrigger.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.addEventListener("change", async () => {
        const file = input.files[0];
        if (!file) return;
        try {
          const uploaded = await uploadDeliverableFile(file, kind);
          onUploaded(uploaded);
        } catch (err) {
          console.error(err);
          showToast(err?.message || "File upload failed. Check your Cloudinary upload preset.", "error");
        }
      });
      input.click();
    });
  }
  const removeBtn = area.querySelector("[data-file-remove]");
  if (removeBtn) removeBtn.addEventListener("click", onRemoved);
}

function mediaSlotHtml(url) {
  if (!url) return `<div class="upload-mini" id="single-upload-btn">Click to upload an image</div><input type="file" id="single-upload-input" accept="image/*" style="display:none;">`;
  return `<div class="thumb" style="width:100px;height:100px;"><img src="${escapeHtml(url)}"><button type="button" id="single-remove-btn">&times;</button></div>`;
}

function wireUpload(areaId, kind, onUploaded, onRemoved) {
  const btn = document.getElementById("single-upload-btn");
  const input = document.getElementById("single-upload-input");
  if (btn && input) {
    btn.addEventListener("click", () => input.click());
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const { url } = await uploadAdminMedia(file, kind);
        onUploaded(url);
      } catch (err) {
        console.error(err);
        showToast("Upload failed.", "error");
      }
    });
  }
  const removeBtn = document.getElementById("single-remove-btn");
  if (removeBtn) removeBtn.addEventListener("click", onRemoved);
}

function renderPackagesArea() {
  const mount = document.getElementById("packages-area");
  mount.innerHTML = formState.packages.map((p, i) => `
    <div class="package-row">
      <div class="package-row-head">
        <input data-pkg-name="${i}" value="${escapeHtml(p.name)}" placeholder="Package name" style="flex:1;">
        <button type="button" class="btn btn-outline btn-sm" data-pkg-remove="${i}" style="border-color:#B23A3A;color:#B23A3A;">Remove</button>
      </div>
      <div class="form-row">
        <div class="form-field"><label>Price (₦)</label><input type="number" min="0" data-pkg-price="${i}" value="${p.price || 0}"></div>
        <div class="form-field"><label>Includes (one per line)</label><textarea rows="2" data-pkg-includes="${i}">${escapeHtml((p.includes || []).join("\n"))}</textarea></div>
      </div>
    </div>
  `).join("") || `<p class="form-hint">No packages added yet.</p>`;

  mount.querySelectorAll("[data-pkg-remove]").forEach(el => el.addEventListener("click", () => {
    formState.packages.splice(Number(el.dataset.pkgRemove), 1);
    renderPackagesArea();
  }));
  mount.querySelectorAll("[data-pkg-name]").forEach(el => el.addEventListener("input", () => {
    formState.packages[Number(el.dataset.pkgName)].name = el.value;
  }));
  mount.querySelectorAll("[data-pkg-price]").forEach(el => el.addEventListener("input", () => {
    formState.packages[Number(el.dataset.pkgPrice)].price = Number(el.value) || 0;
  }));
  mount.querySelectorAll("[data-pkg-includes]").forEach(el => el.addEventListener("input", () => {
    formState.packages[Number(el.dataset.pkgIncludes)].includes = el.value.split("\n").map(s => s.trim()).filter(Boolean);
  }));
}

async function saveTemplate(close) {
  const data = {
    active: document.getElementById("f-active").checked,
    featured: document.getElementById("f-featured").checked,
    category: document.getElementById("f-category").value,
    name: document.getElementById("f-name").value.trim(),
    slug: document.getElementById("f-slug").value.trim() || slugify(document.getElementById("f-name").value),
    description: document.getElementById("f-description").value.trim(),
    price: Number(document.getElementById("f-price").value) || 0,
    technologies: document.getElementById("f-tech").value.split(",").map(s => s.trim()).filter(Boolean),
    features: document.getElementById("f-features").value.split("\n").map(s => s.trim()).filter(Boolean),
    previewImage: formState.previewImage,
    screenshots: formState.screenshots,
    promoVideo: formState.promoVideo,
    livePreview: document.getElementById("f-livepreview").value.trim(),
    adminDashboardType: document.getElementById("f-dashboard-type").value,
    hostedType: document.getElementById("f-hosted-type").value,
    apiRequired: document.getElementById("f-api-required").checked,
    apiService: document.getElementById("f-api-service").value.split(",").map(s => s.trim()).filter(Boolean),
    apiSetupPrice: Number(document.getElementById("f-api-price").value) || 0,
    setupAvailable: document.getElementById("f-setup-available").checked,
    setupPrice: Number(document.getElementById("f-setup-price").value) || 0,
    setupDocumentation: document.getElementById("f-setup-doc").value.trim(),
    packages: formState.packages,
    adminDashboardIncluded: document.getElementById("f-dashboard-included").checked,
    websiteFile: formState.websiteFile,
    adminDashboardFile: document.getElementById("f-dashboard-included").checked ? formState.adminDashboardFile : null,
    setupInstructionsFile: formState.setupInstructionsFile,
    updatedAt: serverTimestamp(),
  };

  try {
    if (formState.id) {
      await updateDoc(doc(db, "templates", formState.id), data);
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "templates"), data);
    }
    showToast("Template saved.", "success");
    close();
    await loadTemplates();
    renderTable();
  } catch (err) {
    console.error(err);
    showToast("Couldn't save the template. Check your connection and try again.", "error");
  }
}
