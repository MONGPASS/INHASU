/**
 * 등록 정보(가이드·숙소·차량) 계산 — 화면은 pages/AdminResourceManage.tsx.
 * 저장 형식은 옛 도구 public/리소스관리.html과 같다: `guides`·`lodges`·`vehicles`는 { 이름: 항목 }, `lodge_cats`는 숙소 지역 이름 배열.
 * 예약 배정·확정 일정표·가이드 일정표가 같은 자료를 읽으므로 칸 이름을 바꾸지 않는다. 이 화면이 모르는 칸은 지우지 않는다.
 */
import { LODGING_FIELDS, displayDetails, imageUrl, lodgingPhotos, lodgingSummary, webUrl } from '../../utils/lodgingDisplay';
import type { AdminTagTone, AdminTone } from './ui/AdminChoice';

export type ResourceKind = 'guides' | 'lodges' | 'vehicles';
export const RESOURCE_KINDS: ResourceKind[] = ['guides', 'lodges', 'vehicles'];
export type ResourceRecord = Record<string, unknown>;
export type ResourceLibrary = Record<string, ResourceRecord>;

const text = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : String(value));

interface KindConfig {
    label: string;
    /** 칩·배지의 종류 값(가이드 유형·숙소 등급·차량 탑승 인원) */
    type: (r: ResourceRecord) => string;
    sub: (r: ResourceRecord) => string;
    typeTitle: string;
    typeOptions: string[];
    /** 목록 보기의 셋째 칸 */
    col3Title: string;
    col3: (r: ResourceRecord) => string;
    maxPhotos: number;
}
export const KINDS: Record<ResourceKind, KindConfig> = {
    guides: {
        label: '가이드', type: (r) => text(r.role), sub: (r) => text(r.nameEn), typeTitle: '유형',
        typeOptions: ['가이드', '전문 가이드', '드라이빙 가이드', '가이드 겸 드라이버', '전문 가이드 + 기사'],
        col3Title: '연락처', col3: (r) => text(r.phone), maxPhotos: 1,
    },
    lodges: {
        label: '숙소', type: (r) => text(r.grade), sub: (r) => text(r.region), typeTitle: '등급',
        typeOptions: ['일반게르', '고급게르', '호텔'],
        col3Title: '지역', col3: (r) => text(r.region), maxPhotos: 3,
    },
    vehicles: {
        label: '차량', type: (r) => text(r.seats), sub: (r) => text(r.plate), typeTitle: '탑승 인원',
        typeOptions: [],
        col3Title: '수하물', col3: (r) => text(r.luggage), maxPhotos: 3,
    },
};

/** 종류 배지 색(옛 도구의 색 이름 → Seed 배지 색). 모르는 값은 기본 회색. 공백은 무시하고 맞춘다. */
const TONE_OF: Record<string, AdminTone | AdminTagTone> = {
    가이드: 'info', 전문가이드: 'tag-blue', 드라이빙가이드: 'tag-orange', 가이드겸드라이버: 'tag-violet', '전문가이드+기사': 'tag-blue',
    고급게르: 'info', 일반게르: 'neutral', 호텔: 'tag-violet', '5성급': 'tag-violet', '4성급': 'tag-blue', 게스트하우스: 'tag-orange',
};
export const typeTone = (value: string): AdminTone | AdminTagTone => TONE_OF[value.replace(/\s+/g, '')] || 'neutral';

/** 서버 자료 형식 확인. 없으면 빈 값. */
export const readResources = (data: unknown): ResourceLibrary => {
    if (data == null) return {};
    if (typeof data !== 'object' || Array.isArray(data)) throw new Error('등록 정보 형식을 확인할 수 없습니다.');
    return data as ResourceLibrary;
};

/* ── 숙소 지역 ── */
export const LODGE_UNCAT = '미분류';
export const ALL = '__all';
export const NONE = '__none';
/** 서버에 지역 목록이 없을 때 옛 도구의 기본 지역 */
export const DEFAULT_LODGE_CATS = ['중앙몽골', '남고비', '홉스골'];
export const lodgeCatOf = (r: ResourceRecord | undefined) => text(r?.region).trim();
/** 저장된 지역 목록 + 숙소에만 적힌 지역(옛 도구와 같이 끝에 붙인다) */
export const mergeLodgeCats = (lodges: ResourceLibrary, cats: string[]) => {
    const out = cats.filter((cat, index) => cat && cats.indexOf(cat) === index);
    Object.values(lodges).forEach((r) => { const cat = lodgeCatOf(r); if (cat && !out.includes(cat)) out.push(cat); });
    return out;
};
export const lodgeCatCount = (lodges: ResourceLibrary, cat: string) => Object.values(lodges).filter((r) => lodgeCatOf(r) === cat).length;
export const lodgeNoneCount = (lodges: ResourceLibrary) => Object.values(lodges).filter((r) => !lodgeCatOf(r)).length;

