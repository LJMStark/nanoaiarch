'use client';

import { LoginWrapper } from '@/components/auth/login-wrapper';
import Container from '@/components/layout/container';
import { Logo } from '@/components/layout/logo';
import { ModeSwitcher } from '@/components/layout/mode-switcher';
import { NavbarMobile } from '@/components/layout/navbar-mobile';
import { UserButton } from '@/components/layout/user-button';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { useNavbarLinks } from '@/config/navbar-config';
import { useScroll } from '@/hooks/use-scroll';
import { LocaleLink, useLocalePathname } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { Routes } from '@/routes';
import { ArrowUpRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Skeleton } from '../ui/skeleton';
import LocaleSwitcher from './locale-switcher';

interface NavBarProps {
  scroll?: boolean;
}

const customNavigationMenuTriggerStyle = cn(
  navigationMenuTriggerStyle(),
  'relative h-11 rounded-full bg-transparent px-4 text-[0.95rem] font-medium tracking-[-0.01em] text-muted-foreground shadow-none cursor-pointer',
  'hover:bg-accent/70 hover:text-foreground',
  'focus:bg-accent/70 focus:text-foreground',
  'data-active:bg-secondary/85 data-active:font-semibold data-active:text-foreground',
  'data-[state=open]:bg-secondary/70 data-[state=open]:text-foreground'
);

