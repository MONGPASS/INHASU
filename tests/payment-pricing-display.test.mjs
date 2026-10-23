import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { resolveBookingPricing } from '../src/utils/bookingPricing.ts';

const components = await build({ stdin: { contents: `export {PaymentDesktop} from './src/components/reservation-desktop/PaymentDesktop.tsx';export {PaymentMobile} from './src/components/reservation-mobile/PaymentMobile.tsx';`, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false, external: ['react', 'react/jsx-runtime'], loader: { '.webp': 'empty', '.css': 'empty' }, define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'payment-display-boundaries', setup(builder) {
        builder.onResolve({ filter: /\/ReservationShell$|\/MobileShell$/ }, () => ({ path: 'shell', namespace: 'payment-display' }));
        builder.onLoad({ filter: /.*/, namespace: 'payment-display' }, () => ({ loader: 'js', contents: `import{createElement}from'react';export const ReservationShell=({children})=>createElement('main',null,children);export const MobileShell=({children,bottomBar})=>createElement('main',null,children,bottomBar);` }));
    } }],
});
const renderedModule = { exports: {} };
vm.runInNewContext(components.outputFiles[0].text, { module: renderedModule, exports: renderedModule.exports, require: createRequire(import.meta.url) });
const product = { id: 'healing', name: '은하수 힐링', pricingOptions: [{ people: 2, pricePerPerson: 50000, depositPerPerson: 540000, localPaymentPerPerson: 0 }] };
const props = () => ({ product, ...resolveBookingPricing(product, 2), isQuote: false, selectedStartDate: new Date('2026-10-28T00:00:00'), endDate: new Date('2026-10-29T00:00:00'), nights: 1, days: 2, totalPeople: 2, customerInfo: { name: '', phone: '', email: '' }, memo: '', agreeToTerms: false, isProcessing: false, fieldError: null, setCustomerInfo() {}, setMemo() {}, setAgreeToTerms() {}, onFieldEdit() {}, onSubmit() {}, onBack() {} });

test('결제의 금액 카드·계좌 안내·요약과 모바일 하단에 같은 예약금 100,000원을 표시한다', () => {
    for (const [name, occurrences] of [['PaymentDesktop', 3], ['PaymentMobile', 4]]) {
        const html = renderToStaticMarkup(React.createElement(renderedModule.exports[name], props()));
        assert.ok(!html.includes('1,080,000')); assert.ok(!html.includes('540,000'));
        assert.match(html, /1인당 50,000원 × 2명/);
        // Total lines also show 100,000, so require each specific booking deposit label.
        assert.ok((html.match(/100,000원/g) || []).length >= occurrences);
        assert.match(html, /입금할 예약금/); assert.match(html, /예약금\(계좌이체\)/);
        assert.match(html, /잔금\(현지 현금\).*?0원/s);
    }
});