export type CatNameProblem = 'empty' | 'reserved' | 'duplicate' | null;
export const catNameProblem = (name: string, cats: string[], current?: string): CatNameProblem => {
    const value = name.trim();
    if (!value) return 'empty';
    if (value === LODGE_UNCAT || value === ALL || value === NONE) return 'reserved';
    if (value !== current && cats.includes(value)) return 'duplicate';
    return null;
};
/** 지역 이름 바꾸기: 목록 자리 그대로, 그 지역 숙소도 함께 옮긴다 */
export const renameLodgeCat = (lodges: ResourceLibrary, cats: string[], from: string, to: string) => ({
    cats: cats.map((cat) => (cat === from ? to : cat)),
    lodges: Object.fromEntries(Object.entries(lodges).map(([name, r]) => [name, lodgeCatOf(r) === from ? { ...r, region: to } : r])) as ResourceLibrary,
});
/** 지역 삭제: 숙소는 지우지 않고 미분류로 옮긴다 */
export const deleteLodgeCat = (lodges: ResourceLibrary, cats: string[], cat: string) => ({
    cats: cats.filter((item) => item !== cat),
    lodges: Object.fromEntries(Object.entries(lodges).map(([name, r]) => [name, lodgeCatOf(r) === cat ? { ...r, region: '' } : r])) as ResourceLibrary,
});

/* ── 목록 ── */
/** 지역(숙소만)으로 거른 [이름, 항목] — 저장 순서 그대로 */
export const entriesInRegion = (kind: ResourceKind, library: ResourceLibrary, region: string): Array<[string, ResourceRecord]> => {
    const entries = Object.entries(library);
    if (kind !== 'lodges' || region === ALL) return entries;
    return entries.filter(([, r]) => (region === NONE ? !lodgeCatOf(r) : lodgeCatOf(r) === region));
};
/** 종류 칩: 정해 둔 순서 먼저, 그 밖의 등록 값은 가나다순(옛 도구와 같음) */
export const typeChoices = (kind: ResourceKind, entries: Array<[string, ResourceRecord]>) => {
    const config = KINDS[kind];
    const present = [...new Set(entries.map(([, r]) => config.type(r)).filter(Boolean))];
    return [...config.typeOptions.filter((t) => present.includes(t)), ...present.filter((t) => !config.typeOptions.includes(t)).sort((a, b) => a.localeCompare(b, 'ko'))];
};

/** 카드 사진: 숙소는 고른 대표 사진, 나머지는 img(없으면 imgs 첫 장) */
export const coverOf = (kind: ResourceKind, r: ResourceRecord) =>
    (kind === 'lodges' ? lodgingPhotos(r)[0] || '' : imageUrl(r.img || (Array.isArray(r.imgs) ? r.imgs[0] : '')));

/** 카드·목록의 소개 — 숙소는 확정 안내에 보이는 상세 정보(주소·전화·비품·공용시설) 요약. 없으면 빈 값(‘작성해 주세요’ 표시). */
export const introOf = (kind: ResourceKind, r: ResourceRecord) => {
    if (kind !== 'lodges') return text(r.desc).trim();
    const d = displayDetails(r);
    return (['address', 'phone', 'roomAmenities', 'sharedFacilities'] as const).some((k) => typeof d[k] === 'string' && (d[k] as string).trim()) ? lodgingSummary(r) : '';
};
export const introMissing = (kind: ResourceKind) => (kind === 'lodges' ? '상세 정보를 입력해 주세요' : '소개를 작성해 주세요');

/* ── 이번 달 이용 현황(배정 API, 상품·견적 예약 공통): 이름이 같은 배정을 센다 ── */
const INACTIVE = ['cancelled', 'on_hold', '취소', '예약취소', '보류'];
export const normName = (value: unknown) => text(value).replace(/\s+/g, '').toLowerCase();
export type ResourceUsage = Record<ResourceKind, Record<string, number>>;
interface AssignmentItem {
    key?: string; source?: string; id?: string; status?: string; startDate?: string; endDate?: string;
    assignment?: { guide?: { name?: string } | null; vehicle?: { type?: string } | null; accommodations?: Array<{ accommodation?: { name?: string } | null } | null> };
}
export function countUsage(items: unknown, now: Date): ResourceUsage {
    if (!Array.isArray(items)) throw new Error('배정 자료 형식을 확인할 수 없습니다.');
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const first = `${ym}-01`, last = `${ym}-31`;
    const sets: Record<ResourceKind, Record<string, Set<string>>> = { guides: {}, lodges: {}, vehicles: {} };
    const add = (bucket: Record<string, Set<string>>, name: unknown, key: string) => { const k = normName(name); if (k) (bucket[k] = bucket[k] || new Set()).add(key); };
    (items as AssignmentItem[]).forEach((b) => {
        if (!b || INACTIVE.includes(text(b.status))) return;
        const s = text(b.startDate).slice(0, 10), e = text(b.endDate || b.startDate).slice(0, 10);
        if (!s || s > last || e < first) return;
        const a = b.assignment || {}, key = b.key || `${b.source}:${b.id}`;
        add(sets.guides, a.guide?.name, key);
        add(sets.vehicles, a.vehicle?.type, key);
        (Array.isArray(a.accommodations) ? a.accommodations : []).forEach((n) => add(sets.lodges, n?.accommodation?.name, key));
    });
    const size = (bucket: Record<string, Set<string>>) => Object.fromEntries(Object.entries(bucket).map(([k, v]) => [k, v.size]));
    return { guides: size(sets.guides), lodges: size(sets.lodges), vehicles: size(sets.vehicles) };
}
export const usageText = (kind: ResourceKind, usage: ResourceUsage, name: string) => {
    const n = usage[kind][normName(name)] || 0;
    return { on: n > 0, text: kind === 'guides' ? (n ? `이번 달 ${n}팀` : '이번 달 배정 없음') : (n ? `이번 달 ${n}회` : '이번 달 이용 없음') };
};