export function Navbar({ scroll }: NavBarProps) {
  const t = useTranslations();
  const scrolled = useScroll(50);
  const menuLinks = useNavbarLinks();
  const localePathname = useLocalePathname();
  const [mounted, setMounted] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  const currentUser = session?.user;
  // console.log(`Navbar, user:`, user);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section
      className={cn(
        'sticky inset-x-0 top-0 z-40 py-3 transition-all duration-300'
      )}
    >
      <Container>
        <div
          className={cn(
            'surface-panel rounded-[1.75rem] px-4 sm:px-5 lg:px-6',
            scroll
              ? scrolled
                ? 'bg-background/82'
                : 'bg-background/60'
              : 'bg-background/82'
          )}
        >
          {/* desktop navbar */}
          <nav className="hidden h-16 lg:flex">
            {/* logo and name */}
            <div className="flex items-center">
              <LocaleLink href="/" className="flex min-h-11 items-center gap-3">
                <Logo />
                <span className="font-bricolage-grotesque text-xl font-semibold tracking-[-0.04em]">
                  {t('Metadata.name')}
                </span>
              </LocaleLink>
            </div>

            {/* menu links */}
            <div className="flex flex-1 items-center justify-center px-6">
              <NavigationMenu className="relative">
                <NavigationMenuList className="flex items-center gap-1">
                  {menuLinks?.map((item, index) =>
                    item.items ? (
                      <NavigationMenuItem key={index} className="relative">
                        <NavigationMenuTrigger
                          data-active={
                            item.items.some((subItem) =>
                              subItem.href
                                ? localePathname.startsWith(subItem.href)
                                : false
                            )
                              ? 'true'
                              : undefined
                          }
                          className={customNavigationMenuTriggerStyle}
                        >
                          {item.title}
                        </NavigationMenuTrigger>
                        <NavigationMenuContent>
                          <ul className="surface-panel grid w-[420px] gap-3 rounded-[1.5rem] p-4 md:w-[520px] md:grid-cols-2 lg:w-[620px]">
                            {item.items?.map((subItem, subIndex) => {
                              const isSubItemActive =
                                subItem.href &&
                                localePathname.startsWith(subItem.href);
                              return (
                                <li key={subIndex}>
                                  <NavigationMenuLink asChild>
                                    <LocaleLink
                                      href={subItem.href || '#'}
                                      target={
                                        subItem.external ? '_blank' : undefined
                                      }
                                      rel={
                                        subItem.external
                                          ? 'noopener noreferrer'
                                          : undefined
                                      }
                                      className={cn(
                                        'group flex select-none flex-row items-center gap-4 rounded-[1.15rem]',
                                        'p-3 leading-none no-underline outline-hidden transition-colors',
                                        'hover:bg-accent/70 hover:text-foreground',
                                        'focus:bg-accent/70 focus:text-foreground',
                                        isSubItemActive &&
                                          'bg-secondary/90 text-foreground'
                                      )}
                                    >
                                      <div
                                        className={cn(
                                          'flex size-8 shrink-0 items-center justify-center transition-colors',
                                          'bg-transparent text-muted-foreground',
                                          'group-hover:bg-transparent group-hover:text-foreground',
                                          'group-focus:bg-transparent group-focus:text-foreground',
                                          isSubItemActive &&
                                            'bg-transparent text-foreground'
                                        )}
                                      >
                                        {subItem.icon ? subItem.icon : null}
                                      </div>
                                      <div className="flex-1">
                                        <div
                                          className={cn(
                                            'text-sm font-medium text-muted-foreground',
                                            'group-hover:bg-transparent group-hover:text-foreground',
                                            'group-focus:bg-transparent group-focus:text-foreground',
                                            isSubItemActive &&
                                              'bg-transparent text-foreground'
                                          )}
                                        >
                                          {subItem.title}
                                        </div>
                                        {subItem.description && (
                                          <div
                                            className={cn(
                                              'text-sm text-muted-foreground',
                                              'group-hover:bg-transparent group-hover:text-foreground/72',
                                              'group-focus:bg-transparent group-focus:text-foreground/72',
                                              isSubItemActive &&
                                                'bg-transparent text-foreground/72'
                                            )}
                                          >
                                            {subItem.description}
                                          </div>
                                        )}
                                      </div>
                                      {subItem.external && (
                                        <ArrowUpRightIcon
                                          className={cn(
                                            'size-4 shrink-0 text-muted-foreground',
                                            'group-hover:bg-transparent group-hover:text-foreground',
                                            'group-focus:bg-transparent group-focus:text-foreground',
                                            isSubItemActive &&
                                              'bg-transparent text-foreground'
                                          )}
                                        />
                                      )}
                                    </LocaleLink>
                                  </NavigationMenuLink>
                                </li>
                              );
                            })}
                          </ul>
                        </NavigationMenuContent>
                      </NavigationMenuItem>
                    ) : (
                      <NavigationMenuItem key={index}>
                        <NavigationMenuLink
                          asChild
                          active={
                            item.href
                              ? item.href === '/'
                                ? localePathname === '/'
                                : localePathname.startsWith(item.href)
                              : false
                          }
                          className={customNavigationMenuTriggerStyle}
                        >
                          <LocaleLink
                            href={item.href || '#'}
                            target={item.external ? '_blank' : undefined}
                            rel={
                              item.external ? 'noopener noreferrer' : undefined
                            }
                          >
                            {item.title}
                          </LocaleLink>
                        </NavigationMenuLink>
                      </NavigationMenuItem>
                    )
                  )}
                </NavigationMenuList>
              </NavigationMenu>
            </div>

            {/* navbar right show sign in or user */}
            <div className="flex items-center gap-2">
              {!mounted || isPending ? (
                <Skeleton className="size-8 border rounded-full" />
              ) : currentUser ? (
                <>
                  {/* <CreditsBalanceButton /> */}
                  <UserButton user={currentUser} />
                </>
              ) : (
                <div className="flex items-center gap-x-4">
                  <LoginWrapper mode="modal" asChild>
                    <Button
                      variant="outline"
                      size="lg"
                      className="cursor-pointer"
                    >
                      {t('Common.login')}
                    </Button>
                  </LoginWrapper>

                  <LocaleLink
                    href={Routes.Register}
                    className={cn(
                      buttonVariants({
                        variant: 'default',
                        size: 'lg',
                      })
                    )}
                  >
                    {t('Common.signUp')}
                  </LocaleLink>
                </div>
              )}

              <ModeSwitcher />
              <LocaleSwitcher />
            </div>
          </nav>

          {/* mobile navbar */}
          <NavbarMobile className="h-16 lg:hidden" />
        </div>
      </Container>
    </section>
  );
}
