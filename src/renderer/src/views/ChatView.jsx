import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, User, Send, Loader2, Trash2, ChevronRight, MessageSquare } from 'lucide-react';
import useChatStore from '../stores/useChatStore';
import HelpGuide from '../components/HelpGuide';
import useAgentStore from '../stores/useAgentStore';
import useModelStore from '../stores/useModelStore';
import useRunStore from '../stores/useRunStore';

const SUGGESTED_PROMPTS = [
  'What are my agents doing right now?',
  'Summarize recent agent activity',
  'List my agents and their current status',
  'Which agents had errors recently?',
  'What AI models do I have configured?',
  'Help me write a system prompt for a new agent',
];

function renderMarkdown(text) {
  if (!text) return text;
  const lines = text.split('\n');
  const elements = [];
  let listItems = [];
  const flushList = () => {
    if (listItems.length) {
      elements.push(<ul key={`ul-${elements.length}`} className="list-disc pl-5 my-1.5 space-y-0.5">{listItems}</ul>);
      listItems = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,3}\s/.test(line)) {
      flushList();
      const txt = line.replace(/^#{1,3}\s/, '');
      elements.push(<div key={i} className="font-semibold text-dax-text-bright mt-2 mb-0.5">{formatInline(txt)}</div>);
    } else if (/^[-*]\s/.test(line)) {
      listItems.push(<li key={i}>{formatInline(line.replace(/^[-*]\s/, ''))}</li>);
    } else if (/^\d+\.\s/.test(line)) {
      listItems.push(<li key={i}>{formatInline(line.replace(/^\d+\.\s/, ''))}</li>);
    } else if (line.trim() === '') {
      flushList();
      elements.push(<div key={i} className="h-1.5" />);
    } else {
      flushList();
      elements.push(<div key={i}>{formatInline(line)}</div>);
    }
  }
  flushList();
  return elements;
}

function formatInline(text) {
  const parts = [];
  let key = 0;
  const regex = /(\*\*(.+?)\*\*|`(.+?)`|_(.+?)_)/g;
  let match;
  let lastIdx = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    if (match[2]) parts.push(<strong key={key++} className="font-semibold text-dax-text-bright">{match[2]}</strong>);
    else if (match[3]) parts.push(<code key={key++} className="px-1 py-0.5 rounded bg-dax-card text-dax-accent text-xs font-mono">{match[3]}</code>);
    else if (match[4]) parts.push(<em key={key++}>{match[4]}</em>);
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts.length ? parts : text;
}

function MessageBubble({ msg, isStreaming }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm
        ${isUser ? 'bg-dax-accent text-white' : 'bg-dax-card text-dax-text-dim'}`}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
        ${isUser
          ? 'bg-dax-accent text-white rounded-tr-sm'
          : 'bg-dax-card text-dax-text rounded-tl-sm border border-dax-panel-border'
        }`}>
        {isUser ? msg.content : renderMarkdown(msg.content)}
        {isStreaming && (
          <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-dax-text-dim animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  );
}

function StreamingBubble({ content }) {
  if (!content) return null;
  return (
    <div className="flex gap-3 flex-row">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-dax-card text-dax-text-dim">
        <Bot size={14} />
      </div>
      <div className="max-w-[75%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed
        bg-dax-card text-dax-text border border-dax-panel-border">
        {renderMarkdown(content)}
        <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-dax-text-dim animate-pulse rounded-sm" />
      </div>
    </div>
  );
}

