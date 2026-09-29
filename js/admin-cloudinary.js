// =====================================================================
// ADMIN-CLOUDINARY.JS
// Cloudinary configuration for the CBM Owner/Admin Dashboard.
//
// Admin uploads use separate Cloudinary presets/folders from customer
// payment screenshots.
//
// REQUIRED UNSIGNED UPLOAD PRESETS:
//
//   cbm_template_media
//   Folder: cbm/templates
//
//   cbm_project_media
//   Folder: cbm/projects
//
//   cbm_promotional_media
//   Folder: cbm/promotional-media
//
// Cloudinary account:
//   Cloud name: qkhyms14
// =====================================================================

export const CLOUDINARY_CLOUD_NAME = "qkhyms14";


// =====================================================================
// ADMIN UPLOAD PRESETS
// =====================================================================

export const ADMIN_PRESETS = {
  template: {
    preset: "cbm_template_media",
    folder: "cbm/templates",
  },

  project: {
    preset: "cbm_project_media",
    folder: "cbm/projects",
  },

  promo: {
    preset: "cbm_promotional_media",
    folder: "cbm/promotional-media",
  },
};


// =====================================================================
// UPLOAD ADMIN MEDIA
//
// Supports:
// - Images
// - Videos
//
// kind can be:
// - "template"
// - "project"
// - "promo"
// =====================================================================

export async function uploadAdminMedia(file, kind = "template") {
  if (!file) {
    throw new Error("No file selected.");
  }

  const cfg = ADMIN_PRESETS[kind];

  if (!cfg) {
    throw new Error(`Unknown Cloudinary upload type: ${kind}`);
  }

  const isVideo = file.type && file.type.startsWith("video/");

  const resourceType = isVideo ? "video" : "image";

  const url =
    `https://api.cloudinary.com/v1_1/` +
    `${CLOUDINARY_CLOUD_NAME}/` +
    `${resourceType}/upload`;

  const formData = new FormData();

  formData.append("file", file);
  formData.append("upload_preset", cfg.preset);
  formData.append("folder", cfg.folder);

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      "Cloudinary upload failed: " + errorText
    );
  }

  const data = await response.json();

  return {
    url: data.secure_url,
    publicId: data.public_id,
    resourceType: data.resource_type,
    width: data.width || null,
    height: data.height || null,
    bytes: data.bytes || null,
    format: data.format || null,
    originalFilename: file.name,
  };
}


// =====================================================================
// COMPATIBILITY EXPORT
//
// projects.js currently imports:
//
//   uploadAdminFile
//
// Keep this export so projects.js does not throw:
//
//   The requested module './admin-cloudinary.js'
//   does not provide an export named 'uploadAdminFile'
//
// It uses the same image/video uploader above.
// =====================================================================

export const uploadAdminFile = uploadAdminMedia;