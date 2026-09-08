const SPREADSHEET_ID = '1EveeJqS6f840ZoHeRfhGWm8xWlPsJDpgI8wysxJNZjk';

const TABLES = {
  clients: {
    sheet: 'Clients',
    fields: ['id','company','contact','billingType','rate','fixedRate','overtimeRate','weeklyTarget','method','schedule','nextPay','status','notes','updatedAt']
  },
  logs: {
    sheet: 'Work Logs',
    fields: ['id','clientId','date','timeIn','timeOut','breakMin','manualHours','overtimeHours','billAmount','task','createdAt','updatedAt']
  },
  payments: {
    sheet: 'Payments',
    fields: ['id','clientId','date','amount','method','reference','notes','invoiceId','createdAt','updatedAt']
  },
  tasks: {
    sheet: 'Tasks',
    fields: ['id','clientId','title','status','priority','deadline','notes','createdAt','updatedAt']
  },
  invoices: {
    sheet: 'Invoices',
    fields: ['id','number','clientId','start','end','dueDate','amount','status','notes','createdAt','updatedAt']
  }
};

function doGet(e) {
  try {
    const token = String((e && e.parameter && e.parameter.token) || '');
    authorize_(token);
    const action = String((e && e.parameter && e.parameter.action) || 'getAll');
    let payload;
    if (action === 'getAll' || action === 'ping') {
      payload = {
        ok: true,
        action: action,
        data: action === 'getAll' ? readAll_() : undefined,
        meta: {
          lastModified: getSetting_('last_modified') || '',
          serverTime: new Date().toISOString(),
          spreadsheetId: SPREADSHEET_ID
        }
      };
    } else {
      throw new Error('Unsupported action');
    }
    return jsonp_(payload, e && e.parameter && e.parameter.callback);
  } catch (err) {
    return jsonp_({ok:false,error:String(err && err.message || err)}, e && e.parameter && e.parameter.callback);
  }
}

function doPost(e) {
  try {
    const token = String((e && e.parameter && e.parameter.token) || '');
    authorize_(token);
    const action = String((e && e.parameter && e.parameter.action) || '');
    if (action !== 'saveAll') throw new Error('Unsupported action');
    const raw = String((e && e.parameter && e.parameter.data) || '{}');
    const data = JSON.parse(raw);
    saveAll_(data);
    const now = new Date().toISOString();
    setSetting_('last_modified', now, 'Last successful cloud save.');
    setSetting_('last_writer', String((e && e.parameter && e.parameter.writer) || 'tracker'), 'Last device/browser label supplied by the tracker.');
    return json_({ok:true,lastModified:now});
  } catch (err) {
    return json_({ok:false,error:String(err && err.message || err)});
  }
}

function authorize_(provided) {
  const expected = String(getSetting_('api_token') || '');
  if (!expected) throw new Error('API token is not configured in Settings.');
  if (!provided || provided !== expected) throw new Error('Unauthorized.');
}

function ss_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function readAll_() {
  const out = {};
  Object.keys(TABLES).forEach(key => {
    const def = TABLES[key];
    const sh = ss_().getSheetByName(def.sheet);
    if (!sh) throw new Error('Missing sheet: ' + def.sheet);
    const lastRow = sh.getLastRow();
    if (lastRow < 2) { out[key] = []; return; }
    const values = sh.getRange(2, 1, lastRow - 1, def.fields.length).getDisplayValues();
    out[key] = values
      .filter(r => r.some(v => String(v).trim() !== ''))
      .map(r => {
        const obj = {};
        def.fields.forEach((f,i) => obj[f] = normalize_(f, r[i]));
        return obj;
      });
  });
  return out;
}

function saveAll_(data) {
  Object.keys(TABLES).forEach(key => {
    const def = TABLES[key];
    const sh = ss_().getSheetByName(def.sheet);
    if (!sh) throw new Error('Missing sheet: ' + def.sheet);
    const existingRows = Math.max(0, sh.getLastRow() - 1);
    if (existingRows) sh.getRange(2, 1, existingRows, def.fields.length).clearContent();
    const records = Array.isArray(data[key]) ? data[key] : [];
    if (!records.length) return;
    const rows = records.map(obj => def.fields.map(f => serialize_(obj[f])));
    sh.getRange(2, 1, rows.length, def.fields.length).setValues(rows);
  });
}

function normalize_(field, value) {
  if (value === '') return '';
  const numeric = ['rate','fixedRate','overtimeRate','weeklyTarget','breakMin','manualHours','overtimeHours','billAmount','amount'];
  if (numeric.indexOf(field) >= 0) {
    const n = Number(String(value).replace(/[$,]/g,''));
    return isNaN(n) ? '' : n;
  }
  return value;
}

function serialize_(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function getSetting_(key) {
  const sh = ss_().getSheetByName('Settings');
  if (!sh) throw new Error('Missing Settings sheet.');
  const rows = sh.getRange(1,1,Math.max(sh.getLastRow(),1),3).getDisplayValues();
  for (let i=1;i<rows.length;i++) if (rows[i][0] === key) return rows[i][1];
  return '';
}

function setSetting_(key, value, note) {
  const sh = ss_().getSheetByName('Settings');
  const last = Math.max(sh.getLastRow(),1);
  const rows = sh.getRange(1,1,last,3).getDisplayValues();
  for (let i=1;i<rows.length;i++) {
    if (rows[i][0] === key) {
      sh.getRange(i+1,2).setValue(value);
      if (note !== undefined) sh.getRange(i+1,3).setValue(note);
      return;
    }
  }
  sh.appendRow([key,value,note || '']);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonp_(obj, callback) {
  const cb = String(callback || '').replace(/[^a-zA-Z0-9_.$]/g,'');
  if (!cb) return json_(obj);
  return ContentService.createTextOutput(cb + '(' + JSON.stringify(obj) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
