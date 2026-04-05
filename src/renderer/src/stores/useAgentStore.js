import { create } from 'zustand';

const useAgentStore = create((set, get) => ({
  agents: [],
  selectedId: null,
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const agents = await window.dax.agents.list();
      set({ agents, loading: false });
    } catch (e) {
      console.error('Failed to fetch agents:', e);
      set({ loading: false });
    }
  },

  select: (id) => set({ selectedId: id }),

  getSelected: () => {
    const { agents, selectedId } = get();
    return agents.find((a) => a.id === selectedId) || null;
  },

  create: async (data) => {
    try {
      const agent = await window.dax.agents.create(data);
      set((s) => ({ agents: [...s.agents, agent] }));
      return agent;
    } catch (e) {
      console.error('Failed to create agent:', e);
      throw e;
    }
  },

  update: async (id, data) => {
    try {
      const updated = await window.dax.agents.update(id, data);
      set((s) => ({
        agents: s.agents.map((a) => (a.id === id ? updated : a)),
      }));
      return updated;
    } catch (e) {
      console.error('Failed to update agent:', e);
      throw e;
    }
  },

  remove: async (id) => {
    try {
      await window.dax.agents.delete(id);
      set((s) => ({
        agents: s.agents.filter((a) => a.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
      }));
    } catch (e) {
      console.error('Failed to delete agent:', e);
      throw e;
    }
  },

  toggle: async (id) => {
    try {
      const result = await window.dax.agents.toggle(id);
      set((s) => ({
        agents: s.agents.map((a) =>
          a.id === id ? { ...a, enabled: result.enabled } : a
        ),
      }));
    } catch (e) {
      console.error('Failed to toggle agent:', e);
      throw e;
    }
  },
}));

export default useAgentStore;
