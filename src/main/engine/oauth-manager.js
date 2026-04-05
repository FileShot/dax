/**
 * OAuth 2.0 PKCE Manager for Dax
 * 
 * Handles Authorization Code + PKCE flow for desktop apps.
 * No client_secret needed — PKCE replaces it for public clients.
 * 
 * Flow:
 *   1. generatePKCE()               → { verifier, challenge, state }
 *   2. buildAuthUrl(...)            → authorization URL to open in browser
 *   3. User authorizes → callback: dax://oauth/callback?code=...&state=...
 *   4. exchangeCode(...)            → { access_token, refresh_token, expires_in, scope }
 *   5. refreshAccessToken(...)      → { access_token, expires_in, scope }
 *
 * Providers configure their own client_ids and scopes below.
 * Users who need custom apps can override via configFields.
 */

'use strict';
const crypto = require('crypto');
const https  = require('https');
const { URLSearchParams } = require('url');

// ─── PKCE Helpers ───────────────────────────────────────────

/** Generate a cryptographically random PKCE verifier + SHA-256 challenge. */
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const state = crypto.randomBytes(16).toString('hex');
  return { verifier, challenge, state };
}

// ─── Provider Configurations ────────────────────────────────

/**
 * Per-provider OAuth 2.0 configuration.
 * client_id: public — safe to bundle.
 * For providers requiring client_secret, users supply their own app credentials.
 */
const PROVIDERS = {
  google: {
    name: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    // Users must register a Desktop App at console.cloud.google.com
    // and supply their own client_id + client_secret
    requiresSecret: true,
    defaultScopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.readonly'],
    additionalParams: { access_type: 'offline', prompt: 'consent' },
    // Mapping: which Dax integration uses this provider + how to shape credentials
    integrations: {
      google_sheets: (tokens) => ({ access_token: tokens.access_token, refresh_token: tokens.refresh_token }),
    },
  },

  github: {
    name: 'GitHub',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    revokeUrl: null,
    requiresSecret: true,
    defaultScopes: ['repo', 'read:user', 'read:org'],
    additionalParams: {},
    integrations: {
      github: (tokens) => ({ token: tokens.access_token }),
    },
  },

  slack: {
    name: 'Slack',
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    revokeUrl: 'https://slack.com/api/auth.revoke',
    requiresSecret: true,
    defaultScopes: ['channels:read', 'channels:history', 'chat:write', 'users:read', 'pins:read', 'pins:write', 'reactions:write'],
    additionalParams: {},
    integrations: {
      slack: (tokens) => ({ bot_token: tokens.access_token || tokens.authed_user?.access_token }),
    },
  },

  notion: {
    name: 'Notion',
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    revokeUrl: null,
    requiresSecret: true,
    defaultScopes: [],
    additionalParams: { response_type: 'code', owner: 'user' },
    integrations: {
      notion: (tokens) => ({ token: tokens.access_token }),
    },
  },

  hubspot: {
    name: 'HubSpot',
    authUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    revokeUrl: null,
    requiresSecret: true,
    defaultScopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.deals.read', 'crm.objects.deals.write', 'crm.objects.companies.read'],
    additionalParams: {},
    integrations: {
      hubspot: (tokens) => ({ access_token: tokens.access_token }),
    },
  },

  microsoft: {
    name: 'Microsoft',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    revokeUrl: null,
    requiresSecret: false, // Public client — no secret needed
    defaultScopes: ['offline_access', 'User.Read', 'Files.ReadWrite', 'Mail.ReadWrite', 'Calendars.ReadWrite'],
    additionalParams: { response_mode: 'query' },
    integrations: {
      // Microsoft Graph API integrations would map here
    },
  },

  linear: {
    name: 'Linear',
    authUrl: 'https://linear.app/oauth/authorize',
    tokenUrl: 'https://api.linear.app/oauth/token',
    revokeUrl: 'https://api.linear.app/oauth/revoke',
    requiresSecret: true,
    defaultScopes: ['read', 'write', 'issues:create', 'comments:create'],
    additionalParams: { response_type: 'code', actor: 'application' },
    integrations: {
      linear: (tokens) => ({ api_key: tokens.access_token }),
    },
  },

  shopify: {
    name: 'Shopify',
    authUrl: null, // Dynamic: https://{shop}.myshopify.com/admin/oauth/authorize
    tokenUrl: null, // Dynamic: https://{shop}.myshopify.com/admin/oauth/access_token
    revokeUrl: null,
    requiresSecret: true,
    defaultScopes: ['read_products', 'write_products', 'read_orders', 'write_orders', 'read_customers', 'write_customers'],
    additionalParams: {},
    dynamic: true, // URL is shop-specific
    integrations: {
      shopify: (tokens, params) => ({ store: params.shop?.replace('.myshopify.com', ''), access_token: tokens.access_token }),
    },
  },
};

// ─── Authorization URL Builder ──────────────────────────────

