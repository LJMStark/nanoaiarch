/**
 * Shared generation service
 *
 * Provides prompt enhancement utilities used by both the Playground
 * (template browsing) and Conversation (actual generation) systems.
 *
 * The Conversation system handles actual API calls via ConversationInput + api-utils.
 * This module only provides prompt-building helpers that can be reused.
 */

export { buildArchPrompt } from './system-prompts';
export type { AspectRatioId, StylePresetId } from './arch-types';
