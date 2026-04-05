/**
 * Vector Store — LanceDB Wrapper
 *
 * Local vector database for RAG. Stores document chunks with embeddings
 * and provides similarity search. Uses LanceDB (Rust-based, columnar).
 *
 * Each knowledge base gets its own LanceDB table: `kb_{kbId}`
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let _db = null;
let _dbPath = null;

/**
 * Initialize LanceDB connection
 * @param {string} [dbPath] - Path to LanceDB directory
 * @returns {Promise<void>}
 */
async function init(dbPath) {
  if (_db) return;
  const lancedb = require('@lancedb/lancedb');

  _dbPath = dbPath || path.join(
    (app ? app.getPath('userData') : process.env.APPDATA || process.env.HOME),
    'dax',
    'vector_db',
  );

  // Ensure directory exists
  fs.mkdirSync(_dbPath, { recursive: true });

  _db = await lancedb.connect(_dbPath);
}

/**
 * Get or create a table for a knowledge base
 * @param {string} kbId - Knowledge base ID
 * @param {number} dimensions - Embedding dimensions
 * @returns {Promise<import('@lancedb/lancedb').Table>}
 */
async function getTable(kbId, dimensions = 768) {
  await init();
  const tableName = `kb_${kbId}`;
  const tables = await _db.tableNames();

  if (tables.includes(tableName)) {
    return _db.openTable(tableName);
  }

  // Create table with seed record (LanceDB requires data to infer schema)
  const seedVector = new Array(dimensions).fill(0);
  const table = await _db.createTable(tableName, [
    {
      id: '__seed__',
      text: '',
      vector: seedVector,
      doc_id: '',
      chunk_index: 0,
      metadata: '{}',
    },
  ]);

  // Remove seed record
  await table.delete("id = '__seed__'");
  return table;
}

/**
 * Add document chunks with embeddings to a knowledge base
 * @param {string} kbId - Knowledge base ID
 * @param {{ id: string, text: string, vector: number[], doc_id: string, chunk_index: number, metadata: object }[]} chunks
 * @returns {Promise<number>} Number of chunks added
 */
async function addDocuments(kbId, chunks, dimensions) {
  const table = await getTable(kbId, dimensions);
  const records = chunks.map((c) => ({
    id: c.id,
    text: c.text,
    vector: c.vector,
    doc_id: c.doc_id,
    chunk_index: c.chunk_index,
    metadata: typeof c.metadata === 'string' ? c.metadata : JSON.stringify(c.metadata || {}),
  }));

  await table.add(records);
  return records.length;
}

/**
 * Search for similar documents by vector
 * @param {string} kbId - Knowledge base ID
 * @param {number[]} queryVector - Query embedding vector
 * @param {number} [topK=5] - Number of results to return
 * @param {number} [dimensions] - Embedding dimensions
 * @returns {Promise<{ id: string, text: string, doc_id: string, chunk_index: number, metadata: object, _distance: number }[]>}
 */
async function search(kbId, queryVector, topK = 5, dimensions) {
  const table = await getTable(kbId, dimensions);
  const rowCount = await table.countRows();
  if (rowCount === 0) return [];

  const results = [];
  for await (const batch of table.search(queryVector).limit(topK)) {
    // batch is an Arrow RecordBatch, convert to plain objects
    const numRows = batch.numRows;
    for (let i = 0; i < numRows; i++) {
      const row = {};
      for (const field of batch.schema.fields) {
        const col = batch.getChild(field.name);
        if (col) {
          const val = col.get(i);
          row[field.name] = val;
        }
      }
      // Parse metadata back to object
      if (typeof row.metadata === 'string') {
        try { row.metadata = JSON.parse(row.metadata); } catch { /* keep as string */ }
      }
      results.push(row);
    }
  }

  return results;
}

/**
 * Delete all chunks for a specific document
 * @param {string} kbId - Knowledge base ID
 * @param {string} docId - Document ID to remove
 * @returns {Promise<void>}
 */
async function deleteDocument(kbId, docId, dimensions) {
  const table = await getTable(kbId, dimensions);
  await table.delete(`doc_id = '${docId.replace(/'/g, "''")}'`);
}

/**
 * Delete an entire knowledge base table
 * @param {string} kbId - Knowledge base ID
 * @returns {Promise<void>}
 */
async function deleteCollection(kbId) {
  await init();
  const tableName = `kb_${kbId}`;
  try {
    await _db.dropTable(tableName);
  } catch {
    // Table may not exist
  }
}

/**
 * List all knowledge base tables
 * @returns {Promise<string[]>} Array of knowledge base IDs
 */
async function listCollections() {
  await init();
  const tables = await _db.tableNames();
  return tables
    .filter((t) => t.startsWith('kb_'))
    .map((t) => t.slice(3));
}

/**
 * Get row count for a knowledge base
 * @param {string} kbId - Knowledge base ID
 * @returns {Promise<number>}
 */
async function countChunks(kbId, dimensions) {
  const table = await getTable(kbId, dimensions);
  return table.countRows();
}

/**
 * Create vector index for faster search (recommended for 10K+ rows)
 * @param {string} kbId - Knowledge base ID
 * @returns {Promise<void>}
 */
async function createIndex(kbId, dimensions) {
  const table = await getTable(kbId, dimensions);
  const rowCount = await table.countRows();
  if (rowCount >= 256) {
    await table.createIndex('vector');
  }
}

/**
 * Close the database connection
 */
async function close() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

module.exports = {
  init,
  addDocuments,
  search,
  deleteDocument,
  deleteCollection,
  listCollections,
  countChunks,
  createIndex,
  close,
};
