'use client';

import { TemplateDetailModal } from '@/ai/image/components/TemplateDetailModal';
import { useTemplateApply } from '@/ai/image/hooks/use-template-apply';
import type { ArchTemplate, AspectRatioId } from '@/ai/image/lib/arch-types';
import { TEMPLATE_CATEGORIES } from '@/ai/image/lib/template-categories';
import { ARCH_TEMPLATES } from '@/ai/image/lib/templates';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

interface TemplateShowcaseProps {
  showFullView?: boolean;
}

// Get featured templates
const FEATURED_TEMPLATES = ARCH_TEMPLATES.filter((t) => t.featured);

// Quick prompts for inspiration
const QUICK_PROMPTS = [
  'Modern minimalist house with glass facade',
  'Sustainable eco-friendly building',
  'Luxury penthouse interior',
  'Urban mixed-use development',
  'Japanese zen garden courtyard',
  'Industrial loft conversion',
];

export function TemplateShowcase({
  showFullView = false,
}: TemplateShowcaseProps) {
  // Modal state
  const [selectedTemplate, setSelectedTemplate] = useState<ArchTemplate | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Use unified template apply hook
  const { applyTemplateWithProject, applyQuickPrompt } = useTemplateApply();

  // Open modal when clicking a template
  const handleTemplateClick = (template: ArchTemplate) => {
    setSelectedTemplate(template);
    setIsModalOpen(true);
  };

  // Apply template from modal
  const handleApplyTemplate = async (
    template: ArchTemplate,
    prompt: string,
    ratio: AspectRatioId
  ) => {
    setIsModalOpen(false);
    await applyTemplateWithProject({ template, prompt, ratio });
  };

  // Handle quick prompt click
  const handleQuickPrompt = async (prompt: string) => {
    await applyQuickPrompt(prompt);
  };

  if (showFullView) {
    return (
      <>
        <div className="flex flex-col items-center justify-center p-8 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                AI Architect
              </span>
            </div>
            <h1 className="text-3xl font-bold mb-3">
              Create stunning architectural visualizations
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Transform your ideas into professional renders. Choose a template
              or describe your vision.
            </p>
          </motion.div>

          {/* Template carousel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="w-full mb-8"
          >
            <ScrollArea className="w-full whitespace-nowrap pb-4">
              <div className="flex gap-4">
                {FEATURED_TEMPLATES.map((template, index) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    index={index}
                    onClick={() => handleTemplateClick(template)}
                  />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </motion.div>

          {/* Quick prompts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full"
          >
            <p className="text-sm text-muted-foreground text-center mb-4">
              Or try these prompts
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickPrompt(prompt)}
                  className="px-4 py-2 rounded-full bg-muted hover:bg-muted/80 text-sm transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Template detail modal */}
        <TemplateDetailModal
          template={selectedTemplate}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          onApply={handleApplyTemplate}
        />
      </>
    );
  }

  // Compact view for existing project
  return (
    <div className="py-8">
      <div className="text-center mb-6">
        <Sparkles className="h-8 w-8 mx-auto mb-3 text-primary" />
        <h2 className="text-xl font-semibold mb-2">
          What would you like to create?
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose a template or type your description below
        </p>
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {FEATURED_TEMPLATES.slice(0, 8).map((template) => (
          <button
            key={template.id}
            onClick={() => handleTemplateClick(template)}
            className="group relative aspect-[4/3] rounded-lg overflow-hidden border hover:border-primary transition-colors"
          >
            <Image
              src={template.previewImage}
              alt={template.id}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-2">
              <p className="text-xs text-white font-medium truncate">
                {template.id.replace(/-/g, ' ')}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Quick prompts */}
      <div className="flex flex-wrap justify-center gap-2">
        {QUICK_PROMPTS.slice(0, 4).map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleQuickPrompt(prompt)}
            className="px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-xs transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Template detail modal */}
      <TemplateDetailModal
        template={selectedTemplate}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onApply={handleApplyTemplate}
      />
    </div>
  );
}

interface TemplateCardProps {
  template: ArchTemplate;
  index: number;
  onClick: () => void;
}

function TemplateCard({ template, index, onClick }: TemplateCardProps) {
  const category = TEMPLATE_CATEGORIES[template.categoryId];

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className="group relative w-64 flex-shrink-0"
    >
      <div className="relative aspect-[4/3] rounded-xl overflow-hidden border hover:border-primary transition-all duration-300 hover:shadow-lg">
        <Image
          src={template.previewImage}
          alt={template.id}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Category badge */}
        {category && (
          <div
            className="absolute top-3 left-3 px-2 py-1 rounded-md text-xs font-medium text-white"
            style={{ backgroundColor: category.color }}
          >
            {category.id}
          </div>
        )}

        {/* Template info */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-white font-medium text-sm mb-1 truncate">
            {template.id.replace(/-/g, ' ')}
          </h3>
          <div className="flex items-center gap-1 text-white/70 text-xs">
            <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
            <span>Use template</span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}
