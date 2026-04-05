import { useEffect, useState, useMemo } from 'react';
import {
  Bot, Zap, Clock, AlertTriangle, Play, Pause, ArrowRight,
  Activity, CheckCircle2, XCircle, Loader2, TrendingUp,
  MessageSquarePlus, Download, Upload, FileText,
} from 'lucide-react';
import useRunStore from '../stores/useRunStore';
import LiveActivityPanel from '../components/LiveActivityPanel';
import Sparkline from '../components/Sparkline';

export default function DashboardView({ onNavigate }) {
  const [agents, setAgents] = useState([]);
  const [recentRuns, setRecentRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const liveRuns = useRunStore((s) => s.liveRuns);

  const refresh = async () => {
    if (!window.dax) return;
    try {
      const [agentList, runList] = await Promise.all([
        window.dax.agents.list(),
        window.dax.runs.list(null, 20),
      ]);
      setAgents(agentList || []);
      setRecentRuns(runList || []);
    } catch (err) {
      console.error('[Dashboard] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const off1 = window.dax?.on?.runCompleted?.(refresh);
    const off2 = window.dax?.on?.runStarted?.(refresh);
    return () => { off1?.(); off2?.(); };
  }, []);

  // Build agent name map for run display
  const agentMap = useMemo(() => {
    const m = {};
    for (const a of agents) m[a.id] = a;
    return m;
  }, [agents]);

  // Stats
  const activeCount = agents.filter((a) => a.enabled).length;
  const completedRuns = recentRuns.filter((r) => r.status === 'completed').length;
  const errorRuns = recentRuns.filter((r) => r.status === 'error').length;
  const successRate = recentRuns.length > 0
    ? Math.round((completedRuns / recentRuns.length) * 100)
    : 0;

  // Sparkline data from recent runs (oldest first)
  const sparklineData = useMemo(() => {
    const sorted = [...recentRuns].reverse(); // oldest → newest
    const durations = sorted.map((r) => r.duration_ms || 0);
    const tokens = sorted.map((r) => r.tokens_used || 0);
    // Rolling success: 1 = success, 0 = error, for each run
    const success = sorted.map((r) => r.status === 'completed' ? 1 : 0);
    // Cumulative error count
    let errCount = 0;
    const errors = sorted.map((r) => { if (r.status === 'error') errCount++; return errCount; });
    return { durations, tokens, success, errors };
  }, [recentRuns]);

  const stats = [
    { label: 'Total Agents', value: agents.length, icon: Bot, accent: '--dax-accent', spark: null },
    { label: 'Active', value: activeCount, icon: Zap, accent: '--dax-success', spark: null },
    { label: 'Recent Runs', value: recentRuns.length, icon: Clock, accent: '--dax-info', spark: sparklineData.durations, sparkColor: 'rgb(var(--dax-info))' },
    { label: 'Success Rate', value: recentRuns.length > 0 ? `${successRate}%` : '--', icon: TrendingUp, accent: '--dax-success', spark: sparklineData.success, sparkColor: 'rgb(var(--dax-success))' },
    { label: 'Errors', value: errorRuns, icon: AlertTriangle, accent: '--dax-error', spark: sparklineData.errors, sparkColor: 'rgb(var(--dax-error))' },
  ];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-dax-text-dim" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-dax-text-bright">Dashboard</h1>
          <p className="text-sm text-dax-text-dim mt-1">
            {agents.length} agent{agents.length !== 1 ? 's' : ''} configured,{' '}
            {activeCount} active
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-primary btn-sm"
            onClick={() => onNavigate?.('agents')}
          >
            <Bot size={14} />
            New Agent
          </button>
          <button
            className="btn-secondary btn-sm"
            onClick={() => onNavigate?.('builder')}
          >
            <MessageSquarePlus size={14} />
            Chat Builder
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {stats.map(({ label, value, icon: Icon, accent, spark, sparkColor }) => (
          <div key={label} className="agent-card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-dax-text-dim uppercase tracking-wider font-medium">
                {label}
              </span>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `rgb(var(${accent}) / 0.1)` }}
              >
                <Icon size={13} style={{ color: `rgb(var(${accent}))` }} />
              </div>
            </div>
            <div className="flex items-end justify-between gap-2">
              <span className="text-xl font-semibold text-dax-text-bright">{value}</span>
              {spark && spark.length >= 2 && (
                <Sparkline data={spark} width={64} height={20} color={sparkColor} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Agents Row */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-dax-text-bright">Agents</h2>
          <button
            onClick={() => onNavigate?.('agents')}
            className="text-[10px] text-dax-accent hover:underline flex items-center gap-1"
          >
            View all <ArrowRight size={10} />
          </button>
        </div>

        {agents.length === 0 ? (
          <div className="agent-card p-8 text-center">
            <Bot size={36} className="text-dax-text-dim mx-auto mb-3 opacity-30" />
            <p className="text-sm text-dax-text-dim">No agents yet</p>
            <p className="text-xs text-dax-text-dim mt-1 opacity-60 mb-3">
              Create your first agent to start automating
            </p>
            <button
              className="btn-primary btn-sm"
              onClick={() => onNavigate?.('agents')}
            >
              Create Agent
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {agents.slice(0, 8).map((agent) => {
              const agentRuns = recentRuns.filter((r) => r.agent_id === agent.id);
              const lastRun = agentRuns[0];
              const agentErrors = agentRuns.filter((r) => r.status === 'error').length;
              const isRunning = [...liveRuns.values()].some((lr) => lr.agentId === agent.id);
              const liveEntry = [...liveRuns.values()].find((lr) => lr.agentId === agent.id);
              const liveStepCount = liveEntry?.steps?.length || 0;
              const liveElapsed = liveEntry?.startedAt
                ? Math.floor((Date.now() - new Date(liveEntry.startedAt).getTime()) / 1000)
                : 0;

              return (
                <div
                  key={agent.id}
                  className={`agent-card p-3 cursor-pointer transition-fast ${isRunning ? 'border-green-400/40 hover:border-green-400/60' : 'hover:border-dax-accent/30'}`}
                  onClick={() => onNavigate?.('agents')}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {isRunning ? (
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
                        </span>
                      ) : (
                        <div className={`status-dot shrink-0 ${agent.enabled ? 'status-running' : 'status-idle'}`} />
                      )}
                      <span className="text-xs font-medium text-dax-text-bright truncate">
                        {agent.name}
                      </span>
                    </div>
                    {isRunning ? (
                      <span className="flex items-center gap-1 text-[8px] font-medium text-green-400 bg-green-400/10 border border-green-400/25 rounded-full px-1.5 py-0.5 shrink-0">
                        <Loader2 size={7} className="animate-spin" />
                        Live
                      </span>
                    ) : (
                      <span className="text-[9px] text-dax-text-dim shrink-0">
                        {agent.trigger_type}
                      </span>
                    )}
                  </div>
                  {isRunning ? (
                    <div className="text-[10px] text-green-400/80 truncate mb-1.5">
                      {liveStepCount} steps · {liveElapsed}s
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 text-[9px] text-dax-text-dim">
                    <span>{agentRuns.length} runs</span>
                    {agentErrors > 0 && <span className="text-dax-error">{agentErrors} err</span>}
                    {agentRuns.length >= 2 && (
                      <Sparkline
                        data={[...agentRuns].reverse().map((r) => r.duration_ms || 0)}
                        width={40}
                        height={12}
                        color="rgb(var(--dax-accent))"
                        strokeWidth={1}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Three-panel row: Live | Latest Results | Recent */}
      <div className="grid grid-cols-3 gap-4">
        {/* Live Activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-dax-text-bright">Live</h2>
          </div>
          <LiveActivityPanel />
        </div>

        {/* Latest Results */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-dax-text-bright">Latest Results</h2>
          </div>
          {(() => {
            const completedWithResult = recentRuns.filter((r) => r.status === 'completed' && r.result);
            if (completedWithResult.length === 0) {
              return (
                <div className="agent-card p-4 text-center">
                  <FileText size={16} className="text-dax-text-dim mx-auto mb-1.5 opacity-30" />
                  <p className="text-[11px] text-dax-text-dim">No results yet</p>
                </div>
              );
            }
            return (
              <div className="space-y-2">
                {completedWithResult.slice(0, 3).map((run) => {
                  const agent = agentMap[run.agent_id];
                  let parsed = null;
                  try { parsed = typeof run.result === 'string' ? JSON.parse(run.result) : run.result; } catch (_) {}
                  const summary = parsed?.response || parsed?.output || parsed?.result || (typeof parsed === 'string' ? parsed : null);
                  const preview = summary ? String(summary).slice(0, 120) : JSON.stringify(parsed)?.slice(0, 120);
                  return (
                    <div
                      key={run.id}
                      className="agent-card p-3 cursor-pointer hover:border-dax-accent/20 transition-fast"
                      onClick={() => onNavigate?.('history')}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <CheckCircle2 size={11} className="text-dax-success shrink-0" />
                        <span className="text-[11px] text-dax-text-bright font-medium truncate">
                          {agent?.name || run.agent_id.slice(0, 8)}
                        </span>
                        <span className="text-[9px] text-dax-text-dim ml-auto shrink-0">
                          {formatTimeAgo(run.started_at)}
                        </span>
                      </div>
                      {preview && (
                        <p className="text-[10px] text-dax-text-dim line-clamp-3 font-mono leading-relaxed">
                          {preview}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-dax-text-bright">Recent</h2>
            <button
              onClick={() => onNavigate?.('history')}
              className="text-[10px] text-dax-accent hover:underline flex items-center gap-1"
            >
              Full history <ArrowRight size={10} />
            </button>
          </div>

          {recentRuns.length === 0 ? (
            <div className="agent-card p-4 text-center">
              <Activity size={16} className="text-dax-text-dim mx-auto mb-1.5 opacity-30" />
              <p className="text-[11px] text-dax-text-dim">No activity yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentRuns.slice(0, 8).map((run) => {
                const agent = agentMap[run.agent_id];
                return (
                  <div
                    key={run.id}
                    className="agent-card p-2 flex items-center gap-2 cursor-pointer hover:border-dax-accent/20 transition-fast"
                    onClick={() => onNavigate?.('history')}
                  >
                    <RunStatusIcon status={run.status} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-dax-text truncate">
                        {agent?.name || run.agent_id.slice(0, 8)}
                      </div>
                      <div className="text-[9px] text-dax-text-dim">
                        {formatTimeAgo(run.started_at)}
                        {run.duration_ms > 0 && ` · ${formatDuration(run.duration_ms)}`}
                      </div>
                    </div>
                    {run.tokens_used > 0 && (
                      <span className="text-[8px] text-dax-text-dim shrink-0">
                        {run.tokens_used}t
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RunStatusIcon({ status }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 size={14} className="text-dax-success flex-shrink-0" />;
    case 'error':
    case 'failed':
      return <XCircle size={14} className="text-dax-error flex-shrink-0" />;
    case 'running':
      return <Loader2 size={14} className="text-dax-accent animate-spin flex-shrink-0" />;
    case 'cancelled':
      return <XCircle size={14} className="text-dax-warning flex-shrink-0" />;
    default:
      return <Clock size={14} className="text-dax-text-dim flex-shrink-0" />;
  }
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}
