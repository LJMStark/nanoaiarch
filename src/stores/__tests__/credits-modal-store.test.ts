import { beforeEach, describe, expect, it } from 'vitest';
import { useCreditsModalStore } from '../credits-modal-store';

describe('credits-modal-store', () => {
  beforeEach(() => {
    useCreditsModalStore.getState().close();
  });

  it('opens with the supplied required-credits value', () => {
    useCreditsModalStore.getState().open({ requiredCredits: 50 });

    const state = useCreditsModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.requiredCredits).toBe(50);
  });

  it('falls back to null when requiredCredits is omitted', () => {
    useCreditsModalStore.getState().open({});

    const state = useCreditsModalStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.requiredCredits).toBeNull();
  });

  it('close() resets both isOpen and requiredCredits', () => {
    useCreditsModalStore.getState().open({ requiredCredits: 7 });
    useCreditsModalStore.getState().close();

    const state = useCreditsModalStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.requiredCredits).toBeNull();
  });
});
