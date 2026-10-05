import 'server-only';
import { db } from '@partners/db';

export interface UserOption {
  id: string;
  name: string;
}

/** Everyone a partner or deal can be assigned to. */
export async function listActiveUsers(): Promise<UserOption[]> {
  return db.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

export async function listUsers() {
  return db.user.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
}
