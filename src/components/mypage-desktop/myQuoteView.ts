import { DEST_CATEGORIES, DEST_UNSURE } from '../estimate-desktop/quoteForm';
import { requestNo } from '../estimate-desktop/quoteSeed';
import type { MyQuote } from './useMyPageData';

/**
 * 마이페이지 견적 내역·상세(Claude Design ‘마이페이지 — 견적 내역’)가 쓰는 값.
 * 목록은 /api/customer-access/history, 상세는 내 견적 화면과 같은 /api/my/:token 응답을 읽는다.
 */

export type QuoteTab = 'writing' | 'arrived' | 'booked';

export interface QuoteStage {
    tab: QuoteTab | 'done';
    label: string;
    /** 진행 4단계(요청 접수·견적 작성 중·견적 도착·예약 진행)에서 지금 칸. 취소는 -1. */
    step: number;
    chip: 'solid' | 'line' | 'muted';
}

export function quoteStage(q: Pick<MyQuote, 'status' | 'booking'>): QuoteStage {
    if (q.status === 'cancelled') return { tab: 'done', label: '취소됨', step: -1, chip: 'muted' };
    if (q.status === 'completed') return { tab: 'done', label: '여행 완료', step: 3, chip: 'muted' };
    if (q.status === 'converted' || q.booking) return { tab: 'booked', label: '예약 진행', step: 3, chip: 'solid' };
    if (q.status === 'answered' || q.status === 'reservation_requested') return { tab: 'arrived', label: '견적 도착', step: 2, chip: 'solid' };
    return { tab: 'writing', label: '견적 작성 중', step: 1, chip: 'line' };
}

export const QUOTE_STEP_NAMES = ['요청 접수', '견적 작성 중', '견적 도착', '예약 진행'];

/** 목록 id(`request:<uuid>`)의 요청 번호. 예전 사이트 견적(`quote:`)은 빈 값. */
export const quoteRequestNo = (q: Pick<MyQuote, 'id' | 'source'>) => (q.source === 'request' ? requestNo(q.id.replace(/^request:/, '')) : '');

/** 내 견적 주소(`/내견적.html?t=…`)의 조회 값. */
export const quoteTokenOf = (href: string) => {
    try {
        return new URL(href, window.location.origin).searchParams.get('t') || '';
    } catch {
        return '';
    }
};

/** 견적서 문서 주소(인쇄·PDF 저장). 내견적과 같은 조회 값을 쓴다. */
export const quoteDocPath = (token: string) => `/${encodeURI('견적서.html')}?t=${encodeURIComponent(token)}`;

/** 투어 이름 → 대표 사진(견적 요청 화면의 투어 카드와 같은 사진). */
export const quoteImage = (destination: string) =>
    DEST_CATEGORIES.find((d) => destination && (d.name === destination || destination.includes(d.name.replace(/ 투어$/, ''))))?.img || DEST_CATEGORIES[0].img;

export const quoteTitle = (destination: string) =>
    !destination || destination === DEST_UNSURE ? '맞춤 견적 (지역 추천 요청)' : `${destination} 맞춤 견적`;

/** "2026-11-26 ~ 2026-11-28" → "2026.11.26 – 11.28". */
export function quotePeriodText(period: string) {
    const m = period.match(/(\d{4})-(\d{2})-(\d{2})/g);
    if (!m) return period || '일정 미정';
    const [a, b] = m;
    const first = a.replace(/-/g, '.');
    if (!b) return first;
    const [ay] = a.split('-');
    const [by, bm, bd] = b.split('-');
    return `${first} – ${by === ay ? `${bm}.${bd}` : `${by}.${bm}.${bd}`}`;
}

export const shortDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

// ───────────────────────── 상세(/api/my/:token) ─────────────────────────

type Json = Record<string, unknown>;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const arr = (v: unknown): Json[] => (Array.isArray(v) ? v.filter((x): x is Json => !!x && typeof x === 'object') : []);

