/**
 * Knowledge Base — High-Level RAG API
 *
 * Orchestrates document parsing, chunking, embedding, and vector storage
 * into a unified knowledge base management layer.
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const vectorStore = require('./vector-store');
const embeddings = require('./embeddings');
const chunker = require('./chunker');
const documentParser = require('./document-parser');

const DEFAULT_CHUNK_SIZE = 512;
const DEFAULT_OVERLAP = 50;
const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text';

/**
 * Ingest a file into a knowledge base
 * @param {object} params
 * @param {string} params.kbId - Knowledge base ID
 * @param {string} params.filePath - Path to file to ingest
 * @param {string} [params.model] - Embedding model
 * @param {number} [params.chunkSize] - Chunk size in tokens
 * @param {number} [params.overlap] - Overlap in tokens
 * @param {Function} [params.onProgress] - Progress callback (chunksProcessed, totalChunks)
 * @returns {Promise<{ doc_id: string, chunks: number, filename: string }>}
 */
async function ingestFile({ kbId, filePath, model, chunkSize, overlap, onProgress }) {
  model = model || DEFAULT_EMBEDDING_MODEL;
  chunkSize = chunkSize || DEFAULT_CHUNK_SIZE;
  overlap = overlap || DEFAULT_OVERLAP;

  // Parse document
  const { text, metadata } = await documentParser.parseFile(filePath);
  if (!text.trim()) {
    throw new Error(`No text content extracted from ${path.basename(filePath)}`);
  }

  const docId = uuidv4();

  // Chunk the text
  const chunks = chunker.splitRecursive(text, chunkSize, overlap);
  if (chunks.length === 0) {
    throw new Error('Text produced no chunks');
  }

  // Get embedding dimensions
  const dimensions = await embeddings.getDimensions(model);

  // Embed in batches of 32
  const BATCH_SIZE = 32;
  const records = [];
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.text);
    const vectors = await embeddings.embedBatch(texts, model);

    for (let j = 0; j < batch.length; j++) {
      records.push({
        id: `${docId}_${batch[j].index}`,
        text: batch[j].text,
        vector: vectors[j],
        doc_id: docId,
        chunk_index: batch[j].index,
        metadata: { ...metadata, chunk_of: chunks.length },
      });
    }

    if (onProgress) {
      onProgress(Math.min(i + BATCH_SIZE, chunks.length), chunks.length);
    }
  }

  // Store in vector DB
  await vectorStore.addDocuments(kbId, records, dimensions);

  // Create index if we have enough data
  try {
    await vectorStore.createIndex(kbId, dimensions);
  } catch {
    // Index creation may fail if not enough rows — that's fine
  }

  return { doc_id: docId, chunks: records.length, filename: metadata.filename };
}

/**
 * Ingest raw text into a knowledge base
 * @param {object} params
 * @param {string} params.kbId - Knowledge base ID
 * @param {string} params.text - Text to ingest
 * @param {object} [params.metadata] - Optional metadata
 * @param {string} [params.model] - Embedding model
 * @param {number} [params.chunkSize] - Chunk size in tokens
 * @param {number} [params.overlap] - Overlap in tokens
 * @returns {Promise<{ doc_id: string, chunks: number }>}
 */
async function ingestText({ kbId, text, metadata, model, chunkSize, overlap }) {
  model = model || DEFAULT_EMBEDDING_MODEL;
  chunkSize = chunkSize || DEFAULT_CHUNK_SIZE;
  overlap = overlap || DEFAULT_OVERLAP;

  if (!text.trim()) throw new Error('Cannot ingest empty text');

  const docId = uuidv4();
  const parsed = documentParser.parseText(text, metadata || {});
  const chunks = chunker.splitRecursive(parsed.text, chunkSize, overlap);
  const dimensions = await embeddings.getDimensions(model);

  const BATCH_SIZE = 32;
  const records = [];
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.text);
    const vectors = await embeddings.embedBatch(texts, model);

    for (let j = 0; j < batch.length; j++) {
      records.push({
        id: `${docId}_${batch[j].index}`,
        text: batch[j].text,
        vector: vectors[j],
        doc_id: docId,
        chunk_index: batch[j].index,
        metadata: { ...parsed.metadata, chunk_of: chunks.length },
      });
    }
  }

  await vectorStore.addDocuments(kbId, records, dimensions);
  return { doc_id: docId, chunks: records.length };
}

/**
 * Query a knowledge base — find relevant chunks
 * @param {object} params
 * @param {string} params.kbId - Knowledge base ID
 * @param {string} params.question - Natural language query
 * @param {number} [params.topK=5] - Number of results
 * @param {string} [params.model] - Embedding model
 * @returns {Promise<{ chunks: { text: string, doc_id: string, chunk_index: number, metadata: object, score: number }[], query: string }>}
 */
async function query({ kbId, question, topK, model }) {
  model = model || DEFAULT_EMBEDDING_MODEL;
  topK = topK || 5;

  if (!question.trim()) throw new Error('Query cannot be empty');

  // Embed the question
  const queryVector = await embeddings.embed(question, model);
  const dimensions = queryVector.length;

  // Search vector store
  const results = await vectorStore.search(kbId, queryVector, topK, dimensions);

  return {
    chunks: results.map((r) => ({
      text: r.text,
      doc_id: r.doc_id,
      chunk_index: r.chunk_index,
      metadata: r.metadata,
      score: r._distance != null ? 1 / (1 + r._distance) : 0,
    })),
    query: question,
  };
}

/**
 * Delete a specific document from a knowledge base
 * @param {string} kbId - Knowledge base ID
 * @param {string} docId - Document ID
 * @param {string} [model] - Embedding model (for dimensions)
 * @returns {Promise<void>}
 */
async function deleteDocument(kbId, docId, model) {
  const dimensions = await embeddings.getDimensions(model || DEFAULT_EMBEDDING_MODEL);
  await vectorStore.deleteDocument(kbId, docId, dimensions);
}

/**
 * Delete an entire knowledge base
 * @param {string} kbId - Knowledge base ID
 * @returns {Promise<void>}
 */
async function deleteKB(kbId) {
  await vectorStore.deleteCollection(kbId);
}

/**
 * List all knowledge bases (from vector store)
 * @returns {Promise<string[]>}
 */
async function listKBs() {
  return vectorStore.listCollections();
}

/**
 * Get chunk count for a knowledge base
 * @param {string} kbId
 * @param {string} [model]
 * @returns {Promise<number>}
 */
async function getChunkCount(kbId, model) {
  const dimensions = await embeddings.getDimensions(model || DEFAULT_EMBEDDING_MODEL);
  return vectorStore.countChunks(kbId, dimensions);
}

/**
 * Check if embedding model is available, pull if not
 * @param {string} [model]
 * @returns {Promise<{ available: boolean, model: string }>}
 */
async function ensureModel(model) {
  model = model || DEFAULT_EMBEDDING_MODEL;
  const available = await embeddings.isModelAvailable(model);
  if (!available) {
    await embeddings.pullModel(model);
  }
  return { available: true, model };
}

module.exports = {
  ingestFile,
  ingestText,
  query,
  deleteDocument,
  deleteKB,
  listKBs,
  getChunkCount,
  ensureModel,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_OVERLAP,
  DEFAULT_EMBEDDING_MODEL,
};
