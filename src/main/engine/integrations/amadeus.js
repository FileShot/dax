/**
 * Amadeus Travel API Integration
 */
'use strict';
const https = require('https');
const { TokenCache, makeRequest } = require('../../engine/integration-utils');
const _tokenCache = new TokenCache();

async function getToken(clientId, clientSecret) {
  const cacheKey = clientId;
  const cached = _tokenCache.get(cacheKey);
  if (cached) return cached;
  return new Promise((resolve, reject) => {
    const body = `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`;
    const opts = { method: 'POST', hostname: 'api.amadeus.com', path: '/v1/security/oauth2/token', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } };
    const req = https.request(opts, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { const r = JSON.parse(d); if (r.access_token) { _tokenCache.set(cacheKey, r.access_token, r.expires_in || 1799); resolve(r.access_token); } else reject(new Error(r.error_description || 'Token failed')); } catch { reject(new Error('Token parse error')); } }); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function amGet(path, token) {
  const opts = { method: 'GET', hostname: 'api.amadeus.com', path, headers: { 'Authorization': `Bearer ${token}` } };
  return makeRequest(opts, null);
}

module.exports = {
  id: 'amadeus',
  name: 'Amadeus',
  category: 'travel',
  icon: 'Plane',
  description: 'Search flights, hotels, and travel offers using the Amadeus Travel API.',
  configFields: [
    { key: 'client_id', label: 'Client ID (API Key)', type: 'text', required: true },
    { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
  ],
  async connect(creds) { if (!creds.client_id || !creds.client_secret) throw new Error('client_id and client_secret required'); this.credentials = creds; },
  async disconnect() { this.credentials = null; },
  async test(creds) {
    try { await getToken(creds.client_id, creds.client_secret); return { success: true, message: 'Connected to Amadeus' }; }
    catch (e) { return { success: false, message: e.message }; }
  },
  actions: {
    search_flights: async (params, creds) => {
      if (!params.originLocationCode || !params.destinationLocationCode || !params.departureDate) throw new Error('originLocationCode, destinationLocationCode, and departureDate required');
      const token = await getToken(creds.client_id, creds.client_secret);
      const qs = new URLSearchParams({ originLocationCode: params.originLocationCode, destinationLocationCode: params.destinationLocationCode, departureDate: params.departureDate, adults: String(params.adults || 1), ...(params.returnDate && { returnDate: params.returnDate }), ...(params.max && { max: String(params.max) }), ...(params.currencyCode && { currencyCode: params.currencyCode }) }).toString();
      return amGet(`/v2/shopping/flight-offers?${qs}`, token);
    },
    search_hotels: async (params, creds) => {
      if (!params.cityCode) throw new Error('cityCode required');
      const token = await getToken(creds.client_id, creds.client_secret);
      const qs = new URLSearchParams({ cityCode: params.cityCode, ...(params.checkInDate && { checkInDate: params.checkInDate }), ...(params.checkOutDate && { checkOutDate: params.checkOutDate }), ...(params.adults && { adults: String(params.adults) }) }).toString();
      return amGet(`/v3/shopping/hotel-offers?${qs}`, token);
    },
    get_flight_offers: async (params, creds) => {
      if (!params.originLocationCode || !params.destinationLocationCode || !params.departureDate) throw new Error('originLocationCode, destinationLocationCode, departureDate required');
      const token = await getToken(creds.client_id, creds.client_secret);
      const qs = new URLSearchParams({ originLocationCode: params.originLocationCode, destinationLocationCode: params.destinationLocationCode, departureDate: params.departureDate, adults: String(params.adults || 1) }).toString();
      return amGet(`/v2/shopping/flight-offers?${qs}`, token);
    },
    get_hotel_offers: async (params, creds) => {
      if (!params.hotelIds) throw new Error('hotelIds required');
      const token = await getToken(creds.client_id, creds.client_secret);
      const qs = new URLSearchParams({ hotelIds: params.hotelIds, adults: String(params.adults || 1), ...(params.checkInDate && { checkInDate: params.checkInDate }), ...(params.checkOutDate && { checkOutDate: params.checkOutDate }) }).toString();
      return amGet(`/v3/shopping/hotel-offers?${qs}`, token);
    },
    city_search: async (params, creds) => {
      if (!params.keyword) throw new Error('keyword required');
      const token = await getToken(creds.client_id, creds.client_secret);
      return amGet(`/v1/reference-data/locations/cities?keyword=${encodeURIComponent(params.keyword)}&max=${params.max || 10}`, token);
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
