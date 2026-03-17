import { HeaderSection } from '@/components/layout/header-section';
import { useTranslations } from 'next-intl';

export default function StatsSection() {
  const t = useTranslations('HomePage.stats');

  return (
    <section id="stats" className="px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="surface-panel rounded-[2rem] px-6 py-8 sm:px-10 sm:py-10">
          <HeaderSection
            className="mx-auto items-center text-center"
            title={t('title')}
            subtitle={t('subtitle')}
            subtitleAs="h2"
            description={t('description')}
            descriptionAs="p"
          />

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.5rem] border border-border/60 bg-background/45 p-6 text-left">
              <div className="font-mono text-5xl font-semibold tabular-nums text-primary">
                10K+
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {t('items.item-1.title')}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-border/60 bg-background/45 p-6 text-left">
              <div className="font-mono text-5xl font-semibold tabular-nums text-primary">
                26+
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {t('items.item-2.title')}
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-border/60 bg-background/45 p-6 text-left">
              <div className="font-mono text-5xl font-semibold tabular-nums text-primary">
                9
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {t('items.item-3.title')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
