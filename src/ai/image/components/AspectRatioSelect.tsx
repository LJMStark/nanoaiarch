'use client';

// Aspect ratio selector dropdown
// 画幅比例选择器

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AspectRatioId } from '../lib/arch-types';
import { ASPECT_RATIO_LIST, getAspectRatio } from '../lib/aspect-ratios';

interface AspectRatioSelectProps {
  value: AspectRatioId;
  onChange: (value: AspectRatioId) => void;
  className?: string;
}

export function AspectRatioSelect({
  value,
  onChange,
  className,
}: AspectRatioSelectProps) {
  const t = useTranslations();

  const selectedRatio = getAspectRatio(value);
  const Icon = selectedRatio.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-9 gap-2 border-input/50 bg-background/50 backdrop-blur-sm',
            'hover:bg-background/80 hover:border-input',
            className
          )}
        >
          <Icon className="h-4 w-4" />
          <span>{value}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {ASPECT_RATIO_LIST.map((ratio) => {
          const RatioIcon = ratio.icon;
          return (
            <DropdownMenuItem
              key={ratio.id}
              onClick={() => onChange(ratio.id)}
              className={cn(value === ratio.id && 'bg-accent')}
            >
              <RatioIcon className="mr-2 h-4 w-4" />
              <span className="flex-1">{t(ratio.labelKey as any)}</span>
              <span className="text-xs text-muted-foreground">{ratio.id}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
