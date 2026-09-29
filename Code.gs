/**
 * SRU Infrastructure Inventory - Google Sheets backend (v3.0)
 * ------------------------------------------------------------
 * SETUP:
 * 1. Open (or create) the Google Sheet you want to use as the database.
 * 2. Extensions > Apps Script.
 * 3. Delete any starter code, paste this whole file in, and save.
 * 4. Deploy > New deployment > Select type: Web app.
 *      - Description: v3.0
 *      - Execute as: Me
 *      - Who has access: Anyone (or "Anyone within [domain]" once access
 *        restriction is enabled)
 * 5. Click Deploy, authorize the permissions when prompted.
 * 6. Copy the "Web app URL" - it must match the sheetUrl used by the HTML page.
 *
 * IMPORTANT - if you already have a deployment from an older version:
 * you must re-deploy (Manage deployments > Edit > Version: New version > Deploy),
 * a plain "Save" of this file does NOT push the change to the live /exec URL.
 *
 * One sheet tab is created automatically per device type (see TYPES below),
 * plus a "Suppliers" tab (supplier contact info, reused across devices) and
 * an optional "Config" tab (custom type labels/extra fields - safe to leave empty,
 * the HTML page already has built-in defaults for every type below).
 *
 * SCHEMA SAFETY: every read/write goes through headerMap() and looks columns
 * up BY NAME, never by fixed position. This means:
 *   - column order in the sheet can never silently misalign a record
 *     (the historical bug this rewrite fixes for good), and
 *   - adding a new column in the future is safe as long as it's added to
 *     HEADERS below; ensureHeaders() will backfill it onto existing sheets
 *     without touching already-saved data.
 */

const TYPES = [
  'PC','Laptop','Screen','Printer','DesktopPrinter','PolycomVC','SmartProjector','Projector',
  'LHD','MRS','CoreSwitch','DistributionSwitch','Routers','LoadBalancers','Switch','UPS','Scanner',
  'Accessories','ScreenVertical','MicrosoftService','NetworkReceivers','Firewall','LargeScreens',
  'HallScreenHuawei','HallScreenBenq','CiscoPhone','WirelessCiscoPhone','Other'
];

