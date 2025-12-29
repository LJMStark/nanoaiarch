'use client';

import type { UserGeneration } from '@/actions/user-profile';
import { getUserPublicGenerations } from '@/actions/user-profile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Eye, ImageIcon, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useCallback, useState } from 'react';

interface ProfileGalleryProps {
  userId: string;
  initialGenerations: UserGeneration[];
  initialTotal: number;
  initialTotalPages: number;
}

export function ProfileGallery({
  userId,
  initialGenerations,
  initialTotal,
  initialTotalPages,
}: ProfileGalleryProps) {
  const t = useTranslations('UserProfile');
  const [generations, setGenerations] =
    useState<UserGeneration[]>(initialGenerations);
  const [page, setPage] = useState(1);
  const [totalPages] = useState(initialTotalPages);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<UserGeneration | null>(
    null
  );

  const loadMore = useCallback(async () => {
    if (loading || page >= totalPages) return;

    setLoading(true);
    try {
      const result = await getUserPublicGenerations(userId, {
        page: page + 1,
        pageSize: 12,
      });
      if (result.success) {
        setGenerations((prev) => [...prev, ...result.data]);
        setPage((p) => p + 1);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, page, totalPages, loading]);

  if (generations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <ImageIcon className="h-12 w-12 mb-4 opacity-50" />
        <p>{t('noWorks')}</p>
      </div>
    );
  }

  return (
    <div className="pt-8">
      {/* Gallery Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {generations.map((gen, index) => (
          <ProfileGalleryCard
            key={gen.id}
            generation={gen}
            index={index}
            onClick={() => setSelectedImage(gen)}
          />
        ))}
      </div>

      {/* Load More */}
      {page < totalPages && (
        <div className="flex justify-center mt-8">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loading}
            className="min-w-[140px]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('loading')}
              </>
            ) : (
              t('loadMore')
            )}
          </Button>
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <ImagePreviewModal
          generation={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
}

interface ProfileGalleryCardProps {
  generation: UserGeneration;
  index: number;
  onClick: () => void;
}

function ProfileGalleryCard({
  generation,
  index,
  onClick,
}: ProfileGalleryCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group relative"
    >
      <button
        type="button"
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
              <ImageIcon className="h-8 w-8" />
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
            <p className="text-white text-sm line-clamp-2">
              {generation.prompt}
            </p>
          </div>
        </div>
      </button>
    </motion.div>
  );
}

interface ImagePreviewModalProps {
  generation: UserGeneration;
  onClose: () => void;
}

function ImagePreviewModal({ generation, onClose }: ImagePreviewModalProps) {
  const t = useTranslations('UserProfile');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative max-w-4xl max-h-[90vh] m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {generation.imageUrl && (
          <Image
            src={generation.imageUrl}
            alt={generation.prompt}
            width={1024}
            height={1024}
            className="rounded-xl object-contain max-h-[80vh]"
          />
        )}

        {/* Info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent rounded-b-xl">
          <p className="text-white text-sm mb-2">{generation.prompt}</p>
          <div className="flex items-center gap-2 text-white/70 text-xs">
            {generation.style && (
              <Badge variant="secondary">{generation.style}</Badge>
            )}
            {generation.templateName && (
              <Badge
                variant="outline"
                className="text-white/70 border-white/30"
              >
                {generation.templateName}
              </Badge>
            )}
          </div>
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
        >
          ✕
        </button>
      </motion.div>
    </div>
  );
}

export function ProfileGallerySkeleton() {
  return (
    <div className="pt-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-xl bg-muted animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
