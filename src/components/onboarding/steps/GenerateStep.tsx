'use client';

import { Button } from '@/components/ui/button';
import { useOnboardingStore } from '@/stores/onboarding-store';
import {
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useEffect, useState } from 'react';

/**
 * GenerateStep - 教学演示步骤
 * 不调真实 API，选择模版后直接展示模版的预览图作为"生成结果"
 */
export function GenerateStep() {
  const t = useTranslations('Onboarding');
  const {
    prevStep,
    nextStep,
    selectedTemplateName,
    selectedTemplatePreview,
    setGeneratedImage,
  } = useOnboardingStore();

  const [isSimulating, setIsSimulating] = useState(true);
  const [showResult, setShowResult] = useState(false);

  // 模拟生成过程（短暂 loading 动画后直接展示预览图）
  useEffect(() => {
    if (!selectedTemplatePreview) {
      // 没有选择模版，直接跳到结果（使用默认图）
      setIsSimulating(false);
      setShowResult(true);
      return;
    }

    const timer = setTimeout(() => {
      setIsSimulating(false);
      setShowResult(true);
      setGeneratedImage(selectedTemplatePreview);
    }, 1500); // 1.5秒模拟加载

    return () => clearTimeout(timer);
  }, [selectedTemplatePreview, setGeneratedImage]);

  // 模拟生成中...
  if (isSimulating) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-8">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold mb-2">{t('generate.title')}</h2>
          <p className="text-muted-foreground">
            {selectedTemplateName
              ? t('generate.descriptionWithTemplate', {
                  template: selectedTemplateName,
                })
              : t('generate.description')}
          </p>
        </div>

        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted mb-6">
          {/* 加载动画 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              {t('generate.generating')}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 展示"生成结果"
  return (
    <div className="flex flex-col px-6 py-4">
      <div className="mb-4 text-center">
        <h2 className="text-2xl font-bold mb-2">{t('generate.editTitle')}</h2>
        <p className="text-muted-foreground">{t('generate.editDescription')}</p>
      </div>

      {/* 预览图作为"生成结果" */}
      {showResult && selectedTemplatePreview && (
        <div className="relative aspect-video rounded-lg overflow-hidden bg-muted mb-4">
          <Image
            src={selectedTemplatePreview}
            alt={selectedTemplateName || 'Generated image'}
            fill
            className="object-cover"
          />
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={prevStep}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('generate.back')}
        </Button>
        <Button
          onClick={nextStep}
          className="flex-1 gap-2"
        >
          <Check className="h-4 w-4" />
          {t('generate.complete')}
        </Button>
      </div>
    </div>
  );
}
