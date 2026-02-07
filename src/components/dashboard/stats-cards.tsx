'use client';

import { Calendar, Heart, Image, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import {
  type GenerationStats,
  getGenerationStats,
} from '@/actions/generation-history';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function StatsCards() {
  const t = useTranslations('Dashboard.stats');
  const [stats, setStats] = useState<GenerationStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const result = await getGenerationStats();
      if (result.success && result.data) {
        setStats(result.data);
      }
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="@container/card">
            <CardHeader>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16 mt-2" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: t('totalGenerations'),
      value: stats?.totalGenerations ?? 0,
      icon: Image,
      description: t('totalGenerationsDesc'),
    },
    {
      title: t('thisMonth'),
      value: stats?.thisMonthGenerations ?? 0,
      icon: Calendar,
      description: t('thisMonthDesc'),
    },
    {
      title: t('creditsUsed'),
      value: stats?.totalCreditsUsed ?? 0,
      icon: Sparkles,
      description: t('creditsUsedDesc'),
    },
    {
      title: t('favorites'),
      value: stats?.favoriteCount ?? 0,
      icon: Heart,
      description: t('favoritesDesc'),
    },
  ];

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="@container/card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>{card.title}</CardDescription>
              <card.icon className="size-5 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {card.value.toLocaleString()}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {card.description}
            </p>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
