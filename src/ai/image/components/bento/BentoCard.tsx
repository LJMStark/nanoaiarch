'use client';

// Base Bento Card component with variants
// Bento 卡片基础组件，支持多种变体

import { cn } from '@/lib/utils';
import { motion, type Variants } from 'motion/react';
import type { ReactNode, MouseEvent } from 'react';
import { forwardRef } from 'react';

// Card style variants
// 卡片样式变体
export type BentoCardVariant = 'default' | 'glass' | 'gradient' | 'outline' | 'solid';

interface BentoCardProps {
  children: ReactNode;
  className?: string;
  variant?: BentoCardVariant;
  // Allow any HTML button/div props
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
  // Animation control
  animate?: boolean;
  animationDelay?: number;
  // Hover effects
  hoverGlow?: boolean;
  hoverScale?: boolean;
  // Accessibility
  role?: string;
  tabIndex?: number;
  'aria-label'?: string;
}

// Animation variants for staggered entry
// 交错入场动画变体
const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      bounce: 0.3,
      duration: 0.8,
      delay: delay,
    },
  }),
};

// Variant styles mapping
// 变体样式映射
const variantStyles: Record<BentoCardVariant, string> = {
  default: cn(
    'bg-card/50 dark:bg-card/30',
    'border border-border/50 dark:border-border/30',
    'backdrop-blur-sm'
  ),
  glass: cn(
    'bg-white/5 dark:bg-white/[0.02]',
    'border border-white/10 dark:border-white/5',
    'backdrop-blur-xl'
  ),
  gradient: cn(
    'bg-gradient-to-br from-primary/10 via-primary/5 to-transparent',
    'border border-primary/20 dark:border-primary/10'
  ),
  outline: cn(
    'bg-transparent',
    'border-2 border-dashed border-border/50 dark:border-border/30'
  ),
  solid: cn(
    'bg-muted dark:bg-muted/50',
    'border border-border/30'
  ),
};

/**
 * BentoCard - Base card component for Bento grid layouts
 *
 * Features:
 * - Multiple style variants (glass, gradient, outline, etc.)
 * - Optional hover effects (glow, scale)
 * - Staggered entry animation
 * - Accessible click handling
 */
export const BentoCard = forwardRef<HTMLDivElement, BentoCardProps>(
  function BentoCard(
    {
      children,
      className,
      variant = 'default',
      onClick,
      animate = true,
      animationDelay = 0,
      hoverGlow = true,
      hoverScale = true,
      role,
      tabIndex,
      'aria-label': ariaLabel,
    },
    ref
  ) {
    const isInteractive = !!onClick;

    return (
      <motion.div
        ref={ref}
        variants={animate ? cardVariants : undefined}
        initial={animate ? 'hidden' : undefined}
        animate={animate ? 'visible' : undefined}
        custom={animationDelay}
        onClick={onClick}
        role={role || (isInteractive ? 'button' : undefined)}
        tabIndex={tabIndex ?? (isInteractive ? 0 : undefined)}
        aria-label={ariaLabel}
        className={cn(
          // Base styles
          'relative overflow-hidden rounded-2xl lg:rounded-3xl',
          'p-4 lg:p-5',
          // Variant styles
          variantStyles[variant],
          // Interactive styles
          isInteractive && [
            'cursor-pointer',
            'transition-all duration-300 ease-out',
            // Focus ring
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            // Hover scale
            hoverScale && 'hover:scale-[1.02] active:scale-[0.98]',
            // Hover glow
            hoverGlow && 'hover:shadow-lg hover:shadow-primary/10 dark:hover:shadow-primary/5',
            // Border brighten on hover
            'hover:border-primary/30 dark:hover:border-primary/20',
          ],
          className
        )}
      >
        {/* Content */}
        {children}

        {/* Subtle inner glow on hover for interactive cards */}
        {isInteractive && hoverGlow && (
          <div
            className={cn(
              'absolute inset-0 opacity-0 transition-opacity duration-300',
              'bg-gradient-to-br from-primary/5 via-transparent to-transparent',
              'pointer-events-none',
              'group-hover:opacity-100'
            )}
          />
        )}
      </motion.div>
    );
  }
);

// Card header component for consistent header styling
// 卡片标题组件
export function BentoCardHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between mb-3', className)}>
      {children}
    </div>
  );
}

// Card title component
// 卡片标题
export function BentoCardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn('font-semibold text-base lg:text-lg', className)}>
      {children}
    </h3>
  );
}

// Card description component
// 卡片描述
export function BentoCardDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn('text-sm text-muted-foreground line-clamp-2', className)}>
      {children}
    </p>
  );
}

// Card icon badge component
// 卡片图标徽章
export function BentoCardIcon({
  children,
  className,
  color,
}: {
  children: ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        'w-10 h-10 rounded-xl',
        'bg-primary/10 dark:bg-primary/5',
        className
      )}
      style={color ? { backgroundColor: `${color}20` } : undefined}
    >
      {children}
    </div>
  );
}
