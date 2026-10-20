import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { deflateSync } from 'node:zlib';
import { build } from 'esbuild';
import { Hono } from 'hono';
import { ensureSiteSchema } from '../functions/lib/siteSchema.ts';
import { productSignatureImage, productSignatureStatus, publicProductContract, validateProductSignature } from '../src/utils/productContractSignature.ts';

const crc32 = bytes => { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; };
const chunk = (name, bytes) => { const type = Buffer.from(name), length = Buffer.alloc(4), crc = Buffer.alloc(4); length.writeUInt32BE(bytes.length); crc.writeUInt32BE(crc32(Buffer.concat([type, bytes]))); return Buffer.concat([length, type, bytes, crc]); };
function signatureImage(width = 120, height = 60) {
    const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
    const scan = Buffer.alloc((width * 4 + 1) * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (Math.abs(y - x / 2) <= 2) scan[y * (width * 4 + 1) + 1 + x * 4 + 3] = 255;
    return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(scan)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}
const image = signatureImage();
const bundled = await build({ entryPoints: ['functions/api/documents.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const documents = (await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].contents).toString('base64'))).default;
const reservationBundle = await build({ entryPoints: ['functions/api/reservations.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const reservations = (await import('data:text/javascript;base64,' + Buffer.from(reservationBundle.outputFiles[0].contents).toString('base64'))).default;
async function fixture(t) {
    const raw = new DatabaseSync(':memory:'); t.after(() => raw.close());
    let beforeRun;
    const statement = (sql, args = []) => ({ bind: (...values) => statement(sql, values), first: async () => raw.prepare(sql).get(...args) || null,
        all: async () => ({ results: raw.prepare(sql).all(...args) }), raw: async () => raw.prepare(sql).all(...args).map(row => Object.values(row)), run: async () => { beforeRun?.(sql, args); return { meta: raw.prepare(sql).run(...args) }; },
        exec: () => /^\s*(SELECT|PRAGMA)/i.test(sql) ? { results: raw.prepare(sql).all(...args) } : { meta: raw.prepare(sql).run(...args) } });
    const DB = { prepare: sql => statement(sql), batch: async rows => rows.map(row => row.exec()) };
    await ensureSiteSchema(DB);
    raw.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,google_id TEXT,email TEXT,name TEXT,role TEXT,avatar_url TEXT,password_hash TEXT);
        CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER);
        INSERT INTO users(id,name,role) VALUES('admin','원본 확인 관리자','admin');
        INSERT INTO users(id,name,role,email,google_id) VALUES('member','예약 고객','user','fixture@example.invalid','google-member');`);
    raw.prepare('INSERT INTO sessions VALUES(?,?,?)').run('signature-admin', 'admin', Date.now() + 86400000);
    raw.prepare('INSERT INTO sessions VALUES(?,?,?)').run('signature-member', 'member', Date.now() + 86400000);
    raw.prepare('INSERT INTO products(id,name,included,excluded) VALUES(?,?,?,?)').run('tour-a', '서명 당시 상품', '["상품 포함"]', '["상품 불포함"]');
    raw.prepare(`INSERT INTO reservations(id,contract_data,document_content,product_id,product_name,start_date,end_date,total_price,deposit_amount,balance_amount,assigned_guide,daily_accommodations,status,travelers,customer_name,customer_phone,customer_email,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('signature-booking', JSON.stringify({ agreement: { agreed: true, name: '기존 성명 동의', agreedAt: '2026-10-01T00:00:00Z' }, vehicle: { type: '등록 차량', phone: 'PRIVATE-DRIVER' }, extra: '보존' }),
        JSON.stringify({ documentSettings: { contract: { intro: '서명 당시 원문', includedText: '고객별 포함' } } }), 'tour-a', '서명 당시 상품', '2026-10-25', '2026-10-27', 3000000, 900000, 2100000, '{"name":"등록 가이드"}', '[{"day":1,"accommodation":{"name":"등록 숙소"}}]', 'confirmed', 1, '예약 고객', '01012345678', 'fixture@example.invalid', '2026-10-01');
    raw.prepare('UPDATE reservations SET user_id=? WHERE id=?').run('member', 'signature-booking');
    const app = new Hono(); app.route('/documents', documents); app.route('/reservations', reservations);
    const request = async (method = 'GET', body, admin = false) => {
        if (body?.signature && body.signature.expectedRevision === undefined) body = { ...body, signature: { ...body.signature, expectedRevision: (await (await request()).json()).signatureRevision } };
        return app.request('/documents/contract/signature-booking' + (method === 'POST' ? '/customer' : ''), {
        method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), cookie: admin ? 'auth_session=signature-admin' : 'auth_session=signature-member', 'CF-Connecting-IP': 'PRIVATE-IP', 'User-Agent': 'PRIVATE-AGENT' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        }, { DB, ENVIRONMENT: 'production' });
    };
    const reservationRequest = (method = 'GET', body, admin = true, path = '/signature-booking') => app.request('/reservations' + path, { method, headers: { ...(admin ? { cookie: 'auth_session=signature-' + (typeof admin === 'string' ? admin : 'admin') } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }, { DB, ENVIRONMENT: 'production' });
    return { raw, request, reservationRequest, stored: () => JSON.parse(raw.prepare('SELECT contract_data FROM reservations').get().contract_data), beforeRun: callback => { beforeRun = callback; } };
}
const payload = () => ({ travelers: [{ name: '손서명 고객', passportName: 'LOCAL TRAVELER', birthdate: '1990-01-01', gender: '여성', phone: '01012345678' }], arrival: { date: '2026-10-25', time: '09:20', flight: 'LOCAL-IN' }, departure: { date: '2026-10-27', time: '20:10', flight: 'LOCAL-OUT' }, agreement: { agreed: true, name: '손서명 고객', agreedAt: '1900-01-01' }, signature: { agree: true, signerName: '손서명 고객', signImg: image, signedAt: '1900-01-01', snapshot: { forged: true } } });

test('손서명은 유효한 PNG·명시 동의·서명자를 요구하며 URL·위장 이미지·과대 입력을 거절한다', () => {
    assert.equal(productSignatureImage(image), image);
    assert.equal(validateProductSignature(payload().signature).ok, true);
    for (const signImg of ['', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,' + Buffer.from('not a PNG signature').toString('base64'), signatureImage(0, 1), signatureImage(4097, 1)]) assert.equal(validateProductSignature({ agree: true, signerName: '고객', signImg }).ok, false);
    assert.equal(validateProductSignature({ ...payload().signature, agree: 'true' }).ok, false);
    assert.equal(validateProductSignature({ ...payload().signature, signerName: ' ' }).ok, false);
    assert.equal(validateProductSignature({ ...payload().signature, signImg: 'A'.repeat(300001) }).status, 413);
});

test('기존 성명 동의는 서명으로 만들지 않고 실제 저장 원본과 공개 메타데이터를 분리한다', () => {
    assert.equal(productSignatureStatus({ agreement: { agreed: true, name: '기존 동의' } }), undefined);
    const original = { agreement: { agreed: true }, signature: { signedAt: '2026-10-20T01:00:00Z', signerName: '원본 서명자', termsVersion: 'version', signImg: image, snapshot: { private: 'PRIVATE-SNAPSHOT' }, ip: 'PRIVATE-IP', ua: 'PRIVATE-UA' }, vehicle: { type: '등록 차', phone: 'PRIVATE-DRIVER' } };
    const safe = publicProductContract(original);
    assert.equal(safe.signature.hasImage, true); assert.equal(safe.signature.signerName, '원본 서명자');
    assert.equal(productSignatureStatus(safe).hasImage, true); assert.equal(productSignatureStatus(safe, false).hasImage, false);
    assert.ok(!JSON.stringify(safe).includes('PRIVATE-')); assert.ok(!JSON.stringify(safe).includes('data:image'));
    assert.equal(original.signature.signImg, image); assert.equal(original.signature.snapshot.private, 'PRIVATE-SNAPSHOT');
    for (const legacy of [{ signedAt: original.signature.signedAt, signImg: image }, { contract: { ...original.signature } }]) {
        assert.equal(productSignatureStatus(legacy).hasImage, true); assert.ok(!JSON.stringify(publicProductContract(legacy)).includes('data:image'));
    }
});

test('실제 API는 서명 원본과 서버시각·현재 계약 snapshot을 보관하고 공개 응답에는 증빙 원본을 내보내지 않는다', async t => {
    const f = await fixture(t), response = await f.request('POST', payload());
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const returned = await response.text(); assert.ok(!returned.includes('data:image')); assert.ok(!returned.includes('PRIVATE-')); assert.ok(!returned.includes('snapshot'));
    const saved = f.stored(); assert.equal(saved.signature.signImg, image); assert.ok(Date.parse(saved.signature.signedAt) > Date.parse('2026-01-01'));
    assert.equal(saved.agreement.agreedAt, saved.signature.signedAt); assert.equal(saved.signature.ip, 'PRIVATE-IP');
    const snapshot = saved.signature.snapshot.document; assert.equal(snapshot.reservation.productName, '서명 당시 상품'); assert.equal(snapshot.contract.travelers[0].name, '손서명 고객');
    assert.equal(snapshot.contract.arrival.flight, 'LOCAL-IN'); assert.equal(snapshot.template.documentSettings.contract.intro, '서명 당시 원문'); assert.deepEqual(snapshot.productIncluded, ['고객별 포함']);
    assert.ok(snapshot.contractTerms.notices.length); assert.equal(saved.signature.snapshot.forged, undefined); assert.equal(saved.vehicle.phone, 'PRIVATE-DRIVER'); assert.equal(saved.extra, '보존');
    const publicGet = await f.request(); const publicText = await publicGet.text(); assert.ok(!publicText.includes('data:image')); assert.ok(!publicText.includes('PRIVATE-')); assert.ok(!publicText.includes('snapshot'));
    const admin = await f.request('GET', undefined, true); assert.equal(admin.status, 200); assert.equal((await admin.json()).contract.signature.signImg, image);
});

test('서명 재제출·위조 동의·서명자 불일치와 잘못된 여행자 자료는 원본을 변경하지 않는다', async t => {
    const f = await fixture(t), before = f.stored();
    for (const invalid of [{ ...payload(), signature: { ...payload().signature, signImg: 'data:image/png;base64,broken' } }, { ...payload(), agreement: { agreed: 'true', name: '손서명 고객' } }, { ...payload(), signature: { ...payload().signature, signerName: '다른 사람' } }, { ...payload(), travelers: [null] }, { ...payload(), arrival: { date: '2026-02-30', time: '25:70' } }]) {
        assert.equal((await f.request('POST', invalid)).status, 400); assert.deepEqual(f.stored(), before);
    }
    assert.equal((await f.request('POST', payload())).status, 200); const signed = f.stored().signature;
    assert.equal((await f.request('POST', payload())).status, 409); assert.deepEqual(f.stored().signature, signed);
    const update = payload(); delete update.signature; update.travelers[0].phone = '01098765432';
    assert.equal((await f.request('POST', update)).status, 200); assert.deepEqual(f.stored().signature, signed); assert.equal(f.stored().travelers[0].phone, '01098765432');
});

test('저장 직전 동시 서명·배정 변경은 CAS 충돌이며 후발 제출이 새로운 원본을 덮어쓰지 않는다', async t => {
    const f = await fixture(t); let injected = false;
    f.beforeRun(sql => { if (!injected && sql.startsWith('UPDATE reservations SET contract_data')) { injected = true; const concurrent = f.stored(); concurrent.signature = { signedAt: '2026-10-20T03:00:00Z', signImg: image, signerName: '먼저 서명한 고객' }; f.raw.prepare('UPDATE reservations SET contract_data=?').run(JSON.stringify(concurrent)); } });
    assert.equal((await f.request('POST', payload())).status, 409); assert.equal(f.stored().signature.signerName, '먼저 서명한 고객');
});

test('고객이 조회한 뒤 가격이나 고객별 약관이 바뀌면 예전 문서로 새 계약에 서명하지 않는다', async t => {
    const f = await fixture(t), reviewed = await (await f.request()).json(), before = f.stored();
    assert.match(reviewed.signatureRevision, /^[a-f0-9]{64}$/);
    f.raw.prepare('UPDATE reservations SET total_price=?,document_content=?').run(4500000, JSON.stringify({ documentSettings: { contract: { intro: '조회 후 바뀐 계약 원문' } } }));
    const oldPayload = payload(); oldPayload.signature.expectedRevision = reviewed.signatureRevision;
    const conflict = await f.request('POST', oldPayload); assert.equal(conflict.status, 409); assert.match((await conflict.json()).error, /계약 내용이 변경/); assert.deepEqual(f.stored(), before);
    const current = await (await f.request()).json(); assert.notEqual(current.signatureRevision, reviewed.signatureRevision);
    oldPayload.signature.expectedRevision = current.signatureRevision;
    assert.equal((await f.request('POST', oldPayload)).status, 200);
    assert.equal(f.stored().signature.snapshot.document.reservation.totalPrice, 4500000);
    assert.equal(f.stored().signature.snapshot.document.template.documentSettings.contract.intro, '조회 후 바뀐 계약 원문');
});

test('고객이 서명한 뒤 오래 열린 관리자 차량 저장은 최신 고객 정보와 서명 원본을 덮어쓰지 않는다', async t => {
    const f = await fixture(t), stale = f.stored();
    assert.equal((await f.request('POST', payload())).status, 200); const actual = f.stored();
    const response = await f.reservationRequest('PUT', { contractData: { ...stale, vehicle: { type: '새 차량', phone: 'PRIVATE-NEW-DRIVER' }, signature: { signedAt: '1900-01-01', signImg: 'forged' } } });
    assert.equal(response.status, 200);
    const saved = f.stored();
    for (const key of ['signature', 'travelers', 'arrival', 'departure', 'agreement', 'customerSubmittedAt']) assert.deepEqual(saved[key], actual[key], key);
    assert.equal(saved.vehicle.type, '새 차량'); assert.equal(saved.vehicle.phone, 'PRIVATE-NEW-DRIVER');
    const guest = await f.reservationRequest('GET', undefined, false); assert.equal(guest.status, 401);
    const exposed = await guest.text(); assert.ok(!exposed.includes('data:image')); assert.ok(!exposed.includes('PRIVATE-')); assert.ok(!exposed.includes('snapshot'));
    const ownList = await f.reservationRequest('GET', undefined, 'member', ''); assert.equal(ownList.status, 200);
    const owned = await ownList.text(); assert.ok(!owned.includes('data:image')); assert.ok(!owned.includes('PRIVATE-')); assert.ok(!owned.includes('snapshot')); assert.ok(owned.includes('"hasImage":true'));
});
