import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export default function Container({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-8',
        className
      )}
    >
      {children}
    </div>
  );
}
