import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import vm from 'node:vm';
import { isQuoteBooking, quotePackageTier, summarizeQuoteBooking, readQuoteBookings } from '../functions/lib/quoteBookings.ts';

const booking = (extra = {}) => ({ id: 'quote-id', name: '견적 고객', status: '진행중', depart: '2026-10-20', return_: '2026-10-22',
    adult: '2', child: '1', receivedAt: '2026-10-13T00:00:00Z', quote: { pax: 3, price: { deposit: 100000, balances: [{ pax: 3, economy: 200000, full: 300000 }] } },
    booking: { contractInfo: { depositStatus: '미입금' } }, ...extra });

test('견적 문의와 실제 예약을 구분하고 확정 이전 예약 초안도 포함한다', () => {
    assert.equal(isQuoteBooking({ status: '신규', quote: {} }), false);
    assert.equal(isQuoteBooking({ status: '완료' }), false); // 문의 처리 완료만으로 예약이 되지 않는다
    assert.equal(isQuoteBooking({ decision: { status: 'accepted' } }), false);
    assert.equal(isQuoteBooking(booking()), true);
    assert.equal(isQuoteBooking({ status: '예약확정' }), true); // 오래된 확정 예약
});

test('견적의 1인 금액을 팀 금액으로 바꾸고 저장된 0원 잔금은 보존한다', () => {
    const row = summarizeQuoteBooking(booking());
    assert.deepEqual([row.totalAmount, row.deposit, row.balance, row.totalPeople], [900000, 300000, 600000, 3]);
    assert.equal(summarizeQuoteBooking(booking({ pkgTier: '풀패키지' })).totalAmount, 1200000);
    const saved = summarizeQuoteBooking(booking({ booking: { contractInfo: { totalAmount: 1234567, depositAmount: 234567, balanceAmount: 0 } } }));
    assert.deepEqual([saved.totalAmount, saved.deposit, saved.balance], [1234567, 234567, 0]);
});

test('패키지 판별은 잔금 티어와 같은 기준이고 등급을 고르지 않으면 추정하지 않는다', () => {
    const { quoteMoney } = new Function(`${fs.readFileSync(new URL('../public/booking.js', import.meta.url), 'utf8')}\nreturn { quoteMoney };`)();
    for (const extra of [{ pkgTier: '풀패키지' }, { pkgTier: '최고급' }, { gerStay: '고급 여행자 게르' }, { pkgTier: '실속', gerStay: '고급 여행자 게르' }]) {
        assert.equal(quotePackageTier(extra), 'full', JSON.stringify(extra));
        assert.equal(summarizeQuoteBooking(booking(extra)).totalAmount, 1200000, JSON.stringify(extra));
        assert.equal(quoteMoney(booking(extra)).totalAmount, 1200000, JSON.stringify(extra));
    }
    for (const extra of [{ pkgTier: '실속' }, { gerStay: '일반 여행자 게르' }]) {
        assert.equal(quotePackageTier(extra), 'value', JSON.stringify(extra));
        assert.equal(summarizeQuoteBooking(booking(extra)).totalAmount, 900000, JSON.stringify(extra));
        assert.equal(quoteMoney(booking(extra)).totalAmount, 900000, JSON.stringify(extra));
    }
    for (const extra of [{}, { gerStay: '상관없음' }, { pkgTier: 7 }, null]) assert.equal(quotePackageTier(extra), null);
});

test('계약 요청과 서명을 구분하고 입금 후 최종 확정 대기 상태를 표시한다', () => {
    const requested = summarizeQuoteBooking(booking({ booking: { contractInfo: { depositStatus: '입금완료' }, contractRequest: { status: 'requested' } } }));
    assert.equal(requested.status, 'reservation_requested');
    assert.equal(requested.quoteBooking.label, '계약 서명 대기');
    assert.equal(requested.quoteBooking.signed, false);
    const signed = summarizeQuoteBooking(booking({ booking: { contractInfo: { depositStatus: '입금완료' }, contract: { signedAt: '2026-10-13' } } }));
    assert.equal(signed.quoteBooking.label, '최종 확정 대기');
    assert.equal(signed.status, 'reservation_requested');
});

