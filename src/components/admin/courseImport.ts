import type { DetailContentBlock, DayInfoContent, TimelineContent } from '../../types/product';
import type { TouristSpot } from '../../types/touristSpot';
import type { Hotel } from '../../types/hotel';
import { productLodgingSnapshot } from '../../utils/lodgingItinerarySnapshot.ts';

/**
 * 「코스에서 불러오기」 — 견적 관리 → 코스 관리에 만들어 둔 코스(글자로 된 일정 뼈대)를
 * 상품 일정표 블록(dayInfo / timeline)으로 바꾼다. 사진과 설명은 코스에 없으므로
 * 여행지 관리·등록 숙소에서 이름으로 짝을 찾아 채운다.
 *
 * 순서: planCourse(자동으로 짝 찾기) → 관리자가 빈 곳을 고쳐 줌 → planToBlocks(블록 생성).
 * 만든 블록은 사진 주소와 글을 복사한 것이라, 이후 코스·여행지를 고쳐도 상품은 바뀌지 않는다.
 */

/** 코스 관리(public/코스관리.html)가 저장하는 하루 */
export interface CourseDay {
    d?: number;
    dest?: string;
    move?: string;
    dist?: string;
    items?: string[];
    stay?: { name?: string; tags?: string[]; img?: string; imgs?: string[]; desc?: string };
    meals?: string[];
    images?: string[];
}

export interface Course {
    destination?: string;
    nights?: string;
    highlights?: string[];
    days?: CourseDay[];
}

/** 관리자가 직접 골라 준 짝 — 다음에 같은 문구가 나오면 자동으로 쓴다. 값이 ''이면 「사진 없이」로 정한 것 */
export interface CourseImportAliases {
    spots: Record<string, string>;
    lodges: Record<string, string>;
}

export interface PlanItem {
    /** 코스에 적힌 원문 */
    text: string;
    time: string;
    title: string;
    /** 바로 아래 줄의 괄호 설명 — 「(선셋투어, 모래썰매)」 */
    note: string;
    spot: TouristSpot | null;
    /** 항목 아래에 들어갈 한 줄 설명 — 여행지의 한 줄 소개로 채우고, 불러오기 화면에서 고칠 수 있다 */
    description: string;
    /** 한 줄에 여행지가 둘 이상이라 나눠서 만든 항목 */
    split?: boolean;
}

export interface PlanDay {
    index: number;
    title: string;
    /** 그날의 대표 여행지 — 히어로 사진·사진 그리드·소개 문구 */
    spot: TouristSpot | null;
    /** 앞선 일차에서 이미 쓴 여행지 — 히어로만 다른 사진으로 넣고 그리드·소개는 되풀이하지 않는다 */
    repeat: boolean;
    /** 대표가 아닌 목적지 중 일정 문구에서 다루지 않은 여행지 — 사진 그리드를 채우는 데 쓴다 */
    extraSpots: TouristSpot[];
    /** 코스 일차에 직접 달린 사진(있을 때만) */
    dayImages: string[];
    moveLine: string;
    items: PlanItem[];
    meals: { breakfast: string; lunch: string; dinner: string };
    stayName: string;
    stayTags: string[];
    stayImages: string[];
    stayDesc: string;
    lodge: Hotel | null;
}

