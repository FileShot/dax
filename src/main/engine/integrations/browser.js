/**
 * Browser Automation Integration
 *
 * Full browser control using Playwright (Chromium).
 * For static HTML scraping, use the Web Scraper integration instead.
 */

'use strict';

let _browser = null;
let _context = null;
let _idleTimer = null;
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

module.exports = {
  id: 'browser',
  name: 'Browser Automation',
  category: 'utility',
  icon: 'Monitor',
  description: 'Automate web browsers — navigate, click, fill forms, take screenshots, and extract content.',

  configFields: [
    { key: 'headless', label: 'Headless Mode', type: 'text', placeholder: 'true' },
    { key: 'browser_type', label: 'Browser', type: 'text', placeholder: 'chromium' },
  ],

  async connect(creds) {
    this.credentials = creds;
  },

  async disconnect() {
    this.credentials = null;
    await closeBrowser();
  },

  async test(creds) {
    try {
      const { chromium } = require('playwright');
      return { success: true, message: `Playwright available. Chromium ready.` };
    } catch (err) {
      return { success: false, message: `Playwright not available: ${err.message}` };
    }
  },

  actions: {
    navigate: async (params, creds) => {
      const { url, wait_for } = params;
      if (!url) throw new Error('url is required');

      const page = await getPage(creds);
      await page.goto(url, { waitUntil: wait_for || 'domcontentloaded', timeout: 30000 });
      resetIdle();

      const title = await page.title();
      const pageUrl = page.url();
      const text = await page.evaluate(() => document.body?.innerText?.slice(0, 50000) || '');

      return { url: pageUrl, title, text_length: text.length, text };
    },

    screenshot: async (params, creds) => {
      const { path: savePath, full_page, selector } = params;
      const page = await getPage(creds);
      resetIdle();

      const opts = { type: 'png' };
      if (savePath) opts.path = savePath;
      if (full_page) opts.fullPage = true;

      let buffer;
      if (selector) {
        const el = await page.$(selector);
        if (!el) throw new Error(`Element not found: ${selector}`);
        buffer = await el.screenshot(opts);
      } else {
        buffer = await page.screenshot(opts);
      }

      return {
        saved: !!savePath,
        path: savePath || null,
        size_bytes: buffer.length,
        base64: savePath ? undefined : buffer.toString('base64'),
      };
    },

    click: async (params, creds) => {
      const { selector, text } = params;
      const page = await getPage(creds);
      resetIdle();

      if (text) {
        await page.getByText(text, { exact: false }).first().click({ timeout: 10000 });
      } else if (selector) {
        await page.click(selector, { timeout: 10000 });
      } else {
        throw new Error('selector or text required');
      }

      return { clicked: true, selector: selector || `text="${text}"` };
    },

    fill_form: async (params, creds) => {
      const { fields } = params;
      if (!fields || !Array.isArray(fields)) throw new Error('fields array required: [{ selector, value }]');

      const page = await getPage(creds);
      resetIdle();

      for (const field of fields) {
        if (field.type === 'select') {
          await page.selectOption(field.selector, field.value);
        } else if (field.type === 'check') {
          await page.check(field.selector);
        } else {
          await page.fill(field.selector, field.value);
        }
      }

      return { filled: fields.length, fields: fields.map((f) => f.selector) };
    },

    extract_content: async (params, creds) => {
      const { selector, attribute } = params;
      const page = await getPage(creds);
      resetIdle();

      if (selector) {
        const elements = await page.$$eval(selector, (els, attr) => {
          return els.map((el) => ({
            text: el.innerText?.trim(),
            href: el.href,
            src: el.src,
            value: attr ? el.getAttribute(attr) : undefined,
          }));
        }, attribute);
        return { selector, count: elements.length, elements };
      }

      // Full page content
      const text = await page.evaluate(() => document.body?.innerText || '');
      const title = await page.title();
      return { title, text: text.slice(0, 100000), length: text.length };
    },

    evaluate_js: async (params, creds) => {
      const { code } = params;
      if (!code) throw new Error('code is required');

      const page = await getPage(creds);
      resetIdle();

      const result = await page.evaluate(code);
      return { result };
    },

    wait_for_selector: async (params, creds) => {
      const { selector, state, timeout } = params;
      if (!selector) throw new Error('selector is required');

      const page = await getPage(creds);
      resetIdle();

      await page.waitForSelector(selector, {
        state: state || 'visible',
        timeout: timeout || 10000,
      });

      return { found: true, selector };
    },

    pdf_export: async (params, creds) => {
      const { path: savePath, format } = params;
      if (!savePath) throw new Error('path is required');

      const page = await getPage(creds);
      resetIdle();

      const buffer = await page.pdf({
        path: savePath,
        format: format || 'A4',
        printBackground: true,
      });

      return { saved: true, path: savePath, size_bytes: buffer.length };
    },

    close_browser: async (params, creds) => {
      await closeBrowser();
      return { closed: true };
    },
  },

  async executeAction(actionName, params) {
    const action = this.actions[actionName];
    if (!action) throw new Error(`Unknown action: ${actionName}`);
    return action(params, this.credentials);
  },
};

// ─── Browser Session Management ──────────────────────────────

async function ensureBrowser(creds = {}) {
  if (_browser && _browser.isConnected()) return;

  const { chromium, firefox, webkit } = require('playwright');
  const browserType = creds?.browser_type || 'chromium';
  const headless = creds?.headless !== 'false';

  const browsers = { chromium, firefox, webkit };
  const launcher = browsers[browserType] || chromium;

  _browser = await launcher.launch({ headless });
  _context = await _browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
  });
}

async function getPage(creds) {
  await ensureBrowser(creds);
  const pages = _context.pages();
  if (pages.length > 0) return pages[pages.length - 1];
  return _context.newPage();
}

async function closeBrowser() {
  if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null; }
  if (_context) { try { await _context.close(); } catch {} _context = null; }
  if (_browser) { try { await _browser.close(); } catch {} _browser = null; }
}

function resetIdle() {
  if (_idleTimer) clearTimeout(_idleTimer);
  _idleTimer = setTimeout(() => {
    closeBrowser().catch(() => {});
  }, IDLE_TIMEOUT_MS);
}
