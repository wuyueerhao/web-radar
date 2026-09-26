import { and, eq, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Variables } from '../../shared/types';
type User = NonNullable<Variables['user']>;
export const creatorFilter = (user: User) => user.teamRead ? undefined : user.actorId || user.id;
export function actorScope(table: {userId: SQLiteColumn;createdBy: SQLiteColumn}, user: User): SQL {
  return and(eq(table.userId,user.id),user.teamRead?undefined:eq(table.createdBy,user.actorId||user.id))!;
}
