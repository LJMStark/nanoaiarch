'use client';

// Template detail modal with preview and editable prompt
// 模版详情模态框，包含预览和可编辑提示词

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ArrowRight, ImageIcon, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { ArchTemplate, AspectRatioId, StylePresetId } from '../lib/arch-types';
import { getAspectRatio } from '../lib/aspect-ratios';
import { getStylePreset } from '../lib/style-presets';
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
        <div className="flex flex-col lg:flex-row h-full">
          {/* Left: Preview image */}
          <div className="lg:w-1/2 relative bg-muted">
            <div className="aspect-[4/3] lg:aspect-auto lg:h-full relative">
              {previewImageError ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
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

              {/* Category badge overlay */}
              <div
                className={cn(
                  'absolute top-4 left-4',
                  'flex items-center gap-2 px-3 py-1.5',
                  'rounded-full bg-black/60 backdrop-blur-sm',
                  'text-sm font-medium text-white'
                )}
              >
                <CategoryIcon className="h-4 w-4" style={{ color: category.color }} />
                <span>{t(category.labelKey as any)}</span>
              </div>
            </div>
          </div>

          {/* Right: Content */}
          <div className="lg:w-1/2 flex flex-col p-6 overflow-y-auto">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-xl">
                {t(template.titleKey as any)}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t(template.descriptionKey as any)}
              </p>
            </DialogHeader>

            {/* Input image preview (if template requires input) */}
            {template.requiresInput && template.inputImage && (
              <div className="mb-4">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  {t('ArchPage.modal.referenceImage')}
                </label>
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
                  {inputImageError ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  ) : (
                    <Image
                      src={template.inputImage}
                      alt="Reference input"
                      fill
                      className="object-cover"
                      onError={() => setInputImageError(true)}
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/60 backdrop-blur-sm rounded-full p-2">
                      <ArrowRight className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>
                {template.requiresInput && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('ArchPage.modal.inputRequired')}
                  </p>
                )}
              </div>
            )}

            {/* Editable prompt */}
            <div className="mb-4 flex-1">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                {t('ArchPage.modal.editPrompt')}
              </label>
              <Textarea
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                className="min-h-[120px] resize-none"
                placeholder={t('ArchPage.controls.prompt')}
              />
            </div>

            {/* Style and aspect ratio */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {t('ArchPage.controls.style')}
                </label>
                <StylePresetSelect
                  value={selectedStyle}
                  onChange={setSelectedStyle}
                  className="w-full"
                />
              </div>
              <div className="flex-1">
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

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-6">
              {template.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Apply button */}
            <Button onClick={handleApply} className="w-full gap-2" size="lg">
              <Sparkles className="h-4 w-4" />
              {t('ArchPage.modal.apply')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
