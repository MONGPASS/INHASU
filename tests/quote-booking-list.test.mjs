import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { build } from 'esbuild';

// 견적 예약 목록(React) 계산은 옛 도구 public/예약목록.html과 같아야 한다 — 옛 문서의 함수를 그대로 꺼내 같은 자료로 결과를 비교한다.
const out = await build({ entryPoints: ['src/components/admin/quoteBookingList.ts'], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const m = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

const html = readFileSync('public/예약목록.html', 'utf8');
const between = (start, end) => { const a = html.indexOf(start), b = html.indexOf(end, a); assert.ok(a > 0 && b > a, start); return html.slice(a, b + end.length); };
const fn = (name) => {
    const start = html.indexOf(`function ${name}(`); assert.ok(start > 0, name);
    let depth = 0, i = html.indexOf('{', start);
    for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}' && --depth === 0) break; }
    return html.slice(start, i + 1);
};
const legacy = vm.createContext({ crypto: globalThis.crypto });
vm.runInContext([
    between('const dateOnly = s =>', 'const progressOf = r => r.progress || progressAuto(r);'),
    between('let sortKey = "book", sortDir = 1;', 'month: r => dateOnly(r.depart),\n};'),
    'let RECORDS = [], filter = "전체", query = "", monthFilter = "전체";',
    fn('rows'), fn('rowNumbers'), fn('customerTimeline'),
    between('const deepClone = obj =>', 'return rec;\n};'),
    'const newToken = () => "fixed-token"; this.cloneRecord = cloneRecord;',
    'this.set = (o) => { RECORDS = o.RECORDS; filter = o.filter; query = o.query; monthFilter = o.monthFilter; sortKey = o.sortKey; sortDir = o.sortDir; };',
].join('\n'), legacy);
const plain = (value) => JSON.parse(JSON.stringify(value));

const day = (offset) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); };
const full = { guide: { name: '빌궁', phone: '+976 1' }, vehicle: { model: '스타렉스' }, lodges: [{ name: '테를지 캠프', grade: '고급' }] };
const RECORDS = [
    { id: 'a', name: '김하나', status: '예약확정', receivedAt: '2026-09-01T01:00:00Z', depart: day(3), return_: day(8), nights: 5, adult: 2, destination: '고비',
        booking: { confirmedAt: '2026-09-03', contract: { signedAt: '2026-09-04T03:00:00Z' }, assign: full, contractInfo: { depositStatus: '입금완료', balanceAmount: 900000, depositAmount: 300000 },
            travelers: [{ nameKo: '김하나', passportNo: 'M1234' }], flight: { inNo: 'OM302' } },
        activities: [{ type: 'contract_notification_skipped', at: '2026-09-03T02:00:00Z', detail: '계약서 안내 발송 건너뜀 (전화번호 없음)' }, { type: 'deposit_confirmed', at: '2026-09-03T01:00:00Z' }] },
    { id: 'b', name: '이둘', status: '진행중', receivedAt: '2026-10-05T01:00:00Z', depart: day(40), nights: 0, adult: 1, child: 1,
        decision: { status: 'accepted', acceptedAt: '2026-10-06T01:00:00Z', source: 'customer' },
        booking: { assign: { guide: { name: '바트' } }, checklist: { deposit: true }, contractInfo: { balanceAmount: 500000 } } },
    { id: 'c', name: '박셋', status: '예약확정', receivedAt: '2026-08-01T01:00:00Z', depart: '2025-07-01', return_: '2025-07-05', booking: { confirmedAt: '2025-06-01' } },
    { id: 'd', name: '최넷', status: '보류', receivedAt: '2026-10-10T01:00:00Z', booking: { assign: full, contractInfo: { balanceStatus: '현지현금전달' } }, progress: '예약취소' },
    { id: 'e', name: '문의만', status: '신규', receivedAt: '2026-11-01T01:00:00Z', depart: day(2) },
    { id: 'f', name: '정다섯', status: '예약확정', receivedAt: '2026-07-01T01:00:00Z', depart: day(0), return_: day(4), adult: 4, booking: { confirmedAt: '2026-07-02', assign: { vehicle: { model: '하이에이스' } } } },
];

