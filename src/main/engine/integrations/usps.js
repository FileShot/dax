/**
 * USPS Web Tools API Integration
 */
'use strict';
const https = require('https');
const { makeRequest } = require('../../engine/integration-utils');

function uspsXml(api, xmlBody, userId) {
  const xml = `<${api}Request USERID="${userId}">${xmlBody}</${api}Request>`;
  const qs = `API=${api}&XML=${encodeURIComponent(xml)}`;
  const opts = { method: 'GET', hostname: 'secure.shippingapis.com', path: `/ShippingAPI.dll?${qs}`, headers: { 'Accept': 'application/xml' } };
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ xml: d, status: res.statusCode }));
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  id: 'usps',
  name: 'USPS',
  category: 'government',
  icon: 'Mail',
  description: 'Verify US addresses, look up ZIP codes, and track packages via USPS Web Tools.',
  configFields: [{ key: 'user_id', label: 'USPS Web Tools User ID', type: 'password', required: true }],
  async connect(creds) { if (!creds.user_id) throw new Error('user_id required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { const r = await uspsXml('Verify', '<Address ID="0"><Address1></Address1><Address2>6406 Ivy Lane</Address2><City>Greenbelt</City><State>MD</State><Zip5></Zip5><Zip4></Zip4></Address>', creds.user_id); if (r.xml.includes('Error')) return { success: false, message: 'Authentication failed or invalid response' }; return { success: true, message: 'Connected to USPS Web Tools' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    verify_address: async (params, creds) => {
      if (!params.address2 || !params.city || !params.state) throw new Error('address2 (street), city, and state required');
      const xml = `<Address ID="0"><Address1>${params.address1 || ''}</Address1><Address2>${params.address2}</Address2><City>${params.city}</City><State>${params.state}</State><Zip5>${params.zip5 || ''}</Zip5><Zip4></Zip4></Address>`;
      return uspsXml('Verify', xml, creds.user_id);
    },
    get_zip_code: async (params, creds) => {
      if (!params.address2 || !params.city || !params.state) throw new Error('address2, city, state required');
      const xml = `<Address ID="0"><Address1>${params.address1 || ''}</Address1><Address2>${params.address2}</Address2><City>${params.city}</City><State>${params.state}</State><Zip5></Zip5><Zip4></Zip4></Address>`;
      return uspsXml('ZipCodeLookup', xml, creds.user_id);
    },
    get_city_state: async (params, creds) => {
      if (!params.zip5) throw new Error('zip5 required');
      return uspsXml('CityStateLookup', `<ZipCode ID="0"><Zip5>${params.zip5}</Zip5></ZipCode>`, creds.user_id);
    },
    track_package: async (params, creds) => {
      if (!params.tracking_id) throw new Error('tracking_id required');
      return uspsXml('TrackV2', `<TrackID ID="${params.tracking_id}"></TrackID>`, creds.user_id);
    },
    get_service_delivery_calculation: async (params, creds) => {
      if (!params.origin_zip || !params.destination_zip) throw new Error('origin_zip and destination_zip required');
      const xml = `<OriginZip>${params.origin_zip}</OriginZip><DestinationZip>${params.destination_zip}</DestinationZip><Date>${params.date || ''}</Date><Service>${params.service || 'Priority'}</Service>`;
      return uspsXml('SDCGetLocations', xml, creds.user_id);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
