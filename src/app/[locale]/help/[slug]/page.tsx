import Container from '@/components/layout/container';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { helpSource } from '@/lib/source';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function HelpArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  const t = await getTranslations('Help');

  // Find the article
  const article = helpSource.getPage([slug], locale);

  if (!article || article.data.published === false) {
    notFound();
  }

  const MDXContent = article.data.body;

  return (
    <div className="min-h-screen bg-background">
      <Container className="py-12 max-w-4xl">
        {/* Back link */}
        <Link
          href="/help"
          className={buttonVariants({
            variant: 'ghost',
            size: 'sm',
            className: 'mb-6 -ml-2',
          })}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('backToHelp')}
        </Link>

        {/* Article Header */}
        <header className="mb-8">
          <Badge variant="secondary" className="mb-4">
            {t(`categories.${article.data.category}`)}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {article.data.title}
          </h1>
          {article.data.description && (
            <p className="text-xl text-muted-foreground">
              {article.data.description}
            </p>
          )}
        </header>

        {/* Article Content */}
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <MDXContent components={defaultMdxComponents} />
        </article>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t">
          <p className="text-muted-foreground text-center">
            {t('stillNeedHelp')}{' '}
            <a
              href="mailto:support@nanoaiarch.com"
              className="text-primary hover:underline"
            >
              {t('contactSupport')}
            </a>
          </p>
        </footer>
      </Container>
    </div>
  );
}

export async function generateStaticParams() {
  const locales = ['en', 'zh'];
  const params: { locale: string; slug: string }[] = [];

  for (const locale of locales) {
    const articles = helpSource.getPages(locale);
    for (const article of articles) {
      params.push({
        locale,
        slug: article.slugs[0],
      });
    }
  }

  return params;
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const article = helpSource.getPage([slug], locale);

  if (!article) {
    return {};
  }

  return {
    title: article.data.title,
    description: article.data.description,
  };
}
