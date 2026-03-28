'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useConversationStore } from '@/stores/conversation-store';
import { useProjectStore } from '@/stores/project-store';
import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageList } from './MessageList';
import { TemplateShowcase } from './TemplateShowcase';

export function ConversationArea() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const { currentProjectId } = useProjectStore();
  const { messages, isLoadingMessages, isGenerating } = useConversationStore();

  const hasMessages = messages.length > 0;
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    setTimeout(() => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }

      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior,
      });
      setShowJumpToBottom(false);
    }, 100); // 延迟执行以确保React渲染和Framer Motion动画完成
  }, []);

  const updateScrollState = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const distanceToBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    setShowJumpToBottom(distanceToBottom > 96);
  }, []);

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector<HTMLDivElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    viewportRef.current = viewport ?? null;

    if (!viewport) {
      return;
    }

    updateScrollState();
    viewport.addEventListener('scroll', updateScrollState, { passive: true });

    return () => {
      viewport.removeEventListener('scroll', updateScrollState);
    };
  }, [updateScrollState]);

  useEffect(() => {
    if (!showJumpToBottom) {
      scrollToBottom(messages.length > 0 ? 'smooth' : 'auto');
    }
  }, [isGenerating, messages, scrollToBottom, showJumpToBottom]);

  // 没有选中项目时显示全屏瀑布流画廊
  if (!currentProjectId && !isLoadingMessages) {
    return (
      <div className="flex-1 min-h-0 overflow-hidden">
        <TemplateShowcase showFullView />
      </div>
    );
  }

  // 有项目但没有消息时也显示瀑布流（用户可以选择模板开始）
  if (!hasMessages && !isLoadingMessages) {
    return (
      <div className="flex-1 min-h-0 overflow-hidden">
        <TemplateShowcase showFullView />
      </div>
    );
  }

  if (isLoadingMessages) {
    return (
      <div className="flex-1 min-h-0 p-4 overflow-auto">
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
    <div className="relative flex flex-1 min-h-0 flex-col">
      <ScrollArea ref={scrollRef} className="flex-1 min-h-0">
        <div className="p-4">
          <div className="max-w-3xl mx-auto">
            <MessageList />
          </div>
        </div>
      </ScrollArea>

      {showJumpToBottom && (
        <div className="pointer-events-none absolute bottom-4 right-4">
          <Button
            type="button"
            size="icon"
            className="pointer-events-auto rounded-full shadow-lg"
            onClick={() => scrollToBottom('smooth')}
            aria-label="跳转到底部"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
