'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { motion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

export function LoadingMessage() {
  const t = useTranslations('ArchPage');
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const loadingMessages = [
    t('loading.analyzing'),
    t('loading.generating'),
    t('loading.detailing'),
    t('loading.almost'),
  ];

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 3000);

    const timeInterval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(messageInterval);
      clearInterval(timeInterval);
    };
  }, []);

  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 flex-shrink-0 bg-primary">
        <AvatarFallback className="bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-3">
        <div className="relative max-w-lg">
          {/* Placeholder loading animation */}
          <div className="aspect-square rounded-xl bg-muted overflow-hidden">
            <div className="relative h-full w-full">
              {/* Animated gradient background */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary/20 to-primary/20"
                animate={{
                  backgroundPosition: ['0% 0%', '100% 100%'],
                }}
                transition={{
                  duration: 3,
                  repeat: Number.POSITIVE_INFINITY,
                  repeatType: 'reverse',
                }}
                style={{
                  backgroundSize: '200% 200%',
                }}
              />

              {/* Center loading indicator */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 2,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: 'linear',
                  }}
                >
                  <Loader2 className="h-8 w-8 text-primary" />
                </motion.div>
                <motion.p
                  key={messageIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-sm text-muted-foreground"
                >
                  {loadingMessages[messageIndex]}
                </motion.p>
              </div>
            </div>
          </div>

          {/* Timer */}
          <div className="mt-1 text-xs text-muted-foreground">
            {t('loading.elapsed', { seconds: elapsedTime })}
          </div>
        </div>
      </div>
    </div>
  );
}
