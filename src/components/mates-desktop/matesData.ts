import type { SyntheticEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { isUsableImage } from '../desktop-primitives/mwTokens';

/** Row shape of /api/travel-mates (D1 `travel_mates`). */
export interface ApiMatePost {
    id: string;
    user_id?: string;
    title?: string;
    description?: string;
    image?: string;
    region?: string;
    start_date?: string;
    end_date?: string;
    duration?: string;
    gender?: string;
    age_groups?: string | string[];
    styles?: string | string[];
    recruit_count?: number;
    current_members?: number;
    status?: string;
    created_at?: string;
    author_name?: string;
    author_info?: string;
    author_image?: string;
    view_count?: number;
    comment_count?: number;
}

export type MateStatus = 'open' | 'few' | 'done';
export type SizeKey = 's' | 'm' | 'l';

export interface MatePost {
    id: string;
    userId: string;
    title: string;
    description: string;
    /** Photo uploaded with the post ('' when none — the write form's stock fallback is ignored). */
    image: string;
    region: string;
    start: string;
    end: string;
    period: string;
    /** Days until departure (null when the date can't be read). */
    daysLeft: number | null;
    nightsLabel: string;
    styles: string[];
    ages: string[];
    gender: string;
    status: MateStatus;
    cap: number;
    joined: number;
    left: number;
    size: SizeKey;
    views: number;
    host: string;
    hostInfo: string;
    hostImage: string;
    initial: string;
    createdAt: number;
    posted: string;
}

export const STATUS_LABEL: Record<MateStatus, string> = { open: '모집 중', few: '마감 임박', done: '모집 완료' };
export const GENDER_LABEL: Record<string, string> = { any: '성별 무관', female: '여성만', male: '남성만' };
export const AGE_LABEL: Record<string, string> = { '20s': '20대', '30s': '30대', '40s': '40대', '50s_plus': '50대 이상' };
/** Styles offered by the write form (ja / ko labels are stored with an emoji prefix). */
export const STYLE_LABEL: Record<string, string> = {
    healing: '힐링',
    photo: '인생샷',
    activity: '액티비티',
    food: '맛집 탐방',
    camping: '캠핑',
};

/** Stored region labels (older posts: Japanese, older ko labels) → the Korean label shown and filtered on. */
const REGION_ALIASES: Record<string, string> = {
    中央モンゴル: '중앙 몽골',
    중앙몽골: '중앙 몽골',
    ゴビ砂漠: '고비사막',
    '고비 사막': '고비사막',
    フブスグル: '홉스굴',
    フブスグル湖: '홉스굴',
    홉스골: '홉스굴',
    テレルジ: '테를지',
    ウランバートル: '울란바토르',
    トレッキング: '트레킹',
    ゴルフ: '골프',
    その他: '기타',
};
const STYLE_ALIASES: [string, string[]][] = [
    ['healing', ['ヒーリング', '힐링']],
    ['photo', ['人生ショット', 'ベストショット', '인생샷']],
    ['activity', ['アクティビティ', '액티비티']],
    ['food', ['グルメ', '맛집', '미식']],
    ['camping', ['キャンプ', '캠핑', '차박']],
];
const GENDER_ALIASES: Record<string, string> = {
    不問: 'any', 性別不問: 'any', 性別問わず: 'any', 무관: 'any', '성별 무관': 'any',
    男性: 'male', 男性のみ: 'male', 남성: 'male', 남성만: 'male',
    女性: 'female', 女性のみ: 'female', 여성: 'female', 여성만: 'female',
};
const AGE_ALIASES: Record<string, string> = {
    '20代': '20s', '30代': '30s', '40代': '40s', '50代+': '50s_plus', '50代以上': '50s_plus', '50s+': '50s_plus',
    '20대': '20s', '30대': '30s', '40대': '40s', '50대+': '50s_plus', '50대 이상': '50s_plus',
};
const DONE_STATUSES = ['closed', 'full', 'matched', 'completed'];
/** Stock photo the write form stores when the author uploads nothing. */
const STOCK_FALLBACK = 'photo-1506905925346-21bda4d32df4';

/** Admin tourist-spot names used as destination imagery per region (spot names may be Japanese or Korean). */
const REGION_PHOTO_KEYWORDS: Record<string, string[]> = {
    고비사막: ['ホンゴル砂丘', 'ゴビ砂漠', '홍고르', '고비사막', '고비 사막'],
    '중앙 몽골': ['モンゴルの大草原', 'バガ・ガズリーン', '몽골 대초원', '몽골의 대초원', '바가 가즈린', '바가가즈린'],
    테를지: ['テレルジ', '테를지'],
    홉스굴: ['フブスグル', '홉스굴', '홉스골'],
};

export const OTHER_REGION = '기타';

function parseList(val: unknown): string[] {
    if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (typeof val !== 'string' || !val) return [];
    try {
        const parsed: unknown = JSON.parse(val);
        return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string' && v.length > 0) : [];
    } catch {
        return val.split(',').map((s) => s.trim()).filter(Boolean);
    }
}

const stripEmoji = (s: string) => s.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').trim();

export function styleLabel(raw: string): string {
    const clean = stripEmoji(raw);
    const hit = STYLE_ALIASES.find(([, words]) => words.some((w) => clean.includes(w)));
    return hit ? STYLE_LABEL[hit[0]] : clean;
}

export const regionLabel = (raw?: string) => {
    const r = (raw || '').trim();
    return r ? REGION_ALIASES[r] || r : OTHER_REGION;
};

const genderKey = (g?: string) => {
    const v = (g || 'any').trim();
    return GENDER_LABEL[v] ? v : GENDER_ALIASES[v] || 'any';
};

/** Dates are stored as "M.D" (no year) by the write form; older rows may be ISO. */
function parseDate(s: string | undefined, now: Date): Date | null {
    if (!s) return null;
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const md = s.match(/^(\d{1,2})\.(\d{1,2})$/);
    if (!md) return null;
    const d = new Date(now.getFullYear(), Number(md[1]) - 1, Number(md[2]));
    // A date more than two weeks behind us most likely means next year.
    if (d.getTime() < now.getTime() - 14 * 86400000) d.setFullYear(d.getFullYear() + 1);
    return d;
}

const displayDate = (s?: string) => {
    if (!s) return '';
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    return iso ? `${Number(iso[2])}.${Number(iso[3])}` : s;
};

function nightsLabel(duration?: string): string {
    const d = (duration || '').trim();
    if (!d) return '';
    if (/^1 Day$|日帰り|당일/.test(d)) return '당일치기';
    const m = d.match(/(\d+)\s*(?:泊|N|박)\s*(\d+)\s*(?:日|D|일)/);
    return m ? `${m[1]}박 ${m[2]}일` : d;
}

/** SQLite `datetime('now')` values carry no zone — they are UTC. */
export function parseTimestamp(s?: string): number {
    if (!s) return NaN;
    const safe = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.replace(' ', 'T')}Z`;
    return new Date(safe).getTime();
}

export function timeAgo(s?: string): string {
    const t = parseTimestamp(s);
    if (Number.isNaN(t)) return '';
    const m = Math.max(0, Math.floor((Date.now() - t) / 60000));
    if (m < 1) return '방금 전';
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}일 전`;
    if (d < 30) return `${Math.floor(d / 7)}주 전`;
    if (d < 365) return `${Math.floor(d / 30)}개월 전`;
    return `${Math.floor(d / 365)}년 전`;
}

