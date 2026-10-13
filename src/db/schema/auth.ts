import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    googleId: text('google_id').unique(),
    email: text('email').unique(),
    name: text('name'),
    role: text('role').default('user'), // 'admin' | 'user'
    avatarUrl: text('avatar_url'),
    passwordHash: text('password_hash'), // For admin email/password login
});

export const sessions = sqliteTable('sessions', {
    id: text('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id),
    expiresAt: integer('expires_at').notNull(),
});
