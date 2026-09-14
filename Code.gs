/**
 * SRU Infrastructure Inventory - Google Sheets backend
 * Version: v1.6 — added 'MicrosoftService' as a device type
 * ------------------------------------------------------
 * DEPLOYMENT:
 * 1. Sheet > Extensions > Apps Script > replace Code.gs content with this file > Save.
 * 2. Deploy > Manage deployments > Edit (pencil) > Version: "New version" > Deploy.
 *    The Web app URL does not change.
 */

const TYPES = ['PC','Laptop','Screen','Printer','Switch','UPS','Scanner','Accessories','ScreenVertical','MicrosoftService','HallScreenHuawei','HallScreenBenq','CiscoPhone','WirelessCiscoPhone','NetworkReceivers','Firewall','LargeScreens','Other'];
const HEADERS = ['ID','Tag','Brand','Model','Serial','Supplier','Specs','Location','User','Status','Date','Notes','Warranty','WarrantyExpiry','UpdatedAt','AddedBy'];
const SUPPLIER_HEADERS = ['SupplierName','ContactName','Email','Phone','UpdatedAt'];

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = {};
  TYPES.forEach(function(t) {
    const sheet = ss.getSheetByName(t);
    result[t] = sheet ? readSheet(sheet) : [];
  });
  return jsonResponse({ success: true, data: result, suppliers: readSuppliers(ss) });
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

    if (action === 'add') {
      const r = payload.record;
      sheet.appendRow([r.id, r.tag, r.brand, r.model, r.serial, r.supplier, JSON.stringify(r.specs || {}), r.location, r.user, r.status, r.date, r.notes, r.warranty, r.warrantyExpiry, new Date().toISOString(), r.addedBy]);
      upsertSupplier(ss, r.supplier, r.supplierContactName, r.supplierEmail, r.supplierPhone);

    } else if (action === 'update') {
      const r = payload.record;
      const rowIndex = findRowById(sheet, r.id);
      if (rowIndex > -1) {
        sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([[r.id, r.tag, r.brand, r.model, r.serial, r.supplier, JSON.stringify(r.specs || {}), r.location, r.user, r.status, r.date, r.notes, r.warranty, r.warrantyExpiry, new Date().toISOString(), r.addedBy]]);
      } else {
        sheet.appendRow([r.id, r.tag, r.brand, r.model, r.serial, r.supplier, JSON.stringify(r.specs || {}), r.location, r.user, r.status, r.date, r.notes, r.warranty, r.warrantyExpiry, new Date().toISOString(), r.addedBy]);
      }
      upsertSupplier(ss, r.supplier, r.supplierContactName, r.supplierEmail, r.supplierPhone);

    } else if (action === 'delete') {
      const rowIndex = findRowById(sheet, payload.id);
      if (rowIndex > -1) sheet.deleteRow(rowIndex);

    } else {
      return jsonResponse({ success: false, error: 'Unknown action: ' + action });
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function getOrCreateSheet(ss, type) {
  let sheet = ss.getSheetByName(type);
  if (!sheet) {
    sheet = ss.insertSheet(type);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  } else {
    // إن كانت الورقة قديمة ولا تملك عمود AddedBy، نضيفه في آخر عمود فقط دون أي إزاحة للبيانات الحالية
    const lastCol = sheet.getLastColumn();
    if (lastCol < HEADERS.length) {
      sheet.getRange(1, HEADERS.length).setValue('AddedBy');
    }
  }
  return sheet;
}

function readSheet(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1)
    .filter(function(r) { return r[0]; })
    .map(function(r) {
      return {
        id: r[0], tag: r[1], brand: r[2], model: r[3], serial: r[4],
        supplier: r[5],
        specs: safeParse(r[6]), location: r[7], user: r[8], status: r[9],
        date: r[10] instanceof Date ? Utilities.formatDate(r[10], Session.getScriptTimeZone(), 'yyyy-MM-dd') : r[10],
        notes: r[11],
        warranty: r[12],
        warrantyExpiry: r[13] instanceof Date ? Utilities.formatDate(r[13], Session.getScriptTimeZone(), 'yyyy-MM-dd') : r[13],
        addedBy: r[15]
      };
    });
}

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
    .filter(function(r) { return r[0]; })
    .map(function(r) {
      return { name: r[0], contactName: r[1], email: r[2], phone: r[3] };
    });
}

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

function findRowById(sheet, id) {
  const values = sheet.getDataRange().getValues();
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
