export type SerializableDate = string | Date;

export type MessageRole = 'user' | 'assistant';

export type GeminiConversationPart =
  | {
      type: 'text';
      text: string;
      thoughtSignature?: string;
    }
  | {
      type: 'image';
      mimeType?: string;
      thoughtSignature?: string;
    };

export type ConversationHistoryMessage = {
  role: 'user' | 'model';
  content: string;
  image?: string;
  parts?: GeminiConversationPart[];
};

export type ImageProjectItem = {
  id: string;
  title: string;
  coverImage: string | null;
  templateId: string | null;
  stylePreset: string | null;
  aspectRatio: string | null;
  model: string | null;
  messageCount: number;
  generationCount: number;
  totalCreditsUsed: number;
  status: string;
  isPinned: boolean;
  lastActiveAt: SerializableDate;
  createdAt: SerializableDate;
};

export type CreateImageProjectInput = {
  title?: string;
  templateId?: string;
  stylePreset?: string;
  aspectRatio?: string;
};

export type UpdateImageProjectInput = Partial<{
  title: string;
  coverImage: string;
  stylePreset: string;
  aspectRatio: string;
  model: string;
}>;

export type ProjectMessageItem = {
  id: string;
  projectId: string;
  role: MessageRole;
  content: string;
  inputImage: string | null;
  outputImage: string | null;
  maskImage: string | null;
  generationParams: string | null;
  creditsUsed: number | null;
  generationTime: number | null;
  status: string;
  errorMessage: string | null;
  orderIndex: number;
  createdAt: SerializableDate;
};

export type GenerationParams = {
  prompt: string;
  enhancedPrompt?: string;
  style?: string;
  aspectRatio?: string;
  model?: string;
  imageQuality?: string;
  modelResponseParts?: GeminiConversationPart[];
};

export type ConversationInitData = {
  projects: ImageProjectItem[];
  messages: ProjectMessageItem[];
  currentProjectId: string | null;
};

export type ConversationInitMode = 'resume' | 'blank' | 'new-project';

export type MessageStatusItem = {
  id: string;
  status: string;
  outputImage: string | null;
  errorMessage: string | null;
  creditsUsed: number | null;
  generationTime: number | null;
  updatedAt: SerializableDate;
};
