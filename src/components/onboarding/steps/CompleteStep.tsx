'use client';

import { completeOnboarding } from '@/actions/onboarding';
import { Button } from '@/components/ui/button';
import { Routes } from '@/routes';
import { useOnboardingStore } from '@/stores/onboarding-store';
import {
  Check,
  ExternalLink,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CompleteStep() {
  const t = useTranslations('Onboarding');
  const router = useRouter();
  const { generatedImageUrl, closeOnboarding, reset } = useOnboardingStore();
  const [isCompleting, setIsCompleting] = useState(false);

  const handleComplete = async (destination: 'dashboard' | 'create') => {
    setIsCompleting(true);

    // Mark onboarding as complete in the database
    await completeOnboarding();

    // Close the modal and reset state
    closeOnboarding();
    reset();

    // Navigate to destination
    if (destination === 'create') {
      router.push(Routes.AIImage);
    } else {
      router.push(Routes.Dashboard);
    }
  };

  return (
    <div className="flex flex-col items-center text-center px-6 py-4">
      <div className="mb-6">
        <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
          <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">{t('complete.title')}</h2>
        <p className="text-muted-foreground">{t('complete.description')}</p>
      </div>

      {generatedImageUrl && (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted mb-6">
          <Image
            src={generatedImageUrl}
            alt="Your first generation"
            fill
            className="object-cover"
          />
          <div className="absolute bottom-2 right-2">
            <span className="px-2 py-1 bg-black/50 text-white text-xs rounded">
              {t('complete.yourFirstCreation')}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 w-full mb-6">
        <div className="flex flex-col items-center p-4 rounded-lg bg-muted/50">
          <ImageIcon className="h-6 w-6 text-primary mb-2" />
          <span className="text-sm font-medium">
            {t('complete.exploreGallery')}
          </span>
        </div>
        <div className="flex flex-col items-center p-4 rounded-lg bg-muted/50">
          <Sparkles className="h-6 w-6 text-primary mb-2" />
          <span className="text-sm font-medium">
            {t('complete.createMore')}
          </span>
        </div>
      </div>

      <div className="flex gap-3 w-full">
        <Button
          variant="outline"
          onClick={() => handleComplete('dashboard')}
          disabled={isCompleting}
          className="flex-1"
        >
          {t('complete.goToDashboard')}
        </Button>
        <Button
          onClick={() => handleComplete('create')}
          disabled={isCompleting}
          className="flex-1 gap-2"
        >
          <Sparkles className="h-4 w-4" />
          {t('complete.startCreating')}
        </Button>
      </div>
    </div>
  );
}
