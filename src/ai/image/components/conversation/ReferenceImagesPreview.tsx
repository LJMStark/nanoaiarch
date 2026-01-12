import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ReferenceImagesPreviewProps {
  images: string[];
  onRemove: () => void;
}

export function ReferenceImagesPreview({
  images,
  onRemove,
}: ReferenceImagesPreviewProps) {
  const t = useTranslations('ArchPage');

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
      <div className="flex gap-1">
        {images.slice(0, 3).map((img, idx) => {
          // Type safety check
          const imageSrc =
            typeof img === 'string' ? `data:image/png;base64,${img}` : '';
          if (!imageSrc) {
            console.error('Invalid image data at index', idx, img);
            return null;
          }
          return (
            <div
              key={idx}
              className="relative h-10 w-10 rounded overflow-hidden"
            >
              <img
                src={imageSrc}
                alt={`Reference ${idx + 1}`}
                className="h-full w-full object-cover"
              />
            </div>
          );
        })}
        {images.length > 3 && (
          <div className="h-10 w-10 rounded bg-background/50 flex items-center justify-center text-xs text-muted-foreground">
            +{images.length - 3}
          </div>
        )}
      </div>
      <span className="text-sm text-muted-foreground flex-1">
        {t('controls.referenceCount', { count: images.length })}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
