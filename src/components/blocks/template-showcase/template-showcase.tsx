'use client';

import { TEMPLATE_CATEGORIES } from '@/ai/image/lib/template-categories';
import { ARCH_TEMPLATES, type ArchTemplate } from '@/ai/image/lib/templates';
import Container from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { motion, useInView } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';

// Get featured templates for landing page
const FEATURED_TEMPLATES = ARCH_TEMPLATES.filter((t) => t.featured);

export default function TemplateShowcaseSection() {
  const t = useTranslations('HomePage');
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: '-100px' });

  const handleTemplateClick = (template: ArchTemplate) => {
    router.push(`/ai/image?template=${template.id}`);
  };

  const scrollLeft = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: -320, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: 320, behavior: 'smooth' });
    }
  };

  return (
    <section className="py-20 bg-muted/30">
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Templates</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Start with a Template
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose from our collection of professional architectural templates
            to jumpstart your visualization
          </p>
        </motion.div>

        {/* Template carousel with navigation */}
        <div className="relative">
          {/* Navigation buttons */}
          <Button
            variant="outline"
            size="icon"
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex bg-background shadow-lg"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={scrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex bg-background shadow-lg"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>

          {/* Template cards */}
          <div
            ref={containerRef}
            className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-8 md:px-12 -mx-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {FEATURED_TEMPLATES.map((template, index) => (
              <TemplateCard
                key={template.id}
                template={template}
                index={index}
                isInView={isInView}
                onClick={() => handleTemplateClick(template)}
              />
            ))}

            {/* See all card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: FEATURED_TEMPLATES.length * 0.05 + 0.1 }}
              className="flex-shrink-0"
            >
              <button
                onClick={() => router.push('/ai/image')}
                className="group w-72 h-full min-h-[280px] rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors flex flex-col items-center justify-center gap-3 p-6"
              >
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <ArrowRight className="h-6 w-6 text-primary group-hover:translate-x-1 transition-transform" />
                </div>
                <span className="font-medium">View All Templates</span>
                <span className="text-sm text-muted-foreground">
                  {ARCH_TEMPLATES.length} templates available
                </span>
              </button>
            </motion.div>
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5 }}
          className="text-center mt-8"
        >
          <Button
            size="lg"
            onClick={() => router.push('/ai/image')}
            className="gap-2"
          >
            Try It Free
            <ArrowRight className="h-4 w-4" />
          </Button>
        </motion.div>
      </Container>
    </section>
  );
}

interface TemplateCardProps {
  template: ArchTemplate;
  index: number;
  isInView: boolean;
  onClick: () => void;
}

function TemplateCard({
  template,
  index,
  isInView,
  onClick,
}: TemplateCardProps) {
  const category = TEMPLATE_CATEGORIES[template.categoryId];

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={isInView ? { opacity: 1, scale: 1, y: 0 } : {}}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className="group flex-shrink-0 w-72"
    >
      <div className="relative aspect-[4/3] rounded-xl overflow-hidden border bg-muted hover:shadow-xl transition-all duration-300">
        <Image
          src={template.previewImage}
          alt={template.id}
          fill
          className="object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Category badge */}
        {category && (
          <div
            className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-xs font-medium text-white"
            style={{ backgroundColor: category.color }}
          >
            {category.id}
          </div>
        )}

        {/* Input required badge */}
        {template.requiresInput && (
          <div className="absolute top-3 right-3 px-2 py-1 rounded-md text-xs font-medium bg-white/90 text-black">
            + Image
          </div>
        )}

        {/* Template info */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-white font-semibold text-lg mb-1 capitalize">
            {template.id.replace(/-/g, ' ')}
          </h3>
          <div className="flex items-center gap-2 text-white/80 text-sm">
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            <span>Use this template</span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}
