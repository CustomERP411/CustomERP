import type { User } from '../types/auth';

/**
 * True only when the server marked the user as admin. Uses strict boolean check
 * so string/number values from bad JSON cannot grant access (e.g. is_admin: "false").
 */
export function isUserAdmin(user: User | null | undefined): boolean {
  return user?.is_admin === true;
}
