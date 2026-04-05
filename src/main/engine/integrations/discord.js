// ─── Discord Integration ────────────────────────────────────
// Uses Discord Bot Token with REST API

const https = require('https');

function discordApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'discord.com',
      path: `/api/v10${path}`,
      method,
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try {
          const result = chunks ? JSON.parse(chunks) : {};
          if (res.statusCode >= 400) {
            reject(new Error(result.message || `Discord error ${res.statusCode}`));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  id: 'discord',
  name: 'Discord',
  category: 'communication',
  icon: 'MessageCircle',
  description: 'Send messages and interact with Discord servers via bot',
  configFields: [
    { key: 'bot_token', label: 'Bot Token', type: 'password', required: true },
    { key: 'default_channel_id', label: 'Default Channel ID', type: 'text', placeholder: '123456789012345678' },
  ],

  async connect(creds) {
    await discordApi('GET', '/users/@me', creds.bot_token);
  },

  async test(creds) {
    try {
      const user = await discordApi('GET', '/users/@me', creds.bot_token);
      return { success: true, message: `Connected as ${user.username}#${user.discriminator}` };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  actions: {
    send_message: async (params, creds) => {
      const channelId = params.channel_id || creds.default_channel_id;
      if (!channelId) throw new Error('channel_id required');
      const result = await discordApi('POST', `/channels/${channelId}/messages`, creds.bot_token, {
        content: params.content,
        embeds: params.embeds,
      });
      return { id: result.id, channel_id: result.channel_id };
    },

    list_guilds: async (_params, creds) => {
      const guilds = await discordApi('GET', '/users/@me/guilds', creds.bot_token);
      return guilds.map((g) => ({ id: g.id, name: g.name, icon: g.icon }));
    },

    list_channels: async (params, creds) => {
      if (!params.guild_id) throw new Error('guild_id required');
      const channels = await discordApi('GET', `/guilds/${params.guild_id}/channels`, creds.bot_token);
      return channels
        .filter((c) => c.type === 0) // text channels only
        .map((c) => ({ id: c.id, name: c.name, topic: c.topic }));
    },

    read_messages: async (params, creds) => {
      const channelId = params.channel_id || creds.default_channel_id;
      if (!channelId) throw new Error('channel_id required');
      const messages = await discordApi('GET', `/channels/${channelId}/messages?limit=${params.limit || 10}`, creds.bot_token);
      return messages.map((m) => ({
        id: m.id,
        content: m.content,
        author: m.author?.username,
        timestamp: m.timestamp,
      }));
    },

    create_thread: async (params, creds) => {
      const channelId = params.channel_id || creds.default_channel_id;
      if (!channelId) throw new Error('channel_id required');
      const result = await discordApi('POST', `/channels/${channelId}/threads`, creds.bot_token, {
        name: params.name,
        auto_archive_duration: params.archive_duration || 1440,
        type: 11, // public thread
      });
      return { id: result.id, name: result.name };
    },

    edit_message: async (params, creds) => {
      const channelId = params.channel_id || creds.default_channel_id;
      if (!channelId || !params.message_id) throw new Error('channel_id and message_id required');
      const result = await discordApi('PATCH', `/channels/${channelId}/messages/${params.message_id}`, creds.bot_token, { content: params.content });
      return { id: result.id, content: result.content };
    },

    delete_message: async (params, creds) => {
      const channelId = params.channel_id || creds.default_channel_id;
      if (!channelId || !params.message_id) throw new Error('channel_id and message_id required');
      await discordApi('DELETE', `/channels/${channelId}/messages/${params.message_id}`, creds.bot_token);
      return { success: true };
    },

    create_channel: async (params, creds) => {
      if (!params.guild_id || !params.name) throw new Error('guild_id and name required');
      const result = await discordApi('POST', `/guilds/${params.guild_id}/channels`, creds.bot_token, {
        name: params.name, type: params.type || 0, topic: params.topic || '',
      });
      return { id: result.id, name: result.name, type: result.type };
    },

    list_members: async (params, creds) => {
      if (!params.guild_id) throw new Error('guild_id required');
      const members = await discordApi('GET', `/guilds/${params.guild_id}/members?limit=${params.limit || 50}`, creds.bot_token);
      return members.map((m) => ({ id: m.user?.id, username: m.user?.username, nick: m.nick, roles: m.roles, joined_at: m.joined_at }));
    },

    add_reaction: async (params, creds) => {
      const channelId = params.channel_id || creds.default_channel_id;
      if (!channelId || !params.message_id || !params.emoji) throw new Error('channel_id, message_id, and emoji required');
      await discordApi('PUT', `/channels/${channelId}/messages/${params.message_id}/reactions/${encodeURIComponent(params.emoji)}/@me`, creds.bot_token);
      return { success: true };
    },
  },
  async disconnect() { this.credentials = null; },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
