/**
 * 상품 상세의 검색용 제목·설명. 서버(functions/lib/publicSeo.ts)와 화면(pages/ProductDetail.tsx)이
 * 같은 문장을 내도록 한 곳에 둔다. 등록된 값(기간·지역·가격·포함 사항·소개)만 쓰고 지어내지 않는다.
 */
export interface ProductSeoInput {
    name: string;
    duration?: string;
    category?: string;
    price?: number;
    included?: string[];
    description?: string;
}

const cut = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);
const squash = (text: unknown) => String(text ?? '').replace(/\s+/g, '');
const has = (text: string, part: unknown) => !!squash(part) && squash(text).includes(squash(part));

/** 「상품명 기간 · 지역 몽골 투어」 — 브랜드는 붙이지 않는다. 상품명에 이미 든 말은 되풀이하지 않는다. */
export function productSeoTitle(p: ProductSeoInput): string {
    const name = p.name.trim();
    const duration = (p.duration ?? '').trim();
    const category = (p.category ?? '').trim();
    const head = [name, duration && !has(name, duration) ? duration : ''].filter(Boolean).join(' ');
    const kind = has(name, '투어') || has(name, '여행') ? '' : '투어';
    // 지역 이름에 이미 '몽골'이 들어 있으면(중앙몽골) '몽골'을 또 붙이지 않는다
    const region = category && !has(name, category) ? category : '';
    const country = has(name, '몽골') || has(region, '몽골') ? '' : '몽골';
    const words = [region, country, kind].filter(Boolean).join(' ');
    const tail = words === '몽골' ? '몽골 여행' : words;
    return cut([head, tail].filter(Boolean).join(' · '), 44);
}

/** 기간·지역 → 가격 → 포함 사항 → 소개 순서의 한 문단(160자 이내). */
export function productSeoDescription(p: ProductSeoInput): string {
    const name = p.name.trim();
    const lead = [p.category, p.duration].map((v) => (v ?? '').trim()).filter((part) => part && !has(name, part)).join(' ');
    const included = (p.included ?? []).map((v) => String(v ?? '').trim()).filter(Boolean).slice(0, 3);
    const parts = [
        `${name}${lead ? ` (${lead})` : ''}`,
        Number(p.price) > 0 ? `1인 ${Number(p.price).toLocaleString('ko-KR')}원부터` : '',
        included.length ? `포함: ${included.join(', ')}` : '',
        (p.description ?? '').replace(/\s+/g, ' ').trim(),
    ].filter(Boolean);
    return cut(parts.join('. '), 160);
}
