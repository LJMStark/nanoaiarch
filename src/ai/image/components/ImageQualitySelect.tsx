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
import { useTranslations } from 'next-intl';

// 画质类型
export type ImageQuality = '1K' | '2K' | '4K';

// 画质选项配置
const QUALITY_OPTIONS: {
  id: ImageQuality;
  labelKey: string;
  descKey: string;
}[] = [
  { id: '1K', labelKey: 'standard', descKey: 'standardDesc' },
  { id: '2K', labelKey: '2k', descKey: '2kDesc' },
  { id: '4K', labelKey: '4k', descKey: '4kDesc' },
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
  const t = useTranslations('ArchPage.quality');
  const tControls = useTranslations('ArchPage.controls');
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
          <span className="truncate">
            {selectedOption
              ? t(selectedOption.labelKey as any)
              : tControls('quality')}
          </span>
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
              <span className="font-medium">{t(option.labelKey as any)}</span>
              <span className="text-xs text-muted-foreground">
                {t(option.descKey as any)}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
