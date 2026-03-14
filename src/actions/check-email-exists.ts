'use server';

import { getDb } from '@/db';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function checkEmailExists(
  email: string
): Promise<{ exists: boolean }> {
  const db = await getDb();

  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email.toLowerCase().trim()))
    .limit(1);

  return { exists: !!existingUser };
}
