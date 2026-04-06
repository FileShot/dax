import { useState, useRef, useEffect } from 'react';
import {
  MessageSquarePlus, Send, Loader2, Bot, User, Sparkles,
  CheckCircle2, ArrowRight, Wand2, RotateCcw,
} from 'lucide-react';
import { NODE_TYPES, getNodesByCategory } from '../builder/node-types';
import HelpGuide from '../components/HelpGuide';

const EXAMPLE_PROMPTS = [
  'Monitor a folder for new CSV files and send me a notification when one appears',
  'Every morning at 9am, scrape a website and save the results to a file',
  'When I trigger manually, analyze a text document and extract key data points',
  'Watch a log file for errors and classify them by severity',
  'Every hour, make an HTTP request to an API and log the response',
];

export default function ChatBuilderView({ onNavigate }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedWorkflow, setGeneratedWorkflow] = useState(null);
  const [agentName, setAgentName] = useState('');
  const [saving, setSaving] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (role, content, workflow = null) => {
    setMessages((prev) => [...prev, { role, content, workflow, ts: Date.now() }]);
  };

  const handleSubmit = async (text) => {
    const prompt = text || input.trim();
    if (!prompt || generating) return;
    setInput('');
    addMessage('user', prompt);
    setGenerating(true);
    setGeneratedWorkflow(null);

    try {
      // Build the system prompt for workflow generation
      const nodeList = Object.entries(NODE_TYPES)
        .map(([id, n]) => `- ${id}: ${n.label} (${n.category}) — ${n.description}`)
        .join('\n');

      const systemPrompt = `You are Dax, an AI workflow builder. The user describes what they want an agent to do. Your job is to convert their description into a workflow — a list of nodes and edges.

Available node types:
${nodeList}

Respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "name": "Agent Name",
  "description": "Brief description",
  "nodes": [
    { "id": "node_1", "type": "workflow", "position": { "x": 0, "y": 0 }, "data": { "nodeType": "NODE_TYPE_ID", "label": "Display Name", "config": {} } }
  ],
  "edges": [
    { "id": "edge_1", "source": "node_1", "target": "node_2", "sourceHandle": "out", "targetHandle": "in" }
  ]
}

Rules:
- Position nodes left-to-right with x spacing of 300 and y centered around 200
- Use appropriate node types from the list
- Connect nodes with edges using the correct handle IDs
- Set config values based on the user's description
- Keep it practical — 2-6 nodes typically
- The first node should be a trigger`;

      const result = await window.dax.engine.run({
        name: '_chat_builder',
        system_prompt: systemPrompt,
        trigger_type: 'manual',
        model_id: '',
        temperature: 0.3,
        token_budget: 4096,
      }, { prompt });

      if (result && result.result) {
        let parsed = null;
        try {
          // Try to parse the result — it might be wrapped in markdown code blocks
          let raw = result.result;
          if (typeof raw === 'string') {
            // Strip markdown code fences
            raw = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            parsed = JSON.parse(raw);
          } else if (typeof raw === 'object') {
            parsed = raw;
          }
        } catch (parseErr) {
          console.error('[ChatBuilder] Failed to parse workflow:', parseErr);
        }

        if (parsed && parsed.nodes && parsed.nodes.length > 0) {
          // Validate node types
          const validNodes = parsed.nodes.filter((n) => NODE_TYPES[n.data?.nodeType]);
          if (validNodes.length > 0) {
            parsed.nodes = validNodes;
            setGeneratedWorkflow(parsed);
            setAgentName(parsed.name || 'New Agent');
            addMessage('assistant', `I've designed a workflow with ${validNodes.length} nodes. Here's what it does:`, parsed);
          } else {
            addMessage('assistant', 'I generated a workflow but couldn\'t map the nodes to valid types. Could you try rephrasing?');
          }
        } else {
          addMessage('assistant', result.error
            ? `I had trouble generating that workflow: ${result.error}`
            : 'I couldn\'t generate a valid workflow from that description. Try being more specific about what triggers the agent and what actions it should take.');
        }
      } else {
        addMessage('assistant', 'I couldn\'t reach the LLM. Make sure you have a model configured in Settings or Ollama running locally.');
      }
    } catch (err) {
      console.error('[ChatBuilder] Error:', err);
      addMessage('assistant', `Something went wrong: ${err.message || 'Unknown error'}. Check that your LLM is running.`);
    } finally {
      setGenerating(false);
    }
  };

  const saveAsAgent = async () => {
    if (!generatedWorkflow || saving) return;
    setSaving(true);

    try {
      const agent = await window.dax.agents.create({
        name: agentName || generatedWorkflow.name || 'Chat-Built Agent',
        description: generatedWorkflow.description || '',
        trigger_type: detectTriggerType(generatedWorkflow.nodes),
        system_prompt: '',
        nodes: generatedWorkflow.nodes,
        edges: generatedWorkflow.edges || [],
      });

      if (agent) {
        addMessage('assistant', `Agent "${agent.name}" created successfully! You can now edit it in the Builder or run it from the Agents view.`);
        setGeneratedWorkflow(null);
      }
    } catch (err) {
      console.error('[ChatBuilder] Save error:', err);
      addMessage('assistant', `Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setGeneratedWorkflow(null);
    setAgentName('');
    setInput('');
    inputRef.current?.focus();
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dax-border">
        <div className="flex items-center gap-2">
          <Wand2 size={16} className="text-dax-accent" />
          <span className="text-sm font-medium text-dax-text-bright">Chat-to-Agent Builder</span>
          <span className="text-[10px] text-dax-text-dim px-1.5 py-0.5 rounded bg-dax-accent/10 text-dax-accent">
            AI-Powered
          </span>
          <HelpGuide page="chatBuilder" />
        </div>
        {messages.length > 0 && (
          <button onClick={resetChat} className="btn-secondary btn-sm">
            <RotateCcw size={12} />
            New Chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <EmptyState onSelect={handleSubmit} />
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            {generating && (
              <div className="flex items-center gap-2 text-dax-text-dim text-sm">
                <Loader2 size={14} className="animate-spin" />
                Generating workflow...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Generated workflow actions */}
      {generatedWorkflow && !generating && (
        <div className="border-t border-dax-border bg-dax-sidebar px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Agent name..."
              className="input text-xs flex-1"
            />
            <button onClick={saveAsAgent} disabled={saving} className="btn-primary btn-sm">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Save Agent
            </button>
            <button
              onClick={() => onNavigate?.('builder')}
              className="btn-secondary btn-sm"
            >
              Edit in Builder
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-dax-border bg-dax-sidebar px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
            placeholder="Describe what your agent should do..."
            className="input text-sm flex-1"
            disabled={generating}
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || generating}
            className={`btn-primary ${!input.trim() || generating ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onSelect }) {
  return (
    <div className="max-w-2xl mx-auto mt-12 text-center">
      <div
        className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
        style={{ background: 'rgb(var(--dax-accent) / 0.1)' }}
      >
        <MessageSquarePlus size={28} className="text-dax-accent" />
      </div>
      <h2 className="text-xl font-semibold text-dax-text-bright mb-2">
        Build an Agent with Chat
      </h2>
      <p className="text-sm text-dax-text-dim mb-6 max-w-md mx-auto">
        Describe what you want your agent to do in plain English. Dax will
        generate a workflow you can review, edit, and deploy.
      </p>

      <div className="text-left space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-dax-text-dim mb-2 font-medium">
          Try one of these
        </p>
        {EXAMPLE_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onSelect(prompt)}
            className="w-full text-left px-3 py-2.5 rounded-lg agent-card hover:border-dax-accent/30 transition-fast group"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={12} className="text-dax-accent flex-shrink-0 opacity-50 group-hover:opacity-100" />
              <span className="text-xs text-dax-text">{prompt}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? '' : ''}`}>
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-dax-accent/20' : 'bg-dax-surface'
        }`}
      >
        {isUser ? (
          <User size={14} className="text-dax-accent" />
        ) : (
          <Bot size={14} className="text-dax-text-dim" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-dax-text leading-relaxed">{message.content}</p>
        {message.workflow && <WorkflowPreview workflow={message.workflow} />}
      </div>
    </div>
  );
}

function WorkflowPreview({ workflow }) {
  if (!workflow?.nodes) return null;

  return (
    <div className="mt-3 agent-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-dax-text-dim mb-2 font-medium">
        Generated Workflow
      </div>
      <div className="flex flex-wrap gap-2">
        {workflow.nodes.map((node, i) => {
          const def = NODE_TYPES[node.data?.nodeType];
          if (!def) return null;
          const catColors = {
            trigger: 'border-blue-500/40 bg-blue-500/10',
            processor: 'border-purple-500/40 bg-purple-500/10',
            action: 'border-green-500/40 bg-green-500/10',
            logic: 'border-yellow-500/40 bg-yellow-500/10',
          };

          return (
            <div key={node.id} className="flex items-center gap-1">
              <div
                className={`px-2 py-1 rounded text-[11px] border ${catColors[def.category] || ''}`}
              >
                <span className="text-dax-text-bright">{node.data?.label || def.label}</span>
              </div>
              {i < workflow.nodes.length - 1 && (
                <ArrowRight size={10} className="text-dax-text-dim" />
              )}
            </div>
          );
        })}
      </div>
      {workflow.description && (
        <p className="text-[11px] text-dax-text-dim mt-2">{workflow.description}</p>
      )}
    </div>
  );
}

function detectTriggerType(nodes) {
  if (!nodes?.length) return 'manual';
  const first = nodes[0];
  const nodeType = first.data?.nodeType || '';
  if (nodeType.includes('schedule')) return 'cron';
  if (nodeType.includes('file_watch')) return 'file_watch';
  if (nodeType.includes('webhook')) return 'webhook';
  return 'manual';
}
