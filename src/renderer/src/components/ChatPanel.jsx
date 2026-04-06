import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, User, Send, Loader2, Trash2, ChevronRight, X, MessageSquare, Maximize2, Minimize2 } from 'lucide-react';
import useChatStore from '../stores/useChatStore';
import useAgentStore from '../stores/useAgentStore';
import useModelStore from '../stores/useModelStore';

const SUGGESTED_PROMPTS = [
  'What can you help me with?',
  'List my agents and their status',
  'Help me write a system prompt',
  'What models do I have?',
];

function renderMarkdown(text) {
  if (!text) return text;
  const lines = text.split('\n');
  const elements = [];
  let listItems = [];
  const flushList = () => {
    if (listItems.length) {
      elements.push(<ul key={`ul-${elements.length}`} className="list-disc pl-4 my-1 space-y-0.5">{listItems}</ul>);
      listItems = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,3}\s/.test(line)) {
      flushList();
      const text = line.replace(/^#{1,3}\s/, '');
      elements.push(<div key={i} className="font-semibold text-dax-text-bright mt-2 mb-0.5">{formatInline(text)}</div>);
    } else if (/^[-*]\s/.test(line)) {
      listItems.push(<li key={i}>{formatInline(line.replace(/^[-*]\s/, ''))}</li>);
    } else if (/^\d+\.\s/.test(line)) {
      listItems.push(<li key={i}>{formatInline(line.replace(/^\d+\.\s/, ''))}</li>);
    } else if (line.trim() === '') {
      flushList();
      elements.push(<div key={i} className="h-1" />);
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
  let remaining = text;
  let key = 0;
  const regex = /(\*\*(.+?)\*\*|`(.+?)`|_(.+?)_)/g;
  let match;
  let lastIdx = 0;
  while ((match = regex.exec(remaining)) !== null) {
    if (match.index > lastIdx) parts.push(remaining.slice(lastIdx, match.index));
    if (match[2]) parts.push(<strong key={key++} className="font-semibold text-dax-text-bright">{match[2]}</strong>);
    else if (match[3]) parts.push(<code key={key++} className="px-1 py-0.5 rounded bg-dax-card text-dax-accent text-[10px] font-mono">{match[3]}</code>);
    else if (match[4]) parts.push(<em key={key++}>{match[4]}</em>);
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < remaining.length) parts.push(remaining.slice(lastIdx));
  return parts.length ? parts : text;
}

function MessageBubble({ msg, isStreaming }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px]
        ${isUser ? 'bg-dax-accent text-white' : 'bg-dax-card text-dax-text-dim'}`}>
        {isUser ? <User size={11} /> : <Bot size={11} />}
      </div>
      <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed
        ${isUser
          ? 'bg-dax-accent text-white rounded-tr-sm'
          : 'bg-dax-card text-dax-text rounded-tl-sm border border-dax-panel-border'
        }`}>
        {isUser ? msg.content : renderMarkdown(msg.content)}
        {isStreaming && (
          <span className="inline-block w-1 h-3 ml-0.5 bg-dax-text-dim animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  );
}

function StreamingBubble({ content }) {
  if (!content) return null;
  return (
    <div className="flex gap-2 flex-row">
      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-dax-card text-dax-text-dim">
        <Bot size={11} />
      </div>
      <div className="max-w-[80%] rounded-xl rounded-tl-sm px-3 py-2 text-xs leading-relaxed
        bg-dax-card text-dax-text border border-dax-panel-border">
        {renderMarkdown(content)}
        <span className="inline-block w-1 h-3 ml-0.5 bg-dax-text-dim animate-pulse rounded-sm" />
      </div>
    </div>
  );
}

export default function ChatPanel({ isOpen, onClose, expanded, onToggleExpand }) {
  const [input, setInput] = useState('');
  const { messages, streaming, streamBuffer, startStream, endStream, addMessage, clearHistory, initStreamListener, loadHistory } = useChatStore();
  const { agents, fetch: fetchAgents } = useAgentStore();
  const { models, fetch: fetchModels } = useModelStore();
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchAgents();
      fetchModels();
      loadHistory();
    }
  }, [isOpen]);

  useEffect(() => {
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
    return `You are Dax, a local AI automation assistant. You help users manage agents, automations, and integrations.

Current agents:
${agentList}

Configured models:
${modelList}

Be concise and helpful. Guide users through the app UI when relevant.`;
  }, [agents, models]);

  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || streaming) return;
    setInput('');

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

  if (!isOpen) return null;

  const isEmpty = messages.length === 0 && !streaming;
  const panelWidth = expanded ? 'w-[480px]' : 'w-[340px]';

  return (
    <div className={`${panelWidth} flex flex-col border-l border-dax-panel-border bg-dax-bg/95 backdrop-blur-sm shrink-0 transition-all duration-200`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-dax-panel-border">
        <div className="flex items-center gap-1.5 text-dax-text">
          <MessageSquare size={13} className="text-dax-accent" />
          <span className="font-medium text-xs">Chat</span>
          {streaming && (
            <span className="text-[10px] text-blue-400 flex items-center gap-1">
              <Loader2 size={8} className="animate-spin" /> thinking…
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={clearHistory} className="p-1 rounded text-dax-text-dim hover:text-dax-text hover:bg-dax-card transition-colors" title="Clear">
            <Trash2 size={12} />
          </button>
          <button onClick={onToggleExpand} className="p-1 rounded text-dax-text-dim hover:text-dax-text hover:bg-dax-card transition-colors" title={expanded ? 'Compact' : 'Expand'}>
            {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button onClick={onClose} className="p-1 rounded text-dax-text-dim hover:text-dax-text hover:bg-dax-card transition-colors" title="Close">
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-9 h-9 rounded-full bg-dax-accent/10 flex items-center justify-center">
              <Bot size={18} className="text-dax-accent" />
            </div>
            <div>
              <p className="text-dax-text font-medium text-xs mb-0.5">Chat with Dax</p>
              <p className="text-dax-text-dim text-[10px]">Ask about your agents, models, or automations</p>
            </div>
            <div className="flex flex-col gap-1.5 w-full">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="flex items-center gap-1.5 px-2.5 py-2 bg-dax-card/60 hover:bg-dax-card rounded-lg text-left text-[11px] text-dax-text-dim transition-colors group"
                >
                  <ChevronRight size={9} className="text-dax-text-dim group-hover:text-dax-accent flex-shrink-0" />
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
      <div className="px-3 pb-3 pt-1.5 border-t border-dax-panel-border">
        <div className="flex gap-1.5 items-end bg-dax-card/60 rounded-xl px-2.5 py-1.5 border border-dax-panel-border focus-within:border-dax-accent/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Dax…"
            rows={1}
            className="flex-1 bg-transparent text-dax-text placeholder-dax-text-dim text-xs resize-none outline-none max-h-24 py-0.5"
            style={{ fieldSizing: 'content' }}
            disabled={streaming}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || streaming}
            className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center
              bg-dax-accent hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed
              transition-colors text-white"
          >
            {streaming ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
          </button>
        </div>
      </div>
    </div>
  );
}
