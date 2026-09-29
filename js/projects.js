import {
  db, collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp,
} from "./admin-firebase.js";
import { uploadAdminMedia, uploadAdminFile } from "./admin-cloudinary.js";
import { escapeHtml, statusPill, openModal, confirmDialog, showToast, fileSlotHtml } from "./common.js";

let allProjects = [];
let formState = null;

export async function render(root) {
  root.innerHTML = `
    <div class="admin-panel">
      <div class="panel-head">
        <h3 style="margin:0;">Projects</h3>
        <button class="btn btn-primary btn-sm" id="add-project-btn">+ Add Project</button>
      </div>
      <div class="table-scroll" id="projects-table"><div class="skeleton" style="height:260px;"></div></div>
    </div>
  `;
  document.getElementById("add-project-btn").addEventListener("click", () => openProjectForm(null));
  await loadProjects();
  renderTable();
}

async function loadProjects() {
  const snap = await getDocs(query(collection(db, "projects"), orderBy("createdAt", "desc")));
  allProjects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderTable() {
  const mount = document.getElementById("projects-table");
  if (!allProjects.length) {
    mount.innerHTML = `<div class="state-block"><h3>No projects yet</h3><p>Add work Code by Me has completed.</p></div>`;
    return;
  }
  mount.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Featured</th><th></th></tr></thead>
      <tbody>
        ${allProjects.map(p => `
          <tr>
            <td><span class="row-link" data-edit="${escapeHtml(p.id)}">${escapeHtml(p.title || "Untitled")}</span></td>
            <td>${escapeHtml(p.category || "—")}</td>
            <td>${statusPill(p.status || "—")}</td>
            <td>${p.featured ? "★" : "—"}</td>
            <td><button class="btn btn-outline btn-sm" data-delete="${escapeHtml(p.id)}" style="border-color:#B23A3A;color:#B23A3A;">Delete</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  mount.querySelectorAll("[data-edit]").forEach(el => el.addEventListener("click", () => openProjectForm(el.dataset.edit)));
  mount.querySelectorAll("[data-delete]").forEach(el => el.addEventListener("click", () => deleteProject(el.dataset.delete)));
}

async function deleteProject(id) {
  const ok = await confirmDialog("This permanently deletes the project record from the public Projects page.", "Delete Project");
  if (!ok) return;
  await deleteDoc(doc(db, "projects", id));
  allProjects = allProjects.filter(x => x.id !== id);
  renderTable();
  showToast("Project deleted.", "success");
}

function defaultState() {
  return {
    id: null, title: "", description: "", category: "", technologies: "", thumbnail: "", screenshots: [],
    video: "", liveDemo: "", github: "", status: "Live", featured: false,
    projectType: "website", websiteFile: null, adminDashboardFile: null, setupInstructionsFile: null,
  };
}
function toState(p) {
  return {
    id: p.id, title: p.title || "", description: p.description || "", category: p.category || "",
    technologies: (p.technologies || []).join(", "), thumbnail: p.thumbnail || "", screenshots: p.screenshots || [],
    video: p.video || "", liveDemo: p.liveDemo || "", github: p.github || "", status: p.status || "Live", featured: !!p.featured,
    projectType: p.projectType || "website", websiteFile: p.websiteFile || null,
    adminDashboardFile: p.adminDashboardFile || null, setupInstructionsFile: p.setupInstructionsFile || null,
  };
}

function openProjectForm(id) {
  const existing = id ? allProjects.find(p => p.id === id) : null;
  formState = existing ? toState(existing) : defaultState();

  const { close } = openModal(`
    <h3>${formState.id ? "Edit Project" : "Add Project"}</h3>
    <form id="project-form" class="admin-form">
      <div class="form-field"><label>Title</label><input id="p-title" value="${escapeHtml(formState.title)}" required></div>
      <div class="form-field"><label>Description</label><textarea id="p-description" rows="3">${escapeHtml(formState.description)}</textarea></div>
      <div class="form-row">
        <div class="form-field"><label>Category</label><input id="p-category" value="${escapeHtml(formState.category)}"></div>
        <div class="form-field"><label>Status</label>
          <select id="p-status" class="admin-select" style="width:100%;">
            ${["Live", "In Progress", "Archived"].map(s => `<option value="${s}" ${formState.status === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="form-field"><label>Technologies (comma separated)</label><input id="p-tech" value="${escapeHtml(formState.technologies)}"></div>
      <div class="form-row">
        <div class="form-field"><label>Live Demo URL</label><input id="p-livedemo" value="${escapeHtml(formState.liveDemo)}"></div>
        <div class="form-field"><label>GitHub URL</label><input id="p-github" value="${escapeHtml(formState.github)}"></div>
      </div>

      <div class="form-field"><label>Thumbnail</label><div id="thumb-area"></div></div>
      <div class="form-field"><label>Screenshots</label><div id="shots-area"></div></div>
      <div class="form-field"><label>Video</label><div id="video-area"></div></div>

      <h4 style="margin-top:10px;">Deliverable Files</h4>
      <p class="form-hint">For handing this project's files directly to a client — separate from the images above. These aren't tied to a public purchase flow (Projects aren't sold through the marketplace), so use the Download buttons here to send links yourself.</p>
      <div class="form-field">
        <label>Project Type</label>
        <select id="p-type" class="admin-select" style="width:100%;">
          <option value="website" ${formState.projectType === "website" ? "selected" : ""}>Website Only</option>
          <option value="website_dashboard" ${formState.projectType === "website_dashboard" ? "selected" : ""}>Website + Admin Dashboard</option>
          <option value="dashboard" ${formState.projectType === "dashboard" ? "selected" : ""}>Admin Dashboard Only</option>
        </select>
      </div>
      <div class="form-field" id="website-file-field">
        <label>Website Files (ZIP)</label>
        <div id="website-file-area"></div>
      </div>
      <div class="form-field" id="dashboard-file-field">
        <label>Admin Dashboard Files (ZIP)</label>
        <div id="dashboard-file-area"></div>
      </div>
      <div class="form-field">
        <label>Setup Instructions (optional)</label>
        <div id="setup-file-area"></div>
      </div>

      <label style="display:flex;gap:10px;align-items:center;margin-bottom:14px;">
        <input type="checkbox" id="p-featured" style="width:auto;" ${formState.featured ? "checked" : ""}> Featured on Home
      </label>

      <button type="submit" class="btn btn-primary btn-block">Save Project</button>
    </form>
  `, { wide: true });

  renderMedia();
  renderFileFields();

  document.getElementById("p-type").addEventListener("change", renderFileFields);

  document.getElementById("project-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveProject(close);
  });
}

function renderFileFields() {
  const type = document.getElementById("p-type").value;
  document.getElementById("website-file-field").style.display = type === "dashboard" ? "none" : "block";
  document.getElementById("dashboard-file-field").style.display = type === "website" ? "none" : "block";

  document.getElementById("website-file-area").innerHTML = fileSlotHtml(formState.websiteFile, "Click to upload the website ZIP");
  wireFileSlot("website-file-area", (file) => { formState.websiteFile = file; renderFileFields(); }, () => { formState.websiteFile = null; renderFileFields(); });

  document.getElementById("dashboard-file-area").innerHTML = fileSlotHtml(formState.adminDashboardFile, "Click to upload the admin dashboard ZIP");
  wireFileSlot("dashboard-file-area", (file) => { formState.adminDashboardFile = file; renderFileFields(); }, () => { formState.adminDashboardFile = null; renderFileFields(); });

  document.getElementById("setup-file-area").innerHTML = fileSlotHtml(formState.setupInstructionsFile, "Click to upload setup instructions");
  wireFileSlot("setup-file-area", (file) => { formState.setupInstructionsFile = file; renderFileFields(); }, () => { formState.setupInstructionsFile = null; renderFileFields(); });
}

function wireFileSlot(areaId, onUploaded, onRemoved) {
  const area = document.getElementById(areaId);
  const uploadTrigger = area.querySelector("[data-file-upload]");
  if (uploadTrigger) {
    uploadTrigger.addEventListener("click", () => pickFile("", async (file) => {
      const uploaded = await uploadAdminFile(file, "projectFile");
      onUploaded(uploaded);
    }));
  }
  const removeBtn = area.querySelector("[data-file-remove]");
  if (removeBtn) removeBtn.addEventListener("click", onRemoved);
}

function renderMedia() {
  document.getElementById("thumb-area").innerHTML = formState.thumbnail
    ? `<div class="thumb" style="width:100px;height:100px;"><img src="${escapeHtml(formState.thumbnail)}"><button type="button" id="thumb-remove">&times;</button></div>`
    : `<div class="upload-mini" id="thumb-upload">Click to upload a thumbnail</div>`;
  const thumbUpload = document.getElementById("thumb-upload");
  if (thumbUpload) thumbUpload.addEventListener("click", () => pickFile("image/*", async (file) => {
    const { url } = await uploadAdminMedia(file, "project");
    formState.thumbnail = url; renderMedia();
  }));
  const thumbRemove = document.getElementById("thumb-remove");
  if (thumbRemove) thumbRemove.addEventListener("click", () => { formState.thumbnail = ""; renderMedia(); });

  document.getElementById("shots-area").innerHTML = `
    <div class="thumb-strip">
      ${formState.screenshots.map((url, i) => `<div class="thumb"><img src="${escapeHtml(url)}"><button type="button" data-shot-remove="${i}">&times;</button></div>`).join("")}
      <div class="upload-mini" id="shot-add" style="width:70px;height:70px;display:flex;align-items:center;justify-content:center;">+ Add</div>
    </div>
  `;
  document.getElementById("shot-add").addEventListener("click", () => pickFile("image/*", async (file) => {
    const { url } = await uploadAdminMedia(file, "project");
    formState.screenshots.push(url); renderMedia();
  }));
  document.querySelectorAll("[data-shot-remove]").forEach(btn => btn.addEventListener("click", () => {
    formState.screenshots.splice(Number(btn.dataset.shotRemove), 1); renderMedia();
  }));

  document.getElementById("video-area").innerHTML = formState.video
    ? `<video src="${escapeHtml(formState.video)}" controls style="width:100%;border-radius:6px;margin-bottom:8px;"></video><button type="button" class="btn btn-outline btn-sm" id="video-remove">Remove Video</button>`
    : `<div class="upload-mini" id="video-upload">Click to upload a project video</div>`;
  const videoUpload = document.getElementById("video-upload");
  if (videoUpload) videoUpload.addEventListener("click", () => pickFile("video/*", async (file) => {
    const { url } = await uploadAdminMedia(file, "project");
    formState.video = url; renderMedia();
  }));
  const videoRemove = document.getElementById("video-remove");
  if (videoRemove) videoRemove.addEventListener("click", () => { formState.video = ""; renderMedia(); });
}

function pickFile(accept, onFile) {
  const input = document.createElement("input");
  input.type = "file"; input.accept = accept;
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      await onFile(file);
    } catch (err) {
      console.error(err);
      showToast("Upload failed.", "error");
    }
  });
  input.click();
}

