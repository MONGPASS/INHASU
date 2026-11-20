// 맞춤 견적의 전체 흐름(문의 → 견적 → 예약 진행 → 입금 확인 → 서명 → 여행자 정보 → 예약확정 → 배정 → 일정표 공개)을
// 실제 Pages 함수와 메모리 SQLite로 순서대로 실행한다. 고객 알림은 Solapi 경계에서 가짜로 받아 단계별 종류만 확인한다.
// 운영 DB·실제 발송은 쓰지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { onRequestPost as createRequest } from '../functions/api/requests.js';
import { onRequestPatch as patchRequest } from '../functions/api/requests/[id].js';
import { onRequestGet as myGet } from '../functions/api/my/[token].js';
import { onRequestPost as depositPost } from '../functions/api/deposit/[token].js';
import { onRequestPost as signPost } from '../functions/api/sign/[token].js';
import { onRequestPost as travelersPost } from '../functions/api/travelers/[token].js';
import { requestSQLite } from './helpers/request-sqlite.mjs';
import { customerIdentity } from './helpers/customer-session.mjs';
import { seedBookingFromQuote as serverSeed } from '../functions/lib/quoteBookingSeed.mjs';

const root = new URL('../', import.meta.url);
const bundled = await esbuild.build({ entryPoints: [fileURLToPath(new URL('src/utils/quoteCustomerWorkspace.ts', root))], bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent' });
const modelFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'quote-flow-')), 'model.mjs');
fs.writeFileSync(modelFile, bundled.outputFiles[0].text);
const { quoteCustomerWorkspaceModel } = await import(pathToFileURL(modelFile).href);
// 견적관리 [예약 진행 기록]은 브라우저의 booking.js로 예약 정보를 만든다. 같은 코드를 그대로 쓴다.
const bookingContext = { window: {}, console }; vm.createContext(bookingContext);
vm.runInContext(fs.readFileSync(new URL('public/booking.js', root), 'utf8') + '\nthis.seed = seedBookingFromQuote;', bookingContext);

const kinds = ['request_received', 'quote', 'reservation_requested', 'change_requested', 'deposit_requested', 'travelers_requested', 'contract', 'contract_signed', 'booking_confirmed', 'itinerary', 'travel_notice'];
const config = { ADMIN_TOKEN: 'local-admin', SOLAPI_API_KEY: 'local-key', SOLAPI_API_SECRET: 'local-secret', SOLAPI_PF_ID: 'local-profile',
    ...Object.fromEntries(kinds.map(kind => [`SOLAPI_TEMPLATE_${kind.toUpperCase()}_ID`, `local-${kind}`])) };

