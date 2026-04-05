// ─── LLM Client ─────────────────────────────────────────────
// OpenAI-compatible API client. Works with:
// - OpenAI API
// - Anthropic (via OpenAI compatibility)
// - Ollama (local, default: http://localhost:11434/v1)
// - LM Studio (local, default: http://localhost:1234/v1)
// - Any OpenAI-compatible endpoint

const https = require('https');
const http = require('http');

const DEFAULT_ENDPOINTS = {
  openai:   'https://api.openai.com/v1',
  ollama:   'http://localhost:11434/v1',
  lmstudio: 'http://localhost:1234/v1',
};

function sanitizeAssistantContent(content) {
  if (typeof content !== 'string') return content;

  let sanitized = content;

  // Strip chain-of-thought tags some local models emit into normal content.
  while (sanitized.includes('<think>') && sanitized.includes('</think>')) {
    sanitized = sanitized.replace(/<think>[\s\S]*<\/think>/g, '');
  }

  sanitized = sanitized
    .replace(/^\s*<think>[\s\S]*$/g, '')
    .replace(/^\s*:\s*/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return sanitized;
}

function normalizeChatResponse(data) {
  if (!data || !Array.isArray(data.choices)) {
    return data;
  }

  return {
    ...data,
    choices: data.choices.map((choice) => {
      if (!choice || !choice.message) {
        return choice;
      }

      return {
        ...choice,
        message: {
          ...choice.message,
          content: sanitizeAssistantContent(choice.message.content),
        },
      };
    }),
  };
}

function createClient(config = {}) {
  const {
    baseUrl = DEFAULT_ENDPOINTS.ollama,
    apiKey = '',
    defaultModel = 'llama3',
    timeout = 120000,
  } = config;

  async function chatCompletion({ messages, model, tools, temperature, maxTokens, stream }) {
    const body = {
      model: model || defaultModel,
      messages,
      temperature: temperature ?? 0.7,
    };

    if (maxTokens) body.max_tokens = maxTokens;
    if (tools && tools.length > 0) body.tools = tools;
    if (stream) body.stream = true;

    const parsed = new URL(`${baseUrl}/chat/completions`);
    const client = parsed.protocol === 'https:' ? https : http;

    const headers = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const payload = JSON.stringify(body);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('LLM request timed out')), timeout);

      const req = client.request(parsed, {
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(payload) },
      }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          clearTimeout(timer);
          const raw = Buffer.concat(chunks).toString('utf-8');

          if (res.statusCode >= 400) {
            reject(new Error(`LLM API error ${res.statusCode}: ${raw.slice(0, 500)}`));
            return;
          }

          try {
            const data = JSON.parse(raw);
            resolve(normalizeChatResponse(data));
          } catch (e) {
            reject(new Error(`Failed to parse LLM response: ${raw.slice(0, 200)}`));
          }
        });
      });

      req.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      req.write(payload);
      req.end();
    });
  }

  async function listModels() {
    const parsed = new URL(`${baseUrl}/models`);
    const client = parsed.protocol === 'https:' ? https : http;

    const headers = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Models list request timed out')), 10000);

      const req = client.request(parsed, { method: 'GET', headers }, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          clearTimeout(timer);
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            resolve(data.data || data.models || []);
          } catch (_) {
            resolve([]);
          }
        });
      });

      req.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      req.end();
    });
  }

  return { chatCompletion, listModels };
}

module.exports = { createClient, DEFAULT_ENDPOINTS };
