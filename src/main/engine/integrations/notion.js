// ─── Notion Integration ─────────────────────────────────────
// Uses Notion API v1 with Integration Token

const https = require('https');

function notionApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const req = https.request({
      hostname: 'api.notion.com',
      path: `/v1${path}`,
      method,
      headers,
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try {
          const result = JSON.parse(chunks);
          if (res.statusCode >= 400) reject(new Error(result.message || `Notion API ${res.statusCode}`));
          else resolve(result);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function extractPlainText(richTextArray) {
  if (!Array.isArray(richTextArray)) return '';
  return richTextArray.map((rt) => rt.plain_text || '').join('');
}

module.exports = {
  id: 'notion',
  name: 'Notion',
  category: 'productivity',
  icon: 'FileText',
  description: 'Search, read, and create pages in Notion workspaces',
  configFields: [
    { key: 'token', label: 'Integration Token', type: 'password', required: true },
  ],

  credentials: null,
  connected: false,

  async connect(creds) {
    await notionApi('GET', '/users/me', creds.token);
    this.credentials = creds;
    this.connected = true;
  },

  async disconnect() {
    this.connected = false;
    this.credentials = null;
  },

  async test(creds) {
    try {
      const user = await notionApi('GET', '/users/me', creds.token);
      return { success: true, message: `Connected as ${user.name || user.type}` };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  actions: {
    search: async (params, creds) => {
      const result = await notionApi('POST', '/search', creds.token, {
        query: params.query || '',
        filter: params.type ? { value: params.type, property: 'object' } : undefined,
        page_size: params.limit || 10,
      });
      return (result.results || []).map((r) => ({
        id: r.id,
        type: r.object,
        title: r.properties?.title ? extractPlainText(r.properties.title.title) :
               r.properties?.Name ? extractPlainText(r.properties.Name.title) : r.id,
        url: r.url,
        last_edited: r.last_edited_time,
      }));
    },

    get_page: async (params, creds) => {
      const page = await notionApi('GET', `/pages/${params.page_id}`, creds.token);
      const props = {};
      for (const [key, val] of Object.entries(page.properties || {})) {
        if (val.title) props[key] = extractPlainText(val.title);
        else if (val.rich_text) props[key] = extractPlainText(val.rich_text);
        else if (val.number !== undefined) props[key] = val.number?.number;
        else if (val.select) props[key] = val.select?.select?.name;
        else if (val.date) props[key] = val.date?.date?.start;
      }
      return { id: page.id, url: page.url, properties: props };
    },

    get_page_content: async (params, creds) => {
      const blocks = await notionApi('GET', `/blocks/${params.page_id}/children?page_size=100`, creds.token);
      return (blocks.results || []).map((b) => {
        const type = b.type;
        const content = b[type];
        let text = '';
        if (content?.rich_text) text = extractPlainText(content.rich_text);
        else if (content?.text) text = extractPlainText(content.text);
        return { type, text };
      });
    },

    create_page: async (params, creds) => {
      const body = {
        parent: params.database_id ? { type: 'database_id', database_id: params.database_id }
                                    : { type: 'page_id', page_id: params.parent_page_id },
        properties: {},
      };

      if (params.title) {
        body.properties.title = { title: [{ text: { content: params.title } }] };
        // For databases, use 'Name' property
        if (params.database_id) {
          body.properties.Name = body.properties.title;
          delete body.properties.title;
        }
      }

      if (params.content) {
        body.children = [{
          object: 'block',
          type: 'paragraph',
          paragraph: { rich_text: [{ text: { content: params.content } }] },
        }];
      }

      const result = await notionApi('POST', '/pages', creds.token, body);
      return { id: result.id, url: result.url };
    },

    query_database: async (params, creds) => {
      const body = { page_size: params.limit || 25 };
      if (params.filter) body.filter = params.filter;
      const result = await notionApi('POST', `/databases/${params.database_id}/query`, creds.token, body);
      return (result.results || []).map((page) => {
        const props = {};
        for (const [key, val] of Object.entries(page.properties || {})) {
          if (val.title) props[key] = extractPlainText(val.title);
          else if (val.rich_text) props[key] = extractPlainText(val.rich_text);
          else if (val.number !== undefined) props[key] = val.number?.number;
          else if (val.select) props[key] = val.select?.select?.name;
        }
        return { id: page.id, url: page.url, properties: props };
      });
    },

    update_page: async (params, creds) => {
      if (!params.page_id) throw new Error('page_id required');
      const body = { properties: {} };
      if (params.title) body.properties.title = { title: [{ text: { content: params.title } }] };
      if (params.archived !== undefined) body.archived = params.archived;
      if (params.properties) Object.assign(body.properties, params.properties);
      const result = await notionApi('PATCH', `/pages/${params.page_id}`, creds.token, body);
      return { id: result.id, url: result.url, archived: result.archived };
    },

    append_block: async (params, creds) => {
      if (!params.block_id) throw new Error('block_id required');
      if (!params.content && !params.blocks) throw new Error('content or blocks required');
      const children = params.blocks || [{
        object: 'block', type: 'paragraph',
        paragraph: { rich_text: [{ text: { content: params.content } }] },
      }];
      const result = await notionApi('PATCH', `/blocks/${params.block_id}/children`, creds.token, { children });
      return { results: (result.results || []).map((b) => ({ id: b.id, type: b.type })) };
    },

    list_users: async (params, creds) => {
      const result = await notionApi('GET', `/users?page_size=${params.limit || 25}`, creds.token);
      return (result.results || []).map((u) => ({ id: u.id, name: u.name, type: u.type, email: u.person?.email }));
    },

    add_database_row: async (params, creds) => {
      if (!params.database_id) throw new Error('database_id required');
      const body = {
        parent: { type: 'database_id', database_id: params.database_id },
        properties: params.properties || {},
      };
      if (params.name) {
        body.properties.Name = { title: [{ text: { content: params.name } }] };
      }
      const result = await notionApi('POST', '/pages', creds.token, body);
      return { id: result.id, url: result.url };
    },

    create_database: async (params, creds) => {
      if (!params.parent_page_id || !params.title) throw new Error('parent_page_id and title required');
      const body = {
        parent: { type: 'page_id', page_id: params.parent_page_id },
        title: [{ type: 'text', text: { content: params.title } }],
        properties: params.properties || { Name: { title: {} } },
      };
      const result = await notionApi('POST', '/databases', creds.token, body);
      return { id: result.id, url: result.url, title: params.title };
    },

    get_database: async (params, creds) => {
      if (!params.database_id) throw new Error('database_id required');
      return notionApi('GET', `/databases/${params.database_id}`, creds.token);
    },

    delete_page: async (params, creds) => {
      if (!params.page_id) throw new Error('page_id required');
      return notionApi('PATCH', `/pages/${params.page_id}`, creds.token, { archived: true });
    },

    get_block: async (params, creds) => {
      if (!params.block_id) throw new Error('block_id required');
      return notionApi('GET', `/blocks/${params.block_id}`, creds.token);
    },

    update_block: async (params, creds) => {
      if (!params.block_id || !params.content) throw new Error('block_id and content required');
      const body = { [params.type || 'paragraph']: { rich_text: [{ type: 'text', text: { content: params.content } }] } };
      return notionApi('PATCH', `/blocks/${params.block_id}`, creds.token, body);
    },

    get_page_comments: async (params, creds) => {
      if (!params.page_id) throw new Error('page_id required');
      return notionApi('GET', `/comments?block_id=${params.page_id}`, creds.token);
    },
  },

  async executeAction(actionName, params) {
    const action = this.actions[actionName];
    if (!action) throw new Error('Unknown action: ' + actionName);
    return action(params, this.credentials);
  },
};
