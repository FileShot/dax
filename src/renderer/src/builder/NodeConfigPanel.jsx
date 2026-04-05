import { NODE_TYPES } from './node-types';
import { X } from 'lucide-react';

export default function NodeConfigPanel({ nodeId, nodeData, onUpdate, onClose }) {
  if (!nodeId || !nodeData) return null;

  const nodeDef = NODE_TYPES[nodeData.nodeType];
  if (!nodeDef) return null;

  const config = nodeData.config || {};

  function handleChange(key, value) {
    onUpdate(nodeId, {
      ...nodeData,
      config: { ...config, [key]: value },
    });
  }

  function handleLabelChange(value) {
    onUpdate(nodeId, { ...nodeData, label: value });
  }

  return (
    <div className="w-72 h-full border-l border-dax-border bg-dax-sidebar flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-dax-border">
        <div>
          <div className="text-xs font-medium text-dax-text-bright">{nodeDef.label}</div>
          <div className="text-[10px] text-dax-text-dim">{nodeDef.description}</div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-dax-list-hover text-dax-text-dim"
        >
          <X size={14} />
        </button>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Node label */}
        <div>
          <label className="block text-[11px] text-dax-text-dim mb-1">Display Name</label>
          <input
            type="text"
            value={nodeData.label || ''}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder={nodeDef.label}
            className="input text-xs"
          />
        </div>

        {/* Config fields */}
        {nodeDef.configFields.map((field) => (
          <ConfigField
            key={field.key}
            field={field}
            value={config[field.key] ?? nodeDef.defaults[field.key] ?? ''}
            onChange={(val) => handleChange(field.key, val)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-dax-border">
        <div className="text-[10px] text-dax-text-dim">
          ID: {nodeId}
        </div>
      </div>
    </div>
  );
}

function ConfigField({ field, value, onChange }) {
  const labelEl = (
    <label className="block text-[11px] text-dax-text-dim mb-1">{field.label}</label>
  );

  switch (field.type) {
    case 'text':
      return (
        <div>
          {labelEl}
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || ''}
            className="input text-xs"
          />
        </div>
      );

    case 'textarea':
    case 'code':
      return (
        <div>
          {labelEl}
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || ''}
            rows={field.type === 'code' ? 6 : 3}
            className={`input text-xs resize-y ${field.type === 'code' ? 'font-mono' : ''}`}
            style={field.type === 'code' ? { fontFamily: 'Consolas, monospace' } : undefined}
          />
        </div>
      );

    case 'number':
      return (
        <div>
          {labelEl}
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            min={field.min}
            max={field.max}
            step={field.step || 1}
            className="input text-xs"
          />
        </div>
      );

    case 'select':
      return (
        <div>
          {labelEl}
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input text-xs"
          >
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      );

    case 'boolean':
      return (
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-dax-text-dim">{field.label}</span>
          <button
            onClick={() => onChange(!value)}
            className={`w-8 h-4 rounded-full transition-colors relative ${
              value ? 'bg-dax-accent' : 'bg-dax-input-border'
            }`}
          >
            <span
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                value ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      );

    default:
      return null;
  }
}
