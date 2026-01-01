'use client';

import { TemplateDetailModal } from '@/ai/image/components/TemplateDetailModal';
import { useTemplateApply } from '@/ai/image/hooks/use-template-apply';
import type { ArchTemplate, AspectRatioId } from '@/ai/image/lib/arch-types';
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LIST,
} from '@/ai/image/lib/template-categories';
import { ARCH_TEMPLATES, FEATURED_TEMPLATES } from '@/ai/image/lib/templates';
import { LoginForm } from '@/components/auth/login-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCurrentUser } from '@/hooks/use-current-user';
import { cn } from '@/lib/utils';
import {
  AnimatePresence,
  motion,
  useInView,
} from 'framer-motion';
import { ArrowRight, Layers, Loader2, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// 每页加载的模板数量
const PAGE_SIZE = 12;

// 模拟不同的图片高度比例，创造视觉节奏
const ASPECT_VARIANTS = [
  'aspect-[4/3]',
  'aspect-[3/4]',
  'aspect-[16/9]',
  'aspect-[1/1]',
  'aspect-[4/5]',
] as const;

// 根据模板 ID 确定性地分配高度变体
function getAspectVariant(templateId: string): string {
  const hash = templateId
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return ASPECT_VARIANTS[hash % ASPECT_VARIANTS.length];
}

interface TemplateShowcaseProps {
  showFullView?: boolean;
}

export function TemplateShowcase({
  showFullView = false,
}: TemplateShowcaseProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<ArchTemplate | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const currentUser = useCurrentUser();
  const pathname = usePathname();

  // 无限滚动状态
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { applyTemplateWithProject, applyQuickPrompt } = useTemplateApply();

  // 初始化动画
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // 筛选模板
  const filteredTemplates = useMemo(() => {
    if (selectedCategory === 'all') {
      return [...ARCH_TEMPLATES].sort(
        (a, b) => (a.order ?? 99) - (b.order ?? 99)
      );
    }
    return ARCH_TEMPLATES.filter((t) => t.categoryId === selectedCategory).sort(
      (a, b) => (a.order ?? 99) - (b.order ?? 99)
    );
  }, [selectedCategory]);

  // 当前显示的模板（分页）
  const displayedTemplates = useMemo(() => {
    return filteredTemplates.slice(0, displayCount);
  }, [filteredTemplates, displayCount]);

  // 是否还有更多模板
  const hasMore = displayCount < filteredTemplates.length;

  // 重置分页当分类改变时
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
    // 滚动到顶部
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [selectedCategory]);

  // 无限滚动 - 使用 Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !isLoadingMore) {
          setIsLoadingMore(true);
          // 模拟加载延迟，实际可以直接加载
          setTimeout(() => {
            setDisplayCount((prev) => Math.min(prev + PAGE_SIZE, filteredTemplates.length));
            setIsLoadingMore(false);
          }, 300);
        }
      },
      {
        root: scrollContainerRef.current,
        threshold: 0.1,
        rootMargin: '100px'
      }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, isLoadingMore, filteredTemplates.length]);

  // 处理模板点击
  const handleTemplateClick = useCallback((template: ArchTemplate) => {
    setSelectedTemplate(template);
    setIsModalOpen(true);
  }, []);

  // 应用模板
  const handleApplyTemplate = async (
    template: ArchTemplate,
    prompt: string,
    ratio: AspectRatioId
  ) => {
    // 未登录时显示登录弹窗
    if (!currentUser) {
      setShowLoginModal(true);
      return;
    }
    setIsModalOpen(false);
    await applyTemplateWithProject({ template, prompt, ratio });
  };

  // 快速提示词
  const quickPrompts = [
    'Modern villa with infinity pool',
    'Sustainable bamboo pavilion',
    'Brutalist concrete museum',
    'Japanese courtyard house',
  ];

  // 全屏瀑布流视图 - 带独立滚动区域
  if (showFullView) {
    return (
      <>
        <div className="flex flex-col h-full w-full bg-background overflow-hidden">
          {/* 头部区域 - 固定 */}
          <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : -20 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="shrink-0 backdrop-blur-xl bg-background/80 border-b border-border/40 z-10"
          >
            <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-4">
              {/* 标题 */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20"
                  >
                    <Sparkles className="h-4 w-4 text-primary" />
                  </motion.div>
                  <div>
                    <h1 className="text-lg font-semibold tracking-tight">
                      Template Gallery
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      {filteredTemplates.length} templates · {displayedTemplates.length} loaded
                    </p>
                  </div>
                </div>

                {/* 快速提示按钮 */}
                <div className="hidden lg:flex items-center gap-2 flex-wrap">
                  {quickPrompts.slice(0, 3).map((prompt, i) => (
                    <motion.button
                      key={prompt}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      onClick={() => applyQuickPrompt(prompt)}
                      className="px-3 py-1.5 text-xs rounded-full border border-border/50
                               hover:border-primary/50 hover:bg-primary/5
                               transition-all duration-300 text-muted-foreground hover:text-foreground"
                    >
                      {prompt}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* 分类筛选器 */}
              <CategoryFilter
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                isLoaded={isLoaded}
              />
            </div>
          </motion.header>

          {/* 瀑布流画廊 - 独立滚动区域 */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto overflow-x-hidden"
          >
            <main className="max-w-[1800px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedCategory}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 gap-3 sm:gap-4"
                >
                  {displayedTemplates.map((template, index) => (
                    <MasonryCard
                      key={template.id}
                      template={template}
                      index={index}
                      onClick={() => handleTemplateClick(template)}
                    />
                  ))}
                </motion.div>
              </AnimatePresence>

              {/* 加载更多触发器 */}
              <div ref={loadMoreRef} className="py-8 flex justify-center">
                {isLoadingMore && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading more...</span>
                  </div>
                )}
                {!hasMore && displayedTemplates.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    All {filteredTemplates.length} templates loaded
                  </p>
                )}
              </div>
            </main>
          </div>
        </div>

        {/* 模板详情模态框 */}
        <TemplateDetailModal
          template={selectedTemplate}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          onApply={handleApplyTemplate}
        />

        {/* 登录弹窗 */}
        <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
          <DialogContent className="sm:max-w-[400px] p-0">
            <DialogHeader className="hidden">
              <DialogTitle />
            </DialogHeader>
            <LoginForm callbackUrl={pathname} className="border-none" />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // 紧凑视图 - 用于已有项目的情况
  return (
    <div className="py-6">
      <div className="text-center mb-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 mb-4"
        >
          <Sparkles className="h-6 w-6 text-primary" />
        </motion.div>
        <h2 className="text-xl font-semibold mb-2">
          What would you like to create?
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose a template or type your description below
        </p>
      </div>

      {/* 紧凑瀑布流网格 */}
      <div className="columns-2 md:columns-3 lg:columns-4 gap-3 mb-6">
        {FEATURED_TEMPLATES.slice(0, 12).map((template, index) => (
          <CompactCard
            key={template.id}
            template={template}
            index={index}
            onClick={() => handleTemplateClick(template)}
          />
        ))}
      </div>

      {/* 快速提示 */}
      <div className="flex flex-wrap justify-center gap-2">
        {quickPrompts.map((prompt, i) => (
          <motion.button
            key={prompt}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            onClick={() => applyQuickPrompt(prompt)}
            className="px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-xs transition-colors"
          >
            {prompt}
          </motion.button>
        ))}
      </div>

      {/* 模板详情模态框 */}
      <TemplateDetailModal
        template={selectedTemplate}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onApply={handleApplyTemplate}
      />

      {/* 登录弹窗 */}
      <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <DialogContent className="sm:max-w-[400px] p-0">
          <DialogHeader className="hidden">
            <DialogTitle />
          </DialogHeader>
          <LoginForm callbackUrl="/ai/image" className="border-none" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 分类筛选器组件
interface CategoryFilterProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  isLoaded: boolean;
}

function CategoryFilter({
  selectedCategory,
  onCategoryChange,
  isLoaded,
}: CategoryFilterProps) {
  const categories = [
    { id: 'all', label: 'All', color: '#71717a' },
    ...TEMPLATE_CATEGORY_LIST.map((cat) => ({
      id: cat.id,
      label: cat.id.replace(/-/g, ' '),
      color: cat.color,
    })),
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
      {categories.map((category, index) => {
        const isSelected = selectedCategory === category.id;
        const Icon =
          category.id !== 'all'
            ? TEMPLATE_CATEGORIES[
                category.id as keyof typeof TEMPLATE_CATEGORIES
              ]?.icon
            : Layers;

        return (
          <motion.button
            key={category.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 10 }}
            transition={{ delay: 0.05 + index * 0.02, duration: 0.3 }}
            onClick={() => onCategoryChange(category.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap',
              'transition-all duration-300 border shrink-0',
              isSelected
                ? 'bg-foreground text-background border-foreground shadow-md'
                : 'bg-background border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
            )}
          >
            {Icon && (
              <Icon
                className="h-3 w-3"
                style={{ color: isSelected ? undefined : category.color }}
              />
            )}
            <span className="capitalize">{category.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

// 瀑布流卡片组件（全屏视图）
interface MasonryCardProps {
  template: ArchTemplate;
  index: number;
  onClick: () => void;
}

function MasonryCard({ template, index, onClick }: MasonryCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-20px' });
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const category = TEMPLATE_CATEGORIES[template.categoryId];
  const aspectClass = getAspectVariant(template.id);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: isInView ? 1 : 0,
        y: isInView ? 0 : 20,
      }}
      transition={{
        duration: 0.4,
        delay: Math.min(index * 0.02, 0.3),
        ease: [0.22, 1, 0.36, 1],
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      className="break-inside-avoid mb-3 sm:mb-4 cursor-pointer group"
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-xl sm:rounded-2xl',
          'bg-muted/30 border border-border/50',
          'transition-all duration-300',
          'hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5',
          aspectClass
        )}
      >
        {/* 图片 - 只在视图内加载 */}
        <div className="absolute inset-0">
          {isInView && (
            <Image
              src={template.previewImage}
              alt={template.id}
              fill
              className={cn(
                'object-cover transition-all duration-500',
                isHovered ? 'scale-105' : 'scale-100',
                imageLoaded ? 'opacity-100' : 'opacity-0'
              )}
              onLoad={() => setImageLoaded(true)}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 20vw"
              loading="lazy"
            />
          )}

          {/* 加载占位符 */}
          {(!imageLoaded || !isInView) && (
            <div className="absolute inset-0 bg-muted animate-pulse" />
          )}
        </div>

        {/* 渐变遮罩 */}
        <div
          className={cn(
            'absolute inset-0 transition-opacity duration-300',
            'bg-gradient-to-t from-black/70 via-black/10 to-transparent',
            isHovered ? 'opacity-100' : 'opacity-50'
          )}
        />

        {/* 分类标签 */}
        {category && (
          <div className="absolute top-2 left-2 z-10">
            <div
              className="px-2 py-0.5 rounded text-[10px] font-medium text-white backdrop-blur-sm"
              style={{ backgroundColor: `${category.color}CC` }}
            >
              {category.id.replace(/-/g, ' ')}
            </div>
          </div>
        )}

        {/* Featured 标记 */}
        {template.featured && (
          <div className="absolute top-2 right-2 z-10">
            <div className="p-1 rounded-full bg-amber-500/90 backdrop-blur-sm">
              <Sparkles className="h-2.5 w-2.5 text-white" />
            </div>
          </div>
        )}

        {/* 底部信息 */}
        <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 z-10">
          <h3 className="text-white font-medium text-xs mb-1 capitalize leading-tight line-clamp-2">
            {template.id.replace(/-/g, ' ')}
          </h3>

          {/* 悬停时显示的操作区 */}
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 5 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1 text-white/90 text-[10px]"
          >
            <ArrowRight className="h-3 w-3" />
            <span>Use template</span>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// 紧凑卡片组件（已有项目视图）
interface CompactCardProps {
  template: ArchTemplate;
  index: number;
  onClick: () => void;
}

function CompactCard({ template, index, onClick }: CompactCardProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-20px' });
  const [imageLoaded, setImageLoaded] = useState(false);

  const category = TEMPLATE_CATEGORIES[template.categoryId];
  const aspectClass = getAspectVariant(template.id);

  return (
    <motion.button
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: isInView ? 1 : 0,
        y: isInView ? 0 : 20,
      }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.22, 1, 0.36, 1],
      }}
      onClick={onClick}
      className="break-inside-avoid mb-3 w-full group text-left"
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-xl',
          'border border-border/50 hover:border-primary/50',
          'transition-all duration-300 hover:shadow-lg',
          aspectClass
        )}
      >
        {isInView && (
          <Image
            src={template.previewImage}
            alt={template.id}
            fill
            className={cn(
              'object-cover transition-transform duration-500 group-hover:scale-105',
              imageLoaded ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={() => setImageLoaded(true)}
            sizes="(max-width: 640px) 50vw, 33vw"
            loading="lazy"
          />
        )}

        {(!imageLoaded || !isInView) && (
          <div className="absolute inset-0 bg-muted animate-pulse" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* 分类色带 */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: category?.color }}
        />

        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <p className="text-white text-xs font-medium truncate capitalize">
            {template.id.replace(/-/g, ' ')}
          </p>
        </div>
      </div>
    </motion.button>
  );
}
