'use client';

import {
  getReferralCode,
  getReferralList,
  getReferralStats,
} from '@/actions/referral';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { websiteConfig } from '@/config/website';
import { cn } from '@/lib/utils';
import {
  IconCheck,
  IconClock,
  IconCoin,
  IconCopy,
  IconGift,
  IconUsers,
} from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import { enUS, zhCN } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface ReferralStats {
  totalReferred: number;
  pendingCount: number;
  qualifiedCount: number;
  totalEarned: number;
}

interface ReferralItem {
  id: string;
  email: string;
  status: string;
  createdAt: Date;
  qualifiedAt: Date | null;
}

export default function ReferralPage() {
  const t = useTranslations('Referral');
  const locale = useLocale();
  const dateLocale = locale === 'zh' ? zhCN : enUS;

  const [referralCode, setReferralCode] = useState<string>('');
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const signupBonus = websiteConfig.referral?.signupBonus?.amount || 0;
  const commission = websiteConfig.referral?.commission?.amount || 0;

  const breadcrumbs = [
    { label: t('settings'), href: '/settings/profile' },
    { label: t('title'), isCurrentPage: true },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [codeResult, statsResult, listResult] = await Promise.all([
          getReferralCode(),
          getReferralStats(),
          getReferralList(),
        ]);

        if (codeResult.success && codeResult.code) {
          setReferralCode(codeResult.code);
        }
        if (statsResult.success && statsResult.stats) {
          setStats(statsResult.stats);
        }
        if (listResult.success && listResult.referrals) {
          setReferrals(listResult.referrals);
        }
      } catch (error) {
        console.error('Failed to fetch referral data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const referralLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/register?ref=${referralCode}`
      : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'rewarded':
      case 'qualified':
        return (
          <Badge variant="default" className="bg-green-500">
            <IconCheck className="mr-1 size-3" />
            {t('status.qualified')}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <IconClock className="mr-1 size-3" />
            {t('status.pending')}
          </Badge>
        );
    }
  };

  return (
    <>
      <DashboardHeader breadcrumbs={breadcrumbs} />

      <div className="flex flex-1 flex-col p-4 lg:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>

        {/* Referral Link Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconGift className="size-5" />
              {t('yourLink')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="flex gap-2">
                <div className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-sm font-mono truncate">
                  {referralLink}
                </div>
                <Button
                  variant="outline"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <>
                      <IconCheck className="mr-2 size-4" />
                      {t('copied')}
                    </>
                  ) : (
                    <>
                      <IconCopy className="mr-2 size-4" />
                      {t('copy')}
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reward Rules */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('rules.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                {t('rules.signup', { amount: signupBonus })}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                {t('rules.commission', { amount: commission })}
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          {loading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-2xl font-bold">
                    <IconUsers className="size-5 text-muted-foreground" />
                    {stats?.totalReferred || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('stats.invited')}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-2xl font-bold">
                    <IconClock className="size-5 text-muted-foreground" />
                    {stats?.pendingCount || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('stats.pending')}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-2xl font-bold">
                    <IconCheck className="size-5 text-green-500" />
                    {stats?.qualifiedCount || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('stats.qualified')}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-2xl font-bold">
                    <IconCoin className="size-5 text-yellow-500" />
                    {stats?.totalEarned || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('stats.earned')}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Referral List */}
        <Card>
          <CardHeader>
            <CardTitle>{t('list.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : referrals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <IconUsers className="mx-auto size-12 mb-4 opacity-30" />
                <p>{t('list.empty')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{item.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.createdAt), {
                          addSuffix: true,
                          locale: dateLocale,
                        })}
                      </p>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
