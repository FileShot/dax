import { useEffect, useState } from 'react';
import {
  Users,
  Plus,
  Play,
  Trash2,
  Edit3,
  ChevronDown,
  X,
  Bot,
  Crown,
  ArrowRight,
} from 'lucide-react';

const STRATEGIES = [
  { value: 'sequential', label: 'Sequential', desc: 'Agents run in order, passing output to the next' },
  { value: 'hierarchical', label: 'Hierarchical', desc: 'First agent is manager, delegates to workers' },
];

function CreateCrewModal({ onClose, onCreate, agents }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [strategy, setStrategy] = useState('sequential');
  const [selectedAgents, setSelectedAgents] = useState([]);

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      description: description.trim(),
      strategy,
      agents: selectedAgents.map((id, idx) => ({ id, role: agents.find(a => a.id === id)?.name || `Agent ${idx + 1}` })),
      max_rounds: 10,
    });
    onClose();
  };

  const toggleAgent = (id) => {
    setSelectedAgents((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-dax-panel border border-dax-panel-border rounded-xl w-full max-w-lg mx-4 shadow-2xl modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-dax-panel-border">
          <h3 className="text-sm font-semibold text-dax-text-bright">Create Crew</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Crew name..."
            className="w-full bg-dax-bg border border-dax-panel-border rounded-lg px-3 py-2 text-sm text-dax-text placeholder:text-dax-text-dim focus:outline-none focus:border-dax-accent"
            autoFocus
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)..."
            rows={2}
            className="w-full bg-dax-bg border border-dax-panel-border rounded-lg px-3 py-2 text-sm text-dax-text placeholder:text-dax-text-dim focus:outline-none focus:border-dax-accent resize-none"
          />
          <div>
            <label className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-2 block">Strategy</label>
            <div className="grid grid-cols-2 gap-2">
              {STRATEGIES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStrategy(s.value)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    strategy === s.value
                      ? 'border-dax-accent bg-dax-accent/10 text-dax-accent'
                      : 'border-dax-panel-border text-dax-text-dim hover:border-dax-text-dim'
                  }`}
                >
                  <div className="text-xs font-medium">{s.label}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-2 block">
              Select Agents ({selectedAgents.length} selected)
            </label>
            <div className="max-h-40 overflow-auto space-y-1">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => toggleAgent(agent.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-all ${
                    selectedAgents.includes(agent.id)
                      ? 'bg-dax-accent/10 text-dax-accent border border-dax-accent/30'
                      : 'bg-dax-bg text-dax-text-dim border border-transparent hover:bg-dax-bg/80'
                  }`}
                >
                  <Bot size={14} />
                  <span className="flex-1">{agent.name}</span>
                  {selectedAgents.includes(agent.id) && (
                    <span className="text-[10px] opacity-60">#{selectedAgents.indexOf(agent.id) + 1}</span>
                  )}
                </button>
              ))}
              {agents.length === 0 && (
                <div className="text-xs text-dax-text-dim text-center py-3">No agents created yet</div>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-dax-panel-border">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || selectedAgents.length < 2}
            className="btn-primary"
          >
            <Plus size={14} /> Create Crew
          </button>
        </div>
      </div>
    </div>
  );
}

