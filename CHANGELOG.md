# سجل التغييرات — جرد أصول البنية التحتية (ICTD Infrastructure Inventory)
# Changelog

All versions are listed newest first. Each release folder is named `vX.Y` and contains the HTML file (same version in the filename) and this changelog.

---

## v2.7 — 2026-09-02
**Base:** v2.6. `Code.gs` base updated to the v2.2 backend (latest with AddedBy + PhotoUrl) since this version needed a `TYPES` change. Not yet approved — test before adopting.

### Changed
- Device type label **"طابعة"** renamed to **"طابعة مركزية"** (same underlying type key `Printer`, so any existing printer devices keep their data — this is a label-only change).

### Added — device types
| النوع | الحقول | البادئة |
|---|---|---|
| طابعة مكتبية (DesktopPrinter) | موديل الحبر/التونر | DP |
| Polycom VC | عنوان IP، اسم/رقم القاعة | PVC |
| Smart Projector | عنوان IP، اسم/رقم القاعة | SPJ |
| Projector | اسم/رقم القاعة | PJ |

`Code.gs`: the four new type keys added to `TYPES` so their sheet tabs are created automatically on first use.

### ⚠️ Deployment note
Since this `Code.gs` is based on the v2.2 backend (photo upload + AddedBy), deploying it also brings in those features if you had stayed on an earlier backend. If you are not yet ready for the photo-upload feature, tell me and I will prepare this same type change against your currently-deployed `Code.gs` version instead.

---

## v2.6 — 2026-09-02
**Base:** v2.4 (v2.5 disregarded per instruction — this version replaces it with the exact requested layout). Not yet approved — test before adopting.

### Changed — dashboard layout, per exact specification
- **Rows 1–2:** إجمالي الأجهزة (in visibly bolder/larger text than the other numbers — 34px/weight 900 vs 26px/weight 800), then أجهزة نشطة، في المخزن، تحت الصيانة، خارج الخدمة، then ضمان ساري، ضمان منتهي.
- **Divider line.**
- **Type section:** every device type's name and count (zero-filled for types with no devices).
- **Divider line** after the type section, before the data-entry form.

---

## v2.4 — 2026-09-02
**Base:** v2.3. Not yet approved — test before adopting.

### Fixed — dashboard only showed 3 device types
- The top dashboard cards previously showed only the **3 highest-count** device types, so a newly added type with few devices (e.g. "شاشة قاعه Huawei" with 1 device) could be pushed out and appear missing even though the device was saved correctly.
- The dashboard now shows a card for **every device type defined in the system**, in a fixed order — including types with **zero** devices, which display "0" instead of being omitted — so the full picture is always visible at a glance.

---

## v2.3 — 2026-09-02
**Base:** v2.2. Not yet approved — test before adopting.

### Fixed — photo not visible when reopening/editing a device
- The URL format saved in v2.2 (`drive.google.com/uc?export=view&id=...`) does not reliably render inside an `<img>` tag due to how Drive handles that link when hotlinked. Switched to Drive's thumbnail endpoint (`drive.google.com/thumbnail?id=...&sz=w1000`), which is the reliable format for inline image display.
- ⚠️ This only fixes photos saved **from now on**. Any device saved under v2.2 has the old (broken-preview) link stored in its `PhotoUrl` cell — re-save that device (open it with تعديل, the image file input can be left empty, click حفظ) to refresh its link to the new working format, or edit the cell directly in the sheet by replacing `uc?export=view&id=` with `thumbnail?id=` and appending `&sz=w1000`.

### Added — clearer photo preview when editing
- The preview shown when clicking تعديل is larger (up to 160px tall) and includes a **"فتح الصورة بالحجم الكامل"** link to open the original photo in a new tab.

---

## v2.2 — 2026-09-02
**Base:** v2.1. Not yet approved — test before adopting.