const controller = await build({ entryPoints: [fileURLToPath(new URL('../src/pages/Payment.tsx', import.meta.url))], bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false, define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'payment-controller-boundaries', setup(builder) {
        for (const filter of [/^react$/, /^react\/jsx-runtime$/, /^react-router-dom$/, /^react-i18next$/, /\/lib\/api$/, /\/lib\/email$/, /\/seo\/SEO$/, /\/hooks\/useIsDesktop$/, /\/PaymentDesktop$/, /\/PaymentMobile$/, /\/BookingFallback$/]) builder.onResolve({ filter }, args => ({ path: args.path, namespace: 'payment-controller' }));
        builder.onLoad({ filter: /.*/, namespace: 'payment-controller' }, ({ path }) => ({ loader: 'js', contents:
            path === 'react' ? `export const useState=(...a)=>globalThis.h.useState(...a),useEffect=()=>{},useMemo=f=>f();export default {useMemo};`
                : path === 'react/jsx-runtime' ? `export const Fragment='fragment';export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`
                : path === 'react-router-dom' ? `export const useLocation=()=>({state:globalThis.data});export const useNavigate=()=>globalThis.navigate;`
                : path === 'react-i18next' ? `export const useTranslation=()=>({t:key=>key});`
                : path.endsWith('/lib/api') ? `export const api=globalThis.api;`
                : path.endsWith('/lib/email') ? `export const sendNotificationEmail=(...args)=>globalThis.sendEmail(...args);`
                : path.endsWith('/hooks/useIsDesktop') ? `export const useIsDesktop=()=>true;`
                : path.endsWith('/BookingFallback') ? `export const BookingFallback='fallback';`
                : path.endsWith('/PaymentDesktop') ? `export const PaymentDesktop='desktop';`
                : path.endsWith('/PaymentMobile') ? `export const PaymentMobile='mobile';`
                : `export const SEO='seo';` }));
    } }],
});
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
function mount({ quote = false, rejection, prices = { total: 100000, deposit: 90000, local: 10000 } } = {}) {
    const saved = [], emails = [], navigated = [], state = [], module = { exports: {} }; let cursor = 0;
    const context = { module, exports: module.exports, console: { error() {} }, sessionStorage: { removeItem() {} }, data: { product: quote ? { id: 'quote', name: '맞춤 여행' } : product, totalPeople: 2, selectedStartDate: new Date('2026-10-28T00:00:00'), parsedDuration: { nights: 1, days: 2 }, priceBreakdown: { total: 100000, deposit: 1080000, local: 0 }, isQuote: quote },
        api: { auth: { me: async () => ({ id: 'customer' }) }, reservations: { create: async body => { saved.push(JSON.parse(JSON.stringify(body))); if (rejection) throw rejection; return { id: 'booking', priceBreakdown: prices }; } } },
        navigate: (...args) => navigated.push(args), sendEmail: async (...args) => emails.push(args),
        h: { useState: initial => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], change => { state[index] = typeof change === 'function' ? change(state[index]) : change; }]; } },
    };
    vm.runInNewContext(controller.outputFiles[0].text, context);
    const render = () => { cursor = 0; return nodes(module.exports.Payment()).find(node => node.type === 'desktop' || node.type === 'fallback'); };
    const prepare = () => { const view = render(); view.props.setCustomerInfo({ name: '고객', phone: '01000000000', email: 'customer@example.invalid' }); view.props.setAgreeToTerms(true); return render(); };
    return { context, saved, emails, navigated, render, prepare };
}

test('이전 화면의 오래된 계산을 결제에서 다시 계산하고 옵션 ID와 함께 보내며 저장된 금액으로 알린다', async () => {
    const h = mount(), view = h.prepare();
    assert.deepEqual(JSON.parse(JSON.stringify(view.props.priceBreakdown)), { total: 100000, deposit: 100000, local: 0 });
    await view.props.onSubmit();
    assert.equal(h.saved[0].price_breakdown.deposit, 100000);
    assert.equal(h.saved[0].selected_accom_id, ''); assert.equal(h.saved[0].selected_vehicle_id, '');
    assert.equal(h.emails[0][2].depositAmount, '90,000'); assert.equal(h.emails[0][2].localAmount, '10,000');
    assert.equal(h.navigated[0][0], '/reservation-complete');
});

test('요금 변경 409는 서버의 안내와 상품 재선택 안내를 보여 주며 성공 알림을 보내지 않는다', async () => {
    const h = mount({ rejection: Object.assign(new Error('상품 가격이 변경되었습니다.'), { status: 409 }) });
    await h.prepare().props.onSubmit();
    const message = h.render().props.fieldError.msg;
    assert.match(message, /상품 가격이 변경되었습니다/); assert.match(message, /인원과 옵션을 다시 선택/);
    assert.equal(h.emails.length, 0); assert.equal(h.navigated.length, 0);
});

test('견적 예약은 상품 요금표로 덮어쓰지 않고 잘못된 상품 가격은 0원으로 진행하지 않는다', () => {
    const quote = mount({ quote: true });
    assert.equal(quote.render().props.priceBreakdown.deposit, 1080000);
    const broken = mount(); broken.context.data.product = { ...product, pricingOptions: [] };
    const fallback = broken.render(); assert.equal(fallback.type, 'fallback'); assert.match(fallback.props.text, /인원별 가격/);
});