export default function ChatView({ onNavigate, onInspectAgent }) {
  const [input, setInput] = useState('');
  const { messages, streaming, streamBuffer, startStream, endStream, addMessage, clearHistory, initStreamListener } = useChatStore();
  const { agents, fetch: fetchAgents } = useAgentStore();
  const { models, fetch: fetchModels } = useModelStore();
  const { runs, fetch: fetchRuns } = useRunStore();
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    fetchAgents();
    fetchModels();
    fetchRuns(null, 20);
    window.dax?.engine?.scheduler?.().then(setSchedulerStatus).catch(() => {});
    const unsub = initStreamListener();
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamBuffer]);

  const buildSystemPrompt = useCallback(() => {
    const agentList = agents.length
      ? agents.map(a => `- ${a.name} (${a.trigger_type || 'manual'}, ${a.enabled ? 'enabled' : 'disabled'})`).join('\n')
      : '(no agents yet)';
    const modelList = models.length
      ? models.map(m => `- ${m.name} (${m.provider || 'local'})`).join('\n')
      : '(no models configured)';

    // Recent run activity
    const recentRuns = runs.slice(0, 10);
    const runSummary = recentRuns.length
      ? recentRuns.map(r => {
          const agentMatch = agents.find(a => a.id === r.agent_id);
          const name = agentMatch?.name || r.agent_id?.slice(0, 8);
          const dur = r.duration_ms ? `${(r.duration_ms / 1000).toFixed(0)}s` : 'in-progress';
          const tokens = r.tokens_used ? `, ${r.tokens_used} tokens` : '';
          let result = '';
          if (r.status === 'completed' && r.result) {
            try {
              const parsed = typeof r.result === 'string' ? JSON.parse(r.result) : r.result;
              if (parsed.output) result = ` — "${String(parsed.output).slice(0, 120)}"`;
            } catch (_) {}
          }
          if (r.status === 'error' && r.error) {
            result = ` — Error: ${String(r.error).slice(0, 80)}`;
          }
          return `- ${name}: ${r.status} (${dur}${tokens})${result}`;
        }).join('\n')
      : '(no recent runs)';

    // Scheduler status
    const sched = schedulerStatus;
    const schedInfo = sched
      ? `${sched.scheduled || 0} scheduled, ${sched.running || 0} currently running`
      : 'unknown';

    // Currently running agents
    const runningRuns = runs.filter(r => r.status === 'running');
    const runningInfo = runningRuns.length
      ? runningRuns.map(r => {
          const agentMatch = agents.find(a => a.id === r.agent_id);
          return agentMatch?.name || r.agent_id?.slice(0, 8);
        }).join(', ')
      : 'none';

    return `You are Dax, a local AI automation assistant running inside the Dax desktop app. You help users manage agents, automations, and data pipelines running entirely on their machine.

Current agents:
${agentList}

Configured models:
${modelList}

Scheduler: ${schedInfo}
Currently running: ${runningInfo}

Recent runs (latest first):
${runSummary}

You have real-time awareness of agent status and recent results. When the user asks what's happening, summarize the current activity using the data above. Be concise and helpful. When the user asks to run or manage agents, guide them through the app UI. Never expose sensitive data.`;
  }, [agents, models, runs, schedulerStatus]);

  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || streaming) return;
    setInput('');

    // Refresh live data before building system prompt
    await Promise.all([
      fetchAgents(),
      fetchRuns(null, 20),
      window.dax?.engine?.scheduler?.().then(setSchedulerStatus).catch(() => {}),
    ]);

    addMessage({ role: 'user', content, ts: new Date().toISOString() });

    const history = useChatStore.getState().messages;
    const chatMessages = history.map(({ role, content: c }) => ({ role, content: c }));

    startStream();
    try {
      await window.dax.chat.send({
        messages: chatMessages,
        system: buildSystemPrompt(),
      });
    } catch (err) {
      endStream();
      addMessage({ role: 'assistant', content: `Error: ${err.message}`, ts: new Date().toISOString() });
      return;
    }
    endStream();
  }, [input, streaming, addMessage, startStream, endStream, buildSystemPrompt]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isEmpty = messages.length === 0 && !streaming;

  return (
    <div className="flex flex-col h-full bg-dax-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dax-panel-border">
        <div className="flex items-center gap-2 text-dax-text">
          <MessageSquare size={16} className="text-dax-accent" />
          <span className="font-medium text-sm">Chat</span>
          <HelpGuide page="chat" />
          {streaming && (
            <span className="text-xs text-dax-accent flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" /> thinking…
            </span>
          )}
        </div>
        <button
          onClick={clearHistory}
          className="p-1.5 rounded text-dax-text-dim hover:text-dax-text hover:bg-dax-card transition-colors"
          title="Clear history"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="w-12 h-12 rounded-full bg-dax-accent/10 flex items-center justify-center">
              <Bot size={24} className="text-dax-accent" />
            </div>
            <div>
              <p className="text-dax-text font-medium mb-1">Hi, I'm Dax</p>
              <p className="text-dax-text-dim text-sm">Your local AI automation assistant</p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="flex items-center gap-2 px-3 py-2.5 bg-dax-card hover:bg-dax-card/80 rounded-xl text-left text-sm text-dax-text-dim transition-colors group"
                >
                  <ChevronRight size={12} className="text-dax-text-dim group-hover:text-dax-accent flex-shrink-0" />
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {streaming && <StreamingBubble content={streamBuffer} />}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-dax-panel-border">
        <div className="flex gap-2 items-end bg-dax-card rounded-2xl px-3 py-2 border border-dax-panel-border focus-within:border-dax-accent/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Dax…"
            rows={1}
            className="flex-1 bg-transparent text-dax-text placeholder-dax-text-dim text-sm resize-none outline-none max-h-32 py-0.5"
            style={{ fieldSizing: 'content' }}
            disabled={streaming}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || streaming}
            className="flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center
              bg-dax-accent hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors text-white"
          >
            {streaming ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          </button>
        </div>
        <p className="text-center text-xs text-dax-text-dim mt-1.5">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
