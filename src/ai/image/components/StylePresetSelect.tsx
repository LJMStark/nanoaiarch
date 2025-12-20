'use client';

// Style preset selector dropdown
// 建筑风格预设选择器

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ChevronDown, Palette, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { StylePresetId } from '../lib/arch-types';
import { STYLE_PRESET_LIST, getStylePreset } from '../lib/style-presets';

interface StylePresetSelectProps {
  value: StylePresetId | null;
  onChange: (value: StylePresetId | null) => void;
  className?: string;
}

export function StylePresetSelect({ value, onChange, className }: StylePresetSelectProps) {
  const t = useTranslations();

  const selectedPreset = value ? getStylePreset(value) : null;
  const Icon = selectedPreset?.icon ?? Palette;

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
          <Icon className="h-4 w-4" style={{ color: selectedPreset?.color }} />
          <span className="max-w-[100px] truncate">
            {selectedPreset ? t(selectedPreset.labelKey as any) : t('ArchPage.controls.style')}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {value && (
          <DropdownMenuItem
            onClick={() => onChange(null)}
            className="text-muted-foreground"
          >
            <X className="mr-2 h-4 w-4" />
            {t('ArchPage.controls.clearStyle')}
          </DropdownMenuItem>
        )}
        {STYLE_PRESET_LIST.map((preset) => {
          const PresetIcon = preset.icon;
          return (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => onChange(preset.id)}
              className={cn(value === preset.id && 'bg-accent')}
            >
              <PresetIcon
                className="mr-2 h-4 w-4"
                style={{ color: preset.color }}
              />
              <span>{t(preset.labelKey as any)}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
