'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LocaleLink } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { BlogCategory } from '@/types';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';

export type BlogCategoryListDesktopProps = {
  categoryList: BlogCategory[];
};

export function BlogCategoryListDesktop({
  categoryList,
}: BlogCategoryListDesktopProps) {
  const { slug } = useParams() as { slug?: string };
  const t = useTranslations('BlogPage');

  return (
    <div className="flex items-center justify-center">
      <ToggleGroup
        size="sm"
        type="single"
        value={slug || 'All'}
        aria-label="切换博客分类"
        className="h-9 overflow-hidden rounded-md space-x-1 border bg-background p-1 *:h-7 *:text-muted-foreground"
      >
        <ToggleGroupItem
          key="All"
          value="All"
          className={cn(
            'rounded-sm px-2 cursor-pointer',
            'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
            'hover:bg-accent hover:text-accent-foreground'
          )}
          aria-label="切换到全部博客分类"
        >
          <LocaleLink href={'/blog'} className="px-4">
            <h2>{t('all')}</h2>
          </LocaleLink>
        </ToggleGroupItem>

        {categoryList.map((category) => (
          <ToggleGroupItem
            key={category.slug}
            value={category.slug}
            className={cn(
              'rounded-sm px-2 cursor-pointer',
              'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
              'hover:bg-accent hover:text-accent-foreground'
            )}
            aria-label={`切换到${category.name}分类`}
          >
            <LocaleLink
              href={`/blog/category/${category.slug}`}
              className="px-4"
            >
              <h2>{category.name}</h2>
            </LocaleLink>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
