/**
 * Trello API Integration
 */
'use strict';
const https = require('https');

function trelloApi(method, path, apiKey, token, body = null) {
  const url = new URL(`https://api.trello.com/1${path}`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('token', token);
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: url.hostname, path: `${url.pathname}${url.search}`, headers: { 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'trello',
  name: 'Trello',
  category: 'productivity',
  icon: 'LayoutDashboard',
  description: 'Manage Trello boards, lists, and cards.',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'text', required: true },
    { key: 'token', label: 'Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.token) throw new Error('API key and token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await trelloApi('GET', '/members/me', creds.api_key, creds.token); return { success: !!r.id, message: r.id ? `Authenticated as ${r.fullName}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    get_boards: async (params, creds) => trelloApi('GET', '/members/me/boards?fields=name,desc,url,closed', creds.api_key, creds.token),
    get_lists: async (params, creds) => { if (!params.board_id) throw new Error('board_id required'); return trelloApi('GET', `/boards/${params.board_id}/lists`, creds.api_key, creds.token); },
    get_cards: async (params, creds) => {
      if (!params.list_id && !params.board_id) throw new Error('list_id or board_id required');
      const path = params.list_id ? `/lists/${params.list_id}/cards` : `/boards/${params.board_id}/cards`;
      return trelloApi('GET', path, creds.api_key, creds.token);
    },
    create_card: async (params, creds) => {
      if (!params.list_id || !params.name) throw new Error('list_id and name required');
      const body = { name: params.name, idList: params.list_id };
      if (params.desc) body.desc = params.desc;
      if (params.due) body.due = params.due;
      if (params.labels) body.idLabels = params.labels;
      return trelloApi('POST', '/cards', creds.api_key, creds.token, body);
    },
    update_card: async (params, creds) => {
      if (!params.card_id) throw new Error('card_id required');
      const body = {};
      if (params.name) body.name = params.name;
      if (params.desc) body.desc = params.desc;
      if (params.due) body.due = params.due;
      if (params.closed !== undefined) body.closed = params.closed;
      if (params.list_id) body.idList = params.list_id;
      return trelloApi('PUT', `/cards/${params.card_id}`, creds.api_key, creds.token, body);
    },
    add_comment: async (params, creds) => {
      if (!params.card_id || !params.text) throw new Error('card_id and text required');
      return trelloApi('POST', `/cards/${params.card_id}/actions/comments`, creds.api_key, creds.token, { text: params.text });
    },

    get_card: async (params, creds) => {
      if (!params.card_id) throw new Error('card_id required');
      return trelloApi('GET', `/cards/${params.card_id}`, creds.api_key, creds.token);
    },

    delete_card: async (params, creds) => {
      if (!params.card_id) throw new Error('card_id required');
      await trelloApi('DELETE', `/cards/${params.card_id}`, creds.api_key, creds.token);
      return { success: true, deleted: params.card_id };
    },

    create_list: async (params, creds) => {
      if (!params.board_id || !params.name) throw new Error('board_id and name required');
      return trelloApi('POST', '/lists', creds.api_key, creds.token, { name: params.name, idBoard: params.board_id, pos: params.pos || 'bottom' });
    },

    move_card: async (params, creds) => {
      if (!params.card_id || !params.list_id) throw new Error('card_id and list_id required');
      return trelloApi('PUT', `/cards/${params.card_id}`, creds.api_key, creds.token, { idList: params.list_id, pos: params.pos || 'top' });
    },

    list_members: async (params, creds) => {
      if (!params.board_id) throw new Error('board_id required');
      return trelloApi('GET', `/boards/${params.board_id}/members`, creds.api_key, creds.token);
    },

    archive_card: async (params, creds) => {
      if (!params.card_id) throw new Error('card_id required');
      return trelloApi('PUT', `/cards/${params.card_id}`, creds.api_key, creds.token, { closed: true });
    },

    create_checklist: async (params, creds) => {
      if (!params.card_id || !params.name) throw new Error('card_id and name required');
      return trelloApi('POST', '/checklists', creds.api_key, creds.token, { idCard: params.card_id, name: params.name });
    },

    add_checklist_item: async (params, creds) => {
      if (!params.checklist_id || !params.name) throw new Error('checklist_id and name required');
      return trelloApi('POST', `/checklists/${params.checklist_id}/checkItems`, creds.api_key, creds.token, { name: params.name, checked: params.checked || false });
    },

    get_board_labels: async (params, creds) => {
      if (!params.board_id) throw new Error('board_id required');
      return trelloApi('GET', `/boards/${params.board_id}/labels`, creds.api_key, creds.token);
    },

    search_cards: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const qs = new URLSearchParams({ query: params.query, modelTypes: 'cards', cards_limit: String(params.limit || 10), card_fields: 'name,desc,idList,idBoard,due,labels' }).toString();
      return trelloApi('GET', `/search?${qs}`, creds.api_key, creds.token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
