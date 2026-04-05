import { useState } from 'react';
import {
  Play, CheckCircle2, Cpu, RefreshCw, Wrench, Layers,
  StopCircle, XCircle, AlertTriangle, Info, ChevronDown,
} from 'lucide-react';

export function categorizeLog(log) {
  const msg = log.message;
  const lower = msg.toLowerCase();
  if (msg === 'Run started') return { icon: Play, color: 'text-dax-success', bg: 'bg-dax-success', label: msg };
  if (lower.includes('llm completed') || lower.includes('run completed')) return { icon: CheckCircle2, color: 'text-dax-success', bg: 'bg-dax-success', label: msg };
  if (lower.startsWith('calling llm')) return { icon: Cpu, color: 'text-blue-400', bg: 'bg-blue-400', label: msg };
  if (lower.startsWith('iteration ') || lower.startsWith('retrying')) return { icon: RefreshCw, color: 'text-dax-info', bg: 'bg-dax-info', label: msg };
  if (lower.startsWith('executing tool:')) return { icon: Wrench, color: 'text-amber-400', bg: 'bg-amber-400', label: msg };
  if (lower.includes('tool call')) return { icon: Layers, color: 'text-dax-accent', bg: 'bg-dax-accent', label: msg };
  if (lower.includes('cancelled')) return { icon: StopCircle, color: 'text-dax-warning', bg: 'bg-dax-warning', label: msg };
  if (log.level === 'error') return { icon: XCircle, color: 'text-dax-error', bg: 'bg-dax-error', label: msg };
  if (log.level === 'warn') return { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400', label: msg };
  return { icon: Info, color: 'text-dax-text-dim', bg: 'bg-dax-text-dim', label: msg };
}

export function TimelineEntry({ log, runStartTime, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const cat = categorizeLog(log);
  const Icon = cat.icon;

  let parsed = null;
  try { parsed = log.data ? JSON.parse(log.data) : null; } catch (_) {}
  const hasData = parsed && Object.keys(parsed).length > 0;

  const elapsed = runStartTime
    ? ((new Date(log.timestamp) - new Date(runStartTime)) / 1000).toFixed(2)
    : null;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center w-6 shrink-0">
        <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${cat.bg}`} />
        {!isLast && <div className="w-px flex-1 bg-dax-panel-border mt-1" />}
      </div>

      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Icon size={13} className={`shrink-0 ${cat.color}`} />
            <span className={`text-xs font-medium truncate ${cat.color}`}>{cat.label}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {elapsed !== null && (
              <span className="text-[10px] text-dax-text-dim font-mono">+{elapsed}s</span>
            )}
            {hasData && (
              <button
                onClick={() => setExpanded((p) => !p)}
                className="text-dax-text-dim hover:text-dax-text transition-fast"
              >
                <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {parsed && !expanded && (
          <div className="mt-0.5 text-[11px] text-dax-text-dim truncate">
            {parsed.model && <span className="mr-2">model: {parsed.model}</span>}
            {parsed.tools !== undefined && <span className="mr-2">{parsed.tools} tools</span>}
            {parsed.tokens !== undefined && <span className="mr-2">{parsed.tokens?.toLocaleString()} tokens</span>}
            {parsed.iterations !== undefined && <span className="mr-2">{parsed.iterations} iters</span>}
            {typeof parsed.args === 'object' && <span className="mr-2 font-mono">{JSON.stringify(parsed.args).slice(0, 60)}</span>}
          </div>
        )}

        {expanded && hasData && (
          <pre className="mt-1.5 text-[10px] text-dax-text font-mono bg-dax-card/60 border border-dax-panel-border rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

export default function RunTimeline({ logs, runStartedAt }) {
  if (!logs || logs.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-3">
        Timeline ({logs.length} events)
      </div>
      <div>
        {logs.map((log, i) => (
          <TimelineEntry
            key={i}
            log={log}
            runStartTime={runStartedAt}
            isLast={i === logs.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
