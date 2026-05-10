'use client';

import { getGenerationCssAspectRatio } from '@/ai/image/lib/message-aspect-ratio';
import type { ProjectMessageItem } from '@/ai/image/lib/workspace-types';
import { Button } from '@/components/ui/button';
import type { GenerationStage } from '@/stores/conversation-store';
import { useConversationStore } from '@/stores/conversation-store';
import { Check, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

const STAGES: Exclude<GenerationStage, null>[] = [
  'submitting',
  'queued',
  'generating',
  'finishing',
];

const PROGRESS_BY_STAGE: Record<Exclude<GenerationStage, null>, number> = {
  submitting: 16,
  queued: 38,
  generating: 72,
  finishing: 92,
};

interface LoadingMessageProps {
  message: ProjectMessageItem;
}

export function LoadingMessage({ message }: LoadingMessageProps) {
  const t = useTranslations('ArchPage');
  const shouldReduceMotion = useReducedMotion();
  const [elapsedTime, setElapsedTime] = useState(0);
  const { generationStage, cancelGeneration } = useConversationStore();

  useEffect(() => {
    const timeInterval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timeInterval);
  }, []);

  const currentStageIndex = STAGES.indexOf(generationStage ?? 'submitting');

  const stageTextMap = {
    submitting: t('loading.stage_submitting'),
    queued: t('loading.stage_queued'),
    generating: t('loading.stage_generating'),
    finishing: t('loading.stage_finishing'),
  } as const;

  const stageText = stageTextMap[generationStage ?? 'submitting'];
  const activeStage = generationStage ?? 'submitting';
  const progress = PROGRESS_BY_STAGE[activeStage];
  const aspectRatio = getGenerationCssAspectRatio(message.generationParams);

  return (
    <div className="flex w-full justify-start px-2 py-2">
      <div className="min-w-0 flex-1 space-y-3 max-w-[90%] sm:max-w-[85%]">
        <div className="relative max-w-lg">
          <motion.div
            layout
            initial={{ opacity: 0, y: 8, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm"
          >
            <div
              className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_20%_15%,color-mix(in_oklab,var(--primary)_24%,transparent),transparent_34%),linear-gradient(135deg,var(--muted),var(--background)_52%,var(--accent))]"
              style={{ aspectRatio }}
            >
              <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(to_right,var(--foreground)_1px,transparent_1px),linear-gradient(to_bottom,var(--foreground)_1px,transparent_1px)] [background-size:32px_32px]" />
              <div className="absolute inset-5 rounded-lg border border-white/55 bg-background/24 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:border-white/10 dark:bg-white/5" />
              <div className="absolute inset-x-8 top-8 h-16 rounded-full bg-primary/10 blur-2xl" />
              <motion.div
                className="absolute inset-y-0 left-[-45%] w-1/2 bg-gradient-to-r from-transparent via-white/38 to-transparent mix-blend-soft-light dark:via-white/18"
                animate={
                  shouldReduceMotion
                    ? undefined
                    : {
                        x: ['0%', '290%'],
                      }
                }
                transition={{
                  duration: 2.8,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: 'easeInOut',
                }}
              />

              <div className="absolute inset-x-0 top-0 h-1.5 bg-foreground/10">
                <motion.div
                  className="h-full rounded-r-full bg-primary"
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>

              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="w-full max-w-[20rem] rounded-xl border border-white/60 bg-background/78 p-4 shadow-[0_22px_70px_-42px_rgba(36,45,31,0.55)] backdrop-blur-xl dark:border-white/10 dark:bg-background/62">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/12 text-primary">
                          <Sparkles className="h-4 w-4" />
                        </span>
                        {t('loading.title')}
                      </div>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.p
                          key={activeStage}
                          initial={
                            shouldReduceMotion ? false : { opacity: 0, y: 6 }
                          }
                          animate={{ opacity: 1, y: 0 }}
                          exit={
                            shouldReduceMotion
                              ? undefined
                              : { opacity: 0, y: -6 }
                          }
                          transition={{ duration: 0.18 }}
                          className="text-sm text-muted-foreground"
                        >
                          {stageText}
                        </motion.p>
                      </AnimatePresence>
                    </div>
                    <div className="shrink-0 rounded-full border border-border/60 bg-background/70 px-2 py-1 text-xs tabular-nums text-muted-foreground">
                      {elapsedTime}s
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {STAGES.map((stage, index) => {
                      const isComplete = index < currentStageIndex;
                      const isActive = index === currentStageIndex;

                      return (
                        <div
                          key={stage}
                          className="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                              isComplete
                                ? 'border-primary bg-primary text-primary-foreground'
                                : isActive
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border bg-background/70'
                            }`}
                          >
                            {isComplete ? (
                              <Check className="h-3 w-3" />
                            ) : isActive ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            ) : null}
                          </span>
                          <span
                            className={
                              isActive
                                ? 'font-medium text-foreground'
                                : undefined
                            }
                          >
                            {stageTextMap[stage]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border/60 px-3 py-2.5">
              <span className="text-xs text-muted-foreground">
                {t('loading.keepOpen')}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelGeneration}
                className="h-8 shrink-0 px-2 text-muted-foreground hover:text-destructive"
              >
                <X className="mr-1 h-4 w-4" />
                {t('loading.cancel')}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
