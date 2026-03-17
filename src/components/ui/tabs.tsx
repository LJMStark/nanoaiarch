'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'inline-flex h-12 w-fit items-center justify-center rounded-full border border-border/70 bg-background/70 p-1 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-sm',
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'text-foreground inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-full border border-transparent px-4 py-2 text-sm font-medium tracking-[-0.01em] whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-200 focus-visible:ring-4 focus-visible:ring-ring/16 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary/10 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_18px_36px_-24px_rgba(69,95,61,0.72)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
        className
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
