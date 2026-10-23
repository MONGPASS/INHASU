import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const result = await build({ stdin: { contents: `export {Reservation} from './src/pages/Reservation.tsx';export {BookingPeopleCard} from './src/components/reservation-shared/BookingStepOne.tsx';export {PriceTableDialog} from './src/components/reservation-shared/PriceTableDialog.tsx';`, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false, loader: { '.webp': 'empty', '.css': 'empty' }, define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'reservation-controller-boundaries', setup(builder) {
        for (const filter of [/^react$/, /^react\/jsx-runtime$/, /^react-router-dom$/, /^react-i18next$/, /\/lib\/api$/, /\/seo\/SEO$/, /\/hooks\/useIsDesktop$/, /\/ReservationDesktop$/, /\/ReservationMobile$/, /\/BookingFallback$/]) builder.onResolve({ filter }, args => ({ path: args.path, namespace: 'reservation-controller' }));
        builder.onLoad({ filter: /.*/, namespace: 'reservation-controller' }, ({ path }) => ({ loader: 'js', contents:
            path === 'react' ? `export const useState=(...a)=>globalThis.h.useState(...a),useEffect=(...a)=>globalThis.h.useEffect(...a),useMemo=f=>f(),useRef=v=>({current:v}),createContext=v=>({value:v}),useContext=c=>c.value;export default {useMemo};`
                : path === 'react/jsx-runtime' ? `export const Fragment='fragment';export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`
                : path === 'react-router-dom' ? `export const useParams=()=>({id:'healing'});export const useNavigate=()=>globalThis.navigate;`
                : path === 'react-i18next' ? `export const useTranslation=()=>({t:key=>key});`
                : path.endsWith('/lib/api') ? `export const api=globalThis.api;`
                : path.endsWith('/hooks/useIsDesktop') ? `export const useIsDesktop=()=>globalThis.desktop;`
                : path.endsWith('/BookingFallback') ? `export const BookingFallback='fallback';`
                : path.endsWith('/ReservationDesktop') ? `export const ReservationDesktop='desktop';`
                : path.endsWith('/ReservationMobile') ? `export const ReservationMobile='mobile';`
                : `export const SEO='seo';` }));
    } }],
});
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const content = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(content).join('') : content(node?.props?.children ?? '');
const tier = people => ({ people, pricePerPerson: 50000, depositPerPerson: 540000, localPaymentPerPerson: 0 });

function mount({ people = ['4', '2'], desktop = true, draftPeople, rates } = {}) {
    const source = { id: 'healing', name: '은하수 힐링', duration: '1박 2일', pricing_options: JSON.stringify(rates ?? people.map(tier)), accommodation_options: '[]', vehicle_options: '[]' };
    const state = [], effects = new Map(), queue = [], navigated = [], module = { exports: {} }; let cursor = 0;
    const storage = new Map(draftPeople ? [['mw-booking-draft:healing', JSON.stringify({ totalPeople: draftPeople, selectedAccomId: '', selectedVehicleId: '', startDate: null })]] : []);
    const context = { module, exports: module.exports, desktop, console: { error() {} }, api: { products: { get: async () => source } }, navigate: (...args) => navigated.push(args),
        sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
        h: { useState(initial) { const index = cursor++; if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; },
            useEffect(fn, deps) { const index = cursor++, before = effects.get(index); if (!before || deps.some((value, key) => value !== before[key])) { effects.set(index, deps); queue.push(fn); } } },
    };
    vm.runInNewContext(result.outputFiles[0].text, context);
    const render = () => { cursor = 0; return nodes(module.exports.Reservation()).find(node => ['desktop', 'mobile', 'fallback'].includes(node.type)); };
    const settle = async () => { render(); for (const effect of queue.splice(0)) effect(); await new Promise(setImmediate); return render(); };
    const peopleCard = props => module.exports.BookingPeopleCard({ pc: desktop, tiers: [...props.product.pricingOptions].sort((a, b) => a.people - b.people), totalPeople: props.totalPeople, setTotalPeople: props.setTotalPeople, baseOption: props.baseOption, onShowPrices() {} });
    const dialog = props => module.exports.PriceTableDialog({ pc: desktop, options: props.product.pricingOptions, current: props.totalPeople, onChange: props.setTotalPeople, onClose() {} });
    return { source, navigated, render, settle, peopleCard, dialog };
}

test('기존 문자열 인원 요금표는 예약 초기 인원과 PC·모바일 인원 선택에서 정상 계산한다', async () => {
    for (const desktop of [true, false]) {
        const h = mount({ desktop }); let view = await h.settle();
        assert.equal(view.type, desktop ? 'desktop' : 'mobile');
        assert.equal(view.props.totalPeople, 2); assert.equal(typeof view.props.totalPeople, 'number');
        assert.deepEqual([...view.props.product.pricingOptions].map(option => option.people), [4, 2]);
        assert.equal(view.props.priceBreakdown.deposit, 100000);
        const four = nodes(h.peopleCard(view.props)).find(node => node.type === 'button' && content(node).startsWith('4명'));
        assert.ok(four); four.props.onClick(); view = h.render();
        assert.equal(view.props.totalPeople, 4); assert.equal(view.props.priceBreakdown.deposit, 200000);
        const decrease = nodes(h.peopleCard(view.props)).find(node => node.props?.['aria-label'] === '줄이기');
        decrease.props.onClick(); view = h.render();
        assert.equal(view.props.totalPeople, 2);
        const dialogFour = nodes(h.dialog(view.props)).find(node => node.type === 'button' && content(node).startsWith('4명'));
        assert.ok(dialogFour); dialogFour.props.onClick(); view = h.render();
        assert.equal(view.props.totalPeople, 4); assert.equal(view.props.priceBreakdown.total, 200000);
    }
});

test('문자열 인원 요금표에서도 기존 숫자 초안을 복원하고 잘못된 인원은 임의 변환하지 않는다', async () => {
    const restored = await mount({ draftPeople: 4 }).settle();
    assert.equal(restored.props.totalPeople, 4); assert.equal(restored.props.priceBreakdown.deposit, 200000);
    for (const invalid of ['', ' ', null, false, true, '2.5', '0', '-2', '9007199254740992']) {
        const h = mount({ people: [invalid] }), view = await h.settle();
        assert.equal(view.type, 'fallback', `잘못된 인원 ${JSON.stringify(invalid)}`);
        assert.match(view.props.text, /인원|가격/);
    }
});

test('일부 0원·손상된 구간이 있어도 예약은 대표가격과 같은 유효 인원 구간에서 시작한다', async () => {
    const rates = [{ ...tier(2), pricePerPerson: 0 }, { ...tier(0), pricePerPerson: 1 },
        { people: '6', price_per_person: '400000', deposit_per_person: '50000', local_payment_per_person: '350000' }];
    for (const desktop of [true, false]) {
        const view = await mount({ desktop, rates, draftPeople: 2 }).settle();
        assert.equal(view.type, desktop ? 'desktop' : 'mobile');
        assert.equal(view.props.totalPeople, 6);
        assert.equal(view.props.baseOption.pricePerPerson, 400000);
        assert.equal(view.props.priceBreakdown.total, 2400000);
        assert.equal(view.props.priceBreakdown.deposit, 300000);
        assert.equal(view.props.product.pricingOptions.length, 1);
    }
    assert.equal((await mount({ rates: [{ ...tier(2), pricePerPerson: 0 }] }).settle()).type, 'fallback');
});
