/**
 * AWS DynamoDB API Integration (SigV4)
 */
'use strict';
const https = require('https');
const crypto = require('crypto');

function hmac(key, data) { return crypto.createHmac('sha256', key).update(data).digest(); }
function sha256hex(data) { return crypto.createHash('sha256').update(data).digest('hex'); }

function ddbRequest(region, accessKey, secretKey, action, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const dateOnly = dateStamp.slice(0, 8);
    const host = `dynamodb.${region}.amazonaws.com`;
    const canonicalHeaders = `content-type:application/x-amz-json-1.0\nhost:${host}\nx-amz-date:${dateStamp}\nx-amz-target:DynamoDB_20120810.${action}\n`;
    const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
    const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${sha256hex(body)}`;
    const scope = `${dateOnly}/${region}/dynamodb/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${dateStamp}\n${scope}\n${sha256hex(canonicalRequest)}`;
    let sigKey = hmac(`AWS4${secretKey}`, dateOnly);
    sigKey = hmac(sigKey, region);
    sigKey = hmac(sigKey, 'dynamodb');
    sigKey = hmac(sigKey, 'aws4_request');
    const signature = hmac(sigKey, stringToSign).toString('hex');

    const opts = {
      method: 'POST',
      hostname: host,
      path: '/',
      headers: {
        'Content-Type': 'application/x-amz-json-1.0',
        'x-amz-target': `DynamoDB_20120810.${action}`,
        'x-amz-date': dateStamp,
        'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };
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
  id: 'dynamodb',
  name: 'DynamoDB',
  category: 'database',
  icon: 'ServerCog',
  description: 'Read, write, and query AWS DynamoDB tables.',
  configFields: [
    { key: 'access_key_id', label: 'AWS Access Key ID', type: 'text', required: true },
    { key: 'secret_access_key', label: 'AWS Secret Access Key', type: 'password', required: true },
    { key: 'region', label: 'AWS Region', type: 'text', required: true, placeholder: 'us-east-1' },
  ],
  async connect(creds) { if (!creds.access_key_id || !creds.secret_access_key || !creds.region) throw new Error('AWS credentials and region required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await ddbRequest(creds.region, creds.access_key_id, creds.secret_access_key, 'ListTables', { Limit: 1 }); return { success: !!r.TableNames, message: `${r.TableNames?.length || 0} table(s) found` }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    list_tables: async (params, creds) => ddbRequest(creds.region, creds.access_key_id, creds.secret_access_key, 'ListTables', { Limit: params.limit || 100 }),
    get_item: async (params, creds) => { if (!params.table || !params.key) throw new Error('table and key required'); return ddbRequest(creds.region, creds.access_key_id, creds.secret_access_key, 'GetItem', { TableName: params.table, Key: params.key }); },
    put_item: async (params, creds) => { if (!params.table || !params.item) throw new Error('table and item required'); return ddbRequest(creds.region, creds.access_key_id, creds.secret_access_key, 'PutItem', { TableName: params.table, Item: params.item }); },
    query: async (params, creds) => {
      if (!params.table || !params.key_condition) throw new Error('table and key_condition required');
      return ddbRequest(creds.region, creds.access_key_id, creds.secret_access_key, 'Query', { TableName: params.table, KeyConditionExpression: params.key_condition, ExpressionAttributeValues: params.expression_values || {}, Limit: params.limit || 100 });
    },
    delete_item: async (params, creds) => { if (!params.table || !params.key) throw new Error('table and key required'); return ddbRequest(creds.region, creds.access_key_id, creds.secret_access_key, 'DeleteItem', { TableName: params.table, Key: params.key }); },
    scan: async (params, creds) => {
      if (!params.table) throw new Error('table required');
      return ddbRequest(creds.region, creds.access_key_id, creds.secret_access_key, 'Scan', { TableName: params.table, Limit: params.limit || 100, ...(params.filter_expression && { FilterExpression: params.filter_expression, ExpressionAttributeValues: params.expression_values || {} }) });
    },
    describe_table: async (params, creds) => {
      if (!params.table) throw new Error('table required');
      return ddbRequest(creds.region, creds.access_key_id, creds.secret_access_key, 'DescribeTable', { TableName: params.table });
    },
    update_item: async (params, creds) => {
      if (!params.table || !params.key || !params.update_expression) throw new Error('table, key, and update_expression required');
      return ddbRequest(creds.region, creds.access_key_id, creds.secret_access_key, 'UpdateItem', { TableName: params.table, Key: params.key, UpdateExpression: params.update_expression, ExpressionAttributeValues: params.expression_values || {}, ReturnValues: params.return_values || 'ALL_NEW' });
    },
    batch_get_item: async (params, creds) => {
      if (!params.request_items) throw new Error('request_items required');
      return ddbRequest(creds.region, creds.access_key_id, creds.secret_access_key, 'BatchGetItem', { RequestItems: params.request_items });
    },
    batch_write_item: async (params, creds) => {
      if (!params.request_items) throw new Error('request_items required');
      return ddbRequest(creds.region, creds.access_key_id, creds.secret_access_key, 'BatchWriteItem', { RequestItems: params.request_items });
    },
    create_table: async (params, creds) => {
      if (!params.table || !params.key_schema || !params.attribute_definitions) throw new Error('table, key_schema, and attribute_definitions required');
      return ddbRequest(creds.region, creds.access_key_id, creds.secret_access_key, 'CreateTable', { TableName: params.table, KeySchema: params.key_schema, AttributeDefinitions: params.attribute_definitions, BillingMode: params.billing_mode || 'PAY_PER_REQUEST' });
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
