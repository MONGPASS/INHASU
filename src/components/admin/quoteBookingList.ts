/**
 * 견적 예약 목록(`/admin/quote-desk/bookings`) 계산 — 옛 도구 public/예약목록.html의 목록 규칙을 그대로 옮겼다.
 * 자료는 같은 `GET /api/requests`(x-admin-token)에서 예약(예약확정이거나 booking이 있는 문의)만 고른다.
 * 거르기·검색·정렬·번호·진행 기록·복제 규칙은 옛 도구와 같아야 한다 — tests/quote-booking-list.test.mjs가 옛 문서의 함수와 결과를 비교한다.
 */
export type BookingRecord = Record<string, any> & { id: string | number };

/** 이 컴퓨터가 아니라 옛 도구처럼 UTC 기준 오늘(YYYY-MM-DD) */
export const todayKey = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

export const dateOnly = (s: unknown): string => s ? String(s).slice(0, 10) : '';
export const paxSum = (r: BookingRecord): number => (Number(r.adult) || 0) + (Number(r.child) || 0) + (Number(r.infant) || 0);
const assignOf = (r: BookingRecord) => (r.booking || {}).assign || {};
export const lodgesOf = (r: BookingRecord): Array<Record<string, any>> => (assignOf(r).lodges || []).filter((l: any) => l && l.name);
export const vehicleOf = (r: BookingRecord): Record<string, any> => assignOf(r).vehicle || {};
export const guideOf = (r: BookingRecord): Record<string, any> => assignOf(r).guide || {};
export const signed = (r: BookingRecord): boolean => !!((r.booking || {}).contract || {}).signedAt;
const hasVehicle = (r: BookingRecord) => !!vehicleOf(r).model;
const hasLodges = (r: BookingRecord) => lodgesOf(r).length > 0;
export const isReservation = (r: BookingRecord): boolean => r.status === '예약확정' || !!r.booking;
export const assignDone = (r: BookingRecord): boolean => !!guideOf(r).name && hasVehicle(r) && hasLodges(r);
/** 예약일: 예약 확정일(없으면 접수일) */
export const bookDate = (r: BookingRecord): string => dateOnly((r.booking || {}).confirmedAt || r.receivedAt);
const monthOf = (s: unknown) => { const d = dateOnly(s); return d ? `${Number(d.slice(5, 7))}월` : '-'; };
/** 출발 연-월(YYYY-MM) */
export const ymOf = (r: BookingRecord): string => { const d = dateOnly(r.depart); return d ? d.slice(0, 7) : ''; };
export const nightsText = (r: BookingRecord): string => r.nights != null && r.nights !== '' ? (Number(r.nights) === 0 ? '당일' : `${r.nights}박${Number(r.nights) + 1}일`) : '-';

/** 출발까지 남은 날(옛 도구와 같이 UTC 오늘 기준). 출발일이 없으면 null */
export function dDay(r: BookingRecord, today: string = todayKey()): number | null {
    if (!r.depart) return null;
    const a = new Date(dateOnly(r.depart) + 'T00:00:00').getTime();
    const b = new Date(today + 'T00:00:00').getTime();
    return Math.ceil((a - b) / 86400000);
}
export const departingSoon = (r: BookingRecord, today: string = todayKey()): boolean => { const dd = dDay(r, today); return dd !== null && dd >= 0 && dd <= 14; };

/** 진행 상황(저장값이 없으면 자동 판단) */
export function progressOf(r: BookingRecord, today: string = todayKey()): string {
    if (r.progress) return r.progress;
    const ret = dateOnly(r.return_);
    if (r.status === '보류') return '계약대기';
    if (ret && ret < today) return '투어종료';
    if (signed(r)) return '계약완료';
    return '계약대기';
}

export const BOOKING_FILTERS = ['전체', '계약미서명', '배정미완료', '출발임박'] as const;
export type BookingFilter = typeof BOOKING_FILTERS[number];

