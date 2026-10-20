/** Synthetic, real Google-linked Lucia identity. No OAuth/provider request occurs. */
export function customerIdentity(DB, { user = 'fixture-customer', resourceId, source = 'request', role = 'user', google = true } = {}) {
  DB.raw.exec(`CREATE TABLE IF NOT EXISTS users(
    id TEXT PRIMARY KEY,google_id TEXT,email TEXT,name TEXT,role TEXT,avatar_url TEXT,password_hash TEXT);
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER);
    CREATE TABLE IF NOT EXISTS customer_resource_links(
      source TEXT NOT NULL,resource_id TEXT NOT NULL,user_id TEXT NOT NULL,created_at TEXT NOT NULL,
      PRIMARY KEY(source,resource_id));`);
  DB.raw.prepare('INSERT OR REPLACE INTO users(id,google_id,email,name,role) VALUES(?,?,?,?,?)')
    .run(user, google ? `google-${user}` : null, `${user}@example.invalid`, '합성 고객', role);
  const session = `customer-session-${user}`;
  // A distant expiry avoids Lucia session renewal writes obscuring business-write assertions.
  DB.raw.prepare('INSERT OR REPLACE INTO sessions(id,user_id,expires_at) VALUES(?,?,?)')
    .run(session, user, Date.now() + 90 * 86_400_000);
  if (resourceId) DB.raw.prepare('INSERT OR REPLACE INTO customer_resource_links VALUES(?,?,?,?)')
    .run(source, resourceId, user, new Date().toISOString());
  return { cookie: `auth_session=${session}` };
}
