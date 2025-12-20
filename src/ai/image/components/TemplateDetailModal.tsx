'use client';

// Template detail modal with preview and editable prompt
// 模版详情模态框，包含预览和可编辑提示词
// 响应式横版布局设计

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ArrowRight, ImageIcon, Sparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { ArchTemplate, AspectRatioId, StylePresetId } from '../lib/arch-types';
import { getTemplateCategory } from '../lib/template-categories';
import { AspectRatioSelect } from './AspectRatioSelect';
import { StylePresetSelect } from './StylePresetSelect';

interface TemplateDetailModalProps {
  template: ArchTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (template: ArchTemplate, prompt: string, style: StylePresetId | null, ratio: AspectRatioId) => void;
}

export function TemplateDetailModal({
  template,
  open,
  onOpenChange,
  onApply,
}: TemplateDetailModalProps) {
  const t = useTranslations();

  // Local state for editing
  const [editedPrompt, setEditedPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<StylePresetId | null>(null);
  const [selectedRatio, setSelectedRatio] = useState<AspectRatioId>('16:9');
  const [previewImageError, setPreviewImageError] = useState(false);
  const [inputImageError, setInputImageError] = useState(false);

  // Reset state when template changes
  useEffect(() => {
    if (template) {
      setEditedPrompt(template.promptTemplate);
      setSelectedStyle(template.defaultStyle ?? null);
      setSelectedRatio(template.defaultAspectRatio ?? '16:9');
      setPreviewImageError(false);
      setInputImageError(false);
    }
  }, [template]);

  if (!template) return null;

  const category = getTemplateCategory(template.categoryId);
  const CategoryIcon = category.icon;

  const handleApply = () => {
    onApply(template, editedPrompt, selectedStyle, selectedRatio);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // 始终横版布局，响应式宽度
          'w-[95vw] max-w-5xl',
          // 固定高度，适应不同屏幕
          'h-auto max-h-[85vh]',
          // 移除默认 padding，自定义布局
          'p-0 overflow-hidden',
          // 圆角和边框
          'rounded-2xl border-border/50'
        )}
      >
        {/* 横版布局容器 - 始终水平排列 */}
        <div className="flex flex-row h-full">
          {/* 左侧：预览图区域 - 固定宽度比例 */}
          <div className="w-2/5 min-w-[200px] relative bg-muted/50 flex-shrink-0">
            {/* 预览图容器 */}
            <div className="absolute inset-0">
              {previewImageError ? (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                </div>
              ) : (
                <Image
                  src={template.previewImage}
                  alt={t(template.titleKey as any)}
                  fill
                  className="object-cover"
                  onError={() => setPreviewImageError(true)}
                />
              )}

              {/* 渐变遮罩 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-background/20" />

              {/* 分类徽章 */}
              <div
                className={cn(
                  'absolute top-3 left-3',
                  'flex items-center gap-1.5 px-2.5 py-1',
                  'rounded-full bg-black/60 backdrop-blur-sm',
                  'text-xs font-medium text-white'
                )}
              >
                <CategoryIcon className="h-3.5 w-3.5" style={{ color: category.color }} />
                <span>{t(category.labelKey as any)}</span>
              </div>
            </div>
          </div>

          {/* 右侧：内容区域 */}
          <div className="flex-1 flex flex-col p-4 sm:p-5 overflow-y-auto min-w-0">
            {/* 头部：标题和描述 */}
            <DialogHeader className="mb-3 flex-shrink-0">
              <DialogTitle className="text-lg sm:text-xl font-semibold pr-8">
                {t(template.titleKey as any)}
              </DialogTitle>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
                {t(template.descriptionKey as any)}
              </p>
            </DialogHeader>

            {/* 输入图片预览（如果模板需要输入） */}
            {template.requiresInput && (
              <div className="mb-3 flex-shrink-0">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {t('ArchPage.modal.referenceImage')}
                </label>
                <div className="relative h-20 sm:h-24 rounded-lg overflow-hidden bg-muted border border-dashed border-border/50">
                  {template.inputImage && !inputImageError ? (
                    <>
                      <Image
                        src={template.inputImage}
                        alt="Reference input"
                        fill
                        className="object-cover opacity-60"
                        onError={() => setInputImageError(true)}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black/60 backdrop-blur-sm rounded-full p-1.5">
                          <ArrowRight className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1" />
                        <span className="text-[10px] text-muted-foreground">
                          {t('ArchPage.modal.inputRequired')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 可编辑提示词 */}
            <div className="mb-3 flex-1 min-h-0">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                {t('ArchPage.modal.editPrompt')}
              </label>
              <Textarea
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                className={cn(
                  'h-full min-h-[80px] max-h-[150px] resize-none',
                  'text-sm bg-muted/30 border-border/50',
                  'focus:border-primary/50 focus:ring-1 focus:ring-primary/20'
                )}
                placeholder={t('ArchPage.controls.prompt')}
              />
            </div>

            {/* 样式和比例选择 - 紧凑横向排列 */}
            <div className="flex items-center gap-3 mb-3 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                  {t('ArchPage.controls.style')}
                </label>
                <StylePresetSelect
                  value={selectedStyle}
                  onChange={setSelectedStyle}
                  className="w-full"
                />
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                  {t('ArchPage.controls.aspectRatio')}
                </label>
                <AspectRatioSelect
                  value={selectedRatio}
                  onChange={setSelectedRatio}
                  className="w-full"
                />
              </div>
            </div>

            {/* 标签 */}
            <div className="flex flex-wrap gap-1.5 mb-3 flex-shrink-0">
              {template.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-[10px] rounded-full bg-muted text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* 应用按钮 */}
            <Button
              onClick={handleApply}
              className="w-full gap-2 flex-shrink-0"
              size="default"
            >
              <Sparkles className="h-4 w-4" />
              {t('ArchPage.modal.apply')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
