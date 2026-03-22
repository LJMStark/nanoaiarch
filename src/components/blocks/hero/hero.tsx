import { Ripple } from '@/components/magicui/ripple';
import { AnimatedGroup } from '@/components/tailark/motion/animated-group';
import { TextEffect } from '@/components/tailark/motion/text-effect';
import { Button } from '@/components/ui/button';
import { LocaleLink } from '@/i18n/navigation';
import { AI_IMAGE_NEW_PROJECT_ROUTE } from '@/routes';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import heroDashboardImage from '../../../../public/images/generated/hero-dashboard.png';

const transitionVariants = {
  item: {
    hidden: {
      opacity: 0,
      y: 12,
      scale: 0.95,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        bounce: 0.3,
        duration: 1.5,
      },
    },
  },
};

export default function HeroSection() {
  const t = useTranslations('HomePage.hero');
  const linkIntroduction = '/ai/image';
  const linkPrimary = AI_IMAGE_NEW_PROJECT_ROUTE;
  const linkSecondary = '/#pricing';

  return (
    <main id="hero" className="overflow-hidden px-4 pt-4 sm:pt-8">
      <section className="mx-auto max-w-[88rem] pb-10 sm:pb-14">
        <div className="relative overflow-hidden rounded-[2.25rem] px-6 py-10 sm:px-8 lg:px-10 lg:py-14">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(104,130,88,0.18),transparent_30%),radial-gradient(circle_at_85%_20%,rgba(251,247,240,0.78),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(169,138,100,0.14),transparent_28%)]"
          />
          <div
            aria-hidden
            className="absolute -left-20 top-16 hidden h-72 w-72 rounded-full bg-primary/12 blur-3xl lg:block"
          />
          <div
            aria-hidden
            className="absolute -right-16 bottom-0 hidden h-80 w-80 rounded-full bg-[rgba(161,132,96,0.14)] blur-3xl lg:block"
          />

          <Ripple />

          <div className="relative z-10 grid gap-12 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:items-end">
            <div className="max-w-3xl">
              <AnimatedGroup variants={transitionVariants}>
                <LocaleLink
                  href={linkIntroduction}
                  className="surface-panel group inline-flex w-fit items-center gap-3 rounded-full px-4 py-2"
                >
                  <span className="text-sm font-medium text-foreground">
                    {t('introduction')}
                  </span>

                  <div className="flex size-7 items-center justify-center overflow-hidden rounded-full bg-primary/12 text-primary">
                    <div className="flex w-14 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
                      <span className="flex size-7">
                        <ArrowRight className="m-auto size-3.5" />
                      </span>
                      <span className="flex size-7">
                        <ArrowRight className="m-auto size-3.5" />
                      </span>
                    </div>
                  </div>
                </LocaleLink>
              </AnimatedGroup>

              <TextEffect
                per="line"
                preset="fade-in-blur"
                speedSegment={0.3}
                as="h1"
                className="mt-8 max-w-4xl text-left font-bricolage-grotesque text-5xl leading-[0.92] tracking-[-0.07em] text-balance sm:text-6xl xl:text-[6.35rem]"
              >
                {t('title')}
              </TextEffect>

              <TextEffect
                per="line"
                preset="fade-in-blur"
                speedSegment={0.3}
                delay={0.5}
                as="p"
                className="mt-6 max-w-xl text-left text-base leading-8 text-muted-foreground sm:text-lg"
              >
                {t('description')}
              </TextEffect>

              <AnimatedGroup
                variants={{
                  container: {
                    visible: {
                      transition: {
                        staggerChildren: 0.05,
                        delayChildren: 0.75,
                      },
                    },
                  },
                  ...transitionVariants,
                }}
                className="mt-10 flex flex-wrap items-center gap-4"
              >
                <Button key={1} asChild size="lg" className="px-6 text-base">
                  <LocaleLink href={linkPrimary}>
                    <span className="text-nowrap">{t('primary')}</span>
                  </LocaleLink>
                </Button>
                <Button key={2} asChild size="lg" variant="outline">
                  <LocaleLink href={linkSecondary}>
                    <span className="text-nowrap">{t('secondary')}</span>
                  </LocaleLink>
                </Button>
              </AnimatedGroup>
            </div>

            <AnimatedGroup
              variants={{
                container: {
                  visible: {
                    transition: {
                      staggerChildren: 0.05,
                      delayChildren: 0.75,
                    },
                  },
                },
                ...transitionVariants,
              }}
              className="relative lg:pl-8"
            >
              <div className="surface-panel relative mx-auto max-w-3xl overflow-hidden rounded-[2rem] p-3 sm:p-4">
                <div
                  aria-hidden
                  className="absolute inset-x-10 top-0 h-16 rounded-full bg-primary/12 blur-3xl"
                />
                <div className="relative overflow-hidden rounded-[1.5rem] border border-white/30 bg-muted/40">
                  <Image
                    className="hidden w-full rounded-[1.5rem] object-cover dark:block"
                    src={heroDashboardImage}
                    alt="Arch AI Dashboard preview"
                    priority
                    placeholder="blur"
                    sizes="(max-width: 1024px) 100vw, 52vw"
                  />
                  <Image
                    className="w-full rounded-[1.5rem] border border-border/30 object-cover dark:hidden"
                    src={heroDashboardImage}
                    alt="Arch AI Dashboard preview"
                    priority
                    placeholder="blur"
                    sizes="(max-width: 1024px) 100vw, 52vw"
                  />
                </div>
              </div>
            </AnimatedGroup>
          </div>
        </div>
      </section>
    </main>
  );
}
