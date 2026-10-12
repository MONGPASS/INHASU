import type { DetailContentBlock, DayInfoContent } from '../../types/product';
import { isAutoDayLabel, stripDayLabelReading } from '../../utils/dayLabel';
import { MAP_DESTINATIONS } from '../product/designTemplates/mapDestinations';

/** 불러올 수 있는 상품 한 줄 — 일정표 블록과 (레거시) 일정 사진만 추린 것 */
export interface ItinerarySource {
    id: string;
    name: string;
    blocks: DetailContentBlock[];
    images: string[];
}

/** 불러오기 단위 — 한 상품의 한 일차 (일차 정보 블록 + 그 아래 일정 블록들) */
export interface DaySource {
    key: string;
    productId: string;
    productName: string;
    /** 상품 안에서의 순서 (0부터) */
    index: number;
    dayLabel: string;
    title: string;
    description: string;
    /** 이 일차를 이루는 블록 전체 (dayInfo 포함, 원본 그대로) */
    blocks: DetailContentBlock[];
    /** 레거시(사진만 올린 상품)일 때의 사진 목록 */
    images: string[];
    /** 제목·설명·일정에서 알아낸 여행지의 영어 표기 (관리자가 한눈에 구별하도록) */
    tags: string[];
    thumb: string;
    photoCount: number;
    eventCount: number;
}

const parseList = (v: unknown): unknown[] => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string' && v.trim()) {
        try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
    }
    return [];
};

/** 상품 API 응답(snake/camel 혼재)에서 일정표만 꺼낸다 */
export function toItinerarySource(item: Record<string, unknown>): ItinerarySource {
    return {
        id: String(item.id ?? ''),
        name: String(item.name ?? ''),
        blocks: parseList(item.itinerary_blocks ?? item.itineraryBlocks) as DetailContentBlock[],
        images: (parseList(item.itinerary_images ?? item.itineraryImages) as unknown[]).filter((s): s is string => typeof s === 'string' && !!s),
    };
}

/** (옛 일본어 일정 데이터용) 일본어 표기에서 흔한 접미사를 뗀 어간 — 'テレルジ'처럼 짧게 써도 매칭되게 */
const JA_SUFFIX = /(国立公園|宮殿博物館|国際空港|騎馬像|寺院|温泉|砂漠|火山|広場|の丘|湖|滝|寺)$/;
const jaStem = (ja: string) => { const s = ja.replace(JA_SUFFIX, ''); return s.length >= 3 ? s : ja; };
/** 어간이 겹치는 여행지(칭기스칸 국제공항 / 칭기스칸 기마상의 일본어 표기)는 어간으로 매칭하지 않는다 — 오탐 방지 */
const AMBIGUOUS_STEMS = new Set(MAP_DESTINATIONS.map(d => jaStem(d.jaLegacy)).filter((s, i, arr) => arr.indexOf(s) !== i));
/** 한국어 표기도 같은 방식으로 — '테를지', '쳉헤르'처럼 접미사 없이 써도 매칭되게 (두 글자 어간은 오탐이 많아 제외) */
const KO_SUFFIX = /\s*(국립공원|온천|사원|광장|궁전|폭포|호수|사막)$/;
const koStem = (ko: string) => { const s = ko.replace(KO_SUFFIX, ''); return s.length >= 3 ? s : ko; };

/**
 * 글에 등장하는 여행지를 찾아 영어 표기로 돌려준다 (등장 순서, 최대 4개).
 * 한국어 표기·어간·영어, 그리고 옛 일본어 정식 표기·어간 어느 것으로 적혀 있어도 잡는다.
 */
export function destinationTags(text: string): string[] {
    if (!text) return [];
    const lower = text.toLowerCase();
    const hits: { pos: number; en: string }[] = [];
    for (const d of MAP_DESTINATIONS) {
        const en = d.en.replace(/\s*\(.*\)$/, '');
        // jaLegacy = 옛 일본어 표기(기존 상품 데이터 인식용), ja·ko = 한국어 표기
        const stem = jaStem(d.jaLegacy);
        const cands = [d.jaLegacy, AMBIGUOUS_STEMS.has(stem) ? '' : stem, d.ja, koStem(d.ja), d.ko, koStem(d.ko), d.en.toLowerCase(), en.toLowerCase()];
        let pos = -1;
        for (const c of cands) {
            if (!c) continue;
            const p = /[a-z]/.test(c) ? lower.indexOf(c) : text.indexOf(c);
            if (p !== -1 && (pos === -1 || p < pos)) pos = p;
        }
        if (pos !== -1 && !hits.some(hh => hh.en === en)) hits.push({ pos, en });
    }
    return hits.sort((a, b) => a.pos - b.pos).slice(0, 4).map(hh => hh.en);
}

type PhotoContent = { images?: string[]; heroImage?: string; galleryImages?: string[]; accommodationImages?: string[] } | string;