export const BOOKING_SORTS = [
    { value: 'byBook', label: '예약일순' }, { value: 'byDepart', label: '몽골 도착순' }, { value: 'byReturn', label: '여행 종료일순' },
    { value: 'byProgress', label: '진행상황순' }, { value: 'byName', label: '고객명순' }, { value: 'byPax', label: '인원순' },
    { value: 'byBalance', label: '잔금순' }, { value: 'byStatus', label: '계약 상태순' },
] as const;
export type BookingSort = typeof BOOKING_SORTS[number]['value'];

const sortValue = (key: BookingSort, r: BookingRecord, today: string): string | number => {
    switch (key) {
        case 'byName': return r.name || '';
        case 'byDepart': return dateOnly(r.depart);
        case 'byReturn': return dateOnly(r.return_);
        case 'byPax': return paxSum(r);
        case 'byProgress': case 'byStatus': return progressOf(r, today);
        case 'byBalance': return Number(((r.booking || {}).contractInfo || {}).balanceAmount || 0);
        default: return bookDate(r);
    }
};

/** 출발월 거르기: 전체 · 미정(날짜 없음) · YYYY(그해) · YYYY-MM(그달) */
export function inMonth(r: BookingRecord, month: string): boolean {
    if (month === '전체') return true;
    const ym = ymOf(r);
    if (month === '미정') return !ym;
    if (month.length === 4) return ym.slice(0, 4) === month;
    return ym === month;
}

/** 거르기·검색(공백으로 나눈 낱말이 모두 들어 있어야)·정렬 — 옛 도구 rows()와 같다 */
export function bookingRows(records: BookingRecord[], options: { filter: BookingFilter; query: string; month: string; sort: BookingSort; dir: 1 | -1; today?: string }): BookingRecord[] {
    const today = options.today ?? todayKey();
    const terms = options.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return records.filter(isReservation).filter(r => {
        if (!inMonth(r, options.month)) return false;
        if (options.filter === '계약미서명' && signed(r)) return false;
        if (options.filter === '배정미완료' && assignDone(r)) return false;
        if (options.filter === '출발임박' && !departingSoon(r, today)) return false;
        if (!terms.length) return true;
        const c = (r.booking || {}).contractInfo || {};
        const fl = (r.booking || {}).flight || {};
        const travelers = Array.isArray((r.booking || {}).travelers) ? r.booking.travelers : [];
        const text = [
            r.id, r.token, r.name, r.phone, r.destination, r.tripType, r.vehicle, vehicleOf(r).model, guideOf(r).name, guideOf(r).phone,
            progressOf(r, today), signed(r) ? '서명완료 계약완료' : '미서명', r.joinType, r.pkgTier,
            bookDate(r), dateOnly(r.depart), dateOnly(r.return_), monthOf(r.depart), nightsText(r), String(paxSum(r) || ''),
            c.productName, c.region, c.depositStatus, c.balanceStatus, c.cashReceipt, fl.inNo, fl.outNo, fl.inTime, fl.outTime,
            ...lodgesOf(r).map(l => `${l.name} ${l.grade || ''}`),
            ...travelers.map((t: any) => `${t.nameKo || ''} ${t.passportName || ''} ${t.phone || ''} ${t.passportNo || ''}`),
        ].join(' ').toLowerCase();
        return terms.every(t => text.includes(t));
    }).sort((a, b) => {
        const av = sortValue(options.sort, a, today), bv = sortValue(options.sort, b, today);
        const c = typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv));
        return c * options.dir;
    });
}

/** 번호: 전체 예약을 예약일 순으로 세운 고정 번호(거르기·정렬과 관계없이 같다) */
export function rowNumbers(records: BookingRecord[]): Record<string, number> {
    const map: Record<string, number> = {};
    records.filter(isReservation).slice().sort((a, b) => String(bookDate(a)).localeCompare(String(bookDate(b))))
        .forEach((r, i) => { map[String(r.id)] = i + 1; });
    return map;
}

export interface BookingSummary { total: number; unsigned: number; incomplete: number; soon: number }
export function bookingSummary(records: BookingRecord[], today: string = todayKey()): BookingSummary {
    const all = records.filter(isReservation);
    return { total: all.length, unsigned: all.filter(r => !signed(r)).length, incomplete: all.filter(r => !assignDone(r)).length, soon: all.filter(r => departingSoon(r, today)).length };
}

