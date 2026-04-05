/**
 * HubSpot CRM API Integration
 */
'use strict';
const https = require('https');

function hubspotApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { method, hostname: 'api.hubapi.com', path, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode === 204) return resolve({ success: true });
        try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'hubspot',
  name: 'HubSpot',
  category: 'commerce',
  icon: 'Users',
  description: 'Manage HubSpot CRM contacts, deals, and companies.',
  configFields: [
    { key: 'access_token', label: 'Private App Access Token', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.access_token) throw new Error('Access token required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await hubspotApi('GET', '/crm/v3/objects/contacts?limit=1', creds.access_token); return { success: !!r.results, message: r.results ? 'Connected to HubSpot' : `Error: ${r.message}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_contacts: async (params, creds) => {
      const limit = params.limit || 20;
      const properties = params.properties || 'firstname,lastname,email,phone,company';
      return hubspotApi('GET', `/crm/v3/objects/contacts?limit=${limit}&properties=${properties}`, creds.access_token);
    },
    get_contact: async (params, creds) => {
      if (!params.contact_id) throw new Error('contact_id required');
      return hubspotApi('GET', `/crm/v3/objects/contacts/${params.contact_id}?properties=firstname,lastname,email,phone,company`, creds.access_token);
    },
    create_contact: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      const properties = { email: params.email };
      if (params.firstname) properties.firstname = params.firstname;
      if (params.lastname) properties.lastname = params.lastname;
      if (params.phone) properties.phone = params.phone;
      if (params.company) properties.company = params.company;
      return hubspotApi('POST', '/crm/v3/objects/contacts', creds.access_token, { properties });
    },
    list_deals: async (params, creds) => {
      const limit = params.limit || 20;
      return hubspotApi('GET', `/crm/v3/objects/deals?limit=${limit}&properties=dealname,amount,dealstage,closedate`, creds.access_token);
    },
    create_deal: async (params, creds) => {
      if (!params.dealname) throw new Error('dealname required');
      const properties = { dealname: params.dealname };
      if (params.amount) properties.amount = params.amount;
      if (params.dealstage) properties.dealstage = params.dealstage;
      if (params.pipeline) properties.pipeline = params.pipeline;
      if (params.closedate) properties.closedate = params.closedate;
      return hubspotApi('POST', '/crm/v3/objects/deals', creds.access_token, { properties });
    },
    search: async (params, creds) => {
      if (!params.object_type || !params.query) throw new Error('object_type and query required');
      const body = { query: params.query, limit: params.limit || 10 };
      if (params.properties) body.properties = params.properties;
      return hubspotApi('POST', `/crm/v3/objects/${params.object_type}/search`, creds.access_token, body);
    },
    list_companies: async (params, creds) => {
      const limit = params.limit || 20;
      return hubspotApi('GET', `/crm/v3/objects/companies?limit=${limit}&properties=name,domain,industry`, creds.access_token);
    },

    update_contact: async (params, creds) => {
      if (!params.contact_id) throw new Error('contact_id required');
      const properties = {};
      if (params.email) properties.email = params.email;
      if (params.firstname) properties.firstname = params.firstname;
      if (params.lastname) properties.lastname = params.lastname;
      if (params.phone) properties.phone = params.phone;
      if (params.company) properties.company = params.company;
      return hubspotApi('PATCH', `/crm/v3/objects/contacts/${params.contact_id}`, creds.access_token, { properties });
    },

    delete_contact: async (params, creds) => {
      if (!params.contact_id) throw new Error('contact_id required');
      await hubspotApi('DELETE', `/crm/v3/objects/contacts/${params.contact_id}`, creds.access_token);
      return { success: true, deleted: params.contact_id };
    },

    update_deal: async (params, creds) => {
      if (!params.deal_id) throw new Error('deal_id required');
      const properties = {};
      if (params.dealname) properties.dealname = params.dealname;
      if (params.amount) properties.amount = params.amount;
      if (params.dealstage) properties.dealstage = params.dealstage;
      if (params.closedate) properties.closedate = params.closedate;
      return hubspotApi('PATCH', `/crm/v3/objects/deals/${params.deal_id}`, creds.access_token, { properties });
    },

    list_owners: async (params, creds) => {
      const result = await hubspotApi('GET', `/crm/v3/owners?limit=${params.limit || 50}`, creds.access_token);
      return (result.results || []).map((o) => ({ id: o.id, email: o.email, firstName: o.firstName, lastName: o.lastName }));
    },

    create_company: async (params, creds) => {
      if (!params.name) throw new Error('name required');
      const properties = { name: params.name };
      if (params.domain) properties.domain = params.domain;
      if (params.industry) properties.industry = params.industry;
      if (params.phone) properties.phone = params.phone;
      return hubspotApi('POST', '/crm/v3/objects/companies', creds.access_token, { properties });
    },

    list_pipelines: async (params, creds) => {
      const objectType = params.object_type || 'deals';
      const result = await hubspotApi('GET', `/crm/v3/pipelines/${objectType}`, creds.access_token);
      return (result.results || []).map((p) => ({ id: p.id, label: p.label, stages: p.stages?.map((s) => ({ id: s.id, label: s.label })) }));
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
