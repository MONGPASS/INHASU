import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { build } from 'esbuild';

// React 견적서 만들기의 견적 문서·초안 규칙은 옛 public/견적만들기.html·quote-editor-state.js와 같아야 한다(고객 화면이 같은 문서를 읽는다).
const load = async (entry) => {
    const out = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
};
const m = await load('src/components/admin/quoteBuilder.ts');
const d = await load('src/components/admin/quoteDraftStore.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));

const html = readFileSync('public/견적만들기.html', 'utf8');
const fn = (name) => {
    const start = html.indexOf(`function ${name}(`); assert.ok(start > 0, name);
    let depth = 0, i = html.indexOf(') {', start) + 2;
    for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}' && --depth === 0) break; }
    return html.slice(start, i + 1);
};
const line = (start) => { const a = html.indexOf(start); assert.ok(a > 0, start); return html.slice(a, html.indexOf('\n', a)); };

const dataCtx = vm.createContext({ window: {} });
vm.runInContext(readFileSync('public/data.js', 'utf8'), dataCtx);
const BASE = dataCtx.window.QUOTE;
const COURSES = {
    '고비 5일': { destination: '고비', nights: '4박 5일', vehicle: '스타렉스', intensity: 4, highlights: ['욜링암', '홍고린엘스'],
        days: [{ d: 1, dest: '울란바토르', move: '', dist: '', items: ['*도착'], stay: { name: '호텔', tags: [] }, meals: ['', '', '호텔식'] }],
        price: { deposit: 100000, balances: [{ pax: 4, economy: 900000, full: 1100000 }, { pax: 6, economy: 800000, full: 1000000 }], options: [{ label: '게르 업그레이드', calc: '50,000원*1박' }] } },
    '중앙 몽골': { destination: '중앙 몽골', nights: '3박 4일', base: 700000, highlights: ['테를지'], days: [] },
    '홉스골 7일': { destination: '홉스골', nights: '6박 7일', days: [{}, {}, {}, {}, {}, {}, {}] },
};
const SPOTS = { 욜링암: { nameMn: 'Ёлын ам', desc: '협곡', img: '/y.webp', subImgs: ['/a', '', '', ''] }, 홍고린엘스: { desc: '모래' }, 테를지: { img: '/t.webp' } };

const legacy = vm.createContext({ structuredClone, console });
vm.runInContext([
    'var BASE = this.BASE, ST, REQ_PROFILE = {}, REQ_SPOTS = [], QUOTE_RESTORE = null; var COURSES = this.COURSES, SPOTS = this.SPOTS, QNO = "";',
    'const $ = id => ({ value: id === "f_quoteNo" ? QNO : "" }); const document = { querySelectorAll: () => [] };',
    'const getCourses = () => COURSES, getSpots = () => SPOTS; const fillForm = () => {}, renderAll = () => {}, toast = () => {};',
    html.slice(html.indexOf('const nights = () => {'), html.indexOf('const won = n =>')),
    line('const balEco = b =>'), line('const balFull = b =>'),
    fn('autoQuoteNo'), fn('loadCourse'), fn('matchCourse'),
    line('const fmtDot = d =>'), line('const fmtKor = d =>'), line('const korDate = iso =>'),
    fn('buildQuote'), fn('restoreFromQuote'), fn('importQuoteContent'),
    'this.run = (name, st, extra = {}) => { ST = structuredClone(st); Object.assign(this, {}); if (extra.REQ_PROFILE) REQ_PROFILE = extra.REQ_PROFILE; if (extra.REQ_SPOTS) REQ_SPOTS = extra.REQ_SPOTS; QNO = extra.QNO || ""; const out = extra.call(); return { out, ST: structuredClone(ST), REQ_PROFILE: structuredClone(REQ_PROFILE), REQ_SPOTS: REQ_SPOTS.slice() }; };',
    'this.api = { buildQuote: () => buildQuote(), loadCourse: (n, o) => loadCourse(n, o), matchCourse: (x) => matchCourse(x), restoreFromQuote: (q) => restoreFromQuote(q), importQuoteContent: (q) => importQuoteContent(q) };',
].join('\n'), Object.assign(legacy, { BASE, COURSES, SPOTS }));
const runLegacy = (st, call, extra = {}) => legacy.run('', st, { ...extra, call });

