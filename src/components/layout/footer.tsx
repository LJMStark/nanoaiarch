'use client';

import Container from '@/components/layout/container';
import { Logo } from '@/components/layout/logo';
import { ModeSwitcherHorizontal } from '@/components/layout/mode-switcher-horizontal';
import { useFooterLinks } from '@/config/footer-config';
import { useSocialLinks } from '@/config/social-config';
import { LocaleLink } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import type React from 'react';

export function Footer({ className }: React.HTMLAttributes<HTMLElement>) {
  const t = useTranslations();
  const footerLinks = useFooterLinks();
  const socialLinks = useSocialLinks();

  return (
    <footer
      className={cn('relative mt-16 border-t border-border/60', className)}
    >
      <Container className="pb-8 pt-6">
        <div className="surface-panel rounded-[2rem] px-6 py-10 sm:px-8 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.45fr)_repeat(3,minmax(0,0.75fr))]">
            <div className="flex flex-col items-start gap-5">
              {/* logo and name */}
              <div className="flex items-center gap-3">
                <Logo />
                <span className="font-bricolage-grotesque text-2xl font-semibold tracking-[-0.04em]">
                  {t('Metadata.name')}
                </span>
              </div>

              {/* tagline */}
              <p className="max-w-md text-base leading-7 text-muted-foreground">
                {t('Marketing.footer.tagline')}
              </p>

              {/* social links */}
              <div className="flex items-center gap-2">
                {socialLinks?.map((link) => (
                  <a
                    key={link.title}
                    href={link.href || '#'}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={link.title}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-background/55 text-muted-foreground hover:border-primary/20 hover:bg-accent/60 hover:text-foreground"
                  >
                    <span className="sr-only">{link.title}</span>
                    {link.icon ? link.icon : null}
                  </a>
                ))}
              </div>
            </div>

            {/* footer links */}
            {footerLinks?.map((section) => (
              <div key={section.title} className="items-start">
                <span className="text-sm font-semibold tracking-[-0.02em] text-foreground">
                  {section.title}
                </span>
                <ul className="mt-4 list-inside space-y-3">
                  {section.items?.map(
                    (item) =>
                      item.href && (
                        <li key={item.title}>
                          <LocaleLink
                            href={item.href || '#'}
                            target={item.external ? '_blank' : undefined}
                            className="text-sm leading-6 text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {item.title}
                          </LocaleLink>
                        </li>
                      )
                  )}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} {t('Metadata.name')} All rights
              reserved.
            </span>

            <div className="flex items-center gap-x-4">
              <ModeSwitcherHorizontal />
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}
