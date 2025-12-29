'use client';

import { skipOnboarding } from '@/actions/onboarding';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useTranslations } from 'next-intl';
import { CompleteStep, GenerateStep, TemplateStep, WelcomeStep } from './steps';

export function OnboardingModal() {
  const t = useTranslations('Onboarding');
  const { isOpen, closeOnboarding, currentStep, reset } = useOnboardingStore();

  const handleOpenChange = async (open: boolean) => {
    if (!open) {
      // Skip onboarding when closing
      await skipOnboarding();
      closeOnboarding();
      reset();
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return <WelcomeStep />;
      case 'template':
        return <TemplateStep />;
      case 'generate':
        return <GenerateStep />;
      case 'complete':
        return <CompleteStep />;
      default:
        return <WelcomeStep />;
    }
  };

  // Progress indicator
  const steps = ['welcome', 'template', 'generate', 'complete'];
  const currentIndex = steps.indexOf(currentStep);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{t('modal.title')}</DialogTitle>
        </DialogHeader>

        {/* Progress bar */}
        <div className="flex gap-1 px-6 pt-6">
          {steps.map((step, index) => (
            <div
              key={step}
              className={`h-1 flex-1 rounded-full transition-colors ${
                index <= currentIndex ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[400px] flex flex-col justify-center">
          {renderStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
