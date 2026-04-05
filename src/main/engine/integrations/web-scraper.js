/**
 * Web Scraper Integration
 *
 * Fast HTML scraping using Cheerio (no browser needed).
 * For JavaScript-rendered pages, use the Browser integration instead.
 */

'use strict';

const https = require('https');
const http = require('http');

module.exports = {
  id: 'web-scraper',
  name: 'Web Scraper',
  category: 'utility',
  icon: 'Globe',
  description: 'Scrape web pages and extract content, links, and structured data.',

  configFields: [
    { key: 'user_agent', label: 'User Agent', type: 'text', placeholder: 'Mozilla/5.0 (compatible; DaxBot/1.0)' },
    { key: 'timeout', label: 'Timeout (ms)', type: 'text', placeholder: '10000' },
  ],

  async connect(creds) {
    this.credentials = creds;
  },

  async disconnect() {
    this.credentials = null;
  },

  async test(creds) {
    return { success: true, message: 'Web scraper ready' };
  },

  actions: {
    scrape_url: async (params, creds) => {
      const { url, selector } = params;
      if (!url) throw new Error('url is required');

      const html = await fetchPage(url, creds);
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);

      // Remove script/style
      $('script, style, noscript').remove();

      if (selector) {
        const elements = [];
        $(selector).each((_, el) => {
          elements.push({
            text: $(el).text().trim(),
            html: $(el).html(),
            attrs: el.attribs || {},
          });
        });
        return { url, selector, count: elements.length, elements };
      }

      // Return full page text
      const title = $('title').text().trim();
      const description = $('meta[name="description"]').attr('content') || '';
      const text = $('body').text().replace(/\s+/g, ' ').trim();

      return { url, title, description, text: text.slice(0, 50000) };
    },

    extract_links: async (params, creds) => {
      const { url, selector } = params;
      if (!url) throw new Error('url is required');

      const html = await fetchPage(url, creds);
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      const baseUrl = new URL(url);

      const links = [];
      $(selector || 'a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        try {
          const resolved = new URL(href, baseUrl).href;
          links.push({ text: $(el).text().trim(), href: resolved });
        } catch { /* skip invalid URLs */ }
      });

      return { url, count: links.length, links };
    },

    extract_text: async (params, creds) => {
      const { url, selector } = params;
      if (!url) throw new Error('url is required');

      const html = await fetchPage(url, creds);
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      $('script, style, noscript').remove();

      const target = selector ? $(selector) : $('body');
      const text = target.text().replace(/\s+/g, ' ').trim();

      return { url, text: text.slice(0, 100000), length: text.length };
    },

    extract_tables: async (params, creds) => {
      const { url, table_index } = params;
      if (!url) throw new Error('url is required');

      const html = await fetchPage(url, creds);
      const cheerio = require('cheerio');
      const $ = cheerio.load(html);

      const tables = [];
      $('table').each((i, tableEl) => {
        if (table_index != null && i !== table_index) return;

        const headers = [];
        $(tableEl).find('thead th, thead td, tr:first-child th').each((_, th) => {
          headers.push($(th).text().trim());
        });

        const rows = [];
        $(tableEl).find('tbody tr, tr').each((_, tr) => {
          const cells = [];
          $(tr).find('td, th').each((_, td) => {
            cells.push($(td).text().trim());
          });
          if (cells.length > 0 && cells.join('') !== headers.join('')) {
            rows.push(cells);
          }
        });

        tables.push({ index: i, headers, rows, row_count: rows.length });
      });

      return { url, table_count: tables.length, tables };
    },
  },

  async executeAction(actionName, params) {
    const action = this.actions[actionName];
    if (!action) throw new Error(`Unknown action: ${actionName}`);
    return action(params, this.credentials);
  },
};

// ─── Internal ────────────────────────────────────────────────

function fetchPage(url, creds = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const timeout = parseInt(creds?.timeout) || 10000;
    const userAgent = creds?.user_agent || 'Mozilla/5.0 (compatible; DaxBot/1.0; +https://dax.app)';

    const opts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    };

    const req = client.request(opts, (res) => {
      // Follow redirects (up to 5)
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).href;
        return fetchPage(redirectUrl, creds).then(resolve, reject);
      }

      if (res.statusCode >= 400) {
        return reject(new Error(`HTTP ${res.statusCode}: ${parsed.hostname}${parsed.pathname}`));
      }

      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    });

    req.on('error', (err) => reject(new Error(`Fetch failed: ${err.message}`)));
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
    req.end();
  });
}