/** 출발월 줄: 고른 기간이 사라졌으면 전체로, 보여 줄 해(고른 해 → 올해 → 올해 이후 가장 가까운 해 → 마지막 해), 앞뒤 해, 12달 건수 */
export interface MonthBar { month: string; year: string; prevYear: string; nextYear: string; undated: number; yearTotal: number; cells: Array<{ ym: string; label: string; count: number }> }
export function monthBar(records: BookingRecord[], month: string, viewYear: string, thisYear: string = String(new Date().getFullYear())): MonthBar {
    const counts: Record<string, number> = {};
    let undated = 0;
    records.filter(isReservation).forEach(r => { const ym = ymOf(r); if (ym) counts[ym] = (counts[ym] || 0) + 1; else undated++; });
    const years = [...new Set(Object.keys(counts).map(k => k.slice(0, 4)))].sort();
    let m = month;
    if (m === '미정' && !undated) m = '전체';
    else if (m.length === 7 && !counts[m]) m = '전체';
    else if (m.length === 4 && !years.includes(m)) m = '전체';
    let year = viewYear;
    if (m.length === 4 || m.length === 7) year = m.slice(0, 4);
    else if (!year || !years.includes(year)) year = years.includes(thisYear) ? thisYear : (years.find(y => y > thisYear) || years[years.length - 1] || thisYear);
    const yi = years.indexOf(year);
    const prevYear = yi > 0 ? years[yi - 1] : (years.filter(y => y < year).pop() || '');
    const nextYear = yi >= 0 ? (years[yi + 1] || '') : (years.find(y => y > year) || '');
    const cells = Array.from({ length: 12 }, (_, i) => { const ym = `${year}-${String(i + 1).padStart(2, '0')}`; return { ym, label: `${i + 1}월`, count: counts[ym] || 0 }; });
    return { month: m, year, prevYear, nextYear, undated, yearTotal: Object.keys(counts).reduce((s, k) => s + (k.startsWith(year) ? counts[k] : 0), 0), cells };
}

/** 계약 칸: 수락대기 · 서명완료 · 서명대기 */
export function contractState(r: BookingRecord): '수락대기' | '서명완료' | '서명대기' {
    const accepted = !!(r.decision && r.decision.status === 'accepted') || r.status === '예약확정';
    if (!accepted) return '수락대기';
    return signed(r) ? '서명완료' : '서명대기';
}

/** 배정 칸: 가이드·차량·숙소 중 몇 개 */
export function assignState(r: BookingRecord): { done: number; total: number; allOk: boolean; detail: string } {
    const checks: Array<[string, boolean]> = [['가이드', !!guideOf(r).name], ['차량', hasVehicle(r)], ['숙소', hasLodges(r)]];
    const done = checks.filter(([, ok]) => ok).map(([l]) => l), pend = checks.filter(([, ok]) => !ok).map(([l]) => l);
    const allOk = !pend.length;
    return { done: done.length, total: checks.length, allOk, detail: allOk ? '가이드·차량·숙소 모두 배정' : `${done.length ? `${done.join('·')} 배정 · ` : ''}${pend.join('·')} 대기` };
}

export const PAY_OPTIONS = {
    depositStatus: ['미입금', '입금완료'],
    balanceStatus: ['미수령', '입금완료', '현지현금전달', '계좌입금', '카드결제'],
} as const;
export type PayField = keyof typeof PAY_OPTIONS;

/** 결제 상태(계약 정보 값, 없으면 예전 체크리스트) */
export function payStatus(r: BookingRecord, field: PayField): string {
    const c = (r.booking || {}).contractInfo || {}, ck = (r.booking || {}).checklist || {};
    if (field === 'depositStatus') return c.depositStatus || (ck.deposit ? '입금완료' : '미입금');
    return c.balanceStatus || (ck.balance ? '입금완료' : '미수령');
}
export const payAmount = (r: BookingRecord, field: PayField): number => Number(((r.booking || {}).contractInfo || {})[field === 'depositStatus' ? 'depositAmount' : 'balanceAmount']) || 0;

