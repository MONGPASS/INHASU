import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { build } from 'esbuild';

// 견적 예약 편집기(예약관리)의 계산 모듈 components/admin/quoteBookingEditor.ts는 옛 public/예약관리.html(+ booking.js ·
// lodging.js · quote-booking-workspace.js)과 결과가 같아야 한다. 옛 화면을 실제로 그려(render) 입력칸 값을 읽고,
// 옛 pullForm·init·loadLibs·updateActionBar·saveBookingBody를 그대로 실행해 새 모듈의 결과와 비교한다(브라우저·외부 호출 없음).
const out = await build({ entryPoints: ['src/components/admin/quoteBookingEditor.ts'], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const m = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
const lodgingOut = await build({ entryPoints: ['src/utils/lodgingDisplay.ts'], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const lodging = await import('data:text/javascript;base64,' + Buffer.from(lodgingOut.outputFiles[0].text).toString('base64'));

const html = readFileSync('public/예약관리.html', 'utf8');
const legacyFn = (name) => {
    let start = html.indexOf(`\nfunction ${name}(`);
    if (start < 0) start = html.indexOf(`\nasync function ${name}(`);
    assert.ok(start > 0, name);
    let depth = 0, i = html.indexOf(') {', start) + 2;
    for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}' && --depth === 0) break; }
    return html.slice(start, i + 1);
};
const plain = (value) => JSON.parse(JSON.stringify(value));
const unesc = (s) => String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// ── 작은 가짜 DOM: 옛 render가 만든 HTML에서 입력칸 값을 읽는다 ──
function element(extra = {}) {
    const el = { value: '', checked: false, disabled: false, textContent: '', title: '', style: { display: '' }, dataset: {}, onclick: null, href: '#',
        classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, toggle(c, on) { if (on ?? !this.set.has(c)) this.set.add(c); else this.set.delete(c); }, contains(c) { return this.set.has(c); } },
        addEventListener() {}, setAttribute() {}, getAttribute() { return null; }, focus() {}, scrollIntoView() {}, ...extra };
    return el;
}
function controlsIn(segment) {
    const list = [];
    const attrs = (s) => Object.fromEntries([...s.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(x => [x[1], x[2] === undefined ? true : unesc(x[2])]));
    for (const x of segment.matchAll(/<input\b([^>]*)>/g)) { const a = attrs(x[1]); list.push({ a, el: element({ value: a.value ?? '', checked: !!a.checked, disabled: !!a.disabled }) }); }
    for (const x of segment.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
        const a = attrs(x[1]), options = [...x[2].matchAll(/<option value="([^"]*)"([^>]*)>/g)].map(o => ({ value: unesc(o[1]), selected: /\bselected\b/.test(o[2]) }));
        list.push({ a, el: element({ value: (options.find(o => o.selected) || options[0] || { value: '' }).value }) });
    }
    for (const x of segment.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g)) { const a = attrs(x[1]); list.push({ a, el: element({ value: unesc(x[2]) }) }); }
    return list;
}
function rows(source, opener, end) {
    const starts = [...source.matchAll(opener)].map(x => x.index);
    const stop = source.indexOf(end);
    return starts.map((at, i) => {
        const seg = source.slice(at, starts[i + 1] ?? (stop > at ? stop : source.length));
        const controls = controlsIn(seg), li = (seg.match(/data-li="(\d+)"/) || [])[1];
        return { dataset: { li }, controls, closest() { return this; },
            querySelector(sel) { const [, key, value] = sel.match(/\[([\w-]+)="([^"]+)"\]/) || []; return controls.find(c => c.a[key] === value)?.el || null; } };
    });
}
function makeDocument() {
    const doc = { ids: new Map(), lodges: [], travelers: [] };
    const main = element();
    Object.defineProperty(main, 'innerHTML', { set(value) {
        doc.ids = new Map([['main', main]]);
        for (const c of controlsIn(value)) if (c.a.id) doc.ids.set(c.a.id, c.el);
        doc.lodges = rows(value, /<div class="lodge-row" data-li="\d+">/g, 'id="addLodge"');
        doc.travelers = rows(value, /<div class="traveler-row" data-ti="\d+"/g, 'id="addTraveler"');
        doc.html = value;
    } });
    doc.ids.set('main', main);
    doc.extra = new Map();
    doc.byId = (id) => doc.ids.get(id) || (doc.extra.has(id) ? doc.extra.get(id) : (doc.extra.set(id, element()), doc.extra.get(id)));
    doc.document = { querySelectorAll: (sel) => sel === '.lodge-row' ? doc.lodges : sel === '.traveler-row' ? doc.travelers : [], addEventListener() {}, getElementById: doc.byId };
    return doc;
}

function legacyContext(libs = { guides: {}, lodges: {}, vehicles: {} }) {
    const dom = makeDocument(), toasts = [], fetches = [];
    const context = vm.createContext({ console, URL, URLSearchParams, Promise, setTimeout, clearTimeout, queueMicrotask, structuredClone,
        location: { href: 'http://localhost/예약관리?id=x', origin: 'http://localhost', search: '' }, history: { replaceState() {} },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, sessionStorage: { getItem: () => 'admin-token', setItem() {} },
        requestAnimationFrame: (fn) => fn(), dom, toasts, fetches });
    context.window = context; context.document = dom.document;
    context.window.QuoteEditorState = { create: async () => ({ isBusy: () => false, changed() {}, commit() {} }), validBooking: () => true };
    context.fetch = async (url, init) => { fetches.push({ url, init, body: init?.body ? JSON.parse(init.body) : undefined });
        const key = String(url).split('/api/data/')[1];
        if (key) return { json: async () => (libs[key] ? { ok: true, data: libs[key] } : { ok: false }) };
        return context.fetchResponse ? context.fetchResponse(url, init) : { ok: true, status: 200, json: async () => ({ ok: true }) }; };
    vm.runInContext(readFileSync('public/booking.js', 'utf8'), context);
    vm.runInContext(readFileSync('public/lodging.js', 'utf8'), context);
    vm.runInContext(readFileSync('public/quote-booking-workspace.js', 'utf8'), context);
    vm.runInContext(`
        const $ = id => dom.byId(id);
        const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
        const noBr = s => String(s ?? "").replace(/<br\\s*\\/?>/gi, " ").trim();
        const toast = m => { toasts.push(m); };
        const ADMIN_TOKEN = 'admin-token';
        const moneyTxt = n => Number(n || 0) ? "₩" + Number(n).toLocaleString("ko-KR") : "-";
        var PRE = null, BK = null, SAVED_BK_JSON = "", bookingRecovery = null, bookingEditorBooting = true, quoteDayEditor = null;
        var LIBS = { guides: {}, lodges: {}, vehicles: {} }, SNIPPETS = {}, SNIP_CATS = [], SPOTS = {}, SPOT_CATS = [];
        function bindEvents() {} function mountQuoteDays() {} function publishQuoteWorkspace() {} function bookingLock() {}
        function renderSpots() {} function fillSnipSelects() {} function resetToSaved() {} function copyCustomerLink() {} function printGuideSchedule() {} function printGuideSheet() {} function fillDatalists() {} function updateResourcePreview() {} function updateLodgePreview() {}
        ${['assignStats', 'workflowUi', 'summaryHtml', 'previewHtml', 'lodgePreviewHtml', 'dayCard', 'lodgeRow', 'travelerRow', 'render', 'pullForm', 'init', 'loadLibs',
            'updateActionBar', 'saveBookingBody', 'bookingSnapshot', 'applyGuide', 'applyVehicle'].map(legacyFn).join('\n')}
    `, context);
    return context;
}
/** 옛 화면의 입력칸 값 → BookingForm(새 모듈 모양) */
function domForm(dom) {
    const v = (id) => dom.ids.get(id)?.value ?? '', c = (id) => !!dom.ids.get(id)?.checked;
    const row = (r, key) => r.querySelector(`[data-${key}]`);
    return {
        guide: { name: v('g_name'), nameEn: v('g_nameEn'), role: v('g_role'), phone: v('g_phone'), qr: v('g_qr'), img: v('g_img'), desc: v('g_desc') },
        vehicle: { model: v('v_model'), seats: v('v_seats'), luggage: v('v_luggage'), plate: v('v_plate'), desc: v('v_desc') },
        lodges: dom.lodges.map(r => ({ day: r.querySelector('[data-lk="day"]').value, name: r.querySelector('[data-lk="name"]').value, grade: r.querySelector('[data-lk="grade"]').value, desc: r.querySelector('[data-lk="desc"]').value })),
        travelers: dom.travelers.map(r => Object.fromEntries(['type', 'nameKo', 'passportName', 'birth', 'phone', 'gender', 'passportNo'].map(k => [k, r.querySelector(`[data-tk="${k}"]`).value]))),
        flight: Object.fromEntries(['inDate', 'inDepTime', 'inTime', 'inNo', 'outDate', 'outTime', 'outArrTime', 'outNo'].map(k => [k, v('fl_' + k)])),
        pickupLodge: v('bk_pickupLodge'), travelerNote: v('bk_travelerNote'),
        contract: { productName: v('ci_productName'), region: v('ci_region'), cashReceipt: v('ci_cashReceipt'), totalAmount: v('ci_totalAmount'), depositAmount: v('ci_depositAmount'), balanceAmount: v('ci_balanceAmount'),
            depositStatus: v('ci_depositStatus'), balanceStatus: v('ci_balanceStatus'), packageType: v('ci_packageType'), bankName: v('ci_bankName'), accountNumber: v('ci_accountNumber'), accountHolder: v('ci_accountHolder'), note: v('ci_note') },
        checklist: { deposit: c('c_deposit'), balance: c('c_balance'), flight: c('c_flight'), insurance: c('c_insurance'), contract: c('c_contract') },
        notes: v('bk_notes'), memo: v('bk_memo'), publish: !!dom.byId('publishSchedule').checked, _row: row,
    };
}
/** BookingForm → 옛 화면 입력칸(같은 줄 수일 때) */
function applyForm(dom, form) {
    const set = (id, value) => { dom.byId(id).value = value; };
    Object.entries(form.guide).forEach(([k, val]) => set('g_' + k, val));
    Object.entries(form.vehicle).forEach(([k, val]) => set('v_' + k, val));
    form.lodges.forEach((l, i) => { const r = dom.lodges[i]; r.querySelector('[data-lk="day"]').value = l.day; r.querySelector('[data-lk="name"]').value = l.name; r.querySelector('[data-lk="grade"]').value = l.grade; r.querySelector('[data-lk="desc"]').value = l.desc; });
    form.travelers.forEach((t, i) => Object.entries(t).forEach(([k, val]) => { dom.travelers[i].querySelector(`[data-tk="${k}"]`).value = val; }));
    Object.entries(form.flight).forEach(([k, val]) => set('fl_' + k, val));
    set('bk_pickupLodge', form.pickupLodge); set('bk_travelerNote', form.travelerNote);
    Object.entries(form.contract).forEach(([k, val]) => set(k === 'packageType' ? 'ci_packageType' : 'ci_' + k, val));
    Object.entries(form.checklist).forEach(([k, val]) => { dom.byId('c_' + k).checked = val; });
    set('bk_notes', form.notes); set('bk_memo', form.memo); dom.byId('publishSchedule').checked = form.publish;
}
const strip = (form) => { const { _row, ...rest } = form; return rest; };

const LIBS = {
    guides: { 바야르: { nameEn: 'Bayar', role: '전문 가이드', phone: '+976 1111', qr: '/img/qr.png', img: '/img/g.webp', desc: '고비 전문' }, 토야: { nameEn: 'Tuya', phone: '+976 2222' } },
    vehicles: { 스타렉스: { seats: '9인', luggage: '캐리어 6개', plate: '12-34 УБ', desc: '편한 차량', img: '/img/v1.webp', imgs: ['/img/v1.webp', '/img/v2.webp'], driver: '바트', phone: '+976 3333' },
        하이에이스: { seats: '12인', img: '/img/h.webp', driver: '도르지' } },
    lodges: { '고비 캠프': { grade: '고급게르', region: '고비', img: '/img/c1.webp', imgs: ['/img/c2.webp'], tags: '샤워 O', desc: '사막 앞 캠프', address: '남고비', phone: '+976 4444' },
        '테를지 호텔': { grade: '호텔', region: '테를지', representativePhotos: ['/img/t1.webp'], desc: '산 옆 호텔' } },
};
const quote = { pax: 2, price: { deposit: 100000, balances: [{ pax: 2, economy: 900000, full: 1200000 }, { pax: 4, amount: 800000 }] },
    days: [{ d: 1, dest: '울란바타르', stay: { name: '테를지 호텔' }, items: ['도착'] }, { d: 2, dest: '고비', stay: { name: '고비 캠프<br>(고급)' } }, { d: 3, dest: '귀국', stay: { name: '숙소미포함' } }],
    highlights: [{ name: '바양작' }] };
const RECORDS = [
    { id: 'r-new', name: '김하나', status: '진행중', destination: '고비', depart: '2026-08-01', return_: '2026-08-04', adult: 2, quote, decision: { status: 'accepted' }, token: 'tok' },
    { id: 'r-full', name: '이둘', status: '예약확정', destination: '홉스골', depart: '2026-09-01', return_: '2026-09-03', adult: 1, child: 1, gerStay: '고급게르', quote, token: 't2', notify: { travelNoticeSentAt: '2026-08-20T01:00:00Z', travelNoticeSentCount: 2 },
        booking: { publishStatus: undefined, preparedAt: '2026-08-01', days: quote.days, highlights: [],
            assign: { guide: { name: '바야르', phone: '' }, vehicle: { model: '스타렉스', luggage: '', desc: '', driver: '예전 기사', driverPhone: '+976 9999' },
                lodges: [{ day: 1, name: '테를지 호텔', grade: '호텔', roomCount: 2, mailStatus: '1메일', bookingStatus: '예약완료', adminMemo: '내부' },
                    { day: 2, name: '', roomCount: 1 }, { day: 3, name: '옛 숙소', grade: '스위트', descCustom: '직접 쓴 설명' }, { day: 4, name: '', bookingStatus: '배정X' }] },
            travelers: [{ type: '성인', nameKo: '이둘', passportName: 'LEE DUL', gender: '남', passportNo: 'M1' }, { type: '아동', nameKo: '', passportName: '' }, { type: '유아', gender: '기타', phone: '010' }],
            flight: { inNo: 'OM310', inTime: '04:30' }, pickupLodge: ' 샹그릴라 ', travelerNote: '채식',
            contractInfo: { productName: '', totalAmount: 0, depositAmount: 200000, depositStatus: '입금완료', balanceStatus: '현장현금전달', cashReceipt: '예정', bankName: '', note: ' 비고 ' },
            contractPackageType: 'full', checklist: { flight: true, insurance: false, contract: false },
            contract: { signedAt: '2026-08-02T03:00:00Z', signImg: 'data:x' }, depositRequest: { status: 'requested' }, contractRequest: { status: 'requested' },
            notes: '픽업 4:30', adminMemo: '메모' } },
    { id: 'r-old', name: '', status: '신규', depart: 'bad', return_: '', booking: { days: [{}, {}], checklist: { deposit: true, balance: true }, assign: { lodges: [{ name: '고비 캠프' }] }, publishStatus: 'draft' } },
];

test('booking.js·lodging.js·quote-booking-workspace.js의 공유 규칙을 그대로 옮겼다', () => {
    const ctx = legacyContext();
    for (const r of RECORDS) {
        assert.deepEqual(plain(m.normBooking(structuredClone(r.booking))), plain(ctx.normBooking(structuredClone(r.booking))), 'normBooking ' + r.id);
        assert.deepEqual(m.seedBookingFromQuote(r), plain(ctx.seedBookingFromQuote(r)), 'seed ' + r.id);
        assert.deepEqual(m.quoteMoney(r), plain(ctx.quoteMoney(r)), 'money ' + r.id);
    }
    assert.deepEqual(m.normBooking(null), plain(ctx.normBooking(null)));
    assert.deepEqual(lodging.lodgingSnapshot(null, { name: 'x', secret: 1 }), plain(ctx.Lodging.snapshot(null, { name: 'x', secret: 1 })));
    for (const [name, lib] of Object.entries(LIBS.lodges)) {
        for (const previous of [{}, { name, img: '/old.webp', imgs: ['/a.webp'], roomCount: 3 }, { representativePhotos: ['/p.webp'], desc: '예전' }]) {
            assert.deepEqual(lodging.lodgingSnapshot(lib, previous), plain(ctx.Lodging.snapshot(lib, previous)), 'snapshot ' + name);
            assert.deepEqual(lodging.lodgingPublicData({ ...lib, secret: 1 }), plain(ctx.Lodging.publicData({ ...lib, secret: 1 })));
        }
    }
});

test('처음 열기·입력칸 값·입력칸 → 예약은 옛 init·render·pullForm·loadLibs와 같다', async () => {
    for (const r of RECORDS) {
        const ctx = legacyContext(LIBS);
        ctx.PRE = structuredClone(r);
        ctx.init();
        // 1) 등록 자원을 읽기 전: 처음 입력칸 값과 그 값으로 다시 읽은 예약
        const bk0 = m.prepareBooking(structuredClone(r));
        const form0 = m.formFromBooking(bk0, r);
        // init이 render 뒤 pullForm을 한 번 했으므로 같은 입력칸에서 다시 그려 비교한다
        const legacyForm = strip(domForm(ctx.dom));
        assert.deepEqual(form0, legacyForm, 'formFromBooking ' + r.id);
        const bk1 = m.pullBooking(bk0, form0, { guides: {}, lodges: {}, vehicles: {} });
        assert.deepEqual(plain(bk1), plain(ctx.BK), 'pull(빈 자원) ' + r.id);
        // 2) 등록 자원을 읽은 뒤: 비어 있던 고객 노출 칸 채우기 + 다시 읽기
        await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve));
        const form1 = m.fillFromLibraries(form0, bk1, LIBS);
        assert.deepEqual(form1, strip(domForm(ctx.dom)), 'fillFromLibraries ' + r.id);
        const bk2 = m.pullBooking(bk1, form1, LIBS);
        assert.deepEqual(plain(bk2), plain(ctx.BK), 'pull(자원) ' + r.id);
        assert.deepEqual(m.bookingDraftSnapshot(r, bk2), plain(ctx.bookingSnapshot()), 'draft ' + r.id);
        // 3) 고친 뒤: 숙소 이름 바꾸기·지우기·일차 바꾸기, 차량 바꾸기, 여행자·금액·상태·공개
        const edited = structuredClone(form1);
        edited.guide = m.guideFromLibrary('토야', LIBS);
        ctx.applyGuide('토야');
        edited.vehicle = m.vehicleFromLibrary('하이에이스', LIBS);
        ctx.applyVehicle('하이에이스');
        assert.deepEqual(strip(domForm(ctx.dom)).guide, edited.guide, 'applyGuide');
        assert.deepEqual(strip(domForm(ctx.dom)).vehicle, edited.vehicle, 'applyVehicle');
        if (edited.lodges[0]) edited.lodges[0] = { ...edited.lodges[0], name: '고비 캠프', day: '2' };
        if (edited.lodges[2]) edited.lodges[2] = { ...edited.lodges[2], name: ' ', desc: '' };
        if (edited.travelers[1]) edited.travelers[1] = { ...edited.travelers[1], nameKo: ' 아이 ', birth: '2020.01.01' };
        edited.contract = { ...edited.contract, depositStatus: '입금완료', balanceStatus: '현지현금전달', totalAmount: ' 1500000 ', packageType: 'value' };
        edited.checklist = { ...edited.checklist, insurance: true };
        edited.publish = !edited.publish;
        applyForm(ctx.dom, edited);
        ctx.pullForm();
        assert.deepEqual(plain(m.pullBooking(bk2, edited, LIBS)), plain(ctx.BK), 'pull(수정) ' + r.id);
    }
});

test('진행 단계·지금 할 일·아래 막대·바깥 요약은 옛 화면과 같다', () => {
    const variants = [];
    for (const r of RECORDS) {
        const base = m.pullBooking(m.prepareBooking(r), m.formFromBooking(m.prepareBooking(r), r), LIBS);
        variants.push([r, base]);
        for (const change of [
            { preparedAt: '' }, { depositRequest: { status: 'requested' } }, { depositRequest: { status: 'requested' }, depositReport: { status: 'reported', name: '김' } },
            { contractInfo: { ...base.contractInfo, depositStatus: '입금완료' } }, { contractInfo: { ...base.contractInfo, depositStatus: '입금완료' }, contractRequest: { status: 'requested' } },
            { contractInfo: { ...base.contractInfo, depositStatus: '입금완료' }, contract: { signedAt: 'x' } }, { publishStatus: 'published' }, { days: [] },
        ]) {
            variants.push([r, { ...base, ...change }]);
            variants.push([{ ...r, status: '예약확정' }, { ...base, ...change }]);
            variants.push([{ ...r, status: '신규', decision: null }, { ...base, ...change }]);
        }
    }
    for (const [r, bk] of variants) {
        const ctx = legacyContext(); ctx.PRE = structuredClone(r); ctx.BK = structuredClone(bk);
        assert.deepEqual(m.assignStats(r, bk), plain(ctx.assignStats()));
        const wf = m.workflowUi(r, bk), old = plain(ctx.workflowUi());
        const { icon: _icon, ...oldTask } = old.task;
        assert.deepEqual({ ...wf, task: wf.task }, { ...old, task: oldTask });
        ctx.updateActionBar();
        const bar = m.actionBar(r, bk), el = (id) => ctx.dom.byId(id);
        for (const [key, id] of [['deposit', 'depositRequestBtn'], ['contract', 'contractRequestBtn'], ['confirm', 'confirmBookingBtn'], ['publish', 'publishBtn']]) {
            assert.deepEqual(bar[key], { label: el(id).textContent, disabled: el(id).disabled, shown: el(id).style.display === '' }, key);
        }
        assert.deepEqual(bar.travelNotice, { label: el('travelNoticeBtn').textContent, title: el('travelNoticeBtn').title });
        assert.equal(bar.bottomStep, el('bottomStep').textContent); assert.equal(bar.bottomTask, el('bottomTask').textContent);
        assert.equal(bar.saveLabel, el('saveBtn').textContent); assert.equal(bar.saveSecondary, el('saveBtn').classList.contains('secondary'));
        assert.deepEqual(m.workspaceSnapshot(r, bk, m.assignStats(r, bk)), plain(ctx.QuoteBookingWorkspace.snapshot(r, bk, ctx.assignStats())));
    }
});

test('저장: 예약확정·공개 확인 문구, PATCH 본문, 성공 뒤 상태는 옛 saveBookingBody와 같다', async () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const r of RECORDS) for (const setStatus of [false, true]) for (const publish of [false, true]) for (const resetContract of [false, true]) {
        const base = m.pullBooking(m.prepareBooking(r), m.formFromBooking(m.prepareBooking(r), r), LIBS);
        const bk = { ...base, publishStatus: publish ? 'published' : 'draft' };
        const saved = { ...base, publishStatus: 'draft' };
        const ctx = legacyContext(); ctx.PRE = structuredClone(r); ctx.BK = structuredClone(bk); ctx.SAVED_BK_JSON = JSON.stringify(saved);
        ctx.pullForm = () => {}; ctx.render = () => {};
        ctx.dom.byId('setStatus').checked = setStatus;
        ctx.fetchResponse = async () => ({ ok: true, status: 200, json: async () => ({ ok: true, status: setStatus ? '예약확정' : undefined, preparedAt: '2026-01-01T00:00:00Z' }) });
        const ok = await ctx.saveBookingBody({ resetContract, quiet: true });
        const check = m.saveRequest(r, bk, saved, { setStatus, resetContract, today });
        const label = JSON.stringify([r.id, setStatus, publish, resetContract]);
        if (!check.ok) { assert.equal(ok, undefined, label); assert.equal(ctx.toasts.at(-1), '⚠ ' + check.error, label); continue; }
        assert.equal(ok, true, label);
        const sent = ctx.fetches.find(f => f.init?.method === 'PATCH').body;
        assert.deepEqual(plain(check.patch), sent, label);
        const after = m.afterSave(r, check.booking, { ok: true, status: setStatus ? '예약확정' : undefined, preparedAt: '2026-01-01T00:00:00Z' }, check.patch);
        assert.equal(after.pre.status, ctx.PRE.status, label);
        assert.equal(after.booking.preparedAt, ctx.BK.preparedAt, label);
    }
});

