import { AspectRatioSelect } from '@/ai/image/components/AspectRatioSelect';
import {
  type ImageQuality,
  ImageQualitySelect,
} from '@/ai/image/components/ImageQualitySelect';
import type { AspectRatioId } from '@/ai/image/lib/arch-types';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface GenerationSettingsProps {
  imageQuality: ImageQuality;
  aspectRatio: AspectRatioId;
  onImageQualityChange: (quality: ImageQuality) => void;
  onAspectRatioChange: (ratio: AspectRatioId) => void;
}

export function GenerationSettings({
  imageQuality,
  aspectRatio,
  onImageQualityChange,
  onAspectRatioChange,
}: GenerationSettingsProps) {
  const t = useTranslations('ArchPage');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
          <Settings2 className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">{t('controls.quality')}</div>
            <ImageQualitySelect
              value={imageQuality}
              onChange={onImageQualityChange}
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">
              {t('controls.aspectRatio')}
            </div>
            <AspectRatioSelect
              value={aspectRatio}
              onChange={onAspectRatioChange}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