export interface QuoteMoney {
    pax: number;
    deposit: number;
    /** 실속형(일반 게르) · 풀패키지(고급 게르) 1인 금액 = 1인 예약금 + 그 인원의 1인 잔금. */
    perEco: number;
    perFull: number;
    /** 예약이 만들어졌으면 계약 금액(팀 총액·예약금·잔금). */
    contract: { total: number; deposit: number; balance: number } | null;
}

/** 견적 금액 — public/booking.js의 quoteMoney와 같은 규칙(인원에 맞는 잔금 줄, 없으면 가장 가까운 인원). */
export function quoteMoney(detail: Json): QuoteMoney | null {
    const quote = (detail.quote && typeof detail.quote === 'object' ? detail.quote : null) as Json | null;
    const price = (quote?.price && typeof quote.price === 'object' ? quote.price : null) as Json | null;
    const contractInfo = ((detail.booking as Json | null)?.contractInfo || null) as Json | null;
    const pax = num(quote?.pax) || num(detail.adult) + num(detail.child) + num(detail.infant);
    const contract = contractInfo && num(contractInfo.totalAmount) > 0
        ? { total: num(contractInfo.totalAmount), deposit: num(contractInfo.depositAmount), balance: num(contractInfo.balanceAmount) }
        : null;
    if (!price && !contract) return null;
    const rows = arr(price?.balances);
    let row = rows.find((b) => num(b.pax) === pax);
    if (!row && rows.length) row = rows.reduce((a, b) => (Math.abs(num(b.pax) - pax) < Math.abs(num(a.pax) - pax) ? b : a));
    const eco = row ? (row.economy != null ? num(row.economy) : num(row.amount)) : 0;
    const full = row ? (row.full != null ? num(row.full) : num(row.amount)) : 0;
    const deposit = num(price?.deposit);
    return { pax, deposit, perEco: eco ? deposit + eco : 0, perFull: full ? deposit + full : 0, contract };
}

/** 일정 줄: "DAY 1" · "차강소브라가 · 욜린암 — 침식지형 트래킹, …". 강조·회색 표시는 글자만 남긴다. */
export function quoteDays(detail: Json): Array<{ day: string; title: string; text: string }> {
    const quote = (detail.quote && typeof detail.quote === 'object' ? detail.quote : null) as Json | null;
    return arr(quote?.days).map((d, i) => {
        const title = String(d.dest || '').replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]+>/g, '').trim();
        const items = (Array.isArray(d.items) ? d.items : [])
            .map((x) => String(x).replace(/^[*\s]+/, '').replace(/^\((.*)\)$/, '$1').trim())
            .filter(Boolean);
        return { day: `DAY ${num(d.d) || i + 1}`, title, text: items.slice(0, 4).join(', ') };
    });
}

export function quoteValidUntil(detail: Json) {
    const expires = String(detail.quoteExpiresAt || '');
    const d = new Date(expires);
    if (expires && !Number.isNaN(d.getTime())) return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    const quote = detail.quote as Json | null;
    return String((quote?.price as Json | undefined)?.validUntil || '');
}

/** 요청 내용(상세 오른쪽). 응답에 있는 칸만. */
export function quoteRequestRows(detail: Json): Array<[string, string]> {
    const spots = Array.isArray(detail.destSpots) ? detail.destSpots.map(String).filter(Boolean) : [];
    const period = detail.depart && detail.return_ ? `${detail.depart} ~ ${detail.return_}` : '';
    const people = [num(detail.adult) && `성인 ${num(detail.adult)}명`, num(detail.child) && `아동 ${num(detail.child)}명`, num(detail.infant) && `유아 ${num(detail.infant)}명`].filter(Boolean).join(' · ');
    const rows: Array<[string, string]> = [
        ['지역', String(detail.destination || '') === DEST_UNSURE ? '여행사 추천' : String(detail.destination || '-')],
        ['가 보고 싶은 곳', spots.join(', ')],
        ['여행 기간', period || '-'],
        ['인원', people || '-'],
        ['여행 스타일', String(detail.tripType || '')],
    ];
    return rows.filter(([, v]) => !!v);
}
