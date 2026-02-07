'use client';

import { useConversationStore } from '@/stores/conversation-store';
import { AnimatePresence, motion } from 'motion/react';
import { LoadingMessage } from './LoadingMessage';
import { MessageItem } from './MessageItem';

export function MessageList() {
  const { messages, isGenerating } = useConversationStore();

  return (
    <div className="space-y-6">
      <AnimatePresence mode="popLayout">
        {messages.map((message, index) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <MessageItem
              message={message}
              isLast={index === messages.length - 1}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      {isGenerating && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <LoadingMessage />
        </motion.div>
      )}
    </div>
  );
}
