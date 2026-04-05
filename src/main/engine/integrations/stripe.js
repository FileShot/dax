/**
 * Stripe API Integration
 */
'use strict';
const https = require('https');

function stripeApi(method, path, secretKey, body = null) {
  const auth = Buffer.from(`${secretKey}:`).toString('base64');
  return new Promise((resolve, reject) => {
    const data = body ? new URLSearchParams(flattenObject(body)).toString() : null;
    const opts = { method, hostname: 'api.stripe.com', path: `/v1${path}`, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function flattenObject(obj, prefix = '') {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) Object.assign(result, flattenObject(v, key));
    else result[key] = String(v);
  }
  return result;
}

module.exports = {
  id: 'stripe',
  name: 'Stripe',
  category: 'commerce',
  icon: 'CreditCard',
  description: 'Manage Stripe customers, payments, and subscriptions.',
  configFields: [
    { key: 'secret_key', label: 'Secret Key', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.secret_key) throw new Error('Secret key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await stripeApi('GET', '/balance', creds.secret_key); return { success: !!r.object, message: r.object === 'balance' ? 'Connected to Stripe' : `Error: ${r.error?.message}` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_customers: async (params, creds) => stripeApi('GET', `/customers?limit=${params.limit || 10}`, creds.secret_key),
    create_customer: async (params, creds) => {
      if (!params.email) throw new Error('email required');
      const body = { email: params.email };
      if (params.name) body.name = params.name;
      if (params.description) body.description = params.description;
      return stripeApi('POST', '/customers', creds.secret_key, body);
    },
    list_charges: async (params, creds) => {
      let path = `/charges?limit=${params.limit || 10}`;
      if (params.customer) path += `&customer=${params.customer}`;
      return stripeApi('GET', path, creds.secret_key);
    },
    create_payment_intent: async (params, creds) => {
      if (!params.amount || !params.currency) throw new Error('amount and currency required');
      const body = { amount: params.amount, currency: params.currency };
      if (params.customer) body.customer = params.customer;
      if (params.description) body.description = params.description;
      return stripeApi('POST', '/payment_intents', creds.secret_key, body);
    },
    list_subscriptions: async (params, creds) => {
      let path = `/subscriptions?limit=${params.limit || 10}`;
      if (params.customer) path += `&customer=${params.customer}`;
      return stripeApi('GET', path, creds.secret_key);
    },
    get_balance: async (params, creds) => stripeApi('GET', '/balance', creds.secret_key),
    list_products: async (params, creds) => stripeApi('GET', `/products?limit=${params.limit || 10}`, creds.secret_key),

    update_customer: async (params, creds) => {
      if (!params.customer_id) throw new Error('customer_id required');
      const body = {};
      if (params.email) body.email = params.email;
      if (params.name) body.name = params.name;
      if (params.description) body.description = params.description;
      if (params.phone) body.phone = params.phone;
      return stripeApi('POST', `/customers/${params.customer_id}`, creds.secret_key, body);
    },

    cancel_subscription: async (params, creds) => {
      if (!params.subscription_id) throw new Error('subscription_id required');
      return stripeApi('DELETE', `/subscriptions/${params.subscription_id}`, creds.secret_key);
    },

    list_invoices: async (params, creds) => {
      let path = `/invoices?limit=${params.limit || 10}`;
      if (params.customer) path += `&customer=${params.customer}`;
      if (params.status) path += `&status=${params.status}`;
      return stripeApi('GET', path, creds.secret_key);
    },

    create_refund: async (params, creds) => {
      if (!params.charge_id && !params.payment_intent_id) throw new Error('charge_id or payment_intent_id required');
      const body = {};
      if (params.charge_id) body.charge = params.charge_id;
      if (params.payment_intent_id) body.payment_intent = params.payment_intent_id;
      if (params.amount) body.amount = params.amount;
      if (params.reason) body.reason = params.reason;
      return stripeApi('POST', '/refunds', creds.secret_key, body);
    },

    list_payment_intents: async (params, creds) => {
      let path = `/payment_intents?limit=${params.limit || 10}`;
      if (params.customer) path += `&customer=${params.customer}`;
      return stripeApi('GET', path, creds.secret_key);
    },

    create_price: async (params, creds) => {
      if (!params.product_id || !params.unit_amount || !params.currency) throw new Error('product_id, unit_amount, and currency required');
      const body = { product: params.product_id, unit_amount: params.unit_amount, currency: params.currency };
      if (params.recurring) body.recurring = params.recurring;
      return stripeApi('POST', '/prices', creds.secret_key, body);
    },

    list_events: async (params, creds) => {
      let path = `/events?limit=${params.limit || 10}`;
      if (params.type) path += `&type=${params.type}`;
      return stripeApi('GET', path, creds.secret_key);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
