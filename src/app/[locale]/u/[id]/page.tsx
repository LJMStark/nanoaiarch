import {
  getUserProfile,
  getUserPublicGenerations,
} from '@/actions/user-profile';
import Container from '@/components/layout/container';
import {
  ProfileGallery,
  ProfileGallerySkeleton,
} from '@/components/user-profile/ProfileGallery';
import {
  ProfileHeader,
  ProfileHeaderSkeleton,
} from '@/components/user-profile/ProfileHeader';
import { Lock } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await getUserProfile(id);

  if (!result.success || !result.data) {
    return {
      title: 'User Not Found',
    };
  }

  return {
    title: `${result.data.name} | Arch AI`,
    description:
      result.data.bio ||
      `View ${result.data.name}'s AI-generated architectural visualizations`,
  };
}

export default async function UserProfilePage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations('UserProfile');

  // Fetch profile first (cached for 60s)
  const profileResult = await getUserProfile(id);

  // Handle errors: not found or private profile
  if (!profileResult.success || !profileResult.data) {
    if (profileResult.error === 'Profile is private') {
      return (
        <div className="min-h-screen bg-background">
          <Container className="py-12">
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Lock className="h-8 w-8 text-muted-foreground" />
              </div>
              <h1 className="text-2xl font-bold mb-2">{t('privateProfile')}</h1>
              <p className="text-muted-foreground">{t('privateProfileDesc')}</p>
            </div>
          </Container>
        </div>
      );
    }
    notFound();
  }

  const profile = profileResult.data;

  // Fetch generations with isProfilePublic to skip redundant DB query
  const generationsResult = await getUserPublicGenerations(id, {
    page: 1,
    pageSize: 12,
    isProfilePublic: profile.isProfilePublic,
  });

  return (
    <div className="min-h-screen bg-background">
      <Container className="py-12">
        <Suspense fallback={<ProfileHeaderSkeleton />}>
          <ProfileHeader profile={profile} isOwner={profileResult.isOwner} />
        </Suspense>

        <Suspense fallback={<ProfileGallerySkeleton />}>
          <ProfileGallery
            userId={id}
            initialGenerations={generationsResult.data}
            initialTotal={generationsResult.total}
            initialTotalPages={generationsResult.totalPages}
          />
        </Suspense>
      </Container>
    </div>
  );
}
