import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { productPriceLabel, productPriceBasis, withPublicProductPrice } from '../src/utils/publicProductPrice.ts';

const result = await build({ stdin: { contents: `
export {TourCardDesktop} from './src/components/tours-desktop/TourCardDesktop.tsx';
export {TourCardMobile} from './src/components/tours-mobile/TourCardMobile.tsx';
export {TourGridCardMobile,TourRowCardMobile} from './src/components/home-mobile/TourCard.mobile.tsx';
export {ProductCard} from './src/components/product/ProductCard.tsx';
export {PCard} from './src/components/desktop-primitives/PCard.tsx';
export {WishlistSection,RecentSection} from './src/components/mypage-desktop/MyPageSections.tsx';
export {TripCardM} from './src/components/mylists-mobile/myListsUi.tsx';
export {productCard,groupRecentByDay} from './src/components/mylists-mobile/myListsData.ts';
export {sortTours,matchFilters,EMPTY_FILTERS} from './src/components/tours-mobile/tourListFilters.ts';
export {toTourProduct} from './src/components/category/categoryContent.ts';
export {useHomeData} from './src/hooks/useHomeData.ts';
export {useRelatedTourMatches} from './src/components/magazine/relatedTourMatches.ts';`, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false, external: ['react', 'react/jsx-runtime'], loader: { '.webp': 'empty', '.jpg': 'empty', '.png': 'empty', '.css': 'empty' }, define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'public-price-boundaries', setup(builder) {
        for (const filter of [/^react-router-dom$/, /^react-i18next$/, /^@tanstack\/react-query$/, /\/hooks\/useWishlist$/, /\/lib\/api$/]) builder.onResolve({ filter }, args => ({ path: args.path, namespace: 'public-price' }));
        builder.onLoad({ filter: /.*/, namespace: 'public-price' }, ({ path }) => ({ loader: 'js', contents:
            path === 'react-router-dom' ? `export const useNavigate=()=>()=>{};export const useLocation=()=>({pathname:'/products'});export const Link='a';`
                : path === 'react-i18next' ? `export const useTranslation=()=>({t:key=>key});`
                : path === '@tanstack/react-query' ? `export const useQuery=options=>{globalThis.queries.push(options);return {data:options.queryKey.includes('related-tours')?globalThis.products:undefined};};export const useQueryClient=()=>({});export const useIsFetching=()=>false;`
                : path.endsWith('/hooks/useWishlist') ? `export const useWishlist=()=>({ids:[],has:()=>false,toggle(){}});`
                : `export const api={products:{summary:async()=>globalThis.products,list:async()=>globalThis.products},banners:{get:async()=>({})},magazines:{list:async()=>[]},categories:{list:async()=>[]}};` }));
    } }],
});
const plain = value => JSON.parse(JSON.stringify(value));
const tier = (people, pricePerPerson) => ({ people, pricePerPerson, depositPerPerson: 50000, localPaymentPerPerson: Math.max(0, Number(pricePerPerson) - 50000) });
const tour = (id, overrides = {}) => ({ id, name: '몽골 여행', category: '중앙몽골', duration: '3박 4일', price: 1234, originalPrice: 99999999, status: 'active', tags: [], isPopular: false, isFeatured: false, packageType: null, mainImages: ['/photo.webp'], pricingOptions: [tier(2, 900000), tier(8, 400000), tier(6, 400000)], ...overrides });
function setup(products = [tour('priced')]) {
    const module = { exports: {} }, context = { module, exports: module.exports, require: createRequire(import.meta.url), products, queries: [], console, setTimeout, clearTimeout };
    vm.runInNewContext(result.outputFiles[0].text, context);
    return { exports: module.exports, context, render: (name, props) => renderToStaticMarkup(React.createElement(module.exports[name], props)) };
}

test('대표가격에는 1인 금액과 동일한 인원 조건이 붙고 별도 판매가·0원으로 되돌아가지 않는다', () => {
    const product = tour('priced');
    assert.equal(productPriceLabel(product), '1인 400,000원부터'); assert.equal(productPriceBasis(product), '6명 기준 · 기본요금');
    const projected = withPublicProductPrice(product);
    assert.equal(projected.price, 400000); assert.equal(projected.priceBasisPeople, 6); assert.equal(projected.priceReady, true);
    const compact = { startingPrice: projected.startingPrice, priceBasisPeople: projected.priceBasisPeople, priceReady: projected.priceReady };
    assert.equal(productPriceLabel(compact), '1인 400,000원부터');
    for (const invalid of [{ price: 1234 }, { ...compact, pricingOptions: [] }, { ...compact, pricingOptions: [tier(2, 0)] }]) {
        assert.equal(productPriceLabel(invalid), '요금 등록 필요'); assert.equal(productPriceBasis(invalid), null);
    }
});