test('입력 도우미·단계 요청 확인·고객 링크', () => {
    assert.deepEqual(m.lodgesFromDays(quote.days), [{ day: 1, name: '테를지 호텔', grade: '' }, { day: 2, name: '고비 캠프 (고급)', grade: '' }]);
    assert.deepEqual(m.lodgeFromLibrary({ day: '1', name: '', grade: '', desc: '쓰던 설명' }, '고비 캠프', LIBS), { day: '1', name: '고비 캠프', grade: '고급게르', desc: '' });
    assert.deepEqual(m.lodgeFromLibrary({ day: '1', name: '', grade: '호텔', desc: '' }, '없는 숙소', LIBS), { day: '1', name: '없는 숙소', grade: '호텔', desc: '' });
    const spots = { 바양작: { nameMn: 'Баянзаг', desc: '붉은 절벽', img: '/b.webp' }, 홍고린엘스: { subImgs: ['/1', '/2'] } };
    let h = m.toggleHighlight([], '바양작', spots);
    h = m.toggleHighlight(h, '홍고린엘스', spots);
    assert.deepEqual(h, [{ nameMn: 'Баянзаг', name: '바양작', desc: '붉은 절벽', img: '/b.webp', subImgs: ['', '', '', ''] }, { nameMn: '', name: '홍고린엘스', desc: '', img: '', subImgs: ['/1', '/2'] }]);
    assert.deepEqual(m.toggleHighlight(h, '바양작', spots).map(x => x.name), ['홍고린엘스']);
    assert.equal(m.stageRequestError('deposit', { contractInfo: { depositAmount: 0 } }), '예약금·은행·계좌번호·예금주를 모두 입력해 주세요');
    assert.equal(m.stageRequestError('deposit', { contractInfo: { depositAmount: 1, bankName: 'a', accountNumber: 'b', accountHolder: 'c' } }), '');
    assert.equal(m.stageRequestError('contract', { contractInfo: { depositStatus: '미입금' } }), '예약금 입금 확인 후 계약서 요청이 가능합니다');
    assert.match(m.travelNoticeError('template not set'), /SOLAPI_TEMPLATE_TRAVEL_NOTICE_ID/);
    assert.match(m.travelNoticeError('invalid phone'), /고객 연락처가 등록되어 있지 않아요/);
    assert.equal(m.travelNoticeError('기타'), '기타');
    const links = m.bookingLinks({ id: 'a b', token: 't/1' });
    assert.equal(links.customer, '/%EB%82%B4%EA%B2%AC%EC%A0%81.html?t=t/1', '옛 고객 링크 복사와 같은 주소');
    assert.equal(links.contract, '/계약서.html?t=t%2F1&adminId=a%20b&return=manage');
    assert.deepEqual(m.bookingLinks({ id: 'x' }), { customer: '', confirm: '', contract: '' });
    const restored = m.restoreBookingDraft({ id: 'x', name: '옛 이름' }, { contract: { signedAt: '지금 서명' } }, { days: [{}], contract: { signedAt: '초안 서명' }, _requestFields: { name: '초안 이름', adult: 3 } });
    assert.equal(restored.bk.contract.signedAt, '지금 서명', '서명 원본은 초안으로 덮지 않는다');
    assert.equal(restored.pre.name, '초안 이름'); assert.equal(restored.pre.adult, 3); assert.equal(restored.bk._requestFields, undefined);
});
