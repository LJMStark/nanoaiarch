import { ProfileVisibilityCard } from '@/components/settings/profile/profile-visibility-card';
import { UpdateAvatarCard } from '@/components/settings/profile/update-avatar-card';
import { UpdateBioCard } from '@/components/settings/profile/update-bio-card';
import { UpdateNameCard } from '@/components/settings/profile/update-name-card';
import { getDb } from '@/db';
import { user } from '@/db/schema';
import { auth } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';

async function getUserProfileData() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  const db = await getDb();
  const result = await db
    .select({
      bio: user.bio,
      isProfilePublic: user.isProfilePublic,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  return result[0] || null;
}

export default async function ProfilePage() {
  const profileData = await getUserProfileData();

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <UpdateNameCard />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <UpdateAvatarCard />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <UpdateBioCard initialBio={profileData?.bio} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <ProfileVisibilityCard
          initialIsPublic={profileData?.isProfilePublic ?? true}
        />
      </div>
    </div>
  );
}