test('공개된 일정이 있어도 예약취소·보류·여행완료 상태가 우선한다', () => {
    for (const [extra, status] of [[{ progress: '예약취소' }, 'cancelled'], [{ status: '보류' }, 'on_hold'], [{ progress: '투어종료' }, 'completed']]) {
        assert.equal(summarizeQuoteBooking(booking({ status: '예약확정', booking: { publishStatus: 'published' }, ...extra })).status, status);
    }
    assert.equal(summarizeQuoteBooking(booking({ status: '예약확정' })).quoteBooking.published, true);
    assert.equal(summarizeQuoteBooking(booking({ status: '예약확정', booking: { publishStatus: 'draft' } })).quoteBooking.published, false);
});

test('잔금 수령 방법 선택을 입금 완료로 오인하지 않고 실제 입금 신고를 보존한다', () => {
    const row = summarizeQuoteBooking(booking({ booking: { contractInfo: { balanceStatus: '현지현금전달' }, depositReport: { status: 'reported', name: '입금자', reportedAt: '2026-10-13' } } }));
    assert.equal(row.balanceStatus, 'unpaid');
    assert.equal(row.depositReport.name, '입금자');
});

test('목록에는 고객 토큰·서명 원본·여권 정보를 보내지 않는다', () => {
    const row = summarizeQuoteBooking(booking({ token: 'PRIVATE-TOKEN', booking: { contract: { signedAt: '2026-10-13', signature: 'PRIVATE-SIGNATURE' },
        travelers: [{ passport: 'PRIVATE-PASSPORT' }], assign: { guide: { name: '가이드' }, lodges: [{ day: 2, name: '배정 숙소' }] } } }));
    assert.equal(row.assignedGuide.name, '가이드');
    assert.equal(row.dailyAccommodations[0].day, 2);
    assert.ok(!JSON.stringify(row).includes('PRIVATE-'));
});

test('통합 캘린더 충돌 검사에 실제 배정 차량 ID를 보존하고 모델명으로 ID를 추정하지 않는다', () => {
    const saved = summarizeQuoteBooking(booking({ booking: { assign: { vehicle: { id: 'registered-vehicle-a', model: '하이에이스', driverPhone: 'fixture-phone' } } } }));
    assert.deepEqual(saved.contractData.vehicle, { id: 'registered-vehicle-a', type: '하이에이스', phone: 'fixture-phone' });
    const unnamedId = summarizeQuoteBooking(booking({ booking: { assign: { vehicle: { model: '하이에이스' } } } }));
    assert.equal(unnamedId.contractData.vehicle.id, '');
});

test('requests의 최신 상태를 사용하고 깨진 한 건은 집계하며 원본 데이터는 수정하지 않는다', async () => {
    const raw = new DatabaseSync(':memory:');
    raw.exec(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
    const insert = raw.prepare('INSERT INTO requests (id,status,name,received_at,data) VALUES (?,?,?,?,?)');
    insert.run('quote-id', '보류', '최신 고객명', '2026-10-13', JSON.stringify(booking({ status: '예약확정' })));
    insert.run('inquiry', '신규', '문의 고객', '2026-10-12', '{}');
    insert.run('broken', '예약확정', '깨진 고객', '2026-10-11', '{');
    const before = raw.prepare('SELECT * FROM requests ORDER BY id').all();
    try {
        const result = await readQuoteBookings({ prepare: sql => ({ all: async () => ({ results: raw.prepare(sql).all() }) }) });
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].id, 'quote-id');
        assert.equal(result.items[0].status, 'on_hold');
        assert.equal(result.items[0].customerName, '최신 고객명');
        assert.equal(result.skipped, 1);
        assert.deepEqual(raw.prepare('SELECT * FROM requests ORDER BY id').all(), before);
    } finally { raw.close(); }
});

