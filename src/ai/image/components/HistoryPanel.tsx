'use client';

// Recent generation history panel for sidebar
// 侧边栏历史记录面板

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Clock, ImageIcon, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useState } from 'react';
import type { GenerationHistoryItem } from '../lib/arch-types';

interface HistoryPanelProps {
  history: GenerationHistoryItem[];
  onItemClick: (item: GenerationHistoryItem) => void;
  onClear: () => void;
  className?: string;
}

// Format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;

  return new Date(timestamp).toLocaleDateString('zh-CN');
}

export function HistoryPanel({
  history,
  onItemClick,
  onClear,
  className,
}: HistoryPanelProps) {
  const t = useTranslations('ArchPage');

  if (history.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">
          {t('sidebar.noHistory')}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header with clear button */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground">
          {t('sidebar.recent')}
        </span>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              aria-label={t('sidebar.clearHistory')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('sidebar.clearHistoryConfirmTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('sidebar.clearHistoryConfirmDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {t('sidebar.clearHistoryCancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={onClear}
                className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20"
              >
                {t('sidebar.clearHistoryConfirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* History items */}
      <div className="space-y-1">
        {history.slice(0, 10).map((item) => (
          <HistoryItem
            key={item.id}
            item={item}
            onClick={() => onItemClick(item)}
          />
        ))}
      </div>
    </div>
  );
}

// Individual history item
function HistoryItem({
  item,
  onClick,
}: {
  item: GenerationHistoryItem;
  onClick: () => void;
}) {
  const t = useTranslations('ArchPage');
  const [imageError, setImageError] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-2 rounded-lg',
        'hover:bg-muted/50 transition-colors',
        'text-left group'
      )}
    >
      {/* Thumbnail */}
      <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
        {imageError ? (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
          </div>
        ) : (
          <Image
            src={`data:image/png;base64,${item.outputImage}`}
            alt={t('canvas.generatedImageAlt')}
            width={40}
            height={40}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">
          {item.prompt.slice(0, 50)}
          {item.prompt.length > 50 && '...'}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {formatRelativeTime(item.timestamp)}
        </p>
      </div>
    </button>
  );
}
