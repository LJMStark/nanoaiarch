'use client';

// Showcase section for Arch AI templates
// 建筑 AI 模版展示区

import { HeaderSection } from '@/components/layout/header-section';
import { cn } from '@/lib/utils';
import {
  Building2,
  FileStack,
  Home,
  Layers,
  LayoutGrid,
  PenTool,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

const SHOWCASE_ITEMS = [
  {
    id: 'style-transfer',
    icon: PenTool,
    image: '/arch/showcase/style-transfer.png',
    color: '#8b5cf6',
  },
  {
    id: 'model-render',
    icon: Layers,
    image: '/arch/showcase/model-render.png',
    color: '#3b82f6',
  },
  {
    id: 'floor-plan',
    icon: LayoutGrid,
    image: '/arch/showcase/floor-plan.png',
    color: '#10b981',
  },
  {
    id: 'facade',
    icon: Building2,
    image: '/arch/showcase/facade.png',
    color: '#f59e0b',
  },
  {
    id: 'interior',
    icon: Home,
    image: '/arch/showcase/interior.png',
    color: '#ec4899',
  },
  {
    id: 'analysis',
    icon: FileStack,
    image: '/arch/showcase/analysis.png',
    color: '#06b6d4',
  },
];

export default function ShowcaseSection() {
  const t = useTranslations('HomePage.showcase');

  return (
    <section id="showcase" className="px-4 py-16">
      <div className="mx-auto max-w-6xl space-y-12">
        <HeaderSection
          className="mx-auto items-center text-center"
          title={t('title')}
          titleAs="p"
          subtitle={t('subtitle')}
          subtitleAs="h2"
          description={t('description')}
          descriptionAs="p"
        />

        {/* Template grid */}
        <div className="grid gap-5 xl:grid-cols-12">
          {SHOWCASE_ITEMS.map((item) => {
            const Icon = item.icon;
            // Use generated image if available, otherwise fall back to original path or logic
            // Use generated image for all items
            const isGenerated = true;
            const imagePath = `/images/generated/${item.id}.png`;

            return (
              <div
                key={item.id}
                className={cn(
                  'surface-panel group relative overflow-hidden rounded-[1.75rem] p-2 transition-all duration-300 hover:-translate-y-1',
                  item.id === 'style-transfer'
                    ? 'xl:col-span-7'
                    : item.id === 'model-render'
                      ? 'xl:col-span-5'
                      : 'xl:col-span-3'
                )}
              >
                {/* Image Area */}
                <div
                  className={cn(
                    'relative overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-muted to-muted/50',
                    item.id === 'style-transfer' || item.id === 'model-render'
                      ? 'aspect-[16/11]'
                      : 'aspect-[4/5]'
                  )}
                >
                  {/* Image or Placeholder */}
                  {isGenerated ? (
                    <Image
                      src={imagePath}
                      alt={t(`items.${item.id}.title` as any)}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <Icon className="h-10 w-10 text-primary/50" />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Content overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/25 backdrop-blur-sm">
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <h3 className="font-semibold text-white drop-shadow-md">
                        {t(`items.${item.id}.title` as any)}
                      </h3>
                    </div>
                    <p className="text-sm text-white/90 line-clamp-2 drop-shadow-sm">
                      {t(`items.${item.id}.description` as any)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
