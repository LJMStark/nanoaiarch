'use client';

import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { useLocaleRouter } from '@/i18n/navigation';
import { Loader2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

interface Props {
  error: Error;
  reset: () => void;
}

function isChunkLoadError(error: Error): boolean {
  const message = `${error.name} ${error.message}`.toLowerCase();

  return (
    message.includes('chunkloaderror') ||
    message.includes('failed to load chunk') ||
    message.includes('/_next/static/chunks/')
  );
}

/**
 * 1. Note that error.tsx is loaded right after your app has initialized.
 * If your app is performance-sensitive and you want to avoid loading translation functionality
 * from next-intl as part of this bundle, you can export a lazy reference from your error file.
 * https://next-intl.dev/docs/environments/error-files#errorjs
 *
 * 2. Learned how to recover from a server component error in Next.js from @asidorenko_
 * https://x.com/asidorenko_/status/1841547623712407994
 */
export default function Error({ error, reset }: Props) {
  const t = useTranslations('ErrorPage');
  const router = useLocaleRouter();
  const [isPending, startTransition] = useTransition();

  function handleTryAgain(): void {
    if (isChunkLoadError(error)) {
      window.location.reload();
      return;
    }

    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <Logo className="size-12" />

      <h1 className="text-2xl text-center">{t('title')}</h1>

      <div className="flex items-center gap-4">
        <Button
          type="submit"
          variant="default"
          className="cursor-pointer"
          disabled={isPending}
          onClick={handleTryAgain}
        >
          {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
          {t('tryAgain')}
        </Button>

        <Button
          type="submit"
          variant="outline"
          className="cursor-pointer"
          onClick={() => router.push('/')}
        >
          {t('backToHome')}
        </Button>
      </div>
    </div>
  );
}
