/**
 * RSS/Atom Feed Reader Integration
 */
'use strict';
const https = require('https');
const http = require('http');
const { parseString } = (() => { try { return require('xml2js'); } catch { return { parseString: null }; } })();

function fetchUrl(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'Dax-RSS-Reader/1.0', 'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml' }, timeout }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location, timeout).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function parseXml(xml) {
  return new Promise((resolve, reject) => {
    if (parseString) { parseString(xml, { explicitArray: false, trim: true }, (e, r) => e ? reject(e) : resolve(r)); return; }
    // Minimal XML parser fallback for RSS 2.0
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let m;
    while ((m = itemRegex.exec(xml)) !== null) {
      const raw = m[1];
      const get = (tag) => { const t = new RegExp(`<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?\\s*</${tag}>`, 'is').exec(raw); return t ? t[1].trim() : null; };
      items.push({ title: get('title'), link: get('link'), description: get('description'), pubDate: get('pubDate'), guid: get('guid'), author: get('author') || get('dc:creator') });
    }
    // Try Atom entries
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    while ((m = entryRegex.exec(xml)) !== null) {
      const raw = m[1];
      const get = (tag) => { const t = new RegExp(`<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?\\s*</${tag}>`, 'is').exec(raw); return t ? t[1].trim() : null; };
      const linkM = /<link[^>]*href="([^"]*)"/.exec(raw);
      items.push({ title: get('title'), link: linkM ? linkM[1] : get('link'), description: get('summary') || get('content'), pubDate: get('published') || get('updated'), author: get('name') });
    }
    const titleM = /<title[^>]*>(.*?)<\/title>/i.exec(xml);
    resolve({ feed: { title: titleM ? titleM[1] : 'Unknown Feed', items } });
  });
}

function normalizeFeed(parsed) {
  if (parsed.rss) {
    const ch = parsed.rss.channel || {};
    return { title: ch.title, description: ch.description, link: ch.link, items: (Array.isArray(ch.item) ? ch.item : ch.item ? [ch.item] : []).map((i) => ({ title: i.title, link: i.link, description: typeof i.description === 'object' ? i.description._ || '' : i.description, pubDate: i.pubDate, guid: i.guid?._ || i.guid, author: i.author || i['dc:creator'] })) };
  }
  if (parsed.feed) {
    const f = parsed.feed;
    const entries = Array.isArray(f.entry) ? f.entry : f.entry ? [f.entry] : (f.items || []);
    return { title: f.title?._ || f.title, description: f.subtitle?._ || f.subtitle, link: Array.isArray(f.link) ? (f.link.find((l) => l.$.rel === 'alternate') || f.link[0])?.$.href : f.link?.$.href, items: entries.map((e) => ({ title: e.title?._ || e.title, link: Array.isArray(e.link) ? e.link[0]?.$.href : e.link?.$.href || e.link, description: e.summary?._ || e.summary || e.content?._ || e.content || e.description, pubDate: e.published || e.updated || e.pubDate, author: e.author?.name || e.author })) };
  }
  return parsed;
}

module.exports = {
  id: 'rss',
  name: 'RSS Feed Reader',
  category: 'social',
  icon: 'Rss',
  description: 'Read and parse RSS/Atom feeds from any URL.',
  configFields: [],
  async connect() {},
  async disconnect() {},
  async test() { return { success: true, message: 'RSS reader ready (no credentials needed)' }; },
  actions: {
    fetch_feed: async (params) => {
      if (!params.url) throw new Error('url required');
      const xml = await fetchUrl(params.url, params.timeout || 15000);
      const parsed = await parseXml(xml);
      const feed = normalizeFeed(parsed);
      const limit = params.limit || 20;
      if (feed.items && feed.items.length > limit) feed.items = feed.items.slice(0, limit);
      return feed;
    },
    parse_entries: async (params) => {
      if (!params.url) throw new Error('url required');
      const xml = await fetchUrl(params.url);
      const parsed = await parseXml(xml);
      const feed = normalizeFeed(parsed);
      const entries = (feed.items || []).map((e) => ({
        title: e.title, link: e.link, pubDate: e.pubDate, author: e.author,
        snippet: typeof e.description === 'string' ? e.description.replace(/<[^>]*>/g, '').slice(0, 200) : '',
      }));
      return { count: entries.length, entries };
    },
    search_entries: async (params) => {
      if (!params.url || !params.query) throw new Error('url and query required');
      const xml = await fetchUrl(params.url);
      const parsed = await parseXml(xml);
      const feed = normalizeFeed(parsed);
      const q = params.query.toLowerCase();
      const matches = (feed.items || []).filter((e) => {
        const text = `${e.title || ''} ${e.description || ''} ${e.author || ''}`.toLowerCase();
        return text.includes(q);
      });
      return { query: params.query, count: matches.length, results: matches };
    },
  },
  async executeAction(n, p) { const a = this.actions[n]; if (!a) throw new Error(`Unknown action: ${n}`); return a(p, this.credentials); },
};