test('문의 본문은 DB에서 제외하면서 상태 우선순위·오래된 확정·중복 JSON 키와 누락 집계를 보존한다', async () => {
    const raw = new DatabaseSync(':memory:');
    raw.exec(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
    const insert = raw.prepare('INSERT INTO requests (id,status,received_at,data) VALUES (?,?,?,?)');
    const fixtures = [
        ['draft', '진행중', '{"booking":{}}'],
        ['old-confirmed', '예약확정', '{}'],
        ['null-data-confirmed', '예약확정', null],
        ['empty-data-confirmed', '예약확정', ''],
        ['json-status', null, '{"status":"예약확정"}'],
        ['empty-row-status', '', '{"status":"예약확정"}'],
        ['row-wins', '보류', '{"status":"예약확정"}'],
        ['cancelled-draft', '예약취소', '{"booking":{}}'],
        ['signed-draft', '진행중', '{"booking":{"contract":{"signedAt":"2026-10-13"}}}'],
        ['duplicate-booking-last-object', '신규', '{"booking":null,"booking":{}}'],
        ['duplicate-booking-last-null', '신규', '{"booking":{},"booking":null}'],
        ['duplicate-status-last-confirmed', '', '{"status":"신규","status":"예약확정"}'],
        ['duplicate-status-last-new', '', '{"status":"예약확정","status":"신규"}'],
        ['not-booked-array', '신규', '{"booking":[]}'],
        ['broken', '신규', '{'], ['whitespace', '신규', ' '],
        ['array', '예약확정', '[]'], ['primitive-null', '예약확정', 'null'],
        ['primitive-number', '신규', '0'], ['primitive-bool', '신규', 'true'],
        ['primitive-text', '신규', '"text"'],
        ['large-inquiry', '신규', JSON.stringify({ quote: { days: [{ text: '문의 일정'.repeat(10000) }] } })],
    ];
    fixtures.forEach(([id, status, data], index) => insert.run(id, status, `2026-10-${String(index + 1).padStart(2, '0')}`, data));
    const before = raw.prepare('SELECT * FROM requests ORDER BY received_at DESC').all();
    const expected = { items: [], skipped: 0 };
    // Reference the original full-table read semantics, independently of the SQL
    // optimization, including malformed/non-object records and empty data.
    for (const row of before) {
        try {
            const data = JSON.parse(row.data || '{}');
            if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
            const rec = { ...data, id: row.id, status: row.status || data.status,
                name: row.name ?? data.name, phone: row.phone ?? data.phone, destination: row.destination ?? data.destination,
                receivedAt: row.received_at || data.receivedAt };
            if (isQuoteBooking(rec)) expected.items.push(summarizeQuoteBooking(rec));
        } catch { expected.skipped++; }
    }
    let transferred = [];
    try {
        const actual = await readQuoteBookings({ prepare: sql => ({ all: async () => {
            transferred = raw.prepare(sql).all(); return { results: transferred };
        } }) });
        assert.deepEqual(actual, expected);
        assert.equal(actual.skipped, 7);
        assert.ok(actual.items.find(row => row.id === 'signed-draft').quoteBooking.signed);
        assert.ok(!transferred.some(row => ['row-wins', 'not-booked-array', 'large-inquiry'].includes(row.id)));
        assert.ok(transferred.length < before.length, 'ordinary inquiry documents must not cross the DB boundary');
        assert.deepEqual(raw.prepare('SELECT * FROM requests ORDER BY received_at DESC').all(), before);
    } finally { raw.close(); }
});

test('ID로 견적 예약을 열 때 실패하거나 다른 고객 응답이면 이전 고객을 열지 않는다', async () => {
    const html = fs.readFileSync(new URL('../public/예약관리.html', import.meta.url), 'utf8');
    const bootstrap = html.slice(html.indexOf('async function openInitialBooking()'), html.indexOf('openInitialBooking();'));
    for (const [response, opens] of [[{ ok: true, item: { id: 'chosen' } }, 1], [{ ok: false }, 0], [{ ok: true, item: { id: 'other' } }, 0]]) {
        const main = { innerHTML: '' };
        const context = vm.createContext({ PRE: { id: 'stale' }, bookingId: 'chosen', ADMIN_TOKEN: 'local',
            $: () => main, esc: String, init: () => { context.opened = (context.opened || 0) + 1; },
            window: { addEventListener() {} }, fetch: async () => ({ ok: response.ok, json: async () => response }), encodeURIComponent });
        vm.runInContext(bootstrap, context);
        await vm.runInContext('openInitialBooking()', context);
        assert.equal(context.opened || 0, opens);
        assert.equal(context.PRE?.id, opens ? 'chosen' : undefined);
    }
});