// AddedBy and PhotoUrl were added after the original launch - kept at the very
// end on purpose so older sheets/rows never shift when they're backfilled in.
const HEADERS = [
  'ID','Tag','Brand','Model','Serial','Supplier','Specs','Location','User','Status',
  'Date','Notes','Warranty','WarrantyExpiry','UpdatedAt','AddedBy','PhotoUrl'
];
const SUPPLIER_HEADERS = ['SupplierName','ContactName','Email','Phone','UpdatedAt'];
const CONFIG_HEADERS = ['typeKey','typeLabel','extra1Label','extra2Label'];
const PHOTOS_FOLDER_NAME = 'SRU Infrastructure Inventory - Photos';

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = {};
  TYPES.forEach(function (t) {
    const sheet = ss.getSheetByName(t);
    result[t] = sheet ? readSheet(sheet) : [];
  });
  return jsonResponse({ success: true, data: result, suppliers: readSuppliers(ss), config: readConfig(ss) });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const type = payload.type;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (TYPES.indexOf(type) === -1) {
      return jsonResponse({ success: false, error: 'Unknown device type: ' + type });
    }
    const sheet = getOrCreateSheet(ss, type);

    if (action === 'add' || action === 'update') {
      const r = payload.record;

      // Defensive server-side validation, mirroring the page's own check.
      // This is what actually stops a half-empty record from ever being
      // written - even if something upstream ever sends one, the row that
      // was already saved is left untouched instead of being blanked out.
      if (!r || !String(r.tag || '').trim() || !String(r.location || '').trim() || !type) {
        return jsonResponse({ success: false, error: 'رقم الأصل والموقع ونوع الجهاز مطلوبة.' });
      }

      // Resolve the photo separately from the row write: if the Drive upload
      // fails for any reason, the device's actual data must still be saved.
      let photoUrl = r.photoUrl || '';
      if (r.photoBase64) {
        try {
          const uploaded = savePhotoIfProvided(r.photoBase64, r.photoMime, r.photoName);
          if (uploaded) photoUrl = uploaded;
        } catch (photoErr) {
          photoUrl = r.photoUrl || '';
        }
      }

      const existingRowIndex = (action === 'update') ? findRowById(sheet, r.id) : -1;
      const savedRowIndex = writeRecord(sheet, existingRowIndex, {
        ID: r.id,
        Tag: r.tag,
        Brand: r.brand,
        Model: r.model,
        Serial: r.serial,
        Supplier: r.supplier,
        Specs: JSON.stringify(r.specs || {}),
        Location: r.location,
        User: r.user,
        Status: r.status,
        Date: r.date,
        Notes: r.notes,
        Warranty: r.warranty,
        WarrantyExpiry: r.warrantyExpiry,
        UpdatedAt: new Date().toISOString(),
        AddedBy: r.addedBy || '',
        PhotoUrl: photoUrl
      });
      upsertSupplier(ss, r.supplier, r.supplierContactName, r.supplierEmail, r.supplierPhone);
      SpreadsheetApp.flush();

      // Read the row straight back and confirm the ID actually landed where
      // we expect. This is the safety net for the "saved but not really
      // added" failure mode: if this check ever fails, the client is told
      // explicitly instead of getting a false "success".
      const verifyId = sheet.getRange(savedRowIndex, headerMap(sheet)['ID']).getValue();
      if (String(verifyId) !== String(r.id)) {
        return jsonResponse({ success: false, error: 'تعذر التحقق من حفظ السجل في الشيت (Row ' + savedRowIndex + ').' });
      }

    } else if (action === 'delete') {
      const rowIndex = findRowById(sheet, payload.id);
      if (rowIndex > -1) sheet.deleteRow(rowIndex);
      SpreadsheetApp.flush();

    } else {
      return jsonResponse({ success: false, error: 'Unknown action: ' + action });
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ---- sheet + header helpers (name-based, position-safe) ----

function getOrCreateSheet(ss, type) {
  let sheet = ss.getSheetByName(type);
  if (!sheet) {
    sheet = ss.insertSheet(type);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  } else {
    ensureHeaders(sheet);
  }
  return sheet;
}

// Adds any header from HEADERS that's missing from an existing sheet's first
// row, appending it as a NEW column at the end - never reorders or removes
// an existing header, so already-saved data is never shifted.
function ensureHeaders(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const missing = HEADERS.filter(function (h) { return existing.indexOf(h) === -1; });
  if (missing.length) {
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  }
}

function headerMap(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const row = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  row.forEach(function (h, i) { if (h) map[String(h)] = i + 1; }); // 1-based column index
  return map;
}

// Writes a {HeaderName: value} object into one row, by header name, in a
// SINGLE getRange/setValues call. Returns the row index actually written to.
//
// Deliberately avoids the previous "append an empty/holey row, then set each
// cell one at a time" pattern: a sparse array (`new Array(n)`) handed to
// Apps Script's Sheets bridge, and 17 separate setValue() calls per record,
// are both unnecessary risk for zero benefit - one full, non-sparse array
// written in one call is faster and behaves predictably every time.
function writeRecord(sheet, existingRowIndex, dataByHeader) {
  ensureHeaders(sheet); // make sure every header we're about to write actually exists
  const hMap = headerMap(sheet);
  const numCols = sheet.getLastColumn();

  const rowIndex = (existingRowIndex > -1) ? existingRowIndex : (sheet.getLastRow() + 1);

  // Start from the row's current values on update (so any column this call
  // doesn't touch is preserved), or a real, fully-populated blank row on add.
  let rowValues = (existingRowIndex > -1)
    ? sheet.getRange(rowIndex, 1, 1, numCols).getValues()[0]
    : new Array(numCols).fill('');

  Object.keys(dataByHeader).forEach(function (key) {
    const col = hMap[key];
    if (col) rowValues[col - 1] = dataByHeader[key];
  });

  sheet.getRange(rowIndex, 1, 1, numCols).setValues([rowValues]);
  return rowIndex;
}

function readSheet(sheet) {
  const hMap = headerMap(sheet);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const col = function (name) { return hMap[name] ? hMap[name] - 1 : -1; };
  const idCol = col('ID');
  return values.slice(1)
    .filter(function (r) { return idCol > -1 && r[idCol]; })
    .map(function (r) {
      const get = function (name) { const i = col(name); return i > -1 ? r[i] : ''; };
      const dateVal = get('Date');
      const warrExpVal = get('WarrantyExpiry');
      return {
        id: get('ID'),
        tag: get('Tag'),
        brand: get('Brand'),
        model: get('Model'),
        serial: get('Serial'),
        supplier: get('Supplier'),
        specs: safeParse(get('Specs')),
        location: get('Location'),
        user: get('User'),
        status: get('Status'),
        date: dateVal instanceof Date ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'yyyy-MM-dd') : dateVal,
        notes: get('Notes'),
        warranty: get('Warranty'),
        warrantyExpiry: warrExpVal instanceof Date ? Utilities.formatDate(warrExpVal, Session.getScriptTimeZone(), 'yyyy-MM-dd') : warrExpVal,
        addedBy: get('AddedBy'),
        photoUrl: get('PhotoUrl')
      };
    });
}

