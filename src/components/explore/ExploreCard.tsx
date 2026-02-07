'use client';

import type { PublicGeneration } from '@/actions/public-gallery';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Eye } from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';

interface ExploreCardProps {
  generation: PublicGeneration;
  index: number;
  onClick: () => void;
}

export function ExploreCard({ generation, index, onClick }: ExploreCardProps) {
  const initials = generation.user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group relative"
    >
      <button
        onClick={onClick}
        className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
      >
        <div className="relative aspect-square rounded-xl overflow-hidden bg-muted border hover:border-primary/50 transition-colors">
          {generation.imageUrl ? (
            <Image
              src={generation.imageUrl}
              alt={generation.prompt}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              No image
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Style badge */}
          {generation.style && (
            <Badge
              variant="secondary"
              className="absolute top-2 left-2 text-xs bg-black/50 text-white border-0"
            >
              {generation.style}
            </Badge>
          )}

          {/* View icon */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="h-8 w-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
              <Eye className="h-4 w-4 text-white" />
            </div>
          </div>

          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-white text-sm line-clamp-2 mb-2">
              {generation.prompt}
            </p>
            <Link
              href={`/u/${generation.user.id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={generation.user.image || undefined} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-white/80 text-xs truncate hover:text-white">
                {generation.user.name}
              </span>
            </Link>
          </div>
        </div>
      </button>
    </motion.div>
  );
}

interface ExploreCardSkeletonProps {
  index: number;
}

export function ExploreCardSkeleton({ index }: ExploreCardSkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="relative aspect-square rounded-xl overflow-hidden bg-muted animate-pulse"
    />
  );
}
