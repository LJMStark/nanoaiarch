'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AI_IMAGE_NEW_PROJECT_ROUTE } from '@/routes';
import { Heart, History, Image, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

const actions = [
  {
    titleKey: 'newGeneration',
    descriptionKey: 'newGenerationDesc',
    href: AI_IMAGE_NEW_PROJECT_ROUTE,
    icon: Sparkles,
  },
  {
    titleKey: 'gallery',
    descriptionKey: 'galleryDesc',
    href: '/gallery',
    icon: Image,
  },
  {
    titleKey: 'history',
    descriptionKey: 'historyDesc',
    href: '/gallery?tab=history',
    icon: History,
  },
  {
    titleKey: 'favorites',
    descriptionKey: 'favoritesDesc',
    href: '/gallery?tab=favorites',
    icon: Heart,
  },
];

export function QuickActions() {
  const t = useTranslations('Dashboard.quickActions');

  return (
    <Card className="mx-4 overflow-hidden border-white/40 bg-background/55 lg:mx-6">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((action) => (
            <Link
              key={action.titleKey}
              href={action.href}
              className={cn(
                'group relative flex flex-col items-start justify-between rounded-[1.5rem] border border-border/60 bg-background/50 p-6 transition-all hover:-translate-y-1 hover:border-primary/20'
              )}
            >
              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
                <action.icon className="size-5" />
              </div>
              <h3 className="font-medium tracking-[-0.02em] text-foreground">
                {t(action.titleKey as any)}
              </h3>
              <p className="mt-2 text-left text-sm leading-6 text-muted-foreground">
                {t(action.descriptionKey as any)}
              </p>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
