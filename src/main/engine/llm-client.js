// ─── LLM Client ─────────────────────────────────────────────
// OpenAI-compatible API client. Works with:
// - OpenAI API
// - Anthropic (via OpenAI compatibility)
// - Ollama (local, default: http://localhost:11434/v1)
// - LM Studio (local, default: http://localhost:1234/v1)
// - Any OpenAI-compatible endpoint

const https = require('https');
const http = require('http');

// Keep-alive agents — reuse TCP connections across LLM calls
const _httpAgent = new http.Agent({ keepAlive: true, maxSockets: 4 });
const _httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 4 });

const DEFAULT_ENDPOINTS = {
  openai:   'https://api.openai.com/v1',
  ollama:   'http://localhost:11434/v1',
  lmstudio: 'http://localhost:1234/v1',
};

function sanitizeAssistantContent(content, { stripThinking = false } = {}) {
  if (typeof content !== 'string') return content;

  let sanitized = content;

  // Only strip chain-of-thought tags when explicitly requested
  if (stripThinking) {
    while (sanitized.includes('<think>') && sanitized.includes('</think>')) {
      sanitized = sanitized.replace(/<think>[\s\S]*<\/think>/g, '');
    }
    sanitized = sanitized.replace(/^\s*<think>[\s\S]*$/g, '');
  }

  sanitized = sanitized
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
    defaultModel = '',
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
        agent: parsed.protocol === 'https:' ? _httpsAgent : _httpAgent,
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

      const req = client.request(parsed, { method: 'GET', headers, agent: parsed.protocol === 'https:' ? _httpsAgent : _httpAgent }, (res) => {
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

  // Streaming variant: calls onToken(token) for each text chunk, resolves { content, usage }.
  async function chatCompletionStream({ messages, model, tools, temperature, maxTokens, onToken }) {
    const body = {
      model: model || defaultModel,
      messages,
      temperature: temperature ?? 0.7,
      stream: true,
    };

    if (maxTokens) body.max_tokens = maxTokens;
    if (tools && tools.length > 0) body.tools = tools;

    const parsed = new URL(`${baseUrl}/chat/completions`);
    const client = parsed.protocol === 'https:' ? https : http;

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const payload = JSON.stringify(body);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('LLM stream timed out')), timeout);
      let fullContent = '';
      let usage = null;
      let buffer = '';

      const req = client.request(parsed, {
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(payload) },
        agent: parsed.protocol === 'https:' ? _httpsAgent : _httpAgent,
      }, (res) => {
        if (res.statusCode >= 400) {
          const errChunks = [];
          res.on('data', (c) => errChunks.push(c));
          res.on('end', () => {
            clearTimeout(timer);
            reject(new Error(`LLM API error ${res.statusCode}: ${Buffer.concat(errChunks).toString('utf-8').slice(0, 500)}`));
          });
          return;
        }

        res.on('data', (chunk) => {
          buffer += chunk.toString('utf-8');
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete last line
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed2 = JSON.parse(data);
              if (parsed2.usage) usage = parsed2.usage;
              const delta = parsed2.choices?.[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                if (onToken) onToken(delta);
              }
            } catch (_) {}
          }
        });

        res.on('end', () => {
          clearTimeout(timer);
          resolve({ content: sanitizeAssistantContent(fullContent), usage });
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

  return { chatCompletion, chatCompletionStream, listModels };
}

module.exports = { createClient, DEFAULT_ENDPOINTS };
