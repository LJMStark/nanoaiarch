'use client';

import { useConversationStore } from '@/stores/conversation-store';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  type Ref,
  type RefObject,
  useCallback,
  useImperativeHandle,
} from 'react';
import { MessageItem } from './MessageItem';

export interface MessageListHandle {
  scrollToBottom: (behavior?: ScrollBehavior) => void;
}

interface MessageListProps {
  scrollViewportRef: RefObject<HTMLDivElement | null>;
  ref?: Ref<MessageListHandle>;
}

// Estimated row height before measurement; deliberately tall so the
// initial scroll-to-bottom does not undershoot. Real heights are
// resolved via measureElement after first paint.
const ESTIMATED_ROW_HEIGHT = 400;
const ROW_GAP_PX = 24;

export function MessageList({ scrollViewportRef, ref }: MessageListProps) {
  const messages = useConversationStore((state) => state.messages);

  const getScrollElement = useCallback(
    () => scrollViewportRef.current,
    [scrollViewportRef]
  );

  // Stable item key by message id — required so measureElement keeps the
  // right row->size mapping even when DOM nodes are reused mid-list.
  const getItemKey = useCallback(
    (index: number) => messages[index]?.id ?? index,
    [messages]
  );

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 4,
    gap: ROW_GAP_PX,
    getItemKey,
  });

  useImperativeHandle(
    ref,
    () => ({
      scrollToBottom: (behavior: ScrollBehavior = 'smooth') => {
        if (messages.length === 0) {
          return;
        }
        virtualizer.scrollToIndex(messages.length - 1, {
          align: 'end',
          behavior,
        });
      },
    }),
    [virtualizer, messages.length]
  );

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      style={{
        height: totalSize,
        width: '100%',
        position: 'relative',
      }}
    >
      {virtualItems.map((virtualRow) => {
        const message = messages[virtualRow.index];
        if (!message) {
          return null;
        }
        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <MessageItem
              message={message}
              isLast={virtualRow.index === messages.length - 1}
            />
          </div>
        );
      })}
    </div>
  );
}
