import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[1rem] text-sm font-medium tracking-[-0.01em] outline-none transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/15 active:translate-y-px',
  {
    variants: {
      variant: {
        default:
          'border border-primary/80 bg-primary text-primary-foreground shadow-[0_22px_45px_-24px_rgba(69,95,61,0.7)] hover:bg-primary/92 hover:shadow-[0_28px_54px_-24px_rgba(69,95,61,0.78)]',
        destructive:
          'border border-destructive/80 bg-destructive text-white shadow-[0_20px_40px_-24px_rgba(165,58,32,0.7)] hover:bg-destructive/92 focus-visible:ring-destructive/20',
        outline:
          'border border-border/80 bg-background/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-sm hover:border-primary/30 hover:bg-accent/60 hover:text-foreground dark:bg-background/40 dark:hover:bg-accent/65',
        secondary:
          'border border-transparent bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] hover:bg-secondary/82',
        ghost: 'hover:bg-accent/65 hover:text-accent-foreground',
        link: 'rounded-none px-0 text-primary shadow-none underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-9 gap-1.5 rounded-[0.875rem] px-3.5 text-xs has-[>svg]:px-3',
        lg: 'h-12 rounded-[1.1rem] px-6 text-[0.95rem] has-[>svg]:px-4.5',
        icon: 'size-10 rounded-[1rem]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
