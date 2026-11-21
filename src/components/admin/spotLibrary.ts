/**
 * 여행지 관리 계산 — 화면은 pages/AdminSpotManage.tsx.
 * 저장 형식은 옛 도구 public/명소관리.html과 같다: `spots`는 { 여행지 이름: 여행지 }, `spot_cats`는 지역 이름 배열(순서·빈 지역 보존).
 * 견적서 만들기 STEP 4·상품 대표 명소(QuoteSpotSelector)·상품 일정표의 여행지 사진·소개가 같은 자료를 읽으므로 칸 이름을 바꾸지 않는다.
 */
import { ALL, NONE } from './itinerarySnippets';

export { ALL, NONE };

export interface Spot {
    nameMn?: string;
    region?: string;
    short?: string;
    aliases?: string[] | string;
    desc?: string;
    lat?: number | string;
    lng?: number | string;
    img?: string;
    subImgs?: string[];
    [key: string]: unknown;
}
export type SpotLibrary = Record<string, Spot>;

/** 칩 값: 사진이 두 장보다 적은 여행지 */
export const PHOTO = '__photo';
/** 추가 사진 칸 수(견적서 대표 명소의 작은 사진들) */
export const SUB_SLOTS = 4;

export const regionOf = (spot: Spot | undefined) => (spot && spot.region ? String(spot.region).trim() : '');
/** 일정표에는 여행지마다 사진 두 장이 나온다 — 대표 사진 + 추가 사진을 합쳐 센다 */
export const photoCount = (spot: Spot) => [spot.img, ...(Array.isArray(spot.subImgs) ? spot.subImgs : [])].filter(Boolean).length;
export const needsPhoto = (spot: Spot) => photoCount(spot) < 2;
export const aliasList = (value: unknown): string[] =>
    [...new Set((Array.isArray(value) ? value : String(value ?? '').split(',')).map((item) => String(item).trim()).filter(Boolean))];

export const mergeRegions = (library: SpotLibrary, cats: string[]): string[] => {
    const out = cats.filter((cat, index) => cat && cats.indexOf(cat) === index);
    Object.values(library).forEach((spot) => { const region = regionOf(spot); if (region && !out.includes(region)) out.push(region); });
    return out;
};
export const countRegion = (library: SpotLibrary, region: string) => Object.values(library).filter((spot) => regionOf(spot) === region).length;
export const countNoRegion = (library: SpotLibrary) => Object.values(library).filter((spot) => !regionOf(spot)).length;
export const countNeedsPhoto = (library: SpotLibrary) => Object.values(library).filter(needsPhoto).length;

export const filterSpots = (library: SpotLibrary, active: string, query: string): Array<[string, Spot]> => {
    const q = query.trim().toLowerCase();
    return Object.entries(library).filter(([name, spot]) => {
        if (active === NONE ? regionOf(spot) : active === PHOTO ? !needsPhoto(spot) : active !== ALL && regionOf(spot) !== active) return false;
        if (!q) return true;
        return [name, spot.nameMn, spot.short, ...aliasList(spot.aliases)].some((text) => String(text ?? '').toLowerCase().includes(q));
    });
};

export interface SpotForm {
    name: string;
    nameMn: string;
    region: string;
    short: string;
    aliases: string;
    desc: string;
    lat: string;
    lng: string;
    img: string;
    subImgs: string[];
}

const slots = (value: unknown) => {
    const list = Array.isArray(value) ? value.map((item) => String(item ?? '')) : [];
    while (list.length < SUB_SLOTS) list.push('');
    return list;
};

export const formFromSpot = (name: string, spot: Spot | undefined, defaultRegion = ''): SpotForm => ({
    name,
    nameMn: String(spot?.nameMn ?? ''),
    region: spot ? regionOf(spot) : defaultRegion,
    short: String(spot?.short ?? ''),
    aliases: aliasList(spot?.aliases).join(', '),
    desc: String(spot?.desc ?? ''),
    lat: spot?.lat == null ? '' : String(spot.lat),
    lng: spot?.lng == null ? '' : String(spot.lng),
    img: String(spot?.img ?? ''),
    subImgs: slots(spot?.subImgs),
});

/** 옛 도구처럼 숫자가 아니면(또는 0이면) 칸을 저장하지 않는다. */
const coordinate = (value: string) => parseFloat(value) || undefined;

