import type { SerializableDate } from './workspace-types';

export type GenerationHistoryItem = {
  id: string;
  templateId: string | null;
  templateName: string | null;
  prompt: string;
  enhancedPrompt: string | null;
  style: string | null;
  aspectRatio: string | null;
  model: string | null;
  imageUrl: string | null;
  referenceImageUrl: string | null;
  creditsUsed: number;
  status: string;
  isFavorite: boolean;
  isPublic: boolean;
  createdAt: SerializableDate;
};

export type GenerationStats = {
  totalGenerations: number;
  totalCreditsUsed: number;
  favoriteCount: number;
  thisMonthGenerations: number;
};