export function toMatePost(p: ApiMatePost, now = new Date()): MatePost {
    const cap = Math.max(0, Number(p.recruit_count) || 0);
    const joined = Math.max(0, Number(p.current_members) || 0);
    const left = Math.max(0, cap - joined);
    const closed = DONE_STATUSES.includes((p.status || '').toLowerCase());
    const status: MateStatus = closed || (cap > 0 && left === 0) ? 'done' : left === 1 ? 'few' : 'open';
    const start = displayDate(p.start_date);
    const end = displayDate(p.end_date);
    const startDate = parseDate(p.start_date, now);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const host = (p.author_name || '').trim() && p.author_name !== 'Anonymous' ? (p.author_name || '').trim() : '익명의 여행자';
    const image = (p.image || '').trim();
    const hostImage = (p.author_image || '').trim();
    return {
        id: p.id,
        userId: p.user_id || '',
        title: (p.title || '').trim(),
        description: (p.description || '').trim(),
        image: isUsableImage(image) && !image.includes(STOCK_FALLBACK) ? image : '',
        region: regionLabel(p.region),
        start,
        end,
        period: start ? (end && end !== start ? `${start} ~ ${end}` : start) : '일정 미정',
        daysLeft: startDate ? Math.round((startDate.getTime() - today.getTime()) / 86400000) : null,
        nightsLabel: nightsLabel(p.duration),
        styles: [...new Set(parseList(p.styles).map(styleLabel).filter(Boolean))],
        ages: [...new Set(parseList(p.age_groups).map((a) => AGE_ALIASES[a] || a))],
        gender: genderKey(p.gender),
        status,
        cap,
        joined,
        left,
        size: cap <= 2 ? 's' : cap <= 4 ? 'm' : 'l',
        views: Number(p.view_count) || 0,
        host,
        hostInfo: p.author_info && p.author_info !== 'Traveler' ? p.author_info : '',
        hostImage: isUsableImage(hostImage) ? hostImage : '',
        initial: host.charAt(0).toUpperCase(),
        createdAt: parseTimestamp(p.created_at) || 0,
        posted: timeAgo(p.created_at),
    };
}

/** All travel-mate posts (shared by the PC list and the detail page's related posts). */
export function useMatePosts() {
    return useQuery<MatePost[]>({
        queryKey: ['travelMates', 'desktop'],
        queryFn: async () => {
            const data: unknown = await api.travelMates.list();
            return Array.isArray(data) ? (data as ApiMatePost[]).map((p) => toMatePost(p)) : [];
        },
        staleTime: 1000 * 30,
    });
}

/** The post's own photo, else an admin tourist-spot photo of its region ('' → caller shows a gradient). */
export function matePhoto(p: Pick<MatePost, 'image' | 'region'>, pick: (keywords: string[], index?: number) => string): string {
    if (p.image) return p.image;
    return regionPhoto(p.region, pick);
}

export function regionPhoto(region: string, pick: (keywords: string[], index?: number) => string): string {
    const keywords = REGION_PHOTO_KEYWORDS[region];
    return keywords ? pick(keywords) : '';
}

export const seatText = (p: Pick<MatePost, 'status' | 'left'>) => (p.status === 'done' ? '모집 마감' : `${p.left}자리 남음`);

/** Hide a photo whose URL fails so the gradient / initial underneath shows instead. */
export const hideBroken = (e: SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none';
};
