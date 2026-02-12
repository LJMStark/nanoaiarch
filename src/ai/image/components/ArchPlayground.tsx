'use client';

// Arch AI Playground - Template showcase and entry point
// Redirects to Conversation mode for actual generation

import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
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
  StatsCard,
} from './bento';
import { LazyTemplateDetailModal } from './lazy';

/**
 * ArchPlayground - Template showcase page
 *
 * Displays templates in a Bento Grid layout.
 * When a user selects a template, they are redirected to the
 * Conversation page with the template ID as a URL parameter.
 */
export function ArchPlayground() {
  const t = useTranslations('ArchPage');
  const tRoot = useTranslations();
  const router = useRouter();

  // Template browsing state
  const [templateCategory, setTemplateCategory] = useState<
    TemplateCategoryId | 'all'
  >('all');
  const [selectedTemplate, setSelectedTemplate] =
    useState<ArchTemplate | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const featuredTemplate = useMemo(() => {
    return ARCH_TEMPLATES.find((t) => t.featured) || ARCH_TEMPLATES[0];
  }, []);

  const templates = useMemo(() => {
    return getTemplatesByCategory(templateCategory);
  }, [templateCategory]);

  const totalTemplateCount = ARCH_TEMPLATES.length;

  // Navigate to Conversation page with template
  const navigateToConversation = useCallback(
    (templateId: string) => {
      router.push(`/ai/image?template=${templateId}`);
    },
    [router]
  );

  const handleTemplateClick = useCallback((template: ArchTemplate) => {
    setSelectedTemplate(template);
    setShowTemplateModal(true);
  }, []);

  const handleTemplateApply = useCallback(
    (template: ArchTemplate, _prompt: string, _ratio: AspectRatioId) => {
      setShowTemplateModal(false);
      navigateToConversation(template.id);
    },
    [navigateToConversation]
  );

  return (
    <>
      <main className="min-h-screen overflow-hidden">
        <BackgroundDecorations />

        <div className="relative z-10 px-4 py-8 lg:py-12">
          <div className="mx-auto max-w-7xl">
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

            <BentoGrid className="mb-8">
              <HeroBentoCard
                featuredTemplate={featuredTemplate}
                onTemplateClick={handleTemplateClick}
              />

              <AllCategoriesCard
                isSelected={templateCategory === 'all'}
                onClick={() => setTemplateCategory('all')}
                totalCount={totalTemplateCount}
                animationDelay={0.15}
              />
              {TEMPLATE_CATEGORY_LIST.slice(0, 2).map((cat, index) => (
                <CategoryCard
                  key={cat.id}
                  category={cat}
                  isSelected={templateCategory === cat.id}
                  onClick={() => setTemplateCategory(cat.id)}
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

            {/* Category filter - remaining categories */}
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
                      onClick={() => setTemplateCategory(cat.id)}
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
                      onClick={() => handleTemplateClick(template)}
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

      {/* Template detail modal - redirects to Conversation on apply */}
      <LazyTemplateDetailModal
        template={selectedTemplate}
        open={showTemplateModal}
        onOpenChange={setShowTemplateModal}
        onApply={handleTemplateApply}
      />
    </>
  );
}

function BackgroundDecorations() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 overflow-hidden pointer-events-none"
    >
      <div
        className={cn(
          'absolute -top-40 -left-40 w-80 h-80',
          'rounded-full blur-3xl opacity-20',
          'bg-gradient-to-br from-primary/50 to-transparent'
        )}
      />
      <div
        className={cn(
          'absolute -bottom-40 -right-40 w-96 h-96',
          'rounded-full blur-3xl opacity-10',
          'bg-gradient-to-tl from-violet-500/50 to-transparent'
        )}
      />
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
