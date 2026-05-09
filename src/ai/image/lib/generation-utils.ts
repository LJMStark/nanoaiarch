import type { ProjectMessageItem } from '@/ai/image/lib/workspace-types';
import { useConversationStore } from '@/stores/conversation-store';

/**
 * Shape of the persisted assistant message returned by the workspace API.
 *
 * Mirrors the wire format closely (createdAt may be a string or Date depending
 * on the response path) so callers can normalize both cases through
 * {@link normalizePersistedAssistantMessage}.
 */
export type PersistedAssistantMessageLike = {
  content: string;
  outputImage: string | null;
  generationParams: string | null;
  creditsUsed: number | null;
  generationTime: number | null;
  status: string;
  errorMessage: string | null;
  orderIndex: number;
  createdAt: string | Date;
};

/**
 * Generation lifecycle stage as surfaced in the UI loading indicator.
 */
export type GenerationStage =
  | 'submitting'
  | 'queued'
  | 'generating'
  | 'finishing'
  | null;

/**
 * Setter callbacks needed to clear in-flight generation state. Each caller
 * passes the relevant Zustand setters so this helper does not have to import
 * the store directly (keeps it composable in tests).
 */
export interface ClearGenerationDeps {
  setAbortController: (controller: AbortController | null) => void;
  setGenerationRequestToken: (token: string | null) => void;
  setGenerating: (isGenerating: boolean, generatingMessageId?: string) => void;
  setGenerationStage: (stage: GenerationStage) => void;
}

/**
 * Convert a persisted assistant message (from the API) into the partial
 * ProjectMessageItem shape used to patch the in-memory store.
 *
 * Hoisted from MessageItem.tsx and use-conversation-submit.ts where two
 * identical copies had drifted apart.
 */
export function normalizePersistedAssistantMessage(
  message: PersistedAssistantMessageLike
): Partial<ProjectMessageItem> {
  return {
    content: message.content,
    outputImage: message.outputImage,
    generationParams: message.generationParams,
    creditsUsed: message.creditsUsed,
    generationTime: message.generationTime,
    status: message.status,
    errorMessage: message.errorMessage,
    orderIndex: message.orderIndex,
    createdAt: new Date(message.createdAt),
  };
}

/**
 * Treats both the canonical English error text and its Chinese translation
 * as the cancelled signal so retry/recovery paths agree across locales.
 */
export function isGenerationCancelled(error?: string): boolean {
  return error === 'Generation cancelled' || error === '生成已取消';
}

/**
 * Returns true iff the given (requestToken, generatingMessageId) pair is
 * still the active generation in the conversation store. Used by retry and
 * polling paths to ignore stale completions after a project switch or
 * cancellation.
 */
export function isActiveGenerationRequest(
  requestToken: string,
  generatingMessageId: string
): boolean {
  const state = useConversationStore.getState();
  return (
    state.generationRequestToken === requestToken &&
    state.generatingMessageId === generatingMessageId
  );
}

/**
 * Clear in-flight generation flags only when the caller still owns them.
 *
 * Two-phase guard:
 *   1. If our requestToken is still the active one, drop the abort controller
 *      and request token (so a new request can take over).
 *   2. If our generatingMessageId is still the active one (or unspecified),
 *      flip isGenerating off and reset the stage indicator.
 *
 * This conservative ownership check is what allows two retry attempts (or a
 * retry racing with the original request) to clean up safely without
 * stomping on each other.
 */
export function clearFinishedGeneration(
  requestToken: string,
  generatingMessageId: string | null,
  deps: ClearGenerationDeps
): void {
  const state = useConversationStore.getState();

  if (state.generationRequestToken === requestToken) {
    deps.setAbortController(null);
    deps.setGenerationRequestToken(null);
  }

  if (
    !generatingMessageId ||
    state.generatingMessageId === generatingMessageId
  ) {
    deps.setGenerating(false);
    deps.setGenerationStage(null);
  }
}
