'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { SlidersHorizontal, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ExploreFiltersProps {
  styles: string[];
  templates: { id: string; name: string }[];
  selectedStyle: string | null;
  selectedTemplate: string | null;
  sortBy: 'latest' | 'popular';
  onStyleChange: (style: string | null) => void;
  onTemplateChange: (template: string | null) => void;
  onSortChange: (sort: 'latest' | 'popular') => void;
  onClear: () => void;
}

export function ExploreFilters({
  styles,
  templates,
  selectedStyle,
  selectedTemplate,
  sortBy,
  onStyleChange,
  onTemplateChange,
  onSortChange,
  onClear,
}: ExploreFiltersProps) {
  const t = useTranslations('Explore');
  const hasFilters = selectedStyle || selectedTemplate;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <SlidersHorizontal className="h-4 w-4" />
        <span className="text-sm font-medium">{t('filters')}</span>
      </div>

      {/* Style filter */}
      <Select
        value={selectedStyle || 'all'}
        onValueChange={(v) => onStyleChange(v === 'all' ? null : v)}
      >
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder={t('allStyles')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allStyles')}</SelectItem>
          {styles.map((style) => (
            <SelectItem key={style} value={style}>
              {style}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Template filter */}
      {templates.length > 0 && (
        <Select
          value={selectedTemplate || 'all'}
          onValueChange={(v) => onTemplateChange(v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder={t('allTemplates')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allTemplates')}</SelectItem>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Sort */}
      <Select
        value={sortBy}
        onValueChange={(v) => onSortChange(v as 'latest' | 'popular')}
      >
        <SelectTrigger className="w-[120px] h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="latest">{t('sortLatest')}</SelectItem>
          <SelectItem value="popular">{t('sortPopular')}</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear filters */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-9 gap-1"
        >
          <X className="h-3 w-3" />
          {t('clearFilters')}
        </Button>
      )}
    </div>
  );
}
