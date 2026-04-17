/**
 * MarketplaceView — REAL community agents browser.
 *
 * Reads a JSON manifest from the `dax-community-agents` GitHub repo (no server required).
 * Each entry describes an agent the user can install with one click; install creates it
 * locally via `window.dax.agents.create` (Electron) or the same IPC in browser mode.
 *
 * Manifest shape (served as raw JSON from GitHub):
 *   {
 *     "version": 1,
 *     "updated_at": "2026-04-01T00:00:00Z",
 *     "agents": [
 *       {
 *         "id":"web-researcher",
 *         "name":"Web Researcher",
 *         "description":"Scrapes and summarises web pages on a topic.",
 *         "author":"graysoft",
 *         "tags":["research","web"],
 *         "trigger_type":"manual",
 *         "system_prompt":"...",
 *         "requires_integrations":["browser"]
 *       }
 *     ]
 *   }
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Store, Search, Download, ExternalLink, Loader2, RefreshCw,
  CheckCircle2, AlertTriangle, Tag, User, Github,
} from 'lucide-react';
import HelpGuide from '../components/HelpGuide';
import { Card, Pill, PageHeader, EmptyState, Toolbar } from '../components/ui';
import bundledSeed from './marketplace-seed.json';

const MANIFEST_URL = 'https://raw.githubusercontent.com/FileShot/dax-community-agents/main/index.json';
const REPO_URL = 'https://github.com/FileShot/dax-community-agents';

export default function MarketplaceView() {
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [installing, setInstalling] = useState('');
  const [installed, setInstalled] = useState({}); // id -> agentId

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(MANIFEST_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Manifest HTTP ${res.status}`);
      const data = await res.json();
      setManifest(data);
    } catch (err) {
      // Offline / repo not yet published — fall back to bundled seed so the
      // Marketplace is always usable. Show a small note so the user knows.
      setManifest({ ...bundledSeed, source: 'bundled' });
      setError(`Using bundled catalog (live fetch failed: ${err.message})`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const tags = useMemo(() => {
    const t = new Set();
    for (const a of manifest?.agents || []) (a.tags || []).forEach((x) => t.add(x));
    return Array.from(t).sort();
  }, [manifest]);

  const filtered = useMemo(() => {
    const list = manifest?.agents || [];
    const q = query.trim().toLowerCase();
    return list.filter((a) => {
      if (activeTag && !(a.tags || []).includes(activeTag)) return false;
      if (!q) return true;
      return (
        a.name?.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.author?.toLowerCase().includes(q) ||
        (a.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [manifest, query, activeTag]);

  const install = async (entry) => {
    if (!window.dax?.agents?.create) {
      setError('Agent creation API not available');
      return;
    }
    setInstalling(entry.id);
    try {
      const created = await window.dax.agents.create({
        name: entry.name,
        description: entry.description || '',
        trigger_type: entry.trigger_type || 'manual',
        trigger_config: entry.trigger_config || {},
        system_prompt: entry.system_prompt || '',
        nodes: entry.nodes ? JSON.stringify(entry.nodes) : '[]',
        tools: entry.tools ? JSON.stringify(entry.tools) : '[]',
        model_id: entry.model_id || null,
      });
      setInstalled((prev) => ({ ...prev, [entry.id]: created?.id || true }));
    } catch (err) {
      setError(err.message || 'Install failed');
    } finally {
      setInstalling('');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Marketplace"
        subtitle={manifest ? `${manifest.agents?.length || 0} community agents · updated ${new Date(manifest.updated_at || Date.now()).toLocaleDateString()}` : 'Browse community-built agents and install with one click.'}
        icon={Store}
        actions={
          <>
            <HelpGuide page="marketplace" />
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary btn-sm"
              onClick={(e) => {
                if (window.dax?.shell?.openExternal) { e.preventDefault(); window.dax.shell.openExternal(REPO_URL); }
              }}
            >
              <Github size={13} /> Repository <ExternalLink size={10} />
            </a>
            <button onClick={load} className="btn-secondary btn-sm" disabled={loading}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </>
        }
      />

      <Toolbar>
        <div className="flex items-center gap-2 flex-1 bg-white/[0.04] rounded-xl px-3 py-2 border border-white/[0.08] focus-within:border-dax-accent/40 transition-colors">
          <Search size={14} className="text-dax-text-dim" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents by name, description, tag…"
            className="flex-1 bg-transparent text-dax-text placeholder-dax-text-dim/60 text-sm outline-none"
          />
        </div>
      </Toolbar>

      {tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-6">
          <button
            onClick={() => setActiveTag('')}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${!activeTag ? 'bg-dax-accent/15 text-dax-accent border-dax-accent/30' : 'bg-white/[0.04] text-dax-text-dim border-white/[0.08] hover:text-dax-text'}`}
          >
            All
          </button>
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTag(t === activeTag ? '' : t)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${activeTag === t ? 'bg-dax-accent/15 text-dax-accent border-dax-accent/30' : 'bg-white/[0.04] text-dax-text-dim border-white/[0.08] hover:text-dax-text'}`}
            >
              <Tag size={9} className="inline mr-1 -mt-0.5" /> {t}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-dax-text-dim">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading manifest…
        </div>
      )}

      {!loading && error && manifest && (
        <div className="mb-4 flex items-center gap-2 text-[11px] text-dax-warning bg-dax-warning/[0.08] border border-dax-warning/20 rounded-lg px-3 py-2">
          <AlertTriangle size={12} /> {error}
        </div>
      )}

      {!loading && error && !manifest && (
        <EmptyState
          icon={AlertTriangle}
          title="Could not load marketplace"
          description={error + " — check your internet connection or try Refresh. The manifest is fetched directly from GitHub."}
          action={<button onClick={load} className="btn-primary btn-sm"><RefreshCw size={12} /> Retry</button>}
        />
      )}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          icon={Store}
          title="No agents match"
          description={query || activeTag ? 'Try a different search or clear filters.' : 'The community manifest is empty. Submit an agent via pull request to the repository.'}
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((a) => {
            const isInstalled = !!installed[a.id];
            const busy = installing === a.id;
            return (
              <Card key={a.id} padding="md" className="flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-dax-text-bright leading-snug">{a.name}</h3>
                  {isInstalled && <Pill variant="success" size="xs" icon={CheckCircle2}>Installed</Pill>}
                </div>
                {a.description && (
                  <p className="text-[12px] text-dax-text-dim leading-relaxed mb-3 line-clamp-3">{a.description}</p>
                )}
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  {(a.tags || []).slice(0, 4).map((t) => (
                    <Pill key={t} size="xs" uppercase={false}>{t}</Pill>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/[0.06]">
                  <span className="text-[10px] text-dax-text-dim flex items-center gap-1">
                    <User size={9} /> {a.author || 'community'}
                  </span>
                  <button
                    onClick={() => install(a)}
                    disabled={busy || isInstalled}
                    className="btn-primary btn-sm disabled:opacity-50"
                  >
                    {busy ? <><Loader2 size={11} className="animate-spin" /> Installing</>
                      : isInstalled ? <><CheckCircle2 size={11} /> Installed</>
                      : <><Download size={11} /> Install</>}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
