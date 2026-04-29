'use client';

import LocaleSelector from '@/components/layout/locale-selector';
import { Logo } from '@/components/layout/logo';
import { ModeSwitcherHorizontal } from '@/components/layout/mode-switcher-horizontal';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useNavbarLinks } from '@/config/navbar-config';
import { LocaleLink, useLocalePathname } from '@/i18n/navigation';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { Routes } from '@/routes';
import { Portal } from '@radix-ui/react-portal';
import {
  ArrowUpRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MenuIcon,
  XIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { RemoveScroll } from 'react-remove-scroll';
import { Skeleton } from '../ui/skeleton';
import { UserButtonMobile } from './user-button-mobile';

export function NavbarMobile({
  className,
  ...other
}: React.HTMLAttributes<HTMLDivElement>) {
  const t = useTranslations();
  const [open, setOpen] = React.useState<boolean>(false);
  const localePathname = useLocalePathname();
  const [mounted, setMounted] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  const currentUser = session?.user;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleRouteChangeStart = () => {
      if (document.activeElement instanceof HTMLInputElement) {
        document.activeElement.blur();
      }

      setOpen(false);
    };

    handleRouteChangeStart();
  }, [localePathname]);

  const handleChange = () => {
    const mediaQueryList = window.matchMedia('(min-width: 1024px)');
    setOpen((open) => (open ? !mediaQueryList.matches : false));
  };

  useEffect(() => {
    handleChange();
    const mediaQueryList = window.matchMedia('(min-width: 1024px)');
    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, []);

  const handleToggleMobileMenu = (): void => {
    setOpen((open) => !open);
  };

  if (!mounted) {
    return null;
  }

  return (
    <>
      <div
        className={cn('flex items-center justify-between', className)}
        {...other}
      >
        {/* navbar left shows logo */}
        <LocaleLink
          href={Routes.Root}
          className="flex min-h-11 items-center gap-2"
        >
          <Logo />
          <span className="font-bricolage-grotesque text-xl font-semibold tracking-[-0.04em]">
            {t('Metadata.name')}
          </span>
        </LocaleLink>

        {/* navbar right shows menu icon and user button */}
        <div className="flex items-center justify-end gap-4">
          {/* show user button if user is logged in */}
          {isPending ? (
            <Skeleton className="size-8 border rounded-full" />
          ) : currentUser ? (
            <>
              {/* <CreditsBalanceButton /> */}
              <UserButtonMobile user={currentUser} />
            </>
          ) : null}

          <Button
            variant="ghost"
            size="icon"
            aria-expanded={open}
            aria-label="Toggle Mobile Menu"
            onClick={handleToggleMobileMenu}
            className="size-11 cursor-pointer border border-border/70 bg-background/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-sm"
          >
            {open ? (
              <XIcon className="size-4" />
            ) : (
              <MenuIcon className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {/* mobile menu */}
      {open && (
        <Portal asChild>
          {/* if we don't add RemoveScroll component, the underlying
            page will scroll when we scroll the mobile menu */}
          <RemoveScroll allowPinchZoom enabled>
            {/* Only render MainMobileMenu when not in loading state */}
            {!isPending && (
              <MainMobileMenu
                userLoggedIn={!!currentUser}
                onLinkClicked={handleToggleMobileMenu}
              />
            )}
          </RemoveScroll>
        </Portal>
      )}
    </>
  );
}

interface MainMobileMenuProps {
  userLoggedIn: boolean;
  onLinkClicked: () => void;
}

function MainMobileMenu({ userLoggedIn, onLinkClicked }: MainMobileMenuProps) {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const t = useTranslations();
  const menuLinks = useNavbarLinks();
  const localePathname = useLocalePathname();

  return (
    <div className="fixed inset-0 z-50 mt-[76px] w-full overflow-y-auto bg-background/94 px-4 pb-8 backdrop-blur-xl animate-in fade-in-0">
      <div className="surface-panel mx-auto flex size-full max-w-xl flex-col items-start space-y-4 rounded-[2rem] p-4">
        {/* action buttons */}
        {userLoggedIn ? null : (
          <div className="w-full flex flex-col gap-4 px-4">
            <LocaleLink
              href={Routes.Login}
              onClick={onLinkClicked}
              className={cn(
                buttonVariants({
                  variant: 'outline',
                  size: 'lg',
                }),
                'w-full'
              )}
            >
              {t('Common.login')}
            </LocaleLink>
            <LocaleLink
              href={Routes.Register}
              className={cn(
                buttonVariants({
                  variant: 'default',
                  size: 'lg',
                }),
                'w-full'
              )}
              onClick={onLinkClicked}
            >
              {t('Common.signUp')}
            </LocaleLink>
          </div>
        )}

        {/* main menu */}
        <ul className="w-full px-4 pb-4">
          {menuLinks?.map((item) => {
            const isActive = item.href
              ? item.href === '/'
                ? localePathname === '/'
                : localePathname.startsWith(item.href)
              : item.items?.some(
                  (subItem) =>
                    subItem.href &&
                    (subItem.href === '/'
                      ? localePathname === '/'
                      : localePathname.startsWith(subItem.href))
                );

            return (
              <li key={item.title} className="py-1">
                {item.items ? (
                  <Collapsible
                    open={expanded[item.title.toLowerCase()]}
                    onOpenChange={(isOpen) =>
                      setExpanded((prev) => ({
                        ...prev,
                        [item.title.toLowerCase()]: isOpen,
                      }))
                    }
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className={cn(
                          'flex w-full items-center justify-between rounded-[1rem] px-3 py-3 text-left',
                          'bg-transparent text-muted-foreground cursor-pointer',
                          'hover:bg-accent/65 hover:text-foreground',
                          'focus:bg-accent/65 focus:text-foreground',
                          isActive &&
                            'font-semibold bg-secondary/80 text-foreground'
                        )}
                      >
                        <span className="text-base">{item.title}</span>
                        {expanded[item.title.toLowerCase()] ? (
                          <ChevronDownIcon className="size-4" />
                        ) : (
                          <ChevronRightIcon className="size-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-2">
                      <ul className="mt-2 space-y-2 pl-0">
                        {item.items.map((subItem) => {
                          const isSubItemActive =
                            subItem.href &&
                            localePathname.startsWith(subItem.href);

                          return (
                            <li key={subItem.title}>
                              <LocaleLink
                                href={subItem.href || '#'}
                                target={subItem.external ? '_blank' : undefined}
                                rel={
                                  subItem.external
                                    ? 'noopener noreferrer'
                                    : undefined
                                }
                                className={cn(
                                  buttonVariants({ variant: 'ghost' }),
                                  'group h-auto w-full justify-start gap-4 rounded-[1rem] p-3',
                                  'bg-transparent text-muted-foreground cursor-pointer',
                                  'hover:bg-accent/65 hover:text-foreground',
                                  'focus:bg-accent/65 focus:text-foreground',
                                  isSubItemActive &&
                                    'font-semibold bg-secondary/80 text-foreground'
                                )}
                                onClick={onLinkClicked}
                              >
                                <div
                                  className={cn(
                                    'flex size-8 shrink-0 items-center justify-center transition-colors ml-0',
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
                                  <span
                                    className={cn(
                                      'text-sm text-muted-foreground',
                                      'group-hover:bg-transparent group-hover:text-foreground',
                                      'group-focus:bg-transparent group-focus:text-foreground',
                                      isSubItemActive &&
                                        'font-semibold bg-transparent text-foreground'
                                    )}
                                  >
                                    {subItem.title}
                                  </span>
                                  {/* hide description for now */}
                                  {/* {subItem.description && (
                                      <p
                                        className={cn(
                                          'text-xs text-muted-foreground',
                                          'group-hover:bg-transparent group-hover:text-foreground/80',
                                          'group-focus:bg-transparent group-focus:text-foreground/80',
                                          isSubItemActive &&
                                          'bg-transparent text-foreground/80'
                                        )}
                                      >
                                        {subItem.description}
                                      </p>
                                    )} */}
                                </div>
                                {subItem.external && (
                                  <ArrowUpRightIcon
                                    className={cn(
                                      'size-4 shrink-0 text-muted-foreground items-center',
                                      'group-hover:bg-transparent group-hover:text-foreground',
                                      'group-focus:bg-transparent group-focus:text-foreground',
                                      isSubItemActive &&
                                        'bg-transparent text-foreground'
                                    )}
                                  />
                                )}
                              </LocaleLink>
                            </li>
                          );
                        })}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <LocaleLink
                    href={item.href || '#'}
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noopener noreferrer' : undefined}
                    className={cn(
                      buttonVariants({ variant: 'ghost' }),
                      'w-full !pl-2 justify-start cursor-pointer group',
                      'bg-transparent text-muted-foreground',
                      'hover:bg-transparent hover:text-foreground',
                      'focus:bg-transparent focus:text-foreground',
                      isActive && 'font-semibold bg-transparent text-foreground'
                    )}
                    onClick={onLinkClicked}
                  >
                    <div className="flex items-center w-full pl-0">
                      <span className="text-base">{item.title}</span>
                    </div>
                  </LocaleLink>
                )}
              </li>
            );
          })}
        </ul>

        {/* bottom buttons */}
        <div className="flex w-full items-center justify-between gap-4 border-t border-border/50 p-4">
          <LocaleSelector />
          <ModeSwitcherHorizontal />
        </div>
      </div>
    </div>
  );
}
