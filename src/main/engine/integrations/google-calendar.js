// ─── Google Calendar Integration ────────────────────────────
// Uses Google Calendar API v3 with API Key (read-only) or OAuth 2.0 (full access).

const https = require('https');

function calendarApi(method, path, creds, body = null) {
  return new Promise((resolve, reject) => {
    const apiKey      = typeof creds === 'string' ? creds : (creds?.api_key || null);
    const accessToken = typeof creds === 'object' ? (creds?.access_token || null) : null;

    const headers = { 'Content-Type': 'application/json' };
    let fullPath;
    if (accessToken) {
      fullPath = `/calendar/v3${path}`;
      headers['Authorization'] = `Bearer ${accessToken}`;
    } else if (apiKey) {
      const sep = path.includes('?') ? '&' : '?';
      fullPath = `/calendar/v3${path}${sep}key=${apiKey}`;
    } else {
      return reject(new Error('Google Calendar: api_key or access_token required'));
    }

    const data = body ? JSON.stringify(body) : null;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const req = https.request({
      hostname: 'www.googleapis.com',
      path: fullPath,
      method,
      headers,
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try {
          const result = JSON.parse(chunks);
          if (result.error) reject(new Error(result.error.message || `Calendar API ${res.statusCode}`));
          else resolve(result);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

module.exports = {
  id: 'google-calendar',
  name: 'Google Calendar',
  category: 'productivity',
  icon: 'Calendar',
  description: 'Read and manage Google Calendar events, get availability, and create meetings',
  configFields: [
    { key: 'api_key', label: 'API Key', type: 'password', required: false, placeholder: 'AIza... (read-only)' },
    { key: 'access_token', label: 'OAuth Access Token', type: 'password', required: false, placeholder: 'Provided automatically via OAuth flow (full access)' },
    { key: 'calendar_id', label: 'Calendar ID', type: 'text', placeholder: 'primary or email@gmail.com' },
  ],

  credentials: null,
  connected: false,

  async connect(creds) {
    if (!creds.api_key && !creds.access_token) throw new Error('api_key or access_token required');
    await calendarApi('GET', `/calendars/${encodeURIComponent(creds.calendar_id || 'primary')}`, creds);
    this.credentials = creds;
    this.connected = true;
  },

  async disconnect() {
    this.connected = false;
    this.credentials = null;
  },

  async test(creds) {
    try {
      const cal = await calendarApi('GET', `/calendars/${encodeURIComponent(creds.calendar_id || 'primary')}`, creds);
      return { success: true, message: `Connected to calendar: ${cal.summary}` };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  actions: {
    list_events: async (params, creds) => {
      const calId = encodeURIComponent(params.calendar_id || creds.calendar_id || 'primary');
      const now = new Date().toISOString();
      const timeMin = params.time_min || now;
      const timeMax = params.time_max || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const maxResults = params.limit || 20;
      const result = await calendarApi('GET',
        `/calendars/${calId}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`,
        creds
      );
      return (result.items || []).map((e) => ({
        id: e.id, summary: e.summary, description: e.description,
        start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date,
        location: e.location, status: e.status, attendees: e.attendees?.map((a) => a.email),
      }));
    },

    get_event: async (params, creds) => {
      if (!params.event_id) throw new Error('event_id required');
      const calId = encodeURIComponent(params.calendar_id || creds.calendar_id || 'primary');
      const event = await calendarApi('GET', `/calendars/${calId}/events/${params.event_id}`, creds);
      return {
        id: event.id, summary: event.summary, description: event.description,
        start: event.start?.dateTime || event.start?.date, end: event.end?.dateTime || event.end?.date,
        location: event.location, status: event.status, attendees: event.attendees?.map((a) => ({ email: a.email, status: a.responseStatus })),
      };
    },

    create_event: async (params, creds) => {
      if (!params.summary || !params.start) throw new Error('summary and start required');
      const calId = encodeURIComponent(params.calendar_id || creds.calendar_id || 'primary');
      const body = {
        summary: params.summary,
        description: params.description,
        location: params.location,
        start: params.all_day ? { date: params.start } : { dateTime: params.start, timeZone: params.timezone || 'UTC' },
        end: params.all_day ? { date: params.end || params.start } : { dateTime: params.end || params.start, timeZone: params.timezone || 'UTC' },
      };
      if (params.attendees) body.attendees = params.attendees.map((e) => ({ email: e }));
      return calendarApi('POST', `/calendars/${calId}/events`, creds, body);
    },

    update_event: async (params, creds) => {
      if (!params.event_id) throw new Error('event_id required');
      const calId = encodeURIComponent(params.calendar_id || creds.calendar_id || 'primary');
      const updates = {};
      if (params.summary) updates.summary = params.summary;
      if (params.description !== undefined) updates.description = params.description;
      if (params.location !== undefined) updates.location = params.location;
      if (params.start) updates.start = { dateTime: params.start, timeZone: params.timezone || 'UTC' };
      if (params.end) updates.end = { dateTime: params.end, timeZone: params.timezone || 'UTC' };
      return calendarApi('PATCH', `/calendars/${calId}/events/${params.event_id}`, creds, updates);
    },

    delete_event: async (params, creds) => {
      if (!params.event_id) throw new Error('event_id required');
      const calId = encodeURIComponent(params.calendar_id || creds.calendar_id || 'primary');
      return calendarApi('DELETE', `/calendars/${calId}/events/${params.event_id}`, creds);
    },

    search_events: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const calId = encodeURIComponent(params.calendar_id || creds.calendar_id || 'primary');
      const result = await calendarApi('GET',
        `/calendars/${calId}/events?q=${encodeURIComponent(params.query)}&maxResults=${params.limit || 20}&singleEvents=true&orderBy=startTime`,
        creds
      );
      return (result.items || []).map((e) => ({ id: e.id, summary: e.summary, start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date }));
    },

    list_calendars: async (_params, creds) => {
      const result = await calendarApi('GET', '/users/me/calendarList', creds);
      return (result.items || []).map((c) => ({ id: c.id, summary: c.summary, description: c.description, primary: c.primary, access_role: c.accessRole }));
    },

    get_calendar: async (params, creds) => {
      const calId = encodeURIComponent(params.calendar_id || creds.calendar_id || 'primary');
      return calendarApi('GET', `/calendars/${calId}`, creds);
    },

    busy_check: async (params, creds) => {
      const calId = params.calendar_id || creds.calendar_id || 'primary';
      const now = new Date().toISOString();
      const timeMin = params.time_min || now;
      const timeMax = params.time_max || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const result = await calendarApi('POST', `/freeBusy`, creds, {
        timeMin,
        timeMax,
        timeZone: params.timezone || 'UTC',
        items: [{ id: calId }],
      });
      const busy = result.calendars?.[calId]?.busy || [];
      return { busy: busy.length > 0, busy_slots: busy, calendar_id: calId };
    },

    get_freebusy: async (params, creds) => {
      if (!params.time_min || !params.time_max) throw new Error('time_min and time_max required');
      const calendars = params.calendar_ids || [params.calendar_id || creds.calendar_id || 'primary'];
      const result = await calendarApi('POST', `/freeBusy`, creds, {
        timeMin: params.time_min,
        timeMax: params.time_max,
        timeZone: params.timezone || 'UTC',
        items: calendars.map((id) => ({ id })),
      });
      return result.calendars || {};
    },

    quick_add: async (params, creds) => {
      if (!params.text) throw new Error('text required (e.g. "Meeting with John tomorrow at 3pm")');
      const calId = encodeURIComponent(params.calendar_id || creds.calendar_id || 'primary');
      return calendarApi('POST', `/calendars/${calId}/events/quickAdd?text=${encodeURIComponent(params.text)}`, creds);
    },

    list_recurring_instances: async (params, creds) => {
      if (!params.event_id) throw new Error('event_id required');
      const calId = encodeURIComponent(params.calendar_id || creds.calendar_id || 'primary');
      const result = await calendarApi('GET', `/calendars/${calId}/events/${params.event_id}/instances?maxResults=${params.limit || 10}`, creds);
      return (result.items || []).map((e) => ({ id: e.id, start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date, status: e.status }));
    },
  },

  async executeAction(actionName, params) {
    const action = this.actions[actionName];
    if (!action) throw new Error(`Unknown action: ${actionName}`);
    return action(params, this.credentials);
  },
};
