'use client';

import { toggleProfilePublic } from '@/actions/user-profile';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { ExternalLink, Globe, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

interface ProfileVisibilityCardProps {
  className?: string;
  initialIsPublic?: boolean;
}

/**
 * Toggle profile public/private visibility
 */
export function ProfileVisibilityCard({
  className,
  initialIsPublic = true,
}: ProfileVisibilityCardProps) {
  const t = useTranslations('Dashboard.settings.profile');
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [isUpdating, setIsUpdating] = useState(false);
  const { data: session } = authClient.useSession();

  // Check if user exists
  const user = session?.user;
  if (!user) {
    return null;
  }

  const handleToggle = async (checked: boolean) => {
    setIsUpdating(true);

    try {
      const result = await toggleProfilePublic(checked);
      if (result.success) {
        setIsPublic(checked);
        toast.success(
          checked ? t('visibility.madePublic') : t('visibility.madePrivate')
        );
      } else {
        toast.error(t('visibility.fail'));
      }
    } catch (err) {
      toast.error(t('visibility.fail'));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card
      className={cn(
        'w-full overflow-hidden pt-6 pb-6 flex flex-col',
        className
      )}
    >
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {t('visibility.title')}
        </CardTitle>
        <CardDescription>{t('visibility.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isPublic ? (
              <Globe className="h-5 w-5 text-green-500" />
            ) : (
              <Lock className="h-5 w-5 text-muted-foreground" />
            )}
            <Label htmlFor="profile-visibility" className="cursor-pointer">
              {isPublic ? t('visibility.public') : t('visibility.private')}
            </Label>
          </div>
          <Switch
            id="profile-visibility"
            checked={isPublic}
            onCheckedChange={handleToggle}
            disabled={isUpdating}
          />
        </div>

        {/* Status description */}
        <p className="text-sm text-muted-foreground">
          {isPublic ? t('visibility.publicDesc') : t('visibility.privateDesc')}
        </p>

        {/* View profile link */}
        {isPublic && (
          <Link
            href={`/u/${user.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            {t('visibility.viewProfile')}
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
