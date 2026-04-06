import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Search, Download, Loader2, Check, HardDrive,
  Star, ArrowDownToLine, Trash2, ExternalLink, Filter,
  ChevronDown, ChevronRight, RefreshCw, AlertTriangle, X,
} from 'lucide-react';
import useModelStore from '../stores/useModelStore';
import HelpGuide from '../components/HelpGuide';

// ── Curated model recommendations ──────────────────────────
const CURATED_MODELS = [
  {
    category: 'General Purpose',
    models: [
      { repo: 'bartowski/Llama-3.1-8B-Instruct-GGUF', name: 'Llama 3.1 8B Instruct', file: 'Llama-3.1-8B-Instruct-Q4_K_M.gguf', size: '4.9 GB', params: '8B', quant: 'Q4_K_M', desc: 'Meta\'s latest general-purpose model. Great balance of quality and speed.' },
      { repo: 'bartowski/Mistral-7B-Instruct-v0.3-GGUF', name: 'Mistral 7B v0.3', file: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf', size: '4.4 GB', params: '7B', quant: 'Q4_K_M', desc: 'Fast and capable instruction-following model from Mistral AI.' },
      { repo: 'bartowski/gemma-2-9b-it-GGUF', name: 'Gemma 2 9B', file: 'gemma-2-9b-it-Q4_K_M.gguf', size: '5.8 GB', params: '9B', quant: 'Q4_K_M', desc: 'Google\'s efficient open model. Strong reasoning capabilities.' },
      { repo: 'bartowski/Phi-3.5-mini-instruct-GGUF', name: 'Phi 3.5 Mini', file: 'Phi-3.5-mini-instruct-Q4_K_M.gguf', size: '2.2 GB', params: '3.8B', quant: 'Q4_K_M', desc: 'Microsoft\'s compact powerhouse. Excellent for resource-constrained setups.' },
    ],
  },
  {
    category: 'Coding',
    models: [
      { repo: 'bartowski/DeepSeek-Coder-V2-Lite-Instruct-GGUF', name: 'DeepSeek Coder V2 Lite', file: 'DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M.gguf', size: '9.4 GB', params: '16B', quant: 'Q4_K_M', desc: 'Specialized code generation model with multi-language support.' },
      { repo: 'bartowski/Qwen2.5-Coder-7B-Instruct-GGUF', name: 'Qwen 2.5 Coder 7B', file: 'Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf', size: '4.7 GB', params: '7B', quant: 'Q4_K_M', desc: 'Alibaba\'s coding model. Strong at code completion and generation.' },
    ],
  },
  {
    category: 'Small & Fast',
    models: [
      { repo: 'bartowski/Qwen2.5-3B-Instruct-GGUF', name: 'Qwen 2.5 3B', file: 'Qwen2.5-3B-Instruct-Q4_K_M.gguf', size: '2.0 GB', params: '3B', quant: 'Q4_K_M', desc: 'Compact but capable. Runs well on CPUs with 4GB+ RAM.' },
      { repo: 'bartowski/Llama-3.2-1B-Instruct-GGUF', name: 'Llama 3.2 1B', file: 'Llama-3.2-1B-Instruct-Q8_0.gguf', size: '1.3 GB', params: '1B', quant: 'Q8_0', desc: 'Ultra-light model for fast inference. Good for simple tasks.' },
      { repo: 'bartowski/SmolLM2-1.7B-Instruct-GGUF', name: 'SmolLM2 1.7B', file: 'SmolLM2-1.7B-Instruct-Q4_K_M.gguf', size: '1.0 GB', params: '1.7B', quant: 'Q4_K_M', desc: 'Hugging Face\'s small language model. Great for edge deployments.' },
    ],
  },
  {
    category: 'Large & Powerful',
    models: [
      { repo: 'bartowski/Llama-3.1-70B-Instruct-GGUF', name: 'Llama 3.1 70B', file: 'Llama-3.1-70B-Instruct-Q4_K_M.gguf', size: '42 GB', params: '70B', quant: 'Q4_K_M', desc: 'State-of-the-art open model. Requires 48GB+ RAM or GPU offloading.' },
      { repo: 'bartowski/Mixtral-8x7B-Instruct-v0.1-GGUF', name: 'Mixtral 8x7B', file: 'Mixtral-8x7B-Instruct-v0.1-Q4_K_M.gguf', size: '26 GB', params: '47B MoE', quant: 'Q4_K_M', desc: 'Mixture of Experts architecture. Fast for its size, high quality.' },
    ],
  },
];

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatNumber(n) {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ── Download state management ──────────────────────────────
function useDownloadProgress() {
  const [downloads, setDownloads] = useState({});

  useEffect(() => {
    if (!window.dax?.models?.onDownloadProgress) return;
    const unsub = window.dax.models.onDownloadProgress((data) => {
      setDownloads((prev) => ({
        ...prev,
        [data.filename]: data,
      }));
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  return downloads;
}

// ── Curated Model Card ─────────────────────────────────────
function CuratedCard({ model, onDownload, downloading, installed }) {
  const dlUrl = `https://huggingface.co/${model.repo}/resolve/main/${model.file}`;

  return (
    <div className="agent-card p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-semibold text-dax-text-bright truncate">{model.name}</h4>
          <p className="text-[10px] text-dax-text-dim mt-0.5 line-clamp-2">{model.desc}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[9px] text-dax-text-dim mb-2.5">
        <span className="px-1.5 py-0.5 bg-dax-accent/10 text-dax-accent rounded font-medium">{model.params}</span>
        <span className="px-1.5 py-0.5 bg-gray-700/50 rounded">{model.quant}</span>
        <span>{model.size}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {installed ? (
          <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium">
            <Check size={10} /> Installed
          </span>
        ) : downloading ? (
          <div className="flex-1">
            <div className="flex items-center justify-between text-[9px] text-dax-text-dim mb-1">
              <span>Downloading…</span>
              <span>{downloading.percent}%</span>
            </div>
            <div className="w-full bg-gray-700/50 rounded-full h-1">
              <div className="bg-blue-500 h-1 rounded-full transition-all" style={{ width: `${downloading.percent}%` }} />
            </div>
          </div>
        ) : (
          <button
            onClick={() => onDownload(dlUrl, model.file)}
            className="btn-primary btn-xs flex items-center gap-1 text-[10px]"
          >
            <Download size={10} /> Download
          </button>
        )}
        <a
          href={`https://huggingface.co/${model.repo}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 text-gray-500 hover:text-gray-300 transition-colors ml-auto"
          title="View on HuggingFace"
        >
          <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}

// ── Search Result Card ─────────────────────────────────────
function SearchResultCard({ model, onDownload, downloads, installedNames }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="agent-card p-3">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-xs font-semibold text-dax-text-bright truncate">{model.name}</h4>
            <span className="text-[9px] text-dax-text-dim">by {model.author}</span>
          </div>
          <div className="flex items-center gap-3 text-[9px] text-dax-text-dim">
            <span className="flex items-center gap-0.5"><ArrowDownToLine size={8} /> {formatNumber(model.downloads)}</span>
            <span className="flex items-center gap-0.5"><Star size={8} /> {formatNumber(model.likes)}</span>
            {model.pipeline && <span className="px-1.5 py-0.5 bg-gray-700/50 rounded">{model.pipeline}</span>}
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      </div>

      {expanded && model.files.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-700/30 space-y-1.5">
          {model.files.map((f) => {
            const dl = downloads[f.filename];
            const isInstalled = installedNames.has(f.filename.replace('.gguf', ''));

            return (
              <div key={f.filename} className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-dax-text truncate">{f.filename}</span>
                  {f.size && <span className="text-dax-text-dim shrink-0">{formatBytes(f.size)}</span>}
                </div>
                {isInstalled ? (
                  <span className="text-green-400 flex items-center gap-0.5 shrink-0"><Check size={8} /> Installed</span>
                ) : dl && !dl.done ? (
                  <span className="text-blue-400 shrink-0">{dl.percent}%</span>
                ) : (
                  <button
                    onClick={() => onDownload(f.url, f.filename)}
                    className="text-dax-accent hover:text-blue-400 transition-colors shrink-0 flex items-center gap-0.5"
                  >
                    <Download size={9} /> Download
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {expanded && model.files.length === 0 && (
        <p className="text-[10px] text-dax-text-dim mt-2 pt-2 border-t border-gray-700/30">
          No GGUF files found. Visit the model page to check available formats.
        </p>
      )}
    </div>
  );
}

// ── Installed Model Row ────────────────────────────────────
function InstalledModelRow({ model, onDelete }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-gray-800/30 rounded-lg transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <HardDrive size={13} className="text-green-400 shrink-0" />
        <span className="text-xs text-dax-text-bright truncate">{model.name}</span>
        <span className="text-[9px] text-dax-text-dim">{model.provider || 'local'}</span>
      </div>
      <button
        onClick={() => onDelete(model.id)}
        className="p-1 text-gray-600 hover:text-red-400 transition-colors"
        title="Remove"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

// ── Main ModelsView ────────────────────────────────────────
export default function ModelsView() {
  const { models, loading, fetch: fetchModels, remove } = useModelStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [activeTab, setActiveTab] = useState('discover'); // discover | installed
  const downloads = useDownloadProgress();
  const searchTimeoutRef = useRef(null);

  useEffect(() => { fetchModels(); }, []);

  const installedNames = new Set(models.map(m => m.name));

  const handleSearch = useCallback(async (q) => {
    const query = q ?? searchQuery;
    if (!query.trim()) { setSearchResults([]); return; }
    setSearching(true);
    setSearchError('');
    try {
      const results = await window.dax.models.searchHF({ query: query.trim(), limit: 20 });
      setSearchResults(results || []);
    } catch (err) {
      setSearchError(err.message || 'Search failed');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const handleSearchInput = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    clearTimeout(searchTimeoutRef.current);
    if (val.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => handleSearch(val), 500);
    } else {
      setSearchResults([]);
    }
  };

  const handleDownload = useCallback(async (url, filename) => {
    try {
      await window.dax.models.download({ url, filename });
    } catch (err) {
      console.error('Download failed:', err);
    }
  }, []);

  const handleDelete = useCallback(async (id) => {
    try {
      await remove(id);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }, [remove]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-dax-text-bright flex items-center gap-2">
            <Box size={22} className="text-dax-accent" />
            Models
          </h1>
          <p className="text-sm text-dax-text-dim mt-1">
            {models.length} model{models.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <div className="flex gap-2">
          <HelpGuide page="models" />
          <button onClick={fetchModels} className="btn-secondary btn-sm flex items-center gap-1.5" disabled={loading}>
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 border-b border-gray-800/50">
        {[
          { id: 'discover', label: 'Discover', count: null },
          { id: 'installed', label: 'Installed', count: models.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-dax-accent text-dax-accent'
                : 'border-transparent text-dax-text-dim hover:text-dax-text'
            }`}
          >
            {tab.label}
            {tab.count != null && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-gray-700/50 rounded text-[9px]">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'discover' && (
        <>
          {/* Search Bar */}
          <div className="mb-6">
            <div className="flex items-center gap-2 bg-gray-800/50 rounded-xl px-3 py-2 border border-gray-700/50 focus-within:border-dax-accent/50 transition-colors">
              <Search size={14} className="text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchInput}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search HuggingFace for GGUF models…"
                className="flex-1 bg-transparent text-gray-100 placeholder-gray-500 text-sm outline-none"
              />
              {searching && <Loader2 size={14} className="text-dax-accent animate-spin" />}
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="text-gray-500 hover:text-gray-300">
                  <X size={14} />
                </button>
              )}
            </div>
            {searchError && (
              <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                <AlertTriangle size={9} /> {searchError}
              </p>
            )}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-medium text-dax-text-bright mb-3 flex items-center gap-2">
                <Search size={13} />
                Search Results
                <span className="text-[10px] text-dax-text-dim font-normal">({searchResults.length})</span>
              </h2>
              <div className="space-y-2">
                {searchResults.map((m) => (
                  <SearchResultCard
                    key={m.id}
                    model={m}
                    onDownload={handleDownload}
                    downloads={downloads}
                    installedNames={installedNames}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Curated Picks */}
          {!searchQuery && (
            <div className="space-y-6">
              {CURATED_MODELS.map((section) => (
                <div key={section.category}>
                  <h2 className="text-sm font-medium text-dax-text-bright mb-3">{section.category}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {section.models.map((m) => (
                      <CuratedCard
                        key={m.file}
                        model={m}
                        onDownload={handleDownload}
                        downloading={downloads[m.file]}
                        installed={installedNames.has(m.name)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'installed' && (
        <div>
          {models.length === 0 ? (
            <div className="text-center py-12">
              <HardDrive size={32} className="text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-dax-text-dim mb-1">No models configured</p>
              <p className="text-[10px] text-dax-text-dim">
                Download a model from the Discover tab or add one manually
              </p>
            </div>
          ) : (
            <div className="agent-card divide-y divide-gray-800/30">
              {models.map((m) => (
                <InstalledModelRow key={m.id} model={m} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Downloads */}
      {Object.values(downloads).some(d => !d.done && d.percent < 100) && (
        <div className="fixed bottom-14 right-6 w-72 bg-gray-900 border border-gray-700 rounded-xl p-3 shadow-xl z-50">
          <h4 className="text-[10px] text-dax-text-dim uppercase tracking-wider font-medium mb-2">Downloading</h4>
          {Object.entries(downloads)
            .filter(([_, d]) => !d.done && d.percent < 100)
            .map(([name, d]) => (
              <div key={name} className="mb-2">
                <div className="flex items-center justify-between text-[10px] text-gray-300 mb-1">
                  <span className="truncate">{name}</span>
                  <span>{d.percent}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1">
                  <div className="bg-blue-500 h-1 rounded-full transition-all" style={{ width: `${d.percent}%` }} />
                </div>
                <div className="text-[9px] text-gray-500 mt-0.5">
                  {formatBytes(d.downloaded)} / {formatBytes(d.total)}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
