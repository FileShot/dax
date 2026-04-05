import { create } from 'zustand';

const useModelStore = create((set) => ({
  models: [],
  loading: false,
  scanning: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const models = await window.dax.models.list();
      set({ models, loading: false });
    } catch (e) {
      console.error('Failed to fetch models:', e);
      set({ loading: false });
    }
  },

  scanLocal: async () => {
    set({ scanning: true });
    try {
      const found = await window.dax.models.scanLocal();
      set({ scanning: false });
      return found;
    } catch (e) {
      console.error('Failed to scan local models:', e);
      set({ scanning: false });
      return [];
    }
  },

  add: async (data) => {
    try {
      const model = await window.dax.models.add(data);
      set((s) => ({ models: [...s.models, model] }));
      return model;
    } catch (e) {
      console.error('Failed to add model:', e);
      throw e;
    }
  },

  remove: async (id) => {
    try {
      await window.dax.models.delete(id);
      set((s) => ({ models: s.models.filter((m) => m.id !== id) }));
    } catch (e) {
      console.error('Failed to delete model:', e);
      throw e;
    }
  },
}));

export default useModelStore;
