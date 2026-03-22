import { Button } from '@/components/ui/button';
import { LocaleLink } from '@/i18n/navigation';
import { AI_IMAGE_NEW_PROJECT_ROUTE } from '@/routes';
import { useTranslations } from 'next-intl';

export default function CallToActionSection() {
  const t = useTranslations('HomePage.calltoaction');

  return (
    <section id="call-to-action" className="px-4 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="surface-panel rounded-[2.25rem] px-6 py-12 text-center sm:px-10">
          <h2 className="font-bricolage-grotesque text-balance text-4xl font-semibold tracking-[-0.05em] lg:text-5xl">
            {t('title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
            {t('description')}
          </p>

          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg">
              <LocaleLink href={AI_IMAGE_NEW_PROJECT_ROUTE}>
                <span>{t('primaryButton')}</span>
              </LocaleLink>
            </Button>

            <Button asChild size="lg" variant="outline">
              <LocaleLink href="/#pricing">
                <span>{t('secondaryButton')}</span>
              </LocaleLink>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
