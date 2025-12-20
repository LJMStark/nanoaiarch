'use client';

// Main architectural playground - redesigned to match main site style
// 主建筑 Playground 容器 - 重新设计以匹配主站风格

import { Ripple } from '@/components/magicui/ripple';
import { AnimatedGroup } from '@/components/tailark/motion/animated-group';
import { TextEffect } from '@/components/tailark/motion/text-effect';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowRight, Building2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import type { ArchTemplate, AspectRatioId, StylePresetId } from '../lib/arch-types';
import { useArchGeneration } from '../hooks/use-arch-generation';
import { FloatingControlBar } from './FloatingControlBar';
import { GenerationCanvas } from './GenerationCanvas';
import { TemplateDetailModal } from './TemplateDetailModal';
import { TemplateGallery } from './TemplateGallery';

const transitionVariants = {
  item: {
    hidden: {
      opacity: 0,
      y: 12,
      scale: 0.95,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        bounce: 0.3,
        duration: 1.5,
      },
    },
  },
};

export function ArchPlayground() {
  const t = useTranslations('ArchPage');

  // Use the arch generation hook
  const {
    image,
    error,
    timing,
    isLoading,
    activePrompt,
    mode,
    selectedModel,
    referenceImage,
    lastCreditsUsed,
    setMode,
    setSelectedModel,
    setReferenceImage,
    stylePreset,
    aspectRatio,
    selectedTemplate,
    templateCategory,
    showHero,
    showTemplateModal,
    promptValue,
    setStylePreset,
    setAspectRatio,
    selectTemplate,
    setTemplateCategory,
    setShowTemplateModal,
    setPromptValue,
    generateWithEnhancement,
    editWithEnhancement,
  } = useArchGeneration();

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!promptValue.trim()) return;

    if (mode === 'edit' && referenceImage) {
      await editWithEnhancement(promptValue);
    } else {
      await generateWithEnhancement(promptValue);
    }
  }, [promptValue, mode, referenceImage, editWithEnhancement, generateWithEnhancement]);

  // Handle template apply from modal
  const handleTemplateApply = useCallback(
    (template: ArchTemplate, prompt: string, style: StylePresetId | null, ratio: AspectRatioId) => {
      setPromptValue(prompt);
      setStylePreset(style);
      setAspectRatio(ratio);
      setShowTemplateModal(false);

      if (template.requiresInput) {
        setMode('edit');
      } else {
        setMode('generate');
      }
    },
    [setPromptValue, setStylePreset, setAspectRatio, setShowTemplateModal, setMode]
  );

  return (
    <>
      <main className="overflow-hidden">
        {/* Background effects - same as hero section */}
        <div
          aria-hidden
          className="absolute inset-0 isolate hidden opacity-65 contain-strict lg:block"
        >
          <div className="w-140 h-320 -translate-y-87.5 absolute left-0 top-0 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)]" />
          <div className="h-320 absolute left-0 top-0 w-60 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.06)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)] [translate:5%_-50%]" />
          <div className="h-320 -translate-y-87.5 absolute left-0 top-0 w-60 -rotate-45 bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.04)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)]" />
        </div>

        {/* Hero section - shown when no content */}
        {showHero && !image && !isLoading && !error && (
          <section className="relative pt-12 pb-8">
            <div className="mx-auto max-w-7xl px-6">
              <Ripple />

              <div className="text-center sm:mx-auto lg:mr-auto lg:mt-0">
                {/* Introduction badge */}
                <AnimatedGroup variants={transitionVariants}>
                  <div className="hover:bg-accent group mx-auto flex w-fit items-center gap-2 rounded-full border p-1 pl-4">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="text-foreground text-sm">
                      {t('hero.badge')}
                    </span>
                    <div className="size-6 overflow-hidden rounded-full bg-primary/10">
                      <ArrowRight className="m-auto mt-1.5 size-3 text-primary" />
                    </div>
                  </div>
                </AnimatedGroup>

                {/* Title */}
                <TextEffect
                  per="line"
                  preset="fade-in-blur"
                  speedSegment={0.3}
                  as="h1"
                  className="mt-8 text-balance text-4xl md:text-5xl lg:text-6xl font-bricolage-grotesque"
                >
                  {t('hero.title')}
                </TextEffect>

                {/* Subtitle */}
                <TextEffect
                  per="line"
                  preset="fade-in-blur"
                  speedSegment={0.3}
                  delay={0.5}
                  as="p"
                  className="mx-auto mt-6 max-w-3xl text-balance text-lg text-muted-foreground"
                >
                  {t('hero.subtitle')}
                </TextEffect>

                {/* Stats */}
                <AnimatedGroup
                  variants={{
                    container: {
                      visible: {
                        transition: {
                          staggerChildren: 0.1,
                          delayChildren: 0.75,
                        },
                      },
                    },
                    ...transitionVariants,
                  }}
                  className="mt-12 flex flex-wrap items-center justify-center gap-8 md:gap-16"
                >
                  <StatItem value="26+" label={t('hero.stats.templates')} />
                  <StatItem value="9" label={t('hero.stats.styles')} />
                  <StatItem value="5" label={t('hero.stats.ratios')} />
                </AnimatedGroup>
              </div>
            </div>
          </section>
        )}

        {/* Main content area */}
        <section className="px-4 pb-32">
          <div className="mx-auto max-w-6xl">
            {/* Template gallery - shown when no generation */}
            {showHero && !image && !isLoading && !error && (
              <AnimatedGroup
                variants={{
                  container: {
                    visible: {
                      transition: {
                        staggerChildren: 0.05,
                        delayChildren: 1,
                      },
                    },
                  },
                  ...transitionVariants,
                }}
              >
                <TemplateGallery
                  category={templateCategory}
                  onCategoryChange={setTemplateCategory}
                  onTemplateClick={selectTemplate}
                  className="mt-8"
                />
              </AnimatedGroup>
            )}

            {/* Generation canvas - shown when generating or has result */}
            {(image || isLoading || error) && (
              <div className="pt-12">
                <GenerationCanvas
                  image={image}
                  error={error}
                  timing={timing}
                  isLoading={isLoading}
                  activePrompt={activePrompt}
                  lastCreditsUsed={lastCreditsUsed}
                />
              </div>
            )}
          </div>
        </section>

        {/* Floating control bar */}
        <FloatingControlBar
          promptValue={promptValue}
          onPromptChange={setPromptValue}
          onSubmit={handleSubmit}
          mode={mode}
          selectedModel={selectedModel}
          referenceImage={referenceImage}
          onImageUpload={setReferenceImage}
          onImageClear={() => setReferenceImage(null)}
          stylePreset={stylePreset}
          onStyleChange={setStylePreset}
          aspectRatio={aspectRatio}
          onAspectRatioChange={setAspectRatio}
          isLoading={isLoading}
        />
      </main>

      {/* Template detail modal */}
      <TemplateDetailModal
        template={selectedTemplate}
        open={showTemplateModal}
        onOpenChange={setShowTemplateModal}
        onApply={handleTemplateApply}
      />
    </>
  );
}

// Stat item component
function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-bold text-primary">{value}</div>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