/* ── 편집 ── */
export interface ResourceForm {
    name: string;
    /** 종류별 글자 칸(nameEn·phone·role·qr·desc / region·grade·tags·desc·상세 칸 / plate·driver·phone·seats·luggage·desc) */
    fields: Record<string, string>;
    /** 보이는 사진(가이드 1장, 숙소·차량 대표 포함 3장) */
    photos: string[];
}
const FIELD_KEYS: Record<ResourceKind, string[]> = {
    guides: ['nameEn', 'phone', 'role', 'qr', 'desc'],
    lodges: ['region', 'grade', 'tags', 'desc', ...LODGING_FIELDS],
    vehicles: ['plate', 'driver', 'phone', 'seats', 'luggage', 'desc'],
};

/** 사진 초기값: 숙소는 대표 사진 + 보관 사진 풀, 차량은 4번째 이후 사진을 따로 보관, 가이드는 img 한 장 */
export const photoState = (kind: ResourceKind, r: ResourceRecord | undefined) => {
    const imgs = Array.isArray(r?.imgs) ? (r!.imgs as unknown[]).map(text) : [];
    if (kind === 'lodges') {
        const photos = lodgingPhotos(r || {}).slice(0, 3);
        return { photos, extra: [] as string[], pool: [...new Set([text(r?.img), ...imgs, ...photos].filter(Boolean))] };
    }
    if (kind === 'vehicles') {
        const all = [...new Set([text(r?.img), ...imgs].filter(Boolean))];
        return { photos: all.slice(0, 3), extra: all.slice(3), pool: [] as string[] };
    }
    return { photos: r?.img ? [text(r.img)] : [], extra: [] as string[], pool: [] as string[] };
};

export const formFromResource = (kind: ResourceKind, name: string, r: ResourceRecord | undefined, defaultRegion = ''): ResourceForm => ({
    name,
    fields: Object.fromEntries(FIELD_KEYS[kind].map((key) => [key, key === 'region' && !r ? defaultRegion : text(r?.[key])])),
    photos: photoState(kind, r).photos,
});

/** 공식 출처는 http/https 주소를 한 줄에 하나씩 — 틀린 줄이 있으면 false */
export const officialSourcesValid = (value: string) => value.split(/\r?\n/).every((line) => !line.trim() || !!webUrl(line));

/** 편집 칸 → 저장할 항목. 원래 항목의 다른 칸은 그대로 두고, 사진은 옛 도구와 같은 규칙으로 정리한다. */
export const resourceFromForm = (kind: ResourceKind, form: ResourceForm, original: ResourceRecord | undefined, extra: { pool?: string[]; extraPhotos?: string[] } = {}): ResourceRecord => {
    const out: ResourceRecord = original ? { ...original } : { img: '' };
    FIELD_KEYS[kind].forEach((key) => { out[key] = (form.fields[key] ?? '').trim(); });
    const photos = form.photos.slice(0, KINDS[kind].maxPhotos);
    if (kind === 'lodges') {
        out.representativePhotos = [...photos];
        out.img = photos[0] || '';
        out.imgs = [...new Set([...(extra.pool || []), ...photos])];
    } else if (kind === 'vehicles') {
        out.img = photos[0] || '';
        out.imgs = [...new Set([...photos, ...(extra.extraPhotos || [])])];
    } else {
        out.img = photos[0] || '';
    }
    return out;
};

/** 이름을 바꿔도 목록 자리 그대로(옛 도구는 끝으로 보냈다). */
export const putResource = (library: ResourceLibrary, previousName: string | null, name: string, record: ResourceRecord): ResourceLibrary => {
    if (!previousName || previousName === name) return { ...library, [name]: record };
    const out: ResourceLibrary = {};
    Object.entries(library).forEach(([key, value]) => {
        if (key === name) return;
        if (key === previousName) out[name] = record; else out[key] = value;
    });
    return out;
};
export const removeResource = (library: ResourceLibrary, name: string): ResourceLibrary => {
    const out = { ...library };
    delete out[name];
    return out;
};

/** 종류 칩 고르기 칸에 보일 값: 정해 둔 값 + 이미 쓰인 값 + 지금 값 */
export const chipValues = (kind: ResourceKind, library: ResourceLibrary, current: string) =>
    [...new Set([...KINDS[kind].typeOptions, ...Object.values(library).map((r) => KINDS[kind].type(r)), current].filter((v) => v && v.trim()))];
