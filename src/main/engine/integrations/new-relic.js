/**
 * New Relic API Integration
 */
'use strict';
const https = require('https');

function nrApi(method, path, apiKey, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.newrelic.com', path: `/v2${path}`, headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' } };
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

function nrGql(query, variables, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const opts = { method: 'POST', hostname: 'api.newrelic.com', path: '/graphql', headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  id: 'new-relic',
  name: 'New Relic',
  category: 'monitoring',
  icon: 'BarChart3',
  description: 'Query applications, alerts, and NRQL from New Relic.',
  configFields: [
    { key: 'api_key', label: 'User API Key', type: 'password', required: true },
    { key: 'account_id', label: 'Account ID', type: 'text', required: true },
  ],
  async connect(creds) { if (!creds.api_key || !creds.account_id) throw new Error('API key and account ID required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await nrGql('{ actor { user { name email } } }', {}, creds.api_key); return { success: !!r.data?.actor?.user, message: r.data?.actor?.user ? `Connected as ${r.data.actor.user.name}` : 'Auth failed' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    nrql_query: async (params, creds) => {
      if (!params.query) throw new Error('query (NRQL) required');
      return nrGql(`{ actor { account(id: ${creds.account_id}) { nrql(query: "${params.query.replace(/"/g, '\\"')}") { results } } } }`, {}, creds.api_key);
    },
    list_applications: async (params, creds) => nrApi('GET', '/applications.json', creds.api_key),
    get_application: async (params, creds) => { if (!params.app_id) throw new Error('app_id required'); return nrApi('GET', `/applications/${params.app_id}.json`, creds.api_key); },
    list_alerts: async (params, creds) => nrGql(`{ actor { account(id: ${creds.account_id}) { alerts { policiesSearch { policies { id name } } } } } }`, {}, creds.api_key),
    get_entity: async (params, creds) => {
      if (!params.guid) throw new Error('entity guid required');
      return nrGql(`{ actor { entity(guid: "${params.guid}") { name type domain entityType tags { key values } } } }`, {}, creds.api_key);
    },
    search_entities: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      return nrGql(`{ actor { entitySearch(query: "${params.query.replace(/"/g, '\\"')}") { results { entities { guid name type domain } } } } }`, {}, creds.api_key);
    },
    list_dashboards: async (params, creds) => {
      return nrGql(`{ actor { entitySearch(query: "type = 'DASHBOARD' AND accountId = '${creds.account_id}'") { results { entities { guid name } } } } }`, {}, creds.api_key);
    },
    create_dashboard: async (params, creds) => {
      if (!params.name) throw new Error('name required');
      return nrGql(`mutation { dashboardCreate(accountId: ${creds.account_id}, dashboard: { name: "${params.name}", permissions: PRIVATE, pages: [{ name: "${params.page_name || 'Page 1'}" }] }) { entityResult { guid name } } }`, {}, creds.api_key);
    },
    list_synthetics: async (params, creds) => {
      return nrGql(`{ actor { entitySearch(query: "type = 'MONITOR' AND accountId = '${creds.account_id}'") { results { entities { guid name } } } } }`, {}, creds.api_key);
    },
    get_workloads: async (params, creds) => {
      return nrGql(`{ actor { entitySearch(query: "type = 'WORKLOAD' AND accountId = '${creds.account_id}'") { results { entities { guid name } } } } }`, {}, creds.api_key);
    },
    get_account_usage: async (params, creds) => {
      return nrGql(`{ actor { account(id: ${creds.account_id}) { nrql(query: "SELECT sum(usage) FROM NrDailyUsage SINCE 30 days ago FACET productLine") { results } } } }`, {}, creds.api_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
