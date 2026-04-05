/**
 * Document Parser
 *
 * Extracts text from various file formats for RAG ingestion.
 * Supported: PDF, DOCX, TXT, MD, CSV, JSON, HTML
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Parse a file and extract its text content
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<{ text: string, metadata: object }>}
 */
async function parseFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const stat = fs.statSync(filePath);
  const metadata = {
    filename: path.basename(filePath),
    filepath: filePath,
    extension: ext,
    size_bytes: stat.size,
    modified_at: stat.mtime.toISOString(),
  };

  let text;

  switch (ext) {
    case '.pdf':
      text = await parsePDF(filePath);
      break;
    case '.docx':
      text = await parseDOCX(filePath);
      break;
    case '.txt':
    case '.md':
    case '.markdown':
      text = fs.readFileSync(filePath, 'utf-8');
      break;
    case '.csv':
      text = parseCSV(filePath);
      break;
    case '.json':
      text = parseJSON(filePath);
      break;
    case '.html':
    case '.htm':
      text = parseHTML(filePath);
      break;
    default:
      // Try as plain text
      text = fs.readFileSync(filePath, 'utf-8');
      break;
  }

  metadata.char_count = text.length;
  metadata.word_count = text.split(/\s+/).filter(Boolean).length;

  return { text, metadata };
}

/**
 * Parse raw text content (no file I/O)
 * @param {string} text - Raw text content
 * @param {object} [metadata={}] - Optional metadata
 * @returns {{ text: string, metadata: object }}
 */
function parseText(text, metadata = {}) {
  return {
    text,
    metadata: {
      ...metadata,
      char_count: text.length,
      word_count: text.split(/\s+/).filter(Boolean).length,
    },
  };
}

// ─── Format-Specific Parsers ─────────────────────────────────

async function parsePDF(filePath) {
  try {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);
    return result.text || '';
  } catch (err) {
    throw new Error(`PDF parse failed: ${err.message}`);
  }
}

async function parseDOCX(filePath) {
  try {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  } catch (err) {
    throw new Error(`DOCX parse failed: ${err.message}`);
  }
}

function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  // Convert CSV to readable text: header: value format
  const lines = raw.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return raw;

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row = headers.map((h, j) => `${h}: ${values[j] || ''}`).join(', ');
    rows.push(`Row ${i}: ${row}`);
  }
  return `Headers: ${headers.join(', ')}\n\n${rows.join('\n')}`;
}

function parseJSON(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  try {
    const obj = JSON.parse(raw);
    return flattenJSON(obj);
  } catch {
    return raw;
  }
}

function flattenJSON(obj, prefix = '') {
  const lines = [];
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      if (typeof item === 'object' && item !== null) {
        lines.push(flattenJSON(item, `${prefix}[${i}]`));
      } else {
        lines.push(`${prefix}[${i}]: ${item}`);
      }
    });
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, val] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof val === 'object' && val !== null) {
        lines.push(flattenJSON(val, path));
      } else {
        lines.push(`${path}: ${val}`);
      }
    }
  } else {
    lines.push(`${prefix}: ${obj}`);
  }
  return lines.join('\n');
}

function parseHTML(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  // Strip HTML tags + decode basic entities
  return raw
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get list of supported file extensions
 * @returns {string[]}
 */
function getSupportedExtensions() {
  return ['.pdf', '.docx', '.txt', '.md', '.markdown', '.csv', '.json', '.html', '.htm'];
}

module.exports = {
  parseFile,
  parseText,
  getSupportedExtensions,
};
