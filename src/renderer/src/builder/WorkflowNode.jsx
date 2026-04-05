import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { NODE_TYPES, NODE_CATEGORIES } from './node-types';
import * as Icons from 'lucide-react';

const CATEGORY_COLORS = {
  trigger:   { rgb: 'var(--dax-node-trigger)',   solid: 'rgb(59 130 246)' },
  processor: { rgb: 'var(--dax-node-processor)',  solid: 'rgb(168 85 247)' },
  action:    { rgb: 'var(--dax-node-action)',     solid: 'rgb(34 197 94)' },
  logic:     { rgb: 'var(--dax-node-logic)',      solid: 'rgb(234 179 8)' },
};

function WorkflowNode({ data, selected }) {
  const nodeDef = NODE_TYPES[data.nodeType];
  if (!nodeDef) return null;

  const category = nodeDef.category;
  const colors = CATEGORY_COLORS[category];
  const catLabel = NODE_CATEGORIES[category]?.label || category;
  const IconComp = Icons[nodeDef.icon] || Icons.Box;

  return (
    <div
      className={`workflow-node ${category} ${selected ? 'selected' : ''}`}
      style={selected ? { boxShadow: `0 0 0 2px ${colors.solid}` } : undefined}
    >
      {/* Input handles */}
      {nodeDef.inputs.map((inp, i) => (
        <Handle
          key={inp.id}
          type="target"
          position={Position.Left}
          id={inp.id}
          className="wf-handle"
          style={{
            top: nodeDef.inputs.length === 1
              ? '50%'
              : `${((i + 1) / (nodeDef.inputs.length + 1)) * 100}%`,
            background: colors.solid,
          }}
        />
      ))}

      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: `rgb(${colors.rgb} / 0.25)` }}
        >
          <IconComp size={14} style={{ color: colors.solid }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-dax-text-bright truncate">
            {data.label || nodeDef.label}
          </div>
          <div className="text-[10px] text-dax-text-dim truncate">
            {catLabel}
          </div>
        </div>
      </div>

      {/* Config preview */}
      {data.config && Object.keys(data.config).length > 0 && (
        <div className="mt-1 pt-1 border-t border-white/5">
          {Object.entries(data.config).slice(0, 2).map(([key, val]) => {
            if (!val || val === nodeDef.defaults[key]) return null;
            const display = typeof val === 'string' && val.length > 30
              ? val.slice(0, 30) + '...'
              : String(val);
            return (
              <div key={key} className="text-[10px] text-dax-text-dim truncate">
                <span className="opacity-60">{key}:</span> {display}
              </div>
            );
          })}
        </div>
      )}

      {/* Output handles */}
      {nodeDef.outputs.map((out, i) => (
        <Handle
          key={out.id}
          type="source"
          position={Position.Right}
          id={out.id}
          className="wf-handle"
          style={{
            top: nodeDef.outputs.length === 1
              ? '50%'
              : `${((i + 1) / (nodeDef.outputs.length + 1)) * 100}%`,
            background: colors.solid,
          }}
        />
      ))}

      {/* Output labels for multi-output nodes */}
      {nodeDef.outputs.length > 1 && (
        <div className="absolute right-7 top-0 h-full flex flex-col justify-around py-2 pointer-events-none">
          {nodeDef.outputs.map((out) => (
            <div key={out.id} className="text-[9px] text-dax-text-dim text-right">
              {out.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(WorkflowNode);
