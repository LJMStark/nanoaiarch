import { BlogCategoryFilter } from '@/components/blog/blog-category-filter';
import BlogGridWithPagination from '@/components/blog/blog-grid-with-pagination';
import Container from '@/components/layout/container';
import { websiteConfig } from '@/config/website';
import { constructMetadata } from '@/lib/metadata';
import { categorySource, getBlogPosts } from '@/lib/source';
import type { BlogCategory } from '@/types';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

interface BlogPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: BlogPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'BlogPage' });

  return constructMetadata({
    title: t('title'),
    description: t('description'),
    locale,
    pathname: '/blog',
  });
}

export default async function BlogPage({ params }: BlogPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Check if blog is enabled
  if (!websiteConfig.blog?.enable) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'BlogPage' });
  const pageSize = websiteConfig.blog?.paginationSize || 6;

  // Get blog posts
  const { posts, totalPages } = getBlogPosts(locale, { page: 1, pageSize });

  // Get categories for filter
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
          {t('title')}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          {t('subtitle')}
        </p>
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
          routePrefix="/blog"
        />
      </Container>
    </div>
  );
}
