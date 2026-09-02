# سجل التغييرات — جرد أصول البنية التحتية (ICTD Infrastructure Inventory)
# Changelog

All versions are listed newest first. Each release folder is named `vX.Y` and contains the HTML file (same version in the filename) and this changelog.

---

## v1.4 — 2026-09-02
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
