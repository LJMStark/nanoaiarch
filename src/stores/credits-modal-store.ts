import { create } from 'zustand';

/**
 * Lightweight global state for the InsufficientCreditsModal.
 *
 * The trigger (a generation submission encountering 402) and the modal
 * (mounted higher up in the tree alongside ConversationLayout) live in
 * different parts of the component graph. Rather than thread a callback
 * through every prop boundary, we open the modal via a tiny dedicated store.
 *
 * This is intentionally separate from conversation-store and project-store —
 * the modal has nothing to do with the message list or project metadata,
 * and isolating it keeps subscribers stable (no extra re-renders elsewhere
 * when the modal opens or closes).
 */
interface CreditsModalState {
  isOpen: boolean;
  /** Credits the user attempted to spend that exceeded their balance. */
  requiredCredits: number | null;
  open: (params: { requiredCredits?: number }) => void;
  close: () => void;
}

export const useCreditsModalStore = create<CreditsModalState>((set) => ({
  isOpen: false,
  requiredCredits: null,
  open: ({ requiredCredits }) =>
    set({ isOpen: true, requiredCredits: requiredCredits ?? null }),
  close: () => set({ isOpen: false, requiredCredits: null }),
}));
