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
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const messageListRef = useRef<MessageListHandle>(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  // TanStack Virtual reads getScrollElement once on mount; if the ref is
  // still null at that moment it never recovers. We gate MessageList on
  // viewportReady so the virtualizer always sees a real DOM node.
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

  // Callback ref — bound to the DOM node's lifecycle, not the parent
  // component's mount cycle. Fires every time ConversationArea swaps
  // between TemplateShowcase (no ScrollArea) and the message-list branch
  // (Radix Viewport mounts/unmounts) without us having to maintain a
  // brittle useEffect deps list against ref+querySelector.
  // Pattern: https://tkdodo.eu/blog/avoiding-use-effect-with-callback-refs
  const setViewport = useCallback(
    (node: HTMLDivElement | null) => {
      const prev = viewportRef.current;
      if (prev && prev !== node) {
        prev.removeEventListener('scroll', updateScrollState);
      }

      viewportRef.current = node;

      if (!node) {
        setViewportReady(false);
        return;
      }

      setViewportReady(true);
      updateScrollState();
      node.addEventListener('scroll', updateScrollState, { passive: true });
    },
    [updateScrollState]
  );

  useEffect(() => {
    if (!showJumpToBottom) {
      scrollToBottom(messages.length > 0 ? 'smooth' : 'auto');
    }
  }, [isGenerating, messages, scrollToBottom, showJumpToBottom]);

  // 没有选中项目或项目无消息时都显示全屏瀑布流（用户可选择模板开始）
  if (!isLoadingMessages && (!currentProjectId || !hasMessages)) {
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
      <ScrollArea viewportRef={setViewport} className="flex-1 min-h-0">
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
