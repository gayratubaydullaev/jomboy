import { createSecretKey } from 'crypto';
import { jwtVerify } from 'jose';
import type { UserRole } from '@myshopuz/shared';

const ALLOWED_ROLES: UserRole[] = ['BUYER', 'SELLER', 'ADMIN', 'ADMIN_MODERATOR'];

export type VerifiedAccessToken = {
  userId: string;
  role: UserRole;
};

function getJwtSecretKey() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < 32) return null;
  return createSecretKey(Buffer.from(secret, 'utf8'));
}

export async function verifyAccessToken(token: string): Promise<VerifiedAccessToken | null> {
  const secret = getJwtSecretKey();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    const sub = payload.sub;
    const role = payload.role;
    if (typeof sub !== 'string' || !sub) return null;
    if (typeof role !== 'string' || !ALLOWED_ROLES.includes(role as UserRole)) return null;
    return { userId: sub, role: role as UserRole };
  } catch {
    return null;
  }
}
