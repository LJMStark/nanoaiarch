import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2.5 py-1 text-[0.7rem] font-medium tracking-[0.08em] uppercase whitespace-nowrap [&>svg]:size-3 [&>svg]:pointer-events-none transition-[color,box-shadow,border-color,background-color] focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/18 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/15',
  {
    variants: {
      variant: {
        default:
          'border-primary/10 bg-primary/12 text-primary [a&]:hover:bg-primary/18',
        secondary:
          'border-border/60 bg-secondary/80 text-secondary-foreground [a&]:hover:bg-secondary',
        destructive:
          'border-destructive/20 bg-destructive/12 text-destructive [a&]:hover:bg-destructive/18',
        outline:
          'border-border/70 bg-background/50 text-foreground [a&]:hover:bg-accent/60 [a&]:hover:text-accent-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
