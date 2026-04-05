// ─── Twilio Integration ─────────────────────────────────────
// SMS, voice calls, and WhatsApp messaging via Twilio REST API
// Requires: Account SID, Auth Token, and a Twilio phone number

const https = require('https');

function twilioApi(accountSid, authToken, endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const options = {
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${accountSid}${endpoint}.json`,
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(result.message || `Twilio API error ${res.statusCode}`));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(new Error(`Failed to parse Twilio response: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    if (body) {
      const encoded = new URLSearchParams(body).toString();
      req.setHeader('Content-Length', Buffer.byteLength(encoded));
      req.write(encoded);
    }
    req.end();
  });
}

module.exports = {
  id: 'twilio',
  name: 'Twilio',
  category: 'communication',
  icon: 'Phone',
  description: 'Send SMS, make calls, and message via WhatsApp through Twilio',
  configFields: [
    { key: 'account_sid', label: 'Account SID', type: 'text', required: true, placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
    { key: 'auth_token', label: 'Auth Token', type: 'password', required: true },
    { key: 'from_number', label: 'Twilio Phone Number', type: 'text', required: true, placeholder: '+1234567890' },
  ],

  async connect(creds) {
    // Verify credentials by fetching account info
    await twilioApi(creds.account_sid, creds.auth_token, '');
  },

  async test(creds) {
    try {
      const account = await twilioApi(creds.account_sid, creds.auth_token, '');
      return { success: true, message: `Connected to account: ${account.friendly_name} (${account.status})` };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  actions: {
    send_sms: async (params, creds) => {
      const { to, body: messageBody } = params;
      if (!to || !messageBody) throw new Error('Missing required: to, body');
      const result = await twilioApi(
        creds.account_sid,
        creds.auth_token,
        '/Messages',
        'POST',
        { To: to, From: creds.from_number, Body: messageBody }
      );
      return { sid: result.sid, status: result.status, to: result.to };
    },

    send_whatsapp: async (params, creds) => {
      const { to, body: messageBody } = params;
      if (!to || !messageBody) throw new Error('Missing required: to, body');
      const whatsappTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
      const whatsappFrom = `whatsapp:${creds.from_number}`;
      const result = await twilioApi(
        creds.account_sid,
        creds.auth_token,
        '/Messages',
        'POST',
        { To: whatsappTo, From: whatsappFrom, Body: messageBody }
      );
      return { sid: result.sid, status: result.status, to: result.to };
    },

    make_call: async (params, creds) => {
      const { to, twiml } = params;
      if (!to) throw new Error('Missing required: to');
      const callTwiml = twiml || '<Response><Say>This is a call from Dax AI agent.</Say></Response>';
      const result = await twilioApi(
        creds.account_sid,
        creds.auth_token,
        '/Calls',
        'POST',
        { To: to, From: creds.from_number, Twiml: callTwiml }
      );
      return { sid: result.sid, status: result.status, to: result.to };
    },

    list_messages: async (params, creds) => {
      const { limit } = params;
      const qs = limit ? `?PageSize=${Math.min(limit, 50)}` : '?PageSize=10';
      const result = await twilioApi(
        creds.account_sid,
        creds.auth_token,
        `/Messages${qs}`
      );
      return (result.messages || []).map((m) => ({
        sid: m.sid,
        from: m.from,
        to: m.to,
        body: m.body,
        status: m.status,
        date_sent: m.date_sent,
        direction: m.direction,
      }));
    },

    check_balance: async (_params, creds) => {
      const result = await twilioApi(
        creds.account_sid,
        creds.auth_token,
        '/Balance'
      );
      return { balance: result.balance, currency: result.currency };
    },

    get_message: async (params, creds) => {
      if (!params.message_sid) throw new Error('message_sid required');
      return twilioApi(creds.account_sid, creds.auth_token, `/Messages/${params.message_sid}`);
    },

    list_calls: async (params, creds) => {
      const qs = `?PageSize=${params.limit || 10}`;
      const result = await twilioApi(creds.account_sid, creds.auth_token, `/Calls${qs}`);
      return (result.calls || []).map((c) => ({ sid: c.sid, to: c.to, from: c.from, status: c.status, duration: c.duration, start_time: c.start_time }));
    },

    list_phone_numbers: async (_params, creds) => {
      const result = await twilioApi(creds.account_sid, creds.auth_token, '/IncomingPhoneNumbers');
      return (result.incoming_phone_numbers || []).map((n) => ({ sid: n.sid, phone_number: n.phone_number, friendly_name: n.friendly_name, capabilities: n.capabilities }));
    },

    cancel_message: async (params, creds) => {
      if (!params.message_sid) throw new Error('message_sid required');
      return twilioApi(creds.account_sid, creds.auth_token, `/Messages/${params.message_sid}`, 'POST', { Status: 'canceled' });
    },

    send_mms: async (params, creds) => {
      if (!params.to || !params.media_url) throw new Error('to and media_url required');
      const result = await twilioApi(creds.account_sid, creds.auth_token, '/Messages', 'POST', {
        To: params.to, From: creds.from_number, Body: params.body || '', MediaUrl: params.media_url,
      });
      return { sid: result.sid, status: result.status, to: result.to };
    },
  },
  async disconnect() { this.credentials = null; },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
