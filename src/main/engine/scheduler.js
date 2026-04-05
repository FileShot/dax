// ─── Scheduler ──────────────────────────────────────────────
// Manages cron-based agent triggers using node-cron.
// Also handles file watcher triggers via chokidar.

const cron = require('node-cron');
const chokidar = require('chokidar');
const { executeAgent } = require('./agent-runner');

const _cronJobs = new Map();   // agentId → CronTask
const _watchers = new Map();   // agentId → FSWatcher
const _activeRuns = new Map(); // agentId → Promise

let _dbHelpers = null;
let _log = null;

function init({ dbAll, dbGet, dbRun, getDb, log }) {
  _dbHelpers = { dbAll, dbGet, dbRun, getDb };
  _log = log;
}

// ─── Start All Scheduled Agents ─────────────────────────────
async function startAll() {
  if (!_dbHelpers) throw new Error('Scheduler not initialized. Call init() first.');

  const db = await _dbHelpers.getDb();
  const agents = _dbHelpers.dbAll(db, "SELECT * FROM agents WHERE enabled = 1 AND trigger_type IN ('schedule', 'file_watch')");

  _log('info', 'SCHEDULER', `Found ${agents.length} schedulable agents`);

  for (const agent of agents) {
    scheduleAgent(agent);
  }
}

// ─── Schedule a Single Agent ────────────────────────────────
function scheduleAgent(agent) {
  // Remove existing schedule if any
  unscheduleAgent(agent.id);

  let triggerConfig = {};
  try {
    triggerConfig = typeof agent.trigger_config === 'string'
      ? JSON.parse(agent.trigger_config)
      : agent.trigger_config || {};
  } catch (_) {}

  if (agent.trigger_type === 'schedule') {
    const schedule = triggerConfig.cron || triggerConfig.schedule;
    if (!schedule) {
      _log('warn', 'SCHEDULER', `Agent ${agent.name} has no cron schedule`, { id: agent.id });
      return;
    }

    if (!cron.validate(schedule)) {
      _log('error', 'SCHEDULER', `Invalid cron expression for ${agent.name}: ${schedule}`, { id: agent.id });
      return;
    }

    const task = cron.schedule(schedule, () => {
      _log('info', 'SCHEDULER', `Cron triggered: ${agent.name}`, { id: agent.id, schedule });
      triggerAgent(agent, { trigger: 'cron', schedule });
    });

    _cronJobs.set(agent.id, task);
    _log('info', 'SCHEDULER', `Scheduled: ${agent.name} → ${schedule}`, { id: agent.id });

  } else if (agent.trigger_type === 'file_watch') {
    const watchPath = triggerConfig.path || triggerConfig.watch_path;
    if (!watchPath) {
      _log('warn', 'SCHEDULER', `Agent ${agent.name} has no watch path`, { id: agent.id });
      return;
    }

    const watcher = chokidar.watch(watchPath, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500 },
    });

    let debounceTimer = null;

    watcher.on('all', (eventType, filePath) => {
      // Debounce rapid file changes
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        _log('info', 'SCHEDULER', `File event triggered: ${agent.name}`, { id: agent.id, eventType, filePath });
        triggerAgent(agent, { trigger: 'file_watch', event: eventType, path: filePath });
      }, 1000);
    });

    _watchers.set(agent.id, watcher);
    _log('info', 'SCHEDULER', `Watching: ${agent.name} → ${watchPath}`, { id: agent.id });
  }
}

function triggerAgent(agent, triggerData) {
  if (_activeRuns.has(agent.id)) {
    _log('warn', 'SCHEDULER', `Skipping trigger for ${agent.name} while prior run is still active`, {
      id: agent.id,
      trigger: triggerData.trigger,
    });
    return;
  }

  let runPromise = null;
  runPromise = executeAgent(agent, triggerData, { ..._dbHelpers, log: _log })
    .catch((err) => {
      _log('error', 'SCHEDULER', `Run failed for ${agent.name}: ${err.message}`);
    })
    .finally(() => {
      if (_activeRuns.get(agent.id) === runPromise) {
        _activeRuns.delete(agent.id);
      }
    });

  _activeRuns.set(agent.id, runPromise);
}

// ─── Unschedule a Single Agent ──────────────────────────────
function unscheduleAgent(agentId) {
  const job = _cronJobs.get(agentId);
  if (job) {
    job.stop();
    _cronJobs.delete(agentId);
  }

  const watcher = _watchers.get(agentId);
  if (watcher) {
    watcher.close();
    _watchers.delete(agentId);
  }
}

// ─── Stop All ───────────────────────────────────────────────
function stopAll() {
  for (const [id, job] of _cronJobs) {
    job.stop();
  }
  _cronJobs.clear();

  for (const [id, watcher] of _watchers) {
  _activeRuns.clear();
    watcher.close();
  }
  _watchers.clear();

  _log?.('info', 'SCHEDULER', 'All schedules stopped');
}

// ─── Get Status ─────────────────────────────────────────────
function getStatus() {
  return {
    cronJobs: _cronJobs.size,
    fileWatchers: _watchers.size,
    agents: [
      ...Array.from(_cronJobs.keys()).map((id) => ({ id, type: 'cron' })),
      ...Array.from(_watchers.keys()).map((id) => ({ id, type: 'file_watch' })),
    ],
  };
}

module.exports = { init, startAll, scheduleAgent, unscheduleAgent, stopAll, getStatus };