async function saveProject(close) {
  const data = {
    title: document.getElementById("p-title").value.trim(),
    description: document.getElementById("p-description").value.trim(),
    category: document.getElementById("p-category").value.trim(),
    status: document.getElementById("p-status").value,
    technologies: document.getElementById("p-tech").value.split(",").map(s => s.trim()).filter(Boolean),
    liveDemo: document.getElementById("p-livedemo").value.trim(),
    github: document.getElementById("p-github").value.trim(),
    thumbnail: formState.thumbnail,
    screenshots: formState.screenshots,
    video: formState.video,
    featured: document.getElementById("p-featured").checked,
    projectType: document.getElementById("p-type").value,
    websiteFile: document.getElementById("p-type").value === "dashboard" ? null : formState.websiteFile,
    adminDashboardFile: document.getElementById("p-type").value === "website" ? null : formState.adminDashboardFile,
    setupInstructionsFile: formState.setupInstructionsFile,
    updatedAt: serverTimestamp(),
  };
  try {
    if (formState.id) {
      await updateDoc(doc(db, "projects", formState.id), data);
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "projects"), data);
    }
    showToast("Project saved.", "success");
    close();
    await loadProjects();
    renderTable();
  } catch (err) {
    console.error(err);
    showToast("Couldn't save the project. Check your connection and try again.", "error");
  }
}
