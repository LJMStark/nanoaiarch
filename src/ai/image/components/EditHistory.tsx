'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { History, Trash2 } from 'lucide-react';
import Image from 'next/image';
import type { EditHistoryItem } from '../lib/image-types';

interface EditHistoryProps {
  history: EditHistoryItem[];
  onSelectItem: (item: EditHistoryItem) => void;
  onClearHistory: () => void;
  className?: string;
}

export function EditHistory({
  history,
  onSelectItem,
  onClearHistory,
  className,
}: EditHistoryProps) {
  if (history.length === 0) {
    return (
      <div className={cn('rounded-lg border bg-muted/30 p-4', className)}>
        <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
          <History className="h-8 w-8" />
          <p className="text-sm">No edit history yet</p>
          <p className="text-xs">Your edits will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border', className)}>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Edit History</span>
          <span className="text-xs text-muted-foreground">
            ({history.length})
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearHistory}
          className="h-7 px-2 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="h-[200px]">
        <div className="space-y-2 p-2">
          {history.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectItem(item)}
              className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-muted"
            >
              {/* 缩略图 */}
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                <Image
                  src={`data:image/png;base64,${item.afterImage}`}
                  alt="Edit result"
                  fill
                  className="object-cover"
                />
              </div>

              {/* 编辑信息 */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{item.prompt}</p>
                <p className="text-xs text-muted-foreground">
                  {formatTimestamp(item.timestamp)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// 格式化时间戳
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // 1 分钟内
  if (diff < 60 * 1000) {
    return 'Just now';
  }

  // 1 小时内
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes}m ago`;
  }

  // 24 小时内
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}h ago`;
  }

  // 超过 24 小时显示日期
  return date.toLocaleDateString();
}