function blockPhotos(b: DetailContentBlock): string[] {
    const c = b.content as PhotoContent;
    if (b.type === 'image') return typeof c === 'string' && c ? [c] : [];
    if (typeof c === 'object' && c) {
        return [c.heroImage ?? '', ...(c.galleryImages ?? []), ...(c.images ?? [])].filter(Boolean);
    }
    return [];
}

/** 관리자가 내용을 넣은 일차인지 — 빈 골격만 있는 일차는 목록에서 뺀다 */
function dayHasContent(day: DaySource): boolean {
    return !!(day.title || day.description || day.eventCount > 0 || day.photoCount > 0 || day.images.length > 0);
}

/**
 * 상품 일정표를 일차 단위로 쪼갠다. 일차 정보 블록이 나올 때마다 새 일차가 시작되고,
 * 첫 일차 정보보다 앞에 있는 블록은 첫 일차에 붙인다 (상세페이지 렌더러와 같은 기준).
 * 일차 정보가 하나도 없는 상품은 「일정 전체」 한 덩어리, 사진만 올린 상품은 사진 한 덩어리로.
 */
export function splitItineraryDays(src: ItinerarySource): DaySource[] {
    const days: DaySource[] = [];
    let pre: DetailContentBlock[] = [];
    let cur: { info: DayInfoContent; blocks: DetailContentBlock[] } | null = null;

    const flush = () => {
        if (!cur) return;
        const index = days.length;
        const blocks = index === 0 ? [...pre, ...cur.blocks] : cur.blocks;
        const photos = blocks.flatMap(blockPhotos).concat((cur.info.accommodationImages ?? []).filter(Boolean));
        days.push({
            key: `${src.id}:${index}`,
            productId: src.id,
            productName: src.name,
            index,
            dayLabel: stripDayLabelReading(cur.info.dayLabel),
            title: cur.info.title || '',
            description: cur.info.description || '',
            blocks,
            images: [],
            tags: destinationTags([cur.info.title, cur.info.description, ...blocks.filter(b => b.type === 'timeline').map(b => String((b.content as { title?: string }).title ?? ''))].join(' ')),
            thumb: photos[0] ?? '',
            photoCount: photos.length,
            eventCount: blocks.filter(b => b.type === 'timeline').length,
        });
        cur = null;
    };

    for (const b of src.blocks) {
        if (b.type === 'dayInfo') {
            flush();
            cur = { info: b.content as DayInfoContent, blocks: [b] };
        } else if (cur) {
            cur.blocks.push(b);
        } else {
            pre.push(b);
        }
    }
    flush();

    if (days.length === 0) {
        // 일차 정보 없이 일정/사진만 있는 상품
        if (pre.length > 0 || src.images.length > 0) {
            const photos = pre.flatMap(blockPhotos).concat(src.images);
            days.push({
                key: `${src.id}:all`, productId: src.id, productName: src.name, index: 0,
                dayLabel: '', title: pre.length > 0 ? '일정 전체' : '사진 전체', description: '',
                blocks: pre, images: src.images, tags: destinationTags(pre.filter(b => b.type === 'timeline').map(b => String((b.content as { title?: string }).title ?? '')).join(' ')), thumb: photos[0] ?? '', photoCount: photos.length,
                eventCount: pre.filter(b => b.type === 'timeline').length,
            });
        }
        pre = [];
    }
    return days.filter(dayHasContent);
}

/**
 * 불러온 블록을 새 상품에 붙일 수 있게 복제한다 — 블록 id와 내용 id를 모두 새로 발급해
 * 원본 상품과 id가 겹치지 않게 하고, 깊은 복사로 원본 객체를 공유하지 않는다.
 * 사진은 R2 경로 문자열이라 그대로 공유해도 안전하다.
 */
export function cloneItineraryBlocks(blocks: DetailContentBlock[], stamp = Date.now()): DetailContentBlock[] {
    return blocks.map((b, i) => {
        const copy = JSON.parse(JSON.stringify(b)) as DetailContentBlock;
        copy.id = `block-${stamp}-i${i}`;
        if (copy.content && typeof copy.content === 'object' && 'id' in copy.content) {
            (copy.content as DayInfoContent).id = `${copy.type}-${stamp}-${i}`;
        }
        return copy;
    });
}

/**
 * 일차 라벨을 순서대로 다시 매긴다 (1일차, 2일차 …).
 * 다른 상품의 3일차를 첫 일차로 불러와도 '3일차'가 남지 않게. 관리자가 직접 쓴
 * 특수 라벨(예: '옵션 A')은 그대로 둔다.
 */
export function renumberDayLabels(blocks: DetailContentBlock[]): DetailContentBlock[] {
    let n = 0;
    return blocks.map(b => {
        if (b.type !== 'dayInfo') return b;
        n++;
        const c = b.content as DayInfoContent;
        // 옛 일본어 라벨('1日目', 후리가나가 붙은 '1日目（いちにちめ）')도 자동 라벨로 보고 한국어로 깨끗하게 다시 매긴다
        return isAutoDayLabel(c.dayLabel) ? { ...b, content: { ...c, dayLabel: `${n}일차` } } : b;
    });
}