test('거르기·검색·출발월·정렬 결과는 옛 예약목록 rows()와 같다', () => {
    const legacySort = { byBook: 'book', byDepart: 'depart', byReturn: 'return', byProgress: 'progress', byName: 'name', byPax: 'pax', byBalance: 'balance', byStatus: 'status' };
    const thisYear = day(0).slice(0, 4);
    const cases = [];
    for (const filter of m.BOOKING_FILTERS) for (const sort of Object.keys(legacySort)) for (const dir of [1, -1]) cases.push({ filter, query: '', month: '전체', sort, dir });
    cases.push({ filter: '전체', query: 'm1234', month: '전체', sort: 'byBook', dir: 1 }, { filter: '전체', query: '빌궁 고급', month: '전체', sort: 'byBook', dir: 1 },
        { filter: '전체', query: '입금완료', month: '전체', sort: 'byName', dir: -1 }, { filter: '전체', query: '당일', month: '전체', sort: 'byBook', dir: 1 },
        { filter: '전체', query: '', month: '미정', sort: 'byBook', dir: 1 }, { filter: '전체', query: '', month: '2025', sort: 'byBook', dir: 1 },
        { filter: '전체', query: '', month: day(3).slice(0, 7), sort: 'byBook', dir: 1 }, { filter: '전체', query: '', month: thisYear, sort: 'byDepart', dir: 1 });
    for (const c of cases) {
        legacy.set({ RECORDS, filter: c.filter, query: c.query, monthFilter: c.month, sortKey: legacySort[c.sort], sortDir: c.dir });
        assert.deepEqual(m.bookingRows(RECORDS, c).map(r => r.id), vm.runInContext('rows()', legacy).map(r => r.id), JSON.stringify(c));
    }
    legacy.set({ RECORDS, filter: '전체', query: '', monthFilter: '전체', sortKey: 'book', sortDir: 1 });
    assert.deepEqual(m.rowNumbers(RECORDS), plain(vm.runInContext('rowNumbers()', legacy)), '고정 번호');
    assert.deepEqual(m.bookingRows(RECORDS, { filter: '전체', query: '', month: '전체', sort: 'byBook', dir: 1 }).map(r => r.id), ['c', 'f', 'a', 'b', 'd'], '단순 문의(e)는 예약 목록에 없다');
});

test('진행 기록·복제는 옛 도구와 같다', () => {
    for (const r of RECORDS) assert.deepEqual(plain(m.customerTimeline(r)), plain(legacy.customerTimeline(r)), r.id);
    assert.equal(m.customerTimeline(RECORDS[0]).find(e => e.bad).label, '계약서 안내 미발송 · 설정/전화번호 확인 — 전화번호 없음');
    const now = new Date();
    const mine = m.cloneRecord({ ...RECORDS[0], quote: { quoteNo: 'Q-1' } }, 2, 777, 'fixed-token', now);
    const theirs = legacy.cloneRecord({ ...RECORDS[0], quote: { quoteNo: 'Q-1' } }, 2, 777);
    assert.equal(Math.abs(Date.parse(mine.receivedAt) - Date.parse(theirs.receivedAt)) < 5000, true);
    assert.deepEqual({ ...plain(mine), receivedAt: '' }, { ...plain(theirs), receivedAt: '' });
    assert.equal(mine.booking.contract, null, '서명은 비운다');
    assert.equal(mine.quote.quoteNo, 'Q-1-COPY');
    assert.match(m.newCustomerToken(), /^[0-9a-f]{32}$/);
    const groups = m.timelineGroups(m.customerTimeline(RECORDS[0]));
    assert.ok(groups.length >= 2 && groups.every(g => g.items.length));
});