/** 관리자 작성 문구에서 줄바꿈 태그를 띄어쓰기로 바꾼 글 */
export function plainText(value: unknown): string {
    return String(value ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/** 이름 비교용 열쇠 — 띄어쓰기·기호·대소문자 차이를 없앤다 */
export function nameKey(value: unknown): string {
    return plainText(value).toLowerCase().replace(/[^0-9a-z가-힣ㄱ-ㆎЀ-ӿ]/g, '');
}

function bigrams(key: string): string[] {
    const out: string[] = [];
    for (let i = 0; i < key.length - 1; i++) out.push(key.slice(i, i + 2));
    return out;
}

/** 두 이름이 얼마나 비슷한지 (0~1). 「칭기즈칸기마상 / 칭기스칸 기마상」「엘승타사르하이 / 엘승타사르해」 같은 표기 차이를 잡는다 */
export function similarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const x = bigrams(a), y = bigrams(b);
    if (x.length === 0 || y.length === 0) return 0;
    const pool = [...y];
    let shared = 0;
    for (const g of x) {
        const at = pool.indexOf(g);
        if (at !== -1) { shared++; pool.splice(at, 1); }
    }
    return (2 * shared) / (x.length + y.length);
}

interface Named<T> { key: string; item: T }

/**
 * 이름끼리 짝 찾기 (목적지 ↔ 여행지, 숙소 이름 ↔ 등록 숙소).
 * 같은 이름 → 한쪽이 다른 쪽을 포함(「테를지」↔「테를지 국립공원」) → 표기가 비슷한 이름 순으로 본다.
 */
export function matchName<T>(text: string, list: Named<T>[]): T | null {
    const key = nameKey(text);
    if (key.length < 2) return null;
    const exact = list.find(c => c.key === key);
    if (exact) return exact.item;
    let best: Named<T> | null = null;
    for (const c of list) {
        const shorter = Math.min(c.key.length, key.length);
        if (shorter >= 3 && (c.key.includes(key) || key.includes(c.key)) && (!best || c.key.length > best.key.length)) best = c;
    }
    if (best) return best.item;
    let score = 0;
    for (const c of list) {
        if (c.key.length < 4 || key.length < 4) continue;
        const s = similarity(key, c.key);
        if (s >= 0.6 && s > score) { score = s; best = c; }
    }
    return best ? best.item : null;
}

/**
 * 문장 안에서 여행지 찾기 (「차강소브라가 도착 / 침식지형 트래킹」→ 차강소브라가).
 * 이름이 그대로 들어 있으면 가장 긴 이름을, 없으면 낱말 단위로 표기가 비슷한 이름을 고른다.
 */
export function matchInSentence<T>(text: string, list: Named<T>[]): T | null {
    const plain = plainText(text);
    const key = nameKey(plain);
    if (key.length < 2) return null;
    let best: Named<T> | null = null;
    for (const c of list) {
        if (c.key.length >= 3 && key.includes(c.key) && (!best || c.key.length > best.key.length)) best = c;
    }
    if (best) return best.item;
    const words = plain.split(/[\s/,·()~→-]+/).map(nameKey).filter(Boolean);
    const chunks = [...words, ...words.slice(0, -1).map((w, i) => w + words[i + 1])];
    let score = 0;
    for (const c of list) {
        if (c.key.length < 4) continue;
        for (const chunk of chunks) {
            if (chunk.length < 4) continue;
            const s = similarity(chunk, c.key);
            if (s >= 0.65 && s > score) { score = s; best = c; }
        }
    }
    return best ? best.item : null;
}

/**
 * 일정 항목 아래에 넣을 짧은 설명 — 여행지 관리의 「한 줄 소개」를 쓰고,
 * 비어 있으면 긴 설명의 첫 문장만 가져온다 (길면 말줄임).
 */
export function shortText(spot: TouristSpot | null | undefined, limit = 70): string {
    if (!spot) return '';
    const summary = plainText(spot.summary);
    if (summary) return summary;
    const first = plainText(String(spot.description ?? '').split(/\r?\n/)[0]).split(/(?<=[.!?。])\s+/)[0] || '';
    return first.length > limit ? `${first.slice(0, limit).trimEnd()}…` : first;
}

const photosOf = (list?: string[]) => (Array.isArray(list) ? list : []).filter((s): s is string => typeof s === 'string' && !!s);

/** 「숙소미포함」「X」「-」처럼 숙소·식사가 없다는 뜻으로 적은 값 */
const isNone = (value: string) => !value || /^(x|-|없음|불포함|미포함|숙소\s*미포함)$/i.test(value.trim());

/** 「09:30 공항 픽업」→ 시간과 제목, 「*강조 일정」→ 별표 제거 */
function parseItem(text: string): { time: string; title: string } {
    const line = plainText(text).replace(/^\*+\s*/, '');
    const m = line.match(/^(\d{1,2}:\d{2})\s*(.*)$/);
    return m && m[2] ? { time: m[1], title: m[2] } : { time: '', title: line };
}

const isNote = (text: string) => /^\s*\(/.test(plainText(text));

/** 「조식 후 욜린암 이동」처럼 그곳으로 가는 중인 문구 — 그곳을 둘러보는 문구가 따로 있으면 사진은 그쪽에 붙인다 */
export function isMoveItem(title: string): boolean {
    return /(이동|출발|복귀|픽업|드랍|귀국)/.test(title) && !/(관람|관광|체험|트래킹|트레킹|투어|탐방|산책|걷기|쇼핑|헌팅)/.test(title);
}

/**
 * 한 줄에 여행지가 둘 이상 적혀 있으면 쉼표·빗금에서 나눈다.
 * 나눈 조각 중 서로 다른 여행지가 둘 이상일 때만 나누고, 아니면 원문 그대로 둔다
 * (「유심 / 환전 / 장보기」「차강소브라가 도착 / 침식지형 트래킹」은 한 항목).
 */
export function splitBySpots<T>(title: string, list: Named<T>[]): string[] {
    const parts = title.split(/\s*[,/]\s*|\.\s+/).map(part => part.trim()).filter(Boolean);
    if (parts.length < 2) return [title];
    const found = new Set(parts.map(part => matchInSentence(part, list)).filter(Boolean));
    return found.size >= 2 ? parts : [title];
}

export const itemAliasKey = (item: PlanItem) => nameKey(item.title);
export const dayAliasKey = (day: PlanDay) => nameKey(day.title);
export const stayAliasKey = (day: PlanDay) => nameKey(day.stayName);

/** 저장해 둔 짝이 있으면 그것을(''=일부러 비움), 없으면 undefined */
function aliased<T extends { id: string }>(map: Record<string, string> | undefined, key: string, list: T[]): T | null | undefined {
    if (!map || !key || !(key in map)) return undefined;
    if (!map[key]) return null;
    return list.find(c => c.id === map[key]) ?? undefined;
}

/** 코스 하나를 일차별 계획으로 바꾸고, 여행지·숙소를 이름으로 찾아 붙인다 */
export function planCourse(course: Course, spots: TouristSpot[], hotels: Hotel[], aliases?: CourseImportAliases): PlanDay[] {
    // 여행지 이름과 「다른 이름」을 모두 찾는 열쇠로 쓴다 (엘승타사르하이 = 미니사막)
    const spotIndex = spots.filter(s => s.is_active !== false)
        .flatMap(s => [s.name_kr, ...(s.aliases || [])].map(name => ({ key: nameKey(name), item: s })))
        .filter(c => c.key);
    const hotelIndex = hotels.filter(h => h.is_active !== false).map(h => ({ key: nameKey(h.name_kr), item: h })).filter(c => c.key);
    const dayShown = new Set<string>();    // 앞선 일차의 대표로 쓴 여행지
    const itemShown = new Set<string>();   // 일정 항목에 사진·설명을 이미 붙인 여행지

    const plan = (course.days || []).map((raw, index) => {
        const title = plainText(String(raw.dest ?? '').replace(/<br\s*\/?>/gi, ' · '));
        const destParts = String(raw.dest ?? '').split(/<br\s*\/?>|→|\/|,|·|~/i).map(plainText).filter(Boolean);
        const matched = destParts.map(part => matchName(part, spotIndex)).filter((s): s is TouristSpot => !!s);

        const items: PlanItem[] = [];
        for (const text of raw.items || []) {
            if (!plainText(text)) continue;
            if (isNote(text) && items.length > 0) {
                const last = items[items.length - 1];
                last.note = [last.note, plainText(text)].filter(Boolean).join('\n');
                continue;
            }
            const parsed = parseItem(text);
            // 한 줄에 여행지가 둘 이상이면(「거북바위 관람, 아리야발사원 관람」) 여행지마다 항목을 나눈다
            const parts = splitBySpots(parsed.title, spotIndex);
            // 나눈 조각과 같은 문구가 그날 또 있으면 한 번만 남긴다 (「거북바위 관람, 아리야발사원 관람」 다음 줄의 「거북바위 관람」)
            if (items.some(item => item.split && nameKey(item.title) === nameKey(parsed.title))) continue;
            parts.forEach((part, n) => {
                if (parts.length > 1 && items.some(item => nameKey(item.title) === nameKey(part))) return;
                items.push({ text: plainText(text), time: n === 0 ? parsed.time : '', title: part, note: '', spot: null, description: '', split: parts.length > 1 });
            });
        }

        const day: PlanDay = {
            index, title, spot: null, repeat: false, extraSpots: [], dayImages: photosOf(raw.images),
            moveLine: [plainText(raw.move), plainText(raw.dist)].filter(Boolean).join(' '),
            items,
            meals: {
                breakfast: isNone(plainText(raw.meals?.[0])) ? '' : plainText(raw.meals?.[0]),
                lunch: isNone(plainText(raw.meals?.[1])) ? '' : plainText(raw.meals?.[1]),
                dinner: isNone(plainText(raw.meals?.[2])) ? '' : plainText(raw.meals?.[2]),
            },
            stayName: isNone(plainText(raw.stay?.name)) ? '' : plainText(raw.stay?.name),
            stayTags: (raw.stay?.tags || []).map(plainText).filter(Boolean),
            stayImages: [...new Set([raw.stay?.img || '', ...photosOf(raw.stay?.imgs)].filter(Boolean))],
            stayDesc: plainText(raw.stay?.desc),
            lodge: null,
        };

        const saved = aliased(aliases?.spots, dayAliasKey(day), spots);
        day.spot = saved !== undefined ? saved : matched[0] ?? null;
        if (day.spot) {
            day.repeat = dayShown.has(day.spot.id);
            dayShown.add(day.spot.id);
        }

        if (day.stayName) {
            const lodge = aliased(aliases?.lodges, stayAliasKey(day), hotels);
            day.lodge = lodge !== undefined ? lodge : matchName(day.stayName, hotelIndex);
        }
        return { day, matched };
    });

    // 사진·설명은 코스 전체에서 여행지마다 한 번만 붙인다 — 직접 골라 둔 짝은 그대로 따른다.
    // 「조식 후 욜린암 이동」 같은 이동 문구보다 「욜린암 계곡 트래킹」 같은 방문 문구에 먼저 붙인다.
    const attach = (item: PlanItem) => {
        if (item.spot) return;
        const pick = aliased(aliases?.spots, itemAliasKey(item), spots);
        const found = pick !== undefined ? pick : matchInSentence(item.title, spotIndex);
        if (found && (pick !== undefined || !itemShown.has(found.id))) {
            item.spot = found;
            item.description = shortText(found);
            itemShown.add(found.id);
        }
    };
    const allItems = plan.flatMap(p => p.day.items);
    allItems.filter(item => !isMoveItem(item.title)).forEach(attach);
    allItems.filter(item => isMoveItem(item.title)).forEach(attach);

    for (const { day, matched } of plan) {
        day.extraSpots = matched.filter(s => s.id !== day.spot?.id && !itemShown.has(s.id) && !dayShown.has(s.id));
        day.extraSpots.forEach(s => dayShown.add(s.id));
    }
    return plan.map(p => p.day);
}

/** 그날 히어로에 쓸 사진 — 되풀이되는 여행지는 앞에서 쓰지 않은 사진으로 돌려 쓴다 */
function heroOf(day: PlanDay, plan: PlanDay[]): string {
    const images = photosOf(day.spot?.images);
    if (day.dayImages[0]) return day.dayImages[0];
    if (images.length === 0) return '';
    const earlier = plan.filter(d => d.index < day.index && d.spot?.id === day.spot?.id).length;
    return images[earlier % images.length];
}

/** 그날 대표 여행지를 일정 항목에서 이미 사진·설명과 함께 보여 주는지 */
const spotInItems = (day: PlanDay) => !!day.spot && day.items.some(i => i.spot?.id === day.spot?.id);

/** 그날 제목 아래 사진 그리드 (최대 5장) — 일정 항목에 넣은 앞의 두 장은 되풀이하지 않는다 */
function galleryOf(day: PlanDay): string[] {
    const all = photosOf(day.spot?.images);
    const own = day.repeat ? [] : spotInItems(day) ? all.slice(2) : all;
    const extra = day.extraSpots.flatMap(s => photosOf(s.images).slice(0, 2));
    return [...new Set([...day.dayImages, ...own, ...extra])].slice(0, 5);
}

const lodgePhotos = (day: PlanDay) => (day.lodge ? photosOf(day.lodge.images) : day.stayImages);

/** 불러온 뒤에도 비어 있는 자리 — 화면에서 「여기를 채워 주세요」로 알려 준다 */
export function dayGaps(day: PlanDay, plan: PlanDay[]): { photo: boolean; lodging: boolean } {
    const anyPhoto = !!heroOf(day, plan) || galleryOf(day).length > 0 || day.items.some(i => photosOf(i.spot?.images).length > 0) || lodgePhotos(day).length > 0;
    return { photo: !anyPhoto, lodging: !!day.stayName && lodgePhotos(day).length === 0 };
}

export function planPhotoCount(day: PlanDay, plan: PlanDay[]): number {
    return new Set([heroOf(day, plan), ...galleryOf(day), ...day.items.flatMap(i => photosOf(i.spot?.images).slice(0, 2)), ...lodgePhotos(day).slice(0, 3)].filter(Boolean)).size;
}

/** 계획을 상품 일정표 블록으로 — 상세페이지 렌더러(DesignItinerary)가 읽는 모양 그대로 */
export function planToBlocks(plan: PlanDay[], options: { includeMove?: boolean } = {}, stamp = Date.now()): DetailContentBlock[] {
    const blocks: DetailContentBlock[] = [];
    plan.forEach((day, i) => {
        const intro = day.repeat || spotInItems(day) ? '' : shortText(day.spot);
        const info: DayInfoContent = {
            id: `dayInfo-${stamp}-c${i}`,
            dayLabel: `${i + 1}일차`,
            dayDate: '',
            title: day.title,
            description: [intro, options.includeMove !== false ? day.moveLine : ''].filter(Boolean).join('\n\n'),
            meals: { ...day.meals },
            accommodation: '',
            heroImage: heroOf(day, plan),
            galleryImages: galleryOf(day),
        };
        if (day.lodge) {
            Object.assign(info, productLodgingSnapshot(day.lodge));
            if (!(info.accommodationAmenities || []).length) info.accommodationAmenities = [...day.stayTags];
        } else if (day.stayName) {
            info.accommodation = day.stayName;
            info.accommodationAmenities = [...day.stayTags];
            info.accommodationImages = [...day.stayImages];
            info.accommodationDescription = day.stayDesc;
        }
        blocks.push({ id: `block-${stamp}-c${i}-info`, type: 'dayInfo', content: info } as DetailContentBlock);

        day.items.forEach((item, j) => {
            const content: TimelineContent = {
                id: `timeline-${stamp}-c${i}-${j}`,
                time: item.time,
                title: item.title,
                description: [item.description.trim(), item.note].filter(Boolean).join('\n'),
                images: photosOf(item.spot?.images).slice(0, 2),
            };
            blocks.push({ id: `block-${stamp}-c${i}-t${j}`, type: 'timeline', content } as DetailContentBlock);
        });

        if (i < plan.length - 1) {
            blocks.push({ id: `block-${stamp}-c${i}-divider`, type: 'divider', content: { style: 'space', height: 40 } } as unknown as DetailContentBlock);
        }
    });
    return blocks;
}
