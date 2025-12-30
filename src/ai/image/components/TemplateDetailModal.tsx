'use client';

// Template detail modal with preview and editable prompt
// 模版详情模态框 - 重新设计的紧凑布局
// 上方预览区 + 下方控制区

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { ArrowRight, ImageIcon, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { ArchTemplate, AspectRatioId } from '../lib/arch-types';
import { getTemplateCategory } from '../lib/template-categories';
import { AspectRatioSelect } from './AspectRatioSelect';

interface TemplateDetailModalProps {
  template: ArchTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (template: ArchTemplate, prompt: string, ratio: AspectRatioId) => void;
}

export function TemplateDetailModal({
  template,
  open,
  onOpenChange,
  onApply,
}: TemplateDetailModalProps) {
  const t = useTranslations();

  // Local state
  const [editedPrompt, setEditedPrompt] = useState('');
  const [selectedRatio, setSelectedRatio] = useState<AspectRatioId>('16:9');
  const [previewImageError, setPreviewImageError] = useState(false);
  const [inputImageError, setInputImageError] = useState(false);

  // Reset state when template changes
  useEffect(() => {
    if (template) {
      setEditedPrompt(template.promptTemplate);
      setSelectedRatio(template.defaultAspectRatio ?? '16:9');
      setPreviewImageError(false);
      setInputImageError(false);
    }
  }, [template]);

  if (!template) return null;

  const category = getTemplateCategory(template.categoryId);
  const CategoryIcon = category.icon;

  const handleApply = () => {
    onApply(template, editedPrompt, selectedRatio);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'w-[90vw] max-w-2xl',
          'p-0 gap-0 overflow-hidden',
          'rounded-2xl border-border/50 bg-background'
        )}
      >
        {/* Accessible title for screen readers */}
        <VisuallyHidden.Root>
          <DialogTitle>{t(template.titleKey as any)}</DialogTitle>
        </VisuallyHidden.Root>

        {/* 预览区域 - 顶部 */}
        <div className="relative bg-muted/30 p-6 border-b border-border/30">
          {/* 分类徽章 */}
          <div
            className={cn(
              'absolute top-4 left-4 z-10',
              'flex items-center gap-1.5 px-2.5 py-1',
              'rounded-full bg-black/60 backdrop-blur-sm',
              'text-xs font-medium text-white'
            )}
          >
            <CategoryIcon
              className="h-3 w-3"
              style={{ color: category.color }}
            />
            <span>{t(category.labelKey as any)}</span>
          </div>

          {/* 图片预览 */}
          {template.requiresInput ? (
            // INPUT → OUTPUT 横向对比
            <div className="flex items-center justify-center gap-4">
              {/* INPUT */}
              <div className="flex-1 max-w-[200px]">
                <div className="aspect-[4/3] relative rounded-lg overflow-hidden border border-border/30 bg-muted/50">
                  {template.inputImage && !inputImageError ? (
                    <Image
                      src={template.inputImage}
                      alt="Input"
                      fill
                      className="object-cover"
                      onError={() => setInputImageError(true)}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/30 mb-1" />
                      <span className="text-xs text-muted-foreground/50">
                        Your Image
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-center text-xs text-muted-foreground mt-2">
                  INPUT
                </p>
              </div>

              {/* Arrow */}
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <ArrowRight className="h-4 w-4 text-primary" />
                </div>
              </div>

              {/* OUTPUT */}
              <div className="flex-1 max-w-[200px]">
                <div className="aspect-[4/3] relative rounded-lg overflow-hidden border border-primary/30 shadow-md">
                  {!previewImageError ? (
                    <Image
                      src={template.previewImage}
                      alt={t(template.titleKey as any)}
                      fill
                      className="object-cover"
                      onError={() => setPreviewImageError(true)}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <p className="text-center text-xs font-medium text-primary mt-2">
                  OUTPUT
                </p>
              </div>
            </div>
          ) : (
            // 单图预览
            <div className="flex justify-center">
              <div className="w-full max-w-[280px]">
                <div className="aspect-[4/3] relative rounded-lg overflow-hidden border border-border/30 shadow-md">
                  {!previewImageError ? (
                    <Image
                      src={template.previewImage}
                      alt={t(template.titleKey as any)}
                      fill
                      className="object-cover"
                      onError={() => setPreviewImageError(true)}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 控制区域 - 底部 */}
        <div className="p-5 space-y-4">
          {/* 标题和描述 */}
          <div>
            <h2 className="text-lg font-semibold mb-1">
              {t(template.titleKey as any)}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t(template.descriptionKey as any)}
            </p>
          </div>

          {/* Prompt 编辑 */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
              {t('ArchPage.modal.editPrompt')}
            </label>
            <Textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              className={cn(
                'resize-none text-sm h-24',
                'bg-muted/30 border-border/50',
                'focus:border-primary/50 focus:ring-1 focus:ring-primary/20'
              )}
              placeholder={t('ArchPage.controls.prompt')}
            />
          </div>

          {/* 比例选择 */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
              {t('ArchPage.controls.aspectRatio')}
            </label>
            <AspectRatioSelect
              value={selectedRatio}
              onChange={setSelectedRatio}
              className="w-full"
            />
          </div>

          {/* 标签 */}
          {template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {template.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs rounded-full bg-muted/50 text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* 应用按钮 */}
          <Button onClick={handleApply} className="w-full gap-2 h-11">
            <Sparkles className="h-4 w-4" />
            {t('ArchPage.modal.apply')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
