'use client';

// 画质选择器
// Image quality selector for Duomi API

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ChevronDown, Sparkles } from 'lucide-react';

// 画质类型
export type ImageQuality = '1K' | '2K' | '4K';

// 画质选项配置
const QUALITY_OPTIONS: {
  id: ImageQuality;
  label: string;
  description: string;
}[] = [
  { id: '1K', label: 'Standard', description: '1K resolution, faster' },
  { id: '2K', label: '2K', description: '2K resolution, balanced' },
  { id: '4K', label: '4K', description: '4K resolution, highest quality' },
];

interface ImageQualitySelectProps {
  value: ImageQuality;
  onChange: (value: ImageQuality) => void;
  className?: string;
}

export function ImageQualitySelect({
  value,
  onChange,
  className,
}: ImageQualitySelectProps) {
  const selectedOption = QUALITY_OPTIONS.find((opt) => opt.id === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-9 gap-2 border-input/50 bg-background/50 backdrop-blur-sm',
            'hover:bg-background/80 hover:border-input',
            'justify-start',
            className
          )}
        >
          <Sparkles className="h-4 w-4" />
          <span className="truncate">{selectedOption?.label || 'Quality'}</span>
          <ChevronDown className="h-3 w-3 opacity-50 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {QUALITY_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.id}
            onClick={() => onChange(option.id)}
            className={cn(value === option.id && 'bg-accent')}
          >
            <div className="flex flex-col">
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">
                {option.description}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
