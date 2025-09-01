/**
 * Google Apps Script Webhook Library (Sheets onEdit)
 * - Sends JSON payload to one or more webhook URLs when a cell changes.
 * - First row is the header row by default (configurable).
 * - Payload shape matches the requested format.
 */

var WEBHOOK_URL_PROP = 'WEBHOOK_URL';       // single URL (backward compatible)
var WEBHOOK_URLS_PROP = 'WEBHOOK_URLS';     // JSON array of URLs
var CONFIG_PROP = 'WEBHOOK_CONFIG';          // JSON of configuration

/**
 * Installable onEdit handler. Create a trigger pointing to this.
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e
 */
function onEditInstallable(e) {
  try {
    if (!e || !e.range) {
      console.error('Missing event or range:', e);
      return;
    }

    var cfg = getConfig_();
    var range = e.range;
    var sheet = range.getSheet();
    var spreadsheet = sheet.getParent();

    var row = range.getRow();
    var col = range.getColumn();

    if (cfg.skipHeaderRow && row === cfg.headerRow) return; // ignore header edits

    var sheetName = sheet.getName();
    if (cfg.watchSheets && cfg.watchSheets.length && cfg.watchSheets.indexOf(sheetName) === -1) return;

    var columnName = String(sheet.getRange(cfg.headerRow, col).getValue() || '').trim();
    if (cfg.watchColumns && cfg.watchColumns.length && cfg.watchColumns.indexOf(columnName) === -1) return;

    // Determine old/new values
    var newValue = range.getValue();
    var oldValue = typeof e.oldValue !== 'undefined' ? e.oldValue : getStoredCellValue_(sheetName, row, col);

    // Skip if value did not actually change (normalize to string)
    if (String(oldValue || '') === String(newValue || '')) {
      // Still update stored snapshot so subsequent comparisons are correct
      setStoredCellValue_(sheetName, row, col, newValue);
      return;
    }

    // Build row object from headers
    var rowData = getRowObject_(sheet, row, cfg.headerRow);

    var payload = {
      sheetName: sheetName,
      spreadsheetName: spreadsheet.getName(),
      spreadsheetId: spreadsheet.getId(),
      columnName: columnName,
      rowIndex: row,
      oldValue: String(oldValue || ''),
      newValue: String(newValue || ''),
      rowData: rowData
    };

    // Send and persist snapshot
    sendWebhook_(payload, cfg);
    setStoredCellValue_(sheetName, row, col, newValue);

  } catch (err) {
    console.error('onEditInstallable error:', err);
  }
}

/**
 * Return row as object { header: value }
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} rowIndex
 * @param {number} headerRow
 */
function getRowObject_(sheet, rowIndex, headerRow) {
  try {
    var lastCol = sheet.getLastColumn();
    if (lastCol < 1) return {};
    var headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
    var values = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
    var obj = {};
    for (var i = 0; i < headers.length; i++) {
      var key = headers[i];
      if (!key) continue; // skip empty headers
      obj[String(key)] = String(values[i] != null ? values[i] : '');
    }
    return obj;
  } catch (err) {
    console.error('getRowObject_ error:', err);
    return {};
  }
}

/**
 * Read config from ScriptProperties with sane defaults.
 */
function getConfig_() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty(CONFIG_PROP);
  var cfg = {};
  try { if (raw) cfg = JSON.parse(raw); } catch (e) { console.warn('Config parse failed:', e); }

  // defaults
  if (typeof cfg.skipHeaderRow === 'undefined') cfg.skipHeaderRow = true;
  if (typeof cfg.headerRow === 'undefined') cfg.headerRow = 1;
  if (!Array.isArray(cfg.watchSheets)) cfg.watchSheets = [];
  if (!Array.isArray(cfg.watchColumns)) cfg.watchColumns = [];
  if (!cfg.extraHeaders || typeof cfg.extraHeaders !== 'object') cfg.extraHeaders = {};
  return cfg;
}

/** Store and retrieve previous cell value using ScriptProperties. */
function getStoredCellValue_(sheetName, row, col) {
  var key = sheetName + '_' + row + '_' + col;
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}
function setStoredCellValue_(sheetName, row, col, value) {
  var key = sheetName + '_' + row + '_' + col;
  PropertiesService.getScriptProperties().setProperty(key, String(value != null ? value : ''));
}

/**
 * POST payload to one or more webhook URLs.
 * @param {Object} data
 * @param {Object} cfg
 */
