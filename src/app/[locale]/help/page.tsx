import Container from '@/components/layout/container';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { type HelpType, helpSource } from '@/lib/source';
import { CreditCard, HelpCircle, Rocket, Sparkles } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

// Category configuration with icons
const CATEGORIES = {
  'getting-started': { icon: Rocket, color: 'text-green-500' },
  billing: { icon: CreditCard, color: 'text-blue-500' },
  'ai-features': { icon: Sparkles, color: 'text-purple-500' },
  account: { icon: HelpCircle, color: 'text-orange-500' },
  troubleshooting: { icon: HelpCircle, color: 'text-red-500' },
} as const;

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function HelpPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations('Help');

  // Get all help articles
  const articles = helpSource
    .getPages(locale)
    .filter((article) => article.data.published !== false);

  // Group by category
  const groupedArticles = articles.reduce(
    (acc, article) => {
      const category = article.data.category || 'getting-started';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(article);
      return acc;
    },
    {} as Record<string, HelpType[]>
  );

  // Sort articles within each category by order
  for (const category of Object.keys(groupedArticles)) {
    groupedArticles[category].sort(
      (a, b) => (a.data.order || 0) - (b.data.order || 0)
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Container className="py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">{t('title')}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('description')}
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(CATEGORIES).map(([categoryKey, config]) => {
            const categoryArticles = groupedArticles[categoryKey] || [];
            if (categoryArticles.length === 0) return null;

            const Icon = config.icon;

            return (
              <Card
                key={categoryKey}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg bg-muted ${config.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg">
                      {t(`categories.${categoryKey}` as any)}
                    </CardTitle>
                  </div>
                  <CardDescription>
                    <ul className="space-y-2 mt-3">
                      {categoryArticles.map((article) => (
                        <li key={article.url}>
                          <Link
                            href={article.url}
                            className="text-foreground hover:text-primary hover:underline transition-colors"
                          >
                            {article.data.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>

        {/* Contact Section */}
        <div className="mt-16 text-center p-8 bg-muted rounded-2xl">
          <h2 className="text-2xl font-semibold mb-4">{t('contact.title')}</h2>
          <p className="text-muted-foreground mb-4">
            {t('contact.description')}
          </p>
          <a
            href="mailto:support@nanoaiarch.com"
            className="text-primary hover:underline font-medium"
          >
            support@nanoaiarch.com
          </a>
        </div>
      </Container>
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Help' });

  return {
    title: t('title'),
    description: t('description'),
  };
}
