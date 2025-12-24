import { BlogCategoryFilter } from '@/components/blog/blog-category-filter';
import BlogGridWithPagination from '@/components/blog/blog-grid-with-pagination';
import Container from '@/components/layout/container';
import { websiteConfig } from '@/config/website';
import { LOCALES } from '@/i18n/routing';
import { constructMetadata } from '@/lib/metadata';
import { categorySource, getBlogPosts } from '@/lib/source';
import type { BlogCategory } from '@/types';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

interface CategoryPageProps {
  params: Promise<{
    slug: string;
    locale: Locale;
  }>;
}

export function generateStaticParams() {
  // Generate params for all locales and categories
  const params = LOCALES.flatMap((locale) => {
    const categories = categorySource.getPages(locale);
    return categories.map((cat) => ({
      locale,
      slug: cat.slugs[0],
    }));
  });

  return params;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const category = categorySource.getPage([slug], locale);
  const t = await getTranslations({ locale, namespace: 'BlogPage' });

  return constructMetadata({
    title: category?.data.name
      ? `${category.data.name} - ${t('title')}`
      : t('title'),
    description: category?.data.description || t('description'),
    locale,
    pathname: `/blog/category/${slug}`,
  });
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug, locale } = await params;
  setRequestLocale(locale);

  // Check if blog is enabled
  if (!websiteConfig.blog?.enable) {
    notFound();
  }

  const category = categorySource.getPage([slug], locale);

  if (!category) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'BlogPage' });
  const pageSize = websiteConfig.blog?.paginationSize || 6;

  // Get blog posts filtered by category
  const { posts, totalPages } = getBlogPosts(locale, {
    category: slug,
    page: 1,
    pageSize,
  });

  // Get all categories for filter
  const categories = categorySource.getPages(locale);
  const categoryList: BlogCategory[] = [
    { slug: '', name: t('all'), description: '' },
    ...categories.map((cat) => ({
      slug: cat.slugs[0] || '',
      name: cat.data.name || cat.slugs[0] || '',
      description: cat.data.description || '',
    })),
  ];

  return (
    <div className="py-16">
      {/* Header */}
      <Container className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {category.data.name}
        </h1>
        {category.data.description && (
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            {category.data.description}
          </p>
        )}
      </Container>

      {/* Category Filter */}
      <div className="mb-8">
        <BlogCategoryFilter categoryList={categoryList} />
      </div>

      {/* Blog Grid */}
      <Container>
        <BlogGridWithPagination
          locale={locale}
          posts={posts}
          totalPages={totalPages}
          routePrefix={`/blog/category/${slug}`}
        />
      </Container>
    </div>
  );
}
