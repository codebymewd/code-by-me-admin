# CBM Owner Dashboard — Standalone Package

This is the Owner Dashboard **only**, split out so it can be deployed on its
own (its own Netlify site, its own URL) with no dependency on the public
Code by Me website's files. It still manages the exact same Firebase
project and Firestore data as the public site — it's a separate
deployment, not a separate backend.

## What changed from the combined version

- `css/style.css` is now a local copy in this folder (was `../css/style.css`).
- `js/firebase-config.js` and `js/shared.js` are local standalone copies
  (were imported from the public site's `js/` folder).
- Every internal import now uses `./` — nothing in this package reaches
  outside its own folder.
- `firestore.rules` is included here for reference/redeploying, but rules
  are project-level: publishing them from here or from the public site's
  copy has the identical effect, since both point at the same Firebase
  project (`codebyme-2d414`).

## Deploying this on its own (Netlify example)

1. Drag this whole folder onto Netlify's "Deploy manually" box (app.netlify.com).
2. Netlify gives you a URL like `https://your-admin-site.netlify.app`.
3. Firebase Console → Authentication → Settings → Authorized domains → Add
   that Netlify domain (exact hostname, no `https://`).
4. Visit `https://your-admin-site.netlify.app/login.html` — that's now your
   dashboard's home page, not a sub-path of anything.

## First-time owner setup (same as before, only needs doing once)

1. Firebase Console → Authentication → Sign-in method → enable Email/Password.
2. Authentication → Users → Add user → your login email + password.
3. Copy that user's UID.
4. Firestore → start collection `admins` → document ID = that exact UID →
   any field, e.g. `role: "owner"`.
5. Firestore → Rules tab → paste in `firestore.rules` from this folder →
   Publish.

Once that's done, sign in at `login.html`. If you get "not authorized as a
CBM owner," it's almost always the UID in step 4 not matching exactly, or
the rules in step 5 not published yet.

## Cloudinary presets this dashboard expects (unsigned, in your Cloudinary account)

- `cbm_template_media` → folder `cbm/templates`
- `cbm_project_media` → folder `cbm/projects`
- `cbm_promotional_media` → folder `cbm/promotional-media`

These are separate from the public site's `cbm_payment_screenshots` preset
on purpose — admin uploads never share a preset with customer payment
screenshots.

---

# Update — Downloadable Files (Templates & Projects)

**Templates** (Templates tab → edit → "Deliverable Files" section):
- Website Files (ZIP) — the main deliverable
- "Admin Dashboard Included" toggle → reveals an Admin Dashboard Files (ZIP) slot. This is independent of the existing "Admin Dashboard Type" (Hosted/Installable) field above it — toggle this on when the dashboard is actually handed over as a downloadable package (typically for Installable-type templates); leave it off for Hosted dashboards, where you manage hosting directly instead of shipping a file.
- Setup Instructions (optional)

**Projects** (Projects tab → edit → "Deliverable Files" section):
- Project Type: Website Only / Website + Admin Dashboard / Admin Dashboard Only — only the relevant file fields show
- Projects have no public purchase flow, so these files are for you to hand to a client directly (grab the Download link from the file slot and send it yourself) — there's no customer-facing gating here.

**Orders** (Orders tab → click an Order ID → "Purchased Files"): shows the linked template's Website/Admin Dashboard/Setup Instructions files, so you can see at a glance what the customer is entitled to, and whether they'd currently see those links on Check Order (only once you've hit Confirm Payment).

## New Cloudinary presets required (unsigned)

- `cbm_template_files` → folder `cbm/template-files`
- `cbm_project_files` → folder `cbm/project-files`

For both deliverable presets: set **Signing mode = Unsigned** and make sure the preset allows the file types you intend to upload (ZIP/PDF/etc.). The dashboard uses Cloudinary's `auto/upload` endpoint for these non-media deliverables and stores the returned `secure_url` directly; do not replace it with `https://res.cloudinary.com` manually.

Add these the same way you added `cbm_template_media` etc. — Settings → Upload → Upload presets → Unsigned. Until these exist, uploads in the new "Deliverable Files" sections will fail with a Cloudinary error.

## Where the actual customer download happens

Not in this dashboard — customers get their download links from the **public site's Check Order page**, which only reveals them once you've confirmed payment on the order. This dashboard's "Purchased Files" panel is for your own visibility, not the delivery mechanism itself.
