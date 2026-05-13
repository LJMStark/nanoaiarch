'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useConversationStore } from '@/stores/conversation-store';
import { useProjectStore } from '@/stores/project-store';
import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageList, type MessageListHandle } from './MessageList';
import { TemplateShowcase } from './TemplateShowcase';

export function ConversationArea() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const messageListRef = useRef<MessageListHandle>(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  // TanStack Virtual reads getScrollElement once at init; if the ref is
  // still null then, it never recovers. Gate MessageList rendering on a
  // confirmed viewport so the virtualizer initializes with a real element.
  const [viewportReady, setViewportReady] = useState(false);
  const { currentProjectId } = useProjectStore();
  const { messages, isLoadingMessages, isGenerating } = useConversationStore();

  const hasMessages = messages.length > 0;
  // Delegates to the virtualizer's scrollToIndex so the scroll position
  // stays correct after measureElement resolves real row heights — a raw
  // viewport.scrollTo(scrollHeight) would jitter when the initial size
  // estimate differs from the measured height.
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    setTimeout(() => {
      messageListRef.current?.scrollToBottom(behavior);
      setShowJumpToBottom(false);
    }, 100);
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
      // ScrollArea hasn't mounted yet — happens when ConversationArea
      // first renders the TemplateShowcase branch (no messages yet) and
      // only later swaps to the ScrollArea once the user submits.
      setViewportReady(false);
      return;
    }

    setViewportReady(true);
    updateScrollState();
    viewport.addEventListener('scroll', updateScrollState, { passive: true });

    return () => {
      viewport.removeEventListener('scroll', updateScrollState);
    };
    // hasMessages / isLoadingMessages / currentProjectId are listed so the
    // effect re-runs every time the parent flips between TemplateShowcase
    // and the ScrollArea branches; otherwise the viewport ref stays null
    // forever after the first empty mount and MessageList never renders.
  }, [updateScrollState, hasMessages, isLoadingMessages, currentProjectId]);

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
            {viewportReady && (
              <MessageList
                ref={messageListRef}
                scrollViewportRef={viewportRef}
              />
            )}
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