// ---- suppliers ----

function getOrCreateSuppliersSheet(ss) {
  let sheet = ss.getSheetByName('Suppliers');
  if (!sheet) {
    sheet = ss.insertSheet('Suppliers');
    sheet.appendRow(SUPPLIER_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readSuppliers(ss) {
  const sheet = getOrCreateSuppliersSheet(ss);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1)
    .filter(function (r) { return r[0]; })
    .map(function (r) {
      return { name: r[0], contactName: r[1], email: r[2], phone: r[3] };
    });
}

// Records a supplier's contact details once; if the supplier already exists,
// only overwrites fields that were actually provided (non-empty), so entering
// the same supplier name on another device without contact info won't erase
// what's already on file - it just reuses it.
function upsertSupplier(ss, name, contactName, email, phone) {
  if (!name) return;
  const sheet = getOrCreateSuppliersSheet(ss);
  const values = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === String(name).trim().toLowerCase()) {
      rowIndex = i + 1;
      break;
    }
  }
  if (rowIndex > -1) {
    const existing = sheet.getRange(rowIndex, 1, 1, 4).getValues()[0];
    sheet.getRange(rowIndex, 1, 1, 5).setValues([[
      name,
      contactName || existing[1],
      email || existing[2],
      phone || existing[3],
      new Date().toISOString()
    ]]);
  } else {
    sheet.appendRow([name, contactName || '', email || '', phone || '', new Date().toISOString()]);
  }
}

// ---- optional per-type config (custom labels) - safe to leave empty ----

function readConfig(ss) {
  const sheet = ss.getSheetByName('Config');
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1)
    .filter(function (r) { return r[0]; })
    .map(function (r) {
      return { typeKey: r[0], typeLabel: r[1], extra1Label: r[2], extra2Label: r[3] };
    });
}

// ---- device photo upload ----

function getOrCreatePhotosFolder() {
  const it = DriveApp.getFoldersByName(PHOTOS_FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(PHOTOS_FOLDER_NAME);
}

// Saves a base64-encoded image to Drive and returns a URL that renders
// reliably inline in an <img> tag (drive.google.com/uc?export=view does NOT
// render reliably when hotlinked - always use the /thumbnail endpoint).
function savePhotoIfProvided(base64, mime, name) {
  if (!base64) return '';
  const folder = getOrCreatePhotosFolder();
  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mime || 'image/jpeg', name || ('photo_' + Date.now() + '.jpg'));
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1000';
}

// ---- misc ----

function findRowById(sheet, id) {
  const hMap = headerMap(sheet);
  const idCol = hMap['ID'];
  if (!idCol) return -1;
  const values = sheet.getRange(1, idCol, sheet.getLastRow(), 1).getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return {}; }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
