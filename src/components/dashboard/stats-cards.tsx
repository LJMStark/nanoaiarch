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
          <Card
            key={i}
            className="@container/card border-white/40 bg-background/55"
          >
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
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {cards.map((card) => (
        <Card
          key={card.title}
          className="@container/card overflow-hidden border-white/40 bg-background/55"
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs tracking-[0.12em] uppercase">
                {card.title}
              </CardDescription>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <card.icon className="size-5" />
              </div>
            </div>
            <CardTitle className="font-mono text-3xl font-semibold tabular-nums tracking-[-0.05em] @[250px]/card:text-4xl">
              {card.value.toLocaleString()}
            </CardTitle>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {card.description}
            </p>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
