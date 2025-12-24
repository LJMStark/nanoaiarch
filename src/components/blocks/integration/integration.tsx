import { HeaderSection } from '@/components/layout/header-section';
import {
  Gemini,
  GooglePaLM,
  MagicUI,
  MediaWiki,
  Replit,
  VSCodium,
} from '@/components/tailark/logos';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LocaleLink } from '@/i18n/navigation';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type * as React from 'react';

export default function IntegrationSection() {
  const t = useTranslations('HomePage.integration');

  const integrationItems: Array<{
    icon: React.ReactNode;
    title: string;
    description: string;
  }> = [
    {
      icon: <Gemini />,
      title: t('items.item-1.title' as any),
      description: t('items.item-1.description' as any),
    },
    {
      icon: <Replit />,
      title: t('items.item-2.title' as any),
      description: t('items.item-2.description' as any),
    },
    {
      icon: <MagicUI />,
      title: t('items.item-3.title' as any),
      description: t('items.item-3.description' as any),
    },
    {
      icon: <VSCodium />,
      title: t('items.item-4.title' as any),
      description: t('items.item-4.description' as any),
    },
    {
      icon: <MediaWiki />,
      title: t('items.item-5.title' as any),
      description: t('items.item-5.description' as any),
    },
    {
      icon: <GooglePaLM />,
      title: t('items.item-6.title' as any),
      description: t('items.item-6.description' as any),
    },
  ];

  return (
    <section id="integration" className="px-4 py-16">
      <div className="mx-auto max-w-5xl">
        <HeaderSection
          title={t('title')}
          subtitle={t('subtitle')}
          description={t('description')}
          subtitleAs="h2"
          descriptionAs="p"
        />

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {integrationItems.map((item, index) => (
            <IntegrationCard
              key={index}
              title={item.title}
              description={item.description}
            >
              {item.icon}
            </IntegrationCard>
          ))}
        </div>
      </div>
    </section>
  );
}

const IntegrationCard = ({
  title,
  description,
  children,
  link = '#',
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  link?: string;
}) => {
  const t = useTranslations('HomePage.integration');

  return (
    <Card className="p-6 bg-transparent hover:bg-accent dark:hover:bg-card">
      <div className="relative">
        <div className="*:size-10">{children}</div>

        <div className="space-y-2 py-6">
          <h3 className="text-base font-medium">{title}</h3>
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {description}
          </p>
        </div>

        <div className="flex gap-3 border-t border-dashed pt-6">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1 pr-2 shadow-none"
          >
            <LocaleLink href={link}>
              {t('learnMore')}
              <ChevronRight className="ml-0 !size-3.5 opacity-50" />
            </LocaleLink>
          </Button>
        </div>
      </div>
    </Card>
  );
};