const filled = () => ({ ...m.emptyQuoteState(BASE), customer: '강민지', phone: '010-1234-5678', email: 'a@b.co', destination: '고비', quoteNo: '',
    depart: '2026-08-06', return_: '2026-08-10', pax: 6, vehicle: '', flightIn: '08/06 - 04:30', flightOut: '', manager: '', paxNote: '',
    pickup: '', drop: '공항 아님', events: '❤️1번\n\n  ❤️2번 ', remark: '', spots: ['욜링암', '없는명소', '홍고린엘스'],
    days: [{ d: 1, date: '08.06(목)', dest: '울란바토르', items: ['a'], stay: { name: 'x', tags: ['t'] }, meals: ['', '', ''] }],
    balances: [{ pax: 6, economy: 800000, full: 1000000 }, { pax: 2, amount: 1500000 }] });

test('견적 문서(buildQuote)는 옛 견적만들기와 같다 — 날짜·인원 표기·항공 미정·픽업 자동·요금표·대표 명소', () => {
    const now = new Date();
    for (const [st, extra] of [
        [filled(), { QNO: '260806-1' }],
        [{ ...filled(), depart: '', return_: '', customer: '', destination: '', paxNote: '6인 (남2/여4)', manager: '볼라', vehicle: '하이에이스' }, {}],
        [{ ...filled(), flightIn: '', pickup: '호텔 앞', remark: '특이사항' }, { REQ_PROFILE: { tripType: '가족', request: '천천히' }, REQ_SPOTS: ['테를지'] }],
    ]) {
        const theirs = runLegacy(st, () => legacy.api.buildQuote(), extra).out;
        const mine = m.buildQuote(st, BASE, { quoteNo: extra.QNO || '', reqProfile: extra.REQ_PROFILE || {}, reqSpots: extra.REQ_SPOTS || [], spotLib: SPOTS, now });
        const strip = (q) => ({ ...plain(q), issueDate: '', quoteNo: q.quoteNo.length > 7 ? 'auto' : q.quoteNo, price: { ...plain(q.price), validUntil: '' } });
        assert.deepEqual(strip(mine), strip(theirs));
        assert.equal(mine.issueDate, theirs.issueDate);
    }
    const q = m.buildQuote(filled(), BASE, { quoteNo: '', reqProfile: {}, reqSpots: [], spotLib: SPOTS, now: new Date(2026, 6, 12, 9, 5) });
    assert.equal(q.quoteNo, '260712-905');
    assert.equal(q.pickup, '08/06 - 04:30 공항');
    assert.deepEqual(q.flight, { in: '08/06 - 04:30', out: '미정' });
    assert.equal(q.period, '2026년 8월 6일 ~ 2026년 8월 10일');
    assert.equal(q.nights, '4박 5일');
    assert.deepEqual(q.price.balances.map(b => b.pax), [2, 6]);
    assert.deepEqual(q.price.balances[0], { pax: 2, economy: 1500000, full: 1500000 }, '옛 {amount} 잔금도 실속형·풀패키지로');
    assert.equal(q.price.validUntil, '2026년 7월 19일');
    assert.deepEqual(q.events, ['❤️1번', '❤️2번']);
    assert.deepEqual(q.highlights.map(h => h.name), ['욜링암', '없는명소', '홍고린엘스']);
    assert.deepEqual(q.highlights[1].subImgs, ['', '', '', '']);
});

test('코스 불러오기·여행지 맞추기·발행 견적 되돌리기·다른 견적 가져오기는 옛 도구와 같다', () => {
    for (const [name, opts, st, reqSpots] of [
        ['고비 5일', {}, filled(), []],
        ['고비 5일', { keepCustomer: true }, { ...filled(), destination: '고비 사막 투어', vehicle: '' }, ['테를지', '없는곳']],
        ['중앙 몽골', {}, { ...filled(), pax: 6, deposit: 100000 }, []],
        ['중앙 몽골', {}, { ...filled(), pax: 3, deposit: 100000 }, []],
    ]) {
        const theirs = runLegacy(st, () => legacy.api.loadCourse(name, { ...opts, silent: true }), { REQ_SPOTS: reqSpots }).ST;
        assert.deepEqual(plain(m.applyCourse(st, COURSES[name], { ...opts, reqSpots, spotLib: SPOTS })), theirs, `${name} ${JSON.stringify(opts)}`);
    }
    for (const dest of ['중앙 몽골 투어', '고비', '홉스골 여행', '', '몽골', '서부']) {
        assert.equal(m.matchCourse(dest, COURSES), runLegacy(filled(), () => legacy.api.matchCourse(dest)).out, dest);
    }
    const published = m.buildQuote({ ...filled(), pickup: '', drop: '' }, BASE, { quoteNo: 'Q1', reqProfile: { tripType: '커플' }, reqSpots: ['테를지'], spotLib: SPOTS });
    for (const q of [published, { ...published, departISO: '', period: '2025-07-01 ~ 2025-07-05', flight: { in: '미정', out: 'OM 302' }, drop: 'OM 302 공항' }, { customer: 'x' }]) {
        const r = runLegacy(m.emptyQuoteState(BASE), () => legacy.api.restoreFromQuote(q));
        const mine = m.restoreFromQuote(m.emptyQuoteState(BASE), q, BASE);
        assert.deepEqual(plain(mine.st), r.ST);
        if (q.requestProfile) { assert.deepEqual(mine.reqProfile, r.REQ_PROFILE); assert.deepEqual(mine.reqSpots, r.REQ_SPOTS); }
        const imported = runLegacy(filled(), () => legacy.api.importQuoteContent(q)).ST;
        assert.deepEqual(plain(m.importQuoteContent(filled(), q)), imported);
    }
    assert.equal(m.restoreFromQuote(filled(), null, BASE), null);
});

