import * as React from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input/85 flex h-11 w-full min-w-0 rounded-[1.15rem] border bg-background/70 px-4 py-2 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.48)] backdrop-blur-sm outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-background/35',
        'focus-visible:border-primary/50 focus-visible:ring-4 focus-visible:ring-ring/16',
        'aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/10',
        className
      )}
      {...props}
    />
  );
}

export { Input };
