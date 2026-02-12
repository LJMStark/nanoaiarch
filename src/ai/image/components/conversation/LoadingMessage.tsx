'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { GenerationStage } from '@/stores/conversation-store';
import { useConversationStore } from '@/stores/conversation-store';
import { Loader2, Sparkles, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

const STAGES: Exclude<GenerationStage, null>[] = [
  'submitting',
  'queued',
  'generating',
  'finishing',
];

export function LoadingMessage() {
  const t = useTranslations('ArchPage');
  const [elapsedTime, setElapsedTime] = useState(0);
  const { generationStage, cancelGeneration } = useConversationStore();

  useEffect(() => {
    const timeInterval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timeInterval);
  }, []);

  const currentStageIndex = STAGES.indexOf(
    generationStage ?? 'submitting'
  );

  const stageTextMap = {
    submitting: t('loading.stage_submitting'),
    queued: t('loading.stage_queued'),
    generating: t('loading.stage_generating'),
    finishing: t('loading.stage_finishing'),
  } as const;

  const stageText = stageTextMap[generationStage ?? 'submitting'];

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
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
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
                  key={generationStage}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-sm text-muted-foreground"
                >
                  {stageText}
                </motion.p>

                {/* Stage progress dots */}
                <div className="flex items-center gap-2">
                  {STAGES.map((stage, i) => (
                    <div
                      key={stage}
                      className={`h-1.5 w-6 rounded-full transition-colors duration-300 ${
                        i <= currentStageIndex
                          ? 'bg-primary'
                          : 'bg-muted-foreground/20'
                      }`}
                    />
                  ))}
                </div>

                {/* Cancel button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelGeneration}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-1" />
                  {t('loading.cancel')}
                </Button>
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
