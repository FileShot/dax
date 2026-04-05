// ─── Slack Integration ──────────────────────────────────────
// Uses Slack Web API with Bot Token (xoxb-)
// Requires: Bot Token OAuth scope

const https = require('https');

function slackApi(method, token, body = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: 'slack.com',
      path: `/api/${method}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try {
          const result = JSON.parse(chunks);
          if (!result.ok) reject(new Error(result.error || 'Slack API error'));
          else resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = {
  id: 'slack',
  name: 'Slack',
  category: 'communication',
  icon: 'MessageSquare',
  description: 'Send messages, read channels, and interact with Slack workspaces',
  configFields: [
    { key: 'bot_token', label: 'Bot Token (xoxb-...)', type: 'password', required: true },
    { key: 'default_channel', label: 'Default Channel ID', type: 'text', placeholder: 'C0123456789' },
  ],

  async connect(creds) {
    // Verify token
    await slackApi('auth.test', creds.bot_token);
  },

  async test(creds) {
    try {
      const result = await slackApi('auth.test', creds.bot_token);
      return { success: true, message: `Connected as ${result.user} in ${result.team}` };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  actions: {
    send_message: async (params, creds) => {
      const { channel, text, blocks } = params;
      const result = await slackApi('chat.postMessage', creds.bot_token, {
        channel: channel || creds.default_channel,
        text,
        blocks,
      });
      return { ts: result.ts, channel: result.channel };
    },

    list_channels: async (_params, creds) => {
      const result = await slackApi('conversations.list', creds.bot_token, {
        types: 'public_channel,private_channel',
        limit: 100,
      });
      return (result.channels || []).map((c) => ({
        id: c.id,
        name: c.name,
        is_private: c.is_private,
        num_members: c.num_members,
      }));
    },

    read_messages: async (params, creds) => {
      const { channel, limit } = params;
      const result = await slackApi('conversations.history', creds.bot_token, {
        channel: channel || creds.default_channel,
        limit: limit || 10,
      });
      return (result.messages || []).map((m) => ({
        text: m.text,
        user: m.user,
        ts: m.ts,
        type: m.type,
      }));
    },

    add_reaction: async (params, creds) => {
      const { channel, timestamp, emoji } = params;
      await slackApi('reactions.add', creds.bot_token, {
        channel,
        timestamp,
        name: emoji,
      });
      return { success: true };
    },

    set_topic: async (params, creds) => {
      const { channel, topic } = params;
      await slackApi('conversations.setTopic', creds.bot_token, {
        channel: channel || creds.default_channel,
        topic,
      });
      return { success: true };
    },

    update_message: async (params, creds) => {
      const { channel, ts, text } = params;
      if (!channel || !ts || !text) throw new Error('channel, ts, and text required');
      const result = await slackApi('chat.update', creds.bot_token, { channel, ts, text });
      return { ts: result.ts, channel: result.channel };
    },

    delete_message: async (params, creds) => {
      const { channel, ts } = params;
      if (!channel || !ts) throw new Error('channel and ts required');
      await slackApi('chat.delete', creds.bot_token, { channel, ts });
      return { success: true };
    },

    create_channel: async (params, creds) => {
      if (!params.name) throw new Error('Channel name required');
      const result = await slackApi('conversations.create', creds.bot_token, {
        name: params.name, is_private: params.is_private || false,
      });
      return { id: result.channel?.id, name: result.channel?.name, is_private: result.channel?.is_private };
    },

    invite_to_channel: async (params, creds) => {
      const { channel, users } = params;
      if (!channel || !users) throw new Error('channel and users required');
      const result = await slackApi('conversations.invite', creds.bot_token, {
        channel, users: Array.isArray(users) ? users.join(',') : users,
      });
      return { id: result.channel?.id, name: result.channel?.name };
    },

    list_users: async (params, creds) => {
      const result = await slackApi('users.list', creds.bot_token, { limit: params.limit || 50 });
      return (result.members || []).filter(u => !u.is_bot && !u.deleted).map((u) => ({
        id: u.id, name: u.name, real_name: u.real_name, email: u.profile?.email, is_admin: u.is_admin,
      }));
    },

    get_user: async (params, creds) => {
      if (!params.user_id) throw new Error('user_id required');
      const result = await slackApi('users.info', creds.bot_token, { user: params.user_id });
      const u = result.user;
      return { id: u.id, name: u.name, real_name: u.real_name, email: u.profile?.email, title: u.profile?.title, is_admin: u.is_admin };
    },

    pin_message: async (params, creds) => {
      const { channel, ts } = params;
      if (!channel || !ts) throw new Error('channel and ts required');
      await slackApi('pins.add', creds.bot_token, { channel, timestamp: ts });
      return { success: true };
    },

    list_pins: async (params, creds) => {
      const channel = params.channel || creds.default_channel;
      const result = await slackApi('pins.list', creds.bot_token, { channel });
      return (result.items || []).map((item) => ({
        type: item.type, ts: item.message?.ts, text: item.message?.text, user: item.message?.user,
      }));
    },
  },
  async disconnect() { this.credentials = null; },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