function sendWebhook_(data, cfg) {
  try {
    var props = PropertiesService.getScriptProperties();
    var urlsRaw = props.getProperty(WEBHOOK_URLS_PROP);
    var urlSingle = props.getProperty(WEBHOOK_URL_PROP);
    var urls = [];

    if (urlsRaw) {
      try { urls = JSON.parse(urlsRaw) || []; } catch (e) { console.warn('WEBHOOK_URLS parse failed:', e); }
    }
    if (!urls.length && urlSingle) urls = [urlSingle];

    if (!urls.length) {
      console.log('No webhook URL configured. Run setupWebhookLibrary().');
      console.log(JSON.stringify(data));
      return;
    }

    var baseHeaders = { 'User-Agent': 'AppsScript-Sheets-Webhook/1.0' };
    // Merge user headers
    for (var h in cfg.extraHeaders) {
      if (cfg.extraHeaders.hasOwnProperty(h)) baseHeaders[h] = cfg.extraHeaders[h];
    }

    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(data),
      headers: baseHeaders,
      muteHttpExceptions: true
    };

    for (var i = 0; i < urls.length; i++) {
      var url = urls[i];
      try {
        var res = UrlFetchApp.fetch(url, options);
        var code = res.getResponseCode();
        if (code < 200 || code >= 300) {
          console.warn('Webhook non-2xx:', code, url, res.getContentText());
        }
      } catch (e) {
        console.error('Webhook request failed:', url, e);
      }
    }
  } catch (err) {
    console.error('sendWebhook_ fatal error:', err);
  }
}

/**
 * Initialize snapshot of current sheet values (optional).
 * Call once to seed oldValue comparisons.
 */
function initializeCellValues() {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    var values = sheet.getDataRange().getValues();
    var props = PropertiesService.getScriptProperties();
    var name = sheet.getName();
    for (var r = 2; r <= values.length; r++) {
      for (var c = 1; c <= values[r - 1].length; c++) {
        var key = name + '_' + r + '_' + c;
        props.setProperty(key, String(values[r - 1][c - 1] != null ? values[r - 1][c - 1] : ''));
      }
    }
    console.log('Initialized cell snapshots for sheet:', name);
  } catch (err) {
    console.error('initializeCellValues error:', err);
  }
}

/**
 * One-time setup for the library. Creates installable onEdit trigger and stores config.
 * @param {string|string[]} webhookUrl - URL or array of URLs
 * @param {Object} options
 *  - skipHeaderRow?: boolean (default true)
 *  - headerRow?: number (default 1)
 *  - functionName?: string (default 'onEditInstallable')
 *  - watchSheets?: string[] (optional)
 *  - watchColumns?: string[] (optional; match header text exactly)
 *  - extraHeaders?: Object (e.g., { 'X-Webhook-Secret': 'abc' })
 */
function setupWebhookLibrary(webhookUrl, options) {
  try {
    if (!webhookUrl || (typeof webhookUrl !== 'string' && !Array.isArray(webhookUrl))) {
      throw new Error('Provide webhookUrl as string or string[].');
    }
    options = options || {};

    var cfg = {
      skipHeaderRow: typeof options.skipHeaderRow === 'boolean' ? options.skipHeaderRow : true,
      headerRow: typeof options.headerRow === 'number' ? options.headerRow : 1,
      functionName: options.functionName || 'onEditInstallable',
      watchSheets: Array.isArray(options.watchSheets) ? options.watchSheets.slice() : [],
      watchColumns: Array.isArray(options.watchColumns) ? options.watchColumns.slice() : [],
      extraHeaders: options.extraHeaders && typeof options.extraHeaders === 'object' ? options.extraHeaders : {}
    };

    var props = PropertiesService.getScriptProperties();
    props.setProperty(CONFIG_PROP, JSON.stringify(cfg));

    if (Array.isArray(webhookUrl)) {
      props.setProperty(WEBHOOK_URLS_PROP, JSON.stringify(webhookUrl));
      props.deleteProperty(WEBHOOK_URL_PROP);
    } else {
      props.setProperty(WEBHOOK_URL_PROP, String(webhookUrl));
      props.deleteProperty(WEBHOOK_URLS_PROP);
    }

    // Remove existing trigger(s) for the handler to avoid duplicates
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === cfg.functionName) {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }
    ScriptApp.newTrigger(cfg.functionName).onEdit().create();

    console.log('Webhook library setup complete:', JSON.stringify(cfg));
    return { success: true };
  } catch (err) {
    console.error('setupWebhookLibrary error:', err);
    return { success: false, message: String(err && err.message || err) };
  }
}

/** Remove triggers and configuration. */
function removeWebhookLibrary() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
    var props = PropertiesService.getScriptProperties();
    props.deleteProperty(CONFIG_PROP);
    props.deleteProperty(WEBHOOK_URL_PROP);
    props.deleteProperty(WEBHOOK_URLS_PROP);
    return { success: true };
  } catch (err) {
    console.error('removeWebhookLibrary error:', err);
    return { success: false, message: String(err && err.message || err) };
  }
}

/** Quick setup helper for single URL. */
function simpleSetup(url) {
  setupWebhookLibrary(url, { skipHeaderRow: true, headerRow: 1 });
}

/** Manual test helper (sends a sample payload). */
function testWebhook() {
  var data = {
    sheetName: '시트1',
    spreadsheetName: '20250825',
    spreadsheetId: '1Xb0jJIAl1VO8e6vhPifnr-XX2Jo03bGZHwaYzMut7WU',
    columnName: '배송상태',
    rowIndex: 2,
    oldValue: '배송 준비중',
    newValue: '배송 완료',
    rowData: {
      '배송지': '수원시 장안구 수성로 157번길 60',
      '고객명': '1번 고객',
      '고객 연락처': '01030917061',
      '배송 담당자': '박국철',
      '배송상태': '배송 완료'
    }
  };
  sendWebhook_(data, getConfig_());
}
