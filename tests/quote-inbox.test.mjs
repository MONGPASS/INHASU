import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { build } from 'esbuild';

// 견적 문의 목록(React) 계산은 옛 도구 public/견적관리.html의 규칙과 같아야 한다 — 옛 문서의 함수를 그대로 꺼내 결과를 비교한다.
const out = await build({ entryPoints: ['src/components/admin/quoteInbox.ts'], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const m = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

const legacyHtml = readFileSync('public/견적관리.html', 'utf8');
const legacyFn = (name) => {
    const start = legacyHtml.indexOf(`function ${name}(`);
    assert.ok(start > 0, name);
    let depth = 0, i = legacyHtml.indexOf('{', start);
    for (; i < legacyHtml.length; i++) { if (legacyHtml[i] === '{') depth++; else if (legacyHtml[i] === '}' && --depth === 0) break; }
    return legacyHtml.slice(start, i + 1);
};
const legacy = vm.createContext({});
vm.runInContext(`${legacyFn('nextAction')}\n${legacyFn('visibleRows')}\n${legacyFn('dDay')}\nvar RECORDS = [], filterStatus = null, searchText = '', sortKey = 'receivedAt', sortDir = -1;`, legacy);
const plain = (value) => JSON.parse(JSON.stringify(value));

const booking = (extra = {}) => ({ contractInfo: {}, ...extra });
const RECORDS = [
    { id: 1, name: '김하나', status: '신규', receivedAt: '2026-11-24T01:00:00Z', depart: '2026-11-28', phone: '010-1', request: '홉스골 가고 싶어요' },
    { id: 2, name: '이둘', status: '진행중', receivedAt: '2026-11-20T01:00:00Z', depart: '2026-12-10', decision: { status: 'accepted' } },
    { id: 3, name: '박셋', status: '진행중', receivedAt: '2026-11-10T01:00:00Z', booking: booking() },
    { id: 4, name: '최넷', status: '진행중', receivedAt: '2026-11-11T01:00:00Z', booking: booking({ depositRequest: { status: 'requested' }, depositReport: { status: 'reported', name: '최넷' } }) },
    { id: 5, name: '정다섯', status: '진행중', receivedAt: '2026-10-01T01:00:00Z', booking: booking({ depositRequest: { status: 'requested' } }), memo: '테를지 추가' },
    { id: 6, name: '강여섯', status: '진행중', receivedAt: '2026-11-01T01:00:00Z', booking: booking({ contractInfo: { depositStatus: '입금완료' } }) },
    { id: 7, name: '조일곱', status: '진행중', receivedAt: '2026-11-02T01:00:00Z', booking: booking({ contractInfo: { depositStatus: '입금완료' }, contractRequest: { status: 'requested' } }) },
    { id: 8, name: '윤여덟', status: '진행중', receivedAt: '2026-11-03T01:00:00Z', booking: booking({ contractInfo: { depositStatus: '입금완료' }, contract: { signedAt: '2026-11-05' } }) },
    { id: 9, name: '장아홉', status: '예약확정', receivedAt: '2026-11-04T01:00:00Z', booking: booking({ contractInfo: { depositStatus: '입금완료' }, contract: { signedAt: '2026-11-05' } }) },
    { id: 10, name: '임열', status: '예약확정', receivedAt: '2026-11-05T01:00:00Z', booking: booking({ contractInfo: { depositStatus: '입금완료' }, contract: { signedAt: '2026-11-05' }, publishStatus: 'published' }) },
    { id: 11, name: '한열하나', status: '완료', receivedAt: '2026-11-06T01:00:00Z', email: 'A@example.com' },
    { id: 12, status: '보류', receivedAt: 'bad', destination: '고비' },
];

test('다음 할 일은 옛 견적관리.html nextAction과 같다', () => {
    for (const record of RECORDS) assert.deepEqual(plain(m.nextAction(record)), plain(legacy.nextAction(record)), `id ${record.id}`);
    assert.deepEqual(RECORDS.map(r => m.nextAction(r)?.label ?? null), [null, '예약 진행 요청', '예약금 안내 필요', '입금 신고 확인', '예약금 입금 대기', '계약서 요청 필요',
        '계약서 서명 대기', '예약 확정 필요', '일정표 공개 준비', null, null, null]);
    assert.equal(m.actionTone('입금 신고 확인'), 'urgent');
    assert.equal(m.actionTone('계약서 서명 대기'), 'waiting');
    assert.equal(m.actionTone('일정표 공개 준비'), 'next');
});

test('검색·상태·정렬 결과는 옛 visibleRows와 같다', () => {
    const cases = [
        [null, '', 'receivedAt', -1, { filter: 'all', search: '', sort: 'receivedDesc' }],
        ['진행중', '', 'receivedAt', 1, { filter: '진행중', search: '', sort: 'receivedAsc' }],
        [null, '테를지', 'receivedAt', -1, { filter: 'all', search: '테를지', sort: 'receivedDesc' }],
        [null, 'a@example', 'name', 1, { filter: 'all', search: 'A@example', sort: 'nameAsc' }],
        [null, '', 'depart', 1, { filter: 'all', search: '', sort: 'departAsc' }],
        [null, '', 'depart', -1, { filter: 'all', search: '', sort: 'departDesc' }],
        ['보류', '고비', 'receivedAt', -1, { filter: '보류', search: '고비', sort: 'receivedDesc' }],
    ];
    for (const [status, search, key, dir, options] of cases) {
        Object.assign(legacy, { RECORDS, filterStatus: status, searchText: search.toLowerCase(), sortKey: key, sortDir: dir });
        vm.runInContext('RECORDS = this.RECORDS; filterStatus = this.filterStatus; searchText = this.searchText; sortKey = this.sortKey; sortDir = this.sortDir;', legacy);
        assert.deepEqual(m.visibleInquiries(RECORDS, options).map(r => r.id), vm.runInContext('visibleRows()', legacy).map(r => r.id), JSON.stringify(options));
    }
    assert.deepEqual(m.visibleInquiries(RECORDS, { filter: 'action', search: '', sort: 'receivedAsc' }).map(r => r.id), [5, 6, 7, 8, 9, 3, 4, 2], '할 일 있음 필터(새로 더함)');
});

test('요약 숫자·출발 임박·새 문의 알림', () => {
    const now = new Date(2026, 10, 24, 15);
    const summary = m.inboxSummary(RECORDS, now);
    assert.equal(summary.total, 12);
    assert.deepEqual(summary.byStatus, { 신규: 1, 진행중: 7, 예약확정: 2, 완료: 1, 보류: 1 });
    assert.equal(summary.actions.length, 8);
    assert.equal(summary.doneThisMonth, 1);
    assert.equal(m.dDay(RECORDS[0], now), 4);
    assert.ok(m.isUrgent(RECORDS[0], now), '출발 7일 안의 신규 문의');
    assert.ok(!m.isUrgent(RECORDS[1], now), '16일 뒤 출발');
    assert.equal(m.dDay({ depart: 'x' }, now), null);
    assert.equal(m.nightText({ nights: 3 }), '3박 4일');
    assert.equal(m.budgetText({ budget: '1인 150만원' }), '150만원');
    assert.equal(m.requestSnippet({ request: '가'.repeat(30) }), '가'.repeat(26) + '…');

    assert.equal(m.arrivalMessage(m.inboxArrivals(null, RECORDS)), '', '처음 불러올 때는 알리지 않는다');
    const seen = m.inboxSeen(RECORDS.slice(1));
    assert.equal(m.arrivalMessage(m.inboxArrivals(seen, RECORDS)), '새 견적 문의 1건 도착 — 김하나님');
    const moved = RECORDS.map(r => r.id === 5 ? { ...r, booking: { ...r.booking, depositReport: { status: 'reported', name: '정' } } } : r);
    assert.equal(m.arrivalMessage(m.inboxArrivals(m.inboxSeen(RECORDS), moved)), '정다섯님 · 입금 신고 확인');
    assert.throws(() => m.readInquiryList({ ok: false }));
    assert.deepEqual(m.readInquiryList({ ok: true, items: [{ id: 1 }, null, [], { name: 'x' }] }), [{ id: 1 }]);
});

test('견적 문의 메뉴는 React 목록으로 열리고, 고객 한 명 주소는 예전 처리를 쓴다', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const own = app.indexOf('path="/admin/quote-desk/inbox"');
    assert.ok(own > 0 && own < app.indexOf('path="/admin/quote-desk/:tool?"'), '견적 도구 iframe보다 앞에서 잡는다');
    assert.ok(app.indexOf('path="/admin/quote-desk"') > 0, '도구 이름 없는 주소도 견적 문의로');
    const page = readFileSync('src/pages/AdminQuoteInbox.tsx', 'utf8');
    assert.match(page, /params\.get\('id'\) \|\| params\.get\('qe'\)\) return <AdminQuoteDesk tool="inbox" \/>/, '?id=(고객 화면으로)·?qe=(휴대폰 편집)는 AdminQuoteDesk');
    assert.match(page, /fetch\('\/api\/requests', \{ headers: \{ 'x-admin-token': token\.current \}, cache: 'no-store' \}\)/, '같은 자료를 관리자 값으로 읽는다');
    assert.match(page, /quoteCustomerHref\(String\(record\.id\), returnTo\)/, '줄을 누르면 고객 통합 작업 화면(목록 상태를 returnTo로)');
    assert.doesNotMatch(page, /method: '(?:PATCH|DELETE|PUT|POST)'/, '목록 화면은 읽기만 한다');
    const desk = readFileSync('src/pages/AdminQuoteDesk.tsx', 'utf8');
    assert.match(desk, /const toolParam = toolProp \?\? routeParams\.tool/);
    assert.match(desk, /\/견적관리\?id=\$\{encodeURIComponent\(id\)\}&m=0&workspace=1/, '고객 화면 안의 문의 상세는 옛 문서 그대로');
    assert.match(readFileSync('src/lib/adminPagePreload.ts', 'utf8'), /'\/admin\/quote-desk\/inbox': 'inbox'/);
});