test('저장 내용: 요청에서 연 견적은 PATCH(인원 구성 유지·연락처·이메일), 새 견적은 POST(walkin/course-share)', () => {
    const ctx = { ...m.emptyContext(), reqId: 'r1', reqToken: 't', reqPax0: { adult: 4, child: 1, infant: 1 }, savedEmail: 'a@b.co' };
    const q = { quoteNo: 'Q' };
    const share = m.savePayload(filled(), q, ctx, true);
    assert.deepEqual(share, { method: 'PATCH', id: 'r1', body: { quote: q, notifyQuote: true, adult: 4, child: 1, infant: 1, depart: '2026-08-06', return_: '2026-08-10', nights: 4, destination: '고비', phone: '01012345678' } });
    const silent = m.savePayload({ ...filled(), pax: 3, email: 'new@b.co' }, q, ctx, false);
    assert.equal(silent.body.silentQuote, true);
    assert.deepEqual([silent.body.adult, silent.body.child, silent.body.infant, silent.body.email], [3, 0, 0, 'new@b.co']);
    const walk = m.savePayload(filled(), q, { ...m.emptyContext(), anonymousShare: true }, false, new Date('2026-11-24T00:00:00Z'));
    assert.equal(walk.method, 'POST');
    assert.deepEqual(walk.body, { status: '진행중', name: '강민지', phone: '01012345678', email: 'a@b.co', destination: '고비', depart: '2026-08-06', return_: '2026-08-10',
        nights: 4, adult: 6, child: 0, infant: 0, receivedAt: '2026-11-24T00:00:00.000Z', source: 'course-share', quote: q, silentQuote: true });
    // 옛 runSave와 같은 칸을 보내는지(문서의 문자열로 확인)
    for (const s of ['{ quote: q, notifyQuote:true }', '{ quote: q, silentQuote:true }', 'source: ANONYMOUS_SHARE ? "course-share" : "walkin"', 'silentQuote: !share', 'if (email !== savedEmail) patch.email = email;'])
        assert.ok(html.includes(s), s);
    assert.equal(m.customerQuoteLink('https://x.com', 'abc'), 'https://x.com/%EB%82%B4%EA%B2%AC%EC%A0%81.html?t=abc', '알림톡 승인 링크와 같은 주소');
    assert.ok(html.includes('location.origin + "/" + encodeURI("내견적.html") + "?t=" + token'));
    assert.deepEqual(m.estimateTotal({ ...filled(), deposit: 100000 }), { perPerson: 900000, total: 5400000 });
    assert.equal(m.estimateTotal({ ...filled(), pax: 9 }), null);
    assert.equal(m.dayDateStr('2026-08-06', 1), '08.07(금)');
    assert.deepEqual(m.dayCountCheck(filled()), { ok: false, nights: 4, need: 5, have: 1 });
    assert.ok(m.validEmail('') && m.validEmail('a@b.co') && !m.validEmail('a@b'));
});

