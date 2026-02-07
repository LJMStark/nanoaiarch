'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Heart, History, Image, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

const actions = [
  {
    titleKey: 'newGeneration',
    descriptionKey: 'newGenerationDesc',
    href: '/ai/image',
    icon: Sparkles,
    color: 'from-violet-500/10 to-violet-600/10 border-violet-500/20',
    iconColor: 'text-violet-600',
  },
  {
    titleKey: 'gallery',
    descriptionKey: 'galleryDesc',
    href: '/gallery',
    icon: Image,
    color: 'from-blue-500/10 to-blue-600/10 border-blue-500/20',
    iconColor: 'text-blue-600',
  },
  {
    titleKey: 'history',
    descriptionKey: 'historyDesc',
    href: '/gallery?tab=history',
    icon: History,
    color: 'from-amber-500/10 to-amber-600/10 border-amber-500/20',
    iconColor: 'text-amber-600',
  },
  {
    titleKey: 'favorites',
    descriptionKey: 'favoritesDesc',
    href: '/gallery?tab=favorites',
    icon: Heart,
    color: 'from-rose-500/10 to-rose-600/10 border-rose-500/20',
    iconColor: 'text-rose-600',
  },
];

export function QuickActions() {
  const t = useTranslations('Dashboard.quickActions');

  return (
    <Card className="mx-4 lg:mx-6">
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
                'group relative flex flex-col items-center justify-center rounded-xl border p-6 transition-all hover:scale-[1.02] hover:shadow-md',
                'bg-gradient-to-br',
                action.color
              )}
            >
              <action.icon
                className={cn(
                  'size-10 mb-3 transition-transform group-hover:scale-110',
                  action.iconColor
                )}
              />
              <h3 className="font-medium text-foreground">
                {t(action.titleKey as any)}
              </h3>
              <p className="mt-1 text-center text-xs text-muted-foreground">
                {t(action.descriptionKey as any)}
              </p>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
