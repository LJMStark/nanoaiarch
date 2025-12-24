import { BlogHeader } from '@/components/blog/blog-header';
import { MDXErrorBoundary } from '@/components/blog/mdx-error-boundary';
import { RelatedPosts } from '@/components/blog/related-posts';
import { TOCSidebar } from '@/components/blog/toc-sidebar';
import { getMDXComponents } from '@/components/docs/mdx-components';
import Container from '@/components/layout/container';
import { websiteConfig } from '@/config/website';
import { LOCALES } from '@/i18n/routing';
import { constructMetadata } from '@/lib/metadata';
import {
  authorSource,
  blogSource,
  categorySource,
  getRelatedPosts,
} from '@/lib/source';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

interface BlogPostPageProps {
  params: Promise<{
    slug: string;
    locale: Locale;
  }>;
}

export function generateStaticParams() {
  const slugParams = blogSource.generateParams();
  const params = LOCALES.flatMap((locale) =>
    slugParams.map((param) => ({
      locale,
      slug: param.slug[0], // Blog posts are single-level slugs
    }))
  );

  return params;
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const page = blogSource.getPage([slug], locale);

  if (!page) {
    return constructMetadata({
      title: 'Post Not Found',
      locale,
      pathname: `/blog/${slug}`,
    });
  }

  return constructMetadata({
    title: page.data.title,
    description: page.data.description,
    locale,
    pathname: `/blog/${slug}`,
    image: page.data.image,
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug, locale } = await params;
  setRequestLocale(locale);

  // Check if blog is enabled
  if (!websiteConfig.blog?.enable) {
    notFound();
  }

  const page = blogSource.getPage([slug], locale);

  if (!page) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'BlogPage' });

  // Get author info
  const author = page.data.author
    ? authorSource.getPage([page.data.author], locale)
    : undefined;

  // Get categories info
  const categories = page.data.categories
    ? categorySource
        .getPages(locale)
        .filter((cat) => page.data.categories?.includes(cat.slugs[0] || ''))
    : [];

  // Reading time is calculated in the transformer
  const readTime = (page.data as any).readTime || 1;

  // Get related posts
  const relatedPosts = getRelatedPosts(
    slug,
    page.data.categories || [],
    locale,
    websiteConfig.blog?.relatedPostsSize || 3
  );

  const MDX = page.data.body;

  return (
    <div className="py-16">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-12">
          {/* Main content */}
          <article className="min-w-0">
            <BlogHeader
              title={page.data.title}
              description={page.data.description}
              date={page.data.date}
              author={author}
              categories={categories}
              readTime={readTime}
              image={page.data.image}
            />

            {/* MDX Content */}
            <MDXErrorBoundary>
              <div className="prose prose-lg dark:prose-invert max-w-none">
                <MDX components={getMDXComponents()} />
              </div>
            </MDXErrorBoundary>

            {/* Related Posts */}
            <RelatedPosts
              posts={relatedPosts}
              locale={locale}
              title={t('morePosts')}
            />
          </article>

          {/* TOC Sidebar */}
          <TOCSidebar toc={page.data.toc} title={t('tableOfContents')} />
        </div>
      </Container>
    </div>
  );
}
