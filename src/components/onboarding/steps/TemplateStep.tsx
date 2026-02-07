'use client';

import { ARCH_TEMPLATES } from '@/ai/image/lib/templates';
import { Button } from '@/components/ui/button';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { ArrowLeft, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

// Featured template IDs for onboarding
const FEATURED_TEMPLATE_IDS = [
  'style-transfer-modern',
  'style-transfer-traditional',
  'white-model-render',
  'sketch-to-render',
  'floor-plan-render',
  'interior-design',
];

export function TemplateStep() {
  const t = useTranslations('Onboarding');
  const { prevStep, nextStep, selectedTemplateId, selectTemplate } =
    useOnboardingStore();

  // Get featured templates for onboarding
  const featuredTemplates = ARCH_TEMPLATES.filter((template) =>
    FEATURED_TEMPLATE_IDS.includes(template.id)
  ).slice(0, 6);

  const handleSelectTemplate = (templateId: string, templateName: string) => {
    selectTemplate(templateId, templateName);
    nextStep();
  };

  // Simple display name extraction from ID
  const getDisplayName = (id: string) => {
    return id
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="flex flex-col px-6 py-4">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold mb-2">{t('template.title')}</h2>
        <p className="text-muted-foreground">{t('template.description')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {featuredTemplates.map((template) => {
          const isSelected = selectedTemplateId === template.id;
          const displayName = getDisplayName(template.id);

          return (
            <button
              key={template.id}
              onClick={() => handleSelectTemplate(template.id, displayName)}
              className={`
                group relative overflow-hidden rounded-lg border-2 transition-all
                ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}
              `}
            >
              <div className="aspect-video relative">
                <Image
                  src={template.previewImage}
                  alt={displayName}
                  fill
                  sizes="(max-width: 768px) 50vw, 33vw"
                  className="object-cover"
                />
                {isSelected && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-5 w-5 text-primary-foreground" />
                    </div>
                  </div>
                )}
              </div>
              <div className="p-2 text-left">
                <p className="font-medium text-sm truncate">{displayName}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={prevStep} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('template.back')}
        </Button>
        <Button
          variant="ghost"
          onClick={nextStep}
          className="ml-auto text-muted-foreground"
        >
          {t('template.skip')}
        </Button>
      </div>
    </div>
  );
}