### Added — device photo upload to Google Drive
- New **"صورة الجهاز"** field in the add/edit form: choose an image file, it's resized client-side (max width 1280px, JPEG quality ~0.82) before upload to keep requests fast and small, with a live preview and an **"إزالة الصورة"** button.
- On Save, the image is uploaded to a folder named **"SRU Infrastructure Inventory - Photos"** in the Google Drive of the account the Apps Script is deployed under (created automatically on first upload if it doesn't exist yet — this is "your own Drive" as requested, since deployments currently run as **Execute as: Me**).
- The photo's shareable view link is stored as a new **PhotoUrl** column and shown as a small clickable thumbnail in the device table; also included as a link column in Excel exports.
- Editing a device keeps its existing photo unless you choose a new file; "إزالة الصورة" clears the link on the device record (the file itself stays in Drive — it is not deleted).
- If the Drive upload fails for any reason (e.g. Drive permission not yet authorized), the device still saves normally with its previous photo link untouched — a photo failure never blocks saving the record.

### `Code.gs`
- `HEADERS` gains `PhotoUrl` appended at the very end (after `AddedBy`) — position-safe, same pattern as `AddedBy` in v1.9, so existing sheets are never shifted; missing columns are auto-added on first use.
- New `savePhotoIfProvided()` and `getOrCreatePhotosFolder()` functions handle the Drive upload and folder creation.

### ⚠️ First-run authorization
The first time a photo is saved after deploying this version, Google will prompt to authorize an additional Drive scope for the script (uploading files). Approve it once; it will not ask again.

---

## v2.1 — 2026-09-02
**Base:** v1.9 (this branch does NOT include the v2.0 domain-restriction/access-control changes — that work remains separate and will be applied later, per your instruction). Not yet approved — test before adopting.

### Added — device types
- **Cisco Phone** (`CiscoPhone`) — spec fields: عنوان IP، رقم التحويلة. Prefix: `CP`.
- **Wireless Cisco Phone** (`WirelessCiscoPhone`) — same spec fields. Prefix: `WCP`.

### Changed — شاشة قاعة split into two brand-specific types
- The single "شاشة قاعة" (HallScreen) type from v1.8 is replaced by two distinct types:
  - **شاشة قاعه Huawei** (`HallScreenHuawei`) — prefix `HH`.
  - **شاشة قاعة Benq** (`HallScreenBenq`) — prefix `HB`.
  - Both keep the same spec fields: حجم الشاشة، اسم/رقم القاعة.
- `Code.gs`: `TYPES` updated — `HallScreen` removed, the four new type keys added, so their sheet tabs are created automatically on first use.

### ⚠️ Migration note
If any devices were already saved under the old **HallScreen** sheet tab (from testing v1.8), they will no longer appear under either new type — the app has no way to know which brand each one was. Before deploying this `Code.gs`, manually move those rows into the `HallScreenHuawei` or `HallScreenBenq` tab (create the tab first by adding one device of that type from the page, or add the tab manually with the same header row) according to the actual screen brand.

---

## v1.9 — 2026-09-02
**Base:** v1.8. Not yet approved — test before adopting.

### Added — "تمت الإضافة بواسطة"
- New dropdown field in the form: **تمت الإضافة بواسطة**, listing:
  Dr. Nasser Abounar, Mohamed ElMahdy, Mohamed Nawaz, Mohamed Omar, Mohamed Saleh,
  Ammar Alrowedan, Nayed Alrashidi, Abd Alazez Alawaji, Azzam Alaqeel, Asma Alolayan,
  Shath Albusyli, Inshrah Almutairi, عاطف النادي, سراج.
- Shown as a new column in the table, included in Excel exports, and preserved when editing a device.
- `Code.gs`: new `AddedBy` column appended **after `UpdatedAt`, at the very end** of `HEADERS` — deliberately placed last, not inserted in the middle, so existing rows in already-deployed sheets are never shifted (the same misalignment bug fixed in v1.5/v1.6 era). For sheets created before this version, the header label is added automatically to the next empty column on first use; existing data is untouched.

### Deployment
1. Sheet → Extensions → Apps Script → replace `Code.gs` with this version → Save.
2. Deploy → Manage deployments → Edit → Version: **New version** → Deploy (URL unchanged).
3. Reload the page.

---

## v1.8 — 2026-09-02
**Base:** v1.7. Not yet approved — test before adopting.

### Added — device types
- **شاشة قاعة** (HallScreen) — spec fields: حجم الشاشة، اسم/رقم القاعة.
- **لواقط شبكة** (NetworkReceivers) — spec fields: عنوان IP، اسم الشبكة SSID.
- **جدار حماية** (Firewall) — spec fields: عنوان IP، عدد المنافذ.
- **شاشات كبرى** (LargeScreens) — spec fields: حجم الشاشة، الدقة.
- Asset-tag prefixes added for all four: HS, AP, FW, LS.
- `Code.gs`: the four new types added to `TYPES` so their sheet tabs are created automatically on first use.

### Changed
- **ملحقات (Accessories):** the extra field is now explicitly **"اسم الملحق"** — a free-text box that opens for this type to name the specific item.
- **أخرى (Other):** the first extra field is now explicitly **"اسم النوع (أخرى)"** — a free-text box to name what the "other" type actually is; second field is a generic "مواصفة إضافية".

---

## v1.7 — 2026-09-02
**Base:** v1.6. Not yet approved — test before adopting.

### Changed
- Device-type label corrected to the exact requested text: **"مايكروسوفت سيرفس"** (was "خدمة مايكروسوفت").

### Added — automatic asset tag
- **رقم الأصل / الملصق is now generated automatically** the moment a device type is selected, and again whenever the type is changed. The field is read-only to prevent accidental manual edits; a **↻ توليد** button lets you force a fresh number if needed.
- Generation logic: for the chosen type's prefix (PC, LT, SR, PR, SW, UPS, SC, AC, SRV, MS, OT), it scans the currently loaded devices of that type, finds the highest existing number, and returns `PREFIX-NEXT` — continuing the same numbering already in the sheet (e.g. existing `SR-20031` → next `SR-20032`) rather than restarting from 1.
- A safety check still generates a tag on Save if the field is somehow empty (e.g. type chosen before the sheet finished loading).
- Editing an existing device keeps its original tag unchanged — auto-generation only applies to new devices.

### Unchanged
- `Code.gs` — no backend change in this version.

---

## v1.6 — 2026-09-02
**Base:** v1.4 (approved). Not yet approved — test before adopting.

### Added
- New device type **"خدمة مايكروسوفت" (MicrosoftService)** in the type filter and the add/edit form, with two dedicated spec fields: نوع الترخيص، تاريخ الانتهاء.
- `Code.gs`: `MicrosoftService` added to the `TYPES` list so a matching sheet tab is created automatically on first use. Backend logic is otherwise unchanged from the version currently deployed (column-position based, matching v1.4's live backend) — this is NOT the header-name-based v1.5 backend.

### Deployment
1. Sheet → Extensions → Apps Script → replace `Code.gs` with this version → Save.
2. Deploy → Manage deployments → Edit → Version: **New version** → Deploy (URL unchanged).
3. Reload the page; "خدمة مايكروسوفت" appears in النوع dropdowns.

---

## v1.4 — 2026-09-02  ✅ APPROVED
**⭐ الإصدار المعتمد حاليًا (Approved / Current Production Version).** لا تُستبدل هذه النسخة إلا بعد اختبار الإصدار التالي والتأكد من عمله على بيانات حقيقية.

**Source:** v1.3

### Fixed
- **Columns not matching (العواميد غير مطابقة):** the sheet has no `supplier` column after `serial`, so the backend shifted every value one column to the right (specs appeared under المورد, user under الموقع, status under المستخدم, date under الحالة). The page now detects this pattern per record and realigns it automatically; the sync status shows how many records were corrected.
- **Filters not working:** a direct consequence of the shift — `status` contained a date and `warranty` was empty, so the status/warranty filters never matched. Fixed by the realignment above.
- Dates from the sheet (`2024-01-05T21:00:00.000Z`) are now shown as `2024-01-06` (local calendar date).

### Added — automation
- **Single-source version number:** `APP_VERSION` in the script drives the top-bar badge, the browser title and the Excel export filename. Change it in one place only.
- **`release.py`:** reads `APP_VERSION` from the HTML, creates the `vX.Y/` folder with the versioned file, prepends the changelog entry, and produces the zip. Usage: `python release.py sru_infrastructure_inventory.html "ملخص التغيير 1; ملخص التغيير 2"`.

### Recommended permanent fix (backend)
- Insert a `supplier` column after `serial` in every device sheet (or update `Code.gs` to map values by header name instead of position). Once done, records will no longer need realignment and edits will save into the correct columns.

---

## v1.3 — 2026-09-02
**Source:** `sru_infrastructure_inventory_fixed.html`

### Fixed
- **Filter not working:** the "تصفية حسب النوع" dropdown was built only from the hardcoded type list, so any type defined in the Google Sheet `Config` tab (or added directly in the sheet) was missing and could not be filtered. The dropdown is now built from the backend config **plus** every type actually present in the data.
- **Status / warranty filters** now tolerate stray spaces or case differences coming from the sheet.
- **Wrong data under columns (المواصفات):** the page expected spec keys such as `ip`/`ram`, while the backend stores `x1`/`x2` with labels from the `Config` tab. The specs column was therefore empty or showed the wrong values. The page now reads `config` from the backend, maps `x1`/`x2` to their labels, and still shows older records whose keys don't match.
- `specs` arriving as a JSON string from the sheet is now parsed safely.
- Search now also covers supplier and specifications.

### Added
- Version badge in the top bar (`APP_VERSION` constant in the script).
- Device-type select in the form is populated from the backend config, so new types added in the sheet appear without editing the HTML.
- Export dropdown and per-type export refresh automatically after data load.

### Unchanged
- Apps Script Web App URL remains embedded (no link prompt).

---

## v1.2 — 2026-09-02
**Source:** `sru_infrastructure_inventory (5).html`
- Embedded the Apps Script Web App URL (`SHEET_URL`) and hid the link banner permanently.
- Added version badge.

## v1.1 — 2026-09-02
**Source:** `sru_infrastructure_inventory (6).html` → v1.0
- Embedded the Apps Script Web App URL (`SHEET_URL`).

## v1.0 — 2026-09-02
**Source:** `sru_infrastructure_inventory (6).html`
- Introduced `SHEET_URL` constant (empty placeholder) with `localStorage` fallback.
- Added version badge and versioned filename.
