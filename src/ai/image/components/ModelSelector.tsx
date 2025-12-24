'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Crown, Sparkles, Zap } from 'lucide-react';
import { CREDIT_COSTS } from '../lib/credit-costs';
import {
  type GeminiModelId,
  MODEL_DESCRIPTIONS,
  MODEL_DISPLAY_NAMES,
  PROVIDERS,
  PROVIDER_ORDER,
} from '../lib/provider-config';

interface ModelSelectorProps {
  selectedModel: GeminiModelId;
  onModelChange: (model: GeminiModelId) => void;
  disabled?: boolean;
  className?: string;
}

// 模型图标映射
const MODEL_ICONS: Record<GeminiModelId, React.ReactNode> = {
  forma: <Zap className="h-4 w-4 text-violet-500" />,
  'forma-pro': <Sparkles className="h-4 w-4 text-purple-500" />,
  'nano-banana-pro': <Crown className="h-4 w-4 text-amber-500" />,
};

export function ModelSelector({
  selectedModel,
  onModelChange,
  disabled = false,
  className,
}: ModelSelectorProps) {
  // 获取所有 providers 的模型列表
  const allModels = PROVIDER_ORDER.flatMap(
    (providerKey) => PROVIDERS[providerKey].models
  );

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
          {allModels.map((modelId) => (
            <SelectItem key={modelId} value={modelId}>
              <div className="flex items-center gap-2">
                {MODEL_ICONS[modelId]}
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {MODEL_DISPLAY_NAMES[modelId]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {CREDIT_COSTS[modelId]} credits
                    </span>
                  </div>
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
