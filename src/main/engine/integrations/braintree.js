/**
 * Braintree GraphQL API Integration
 */
'use strict';
const https = require('https');

function braintreeGql(query, variables, publicKey, privateKey, environment) {
  return new Promise((resolve, reject) => {
    const hostname = environment === 'production' ? 'payments.braintree-api.com' : 'payments.sandbox.braintree-api.com';
    const auth = Buffer.from(`${publicKey}:${privateKey}`).toString('base64');
    const body = JSON.stringify({ query, variables: variables || {} });
    const opts = { method: 'POST', hostname, path: '/graphql', headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', 'Braintree-Version': '2019-01-01', 'Content-Length': Buffer.byteLength(body) } };
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
  id: 'braintree',
  name: 'Braintree',
  category: 'payments',
  icon: 'Wallet',
  description: 'Process payments and manage vaults with Braintree GraphQL API.',
  configFields: [
    { key: 'public_key', label: 'Public Key', type: 'text', required: true },
    { key: 'private_key', label: 'Private Key', type: 'password', required: true },
    { key: 'environment', label: 'Environment', type: 'select', options: ['sandbox', 'production'], required: false },
  ],
  async connect(creds) { if (!creds.public_key || !creds.private_key) throw new Error('Public key and private key required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await braintreeGql('{ ping }', {}, creds.public_key, creds.private_key, creds.environment || 'sandbox'); return { success: r.data?.ping === 'pong', message: 'Connected to Braintree' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_transactions: async (params, creds) => {
      const query = `query SearchTransactions($input: TransactionSearchInput!) { search { transactions(input: $input) { edges { node { id amount { value currencyIsoCode } status createdAt } } } } }`;
      return braintreeGql(query, { input: params.input || {} }, creds.public_key, creds.private_key, creds.environment || 'sandbox');
    },
    create_client_token: async (params, creds) => {
      const query = 'mutation CreateClientToken($input: CreateClientTokenInput!) { createClientToken(input: $input) { clientToken } }';
      return braintreeGql(query, { input: params.input || {} }, creds.public_key, creds.private_key, creds.environment || 'sandbox');
    },
    charge_payment_method: async (params, creds) => {
      if (!params.payment_method_id || !params.amount) throw new Error('payment_method_id and amount required');
      const query = 'mutation ChargePaymentMethod($input: ChargePaymentMethodInput!) { chargePaymentMethod(input: $input) { transaction { id status amount { value currencyIsoCode } } } }';
      return braintreeGql(query, { input: { paymentMethodId: params.payment_method_id, transaction: { amount: String(params.amount) } } }, creds.public_key, creds.private_key, creds.environment || 'sandbox');
    },
    refund_transaction: async (params, creds) => {
      if (!params.transaction_id) throw new Error('transaction_id required');
      const query = 'mutation RefundTransaction($input: RefundTransactionInput!) { refundTransaction(input: $input) { refund { id status } } }';
      return braintreeGql(query, { input: { transactionId: params.transaction_id, refund: params.amount ? { amount: String(params.amount) } : {} } }, creds.public_key, creds.private_key, creds.environment || 'sandbox');
    },
    get_client_configuration: async (params, creds) => {
      const query = '{ clientConfiguration { environment } }';
      return braintreeGql(query, {}, creds.public_key, creds.private_key, creds.environment || 'sandbox');
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
