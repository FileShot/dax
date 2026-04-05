import { useEffect, useState, useCallback } from 'react';
import {
  Activity, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Loader2, Shield, ShieldAlert, ShieldCheck, Zap, Clock,
} from 'lucide-react';

const CIRCUIT_LABELS = { closed: 'Healthy', open: 'Circuit Open', half_open: 'Recovering' };
const CIRCUIT_COLORS = {
  closed: 'text-dax-success',
  open: 'text-dax-error',
  half_open: 'text-amber-400',
};
const CIRCUIT_BG = {
  closed: 'bg-dax-success/10',
  open: 'bg-dax-error/10',
  half_open: 'bg-amber-400/10',
};
const CIRCUIT_ICONS = { closed: ShieldCheck, open: ShieldAlert, half_open: Shield };

function BudgetBar({ errors, limit = 10 }) {
  const pct = Math.round(((limit - errors) / limit) * 100);
  const color = errors >= limit ? 'bg-dax-error' : errors >= limit * 0.7 ? 'bg-amber-400' : 'bg-dax-success';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-dax-panel-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <span className="text-[11px] text-dax-text-dim w-14 text-right shrink-0">
        {limit - errors}/{limit} left
      </span>
    </div>
  );
}

export default function HealthView() {
  const [integrations, setIntegrations] = useState([]);
  const [circuits, setCircuits] = useState({});
  const [budgets, setBudgets] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'issues'
  const [lastRefresh, setLastRefresh] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [intList, circuitData, budgetData] = await Promise.all([
        window.dax?.integrations?.list?.() ?? [],
        window.dax?.health?.circuitStatus?.() ?? {},
        window.dax?.health?.errorBudgetStatus?.() ?? {},
      ]);
      setIntegrations(intList || []);
      setCircuits(circuitData || {});
      setBudgets(budgetData || {});
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[Health] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  }, [refresh]);

  // Enrich integrations with circuit + budget data
  const enriched = integrations
    .filter((i) => i.connected)
    .map((i) => {
      const c = circuits[i.id] || { state: 'closed', failures: 0, openedAt: null };
      const b = budgets[i.id] || { total: 0, errors: 0, budget: 10, exhausted: false };
      const circuitState = c.state || 'closed';
      const hasIssue = circuitState !== 'closed' || b.exhausted || b.errors >= 7;
      return { ...i, circuitState, failures: c.failures, openedAt: c.openedAt, budget: b, hasIssue };
    });

  const displayed = filter === 'issues' ? enriched.filter((i) => i.hasIssue) : enriched;

  // Stats
  const connected = integrations.filter((i) => i.connected).length;
  const openCircuits = enriched.filter((i) => i.circuitState === 'open').length;
  const recovering = enriched.filter((i) => i.circuitState === 'half_open').length;
  const budgetExhausted = enriched.filter((i) => i.budget.exhausted).length;
  const healthy = enriched.filter((i) => !i.hasIssue).length;

  const stats = [
    { label: 'Connected', value: connected, icon: Zap, accent: '--dax-accent' },
    { label: 'Healthy', value: healthy, icon: CheckCircle2, accent: '--dax-success' },
    { label: 'Circuits Open', value: openCircuits, icon: ShieldAlert, accent: '--dax-error' },
    { label: 'Recovering', value: recovering, icon: Shield, accent: 'rgb(251 191 36)' },
    { label: 'Budget Exhausted', value: budgetExhausted, icon: AlertTriangle, accent: '--dax-error' },
  ];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-dax-text-dim" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-dax-text-bright flex items-center gap-2">
            <Activity size={22} className="text-dax-accent" />
            Integration Health
          </h1>
          <p className="text-sm text-dax-text-dim mt-1">
            Circuit breaker states and error budgets &mdash; auto-refreshes every 10s
            {lastRefresh && (
              <span className="ml-2 opacity-60">
                · Updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button className="btn-secondary btn-sm" onClick={refresh}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {stats.map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="agent-card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-dax-text-dim uppercase tracking-wider font-medium">{label}</span>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: accent.startsWith('--') ? `rgb(var(${accent}) / 0.1)` : `${accent}1a` }}
              >
                <Icon size={13} style={{ color: accent.startsWith('--') ? `rgb(var(${accent}))` : accent }} />
              </div>
            </div>
            <span className={`text-xl font-semibold ${value > 0 && label !== 'Healthy' && label !== 'Connected' ? 'text-dax-error' : 'text-dax-text-bright'}`}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Filter + Table */}
      <div className="agent-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-dax-panel-border">
          <h2 className="text-sm font-medium text-dax-text-bright">Connected Integrations</h2>
          <div className="flex gap-1">
            {['all', 'issues'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  filter === f
                    ? 'bg-dax-accent/15 text-dax-accent'
                    : 'text-dax-text-dim hover:text-dax-text hover:bg-dax-list-hover'
                }`}
              >
                {f === 'all' ? 'All' : 'Issues Only'}
                {f === 'issues' && enriched.filter((i) => i.hasIssue).length > 0 && (
                  <span className="ml-1.5 bg-dax-error/20 text-dax-error text-[10px] px-1.5 py-0.5 rounded-full">
                    {enriched.filter((i) => i.hasIssue).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {displayed.length === 0 ? (
          <div className="py-12 text-center text-dax-text-dim text-sm">
            {filter === 'issues'
              ? <span className="flex flex-col items-center gap-2"><CheckCircle2 size={28} className="text-dax-success opacity-70" />All integrations are healthy</span>
              : 'No connected integrations. Connect some from the Integrations tab.'}
          </div>
        ) : (
          <div className="divide-y divide-dax-panel-border">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_120px_180px_160px] gap-4 px-4 py-2 text-[10px] text-dax-text-dim uppercase tracking-wider font-medium">
              <span>Integration</span>
              <span>Circuit</span>
              <span>Error Budget (5 min)</span>
              <span>Failures</span>
            </div>
            {displayed.map((integ) => {
              const CircuitIcon = CIRCUIT_ICONS[integ.circuitState];
              return (
                <div
                  key={integ.id}
                  className="grid grid-cols-[1fr_120px_180px_160px] gap-4 px-4 py-3 items-center hover:bg-dax-list-hover transition-colors"
                >
                  {/* Name */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-dax-accent/8 flex items-center justify-center flex-shrink-0">
                      <Zap size={13} className="text-dax-accent" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-dax-text-bright truncate">{integ.name}</div>
                      <div className="text-[11px] text-dax-text-dim truncate">{integ.category || 'general'}</div>
                    </div>
                  </div>

                  {/* Circuit state */}
                  <div>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${CIRCUIT_BG[integ.circuitState]} ${CIRCUIT_COLORS[integ.circuitState]}`}>
                      <CircuitIcon size={11} />
                      {CIRCUIT_LABELS[integ.circuitState]}
                    </span>
                  </div>

                  {/* Error budget bar */}
                  <BudgetBar errors={integ.budget.errors} limit={10} />

                  {/* Failures count + open time */}
                  <div className="text-sm text-dax-text-dim">
                    {integ.failures > 0 ? (
                      <span className={integ.failures >= 5 ? 'text-dax-error font-medium' : integ.failures >= 3 ? 'text-amber-400' : ''}>
                        {integ.failures} failure{integ.failures !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-dax-success text-xs">No failures</span>
                    )}
                    {integ.openedAt && (
                      <div className="text-[11px] text-dax-text-dim mt-0.5 flex items-center gap-1">
                        <Clock size={10} />
                        Opened {new Date(integ.openedAt).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 px-1">
        <span className="text-[11px] text-dax-text-dim">Circuit states:</span>
        {Object.entries(CIRCUIT_LABELS).map(([state, label]) => {
          const Icon = CIRCUIT_ICONS[state];
          return (
            <span key={state} className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${CIRCUIT_COLORS[state]}`}>
              <Icon size={11} />{label}
            </span>
          );
        })}
        <span className="text-[11px] text-dax-text-dim ml-4">Error budget resets every 5 minutes.</span>
      </div>
    </div>
  );
}
