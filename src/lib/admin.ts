/**
 * Admin utilities for bypassing credit checks
 *
 * Set ADMIN_EMAILS environment variable with comma-separated email addresses
 * to grant admin privileges to specific users.
 *
 * Example: ADMIN_EMAILS="admin@example.com,dev@example.com"
 */

import { auth } from './auth';
import { headers } from 'next/headers';

// Parse admin emails from environment variable
function getAdminEmails(): string[] {
  const adminEmails = process.env.ADMIN_EMAILS || '';
  return adminEmails
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

/**
 * Check if an email address belongs to an admin
 * @param email - User email address
 * @returns true if the user is an admin
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmails = getAdminEmails();
  return adminEmails.includes(email.toLowerCase());
}

/**
 * Check if a user ID belongs to an admin
 * This requires a database lookup to get the user's email
 * @param userId - User ID
 * @returns true if the user is an admin
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  try {
    // Get user session to check email
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (session?.user?.id === userId) {
      return isAdminEmail(session.user.email);
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Check if the current session belongs to an admin
 * @returns true if the current user is an admin
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    return isAdminEmail(session?.user?.email);
  } catch {
    return false;
  }
}
