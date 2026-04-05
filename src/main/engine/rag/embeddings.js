/**
 * Ollama Embeddings Client
 *
 * Generates text embeddings using Ollama's local embedding models.
 * Default model: nomic-embed-text (768 dimensions)
 * Alternative: mxbai-embed-large (1024 dimensions)
 */

'use strict';

const http = require('http');

const OLLAMA_BASE = 'http://localhost:11434';
const DEFAULT_MODEL = 'nomic-embed-text';

/**
 * Generate embedding for a single text string
 * @param {string} text - Text to embed
 * @param {string} [model] - Ollama embedding model name
 * @returns {Promise<number[]>} Embedding vector
 */
async function embed(text, model = DEFAULT_MODEL) {
  const result = await ollamaRequest('/api/embed', { model, input: text });
  if (!result.embeddings || !result.embeddings[0]) {
    throw new Error(`Embedding failed: ${JSON.stringify(result)}`);
  }
  return result.embeddings[0];
}

/**
 * Generate embeddings for multiple texts in a single batch
 * @param {string[]} texts - Array of texts to embed
 * @param {string} [model] - Ollama embedding model name
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
async function embedBatch(texts, model = DEFAULT_MODEL) {
  if (!texts.length) return [];

  // Ollama /api/embed supports array input
  const result = await ollamaRequest('/api/embed', { model, input: texts });
  if (!result.embeddings || result.embeddings.length !== texts.length) {
    throw new Error(`Batch embedding failed: expected ${texts.length} embeddings, got ${result.embeddings?.length || 0}`);
  }
  return result.embeddings;
}

/**
 * Get the dimensionality of embeddings for a given model
 * @param {string} [model] - Ollama embedding model name
 * @returns {Promise<number>} Dimension count
 */
async function getDimensions(model = DEFAULT_MODEL) {
  const vec = await embed('test', model);
  return vec.length;
}

/**
 * Check if the embedding model is available in Ollama
 * @param {string} [model] - Ollama embedding model name
 * @returns {Promise<boolean>}
 */
async function isModelAvailable(model = DEFAULT_MODEL) {
  try {
    const result = await ollamaRequest('/api/show', { name: model });
    return !!result.modelfile;
  } catch {
    return false;
  }
}

/**
 * Pull an embedding model if not already available
 * @param {string} [model] - Ollama embedding model name
 * @returns {Promise<void>}
 */
async function pullModel(model = DEFAULT_MODEL) {
  await ollamaRequest('/api/pull', { name: model, stream: false });
}

// ─── Internal ────────────────────────────────────────────────

function ollamaRequest(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, OLLAMA_BASE);
    const opts = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON from Ollama: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', (err) => reject(new Error(`Ollama connection failed: ${err.message}`)));
    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('Ollama embedding request timed out (120s)'));
    });
    req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  embed,
  embedBatch,
  getDimensions,
  isModelAvailable,
  pullModel,
  DEFAULT_MODEL,
};
