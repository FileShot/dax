import { useEffect, useState } from 'react';
import { Activity, Cpu, HardDrive } from 'lucide-react';
import useRunStore from '../stores/useRunStore';

export default function StatusBar() {
  const [systemInfo, setSystemInfo] = useState(null);
  const liveRuns = useRunStore((s) => s.liveRuns);

  useEffect(() => {
    if (!window.dax) return;
    window.dax.system.info()
      .then(setSystemInfo)
      .catch((err) => console.error('[StatusBar] Failed to get system info:', err));
  }, []);

  const runCount = liveRuns.size;
  const firstRun = runCount > 0 ? [...liveRuns.values()][0] : null;
  const lastStep = firstRun?.steps?.length > 0 ? firstRun.steps[firstRun.steps.length - 1] : null;
  const stepLabel = lastStep?.message || '';

  return (
    <div className="flex items-center justify-between h-[var(--dax-statusbar-h,24px)] bg-dax-statusbar border-t border-dax-panel-border px-3 text-[11px] text-dax-text-dim select-none shrink-0">
      {/* Left */}
      <div className="flex items-center gap-4">
        <span className="text-dax-text-dim/50 text-[10px] tracking-wider" style={{ fontFamily: 'Audiowide, sans-serif' }}>GRAYSOFT</span>
        <div className="flex items-center gap-1.5">
          <div className={`status-dot ${runCount > 0 ? 'status-running' : 'status-idle'}`} />
          <span>
            {runCount} agent{runCount !== 1 ? 's' : ''} running
            {firstRun && (
              <span className="text-dax-accent ml-1">
                — {firstRun.agentName}{stepLabel ? `: ${stepLabel}` : ''}
              </span>
            )}
            {runCount > 1 && (
              <span className="text-dax-text-dim ml-1">+{runCount - 1} more</span>
            )}
          </span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        {systemInfo && (
          <>
            <div className="flex items-center gap-1">
              <Cpu size={11} />
              <span>{systemInfo.cpus} cores</span>
            </div>
            <div className="flex items-center gap-1">
              <HardDrive size={11} />
              <span>{Math.round(systemInfo.totalMemory / 1024 / 1024 / 1024)}GB RAM</span>
            </div>
          </>
        )}
        <div className="flex items-center gap-1">
          <Activity size={11} />
          <span>v0.1.0</span>
        </div>
      </div>
    </div>
  );
}
