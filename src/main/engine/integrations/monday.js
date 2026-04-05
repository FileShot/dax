/**
 * Monday.com API Integration (GraphQL)
 */
'use strict';
const https = require('https');

function mondayGql(query, variables, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const opts = { method: 'POST', hostname: 'api.monday.com', path: '/v2', headers: { 'Authorization': token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { const j = JSON.parse(data); resolve(j.errors ? { error: j.errors } : j.data); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  id: 'monday',
  name: 'Monday.com',
  category: 'productivity',
  icon: 'CalendarDays',
  description: 'Manage Monday.com boards, items, and columns.',
  configFields: [
    { key: 'api_token', label: 'API Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_token) throw new Error('API token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await mondayGql('{ me { id name email } }', {}, creds.api_token); return { success: !!r.me?.id, message: r.me?.id ? `Authenticated as ${r.me.name}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_boards: async (params, creds) => {
      const limit = params.limit || 25;
      return mondayGql(`{ boards(limit: ${limit}) { id name state board_kind columns { id title type } } }`, {}, creds.api_token);
    },
    get_items: async (params, creds) => {
      if (!params.board_id) throw new Error('board_id required');
      const limit = params.limit || 50;
      return mondayGql(`{ boards(ids: [${params.board_id}]) { items_page(limit: ${limit}) { items { id name state column_values { id text value } group { title } } } } }`, {}, creds.api_token);
    },
    create_item: async (params, creds) => {
      if (!params.board_id || !params.name) throw new Error('board_id and name required');
      const colValues = params.column_values ? `, column_values: ${JSON.stringify(JSON.stringify(params.column_values))}` : '';
      const groupId = params.group_id ? `, group_id: "${params.group_id}"` : '';
      return mondayGql(`mutation { create_item(board_id: ${params.board_id}, item_name: "${params.name.replace(/"/g, '\\"')}"${groupId}${colValues}) { id name } }`, {}, creds.api_token);
    },
    update_item: async (params, creds) => {
      if (!params.board_id || !params.item_id || !params.column_values) throw new Error('board_id, item_id, and column_values required');
      return mondayGql(`mutation { change_multiple_column_values(board_id: ${params.board_id}, item_id: ${params.item_id}, column_values: ${JSON.stringify(JSON.stringify(params.column_values))}) { id name } }`, {}, creds.api_token);
    },
    get_groups: async (params, creds) => {
      if (!params.board_id) throw new Error('board_id required');
      return mondayGql(`{ boards(ids: [${params.board_id}]) { groups { id title color position } } }`, {}, creds.api_token);
    },
    search_items: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const limit = params.limit || 25;
      return mondayGql(`{ items_page_by_column_values(limit: ${limit}, board_id: ${params.board_id || 0}, columns: [{column_id: "name", column_values: ["${params.query.replace(/"/g, '\\"')}"]}]) { items { id name column_values { id text } } } }`, {}, creds.api_token);
    },

    delete_item: async (params, creds) => {
      if (!params.item_id) throw new Error('item_id required');
      return mondayGql(`mutation { delete_item(item_id: ${params.item_id}) { id } }`, {}, creds.api_token);
    },

    get_item: async (params, creds) => {
      if (!params.item_id) throw new Error('item_id required');
      return mondayGql(`{ items(ids: [${params.item_id}]) { id name state column_values { id title text value } group { id title } board { id name } } }`, {}, creds.api_token);
    },

    get_users: async (params, creds) => {
      return mondayGql(`{ users(limit: ${params.limit || 50}) { id name email title is_admin account { name } } }`, {}, creds.api_token);
    },

    move_item_to_group: async (params, creds) => {
      if (!params.item_id || !params.group_id) throw new Error('item_id and group_id required');
      return mondayGql(`mutation { move_item_to_group(item_id: ${params.item_id}, group_id: "${params.group_id}") { id } }`, {}, creds.api_token);
    },

    archive_item: async (params, creds) => {
      if (!params.item_id) throw new Error('item_id required');
      return mondayGql(`mutation { archive_item(item_id: ${params.item_id}) { id state } }`, {}, creds.api_token);
    },

    create_group: async (params, creds) => {
      if (!params.board_id || !params.group_name) throw new Error('board_id and group_name required');
      return mondayGql(`mutation { create_group(board_id: ${params.board_id}, group_name: "${params.group_name}") { id } }`, {}, creds.api_token);
    },

    delete_group: async (params, creds) => {
      if (!params.board_id || !params.group_id) throw new Error('board_id and group_id required');
      return mondayGql(`mutation { delete_group(board_id: ${params.board_id}, group_id: "${params.group_id}") { id deleted } }`, {}, creds.api_token);
    },

    get_subitems: async (params, creds) => {
      if (!params.item_id) throw new Error('item_id required');
      return mondayGql(`{ items(ids: [${params.item_id}]) { subitems { id name state column_values { id title text } } } }`, {}, creds.api_token);
    },

    create_subitem: async (params, creds) => {
      if (!params.parent_item_id || !params.item_name) throw new Error('parent_item_id and item_name required');
      return mondayGql(`mutation { create_subitem(parent_item_id: ${params.parent_item_id}, item_name: "${params.item_name}") { id name } }`, {}, creds.api_token);
    },

    update_column_value: async (params, creds) => {
      if (!params.board_id || !params.item_id || !params.column_id || params.value === undefined) throw new Error('board_id, item_id, column_id, and value required');
      const value = typeof params.value === 'string' ? `"${params.value.replace(/"/g, '\\"')}"` : JSON.stringify(params.value);
      return mondayGql(`mutation { change_simple_column_value(board_id: ${params.board_id}, item_id: ${params.item_id}, column_id: "${params.column_id}", value: ${value}) { id } }`, {}, creds.api_token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
