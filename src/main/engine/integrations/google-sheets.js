// ─── Google Sheets Integration ──────────────────────────────
// Uses Google Sheets API v4 with API key or OAuth 2.0 bearer token.
// API key grants read-only access; OAuth grants full read/write.

const https = require('https');

/**
 * Make a Google Sheets API request.
 * @param {string} method  HTTP method
 * @param {string} path    Path relative to /v4/spreadsheets
 * @param {object|string} creds  credentials — { api_key } or { access_token } or legacy string api key
 * @param {object|null}  body
 */
function sheetsApi(method, path, creds, body = null) {
  return new Promise((resolve, reject) => {
    const apiKey      = typeof creds === 'string' ? creds : (creds?.api_key || null);
    const accessToken = typeof creds === 'object' ? (creds?.access_token || null) : null;

    let fullPath;
    const headers = { 'Content-Type': 'application/json' };

    if (accessToken) {
      // OAuth 2.0 — send bearer token in Authorization header
      fullPath = `/v4/spreadsheets${path}`;
      headers['Authorization'] = `Bearer ${accessToken}`;
    } else if (apiKey) {
      const sep = path.includes('?') ? '&' : '?';
      fullPath = `/v4/spreadsheets${path}${sep}key=${apiKey}`;
    } else {
      return reject(new Error('Google Sheets: api_key or access_token required'));
    }

    const options = {
      hostname: 'sheets.googleapis.com',
      path: fullPath,
      method,
      headers,
    };

    const req = https.request(options, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try {
          const result = chunks ? JSON.parse(chunks) : {};
          if (res.statusCode >= 400) {
            reject(new Error(result.error?.message || `Google Sheets error ${res.statusCode}`));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'google_sheets',
  name: 'Google Sheets',
  category: 'productivity',
  icon: 'Table',
  description: 'Read from and write to Google Sheets spreadsheets',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: false, placeholder: 'AIza...' },
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: false, placeholder: 'Provided automatically via OAuth flow' },
    { key: 'default_spreadsheet_id', label: 'Default Spreadsheet ID', type: 'text', placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms' },
  ],

  async connect(creds) {
    if (!creds.api_key && !creds.access_token) throw new Error('api_key or access_token required');
    if (creds.default_spreadsheet_id) {
      await sheetsApi('GET', `/${creds.default_spreadsheet_id}`, creds);
    }
  },

  async test(creds) {
    try {
      if (!creds.default_spreadsheet_id) {
        return { success: true, message: creds.access_token ? 'OAuth connected (no spreadsheet to verify)' : 'API key set (no spreadsheet to verify)' };
      }
      const result = await sheetsApi('GET', `/${creds.default_spreadsheet_id}`, creds);
      return { success: true, message: `Connected to "${result.properties?.title}"` };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  actions: {
    read_range: async (params, creds) => {
      const spreadsheetId = params.spreadsheet_id || creds.default_spreadsheet_id;
      if (!spreadsheetId) throw new Error('spreadsheet_id required');
      const range = encodeURIComponent(params.range || 'Sheet1!A1:Z100');
      const result = await sheetsApi('GET', `/${spreadsheetId}/values/${range}`, creds);
      return {
        range: result.range,
        values: result.values || [],
        rows: (result.values || []).length,
      };
    },

    get_spreadsheet_info: async (params, creds) => {
      const spreadsheetId = params.spreadsheet_id || creds.default_spreadsheet_id;
      if (!spreadsheetId) throw new Error('spreadsheet_id required');
      const result = await sheetsApi('GET', `/${spreadsheetId}`, creds);
      return {
        title: result.properties?.title,
        locale: result.properties?.locale,
        sheets: (result.sheets || []).map((s) => ({
          id: s.properties?.sheetId,
          title: s.properties?.title,
          rows: s.properties?.gridProperties?.rowCount,
          cols: s.properties?.gridProperties?.columnCount,
        })),
      };
    },

    search_cells: async (params, creds) => {
      const spreadsheetId = params.spreadsheet_id || creds.default_spreadsheet_id;
      if (!spreadsheetId) throw new Error('spreadsheet_id required');
      const range = encodeURIComponent(params.range || 'Sheet1!A1:Z1000');
      const result = await sheetsApi('GET', `/${spreadsheetId}/values/${range}`, creds);
      const query = (params.query || '').toLowerCase();
      const matches = [];
      (result.values || []).forEach((row, rowIdx) => {
        row.forEach((cell, colIdx) => {
          if (String(cell).toLowerCase().includes(query)) {
            matches.push({ row: rowIdx + 1, col: colIdx + 1, value: cell });
          }
        });
      });
      return { query: params.query, matches };
    },

    write_range: async (params, creds) => {
      const spreadsheetId = params.spreadsheet_id || creds.default_spreadsheet_id;
      if (!spreadsheetId || !params.range || !params.values) throw new Error('spreadsheet_id, range, and values required');
      const range = encodeURIComponent(params.range);
      const result = await sheetsApi('PUT', `/${spreadsheetId}/values/${range}?valueInputOption=${params.input_option || 'USER_ENTERED'}`, creds, { range: params.range, majorDimension: 'ROWS', values: params.values });
      return { updatedRange: result.updatedRange, updatedRows: result.updatedRows, updatedColumns: result.updatedColumns, updatedCells: result.updatedCells };
    },

    append_row: async (params, creds) => {
      const spreadsheetId = params.spreadsheet_id || creds.default_spreadsheet_id;
      if (!spreadsheetId || !params.values) throw new Error('spreadsheet_id and values required');
      const range = encodeURIComponent(params.range || 'Sheet1');
      const result = await sheetsApi('POST', `/${spreadsheetId}/values/${range}:append?valueInputOption=${params.input_option || 'USER_ENTERED'}&insertDataOption=INSERT_ROWS`, creds, { majorDimension: 'ROWS', values: Array.isArray(params.values[0]) ? params.values : [params.values] });
      return { updatedRange: result.updates?.updatedRange, updatedRows: result.updates?.updatedRows };
    },

    clear_range: async (params, creds) => {
      const spreadsheetId = params.spreadsheet_id || creds.default_spreadsheet_id;
      if (!spreadsheetId || !params.range) throw new Error('spreadsheet_id and range required');
      const range = encodeURIComponent(params.range);
      const result = await sheetsApi('POST', `/${spreadsheetId}/values/${range}:clear`, creds, {});
      return { clearedRange: result.clearedRange };
    },

    get_named_ranges: async (params, creds) => {
      const spreadsheetId = params.spreadsheet_id || creds.default_spreadsheet_id;
      if (!spreadsheetId) throw new Error('spreadsheet_id required');
      const result = await sheetsApi('GET', `/${spreadsheetId}?fields=namedRanges`, creds);
    },
  },
  async disconnect() { this.credentials = null; },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};

