import { useEffect, useState, useCallback } from 'react';
import { Activity, Cpu, HardDrive, Zap, Clock, BarChart3, RefreshCw } from 'lucide-react';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms) {
  if (!ms) return '0ms';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatUptime(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-dax-accent' }) {
  return (
    <div className="agent-card p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={12} className={`${color} shrink-0`} />
        <span className="text-[10px] text-dax-text-dim uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-sm font-semibold text-dax-text-bright">{value}</div>
      {sub && <div className="text-[10px] text-dax-text-dim mt-0.5">{sub}</div>}
    </div>
  );
}

function HistogramBar({ label, data }) {
  if (!data) return null;
  return (
    <div className="flex items-center justify-between text-[10px] py-1 border-b border-dax-panel-border/30 last:border-0">
      <span className="text-dax-text-dim">{label}</span>
      <div className="flex items-center gap-3 text-dax-text-bright">
        <span>avg {formatDuration(data.avg)}</span>
        <span className="text-dax-text-dim">min {formatDuration(data.min)}</span>
        <span className="text-dax-text-dim">max {formatDuration(data.max)}</span>
        <span className="text-dax-accent">{data.count}×</span>
      </div>
    </div>
  );
}

export default function MetricsPanel() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await window.dax?.metrics?.get?.();
      if (data) { setMetrics(data); setError(null); }
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    const off = window.dax?.on?.runCompleted?.(refresh);
    return () => { clearInterval(interval); off?.(); };
  }, [refresh]);

  if (!metrics) {
    return (
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={14} className="text-dax-accent" />
          <span className="text-xs font-semibold text-dax-text-bright uppercase tracking-wide">Service Metrics</span>
        </div>
        <div className="agent-card p-4 text-center text-xs text-dax-text-dim">
          {error ? `Failed to load metrics: ${error}` : 'Loading metrics...'}
        </div>
      </div>
    );
  }

  const c = metrics.counters || {};
  const g = metrics.gauges || {};
  const h = metrics.histograms || {};

  const successRate = c.runs_completed > 0
    ? Math.round(((c.runs_completed - (c.runs_errored || 0)) / c.runs_completed) * 100)
    : null;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-dax-accent" />
          <span className="text-xs font-semibold text-dax-text-bright uppercase tracking-wide">Service Metrics</span>
          <span className="text-[10px] text-dax-text-dim">uptime {formatUptime(metrics.uptimeMs)}</span>
        </div>
        <button onClick={refresh} className="p-1 rounded hover:bg-dax-card text-dax-text-dim hover:text-dax-text transition-fast" title="Refresh">
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
        <StatCard icon={Zap} label="Runs Started" value={c.runs_started || 0} color="text-blue-400" />
        <StatCard icon={Activity} label="Completed" value={c.runs_completed || 0}
          sub={successRate !== null ? `${successRate}% success` : undefined}
          color="text-emerald-400" />
        <StatCard icon={Activity} label="Errors" value={c.runs_errored || 0} color="text-red-400" />
        <StatCard icon={Zap} label="Tokens Used" value={(c.tokens_used || 0).toLocaleString()} color="text-amber-400" />
        <StatCard icon={Cpu} label="Memory" value={formatBytes(g.memory_rss || g.memory_heap_used)}
          sub={g.memory_heap_used ? `heap ${formatBytes(g.memory_heap_used)}` : undefined}
          color="text-purple-400" />
        <StatCard icon={HardDrive} label="DB Size" value={formatBytes(g.db_size_bytes)} color="text-cyan-400" />
      </div>

      {/* IPC & Timing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* IPC Stats */}
        <div className="agent-card p-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={12} className="text-dax-accent" />
            <span className="text-[10px] text-dax-text-dim uppercase tracking-wide">IPC Overview</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-sm font-semibold text-dax-text-bright">{(c.ipc_calls || 0).toLocaleString()}</div>
              <div className="text-[9px] text-dax-text-dim">Total Calls</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-red-400">{c.ipc_errors || 0}</div>
              <div className="text-[9px] text-dax-text-dim">Errors</div>
            </div>
            <div>
              <div className="text-sm font-semibold text-dax-text-bright">{c.webhook_requests || 0}</div>
              <div className="text-[9px] text-dax-text-dim">Webhooks</div>
            </div>
          </div>
        </div>

        {/* Timing Histograms */}
        <div className="agent-card p-3">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={12} className="text-dax-accent" />
            <span className="text-[10px] text-dax-text-dim uppercase tracking-wide">Timing</span>
          </div>
          <HistogramBar label="Run Duration" data={h.run_duration_ms} />
          <HistogramBar label="IPC Latency" data={h.ipc_duration_ms} />
        </div>
      </div>

      {/* Active Runs Gauge */}
      {(g.active_runs > 0) && (
        <div className="mt-2 flex items-center gap-2 text-[10px]">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-dax-text-dim">{g.active_runs} active run{g.active_runs !== 1 ? 's' : ''} right now</span>
        </div>
      )}
    </div>
  );
}