function CrewCard({ crew, agents, onRun, onDelete }) {
  const crewAgents = typeof crew.agents === 'string' ? JSON.parse(crew.agents) : (crew.agents || []);
  const strategyLabel = STRATEGIES.find(s => s.value === crew.strategy)?.label || crew.strategy;

  return (
    <div className="agent-card p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-dax-text-bright">{crew.name}</h3>
          {crew.description && <p className="text-xs text-dax-text-dim mt-0.5">{crew.description}</p>}
        </div>
        <div className="flex gap-1">
          <button onClick={() => onRun(crew)} className="btn-primary text-xs px-2.5 py-1">
            <Play size={12} /> Run
          </button>
          <button onClick={() => onDelete(crew.id)} className="btn-ghost p-1.5 text-dax-error">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="badge badge-neutral text-[10px]">{strategyLabel}</span>
        <span className="text-[10px] text-dax-text-dim">{crewAgents.length} agents</span>
        <span className="text-[10px] text-dax-text-dim">Max {crew.max_rounds} rounds</span>
      </div>

      {/* Agent chain visualization */}
      <div className="flex items-center gap-1 flex-wrap">
        {crewAgents.map((cfg, idx) => {
          const agent = agents.find(a => a.id === cfg.id);
          const isManager = crew.strategy === 'hierarchical' && idx === 0;
          return (
            <div key={idx} className="flex items-center gap-1">
              {idx > 0 && <ArrowRight size={10} className="text-dax-text-dim" />}
              <div className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] ${
                isManager ? 'bg-dax-accent/15 text-dax-accent' : 'bg-dax-bg text-dax-text-dim'
              }`}>
                {isManager ? <Crown size={10} /> : <Bot size={10} />}
                {agent?.name || cfg.role || 'Unknown'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CrewsView() {
  const [crews, setCrews] = useState([]);
  const [agents, setAgents] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [running, setRunning] = useState(false);

  const loadData = async () => {
    try {
      const [crewList, agentList] = await Promise.all([
        window.dax.crews.list(),
        window.dax.agents.list(),
      ]);
      setCrews(crewList || []);
      setAgents(agentList || []);
    } catch (err) {
      console.error('Failed to load crews:', err);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async (crewData) => {
    try {
      await window.dax.crews.create(crewData);
      loadData();
    } catch (err) {
      console.error('Failed to create crew:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await window.dax.crews.delete(id);
      loadData();
    } catch (err) {
      console.error('Failed to delete crew:', err);
    }
  };

  const handleRun = async (crew) => {
    setRunning(true);
    setRunResult(null);
    try {
      const result = await window.dax.crews.run(crew.id, { trigger: 'manual' });
      setRunResult(result);
    } catch (err) {
      setRunResult({ error: err.message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-dax-panel-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-dax-accent" />
            <h1 className="text-lg font-semibold text-dax-text-bright">Crews</h1>
            <span className="text-xs text-dax-text-dim">Multi-agent collaboration</span>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={14} /> New Crew
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {crews.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Users size={40} className="text-dax-text-dim mx-auto mb-3 opacity-30" />
              <p className="text-sm text-dax-text-dim mb-1">No crews yet</p>
              <p className="text-xs text-dax-text-dim opacity-60">Create a crew to orchestrate multiple agents together</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 max-w-3xl">
            {crews.map((crew) => (
              <CrewCard key={crew.id} crew={crew} agents={agents} onRun={handleRun} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {/* Run Result */}
        {(running || runResult) && (
          <div className="mt-5 max-w-3xl">
            <div className="text-[10px] text-dax-text-dim uppercase tracking-wide mb-2">Crew Run Result</div>
            <div className="agent-card p-4">
              {running ? (
                <div className="flex items-center gap-2 text-sm text-dax-text-dim">
                  <div className="animate-spin w-4 h-4 border-2 border-dax-accent border-t-transparent rounded-full" />
                  Running crew...
                </div>
              ) : runResult?.error ? (
                <pre className="text-xs text-dax-error whitespace-pre-wrap font-mono">{runResult.error}</pre>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-xs text-dax-text-dim">
                    <span>Strategy: {runResult.strategy}</span>
                    <span>Rounds: {runResult.rounds}</span>
                    <span>Results: {runResult.results?.length || 0}</span>
                  </div>
                  {runResult.results?.map((r, i) => (
                    <div key={i} className="bg-dax-bg rounded-lg p-2.5 border border-dax-panel-border">
                      <div className="flex items-center gap-2 mb-1">
                        <Bot size={12} className="text-dax-accent" />
                        <span className="text-xs font-medium text-dax-text-bright">{r.agent_name || r.role || 'Agent'}</span>
                        <span className="text-[10px] text-dax-text-dim">Round {r.round}</span>
                      </div>
                      {r.error ? (
                        <p className="text-xs text-dax-error">{r.error}</p>
                      ) : (
                        <pre className="text-xs text-dax-text whitespace-pre-wrap font-mono max-h-32 overflow-auto">
                          {typeof r.result === 'string' ? r.result : JSON.stringify(r.result, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateCrewModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
          agents={agents}
        />
      )}
    </div>
  );
}
