import type { CSSProperties } from 'react';
import { SD } from '../site-seed/seed';
import { DEST_UNSURE, flightYes, quoteTripLength, type QuoteFormValues } from './quoteForm';

/**
 * 맞춤 견적 새 디자인(Claude Design ‘맞춤 견적 (PC)’·‘맞춤 견적 — 모바일’)의 값·모양.
 * 선택지·검증·제출은 그대로 quoteForm.ts / useQuoteForm.ts.
 */

export const Q_INPUT: CSSProperties = {
    width: '100%', height: 50, padding: '0 16px', boxSizing: 'border-box', border: `1px solid ${SD.gray200}`, borderRadius: 12,
    fontFamily: 'inherit', fontSize: 15, color: SD.gray900, background: SD.white, outline: 'none',
};

/** 선택 칩(고르면 검은 칸 + 흰 글자). */
export const qChip = (on: boolean): CSSProperties => ({
    flex: 'none', height: 40, padding: '0 16px', boxSizing: 'border-box', borderRadius: 9999,
    border: on ? `1.5px solid ${SD.gray900}` : `1px solid ${SD.gray200}`, background: on ? SD.gray900 : SD.white, color: on ? SD.white : SD.gray700,
    fontFamily: 'inherit', fontSize: 14, fontWeight: on ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap',
});

const people = (f: QuoteFormValues) => `성인 ${f.adult}${f.child ? ` · 아동 ${f.child}` : ''}${f.infant ? ` · 유아 ${f.infant}` : ''}`;
const range = (f: QuoteFormValues) => (f.depart && f.return_ ? `${f.depart} ~ ${f.return_}` : '');
const flightText = (f: QuoteFormValues) => (!f.flightIssued ? '' : flightYes(f) ? '발권 완료' : '미발권');

/** 요약 카드 제목: 고른 투어(+관심 지역) / 여행사에 맡기기 / 아직 없음. */
export function quoteHeadline(f: QuoteFormValues) {
    if (f.destination === DEST_UNSURE) return '지역은 여행사에 맡기기';
    if (f.destination) return [f.destination, f.destSpots.join(', ')].filter(Boolean).join(' · ');
    return '';
}

export const quoteSubline = (f: QuoteFormValues) => `${range(f) || '날짜 미정'}${quoteTripLength(f) ? ` (${quoteTripLength(f)})` : ''} · ${people(f)}`;

/** 입력 중 요약 칸(라벨·값·이동할 스텝 번호). 값이 빈 칸은 ‘미선택’. */
export function quoteTiles(f: QuoteFormValues): Array<{ label: string; value: string; step: number }> {
    return [
        { label: '여행 스타일', value: f.tripType, step: 4 },
        { label: '경험', value: f.travelStyles.join(', '), step: 4 },
        { label: '시내 숙소', value: f.cityStay, step: 5 },
        { label: '게르 등급', value: f.gerStay, step: 5 },
        { label: '차량', value: f.vehicle, step: 5 },
        { label: '항공권', value: flightText(f), step: 6 },
    ];
}

/** 모두 입력했을 때의 요청서(영수증) 줄. */
export function quoteReceiptRows(f: QuoteFormValues): Array<[string, string]> {
    const rows: Array<[string, string]> = [
        ['투어', f.destination === DEST_UNSURE ? '여행사 추천' : f.destination || '-'],
        ['세부 장소', f.destSpots.join(', ')],
        ['여행 기간', range(f) || '-'],
        ['인원', people(f)],
        ['동행', f.tripType || '-'],
        ['경험', f.travelStyles.join(', ') || '-'],
        ['시내 숙소', f.cityStay || '-'],
        ['게르 등급', f.gerStay || '-'],
        ['차량', f.vehicle || '-'],
        ['항공권', flightText(f) || '-'],
        ['신청자', f.name.trim() || '-'],
        ['연락처', f.phone || '-'],
    ];
    return rows.filter(([k, v]) => !(k === '세부 장소' && !v));
}

/** 요청서에 찍는 날짜(오늘). */
export const todayDot = () => {
    const d = new Date();
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

/** 요청 번호: 요청 ID(UUID) 앞 8자리. */
export const requestNo = (id: string) => id.replace(/[^0-9a-zA-Z]/g, '').slice(0, 8).toUpperCase();
