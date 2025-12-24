'use client';

// Blog TOC Sidebar - Table of contents with scroll highlighting
// 博客目录侧边栏 - 带滚动高亮的目录导航

import { cn } from '@/lib/utils';
import type { TableOfContents } from 'fumadocs-core/server';
import { useEffect, useState } from 'react';

interface TOCSidebarProps {
  toc: TableOfContents;
  title?: string;
}

export function TOCSidebar({
  toc,
  title = 'Table of Contents',
}: TOCSidebarProps) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const headings = toc.map((item) => item.url.slice(1));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      {
        rootMargin: '-80px 0px -80% 0px',
        threshold: 0,
      }
    );

    for (const id of headings) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, [toc]);

  if (!toc || toc.length === 0) return null;

  return (
    <aside className="hidden lg:block sticky top-24 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto">
      <nav className="space-y-2">
        <h3 className="font-medium text-sm text-foreground mb-4">{title}</h3>
        <ul className="space-y-2 text-sm">
          {toc.map((item) => (
            <li key={item.url}>
              <a
                href={item.url}
                className={cn(
                  'block py-1 text-muted-foreground hover:text-foreground transition-colors',
                  activeId === item.url.slice(1) && 'text-primary font-medium',
                  item.depth > 2 && 'ml-4 text-xs'
                )}
              >
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
