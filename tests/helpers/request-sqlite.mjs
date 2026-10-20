import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

/** Actual SQLite for the request row plus the delivery table created by production SQL. */
export function requestSQLite(t, record, options = {}) {
  const raw = new DatabaseSync(':memory:');
  t.after(() => raw.close());
  raw.exec(fs.readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8'));
  const id = record?.id || 'req-1';
  if (!options.skipInsert) raw.prepare('INSERT INTO requests (id,name,phone,destination,status,memo,data,token) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, record.name || '', record.phone || '', record.destination || '', record.status || '신규', record.memo || '', JSON.stringify(record), record.token || '');
  const writes = [];
  function statement(sql, values = []) {
    const assertAvailable = () => {
      if (/\badmin_delivery_attempts\b/i.test(sql) &&
          (options.failLedger === true || (options.failLedger === 'claim' && /^\s*INSERT\b/i.test(sql)))) {
        throw new Error('Synthetic delivery ledger unavailable');
      }
    };
    return {
      bind: (...bound) => statement(sql, bound),
      async first() { assertAvailable(); return raw.prepare(sql).get(...values) ?? null; },
      async all() { assertAvailable(); return { results: raw.prepare(sql).all(...values) }; },
      async run() {
        assertAvailable();
        const result = raw.prepare(sql).run(...values);
        writes.push({ sql, values: [...values] });
        return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
      },
    };
  }
  return {
    raw,
    prepare: sql => statement(sql),
    get record() { return JSON.parse(raw.prepare('SELECT data FROM requests WHERE id=?').get(id).data); },
    get records() { return raw.prepare('SELECT data FROM requests ORDER BY received_at,id').all().map(row => JSON.parse(row.data)); },
    get deliveries() {
      if (!raw.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='admin_delivery_attempts'").get()) return [];
      return raw.prepare('SELECT * FROM admin_delivery_attempts ORDER BY created_at,id').all().map(row => ({ ...row }));
    },
    get requestWrites() { return writes.filter(entry => /^\s*UPDATE\s+requests\b/i.test(entry.sql)); },
  };
}
