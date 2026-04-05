import { create } from 'zustand';

const useRunStore = create((set, get) => ({
  runs: [],
  activeRuns: [],
  loading: false,

  // liveRuns: Map<runId, { agentId, agentName, steps[], status, startedAt }>
  liveRuns: new Map(),

  fetch: async (agentId = null, limit = 50) => {
    set({ loading: true });
    try {
      const runs = await window.dax.runs.list(agentId, limit);
      set({
        runs,
        activeRuns: runs.filter((r) => r.status === 'running'),
        loading: false,
      });
    } catch (e) {
      console.error('Failed to fetch runs:', e);
      set({ loading: false });
    }
  },

  get: async (id) => {
    try {
      return await window.dax.runs.get(id);
    } catch (e) {
      console.error('Failed to get run:', e);
      return null;
    }
  },

  // Initialize event listeners for live tracking
  initLiveTracking: () => {
    if (!window.dax?.on) return;
    const _unsubs = [];

    _unsubs.push(window.dax.on.runStarted((data) => {
      set((state) => {
        const next = new Map(state.liveRuns);
        next.set(data.runId, {
          agentId: data.agentId,
          agentName: data.agentName || data.agentId,
          steps: [],
          status: 'running',
          startedAt: data.startedAt || new Date().toISOString(),
        });
        return { liveRuns: next };
      });
    }));

    _unsubs.push(window.dax.on.runStep((data) => {
      set((state) => {
        const next = new Map(state.liveRuns);
        const entry = next.get(data.runId);
        if (entry) {
          next.set(data.runId, {
            ...entry,
            steps: [...entry.steps, data.step],
          });
        }
        return { liveRuns: next };
      });
    }));

    _unsubs.push(window.dax.on.runCompleted((data) => {
      set((state) => {
        const next = new Map(state.liveRuns);
        next.delete(data.runId);
        return { liveRuns: next };
      });
      // Refresh historical runs after completion
      get().fetch();
    }));

    return () => _unsubs.forEach((u) => u?.());
  },
}));

export default useRunStore;
