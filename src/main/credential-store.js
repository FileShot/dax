/**
 * Credential Store for Dax
 * 
 * Encrypts integration credentials at rest using Electron's safeStorage API
 * (backed by OS keychain/DPAPI). Falls back to AES-256-GCM with a per-machine
 * derived key if safeStorage is unavailable (e.g. headless CI).
 *
 * Storage layout (userData/credentials/):
 *   {integrationId}.enc  — encrypted JSON blob
 *
 * Stored per-integration record:
 *   {
 *     integrationId: string,
 *     providerId: string | null,   // OAuth provider, or null for API-key based
 *     credentials: object,          // the creds passed to integration.connect()
 *     oauthMeta: {                  // only present for OAuth connections
 *       clientId: string,
 *       clientSecret: string | null,
 *       refreshToken: string | null,
 *       expiresAt: number | null,   // ms timestamp
 *       redirectUri: string,
 *     } | null,
 *     connectedAt: string,          // ISO timestamp
 *   }
 */

'use strict';
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// ─── Safe-Storage Wrappers ──────────────────────────────────

/**
 * Load safeStorage lazily (only available in Electron main process).
 * Returns null when unavailable (e.g. tests, agent-service child process).
 */
function getSafeStorage() {
  try {
    const { safeStorage } = require('electron');
    return safeStorage.isEncryptionAvailable() ? safeStorage : null;
  } catch {
    return null;
  }
}

/**
 * Fallback AES-256-GCM encryption using a key derived from a machine-scoped secret.
 * The secret is generated once, stored as a plain text file in userData, and is
 * only meaningful on the same machine (similar to DPAPI scope).
 */
function getFallbackKey(storageDir) {
  const keyFile = path.join(storageDir, '.store-key');
  if (fs.existsSync(keyFile)) {
    return Buffer.from(fs.readFileSync(keyFile, 'utf-8').trim(), 'hex');
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyFile, key.toString('hex'), { mode: 0o600 });
  return key;
}

function aesEncrypt(plaintext, key) {
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct  = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

function aesDecrypt(b64, key) {
  const buf  = Buffer.from(b64, 'base64');
  const iv   = buf.subarray(0,  12);
  const tag  = buf.subarray(12, 28);
  const ct   = buf.subarray(28);
  const dec  = crypto.createDecipheriv('aes-256-gcm', key, iv);
  dec.setAuthTag(tag);
  return Buffer.concat([dec.update(ct), dec.final()]).toString('utf-8');
}

// ─── CredentialStore class ──────────────────────────────────

class CredentialStore {
  /**
   * @param {string} storageDir — path to directory where encrypted files are stored
   */
  constructor(storageDir) {
    this._dir = storageDir;
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true, mode: 0o700 });
    }
    // Cache decrypted records in memory for fast access
    this._cache = new Map();
    // Load existing records into cache on first access (lazy)
    this._loaded = false;
  }

  _ensureLoaded() {
    if (this._loaded) return;
    this._loaded = true;
    try {
      const files = fs.readdirSync(this._dir).filter((f) => f.endsWith('.enc'));
      for (const file of files) {
        const id = file.replace('.enc', '');
        try {
          const raw = fs.readFileSync(path.join(this._dir, file), 'utf-8').trim();
          const decrypted = this._decrypt(raw);
          this._cache.set(id, JSON.parse(decrypted));
        } catch {
          // Corrupted or unreadable — skip
        }
      }
    } catch {
      // Directory unreadable — start fresh
    }
  }

  _encrypt(plaintext) {
    const ss = getSafeStorage();
    if (ss) {
      // Electron safeStorage returns a Buffer
      return ss.encryptString(plaintext).toString('base64');
    }
    return aesEncrypt(plaintext, getFallbackKey(this._dir));
  }

  _decrypt(b64) {
    const ss = getSafeStorage();
    if (ss) {
      try {
        return ss.decryptString(Buffer.from(b64, 'base64'));
      } catch {
        // Might have been encrypted with fallback key — try that
        return aesDecrypt(b64, getFallbackKey(this._dir));
      }
    }
    return aesDecrypt(b64, getFallbackKey(this._dir));
  }

  /**
   * Store (or update) credentials for an integration.
   * @param {string} integrationId
   * @param {object} entry — { credentials, providerId?, oauthMeta? }
   */
  set(integrationId, entry) {
    if (!integrationId || typeof integrationId !== 'string') throw new Error('integrationId required');
    const record = {
      integrationId,
      providerId: entry.providerId || null,
      credentials: entry.credentials || {},
      oauthMeta: entry.oauthMeta || null,
      connectedAt: new Date().toISOString(),
    };
    const encrypted = this._encrypt(JSON.stringify(record));
    const filePath  = path.join(this._dir, `${integrationId}.enc`);
    fs.writeFileSync(filePath, encrypted, { mode: 0o600 });
    this._cache.set(integrationId, record);
    return record;
  }

  /**
   * Retrieve stored credentials for an integration.
   * @param {string} integrationId
   * @returns {object|null}
   */
  get(integrationId) {
    this._ensureLoaded();
    return this._cache.get(integrationId) || null;
  }

  /**
   * Delete stored credentials.
   * @param {string} integrationId
   */
  delete(integrationId) {
    this._ensureLoaded();
    const filePath = path.join(this._dir, `${integrationId}.enc`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    this._cache.delete(integrationId);
  }

  /**
   * List all stored integration IDs.
   * @returns {Array<{integrationId, providerId, connectedAt}>}
   */
  list() {
    this._ensureLoaded();
    return Array.from(this._cache.values()).map((r) => ({
      integrationId: r.integrationId,
      providerId: r.providerId,
      connectedAt: r.connectedAt,
    }));
  }

  /**
   * Update OAuth tokens in an existing record (token refresh).
   * @param {string} integrationId
   * @param {string} newAccessToken
   * @param {string|null} newRefreshToken
   * @param {number} expiresIn  — seconds
   */
  updateOAuthTokens(integrationId, newAccessToken, newRefreshToken, expiresIn) {
    this._ensureLoaded();
    const record = this._cache.get(integrationId);
    if (!record) throw new Error(`No stored credentials for: ${integrationId}`);
    // Update the access token in credentials — we don't know the exact field name
    // so we replace any field that was previously the access_token
    const credFields = Object.keys(record.credentials);
    const tokenField = credFields.find((k) => ['access_token', 'token', 'bot_token', 'api_key', 'api_token'].includes(k));
    if (tokenField) record.credentials[tokenField] = newAccessToken;
    // Update oauthMeta
    if (record.oauthMeta) {
      if (newRefreshToken) record.oauthMeta.refreshToken = newRefreshToken;
      record.oauthMeta.expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : null;
    }
    this.set(integrationId, record);
  }

  /**
   * Check if stored OAuth token is expired (or expires in next 60 seconds).
   * @param {string} integrationId
   * @returns {boolean}
   */
  isTokenExpired(integrationId) {
    const record = this.get(integrationId);
    if (!record?.oauthMeta?.expiresAt) return false;
    return Date.now() >= record.oauthMeta.expiresAt - 60_000;
  }
}

module.exports = { CredentialStore };