test('홈·상품목록·공통 카드의 PC와 모바일에서 같은 기준을 표시하고 정가·할인을 숨긴다', () => {
    const { render } = setup(), p = tour('priced');
    const cards = [
        ['TourCardDesktop', { p }], ['TourCardMobile', { p, fav: false, onFav() {} }],
        ['TourGridCardMobile', { p, fav: false, onFav() {} }], ['TourRowCardMobile', { p, fav: false, onFav() {} }],
        ['ProductCard', { product: p }], ['PCard', { p, onClick() {} }],
    ];
    for (const [name, props] of cards) {
        const html = render(name, props);
        assert.ok(html.includes('1인 400,000원부터'), name); assert.ok(html.includes('6명 기준 · 기본요금'), name);
        assert.ok(!html.includes('1,234'), name); assert.ok(!html.includes('99,999,999'), name); assert.ok(!html.includes('%OFF'), name); assert.ok(!html.includes('line-through'), name);
        const missingProps = { ...props, [name === 'ProductCard' ? 'product' : 'p']: tour('missing', { pricingOptions: [] }) };
        const missing = render(name, missingProps); assert.ok(missing.includes('요금 등록 필요'), name); assert.ok(!missing.includes('0원'), name);
    }
});

test('가격 정렬은 대표 요금 기준이며 미등록 요금은 무료·최저가로 필터링하지 않는다', () => {
    const { exports: api } = setup();
    const missing = tour('missing', { price: 1, pricingOptions: [] });
    const low = tour('low', { price: 9000000, pricingOptions: [tier(6, 300000)] });
    const high = tour('high', { price: 2, pricingOptions: [tier(2, 1500000)] });
    assert.deepEqual([...api.sortTours([missing, high, low], 'low', {})].map(p => p.id), ['low', 'high', 'missing']);
    assert.deepEqual([...api.sortTours([missing, low, high], 'high', {})].map(p => p.id), ['high', 'low', 'missing']);
    const filters = { ...api.EMPTY_FILTERS, prices: ['p1'] };
    assert.equal(api.matchFilters(missing, filters), false); assert.equal(api.matchFilters(low, filters), true); assert.equal(api.matchFilters(high, filters), false);
    assert.equal(api.matchFilters(missing, api.EMPTY_FILTERS), true, '가격 필터를 쓰지 않을 때 미등록 상품을 숨기지는 않음');
});

test('홈 요약 조회·여행지 목록·매거진 추천이 동일한 요금표와 인원 메타데이터를 전달한다', async () => {
    const p = tour('priced'), { exports: api, context } = setup([p]);
    api.useHomeData();
    const home = await context.queries.find(query => query.queryKey[0] === 'homeData').queryFn();
    assert.equal(home.products[0].price, 400000); assert.equal(home.products[0].priceBasisPeople, 6);
    const category = api.toTourProduct({ ...p, pricing_options: JSON.stringify(p.pricingOptions), pricingOptions: undefined });
    assert.equal(productPriceLabel(category), '1인 400,000원부터'); assert.equal(productPriceBasis(category), '6명 기준 · 기본요금');
    let related;
    renderToStaticMarkup(React.createElement(() => { related = api.useRelatedTourMatches({ category: '중앙몽골', limit: 1 }); return null; }));
    assert.equal(related[0].price, 400000); assert.equal(related[0].priceBasisPeople, 6); assert.equal(related[0].originalPrice, undefined);
});

test('찜·최근 본 상품은 현재 카탈로그 요금을 사용하고 사라진 상품의 과거 가격을 노출하지 않는다', () => {
    const p = tour('priced'), { exports: api, render } = setup([p]);
    const wishlist = render('WishlistSection', { items: [p], stats: {}, onRemove() {}, onClearAll() {}, go() {} });
    assert.ok(wishlist.includes('1인 400,000원부터')); assert.ok(wishlist.includes('6명 기준 · 기본요금'));
    const now = Date.parse('2026-10-23T10:00:00Z');
    const groups = api.groupRecentByDay([{ productId: 'priced', title: '과거 제목', price: 1234, viewedAt: '2026-10-23T09:00:00Z' }, { productId: 'gone', title: '삭제된 상품', price: 999999, viewedAt: '2026-10-23T08:00:00Z' }], now, new Map([['priced', p]]));
    const cards = groups.flatMap(group => group.cards);
    assert.equal(productPriceLabel(cards[0]), '1인 400,000원부터');
    assert.equal(productPriceLabel(cards[1]), '요금 등록 필요');
    const mobile = render('TripCardM', { t: plain(cards[0]), fav: false, onFav() {}, go() {} });
    assert.ok(mobile.includes('1인 400,000원부터')); assert.ok(mobile.includes('6명 기준 · 기본요금'));
});
