'use client';

import { Button } from '@/components/ui/button';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { Gift, Image as ImageIcon, Sparkles, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function WelcomeStep() {
  const t = useTranslations('Onboarding');
  const { nextStep, closeOnboarding } = useOnboardingStore();

  const features = [
    {
      icon: <Sparkles className="h-5 w-5 text-primary" />,
      title: t('welcome.features.ai.title'),
      description: t('welcome.features.ai.description'),
    },
    {
      icon: <ImageIcon className="h-5 w-5 text-primary" />,
      title: t('welcome.features.templates.title'),
      description: t('welcome.features.templates.description'),
    },
    {
      icon: <Zap className="h-5 w-5 text-primary" />,
      title: t('welcome.features.fast.title'),
      description: t('welcome.features.fast.description'),
    },
    {
      icon: <Gift className="h-5 w-5 text-primary" />,
      title: t('welcome.features.credits.title'),
      description: t('welcome.features.credits.description'),
    },
  ];

  return (
    <div className="flex flex-col items-center text-center px-6 py-4">
      <div className="mb-6">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">{t('welcome.title')}</h2>
        <p className="text-muted-foreground">{t('welcome.description')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full mb-6">
        {features.map((feature, index) => (
          <div
            key={index}
            className="flex flex-col items-center p-4 rounded-lg bg-muted/50 text-center"
          >
            <div className="mb-2">{feature.icon}</div>
            <h3 className="font-medium text-sm mb-1">{feature.title}</h3>
            <p className="text-xs text-muted-foreground">
              {feature.description}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 w-full">
        <Button variant="outline" onClick={closeOnboarding} className="flex-1">
          {t('welcome.skip')}
        </Button>
        <Button onClick={nextStep} className="flex-1">
          {t('welcome.start')}
        </Button>
      </div>
    </div>
  );
}