test('초안 보관은 quote-editor-state.js와 같은 자리·형식이다(옛 화면과 서로 복원)', () => {
    const ctx = vm.createContext({ structuredClone, console });
    vm.runInContext(readFileSync('public/quote-editor-state.js', 'utf8'), ctx);
    const L = ctx.QuoteEditorState;
    const value = { ...filled(), token: 'secret', photo: 'data:image/png;base64,AAA', days: [{ d: 1, dest: 'x', items: ['a'], img: 'blob:x|y' }], n: NaN, step: 3 };
    assert.deepEqual(d.cleanDraft(value), plain(L.clean(value)));
    assert.equal(d.draftFingerprint(value), L.fingerprint(value));
    assert.equal(d.draftKey('acc 1', 'quote', ''), L.keyFor('acc 1', 'quote', ''));
    assert.equal(d.draftKey('acc', 'quote', 'r/1'), L.keyFor('acc', 'quote', 'r/1'));
    for (const v of [filled(), { days: [{ items: [1] }] }, { spots: [1] }, { customer: 3 }, { balances: [1] }, [], { days: [{ stay: { tags: [2] } }] }])
        assert.equal(d.validQuoteDraft(v), L.validQuote(v), JSON.stringify(v));

    const memory = () => { const map = new Map(); return { getItem: k => map.has(k) ? map.get(k) : null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k), map }; };
    const scope = { account: 'acc', kind: 'quote', requestId: 'r1' };
    const baseline = filled(), edited = { ...filled(), customer: '바뀐 이름' };
    // 옛 화면이 쓴 초안을 React가 읽고, React가 쓴 초안을 옛 화면이 읽는다
    const a = memory(); L.write(a, scope, baseline, edited);
    const readMine = d.readDraft(a, scope, baseline);
    assert.equal(readMine.kind, 'draft'); assert.equal(readMine.value.customer, '바뀐 이름'); assert.equal(readMine.conflict, false);
    const b = memory(); d.writeDraft(b, scope, baseline, edited);
    const readTheirs = L.read(b, scope, baseline, L.validQuote);
    assert.equal(readTheirs.kind, 'draft'); assert.equal(readTheirs.value.customer, '바뀐 이름');
    assert.equal(d.readDraft(b, scope, { ...filled(), phone: '010' }).conflict, true, '서버 원본이 바뀌었으면 충돌로 알린다');
    assert.equal(d.readDraft(b, scope, baseline).kind, 'draft');
    assert.equal(d.readDraft(b, { ...scope, account: 'other' }, baseline).kind, 'empty', '다른 관리자 계정 초안은 읽지 않는다');
    const same = memory(); d.writeDraft(same, scope, baseline, baseline);
    assert.equal(d.readDraft(same, scope, baseline).kind, 'empty', '원본과 같은 초안은 없는 것으로');
    const broken = memory(); broken.setItem(d.draftKey('acc', 'quote', 'r1'), '{');
    assert.equal(d.readDraft(broken, scope, baseline).kind, 'error');
    const legacyStore = memory(); legacyStore.setItem('leaders_quote_draft', JSON.stringify({ reqId: 'r1', st: edited }));
    const old = d.readDraft(legacyStore, scope, baseline, d.validQuoteDraft, 'leaders_quote_draft');
    assert.equal(old.kind, 'draft'); assert.equal(old.legacy, true);
    assert.deepEqual(old, plain(L.read(memory().map && (() => { const s = memory(); s.setItem('leaders_quote_draft', JSON.stringify({ reqId: 'r1', st: edited })); return s; })(), scope, baseline, L.validQuote, 'leaders_quote_draft')));
    d.removeDraft(b, scope); assert.equal(b.map.size, 0);
});

test('견적서 만들기 메뉴는 React로 열리고, 고객 화면 안 편집은 옛 문서를 그대로 쓴다', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const own = app.indexOf('path="/admin/quote-desk/builder"');
    assert.ok(own > 0 && own < app.indexOf('path="/admin/quote-desk/:tool?"'), '견적 도구 iframe보다 앞에서 잡는다');
    const page = readFileSync('src/pages/AdminQuoteBuilder.tsx', 'utf8');
    assert.match(page, /sessionStorage\.getItem\('leaders_course_share'\)/, '코스 관리의 공유 견적을 받는다');
    assert.match(page, /sessionStorage\.removeItem\('leaders_course_share'\)/);
    assert.match(page, /localStorage\.setItem\('leaders_quote', JSON\.stringify\(/, '미리보기는 옛 도구와 같이 브라우저에 넣고 견적서·일정지도를 연다');
    assert.match(page, /legacyKey: 'leaders_quote_draft'|'leaders_quote_draft'/, '옛 형식 초안도 읽는다');
    assert.match(page, /adminConfirm\(\{[^}]*고객에게 견적서 도착 알림톡이 발송/, '링크 공유는 알림톡 확인 창');
    assert.match(readFileSync('src/pages/AdminQuoteDesk.tsx', 'utf8'), /quoteDeskFrameSrc|견적만들기/);
    assert.match(readFileSync('src/components/admin/quoteDesk.ts', 'utf8'), /tool\.key === 'builder' && bookingId\) return `\$\{tool\.doc\}\?id=/, '고객 화면 안 편집기는 옛 견적만들기');
});
