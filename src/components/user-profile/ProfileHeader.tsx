'use client';

import type { UserProfile } from '@/actions/user-profile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Calendar, ImageIcon, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ProfileHeaderProps {
  profile: UserProfile;
  isOwner?: boolean;
}

export function ProfileHeader({ profile, isOwner }: ProfileHeaderProps) {
  const t = useTranslations('UserProfile');

  // Generate initials from name
  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Format date
  const joinDate = new Date(profile.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });

  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-8 border-b">
      {/* Avatar */}
      <Avatar className="h-24 w-24 sm:h-32 sm:w-32">
        <AvatarImage src={profile.image || undefined} alt={profile.name} />
        <AvatarFallback className="text-2xl sm:text-3xl bg-primary/10 text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* Info */}
      <div className="flex-1 text-center sm:text-left">
        <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold">{profile.name}</h1>
          {!profile.isProfilePublic && isOwner && (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" />
              {t('private')}
            </Badge>
          )}
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-muted-foreground mb-4 max-w-xl">{profile.bio}</p>
        )}

        {/* Stats */}
        <div className="flex items-center justify-center sm:justify-start gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>
              {t('joined')} {joinDate}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <ImageIcon className="h-4 w-4" />
            <span>
              {profile.publicGenerationsCount} {t('works')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileHeaderSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-8 border-b animate-pulse">
      {/* Avatar skeleton */}
      <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-full bg-muted" />

      {/* Info skeleton */}
      <div className="flex-1 text-center sm:text-left">
        <div className="h-8 w-48 bg-muted rounded mx-auto sm:mx-0 mb-4" />
        <div className="h-4 w-64 bg-muted rounded mx-auto sm:mx-0 mb-4" />
        <div className="flex items-center justify-center sm:justify-start gap-6">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}
