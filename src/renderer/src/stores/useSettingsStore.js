import { create } from 'zustand';

const useSettingsStore = create((set) => ({
  settings: {},
  loading: false,

  fetchAll: async () => {
    set({ loading: true });
    try {
      const settings = await window.dax.settings.getAll();
      set({ settings, loading: false });
    } catch (e) {
      console.error('Failed to fetch settings:', e);
      set({ loading: false });
    }
  },

  get: (key, fallback = null) => {
    const { settings } = useSettingsStore.getState();
    return settings[key] ?? fallback;
  },

  set: async (key, value) => {
    try {
      await window.dax.settings.set(key, value);
      set((s) => ({ settings: { ...s.settings, [key]: value } }));
    } catch (e) {
      console.error('Failed to set setting:', e);
      throw e;
    }
  },
}));

export default useSettingsStore;
