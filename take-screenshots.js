#!/usr/bin/env node
'use strict';
const { chromium } = require('playwright');
const path = require('path');

const ASSETS = path.resolve('C:/Users/brend/thing/dax-website/assets');

const DAX_DEMO = `
window._DAX_DEMO = {
  'agents-list': function() {
    return [
      { id: 'a1', name: 'Bitcoin Price Tracker', enabled: 1, trigger_type: 'schedule', schedule: '*/5 * * * *', description: 'Tracks BTC price every 5 minutes' },
      { id: 'a2', name: 'Daily News Summarizer', enabled: 1, trigger_type: 'schedule', schedule: '0 8 * * *', description: 'Summarizes top news articles each morning' },
      { id: 'a3', name: 'GitHub Issues Monitor', enabled: 1, trigger_type: 'webhook', schedule: '', description: 'Watches GitHub repos for new issues' },
      { id: 'a4', name: 'System Health Report', enabled: 1, trigger_type: 'schedule', schedule: '0 * * * *', description: 'Hourly system diagnostics' },
      { id: 'a5', name: 'Email Classifier', enabled: 1, trigger_type: 'schedule', schedule: '*/15 * * * *', description: 'Sorts Gmail inbox with AI labels' },
      { id: 'a6', name: 'Market Research Agent', enabled: 0, trigger_type: 'schedule', schedule: '0 9 * * 1', description: 'Weekly competitive analysis report' },
    ];
  },
  'runs-list': function() {
    var d = function(ms) { return new Date(Date.now() - ms).toISOString(); };
    return [
      { id: 'r1',  agent_id: 'a1', status: 'completed', started_at: d(180000),   duration_ms: 1800, tokens_used: 420,  result: { output: 'BTC: $83,421 (+0.6%)' } },
      { id: 'r2',  agent_id: 'a5', status: 'completed', started_at: d(300000),   duration_ms: 4200, tokens_used: 880,  result: { output: '14 emails classified' } },
      { id: 'r3',  agent_id: 'a3', status: 'completed', started_at: d(2700000),  duration_ms: 2100, tokens_used: 310,  result: { output: '2 new issues found' } },
      { id: 'r4',  agent_id: 'a1', status: 'error',     started_at: d(480000),   duration_ms: 800,  tokens_used: 50,   result: null },
      { id: 'r5',  agent_id: 'a4', status: 'completed', started_at: d(1800000),  duration_ms: 3100, tokens_used: 620,  result: { output: 'CPU 34%, RAM 6.2/16GB, all nominal' } },
      { id: 'r6',  agent_id: 'a2', status: 'completed', started_at: d(3600000),  duration_ms: 8400, tokens_used: 2100, result: { output: '5 articles summarized' } },
      { id: 'r7',  agent_id: 'a1', status: 'completed', started_at: d(780000),   duration_ms: 1600, tokens_used: 390,  result: { output: 'BTC: $83,102 (+0.2%)' } },
      { id: 'r8',  agent_id: 'a5', status: 'completed', started_at: d(1200000),  duration_ms: 3800, tokens_used: 720,  result: { output: '9 emails classified' } },
      { id: 'r9',  agent_id: 'a3', status: 'completed', started_at: d(5400000),  duration_ms: 1900, tokens_used: 280,  result: { output: '1 new issue found' } },
      { id: 'r10', agent_id: 'a1', status: 'completed', started_at: d(7200000),  duration_ms: 1700, tokens_used: 400,  result: { output: 'BTC: $82,894 (-0.1%)' } },
      { id: 'r11', agent_id: 'a4', status: 'completed', started_at: d(7210000),  duration_ms: 2900, tokens_used: 590,  result: { output: 'CPU 28%, all services OK' } },
      { id: 'r12', agent_id: 'a5', status: 'error',     started_at: d(9000000),  duration_ms: 600,  tokens_used: 40,   result: null },
      { id: 'r13', agent_id: 'a2', status: 'completed', started_at: d(86400000), duration_ms: 7900, tokens_used: 1980, result: { output: '4 articles summarized' } },
      { id: 'r14', agent_id: 'a1', status: 'completed', started_at: d(86700000), duration_ms: 1600, tokens_used: 380,  result: { output: 'BTC: $81,200 (+1.2%)' } },
      { id: 'r15', agent_id: 'a3', status: 'completed', started_at: d(90000000), duration_ms: 2200, tokens_used: 300,  result: { output: '3 new issues found' } },
    ];
  },
  'runs-get': function(id) {
    return { id: 'r1', agent_id: 'a1', status: 'completed', started_at: new Date(Date.now()-180000).toISOString(), duration_ms: 1800, tokens_used: 420, result: { output: 'BTC: $83,421' } };
  },
  'models-list': function() {
    return [
      { id: 'm1', name: 'Llama 3.1 8B Instruct', path: '/models/llama-3.1-8b.gguf', size: 4800000000, type: 'local', status: 'loaded' },
      { id: 'm2', name: 'Qwen 2.5 3B', path: '/models/qwen-2.5-3b.gguf', size: 1900000000, type: 'local', status: 'available' },
    ];
  },
  'integrations-list': function() {
    return [
      { id: 'slack',    name: 'Slack',         category: 'messaging',    connected: true  },
      { id: 'notion',   name: 'Notion',        category: 'productivity', connected: true  },
      { id: 'gmail',    name: 'Gmail',         category: 'email',        connected: true  },
      { id: 'github',   name: 'GitHub',        category: 'dev',          connected: true  },
      { id: 'postgres', name: 'PostgreSQL',    category: 'database',     connected: false },
      { id: 'sheets',   name: 'Google Sheets', category: 'productivity', connected: false },
    ];
  },
  'circuit-status': function() {
    return {
      slack:         { state: 'CLOSED',    failures: 0 },
      gmail:         { state: 'CLOSED',    failures: 1 },
      github:        { state: 'CLOSED',    failures: 0 },
      notion:        { state: 'OPEN',      failures: 5 },
      'bitcoin-api': { state: 'HALF_OPEN', failures: 2 },
    };
  },
  'error-budget-status': function() {
    return { slack: { total: 42, errors: 0, budget: 10, exhausted: false }, gmail: { total: 38, errors: 1, budget: 10, exhausted: false } };
  },
  'system-info': function() {
    return { platform: 'win32', arch: 'x64', cpus: 12, totalMemory: 17179869184, freeMemory: 5368709120, hostname: 'DESKTOP-GRAYSOFT', nodeVersion: 'v20.11.0' };
  },
  'scheduler-status': function() { return { scheduled: 4, running: 0 }; },
  'chat-history-list': function() {
    return [
      { id: 'c1', role: 'user',      content: 'What did my agents do in the past hour?', ts: new Date(Date.now()-600000).toISOString() },
      { id: 'c2', role: 'assistant', content: '3 agents ran in the past hour:\\n\\n- **Bitcoin Price Tracker** — completed 3 min ago (1.8s), BTC: **$83,421** (+0.6%)\\n- **Email Classifier** — 14 emails sorted (4.2s)\\n- **GitHub Issues Monitor** — 2 new issues found', ts: new Date(Date.now()-590000).toISOString() },
      { id: 'c3', role: 'user',      content: 'What did the Email Classifier find?', ts: new Date(Date.now()-300000).toISOString() },
      { id: 'c4', role: 'assistant', content: 'The **Email Classifier** processed **14 emails**: 9 newsletters, 4 work emails labeled Priority, 1 spam removed. High-priority: boss@company.com "Q2 deadline update".', ts: new Date(Date.now()-295000).toISOString() },
      { id: 'c5', role: 'user',      content: 'Show me Bitcoin price history today', ts: new Date(Date.now()-60000).toISOString() },
      { id: 'c6', role: 'assistant', content: '**Bitcoin today:** $83,421 (+0.6%) most recent, $82,894 low, $83,102 mid-range. 24h change: **+2.1%**. Current: **$83,421 USD**', ts: new Date(Date.now()-55000).toISOString() },
    ];
  },
  'settings-all':      function() { return { ollamaUrl: 'http://localhost:11434', defaultModel: 'llama3.1:8b', maxTokens: 4096, temperature: 0.7, logLevel: 'info', autoStart: true, notifications: true }; },
  'crews-list':        function() { return []; },
  'kb-list':           function() { return []; },
  'plugins-list':      function() { return []; },
  'mcp-list-servers':  function() { return []; },
  'output-files-list': function() { return []; },
  'voice-get-config':  function() { return { enabled: false }; },
  'get-metrics':       function() { return { totalRuns: 15, successRate: 0.87 }; },
  'agent-active-runs': function() { return []; },
  'tools-list':        function() { return []; },
  'oauth-providers':   function() { return []; },
  'credentials-list':  function() { return []; },
  'chat-history-save': function() { return null; },
};
`;

