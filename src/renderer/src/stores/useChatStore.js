import { create } from 'zustand';

const useChatStore = create((set, get) => ({
  messages: [],
  streaming: false,
  streamBuffer: '',
  inspectorAgent: null,
  _loaded: false,

  // ── Actions ──────────────────────────────────────────────

  loadHistory: async () => {
    if (get()._loaded) return;
    try {
      const rows = await window.dax?.chat?.historyList?.(200);
      if (Array.isArray(rows) && rows.length > 0) {
        set({ messages: rows.map(r => ({ id: r.id, role: r.role, content: r.content, ts: r.ts })), _loaded: true });
      } else {
        set({ _loaded: true });
      }
    } catch (err) {
      console.error('[ChatStore] Failed to load history:', err);
      set({ _loaded: true });
    }
  },

  addMessage: (msg) => {
    const id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8);
    const full = { ...msg, id, ts: msg.ts || new Date().toISOString() };
    set((s) => ({ messages: [...s.messages, full] }));
    window.dax?.chat?.historySave?.(full).catch(() => {});
  },

  startStream: () => set({ streaming: true, streamBuffer: '' }),

  appendToken: (token) =>
    set((s) => ({ streamBuffer: s.streamBuffer + token })),

  endStream: () => {
    const { streamBuffer, messages } = get();
    if (!streamBuffer) {
      set({ streaming: false, streamBuffer: '' });
      return;
    }
    const id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8);
    const assistantMsg = { id, role: 'assistant', content: streamBuffer, ts: new Date().toISOString() };
    set({
      streaming: false,
      streamBuffer: '',
      messages: [...messages, assistantMsg],
    });
    window.dax?.chat?.historySave?.(assistantMsg).catch(() => {});
  },

  setInspectorAgent: (agent) => set({ inspectorAgent: agent }),

  clearHistory: () => {
    set({ messages: [], streamBuffer: '', streaming: false });
    window.dax?.chat?.historyClear?.().catch(() => {});
  },

  // ── Stream listener (call once on mount) ─────────────────

  initStreamListener: () => {
    if (!window.dax?.on?.llmToken) return () => {};
    const unsub = window.dax.on.llmToken(({ token }) => {
      get().appendToken(token);
    });
    return unsub;
  },
}));

export default useChatStore;
