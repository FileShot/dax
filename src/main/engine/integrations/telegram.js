// ─── Telegram Integration ───────────────────────────────────
// Uses Telegram Bot API
// Requires: Bot Token from @BotFather

const https = require('https');

function telegramApi(method, token, params = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(params);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try {
          const result = JSON.parse(chunks);
          if (!result.ok) reject(new Error(result.description || 'Telegram API error'));
          else resolve(result.result);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

module.exports = {
  id: 'telegram',
  name: 'Telegram',
  category: 'communication',
  icon: 'Send',
  description: 'Send messages, manage groups, and interact with Telegram bots',
  configFields: [
    { key: 'bot_token', label: 'Bot Token (from @BotFather)', type: 'password', required: true },
    { key: 'default_chat_id', label: 'Default Chat ID', type: 'text', placeholder: '-100123456789 or user ID' },
  ],

  credentials: null,
  connected: false,

  async connect(creds) {
    await telegramApi('getMe', creds.bot_token);
    this.credentials = creds;
    this.connected = true;
  },

  async disconnect() {
    this.connected = false;
    this.credentials = null;
  },

  async test(creds) {
    try {
      const bot = await telegramApi('getMe', creds.bot_token);
      return { success: true, message: `Connected as @${bot.username} (${bot.first_name})` };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  actions: {
    send_message: async (params, creds) => {
      const chatId = params.chat_id || creds.default_chat_id;
      if (!chatId) throw new Error('chat_id required');
      const result = await telegramApi('sendMessage', creds.bot_token, {
        chat_id: chatId,
        text: params.text,
        parse_mode: params.parse_mode || 'HTML',
        disable_web_page_preview: params.disable_preview,
      });
      return { message_id: result.message_id, chat_id: result.chat.id, date: result.date };
    },

    get_updates: async (params, creds) => {
      const result = await telegramApi('getUpdates', creds.bot_token, {
        offset: params.offset,
        limit: params.limit || 10,
        timeout: 0,
      });
      return result.map((u) => ({
        update_id: u.update_id,
        type: u.message ? 'message' : u.callback_query ? 'callback' : 'other',
        message: u.message ? {
          id: u.message.message_id,
          text: u.message.text,
          from: u.message.from?.username,
          chat_id: u.message.chat?.id,
          date: u.message.date,
        } : null,
      }));
    },

    get_chat: async (params, creds) => {
      const chatId = params.chat_id || creds.default_chat_id;
      const chat = await telegramApi('getChat', creds.bot_token, { chat_id: chatId });
      return {
        id: chat.id,
        type: chat.type,
        title: chat.title,
        username: chat.username,
        members_count: chat.members_count,
        description: chat.description,
      };
    },

    send_document: async (params, creds) => {
      const chatId = params.chat_id || creds.default_chat_id;
      if (!chatId) throw new Error('chat_id required');
      // For URL-based documents
      const result = await telegramApi('sendDocument', creds.bot_token, {
        chat_id: chatId,
        document: params.url,
        caption: params.caption,
      });
      return { message_id: result.message_id };
    },

    set_webhook: async (params, creds) => {
      const result = await telegramApi('setWebhook', creds.bot_token, {
        url: params.url,
        allowed_updates: params.allowed_updates || ['message'],
      });
      return { success: result };
    },

    delete_webhook: async (_params, creds) => {
      const result = await telegramApi('deleteWebhook', creds.bot_token);
      return { success: result };
    },
  },

  async executeAction(actionName, params) {
    const action = this.actions[actionName];
    if (!action) throw new Error(`Unknown action: ${actionName}`);
    return action(params, this.credentials);
  },
};
