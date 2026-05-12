import { cn } from '@/lib/utils';
import Image from 'next/image';

export function MkSaaSLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Arch AI 标志"
      title="Arch AI 标志"
      width={96}
      height={96}
      className={cn('size-8 rounded-md', className)}
    />
  );
}