/**
 * Build the authorization URL to open in the user's browser.
 * @param {string} providerId
 * @param {string} clientId
 * @param {string} redirectUri  — e.g. 'dax://oauth/callback'
 * @param {string} challenge    — PKCE code_challenge (base64url SHA-256)
 * @param {string} state        — random CSRF token
 * @param {object} [options]    — override scopes, shopDomain (Shopify), etc.
 * @returns {string}
 */
function buildAuthUrl(providerId, clientId, redirectUri, challenge, state, options = {}) {
  const provider = PROVIDERS[providerId];
  if (!provider) throw new Error(`Unknown OAuth provider: ${providerId}`);

  const scopes = options.scopes || provider.defaultScopes;
  const baseUrl = providerId === 'shopify' && options.shopDomain
    ? `https://${options.shopDomain}/admin/oauth/authorize`
    : provider.authUrl;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    ...provider.additionalParams,
    ...(options.extraParams || {}),
  });

  return `${baseUrl}?${params.toString()}`;
}

// ─── Token Exchange ─────────────────────────────────────────

/**
 * Exchange an authorization code for tokens.
 * @param {string} providerId
 * @param {string} clientId
 * @param {string|null} clientSecret  — null for PKCE-only providers
 * @param {string} code               — authorization code from callback
 * @param {string} verifier           — PKCE code_verifier
 * @param {string} redirectUri
 * @param {object} [options]          — shopDomain, etc.
 * @returns {Promise<{access_token, refresh_token, expires_in, scope, token_type}>}
 */
function exchangeCode(providerId, clientId, clientSecret, code, verifier, redirectUri, options = {}) {
  const provider = PROVIDERS[providerId];
  if (!provider) return Promise.reject(new Error(`Unknown OAuth provider: ${providerId}`));

  const tokenUrl = providerId === 'shopify' && options.shopDomain
    ? `https://${options.shopDomain}/admin/oauth/access_token`
    : provider.tokenUrl;

  const body = new URLSearchParams({
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: verifier,
  });
  if (clientSecret) body.set('client_secret', clientSecret);

  // Notion uses Basic auth for token exchange
  const extraHeaders = {};
  if (providerId === 'notion' && clientSecret) {
    extraHeaders['Authorization'] = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  }

  return postTokenRequest(tokenUrl, body.toString(), { 'Content-Type': 'application/x-www-form-urlencoded', ...extraHeaders });
}

/**
 * Refresh an access token using a refresh token.
 * @param {string} providerId
 * @param {string} clientId
 * @param {string|null} clientSecret
 * @param {string} refreshToken
 * @param {string} redirectUri
 * @returns {Promise<{access_token, refresh_token, expires_in, scope}>}
 */
function refreshAccessToken(providerId, clientId, clientSecret, refreshToken, redirectUri) {
  const provider = PROVIDERS[providerId];
  if (!provider) return Promise.reject(new Error(`Unknown OAuth provider: ${providerId}`));
  if (!provider.tokenUrl) return Promise.reject(new Error(`Provider "${providerId}" does not support token refresh`));

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret || '',
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    redirect_uri: redirectUri,
  });

  return postTokenRequest(provider.tokenUrl, body.toString(), { 'Content-Type': 'application/x-www-form-urlencoded' });
}

/** Low-level POST to token endpoint, returns parsed JSON. */
function postTokenRequest(tokenUrl, bodyStr, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(tokenUrl);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(bodyStr),
        Accept: 'application/json',
        'User-Agent': 'Dax-Agent/1.0',
        ...headers,
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.error) reject(new Error(result.error_description || result.error));
          else resolve(result);
        } catch (e) {
          reject(new Error(`Token exchange failed: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// ─── Credential Mapping ─────────────────────────────────────

/**
 * Given OAuth tokens + provider, return the credentials object
 * that should be passed to the integration's connect() method.
 */
function mapTokensToCredentials(providerId, integrationId, tokens, params = {}) {
  const provider = PROVIDERS[providerId];
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);
  const mapper = provider.integrations?.[integrationId];
  if (!mapper) throw new Error(`No credential mapping for ${providerId} → ${integrationId}`);
  return mapper(tokens, params);
}

/**
 * Parse OAuth callback URL parameters.
 * @param {string} callbackUrl — full callback URL, e.g. dax://oauth/callback?code=...&state=...
 * @returns {{ code, state, error, errorDescription, shop }}
 */
function parseCallback(callbackUrl) {
  try {
    const url = new URL(callbackUrl);
    return {
      code: url.searchParams.get('code'),
      state: url.searchParams.get('state'),
      error: url.searchParams.get('error'),
      errorDescription: url.searchParams.get('error_description'),
      shop: url.searchParams.get('shop'),
    };
  } catch {
    return { error: 'invalid_callback', errorDescription: 'Could not parse callback URL' };
  }
}

module.exports = {
  PROVIDERS,
  generatePKCE,
  buildAuthUrl,
  exchangeCode,
  refreshAccessToken,
  mapTokensToCredentials,
  parseCallback,
};
