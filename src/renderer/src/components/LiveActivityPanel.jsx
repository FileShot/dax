import { useRef, useEffect } from 'react';
import { Loader2, Radio } from 'lucide-react';
import useRunStore from '../stores/useRunStore';
import { categorizeLog } from './RunTimeline';

export default function LiveActivityPanel() {
  const liveRuns = useRunStore((s) => s.liveRuns);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom when new steps arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [liveRuns]);

  const entries = [];
  for (const [runId, run] of liveRuns) {
    for (const step of run.steps) {
      entries.push({ runId, agentName: run.agentName, step, startedAt: run.startedAt });
    }
  }
  // Sort by timestamp
  entries.sort((a, b) => new Date(a.step.timestamp) - new Date(b.step.timestamp));

  if (liveRuns.size === 0) {
    return (
      <div className="agent-card p-4 text-center">
        <Radio size={16} className="text-dax-text-dim mx-auto mb-1.5 opacity-30" />
        <p className="text-[11px] text-dax-text-dim">No agents running</p>
      </div>
    );
  }

  return (
    <div className="agent-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-dax-panel-border">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
          </span>
          <span className="text-[10px] text-dax-text-bright uppercase tracking-wider font-medium">
            Live ({liveRuns.size} running)
          </span>
        </div>
      </div>
      <div ref={scrollRef} className="max-h-48 overflow-auto p-2 space-y-0.5">
        {entries.length === 0 ? (
          <div className="text-[11px] text-dax-text-dim text-center py-3 animate-pulse">
            Waiting for steps…
          </div>
        ) : (
          entries.slice(-30).map((entry, i) => {
            const cat = categorizeLog(entry.step);
            const Icon = cat.icon;
            const elapsed = entry.startedAt
              ? ((new Date(entry.step.timestamp) - new Date(entry.startedAt)) / 1000).toFixed(1)
              : null;
            return (
              <div key={i} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-dax-card/40 transition-fast">
                <Icon size={11} className={`shrink-0 ${cat.color}`} />
                <span className="text-[10px] text-dax-accent font-medium shrink-0">
                  {entry.agentName}
                </span>
                <span className={`text-[10px] truncate flex-1 ${cat.color}`}>
                  {entry.step.message}
                </span>
                {elapsed && (
                  <span className="text-[9px] text-dax-text-dim font-mono shrink-0">
                    +{elapsed}s
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