const shots = [
  { theme: 'dracula',          view: 'dashboard',    file: 'marketing-dashboard-full.png', chat: false },
  { theme: 'light',            view: 'agents',       file: 'marketing-agent-detail.png',   chat: false },
  { theme: 'catppuccin-mocha', view: 'history',      file: 'marketing-history-live.png',   chat: false },
  { theme: 'solarized-dark',   view: 'integrations', file: 'marketing-health.png',         chat: false },
  { theme: 'monolith',         view: 'integrations', file: 'marketing-agent-creator.png',  chat: false },
  { theme: 'nord',             view: 'models',       file: 'marketing-models.png',         chat: false },
  { theme: 'void',             view: 'settings',     file: 'marketing-settings.png',       chat: false },
  { theme: 'monokai',          view: 'dashboard',    file: 'marketing-chat-active.png',    chat: true  },
  { theme: 'github-dark',      view: 'history',      file: 'marketing-history-detail.png', chat: false },
];

const VIEW_NAMES = {
  agents:       'Agents',
  history:      'History',
  health:       'Health',
  integrations: 'Integrations',
  models:       'Models',
  settings:     'Settings',
};

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  await page.addInitScript(DAX_DEMO);

  // Navigate once to establish localStorage origin
  await page.goto('http://localhost:5200', { waitUntil: 'domcontentloaded', timeout: 30000 });

  for (const shot of shots) {
    console.log(`\n[${shot.theme}] → ${shot.file}`);

    // Set theme in the correct origin's localStorage, then reload
    await page.evaluate((theme) => localStorage.setItem('dax-theme', theme), shot.theme);
    await page.goto('http://localhost:5200', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);

    // Verify inner width
    const iw = await page.evaluate(() => window.innerWidth);
    console.log(`  innerWidth: ${iw}`);

    // Check for error boundary
    const errEl = await page.$(':text("Something went wrong")');
    if (errEl) {
      console.log('  ERROR BOUNDARY - skipping navigation, taking as-is');
    } else if (shot.view !== 'dashboard') {
      const btnName = VIEW_NAMES[shot.view];
      if (btnName) {
        await page.getByRole('button', { name: btnName }).first().click({ timeout: 8000 });
        await page.waitForTimeout(1200);
      }
    }

    if (shot.chat) {
      const chatBtn = page.getByRole('button', { name: 'Chat' }).first();
      await chatBtn.click({ timeout: 5000 });
      await page.waitForTimeout(1000);
    }

    const dest = path.join(ASSETS, shot.file);
    await page.screenshot({ path: dest });
    console.log(`  saved: ${dest}`);
  }

  await browser.close();
  console.log('\nAll done!');
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
