'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useConversationStore } from '@/stores/conversation-store';
import { useProjectStore } from '@/stores/project-store';
import { useEffect, useRef } from 'react';
import { MessageList } from './MessageList';
import { TemplateShowcase } from './TemplateShowcase';

export function ConversationArea() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { currentProjectId } = useProjectStore();
  const { messages, isLoadingMessages, isGenerating } = useConversationStore();

  const hasMessages = messages.length > 0;

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isGenerating]);

  // 没有消息时显示全屏瀑布流画廊（无论是否有项目）
  if (!hasMessages && !isLoadingMessages) {
    return (
      <div className="flex-1 overflow-hidden">
        <TemplateShowcase showFullView />
      </div>
    );
  }

  if (isLoadingMessages) {
    return (
      <div className="flex-1 p-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 有消息时显示消息列表
  return (
    <ScrollArea ref={scrollRef} className="flex-1">
      <div className="p-4">
        <div className="max-w-3xl mx-auto">
          <MessageList />
        </div>
      </div>
    </ScrollArea>
  );
}