/** 결제 상태를 바꾼 booking(옛 도구 savePaymentStatus와 같은 칸을 함께 바꾼다) */
export function withPaymentStatus(booking: Record<string, any> | undefined, field: PayField, value: string): Record<string, any> {
    const next = { ...(booking || {}) };
    next.contractInfo = { ...(next.contractInfo || {}), [field]: value };
    next.checklist = { ...(next.checklist || {}) };
    if (field === 'depositStatus') next.checklist.deposit = value === '입금완료';
    if (field === 'balanceStatus') next.checklist.balance = value === '입금완료' || value === '현지현금전달' || value === '현장현금전달';
    return next;
}

export const money = (n: number): string => n ? `₩${Number(n).toLocaleString('ko-KR')}` : '-';

/** 고객 진행 기록 — 자료에 남은 기록으로 ‘누가 · 언제 · 무엇을’(옛 예약목록 customerTimeline과 같다) */
export interface TimelineEvent { at: string; who: '고객' | '관리자' | '자동'; label: string; bad?: boolean }
const NOTI: Record<string, string> = {
    quote_notification_queued: '견적 확인 알림톡 발송 요청',
    quote_notification_skipped: '견적 알림톡 미발송 · 설정/전화번호 확인',
    itinerary_notification_queued: '확정일정표 확인 알림톡 발송 요청',
    itinerary_notification_skipped: '일정표 알림톡 미발송 · 설정/전화번호 확인',
    contract_notification_queued: '계약서 서명 안내 발송 요청',
    contract_notification_skipped: '계약서 안내 미발송 · 설정/전화번호 확인',
    travel_notice_sent: '여행 주의사항 발송',
    travel_notice_failed: '여행 주의사항 발송 실패',
};
export function customerTimeline(r: BookingRecord): TimelineEvent[] {
    const ev: TimelineEvent[] = [];
    const b = r.booking || {};
    const acts: any[] = Array.isArray(r.activities) ? r.activities : [];
    if (r.receivedAt) ev.push({ at: r.receivedAt, who: '고객', label: '견적 문의 접수' });
    const quoteSent = r.quoteIssuedAt || (r.notify && r.notify.quoteSentAt);
    if (r.quote && quoteSent) ev.push({ at: quoteSent, who: '관리자', label: '견적서 발행' });
    acts.filter(a => a && NOTI[a.type]).forEach(a => {
        const bad = /skipped|failed/.test(a.type);
        const why = bad ? (String(a.detail || '').match(/\(([^)]+)\)\s*$/) || [])[1] : '';
        ev.push({ at: a.at, who: '자동', label: NOTI[a.type] + (why ? ' — ' + why : ''), bad });
    });
    if (r.decision && r.decision.status === 'accepted' && r.decision.acceptedAt) {
        ev.push(r.decision.source === 'customer'
            ? { at: r.decision.acceptedAt, who: '고객', label: "'이 견적으로 예약 진행하기' 클릭" }
            : { at: r.decision.acceptedAt, who: '관리자', label: '전화·카톡 수락 기록' });
    }
    if (b.depositRequest && b.depositRequest.status === 'requested' && b.depositRequest.requestedAt)
        ev.push({ at: b.depositRequest.requestedAt, who: '자동', label: '예약금·입금 계좌 안내 표시' });
    if (b.depositReport && b.depositReport.status === 'reported' && b.depositReport.reportedAt)
        ev.push({ at: b.depositReport.reportedAt, who: '고객', label: `입금 완료 신고 (입금자명 ${b.depositReport.name || '-'})` });
    const paidAct = acts.filter(a => a && a.type === 'deposit_confirmed').pop();
    if (paidAct) ev.push({ at: paidAct.at, who: '관리자', label: '예약금 입금 확인' });
    if (b.contractRequest && b.contractRequest.status === 'requested' && b.contractRequest.requestedAt)
        ev.push({ at: b.contractRequest.requestedAt, who: '자동', label: '계약서 서명·여행자 정보 요청 발송' });
    if (b.contract && b.contract.signedAt) ev.push({ at: b.contract.signedAt, who: '고객', label: '계약서 서명 완료' });
    if (b.travelerSubmission && b.travelerSubmission.submittedAt)
        ev.push({ at: b.travelerSubmission.submittedAt, who: '고객', label: `여행자 정보 제출 (${b.travelerSubmission.submittedCount || 0}명)` });
    (Array.isArray(r.changeRequests) ? r.changeRequests : []).forEach((x: any) => {
        const at = x && (x.at || x.requestedAt);
        if (at) ev.push({ at, who: '고객', label: `일정 변경 요청${x.status === 'resolved' ? ' · 처리됨' : ''}` });
    });
    if (b.confirmedAt) ev.push({ at: b.confirmedAt, who: '관리자', label: '예약 확정' });
    if (b.publishedAt) ev.push({ at: b.publishedAt, who: '관리자', label: '확정 일정표 공개' });
    return ev.filter(e => e.at && !isNaN(new Date(e.at).getTime())).sort((a, b2) => new Date(a.at).getTime() - new Date(b2.at).getTime());
}
const pad2 = (n: number) => String(n).padStart(2, '0');
export const timelineDate = (t: string): string => { const d = new Date(t); return `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`; };
export const timelineClock = (t: string): string => { const d = new Date(t); return String(t).length > 10 ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : ''; };
/** 날짜별로 묶은 진행 기록(마지막 날짜가 지금) */
export function timelineGroups(events: TimelineEvent[]): Array<{ day: string; items: TimelineEvent[] }> {
    const groups: Array<{ day: string; items: TimelineEvent[] }> = [];
    events.forEach(e => {
        const day = timelineDate(e.at), last = groups[groups.length - 1];
        if (last && last.day === day) last.items.push(e); else groups.push({ day, items: [e] });
    });
    return groups;
}

