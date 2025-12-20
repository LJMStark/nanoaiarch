'use client';

import { cn } from '@/lib/utils';
import { ImagePlus, Pencil } from 'lucide-react';
import type { ImageMode } from '../lib/image-types';

interface ModeSwitcherProps {
  mode: ImageMode;
  onModeChange: (mode: ImageMode) => void;
  disabled?: boolean;
  className?: string;
}

export function ModeSwitcher({
  mode,
  onModeChange,
  disabled = false,
  className,
}: ModeSwitcherProps) {
  return (
    <div
      className={cn('inline-flex rounded-lg border bg-muted p-1', className)}
    >
      <button
        type="button"
        onClick={() => onModeChange('generate')}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          mode === 'generate'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <ImagePlus className="h-4 w-4" />
        Generate
      </button>
      <button
        type="button"
        onClick={() => onModeChange('edit')}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          mode === 'edit'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <Pencil className="h-4 w-4" />
        Edit
      </button>
    </div>
  );
}