/** 입력 칸 → 저장할 여행지. 이 화면이 다루지 않는 칸(지도 좌표 외의 추가 정보 등)은 그대로 둔다(옛 도구는 지웠다). */
export const spotFromForm = (form: SpotForm, original?: Spot): Spot => {
    const out: Spot = {
        ...(original || {}),
        nameMn: form.nameMn.trim(),
        region: form.region.trim(),
        short: form.short.trim(),
        aliases: aliasList(form.aliases),
        desc: form.desc.trim(),
        lat: coordinate(form.lat),
        lng: coordinate(form.lng),
        img: form.img || '',
        subImgs: slots(form.subImgs),
    };
    if (out.lat === undefined) delete out.lat;
    if (out.lng === undefined) delete out.lng;
    return out;
};

export const putSpot = (library: SpotLibrary, previousName: string | null, name: string, spot: Spot): SpotLibrary => {
    if (!previousName || previousName === name) return { ...library, [name]: spot };
    const out: SpotLibrary = {};
    Object.entries(library).forEach(([key, value]) => {
        if (key === name) return;
        if (key === previousName) out[name] = spot; else out[key] = value;
    });
    return out;
};
export const removeSpot = (library: SpotLibrary, name: string): SpotLibrary => {
    const out = { ...library };
    delete out[name];
    return out;
};

export const renameRegion = (library: SpotLibrary, cats: string[], from: string, to: string) => ({
    cats: cats.map((cat) => (cat === from ? to : cat)),
    library: Object.fromEntries(Object.entries(library).map(([name, spot]) => [name, regionOf(spot) === from ? { ...spot, region: to } : spot])) as SpotLibrary,
});
export const deleteRegion = (library: SpotLibrary, cats: string[], region: string) => ({
    cats: cats.filter((cat) => cat !== region),
    library: Object.fromEntries(Object.entries(library).map(([name, spot]) => [name, regionOf(spot) === region ? { ...spot, region: '' } : spot])) as SpotLibrary,
});

/* ── 문구 초안 가져오기(public/spot-copy-draft.json) ──
   한 줄 소개·다른 이름·새 항목만 제안한다. 사진과 상세 설명은 건드리지 않는다.
   한 줄 소개는 비어 있을 때만 채우고, 초안이 replaceShort로 표시한 것만 교체를 제안한다. */
export type CopyChange =
    | { name: string; kind: 'new'; short: string; aliases: string[]; region: string }
    | { name: string; kind: 'short'; short: string; before: string }
    | { name: string; kind: 'aliases'; aliases: string[] };

export const copyChanges = (draft: unknown, library: SpotLibrary): CopyChange[] => {
    const out: CopyChange[] = [];
    const spots = draft && typeof draft === 'object' ? (draft as { spots?: Record<string, any> }).spots || {} : {};
    for (const [name, entry] of Object.entries(spots)) {
        const current = library[name];
        const short = String(entry?.short || '').trim();
        const aliases = aliasList(entry?.aliases);
        // 없는 여행지는 한 줄 소개가 있는 초안만 새로 만든다 — ‘다른 이름’만 있는 초안은 기존 여행지용이라 건너뛴다
        if (!current) { if (short) out.push({ name, kind: 'new', short, aliases, region: String(entry?.region || '').trim() }); continue; }
        const before = String(current.short || '').trim();
        if (short && short !== before && (!before || entry?.replaceShort)) out.push({ name, kind: 'short', short, before });
        const add = aliases.filter((alias) => !aliasList(current.aliases).includes(alias));
        if (add.length) out.push({ name, kind: 'aliases', aliases: add });
    }
    return out;
};

export const applyCopyChanges = (library: SpotLibrary, cats: string[], picked: CopyChange[]) => {
    const next: SpotLibrary = { ...library };
    const nextCats = [...cats];
    for (const change of picked) {
        if (change.kind === 'new') {
            next[change.name] = { nameMn: '', region: change.region, short: change.short, aliases: change.aliases, desc: change.short, img: '', subImgs: slots([]) };
            if (change.region && !nextCats.includes(change.region)) nextCats.push(change.region);
        } else if (change.kind === 'short') {
            next[change.name] = { ...next[change.name], short: change.short };
        } else {
            next[change.name] = { ...next[change.name], aliases: aliasList([...aliasList(next[change.name].aliases), ...change.aliases]) };
        }
    }
    return { library: next, cats: nextCats };
};

export const readSpots = (data: unknown): SpotLibrary => {
    if (data == null) return {};
    if (typeof data !== 'object' || Array.isArray(data)) throw new Error('여행지 자료 형식을 확인할 수 없습니다.');
    return data as SpotLibrary;
};
