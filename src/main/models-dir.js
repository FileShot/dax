'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_SUBDIR = 'models';

function getDefaultModelsDir(userData) {
  return path.join(userData, DEFAULT_SUBDIR);
}

/** Read models_dir from SQLite settings; falls back to {userData}/models. */
function readModelsDirSetting(dbGet, db, userData) {
  const row = dbGet(db, 'SELECT value FROM settings WHERE key = ?', ['models_dir']);
  if (!row?.value) return getDefaultModelsDir(userData);
  try {
    const parsed = JSON.parse(row.value);
    if (typeof parsed === 'string' && parsed.trim()) return path.resolve(parsed.trim());
  } catch {
    if (typeof row.value === 'string' && row.value.trim()) return path.resolve(row.value.trim());
  }
  return getDefaultModelsDir(userData);
}

/** Recursively find .gguf files (depth-limited). */
function scanGgufFiles(dir, maxDepth = 6) {
  const files = [];
  if (!dir || !fs.existsSync(dir)) return files;

  function walk(current, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.gguf')) {
        let stats;
        try {
          stats = fs.statSync(full);
        } catch {
          continue;
        }
        const baseName = entry.name.replace(/\.gguf$/i, '');
        files.push({
          name: baseName,
          filename: entry.name,
          path: full,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        });
      }
    }
  }

  walk(dir, 0);
  return files.sort((a, b) => new Date(b.modified) - new Date(a.modified));
}

function modelIdForPath(filePath) {
  return crypto.createHash('sha256').update(filePath).digest('hex').slice(0, 32);
}

const OLLAMA_DEFAULT_URL = 'http://localhost:11434/v1';

module.exports = {
  getDefaultModelsDir,
  readModelsDirSetting,
  scanGgufFiles,
  modelIdForPath,
  OLLAMA_DEFAULT_URL,
};
