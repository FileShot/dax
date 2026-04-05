import { useEffect, useState } from 'react';
import useRunStore from '../stores/useRunStore';
import RunTimeline from '../components/RunTimeline';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader,
  Search,
  Filter,
  ChevronRight,
  Calendar,
  Timer,
  Coins,
  Bot,
} from 'lucide-react';

const STATUS_CONFIG = {
  completed: { icon: CheckCircle, color: 'text-dax-success', dot: 'status-running', label: 'Completed' },
  running: { icon: Loader, color: 'text-dax-info', dot: 'status-running', label: 'Running' },
  error: { icon: XCircle, color: 'text-dax-error', dot: 'status-error', label: 'Error' },
  pending: { icon: Clock, color: 'text-dax-text-dim', dot: 'status-idle', label: 'Pending' },
  cancelled: { icon: AlertTriangle, color: 'text-dax-warning', dot: 'status-paused', label: 'Cancelled' },
};

function RunRow({ run, onSelect }) {
  const config = STATUS_CONFIG[run.status] || STATUS_CONFIG.pending;
  const StatusIcon = config.icon;
  const duration = run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '--';

  return (
    <div
      onClick={() => onSelect(run)}
      className="agent-card p-3 flex items-center gap-4 cursor-pointer"
    >
      <div className={`${config.color}`}>
        <StatusIcon size={16} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-dax-text-bright font-medium truncate">{run.agent_id}</span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wider ${
            run.status === 'completed' ? 'bg-dax-success/15 text-dax-success' :
            run.status === 'error' ? 'bg-dax-error/15 text-dax-error' :
            run.status === 'running' ? 'bg-dax-info/15 text-dax-info' :
            'bg-dax-text-dim/15 text-dax-text-dim'
          }`}>
            {config.label}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-[10px] text-dax-text-dim">
          <div className="flex items-center gap-1">
            <Calendar size={9} />
            <span>{new Date(run.started_at).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <Timer size={9} />
            <span>{duration}</span>
          </div>
          {run.tokens_used > 0 && (
            <div className="flex items-center gap-1">
              <Coins size={9} />
              <span>{run.tokens_used.toLocaleString()} tokens</span>
            </div>
          )}
        </div>
      </div>

      <ChevronRight size={14} className="text-dax-text-dim shrink-0" />
    </div>
  );
}

// ─── Run Detail ───────────────────────────────────────────────────────────────
function RunDetail({ run, onBack }) {
  const [fullRun, setFullRun] = useState(null);
  const [liveSteps, setLiveSteps] = useState([]);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!run || !window.dax) return;
    window.dax.runs.get(run.id)
      .then(setFullRun)
      .catch((err) => console.error('[History] Failed to get run:', err));
  }, [run?.id]);

  // Subscribe to live step events when run is active
  useEffect(() => {
    if (!run || !window.dax?.on?.runStep) return;
    const live = run.status === 'running';
    setIsLive(live);
    setLiveSteps([]);
    if (!live) return;

    const offStep = window.dax.on.runStep((data) => {
      if (data.runId !== run.id) return;
      setLiveSteps((prev) => [...prev, data.step]);
    });

    const offDone = window.dax.on.runCompleted?.((data) => {
      if (data.runId !== run.id) return;
      setIsLive(false);
      window.dax.runs.get(run.id).then(setFullRun).catch(() => {});
      offStep?.();
    });

    return () => { offStep?.(); offDone?.(); };
  }, [run?.id, run?.status]);

  if (!run) return null;

  const detail = fullRun || run;
  const config = STATUS_CONFIG[detail.status] || STATUS_CONFIG.pending;
  const StatusIcon = config.icon;

  let resultData = null;
  try { resultData = typeof detail.result === 'string' ? JSON.parse(detail.result) : detail.result; } catch (_) {}

  const timelineLogs = [...(fullRun?.logs || []), ...liveSteps];

  // Extract tool outputs from logs
  const toolOutputs = timelineLogs.reduce((acc, log) => {
    if (!log.data) return acc;
    try {
      const d = JSON.parse(log.data);
      if (d.result !== undefined || d.output !== undefined || d.content !== undefined) {
        const toolName = log.message?.replace(/^executing tool:\s*/i, '').replace(/^tool call\s*/i, '') || 'unknown';
        acc.push({ tool: toolName, data: d.result ?? d.output ?? d.content, args: d.args });
      }
    } catch (_) {}
    return acc;
  }, []);

  // Extract file writes from tool results
  const fileWrites = toolOutputs.filter((t) => {
    const tl = t.tool.toLowerCase();
    return tl.includes('write_file') || tl.includes('writefile');
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 modal-overlay" onClick={onBack}>
      <div className="bg-dax-panel border border-dax-panel-border rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[80vh] flex flex-col modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-dax-panel-border">
          <div className="flex items-center gap-2">
            <StatusIcon size={16} className={config.color} />
            <h2 className="text-sm font-semibold text-dax-text-bright">Run Details</h2>
            {isLive && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-green-400 bg-green-400/10 border border-green-400/25 rounded-full px-2 py-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <button onClick={onBack} className="text-dax-text-dim hover:text-dax-text transition-fast text-xs">Close</button>
        </div>

        <div className="p-5 overflow-auto flex-1">
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="agent-card p-3">
              <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-1">Agent</div>
              <div className="flex items-center gap-1.5 text-xs text-dax-text">
                <Bot size={12} />
                {detail.agent_id}
              </div>
            </div>
            <div className="agent-card p-3">
              <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-1">Status</div>
              <div className={`text-xs font-medium ${config.color}`}>{config.label}</div>
            </div>
            <div className="agent-card p-3">
              <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-1">Duration</div>
              <div className="text-xs text-dax-text">{detail.duration_ms ? `${(detail.duration_ms / 1000).toFixed(2)}s` : '--'}</div>
            </div>
            <div className="agent-card p-3">
              <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-1">Tokens</div>
              <div className="text-xs text-dax-text">{detail.tokens_used?.toLocaleString() || '0'}</div>
            </div>
          </div>

          {detail.error && (
            <div className="mb-5">
              <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-2">Error</div>
              <div className="agent-card p-3 border-dax-error/30">
                <pre className="text-xs text-dax-error whitespace-pre-wrap font-mono">{detail.error}</pre>
              </div>
            </div>
          )}

          {resultData && Object.keys(resultData).length > 0 && (
            <div className="mb-5">
              <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-2">Result</div>
              <div className="agent-card p-3">
                <pre className="text-xs text-dax-text whitespace-pre-wrap font-mono max-h-48 overflow-auto">{JSON.stringify(resultData, null, 2)}</pre>
              </div>
            </div>
          )}

          {toolOutputs.length > 0 && (
            <div className="mb-5">
              <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-2">
                Tool Outputs ({toolOutputs.length})
              </div>
              <div className="space-y-2">
                {toolOutputs.map((t, i) => (
                  <div key={i} className="agent-card p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-medium text-amber-400 bg-amber-400/10 rounded px-1.5 py-0.5">{t.tool}</span>
                      {t.args && (
                        <span className="text-[9px] text-dax-text-dim font-mono truncate">
                          {typeof t.args === 'object' ? JSON.stringify(t.args).slice(0, 80) : String(t.args).slice(0, 80)}
                        </span>
                      )}
                    </div>
                    <pre className="text-[10px] text-dax-text whitespace-pre-wrap font-mono max-h-32 overflow-auto">
                      {typeof t.data === 'string' ? t.data : JSON.stringify(t.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {timelineLogs.length > 0 && (
            <RunTimeline logs={timelineLogs} runStartedAt={detail.started_at} />
          )}
          {isLive && timelineLogs.length === 0 && (
            <div className="text-xs text-dax-text-dim text-center py-6 animate-pulse">Waiting for events…</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HistoryView() {
  const { runs, loading, fetch } = useRunStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRun, setSelectedRun] = useState(null);

  useEffect(() => { fetch(); }, []);

  const filtered = runs.filter((r) => {
    if (search && !r.agent_id.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  const statuses = ['all', 'completed', 'running', 'error', 'pending'];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-dax-text-bright">Run History</h1>
        <p className="text-sm text-dax-text-dim mt-1">View and inspect past agent executions</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dax-text-dim" />
          <input
            className="input pl-8 text-xs"
            placeholder="Search by agent..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 bg-dax-card/50 rounded-lg p-0.5">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium capitalize transition-smooth ${
                statusFilter === s
                  ? 'bg-dax-accent/15 text-dax-accent shadow-sm'
                  : 'text-dax-text-dim hover:text-dax-text'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Runs List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-xs text-dax-text-dim">Loading...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="agent-card p-12 text-center">
          <Clock size={36} className="text-dax-text-dim mx-auto mb-3 opacity-30" />
          <p className="text-sm text-dax-text-dim">
            {search || statusFilter !== 'all' ? 'No matching runs' : 'No runs yet'}
          </p>
          <p className="text-xs text-dax-text-dim mt-1 opacity-60">
            Agent runs will appear here after execution
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((run) => (
            <RunRow key={run.id} run={run} onSelect={setSelectedRun} />
          ))}
        </div>
      )}

      {/* Run Detail Modal */}
      {selectedRun && (
        <RunDetail run={selectedRun} onBack={() => setSelectedRun(null)} />
      )}
    </div>
  );
}
