import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { build } from 'esbuild';

// 고객 통합 작업 안의 견적 문의 상세(React QuoteInquiryPanel)는 옛 public/견적관리.html의 상세 창(openDrawer)과 같은 일을 해야 한다.
// 1) 계산(타임라인·정보 복사·예약확정 검사·유효기간 연장·고객 링크)은 옛 문서의 함수를 그대로 꺼내 결과를 비교한다.
// 2) 화면 동작(메모 저장·이동 보호·상태·수락·삭제·첨부)은 실제 컴포넌트의 handler를 얕은 hook 흉내로 실행한다(브라우저·외부 호출 없음).
const out = await build({ entryPoints: ['src/components/admin/quoteInquiryDetail.ts'], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const m = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

const legacyHtml = readFileSync('public/견적관리.html', 'utf8');
const legacyFn = (name) => {
    const start = legacyHtml.indexOf(`function ${name}(`);
    assert.ok(start > 0, name);
    let depth = 0, i = legacyHtml.indexOf('{', start);
    for (; i < legacyHtml.length; i++) { if (legacyHtml[i] === '{') depth++; else if (legacyHtml[i] === '}' && --depth === 0) break; }
    return legacyHtml.slice(start, i + 1);
};
const between = (from, to) => { const a = legacyHtml.indexOf(from), b = legacyHtml.indexOf(to, a); assert.ok(a > 0 && b > a, from); return legacyHtml.slice(a, b); };
const legacy = vm.createContext({});
vm.runInContext([
    'const nightTxt = r => r.nights ? `${r.nights}박 ${r.nights+1}일` : "-";',
    'const paxTxt = r => `성인 ${r.adult||0}·아동 ${r.child||0}·유아 ${r.infant||0}`;',
    legacyFn('customerTimeline'),
    // 정보 복사 글: 옛 copyBtn의 템플릿 그대로
    `function copyText(r) { ${between('const txt = `[견적 문의]', ';\n    navigator.clipboard.writeText(txt)')}; return txt; }`,
    // 예약확정 검사: 옛 updateStatus의 검사 줄 그대로(toast 대신 문구를 돌려준다)
    `function statusBlock(r, s) { let msg = ""; const toast = t => { msg = t; }; const prev = r.status || "신규";
        ${between('  if (s === "예약확정") {', '  r.status = s;').replace(/return;/g, 'return msg;')} return msg; }`,
    `function extend(r, nowMs) { const RealDate = Date; const Date2 = function (...a) { return a.length ? new RealDate(...a) : new RealDate(nowMs); };
        return (function (Date) { ${between('    const base = r.quoteExpiresAt', '\n    const saved = await persist(id, { quoteExpiresAt });')}; return quoteExpiresAt; })(Date2); }`,
    `function link(origin, r) { const location = { origin }; return ${between('location.origin + "/" + encodeURI', ';\n    navigator.clipboard.writeText(link)')}; }`,
].join('\n'), legacy);
const plain = (value) => JSON.parse(JSON.stringify(value));
const noEmoji = (label) => label.replace(/^(?:💬|⚠|🔔|💳|✍|👥|✓|🎫)\s*/u, '');

const booking = (extra = {}) => ({ contractInfo: {}, ...extra });
const RECORDS = [
    { id: 1, name: '김하나', status: '신규', receivedAt: '2026-11-24T01:00:00Z', phone: '010-1', email: 'a@example.test', adult: 2, nights: 3, depart: '2026-12-01', return_: '2026-12-04', tripType: '가족', destination: '고비', vehicle: '스타렉스', request: '홉스골 가고 싶어요' },
    { id: 2, name: '이둘', status: '진행중', receivedAt: '2026-11-20', kakaoId: 'kakao2', child: 1, destSpots: ['테를지', '홉스골'], cityStay: '호텔', gerStay: '전통 게르', flightIn: 'OZ575', budget: '1인 150만원',
        quote: { price: { deposit: 100000 } }, quoteIssuedAt: '2026-11-21T03:04:00Z', decision: { status: 'accepted', acceptedAt: '2026-11-22T05:00:00Z', source: 'customer' },
        activities: [{ type: 'quote_notification_queued', at: '2026-11-21T03:05:00Z' }, { type: 'quote_notification_skipped', at: 'bad-date' }, { type: 'other', at: '2026-11-21T03:06:00Z' }] },
    { id: 3, name: '박셋', status: '진행중', receivedAt: '2026-11-10T01:00:00Z', quote: {}, notify: { quoteSentAt: '2026-11-11T01:00:00Z' }, decision: { status: 'accepted', acceptedAt: '2026-11-12T01:00:00Z', source: 'admin' },
        activities: [{ type: 'payment_changed', at: '2026-11-14T01:00:00Z', detail: '예약금 미입금 → 입금완료' }, { type: 'itinerary_notification_queued', at: '2026-11-20T01:00:00Z' }],
        changeRequests: [{ at: '2026-11-15T01:00:00Z', categories: ['숙소'], status: 'resolved' }, { requestedAt: '2026-11-16T01:00:00Z' }],
        booking: booking({ depositRequest: { status: 'requested', requestedAt: '2026-11-12T01:00:00Z' }, depositReport: { status: 'reported', reportedAt: '2026-11-13T01:00:00Z', name: '박셋' },
            contractRequest: { status: 'requested', requestedAt: '2026-11-14T02:00:00Z' }, contract: { signedAt: '2026-11-15T09:00:00Z' }, travelerSubmission: { submittedAt: '2026-11-16T09:00:00Z', submittedCount: 3 },
            confirmedAt: '2026-11-17T01:00:00Z', publishedAt: '2026-11-18', publishStatus: 'published', contractInfo: { depositStatus: '입금완료' } }) },
    { id: 4, name: '', receivedAt: 'not-a-date', flightOut: 'MIAT', stay: '옛 숙소칸' },
];

test('타임라인·정보 복사는 옛 견적관리와 같다(그림 문자만 뺐다)', () => {
    for (const r of RECORDS) {
        const old = plain(legacy.customerTimeline(r)).map(e => ({ ...e, label: noEmoji(e.label) }));
        assert.deepEqual(plain(m.inquiryTimeline(r)), old, `timeline ${r.id}`);
        assert.equal(m.inquiryCopyText(r), legacy.copyText(r), `copy ${r.id}`);
    }
    assert.equal(m.timelineTime('2026-11-18'), '11.18', '날짜만 저장된 기록에 시각을 붙이지 않는다');
    assert.match(m.timelineTime('2026-11-18T09:05:00'), /^11\.18 09:05$/);
});

test('예약확정 검사·유효기간 연장·고객 링크는 옛 상세 창과 같다', () => {
    const cases = [
        {}, { quote: {} }, { quote: {}, status: '예약확정' }, { quote: {}, decision: { status: 'accepted' } },
        { quote: {}, decision: { status: 'accepted' }, booking: {} },
        { quote: {}, decision: { status: 'accepted' }, booking: { contract: { signedAt: 'x' } } },
        { quote: {}, decision: { status: 'accepted' }, booking: { contract: { signedAt: 'x' }, contractInfo: { depositStatus: '미입금' } } },
        { quote: {}, decision: { status: 'accepted' }, booking: { contract: { signedAt: 'x' }, contractInfo: { depositStatus: '입금완료' } } },
    ];
    for (const r of cases) for (const s of ['예약확정', '진행중', '보류']) assert.equal(m.statusBlock(r, s), legacy.statusBlock(r, s).replace(/^⚠ /, ''), JSON.stringify([r, s]));
    const now = Date.parse('2026-11-24T00:00:00Z');
    for (const quoteExpiresAt of [undefined, '2026-11-20T00:00:00Z', '2026-12-01T00:00:00Z']) assert.equal(m.extendedQuoteExpiry({ quoteExpiresAt }, new Date(now)), legacy.extend({ quoteExpiresAt }, now));
    assert.equal(m.customerLinkUrl('https://mongolia-milkyway.com', 'tok-1'), legacy.link('https://mongolia-milkyway.com', { token: 'tok-1' }));
    assert.equal(m.attachmentPath('uploads/2026/견적 a.pdf'), '/api/file/uploads/2026/%EA%B2%AC%EC%A0%81%20a.pdf');
    const rows = m.inquiryInfoRows(RECORDS[1]);
    assert.deepEqual(rows.map(row => row.label), ['휴대폰', '이메일', '카톡 ID', '인원', '일정', '여행타입', '희망투어', '시내 숙소', '투어 게르', '차량', '항공권', '예산']);
    assert.equal(rows.find(row => row.key === 'flight').value, 'IN OZ575 · OUT 미정');
    assert.equal(m.inquiryInfoRows(RECORDS[3]).find(row => row.key === 'city').value, '옛 숙소칸');
});

// ── 화면 동작: 실제 QuoteInquiryPanel handler ──
const UI = ['AdminBadge', 'AdminButton', 'AdminCard', 'AdminField', 'AdminIconButton', 'AdminMessage', 'AdminSegmented', 'AdminTextArea', 'IconCopy', 'IconDocumentText', 'IconDownload', 'IconExternal', 'IconPencil', 'IconTrash'];
const panelBuild = await build({ entryPoints: ['src/components/admin/QuoteInquiryPanel.tsx'], bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false, loader: { '.css': 'empty' },
    plugins: [{ name: 'inquiry-fixture', setup(builder) {
        builder.onResolve({ filter: /^react$|^react\/jsx-runtime$/ }, args => ({ path: args.path, namespace: 'fixture' }));
        builder.onResolve({ filter: /^\.\/ui$/ }, () => ({ path: 'ui', namespace: 'fixture' }));
        builder.onResolve({ filter: /adminFeedback$/ }, () => ({ path: 'feedback', namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ loader: 'js', contents:
            path === 'react' ? `const k=['useState','useRef','useEffect','useCallback','useImperativeHandle'];export const useState=(...a)=>globalThis.h.useState(...a),useRef=(...a)=>globalThis.h.useRef(...a),useEffect=(...a)=>globalThis.h.useEffect(...a),useCallback=(...a)=>globalThis.h.useCallback(...a),useImperativeHandle=(...a)=>globalThis.h.useImperativeHandle(...a),forwardRef=fn=>fn;export default {useState,useRef,useEffect,useCallback,useImperativeHandle,forwardRef};`
            : path === 'react/jsx-runtime' ? `export const Fragment='fragment';export const jsx=(type,props,key)=>({type,props,key});export const jsxs=jsx;`
            : path === 'ui' ? UI.map(name => `export const ${name}='${name}';`).join('')
            : `export const adminNotify=(...a)=>globalThis.notices.push(a);export const adminConfirm=async o=>{globalThis.confirms.push(o);return globalThis.confirmAnswer;};` }));
    } }],
});
const deferred = () => { let resolve; const promise = new Promise(a => { resolve = a; }); return { promise, resolve }; };
const tick = () => new Promise(setImmediate);
const nodes = root => !root || typeof root !== 'object' ? [] : Array.isArray(root) ? root.flatMap(nodes)
    : [root, ...(typeof root.props?.children === 'function' ? nodes(root.props.children('memo-field', undefined)) : nodes(root.props?.children)), ...nodes(root.props?.actions)];
const find = (root, predicate) => { const node = nodes(root).find(predicate); assert.ok(node, 'requested control is rendered'); return node; };
const button = (root, text) => find(root, n => ['AdminButton', 'AdminIconButton'].includes(n.type) && (n.props.children === text || n.props.label === text || (Array.isArray(n.props.children) && n.props.children.join('') === text)));
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

function mount(record, overrides = {}) {
    const calls = [], states = [], events = { saved: 0, builder: 0, booking: 0, deleted: 0 };
    const module = { exports: {} };
    const context = vm.createContext({ module, exports: module.exports, notices: [], confirms: [], confirmAnswer: true, URLSearchParams, Date, Promise, JSON,
        fetch: (url, init) => { calls.push({ url, init, body: init?.body ? JSON.parse(init.body) : undefined }); return overrides.fetch ? overrides.fetch(url, init) : Promise.resolve(response({ ok: true })); },
        window: { location: { origin: 'http://localhost' }, setTimeout: () => 1, open: (...args) => calls.push({ open: args }) },
        navigator: { clipboard: { writeText: async text => { calls.push({ copied: text }); } } } });
    vm.runInContext(panelBuild.outputFiles[0].text, context);
    const values = [], memo = []; let cursor = 0, effects = [];
    const ref = { current: null };
    const props = { record, token: 'admin-token', onState: s => states.push(s), onSaved: () => events.saved++, onOpenBuilder: () => events.builder++, onOpenBooking: () => events.booking++, onDeleted: () => events.deleted++ };
    const h = {
        useState(initial) { const key = cursor++; if (!(key in values)) values[key] = typeof initial === 'function' ? initial() : initial; return [values[key], change => { values[key] = typeof change === 'function' ? change(values[key]) : change; }]; },
        useRef(initial) { const key = cursor++; if (!(key in values)) values[key] = { current: initial }; return values[key]; },
        useCallback(fn, deps) { const key = cursor++; if (!memo[key] || deps.some((v, i) => v !== memo[key].deps[i])) memo[key] = { deps, fn }; return memo[key].fn; },
        useEffect(fn, deps) { const key = cursor++, old = memo[key]; if (!old || deps.some((v, i) => v !== old.deps?.[i])) { memo[key] = { deps, cleanup: old?.cleanup }; effects.push(() => { old?.cleanup?.(); memo[key].cleanup = fn(); }); } },
        useImperativeHandle(target, create) { cursor++; target.current = create(); },
    };
    const render = () => { cursor = 0; effects = []; context.h = h; h.tree = module.exports.QuoteInquiryPanel(props, ref); effects.forEach(run => run()); return h.tree; };
    render();
    return { h, ref, render, calls, states, events, context, props };
}
const memoArea = tree => find(tree, n => n.type === 'AdminTextArea');

test('상담 메모: 이동 보호는 저장을 한 번만 하고, 실패하면 입력과 오류를 유지한다(옛 InhasuQuoteInquiryWorkspace와 같은 약속)', async () => {
    const pending = deferred();
    const p = mount({ id: 'q1', name: '김하나', memo: '저장된 메모' }, { fetch: () => pending.promise });
    assert.deepEqual(plain(p.ref.current.flushAll()), { ok: true, busy: false, dirty: false });
    memoArea(p.h.tree).props.onChange({ target: { value: '수정한 메모' } }); p.render();
    assert.equal(p.states.at(-1).dirty, true);
    assert.deepEqual(plain(p.ref.current.flushAll()), { ok: false, busy: true });
    assert.equal(p.ref.current.flushAll().busy, true, '저장 중에는 다시 저장하지 않는다');
    memoArea(p.h.tree).props.onBlur({ target: { value: '수정한 메모' } });
    assert.equal(p.calls.length, 1); assert.deepEqual(p.calls[0].body, { memo: '수정한 메모' });
    assert.equal(p.calls[0].init.method, 'PATCH'); assert.equal(p.calls[0].url, '/api/requests/q1'); assert.equal(p.calls[0].init.headers['x-admin-token'], 'admin-token');
    p.render(); assert.equal(find(p.h.tree, n => n.type === 'fieldset').props.disabled, true, '저장 중에는 칸과 버튼을 잠근다');
    pending.resolve(response({ ok: false, error: '로컬 검증 실패' }, 500)); await tick(); p.render();
    assert.equal(memoArea(p.h.tree).props.value, '수정한 메모');
    const failed = p.ref.current.flushAll();
    assert.equal(failed.ok, false); assert.equal(failed.busy, false); assert.match(failed.error, /메모 저장 실패: 로컬 검증 실패/);
    assert.equal(p.calls.length, 1, '실패한 메모를 이동 때 다시 몰래 저장하지 않는다');
    assert.deepEqual(plain(p.states.at(-1)), { busy: false, dirty: true, error: '메모 저장 실패: 로컬 검증 실패' });
    assert.equal(p.events.saved, 0);
});

test('상담 메모: 저장되면 고객 현황을 다시 읽고, 다시 읽은 자료가 고치던 메모를 덮지 않는다', async () => {
    const p = mount({ id: 'q1', memo: '처음' });
    memoArea(p.h.tree).props.onChange({ target: { value: '새 메모' } }); p.render();
    memoArea(p.h.tree).props.onBlur({ target: { value: '새 메모' } }); await tick(); p.render();
    assert.equal(p.events.saved, 1); assert.deepEqual(plain(p.ref.current.flushAll()), { ok: true, busy: false, dirty: false });
    memoArea(p.h.tree).props.onChange({ target: { value: '고치는 중' } }); p.render();
    p.props.record = { id: 'q1', memo: '새 메모', status: '진행중' }; p.render(); p.render(); // 효과가 바꾼 상태로 한 번 더 그린다(React가 하는 일)
    assert.equal(memoArea(p.h.tree).props.value, '고치는 중');
    assert.equal(find(p.h.tree, n => n.type === 'AdminSegmented').props.value, '진행중', '다른 칸은 새 자료로 바뀐다');
});

test('상태: 예약확정 조건이 모자라면 저장하지 않고, 저장 실패는 원래 상태로 되돌린다', async () => {
    const fail = mount({ id: 'q2', status: '신규' }, { fetch: async () => response({ ok: false, error: '거절' }, 409) });
    const seg = () => find(fail.h.tree, n => n.type === 'AdminSegmented');
    await seg().props.onChange('예약확정');
    assert.equal(fail.calls.length, 0); assert.match(fail.context.notices.at(-1)[0], /견적서를 먼저 발행/);
    seg().props.onChange('보류'); fail.render();
    assert.equal(seg().props.value, '보류', '누르면 바로 보여 준다');
    await tick(); fail.render();
    assert.deepEqual(fail.calls[0].body, { status: '보류' });
    assert.equal(seg().props.value, '신규'); assert.match(fail.context.notices.at(-1)[0], /상태 저장 실패: 거절/);
    const ok = mount({ id: 'q2', status: '신규' }, { fetch: async () => response({ ok: true, status: '진행중', activities: [{ type: 'x' }] }) });
    find(ok.h.tree, n => n.type === 'AdminSegmented').props.onChange('진행중'); await tick(); ok.render();
    assert.equal(ok.events.saved, 1); assert.equal(find(ok.h.tree, n => n.type === 'AdminSegmented').props.value, '진행중');
});

test('예약 진행 기록은 확인 뒤 서버 acceptQuote 하나로 저장하고(고객 현황 버튼과 같은 예약), 취소하면 아무것도 보내지 않는다', async () => {
    const r = { id: 'q3', name: '이둘', status: '진행중', quote: { price: { deposit: 100000 } }, token: 't3' };
    const no = mount(r); no.context.confirmAnswer = false;
    await button(no.h.tree, '예약 진행 기록').props.onClick(); await tick();
    assert.equal(no.calls.length, 0);
    const p = mount(r);
    assert.equal(button(p.h.tree, '예약관리 시작').props.disabled, true, '수락 전에는 예약관리를 시작할 수 없다');
    button(p.h.tree, '예약 진행 기록').props.onClick(); await tick(); await tick();
    assert.deepEqual(p.calls[0].body, { acceptQuote: true }); assert.equal(p.events.saved, 1);
    assert.match(p.context.confirms[0].message, /이둘님의 예약 진행을 기록할까요/);
    const accepted = mount({ ...r, decision: { status: 'accepted' } });
    assert.equal(nodes(accepted.h.tree).some(n => n.props?.children === '예약 진행 기록'), false, '수락한 뒤에는 기록 버튼이 없다');
    button(accepted.h.tree, '예약관리 시작').props.onClick(); assert.equal(accepted.events.booking, 1);
    button(accepted.h.tree, '견적서 수정').props.onClick(); assert.equal(accepted.events.builder, 1);
});

test('견적서·고객 링크: 유효기간 연장·링크 재발급·복사는 옛 동작과 같은 요청을 보낸다', async () => {
    const r = { id: 'q4', name: '박셋', quote: {}, token: 'old-token', quoteExpiresAt: '2099-01-01T00:00:00.000Z' };
    const p = mount(r, { fetch: async (url, init) => response(JSON.parse(init.body).rotateCustomerLink ? { ok: true, token: 'new-token' } : { ok: true }) });
    button(p.h.tree, '유효기간 7일 연장').props.onClick(); await tick();
    assert.deepEqual(p.calls[0].body, { quoteExpiresAt: '2099-01-08T00:00:00.000Z' });
    button(p.h.tree, '고객 링크 재발급').props.onClick(); await tick(); await tick(); p.render();
    assert.deepEqual(p.calls[1].body, { rotateCustomerLink: true });
    button(p.h.tree, '고객 링크 복사').props.onClick(); await tick();
    assert.equal(p.calls.at(-1).copied, 'http://localhost/%EB%82%B4%EA%B2%AC%EC%A0%81.html?t=new-token', '재발급한 새 링크를 복사한다');
    button(p.h.tree, '견적서 보기').props.onClick();
    assert.deepEqual(p.calls.at(-1).open, ['/견적서?t=new-token', '_blank', 'noopener']);
    button(p.h.tree, '정보 복사').props.onClick(); await tick();
    assert.match(p.calls.at(-1).copied, /^\[견적 문의\] 박셋\n/);
});

test('삭제는 확인 뒤 DELETE 하고, 끝나면 이동 보호가 막지 않는다', async () => {
    const p = mount({ id: 'q5', name: '최넷' });
    p.context.confirmAnswer = false; button(p.h.tree, '문의 삭제').props.onClick(); await tick();
    assert.equal(p.calls.length, 0);
    p.context.confirmAnswer = true;
    memoArea(p.h.tree).props.onChange({ target: { value: '지울 고객 메모' } }); p.render();
    button(p.h.tree, '문의 삭제').props.onClick(); await tick(); await tick();
    assert.equal(p.calls[0].init.method, 'DELETE'); assert.equal(p.calls[0].url, '/api/requests/q5');
    assert.equal(p.events.deleted, 1); assert.deepEqual(plain(p.ref.current.flushAll()), { ok: true, busy: false });
    assert.equal(p.context.confirms[0].danger, true);
});

test('고객 화면은 문의 상세를 iframe 대신 React로 그리고, 첨부는 관리자 헤더로만 받는다', () => {
    const panel = readFileSync('src/components/admin/QuoteInquiryPanel.tsx', 'utf8');
    assert.doesNotMatch(panel, /\?token=/, '주소에 관리자 값을 넣지 않는다');
    assert.match(panel, /fetch\(attachmentPath\(String\(r\.fileKey\)\), \{ headers: \{ 'x-admin-token': token \}/);
    const desk = readFileSync('src/pages/AdminQuoteDesk.tsx', 'utf8');
    assert.doesNotMatch(desk, /workspace=1/, '옛 견적관리 상세 iframe을 쓰지 않는다');
    assert.match(desk, /const nativeInquiry = tool\.key === 'inbox';/);
    assert.match(desk, /if \(nativeInquiry\) return inquiryRef\.current\?\.flushAll\(\) \|\| \{ ok: true, busy: false \};/, '이동·새로고침 보호가 React 상세의 메모를 저장한다');
    assert.match(desk, /if \(nativeInquiry\) return !!inquiryRef\.current\?\.navigate\(section\);/);
    assert.match(desk, /<QuoteInquiryPanel key=\{`\$\{accountId\}:\$\{bookingId\}:\$\{nativeReload\}`\} ref=\{inquiryRef\}/, '계정·고객이 바뀌거나 다시 불러오면 새로 그린다');
    assert.match(desk, /onOpenBuilder=\{\(\) => \{ void openCustomerEditor\('builder', 'docs'\); \}\}/);
});
