// Blog Header - Article header with title, date, author, categories, and reading time
// 博客头部 - 文章标题、日期、作者、分类和阅读时间

import { LocaleLink } from '@/i18n/navigation';
import { formatDate } from '@/lib/formatter';
import type { AuthorType, CategoryType } from '@/lib/source';
import { Calendar, Clock, Tag } from 'lucide-react';
import Image from 'next/image';

interface BlogHeaderProps {
  title: string;
  description?: string;
  date: string;
  author?: AuthorType;
  categories?: CategoryType[];
  readTime: number;
  image?: string;
}

export function BlogHeader({
  title,
  description,
  date,
  author,
  categories,
  readTime,
  image,
}: BlogHeaderProps) {
  const publishDate = formatDate(new Date(date));

  return (
    <header className="mb-8 pb-8 border-b">
      {/* Categories */}
      {categories && categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map((category) => (
            <LocaleLink
              key={category.slugs[0]}
              href={`/blog/category/${category.slugs[0]}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md hover:bg-primary/20 transition-colors"
            >
              <Tag className="h-3 w-3" />
              {category.data.name}
            </LocaleLink>
          ))}
        </div>
      )}

      {/* Title */}
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
        {title}
      </h1>

      {/* Description */}
      {description && (
        <p className="text-lg text-muted-foreground mb-6">{description}</p>
      )}

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        {/* Author */}
        {author && (
          <div className="flex items-center gap-2">
            {author.data.avatar && (
              <Image
                src={author.data.avatar}
                alt={author.data.name || 'Author'}
                width={32}
                height={32}
                className="rounded-full object-cover"
              />
            )}
            <span className="font-medium text-foreground">
              {author.data.name}
            </span>
          </div>
        )}

        {/* Date */}
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          <time dateTime={date}>{publishDate}</time>
        </div>

        {/* Reading time */}
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          <span>{readTime} min read</span>
        </div>
      </div>

      {/* Featured image */}
      {image && (
        <div className="mt-8 relative aspect-video overflow-hidden rounded-xl">
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover"
            priority
          />
        </div>
      )}
    </header>
  );
}
