import { useEffect, useState } from 'react';
import useAgentStore from '../stores/useAgentStore';
import useModelStore from '../stores/useModelStore';
import HelpGuide from '../components/HelpGuide';
import {
  Bot,
  Plus,
  Search,
  MoreVertical,
  Play,
  Pause,
  Trash2,
  Edit3,
  Clock,
  Zap,
  Calendar,
  ChevronDown,
  X,
  Download,
  Upload,
  Link,
  Copy,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

const TRIGGER_TYPES = [
  { value: 'manual', label: 'Manual', desc: 'Run on demand' },
  { value: 'schedule', label: 'Schedule', desc: 'Cron-based automation' },
  { value: 'webhook', label: 'Webhook', desc: 'HTTP endpoint trigger' },
  { value: 'file_watch', label: 'File Watch', desc: 'File system changes' },
  { value: 'event', label: 'Event', desc: 'Custom event listener' },
];

function agentRequiresTools(agent) {
  try {
    const nodes = JSON.parse(agent?.nodes || '[]');
    return nodes.length === 0;
  } catch (_) {
    return true;
  }
}

function getToolCallingStatusLabel(model) {
  if (!model || model.supports_tools == null) return 'Unverified';
  return Number(model.supports_tools) === 1 ? 'Verified in Dax' : 'Last tool request failed in Dax';
}

function CreateAgentModal({ onClose, onCreate, models }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('manual');
  const [cronSchedule, setCronSchedule] = useState('*/5 * * * *');
  const [modelId, setModelId] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const triggerConfig = {};
      if (triggerType === 'schedule') triggerConfig.cron = cronSchedule.trim();
      await onCreate({
        name: name.trim(),
        description: description.trim(),
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        model_id: modelId,
        system_prompt: systemPrompt.trim(),
      });
      onClose();
    } catch (err) {
      console.error('Create agent failed:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 modal-overlay" onClick={onClose}>
      <div className="bg-dax-panel border border-dax-panel-border rounded-xl w-full max-w-lg mx-4 shadow-2xl modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-dax-panel-border">
          <h2 className="text-base font-semibold text-dax-text-bright">Create Agent</h2>
          <button onClick={onClose} className="text-dax-text-dim hover:text-dax-text transition-fast">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs text-dax-text-dim mb-1.5 uppercase tracking-wide">Name</label>
            <input
              className="input"
              placeholder="My Agent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-dax-text-dim mb-1.5 uppercase tracking-wide">Description</label>
            <textarea
              className="input min-h-[60px] resize-none"
              placeholder="What does this agent do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div>
            <label className="block text-xs text-dax-text-dim mb-1.5 uppercase tracking-wide">Trigger Type</label>
            <div className="grid grid-cols-2 gap-2">
              {TRIGGER_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTriggerType(t.value)}
                  className={`text-left p-3 rounded-lg border transition-fast ${
                    triggerType === t.value
                      ? 'border-dax-accent bg-dax-accent/8 text-dax-accent'
                      : 'border-dax-card-border bg-dax-card text-dax-text-dim hover:bg-dax-card-hover'
                  }`}
                >
                  <div className="text-xs font-medium">{t.label}</div>
                  <div className="text-[10px] opacity-60 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {triggerType === 'schedule' && (
            <div>
              <label className="block text-xs text-dax-text-dim mb-1.5 uppercase tracking-wide">Cron Schedule</label>
              <input
                className="input font-mono text-xs"
                placeholder="*/5 * * * *"
                value={cronSchedule}
                onChange={(e) => setCronSchedule(e.target.value)}
              />
              <div className="text-[10px] text-dax-text-dim mt-1">e.g. */5 * * * * = every 5 minutes, */3 * * * * = every 3 minutes</div>
            </div>
          )}

          <div>
            <label className="block text-xs text-dax-text-dim mb-1.5 uppercase tracking-wide">Model</label>
            <select
              className="input"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
            >
              <option value="">Default local model</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-dax-text-dim mb-1.5 uppercase tracking-wide">System Prompt</label>
            <textarea
              className="input min-h-[80px] resize-none font-mono text-xs"
              placeholder="You are a helpful assistant that..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={!name.trim() || creating}>
              <Plus size={14} />
              {creating ? 'Creating...' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AgentCard({ agent, onSelect, isSelected, onToggle, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const triggerLabel = TRIGGER_TYPES.find((t) => t.value === agent.trigger_type)?.label || agent.trigger_type;

  return (
    <div
      onClick={() => onSelect(agent.id)}
      className={`agent-card p-4 cursor-pointer ${isSelected ? 'border-dax-accent/50' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            agent.enabled ? 'bg-dax-accent/15 text-dax-accent' : 'bg-dax-card-hover text-dax-text-dim'
          }`}>
            <Bot size={16} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-dax-text-bright">{agent.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <div className={`status-dot ${agent.enabled ? 'status-running' : 'status-idle'}`} />
              <span className="text-[11px] text-dax-text-dim">{agent.enabled ? 'Active' : 'Disabled'}</span>
            </div>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="p-1 rounded hover:bg-dax-list-hover transition-fast text-dax-text-dim"
          >
            <MoreVertical size={14} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-dax-dropdown border border-dax-dropdown-border rounded-lg shadow-xl z-10 py-1 dropdown-menu">
              <button
                onClick={(e) => { e.stopPropagation(); onToggle(agent.id); setMenuOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-dax-text hover:bg-dax-list-hover transition-fast"
              >
                {agent.enabled ? <Pause size={12} /> : <Play size={12} />}
                {agent.enabled ? 'Disable' : 'Enable'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(agent.id); setMenuOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-dax-error hover:bg-dax-list-hover transition-fast"
              >
                <Trash2 size={12} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {agent.description && (
        <p className="text-xs text-dax-text-dim mb-3 line-clamp-2">{agent.description}</p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-dax-text-dim">
        <div className="flex items-center gap-1">
          <Zap size={10} />
          <span>{triggerLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar size={10} />
          <span>{new Date(agent.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

function WebhookPanel({ agentId }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const loadInfo = async () => {
    setLoading(true);
    try {
      const data = await window.dax.webhooks.getInfo(agentId);
      setInfo(data);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { loadInfo(); }, [agentId]);

  const generateToken = async () => {
    try {
      const result = await window.dax.webhooks.generateToken(agentId);
      if (result?.token) loadInfo();
    } catch (err) {
      console.error('Failed to generate webhook token:', err);
    }
  };

  const copyUrl = () => {
    if (info?.url) {
      navigator.clipboard.writeText(info.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) return null;

  return (
    <div className="mb-5">
      <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <Link size={11} />
        Webhook Endpoint
      </div>
      <div className="agent-card p-3">
        {info?.url ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-dax-accent bg-dax-bg rounded px-2 py-1.5 font-mono overflow-x-auto whitespace-nowrap">{info.url}</code>
              <button onClick={copyUrl} className="btn-ghost p-1.5" title="Copy URL">
                <Copy size={13} className={copied ? 'text-dax-success' : ''} />
              </button>
              <button onClick={generateToken} className="btn-ghost p-1.5" title="Regenerate Token">
                <RefreshCw size={13} />
              </button>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-dax-text-dim">
              <span>POST to trigger this agent</span>
              <span>Port: {info.port}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs text-dax-text-dim">No webhook token generated</span>
            <button onClick={generateToken} className="btn-primary text-xs px-3 py-1">
              Generate Webhook URL
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentDetail({ agent, model, models, onUpdate }) {
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [inputText, setInputText] = useState('');
  const [draftModelId, setDraftModelId] = useState(agent?.model_id || '');
  const [savingModel, setSavingModel] = useState(false);

  useEffect(() => {
    setDraftModelId(agent?.model_id || '');
  }, [agent?.id, agent?.model_id]);

  const selectedModel = models.find((candidate) => candidate.id === draftModelId) || model;
  const requiresTools = agentRequiresTools(agent);
  const showToolCallingWarning = requiresTools && selectedModel && Number(selectedModel.supports_tools) === 0;
  const modelDirty = draftModelId !== (agent?.model_id || '');

  if (!agent) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Bot size={40} className="text-dax-text-dim mx-auto mb-3 opacity-30" />
          <p className="text-sm text-dax-text-dim">Select an agent to view details</p>
        </div>
      </div>
    );
  }

  const handleRun = async () => {
    setRunning(true);
    setLastResult(null);
    try {
      const triggerData = inputText.trim() ? { message: inputText.trim() } : undefined;
      const result = await window.dax.engine.run(agent.id, triggerData);
      setLastResult(result);
    } catch (err) {
      setLastResult({ status: 'error', error: err.message });
    } finally {
      setRunning(false);
    }
  };

  const handleSaveModel = async () => {
    if (!agent || !onUpdate || !modelDirty) return;
    setSavingModel(true);
    try {
      await onUpdate(agent.id, { model_id: draftModelId });
    } catch (err) {
      setLastResult({ status: 'error', error: err.message });
    } finally {
      setSavingModel(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-lg font-semibold text-dax-text-bright">{agent.name}</h2>
            <div className={`badge ${
              agent.enabled ? 'badge-success' : 'badge-neutral'
            }`}>
              {agent.enabled ? 'Active' : 'Disabled'}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRun}
              disabled={running}
              className="btn-primary"
            >
              <Play size={14} />
              {running ? 'Running...' : 'Run Now'}
            </button>
            <button
              onClick={async () => {
                try {
                  await window.dax.agents.export(agent.id);
                } catch (err) {
                  console.error('Export failed:', err);
                }
              }}
              className="btn-secondary"
              title="Export Agent"
            >
              <Download size={14} />
            </button>
          </div>
        </div>
        {agent.description && <p className="text-sm text-dax-text-dim">{agent.description}</p>}
      </div>

      {showToolCallingWarning && (
        <div className="agent-card p-3 mb-4 border-dax-error/30">
          <div className="text-xs font-medium text-dax-error mb-1">Previous tool request failed in Dax</div>
          <div className="text-xs text-dax-text-dim">
            This agent uses the simple tool loop, and a prior tool request for the selected model was rejected by the configured endpoint. That does not prove the model itself lacks tool-calling support.
          </div>
        </div>
      )}

      <div className="agent-card p-3 mb-4">
        <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-2">Model Configuration</div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <select
              value={draftModelId}
              onChange={(e) => setDraftModelId(e.target.value)}
              className="input text-sm"
            >
              <option value="">Default local model</option>
              {models.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSaveModel}
            disabled={!modelDirty || savingModel}
            className="btn-secondary"
          >
            {savingModel ? 'Saving...' : 'Save Model'}
          </button>
        </div>
      </div>

      {/* Input Area */}
      <div className="mb-4">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Enter input for the agent (optional)..."
          rows={3}
          className="w-full bg-dax-bg border border-dax-panel-border rounded-lg px-3 py-2 text-sm text-dax-text placeholder:text-dax-text-dim focus:outline-none focus:border-dax-accent resize-none"
        />
      </div>

      {lastResult && (
        <div className={`agent-card p-3 mb-5 ${lastResult.status === 'error' ? 'border-dax-error/30' : 'border-dax-success/30'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`status-dot ${lastResult.status === 'completed' ? 'status-running' : 'status-error'}`} />
            <span className="text-xs font-medium text-dax-text-bright capitalize">{lastResult.status}</span>
            {lastResult.tokens > 0 && <span className="text-[10px] text-dax-text-dim">{lastResult.tokens} tokens</span>}
          </div>
          {lastResult.result && (
            <pre className="text-xs text-dax-text whitespace-pre-wrap font-mono max-h-40 overflow-auto">{lastResult.result}</pre>
          )}
          {lastResult.error && (
            <pre className="text-xs text-dax-error whitespace-pre-wrap font-mono">{lastResult.error}</pre>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="agent-card p-3">
          <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-1">Trigger</div>
          <div className="text-sm text-dax-text">{TRIGGER_TYPES.find((t) => t.value === agent.trigger_type)?.label || agent.trigger_type}</div>
        </div>
        <div className="agent-card p-3">
          <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-1">Model</div>
          <div className="text-sm text-dax-text">{selectedModel?.name || agent.model_id || 'Not configured'}</div>
        </div>
        <div className="agent-card p-3">
          <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-1">Tool Calling Status</div>
          <div className="text-sm text-dax-text">{getToolCallingStatusLabel(selectedModel)}</div>
        </div>
        <div className="agent-card p-3">
          <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-1">Temperature</div>
          <div className="text-sm text-dax-text">{agent.temperature}</div>
        </div>
        <div className="agent-card p-3">
          <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-1">Token Budget</div>
          <div className="text-sm text-dax-text">{agent.token_budget?.toLocaleString()}</div>
        </div>
      </div>

      {/* Webhook Config — shown for webhook trigger agents */}
      {agent.trigger_type === 'webhook' && <WebhookPanel agentId={agent.id} />}

      {agent.system_prompt && (
        <div className="mb-5">
          <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-2">System Prompt</div>
          <div className="agent-card p-3">
            <pre className="text-xs text-dax-text whitespace-pre-wrap font-mono leading-relaxed">{agent.system_prompt}</pre>
          </div>
        </div>
      )}

      <div className="text-[11px] text-dax-text-dim flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Clock size={11} />
          <span>Created {new Date(agent.created_at).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <Edit3 size={11} />
          <span>Updated {new Date(agent.updated_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

export default function AgentsView() {
  const { agents, loading, selectedId, fetch, select, create, update, toggle, remove } = useAgentStore();
  const { models, fetch: fetchModels } = useModelStore();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch();
    fetchModels();
  }, []);

  const filteredAgents = agents.filter((a) => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'active') return a.enabled;
    if (filter === 'disabled') return !a.enabled;
    return true;
  });

  const selectedAgent = agents.find((a) => a.id === selectedId) || null;
  const selectedModel = models.find((m) => m.id === selectedAgent?.model_id) || null;

  const handleDelete = async (id) => {
    try {
      await remove(id);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="flex h-full">
      {/* Left Panel - Agent List */}
      <div className="w-[340px] flex flex-col border-r border-dax-panel-border shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-dax-panel-border">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-base font-semibold text-dax-text-bright">Agents</h1>
            <div className="flex gap-1">
              <HelpGuide page="agents" />
              <button
                onClick={async () => {
                  try {
                    const result = await window.dax.agents.import();
                    if (result && !result.cancelled) fetch();
                  } catch (err) {
                    console.error('Import failed:', err);
                  }
                }}
                className="btn-secondary btn-sm"
                title="Import Agent"
              >
                <Upload size={12} />
              </button>
              <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm">
                <Plus size={12} />
                New
              </button>
            </div>
          </div>

          <div className="relative mb-3">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dax-text-dim" />
            <input
              className="input pl-8 text-xs"
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-1 bg-dax-card/50 rounded-lg p-0.5">
            {['all', 'active', 'disabled'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-medium capitalize transition-smooth ${
                  filter === f
                    ? 'bg-dax-accent/15 text-dax-accent shadow-sm'
                    : 'text-dax-text-dim hover:text-dax-text'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {agents.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <button
                onClick={async () => {
                  for (const a of agents) { if (!a.enabled) await toggle(a.id); }
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-dax-text-dim hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                title="Enable all agents"
              >
                <ToggleRight size={13} /> Enable All
              </button>
              <button
                onClick={async () => {
                  for (const a of agents) { if (a.enabled) await toggle(a.id); }
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-dax-text-dim hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Disable all agents"
              >
                <ToggleLeft size={13} /> Disable All
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`Delete all ${agents.length} agents? This cannot be undone.`)) return;
                  for (const a of agents) { await remove(a.id); }
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-dax-text-dim hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete all agents"
              >
                <Trash2 size={13} /> Delete All
              </button>
            </div>
          )}
        </div>

        {/* Agent List */}
        <div className="flex-1 overflow-auto p-3 flex flex-col gap-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-xs text-dax-text-dim">Loading...</div>
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bot size={32} className="text-dax-text-dim opacity-30 mb-3" />
              <p className="text-xs text-dax-text-dim">
                {search ? 'No matching agents' : 'No agents yet'}
              </p>
              {!search && (
                <button onClick={() => setShowCreate(true)} className="btn-primary btn-sm mt-3">
                  <Plus size={12} />
                  Create your first agent
                </button>
              )}
            </div>
          ) : (
            filteredAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isSelected={selectedId === agent.id}
                onSelect={select}
                onToggle={toggle}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Agent Detail */}
      <AgentDetail key={selectedAgent?.id} agent={selectedAgent} model={selectedModel} models={models} onUpdate={update} />

      {/* Create Modal */}
      {showCreate && (
        <CreateAgentModal
          onClose={() => setShowCreate(false)}
          onCreate={create}
          models={models}
        />
      )}
    </div>
  );
}
