import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import WorkflowNode from '../builder/WorkflowNode';
import NodeConfigPanel from '../builder/NodeConfigPanel';
import { NODE_TYPES, NODE_CATEGORIES, getNodesByCategory } from '../builder/node-types';
import * as Icons from 'lucide-react';
import useAgentStore from '../stores/useAgentStore';

const nodeTypes = { workflow: WorkflowNode };

const defaultEdgeOptions = {
  animated: true,
  style: { stroke: 'rgb(var(--dax-text-dim))', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: 'rgb(var(--dax-text-dim))' },
};

let nodeIdCounter = 1;
function genNodeId() {
  return `node_${Date.now()}_${nodeIdCounter++}`;
}

export default function BuilderView() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState('');
  const [agentId, setAgentId] = useState(null);
  const [dirty, setDirty] = useState(false);
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  const agents = useAgentStore((s) => s.agents);
  const fetchAgents = useAgentStore((s) => s.fetch);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  useEffect(() => { fetchAgents(); }, []);

  // Load workflow from agent
  const loadWorkflow = useCallback(async (id) => {
    if (!id) return;
    try {
      const agent = await window.dax.agents.get(id);
      if (agent) {
        const parsedNodes = agent.nodes ? JSON.parse(agent.nodes) : [];
        const parsedEdges = agent.edges ? JSON.parse(agent.edges) : [];
        setNodes(parsedNodes);
        setEdges(parsedEdges);
        setAgentId(id);
        setDirty(false);
        setSelectedNodeId(null);
      }
    } catch (err) {
      console.error('Failed to load workflow:', err);
    }
  }, [setNodes, setEdges]);

  // Save workflow to agent
  const saveWorkflow = useCallback(async () => {
    if (!agentId) return;
    try {
      await window.dax.agents.update(agentId, {
        nodes: nodes,
        edges: edges,
      });
      setDirty(false);
    } catch (err) {
      console.error('Failed to save workflow:', err);
    }
  }, [agentId, nodes, edges]);

  // Track changes
  const markDirty = useCallback(() => setDirty(true), []);

  const onConnect = useCallback(
    (params) => {
      setEdges((eds) => addEdge(params, eds));
      markDirty();
    },
    [setEdges, markDirty],
  );

  const handleNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      const hasNonSelect = changes.some((c) => c.type !== 'select');
      if (hasNonSelect) markDirty();
    },
    [onNodesChange, markDirty],
  );

  const handleEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);
      markDirty();
    },
    [onEdgesChange, markDirty],
  );

  const onNodeClick = useCallback((_event, node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Add node from palette
  const addNode = useCallback(
    (nodeTypeId) => {
      const def = NODE_TYPES[nodeTypeId];
      if (!def) return;

      const position = reactFlowInstance
        ? reactFlowInstance.screenToFlowPosition({
            x: window.innerWidth / 2 - 90,
            y: window.innerHeight / 2 - 40,
          })
        : { x: 250 + Math.random() * 200, y: 150 + Math.random() * 200 };

      const newNode = {
        id: genNodeId(),
        type: 'workflow',
        position,
        data: {
          nodeType: nodeTypeId,
          label: def.label,
          config: { ...def.defaults },
        },
      };

      setNodes((nds) => [...nds, newNode]);
      setPaletteOpen(false);
      setPaletteSearch('');
      markDirty();
    },
    [setNodes, reactFlowInstance, markDirty],
  );

  // Update node data from config panel
  const updateNodeData = useCallback(
    (nodeId, newData) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: newData } : n)),
      );
      markDirty();
    },
    [setNodes, markDirty],
  );

  // Delete selected nodes + Ctrl+S to save
  const onKeyDown = useCallback(
    (e) => {
      if (e.key === 'Delete' && selectedNode) {
        setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
        setEdges((eds) =>
          eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id),
        );
        setSelectedNodeId(null);
        markDirty();
      }
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveWorkflow();
      }
    },
    [selectedNode, setNodes, setEdges, markDirty, saveWorkflow],
  );

  // Filtered palette nodes
  const nodesByCategory = useMemo(() => getNodesByCategory(), []);
  const filteredCategories = useMemo(() => {
    if (!paletteSearch) return nodesByCategory;
    const q = paletteSearch.toLowerCase();
    const filtered = {};
    for (const [cat, typeNodes] of Object.entries(nodesByCategory)) {
      const matches = typeNodes.filter(
        (n) =>
          n.label.toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q),
      );
      if (matches.length > 0) filtered[cat] = matches;
    }
    return filtered;
  }, [nodesByCategory, paletteSearch]);

  // MiniMap node color
  const miniMapNodeColor = useCallback((node) => {
    const def = NODE_TYPES[node.data?.nodeType];
    if (!def) return '#444';
    const map = {
      trigger: 'rgb(59, 130, 246)',
      processor: 'rgb(168, 85, 247)',
      action: 'rgb(34, 197, 94)',
      logic: 'rgb(234, 179, 8)',
    };
    return map[def.category] || '#444';
  }, []);

  const selectedAgent = agents.find((a) => a.id === agentId);

  return (
    <div className="flex-1 flex flex-col h-full" onKeyDown={onKeyDown} tabIndex={0}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-dax-border bg-dax-sidebar">
        {/* Agent selector */}
        <select
          value={agentId || ''}
          onChange={(e) => loadWorkflow(e.target.value)}
          className="input text-xs w-48"
        >
          <option value="">Select Agent...</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        {selectedAgent && (
          <span className="text-[10px] text-dax-text-dim px-2">
            {nodes.length} nodes / {edges.length} edges
          </span>
        )}

        <div className="flex-1" />

        {/* Add node button */}
        <button
          onClick={() => setPaletteOpen(!paletteOpen)}
          className="btn-primary btn-sm"
        >
          <Icons.Plus size={14} />
          Add Node
        </button>

        {/* Save */}
        <button
          onClick={saveWorkflow}
          disabled={!agentId || !dirty}
          className={`btn-secondary btn-sm ${
            !agentId || !dirty ? 'opacity-40 cursor-not-allowed' : ''
          }`}
        >
          <Icons.Save size={14} />
          Save
        </button>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onInit={setReactFlowInstance}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            proOptions={{ hideAttribution: true }}
            style={{ background: 'rgb(var(--dax-bg))' }}
          >
            <Background
              color="rgb(var(--dax-border))"
              gap={20}
              size={1}
            />
            <Controls
              className="builder-controls"
              showInteractive={false}
            />
            <MiniMap
              nodeColor={miniMapNodeColor}
              maskColor="rgb(0 0 0 / 0.7)"
              style={{
                background: 'rgb(var(--dax-sidebar))',
                border: '1px solid rgb(var(--dax-border))',
              }}
            />

            {/* Empty state */}
            {nodes.length === 0 && agentId && (
              <Panel position="top-center">
                <div className="mt-20 text-center">
                  <Icons.Workflow
                    size={48}
                    className="mx-auto mb-3 text-dax-text-dim opacity-30"
                  />
                  <p className="text-sm text-dax-text-dim mb-1">
                    No nodes yet
                  </p>
                  <p className="text-xs text-dax-text-dim opacity-60 mb-3">
                    Click "Add Node" to start building your workflow
                  </p>
                  <button
                    onClick={() => setPaletteOpen(true)}
                    className="btn-primary btn-sm"
                  >
                    Add First Node
                  </button>
                </div>
              </Panel>
            )}

            {/* No agent selected */}
            {!agentId && (
              <Panel position="top-center">
                <div className="mt-20 text-center">
                  <Icons.FolderOpen
                    size={48}
                    className="mx-auto mb-3 text-dax-text-dim opacity-30"
                  />
                  <p className="text-sm text-dax-text-dim">
                    Select an agent to edit its workflow
                  </p>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* Node Palette (dropdown) */}
        {paletteOpen && (
          <div className="absolute top-0 right-0 w-72 h-full bg-dax-sidebar border-l border-dax-border z-50 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-dax-border">
              <span className="text-xs font-medium text-dax-text-bright">
                Node Palette
              </span>
              <button
                onClick={() => { setPaletteOpen(false); setPaletteSearch(''); }}
                className="p-1 rounded hover:bg-dax-list-hover text-dax-text-dim"
              >
                <Icons.X size={14} />
              </button>
            </div>

            <div className="px-3 py-2">
              <input
                type="text"
                placeholder="Search nodes..."
                value={paletteSearch}
                onChange={(e) => setPaletteSearch(e.target.value)}
                className="input text-xs"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {Object.entries(filteredCategories).map(([cat, catNodes]) => (
                <div key={cat} className="mb-3">
                  <div className="text-[10px] uppercase tracking-wider text-dax-text-dim px-2 mb-1 font-medium">
                    {NODE_CATEGORIES[cat]?.label || cat}
                  </div>
                  {catNodes.map((n) => {
                    const IconComp = Icons[n.icon] || Icons.Box;
                    return (
                      <button
                        key={n.id}
                        onClick={() => addNode(n.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-dax-list-hover group transition-fast"
                      >
                        <IconComp size={14} className="text-dax-text-dim group-hover:text-dax-text flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs text-dax-text-bright truncate">
                            {n.label}
                          </div>
                          <div className="text-[10px] text-dax-text-dim truncate">
                            {n.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
              {Object.keys(filteredCategories).length === 0 && (
                <div className="text-xs text-dax-text-dim text-center py-4">
                  No nodes match "{paletteSearch}"
                </div>
              )}
            </div>
          </div>
        )}

        {/* Config Panel */}
        {selectedNode && !paletteOpen && (
          <NodeConfigPanel
            nodeId={selectedNode.id}
            nodeData={selectedNode.data}
            onUpdate={updateNodeData}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </div>
  );
}
