import { create } from 'zustand';

/**
 * One-shot composer prefill. Settings (Plugins) sets a draft; ChatScreen
 * consumes and clears it when the chat tab is shown.
 */
export const useComposerDraftStore = create((set, get) => ({
  draft: null,
  setDraft: (text) => set({ draft: text ? String(text) : null }),
  consumeDraft: () => {
    const { draft } = get();
    set({ draft: null });
    return draft;
  },
}));