function flow(t) {
    const DB = requestSQLite(t, null, { skipInsert: true }), env = { ...config, DB }, sent = [], pending = [];
    const customer = customerIdentity(DB, { user: 'flow-customer' });
    const original = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
        assert.equal(url, 'https://api.solapi.com/messages/v4/send');
        sent.push(String(JSON.parse(init.body).message.kakaoOptions.templateId).replace('local-', ''));
        return Response.json({ groupId: 'local-' + sent.length, statusCode: '2000' });
    };
    t.after(() => { globalThis.fetch = original; });
    const state = { id: '', token: '' };
    const waitUntil = task => { pending.push(Promise.resolve(task)); };
    const settle = async () => { while (pending.length) await Promise.allSettled(pending.splice(0)); };
    const take = () => sent.splice(0);
    const record = () => DB.records.find(row => row.id === state.id);
    // 견적서 알림이 발송 서비스에 접수된 것으로 본다(실제 화면은 발송 이력에서 읽는다).
    const model = () => quoteCustomerWorkspaceModel(record(), { deliveryHistory: record()?.quote ? [{ id: 'quote-1', kind: 'quote', channel: 'alimtalk', state: 'accepted', at: '2027-01-01T00:00:00.000Z' }] : [] });
    const patch = async body => {
        const response = await patchRequest({ request: new Request(`https://local.invalid/api/requests/${state.id}`, { method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-admin-token': 'local-admin' }, body: JSON.stringify(body) }), env, params: { id: state.id }, waitUntil });
        const json = await response.json(); await settle(); return { ...json, http: response.status };
    };
    const asCustomer = async (handler, body) => {
        const response = await handler({ request: new Request(`https://local.invalid/api/customer/${state.token}`, { method: body ? 'POST' : 'GET',
            headers: { ...customer, ...(body ? { 'Content-Type': 'application/json', Origin: 'https://local.invalid' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }),
        env, params: { token: state.token }, waitUntil });
        const json = await response.json(); await settle(); return { ...json, http: response.status };
    };
    const create = async () => {
        const response = await createRequest({ request: new Request('https://local.invalid/api/requests', { method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: 'https://local.invalid', ...customer },
            body: JSON.stringify({ name: '흐름 고객', phone: '01012345678', email: 'flow@example.invalid', depart: '2027-04-03', return_: '2027-04-05', adult: 2,
                destination: '중앙몽골', tripType: '맞춤', cityStay: '호텔', gerStay: '게르', vehicle: '전용 차량(4인)', flightIssued: '미발권', agree: true }) }), env, waitUntil });
        const json = await response.json(); await settle();
        assert.equal(response.status, 200); state.id = json.id; state.token = record().token;
    };
    return { take, record, model, patch, asCustomer, create, my: () => asCustomer(myGet) };
}

const quote = { customer: '흐름 고객', period: '2027-04-03 ~ 2027-04-05', pax: 2, highlights: [],
    price: { deposit: 100000, balances: [{ pax: 2, economy: 500000, full: 700000 }], options: [] },
    days: [{ d: 1, dest: '테를지', items: ['가이드 미팅', '거북바위'] }, { d: 2, dest: '테를지', items: ['승마'] }, { d: 3, dest: '칭기스칸 국제공항', items: ['출국'] }] };
const done = m => Object.fromEntries((m.steps || []).map(step => [step.id, !!step.done]));
// 고객 통합 작업의 7단계 중 지금 단계와 그 단계의 버튼
const now7 = m => ({ step: m.flow.steps[m.flow.current]?.id || 'done', action: m.flow.next.primary?.action || '' });

test('서버 예약 승계(acceptQuote)가 견적관리 booking.js와 같은 예약을 만든다', () => {
    const records = [
        { destination: '중앙몽골', depart: '2027-04-03', return_: '2027-04-05', adult: 2, quote },
        { destination: '고비', depart: '2027-05-01', return_: '2027-05-06', adult: 3, child: 1, gerStay: '고급 게르', quote: { ...quote, pax: 0, highlights: [{ name: '바양작' }],
            price: { deposit: 150000, balances: [{ pax: 3, economy: 800000, full: 990000 }, { pax: 5, amount: 700000 }] } } },
        { destination: '홉스골', adult: 1, pkgTier: '풀패키지', quote: { pax: 1, price: { deposit: 0, balances: [] }, days: [] } },
        { destination: '테를지', adult: 2 },
    ];
    for (const record of records) assert.deepEqual(serverSeed(record), JSON.parse(JSON.stringify(bookingContext.seed(record))));
});

for (const mode of ['입금 확인 버튼', '예약금 상태만 저장']) {
    test(`맞춤 견적 전체 흐름이 일정표 공개까지 이어진다 (${mode})`, async t => {
        const f = flow(t);
        await f.create();
        assert.deepEqual(f.take(), ['request_received']);

        const quick = mode === '입금 확인 버튼';
        assert.deepEqual(now7(f.model()), { step: 'quote', action: 'quote-edit' });
        let r = await f.patch({ quote, status: '진행중' });
        assert.equal(r.workflowStatus, 'QUOTE_SENT'); assert.deepEqual(f.take(), ['quote']);
        assert.ok((await f.my()).quote, '고객이 링크로 견적서를 본다');
        assert.deepEqual(now7(f.model()), { step: 'answer', action: 'accept-quote' });

        // 고객이 카카오톡으로 진행 의사를 알리면 관리자가 [고객이 예약하겠대요](고객 통합 작업) 또는 [예약 진행 기록](견적관리)
        // — 예약금·계좌가 담긴 예약이 만들어진다.
        if (quick) {
            r = await f.patch({ acceptQuote: true });
            assert.equal((await f.patch({ acceptQuote: true })).http, 200, '두 번 눌러도 그대로');
        } else {
            const now = new Date().toISOString(), booking = bookingContext.seed(f.record());
            r = await f.patch({ decision: { status: 'accepted', acceptedAt: now, source: 'admin' },
                booking: { ...booking, preparedAt: now, depositRequest: { status: 'requested', requestedAt: now, source: 'admin_accept' } } });
        }
        assert.equal(r.workflowStatus, 'DEPOSIT_REQUESTED'); assert.deepEqual(f.take(), ['reservation_requested']);
        assert.equal(f.record().booking.contractInfo.depositAmount, 200000); assert.ok(f.record().booking.contractInfo.accountNumber);
        assert.equal(f.record().booking.depositRequest.status, 'requested');
        assert.equal(f.model().statusLabel, '입금 대기');
        assert.deepEqual(now7(f.model()), { step: 'deposit', action: 'confirm-deposit' });
        const waiting = await f.my();
        assert.equal(waiting.booking.contractInfo.depositAmount, 200000); assert.ok(waiting.booking.contractInfo.accountNumber, '고객 화면에 입금 계좌가 보인다');

        r = await f.asCustomer(depositPost, { name: '흐름고객' });
        assert.equal(r.http, 200); assert.deepEqual(f.take(), [], '입금 신고는 고객 알림을 보내지 않는다');

        // 관리자 입금 확인: 두 방식 모두 계약서 서명 요청이 기록되고 안내가 한 번 나간다.
        assert.match(f.model().flow.next.title, /입금했다고/, '입금 신고가 지금 할 일에 보인다');
        if (quick) r = await f.patch({ confirmDeposit: true });
        else { const paid = f.record().booking; paid.contractInfo.depositStatus = '입금완료'; r = await f.patch({ booking: paid }); }
        assert.equal(r.contractRequest?.status, 'requested'); assert.deepEqual(f.take(), ['contract']);
        assert.deepEqual(done(f.model()), { accepted: true, deposit: true, contract: false, schedule: true, published: false });
        assert.deepEqual(now7(f.model()), { step: 'sign', action: 'notify-contract' }); assert.equal(f.model().flow.next.waiting, true);
        const signable = await f.my();
        assert.equal(signable.booking.contractInfo.depositStatus, '입금완료');
        assert.equal(signable.booking.contractRequest.status, 'requested', '고객 화면에 서명 버튼이 열린다');

        r = await f.asCustomer(signPost, { agree: true, signerName: '흐름 고객', signImg: 'data:image/png;base64,' + 'A'.repeat(300) });
        assert.equal(r.http, 200); assert.deepEqual(f.take().sort(), ['contract_signed', 'travel_notice']);

        r = await f.patch({ notifyTravelers: true }); assert.equal(r.http, 200); assert.deepEqual(f.take(), ['travelers_requested']);
        r = await f.asCustomer(travelersPost, { consent: true, travelers: [
            { nameKo: '흐름 고객', passportName: 'FLOW CUSTOMER', birth: '1990-01-01', phone: '01012345678', gender: '남', passportNo: 'M00000001' },
            { nameKo: '동행', passportName: 'FLOW MATE', birth: '1991-02-02', phone: '01087654321', gender: '여', passportNo: 'M00000002' }] });
        assert.equal(r.http, 200);

        assert.deepEqual(now7(f.model()), { step: 'confirm', action: 'confirm-booking' });
        r = await f.patch({ status: '예약확정' });
        assert.equal(r.workflowStatus, 'BOOKING_CONFIRMED'); assert.deepEqual(f.take(), ['booking_confirmed']);

        // 배정 전에는 공개할 수 없고, 가이드·차량·숙박 수만큼 숙소를 배정하면 공개된다.
        assert.deepEqual(now7(f.model()), { step: 'assign', action: 'assignments' });
        r = await f.patch(quick ? { publishItinerary: true } : { booking: { ...f.record().booking, publishStatus: 'published' } });
        assert.equal(r.http, 409); assert.equal(r.code, 'publish_not_ready');
        const assigned = f.record().booking;
        assigned.assign = { ...(assigned.assign || {}), guide: { name: '등록 가이드' }, vehicle: { model: '스타렉스' }, lodges: [{ day: 1, name: '테를지 게르' }, { day: 2, name: '테를지 게르' }] };
        assert.equal((await f.patch({ booking: assigned })).http, 200);
        assert.deepEqual(now7(f.model()), { step: 'publish', action: 'publish-itinerary' });
        r = await f.patch(quick ? { publishItinerary: true } : { booking: { ...f.record().booking, publishStatus: 'published' } });
        assert.equal(r.workflowStatus, 'ITINERARY_PUBLISHED'); assert.deepEqual(f.take(), ['itinerary']);
        assert.ok(Object.values(done(f.model())).every(Boolean), '관리자 업무 단계가 모두 완료된다');
        assert.equal(f.model().flow.current, 7); assert.equal(f.model().flow.next.primary, undefined);
        assert.equal((await f.my()).booking.publishStatus, 'published');
    });
}
