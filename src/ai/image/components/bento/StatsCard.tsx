'use client';

// Stats Card - Data statistics display card
// 数据统计卡片 - 紧凑三数字设计

import { cn } from '@/lib/utils';
import { BentoCard } from './BentoCard';
import { BENTO_PRESETS } from './BentoGrid';

interface StatsCardProps {
  templateCount?: number;
  styleCount?: number;
  ratioCount?: number;
  animationDelay?: number;
  className?: string;
}

/**
 * StatsCard - Statistics display card
 * 三列数字展示
 */
export function StatsCard({
  templateCount = 26,
  styleCount = 9,
  ratioCount = 5,
  animationDelay = 0.2,
  className,
}: StatsCardProps) {
  return (
    <BentoCard
      variant="glass"
      animate
      animationDelay={animationDelay}
      hoverGlow={false}
      hoverScale={false}
      className={cn(
        BENTO_PRESETS.stats,
        '!p-2 lg:!p-3',
        className
      )}
    >
      <div className="flex items-center justify-around w-full h-full">
        <Stat value={`${templateCount}+`} label="模板" color="text-primary" />
        <Stat value={String(styleCount)} label="风格" color="text-blue-500" />
        <Stat value={String(ratioCount)} label="比例" color="text-green-500" />
      </div>
    </BentoCard>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="text-center">
      <div className={cn('text-lg lg:text-xl font-bold', color)}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

// Compact stats row for mobile
export function StatsRow({
  templateCount = 26,
  styleCount = 9,
  ratioCount = 5,
  className,
}: StatsCardProps) {
  return (
    <div className={cn('flex items-center justify-center gap-6 py-3', className)}>
      <Stat value={`${templateCount}+`} label="模板" color="text-primary" />
      <Stat value={String(styleCount)} label="风格" color="text-blue-500" />
      <Stat value={String(ratioCount)} label="比例" color="text-green-500" />
    </div>
  );
}
