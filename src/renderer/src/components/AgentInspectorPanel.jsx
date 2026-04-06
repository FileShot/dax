import { Bot, X, Play, Edit3, Clock, ChevronRight, Zap, Circle } from 'lucide-react';

export default function AgentInspectorPanel({ isOpen, agent, onClose, onNavigate }) {
  if (!isOpen || !agent) return null;

  const statusColor = agent.enabled
    ? 'text-green-400'
    : 'text-gray-500';

  const triggerLabels = {
    manual: 'Manual',
    schedule: 'Scheduled',
    webhook: 'Webhook',
    file_watch: 'File Watch',
    event: 'Event',
  };

  const handleRunAgent = async () => {
    try {
      await window.dax.engine.run(agent.id, { trigger: 'manual', from: 'inspector' });
    } catch (err) {
      console.error('Failed to run agent from inspector:', err);
    }
  };

  return (
    <div
      className={`w-72 flex-shrink-0 border-l border-gray-800 bg-gray-900 flex flex-col
        transition-all duration-200 overflow-hidden
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Agent Details</span>
        <button
          onClick={onClose}
          className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Avatar + Name */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <Bot size={18} className="text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-gray-100 font-medium text-sm truncate">{agent.name}</p>
            {agent.description && (
              <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{agent.description}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 flex items-center gap-1.5"><Circle size={8} className={statusColor} fill="currentColor" /> Status</span>
            <span className={`font-medium ${statusColor}`}>{agent.enabled ? 'Enabled' : 'Disabled'}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 flex items-center gap-1.5"><Zap size={10} /> Trigger</span>
            <span className="text-gray-300">{triggerLabels[agent.trigger_type] || agent.trigger_type || '—'}</span>
          </div>

          {agent.last_run_at && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 flex items-center gap-1.5"><Clock size={10} /> Last run</span>
              <span className="text-gray-300">
                {new Date(agent.last_run_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>

        {/* System prompt snippet */}
        {agent.system_prompt && (
          <div>
            <p className="text-xs text-gray-500 mb-1.5 font-medium">System prompt</p>
            <p className="text-xs text-gray-400 bg-gray-800 rounded-lg p-2.5 line-clamp-4 font-mono leading-relaxed">
              {agent.system_prompt}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-gray-800 space-y-2">
        <button
          onClick={handleRunAgent}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500
            text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Play size={12} /> Run Now
        </button>
        <button
          onClick={() => { onClose(); if (onNavigate) onNavigate('agents'); }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700
            text-gray-300 text-xs font-medium rounded-lg transition-colors"
        >
          <Edit3 size={12} /> Edit in Agents <ChevronRight size={10} className="ml-auto" />
        </button>
      </div>
    </div>
  );
}
