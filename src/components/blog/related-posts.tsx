// Related Posts - Display related blog posts based on shared categories
// 相关文章 - 基于共同分类展示相关博客文章

import type { BlogType } from '@/lib/source';
import BlogCard from './blog-card';

interface RelatedPostsProps {
  posts: BlogType[];
  locale: string;
  title?: string;
}

export function RelatedPosts({
  posts,
  locale,
  title = 'Related Posts',
}: RelatedPostsProps) {
  if (!posts || posts.length === 0) return null;

  return (
    <section className="mt-16 pt-8 border-t">
      <h2 className="text-2xl font-bold mb-8">{title}</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <BlogCard key={post.slugs.join('/')} locale={locale} post={post} />
        ))}
      </div>
    </section>
  );
}
