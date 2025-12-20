'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Sparkles, Zap } from 'lucide-react';
import {
  DEFAULT_MODEL,
  type GeminiModelId,
  MODEL_DESCRIPTIONS,
  MODEL_DISPLAY_NAMES,
  PROVIDERS,
} from '../lib/provider-config';

interface ModelSelectorProps {
  selectedModel: GeminiModelId;
  onModelChange: (model: GeminiModelId) => void;
  disabled?: boolean;
  className?: string;
}

// 模型图标映射
const MODEL_ICONS: Record<GeminiModelId, React.ReactNode> = {
  'nano-banana': <Zap className="h-4 w-4 text-yellow-500" />,
  'nano-banana-pro': <Sparkles className="h-4 w-4 text-orange-500" />,
};

export function ModelSelector({
  selectedModel,
  onModelChange,
  disabled = false,
  className,
}: ModelSelectorProps) {
  const models = PROVIDERS.gemini.models;

  return (
    <div className={cn('space-y-2', className)}>
      <span className="text-sm font-medium text-foreground">Model</span>
      <Select
        value={selectedModel}
        onValueChange={(value) => onModelChange(value as GeminiModelId)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a model">
            <div className="flex items-center gap-2">
              {MODEL_ICONS[selectedModel]}
              <span>{MODEL_DISPLAY_NAMES[selectedModel]}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {models.map((modelId) => (
            <SelectItem key={modelId} value={modelId}>
              <div className="flex items-center gap-2">
                {MODEL_ICONS[modelId]}
                <div className="flex flex-col">
                  <span className="font-medium">
                    {MODEL_DISPLAY_NAMES[modelId]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {MODEL_DESCRIPTIONS[modelId]}
                  </span>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