/** 선택 복제: 고객명·일정은 그대로, 고객 링크 값·접수 시각은 새로, 서명은 비운다(옛 도구 cloneRecord와 같다) */
export function cloneRecord(r: BookingRecord, index: number, stamp: number, token: string, now: Date = new Date()): BookingRecord {
    const rec = JSON.parse(JSON.stringify(r || {}));
    rec.id = `clone_${stamp}_${index}`;
    rec.token = token;
    rec.receivedAt = now.toISOString();
    rec.source = 'reservation-clone';
    rec.name = rec.name || '복제 예약';
    rec.memo = rec.memo || '';
    if (rec.booking) {
        rec.booking = JSON.parse(JSON.stringify(rec.booking));
        rec.booking.contract = null;
        rec.booking.checklist = { ...(rec.booking.checklist || {}), contract: false };
        if (!rec.booking.confirmedAt) rec.booking.confirmedAt = todayKey(now);
    }
    if (rec.quote && rec.quote.quoteNo) rec.quote.quoteNo = `${rec.quote.quoteNo}-COPY`;
    return rec;
}
export const newCustomerToken = (): string => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');

/** 가이드 시트 인쇄 창에 넘기는 자료(public/booking.js openBookingGuideSheet와 같은 칸). 너무 크면 인쇄 창이 서버 원본을 읽는다. */
export function guideSheetPayload(record: BookingRecord): Record<string, unknown> {
    const { id, reservationNumber, name, destination, depart, return_, adult, child, infant, nights, quote } = record;
    const { days, travelers, flight, assign, checklist, contractInfo, contractPackageType, pickupLodge, travelerNote, notes } = record.booking || {};
    return { id, reservationNumber, name, destination, depart, return_, adult, child, infant, nights,
        quote: { pax: quote?.pax, intensity: quote?.intensity },
        booking: { days, travelers, flight, assign, checklist, contractInfo, contractPackageType, pickupLodge, travelerNote, notes } };
}
export const guideSheetHref = (id: string | number): string => `/가이드시트?${new URLSearchParams({ adminPrint: '1', print: '1', id: String(id) })}`;
export const itineraryHref = (token: string): string => `/확정일정표?t=${encodeURIComponent(token)}&v=assign3`;
export const contractHref = (token: string, id: string | number): string => `/계약서?t=${encodeURIComponent(token)}&adminId=${encodeURIComponent(String(id))}`;
