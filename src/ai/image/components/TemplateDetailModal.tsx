'use client';

// Template detail modal with preview and editable prompt
// 模版详情模态框 - 55-45 横版布局设计
// 左侧大尺寸预览，右侧简洁控制区

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ArrowRight, ChevronDown, ChevronUp, ImageIcon, Sparkles } from 'lucide-react';
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

  // Local state
  const [editedPrompt, setEditedPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<StylePresetId | null>(null);
  const [selectedRatio, setSelectedRatio] = useState<AspectRatioId>('16:9');
  const [previewImageError, setPreviewImageError] = useState(false);
  const [inputImageError, setInputImageError] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);

  // Reset state when template changes
  useEffect(() => {
    if (template) {
      setEditedPrompt(template.promptTemplate);
      setSelectedStyle(template.defaultStyle ?? null);
      setSelectedRatio(template.defaultAspectRatio ?? '16:9');
      setPreviewImageError(false);
      setInputImageError(false);
      setPromptExpanded(false);
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
          // 响应式宽度
          'w-[95vw] max-w-4xl',
          // 高度自适应
          'h-auto max-h-[90vh]',
          // 移除默认 padding
          'p-0 overflow-hidden',
          // 样式
          'rounded-2xl border-border/50 bg-background'
        )}
      >
        {/* 主容器 - 横版布局，移动端垂直 */}
        <div className="flex flex-col lg:flex-row h-full max-h-[90vh]">

          {/* 左侧：预览区域 - 55% */}
          <div className="lg:w-[55%] relative bg-muted/30 flex-shrink-0">
            {/* 移动端：固定高度 | 桌面：填满高度 */}
            <div className="relative h-[240px] sm:h-[300px] lg:h-full lg:min-h-[480px]">

              {/* Before/After 对比展示 */}
              {template.requiresInput ? (
                <div className="absolute inset-0 flex items-center justify-center p-6 gap-4">
                  {/* Before 图片 */}
                  <div className="flex-1 h-full max-h-[280px] lg:max-h-[360px] relative">
                    <div className="absolute inset-0 rounded-xl overflow-hidden border border-border/30 bg-muted/50">
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
                          <ImageIcon className="h-8 w-8 text-muted-foreground/30 mb-2" />
                          <span className="text-xs text-muted-foreground/50">Your Image</span>
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">
                      INPUT
                    </div>
                  </div>

                  {/* 箭头 */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <ArrowRight className="h-4 w-4 text-primary" />
                  </div>

                  {/* After 图片 */}
                  <div className="flex-1 h-full max-h-[280px] lg:max-h-[360px] relative">
                    <div className="absolute inset-0 rounded-xl overflow-hidden border border-border/30 shadow-lg">
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
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-primary text-[10px] text-primary-foreground font-medium">
                      OUTPUT
                    </div>
                  </div>
                </div>
              ) : (
                // 单图预览（不需要输入的模板）
                <div className="absolute inset-0 p-6">
                  <div className="relative w-full h-full rounded-xl overflow-hidden border border-border/30 shadow-lg">
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
                        <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 分类徽章 */}
              <div
                className={cn(
                  'absolute top-4 left-4 z-10',
                  'flex items-center gap-1.5 px-3 py-1.5',
                  'rounded-full bg-black/70 backdrop-blur-sm',
                  'text-xs font-medium text-white'
                )}
              >
                <CategoryIcon className="h-3.5 w-3.5" style={{ color: category.color }} />
                <span>{t(category.labelKey as any)}</span>
              </div>
            </div>
          </div>

          {/* 右侧：控制区域 - 45% */}
          <div className="flex-1 flex flex-col p-5 lg:p-6 overflow-y-auto">

            {/* 标题和描述 */}
            <div className="mb-5">
              <h2 className="text-xl lg:text-2xl font-semibold mb-2">
                {t(template.titleKey as any)}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t(template.descriptionKey as any)}
              </p>
            </div>

            {/* Prompt 区域 - 可折叠 */}
            <div className="mb-5">
              <button
                type="button"
                onClick={() => setPromptExpanded(!promptExpanded)}
                className="flex items-center justify-between w-full text-left mb-2 group"
              >
                <span className="text-sm font-medium text-muted-foreground">
                  {t('ArchPage.modal.editPrompt')}
                </span>
                <span className="text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                  {promptExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </span>
              </button>

              <div
                className={cn(
                  'transition-all duration-200 overflow-hidden',
                  promptExpanded ? 'max-h-[200px]' : 'max-h-[80px]'
                )}
              >
                <Textarea
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  onFocus={() => setPromptExpanded(true)}
                  className={cn(
                    'resize-none text-sm',
                    'bg-muted/30 border-border/50',
                    'focus:border-primary/50 focus:ring-1 focus:ring-primary/20',
                    promptExpanded ? 'h-[180px]' : 'h-[72px]'
                  )}
                  placeholder={t('ArchPage.controls.prompt')}
                />
              </div>
            </div>

            {/* 样式和比例选择 - 使用 grid 布局 */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {t('ArchPage.controls.style')}
                </label>
                <StylePresetSelect
                  value={selectedStyle}
                  onChange={setSelectedStyle}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
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
            {template.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {template.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 text-xs rounded-full bg-muted/50 text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* 占位区域，将按钮推到底部 */}
            <div className="flex-1" />

            {/* 应用按钮 */}
            <Button
              onClick={handleApply}
              size="lg"
              className="w-full gap-2 h-12 text-base"
            >
              <Sparkles className="h-5 w-5" />
              {t('ArchPage.modal.apply')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
