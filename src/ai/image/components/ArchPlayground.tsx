'use client';

// Arch AI Playground - Bento Grid Layout
// Arch AI Playground - Bento 网格布局设计

import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';
import { useArchGeneration } from '../hooks/use-arch-generation';
import type {
  ArchTemplate,
  AspectRatioId,
  TemplateCategoryId,
} from '../lib/arch-types';
import {
  TEMPLATE_CATEGORY_LIST,
  getTemplateCategory,
} from '../lib/template-categories';
import { ARCH_TEMPLATES, getTemplatesByCategory } from '../lib/templates';
import {
  AllCategoriesCard,
  BentoGrid,
  BentoTemplateCard,
  CategoryCard,
  HeroBentoCard,
  QuickActionCard,
  StatsCard,
} from './bento';
import { LazyGenerationModal, LazyTemplateDetailModal } from './lazy';

/**
 * ArchPlayground - Main playground component with Bento Grid layout
 *
 * Layout Structure:
 * - Top Row: Hero Card (7 cols) + Quick Action Card (5 cols)
 * - Second Row: Category Cards (2 cols each) + Stats Card (4 cols)
 * - Template Grid: Bento grid of templates based on selected category
 */
export function ArchPlayground() {
  const t = useTranslations('ArchPage');
  const tRoot = useTranslations(); // Root translator for full key paths

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
    setReferenceImage,
    stylePreset,
    aspectRatio,
    selectedTemplate,
    templateCategory,
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

  // Get featured template for hero card
  const featuredTemplate = useMemo(() => {
    return ARCH_TEMPLATES.find((t) => t.featured) || ARCH_TEMPLATES[0];
  }, []);

  // Get templates for current category
  const templates = useMemo(() => {
    return getTemplatesByCategory(templateCategory);
  }, [templateCategory]);

  // Total template count
  const totalTemplateCount = ARCH_TEMPLATES.length;

  // Generation modal state
  const showGenerationModal = isLoading || !!image || !!error;

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!promptValue.trim()) return;

    if (mode === 'edit' && referenceImage) {
      await editWithEnhancement(promptValue);
    } else {
      await generateWithEnhancement(promptValue);
    }
  }, [
    promptValue,
    mode,
    referenceImage,
    editWithEnhancement,
    generateWithEnhancement,
  ]);

  // Handle template click from hero
  const handleHeroTemplateClick = useCallback(
    (template: ArchTemplate) => {
      selectTemplate(template);
    },
    [selectTemplate]
  );

  // Handle template apply from modal
  const handleTemplateApply = useCallback(
    (template: ArchTemplate, prompt: string, ratio: AspectRatioId) => {
      setPromptValue(prompt);
      setAspectRatio(ratio);
      setShowTemplateModal(false);

      if (template.requiresInput) {
        setMode('edit');
      } else {
        setMode('generate');
      }
    },
    [setPromptValue, setAspectRatio, setShowTemplateModal, setMode]
  );

  // Handle category change
  const handleCategoryChange = useCallback(
    (category: TemplateCategoryId | 'all') => {
      setTemplateCategory(category);
    },
    [setTemplateCategory]
  );

  // Handle regenerate in modal
  const handleRegenerate = useCallback(() => {
    if (promptValue.trim()) {
      handleSubmit();
    }
  }, [promptValue, handleSubmit]);

  // Close generation modal
  const handleCloseGenerationModal = useCallback(
    (open: boolean) => {
      // Only allow closing if not loading
      if (!isLoading && !open) {
        // Clear the results to close modal
        // This would need to be implemented in the hook
      }
    },
    [isLoading]
  );

  return (
    <>
      <main className="min-h-screen overflow-hidden">
        {/* Background decorations */}
        <BackgroundDecorations />

        {/* Main content */}
        <div className="relative z-10 px-4 py-8 lg:py-12">
          <div className="mx-auto max-w-7xl">
            {/* Page header - minimal */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 lg:mb-8"
            >
              <h1 className="text-2xl lg:text-3xl font-bold font-bricolage-grotesque">
                Arch AI
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('hero.subtitle')}
              </p>
            </motion.div>

            {/* Bento Grid Layout */}
            <BentoGrid className="mb-8">
              {/* Row 1: Hero + Quick Action */}
              <HeroBentoCard
                featuredTemplate={featuredTemplate}
                onTemplateClick={handleHeroTemplateClick}
              />
              <QuickActionCard
                promptValue={promptValue}
                onPromptChange={setPromptValue}
                onSubmit={handleSubmit}
                referenceImage={referenceImage}
                onImageUpload={setReferenceImage}
                onImageClear={() => setReferenceImage(null)}
                stylePreset={stylePreset}
                onStyleChange={setStylePreset}
                aspectRatio={aspectRatio}
                onAspectRatioChange={setAspectRatio}
                selectedModel={selectedModel}
                isLoading={isLoading}
              />

              {/* Row 2: Categories (3) + Stats */}
              <AllCategoriesCard
                isSelected={templateCategory === 'all'}
                onClick={() => handleCategoryChange('all')}
                totalCount={totalTemplateCount}
                animationDelay={0.15}
              />
              {TEMPLATE_CATEGORY_LIST.slice(0, 2).map((cat, index) => (
                <CategoryCard
                  key={cat.id}
                  category={cat}
                  isSelected={templateCategory === cat.id}
                  onClick={() => handleCategoryChange(cat.id)}
                  animationDelay={0.2 + index * 0.05}
                />
              ))}
              <StatsCard
                templateCount={totalTemplateCount}
                styleCount={9}
                ratioCount={5}
                animationDelay={0.3}
              />
            </BentoGrid>

            {/* Category filter - show remaining categories */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mb-6"
            >
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {TEMPLATE_CATEGORY_LIST.slice(2).map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleCategoryChange(cat.id)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-full',
                        'text-xs font-medium whitespace-nowrap',
                        'transition-colors border',
                        templateCategory === cat.id
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/50 hover:bg-muted text-muted-foreground border-transparent'
                      )}
                    >
                      <Icon
                        className="h-3.5 w-3.5"
                        style={{
                          color:
                            templateCategory === cat.id ? undefined : cat.color,
                        }}
                      />
                      <span>{tRoot(cat.labelKey as any)}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* Templates section header */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="flex items-center justify-between mb-4"
            >
              <h2 className="text-lg font-semibold">
                {templateCategory === 'all'
                  ? t('categories.all')
                  : tRoot(
                      getTemplateCategory(templateCategory).labelKey as any
                    )}
              </h2>
              <span className="text-sm text-muted-foreground">
                {templates.length} templates
              </span>
            </motion.div>

            {/* Templates Bento Grid */}
            <AnimatePresence mode="wait">
              <motion.div
                key={templateCategory}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <BentoGrid>
                  {templates.map((template, index) => (
                    <BentoTemplateCard
                      key={template.id}
                      template={template}
                      onClick={() => selectTemplate(template)}
                      animationDelay={0.5 + index * 0.03}
                    />
                  ))}
                </BentoGrid>
              </motion.div>
            </AnimatePresence>

            {/* Empty state */}
            {templates.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <svg
                    className="w-8 h-8 text-muted-foreground/50"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </div>
                <h3 className="font-medium text-lg mb-1">
                  {t('gallery.empty')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('gallery.emptyDescription')}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Template detail modal */}
      <LazyTemplateDetailModal
        template={selectedTemplate}
        open={showTemplateModal}
        onOpenChange={setShowTemplateModal}
        onApply={handleTemplateApply}
      />

      {/* Generation modal */}
      <LazyGenerationModal
        open={showGenerationModal}
        onOpenChange={handleCloseGenerationModal}
        image={image}
        error={error}
        timing={timing}
        isLoading={isLoading}
        activePrompt={activePrompt}
        lastCreditsUsed={lastCreditsUsed}
        onRegenerate={handleRegenerate}
      />
    </>
  );
}

// Background decorations component
// 背景装饰组件
function BackgroundDecorations() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 overflow-hidden pointer-events-none"
    >
      {/* Top left gradient orb */}
      <div
        className={cn(
          'absolute -top-40 -left-40 w-80 h-80',
          'rounded-full blur-3xl opacity-20',
          'bg-gradient-to-br from-primary/50 to-transparent'
        )}
      />
      {/* Bottom right gradient orb */}
      <div
        className={cn(
          'absolute -bottom-40 -right-40 w-96 h-96',
          'rounded-full blur-3xl opacity-10',
          'bg-gradient-to-tl from-violet-500/50 to-transparent'
        )}
      />
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
}
