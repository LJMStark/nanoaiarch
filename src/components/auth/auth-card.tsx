'use client';

import { BottomLink } from '@/components/auth/bottom-link';
import { Logo } from '@/components/layout/logo';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { LocaleLink } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface AuthCardProps {
  children: React.ReactNode;
  headerLabel: string;
  bottomButtonLabel: string;
  bottomButtonHref: string;
  className?: string;
}

export const AuthCard = ({
  children,
  headerLabel,
  bottomButtonLabel,
  bottomButtonHref,
  className,
}: AuthCardProps) => {
  return (
    <Card
      className={cn(
        'overflow-hidden border-white/40 bg-card/92 shadow-[0_36px_80px_-44px_rgba(34,50,33,0.48)]',
        className
      )}
    >
      <CardHeader className="flex flex-col items-center gap-4 text-center">
        <LocaleLink href="/" prefetch={false}>
          <Logo className="mb-2 size-10 rounded-2xl" />
        </LocaleLink>
        <div className="space-y-2">
          <h1 className="font-bricolage-grotesque text-3xl font-semibold leading-none tracking-[-0.05em]">
            {headerLabel}
          </h1>
          <CardDescription className="mx-auto max-w-sm text-sm leading-6">
            Continue with your account to access the studio workspace.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
      <CardFooter className="border-t border-border/60 pt-6">
        <BottomLink label={bottomButtonLabel} href={bottomButtonHref} />
      </CardFooter>
    </Card>
  );
};