test('요약·출발월 줄·칸 표시·결제 상태 바꾸기', () => {
    const today = day(0);
    assert.deepEqual(m.bookingSummary(RECORDS, today), { total: 5, unsigned: 4, incomplete: 3, soon: 2 });
    const bar = m.monthBar(RECORDS, '전체', '', today.slice(0, 4));
    assert.equal(bar.undated, 1);
    assert.equal(bar.cells.length, 12);
    assert.equal(m.monthBar(RECORDS, '1999-01', '').month, '전체', '없는 달을 고르면 전체로');
    assert.equal(m.monthBar(RECORDS, '2025', '').year, '2025');
    assert.equal(m.monthBar(RECORDS, '전체', '2025').nextYear > '2025', true);
    assert.equal(m.contractState(RECORDS[0]), '서명완료');
    assert.equal(m.contractState(RECORDS[1]), '서명대기');
    assert.equal(m.contractState(RECORDS[3]), '수락대기');
    assert.deepEqual(m.assignState(RECORDS[1]), { done: 1, total: 3, allOk: false, detail: '가이드 배정 · 차량·숙소 대기' });
    assert.equal(m.assignState(RECORDS[0]).detail, '가이드·차량·숙소 모두 배정');
    assert.equal(m.payStatus(RECORDS[1], 'depositStatus'), '입금완료', '예전 체크리스트 값');
    assert.equal(m.payStatus(RECORDS[3], 'balanceStatus'), '현지현금전달');
    assert.equal(m.money(1290000), '₩1,290,000');
    const next = m.withPaymentStatus({ contractInfo: { depositStatus: '미입금', depositAmount: 1 }, checklist: { contract: true }, assign: full }, 'balanceStatus', '현지현금전달');
    assert.deepEqual(next.contractInfo, { depositStatus: '미입금', depositAmount: 1, balanceStatus: '현지현금전달' });
    assert.deepEqual(next.checklist, { contract: true, balance: true });
    assert.deepEqual(next.assign, full, '다른 칸은 그대로');
    assert.equal(m.withPaymentStatus({}, 'depositStatus', '입금완료').checklist.deposit, true);
    assert.equal(m.guideSheetHref('a b'), '/가이드시트?adminPrint=1&print=1&id=a+b');
    assert.deepEqual(Object.keys(m.guideSheetPayload(RECORDS[0]).booking), ['days', 'travelers', 'flight', 'assign', 'checklist', 'contractInfo', 'contractPackageType', 'pickupLodge', 'travelerNote', 'notes']);
    const booking = readFileSync('public/booking.js', 'utf8');
    assert.match(booking, /booking: \{ days, travelers, flight, assign, checklist, contractInfo, contractPackageType, pickupLodge, travelerNote, notes \}/, '가이드 시트 자료 칸은 booking.js와 같다');
});

test('견적 예약 목록 메뉴는 React로 열리고, ?id=는 예전 처리·저장은 같은 API', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const own = app.indexOf('path="/admin/quote-desk/bookings"');
    assert.ok(own > 0 && own < app.indexOf('path="/admin/quote-desk/:tool?"'), '견적 도구 iframe보다 앞에서 잡는다');
    const page = readFileSync('src/pages/AdminQuoteBookings.tsx', 'utf8');
    assert.match(page, /if \(id\) return <Navigate replace to=\{quoteCustomerHref\(id, params\.has\('returnTo'\)/, '예전 ?id= 주소는 고객 통합 작업 화면으로 넘긴다');
    assert.match(page, /const fresh = await loadQuoteCustomerRequest\(id, token\.current\);\s+const booking = withPaymentStatus\(fresh\.booking, field, value\);/, '결제 상태는 최신 예약에 적용해 저장');
    assert.match(page, /body: JSON\.stringify\(\{ booking \}\)/, '옛 도구와 같은 PATCH { booking }');
    assert.match(page, /field === 'depositStatus' && value === '입금완료'[\s\S]{0,200}adminConfirm/, '처음 입금완료(고객 안내가 나갈 수 있음)는 확인 창');
    assert.match(page, /견적서가 있는 \$\{withQuote\}건은 새 견적 발행으로 기록되어/, '복제는 서버가 견적 안내를 보낼 수 있음을 확인 창에 알린다');
    assert.match(readFileSync('functions/api/requests.js', 'utf8'), /const quoteCreated = !!\(admin && d\.quote\);/, '서버 규칙이 바뀌면 위 안내도 고친다');
    assert.match(page, /method: 'DELETE'/);
    assert.match(page, /adminConfirm\(\{ title: '선택 예약 영구 삭제'[^)]*danger: true/);
    assert.match(page, /quoteCustomerHref\(String\(r\.id\), returnTo\)/);
    assert.match(readFileSync('src/lib/adminPagePreload.ts', 'utf8'), /'\/admin\/quote-desk\/bookings': 'bookings'/);
});
