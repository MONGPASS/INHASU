/**
 * 견적서 만들기(`/admin/quote-desk/builder`) 계산 — 옛 도구 public/견적만들기.html의 편집 상태(ST)와 견적 문서(QUOTE) 규칙을 옮겼다.
 * 만든 견적 문서는 고객 화면(내견적·견적서·일정지도)이 그대로 읽으므로 칸·값이 옛 도구와 같아야 한다
 * — tests/quote-builder.test.mjs가 옛 문서의 buildQuote·restoreFromQuote·importQuoteContent·loadCourse·matchCourse와 결과를 비교한다.
 */
export type Json = Record<string, any>;

export interface QuoteDay { d: number; date?: string; dest?: string; move?: string; dist?: string; items?: string[]; stay?: { name?: string; tags?: string[]; [key: string]: unknown }; meals?: string[]; [key: string]: unknown }
export interface QuoteBalance { pax: number; economy?: number; full?: number; amount?: number }
export interface QuoteOption { label: string; calc?: string }

/** 편집 상태 — 옛 도구 ST와 같은 칸(초안도 이 모양으로 보관한다) */
export interface QuoteState {
    customer: string; phone: string; email: string; destination: string; quoteNo: string;
    depart: string; return_: string; pax: number;
    vehicle: string; flightIn: string; flightOut: string;
    manager: string; paxNote: string; pickup: string; drop: string;
    benefits: string; events: string; remark: string;
    deposit: number; options: QuoteOption[]; balances: QuoteBalance[];
    spots: string[]; days: QuoteDay[]; intensity: number;
    /** 아래 총액 계산 기준: ROOM_ECO(실속형) | ROOM_FULL(풀패키지). 견적서에는 들어가지 않는다 */
    roomType: string;
}

/** 고객 요청에서 넘어온 값(옛 도구 REQ_*) */
export interface RequestContext {
    reqId: string; reqToken: string; fromReq: boolean;
    reqSpots: string[]; reqProfile: Json; reqPax0: { adult: number; child: number; infant: number } | null;
    savedEmail: string; anonymousShare: boolean;
    /** 화면 참고용(견적 문서에는 넣지 않는다): 고객이 고른 차량 · 접수 시각 · 처음 적은 여행지 */
    reqVehicle?: string; reqReceivedAt?: string; reqDestination?: string;
}
export const emptyContext = (): RequestContext => ({ reqId: '', reqToken: '', fromReq: false, reqSpots: [], reqProfile: {}, reqPax0: null, savedEmail: '', anonymousShare: false, reqVehicle: '', reqReceivedAt: '', reqDestination: '' });

const clone = <T>(value: T): T => structuredClone(value);
/** 옛 도구와 같은 저장 값(초안에 들어간다). 낱말은 아이콘 이름 검사(check-icon-subset)에 걸리지 않게 나눠 적는다 */
export const ROOM_ECO = ['ec', 'o'].join('');
export const ROOM_FULL = 'full';

export function emptyQuoteState(base: Json): QuoteState {
    return {
        customer: '', phone: '', email: '', destination: '', quoteNo: '',
        depart: '', return_: '', pax: 6,
        vehicle: '', flightIn: '', flightOut: '',
        manager: base.manager || '', paxNote: '', pickup: '', drop: '',
        benefits: base.benefits || '', events: (base.events || []).join('\n'), remark: base.remark || '',
        deposit: (base.price && base.price.deposit) || 50000,
        options: clone((base.price && base.price.options) || []),
        balances: clone((base.price && base.price.balances) || []),
        spots: [], days: [], intensity: 3, roomType: ROOM_ECO,
    };
}

export function nightsOf(st: Pick<QuoteState, 'depart' | 'return_'>): number | null {
    if (!st.depart || !st.return_) return null;
    const n = Math.round((new Date(st.return_).getTime() - new Date(st.depart).getTime()) / 86400000);
    return isNaN(n) ? null : n;
}

export const balEco = (b: QuoteBalance): number => (b.economy != null ? b.economy : (b.amount || 0));
export const balFull = (b: QuoteBalance): number => (b.full != null ? b.full : (b.amount || 0));

const pad2 = (n: number) => String(n).padStart(2, '0');
export function autoQuoteNo(d: Date = new Date()): string {
    return `${String(d.getFullYear()).slice(2)}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${String(d.getHours())}${pad2(d.getMinutes())}`;
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
/** 출발일 기준 i일차 날짜 “07.20(월)” — 출발일이 없으면 빈 값 */
export function dayDateStr(depart: string, i: number): string {
    if (!depart) return '';
    const d = new Date(depart);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + i);
    return `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}(${DOW[d.getDay()]})`;
}

/** 여행 기간과 일정 칸 수 비교(옛 dayCountNote): 맞으면 ok, 다르면 need·have, 기간이 없으면 null */
export function dayCountCheck(st: QuoteState): { ok: boolean; nights: number; need: number; have: number } | null {
    const n = nightsOf(st);
    if (!n || n <= 0) return null;
    return { ok: st.days.length === n + 1, nights: n, need: n + 1, have: st.days.length };
}

export const INTENSITY_DESC: Record<number, string> = { 1: '매우 여유', 2: '여유', 3: '보통', 4: '빡셈', 5: '매우 빡셈' };

/** 코스 목록 순서: 짧은 일정부터, 같으면 이름 순(코스 관리 목록과 같다) */
export function sortedCourses(courses: Record<string, Json>): Array<[string, Json]> {
    const dayCount = (c: Json) => (Array.isArray(c.days) && c.days.length) ? c.days.length : (Number(String(c.nights || '').match(/(\d+)\s*일/)?.[1]) || 99);
    return Object.entries(courses).sort((a, b) => dayCount(a[1]) - dayCount(b[1]) || a[0].localeCompare(b[0], 'ko'));
}

/** 고객이 고른 여행지와 가장 가까운 코스(예: “중앙 몽골 투어” → “중앙 몽골”) */
export function matchCourse(dest: string, courses: Record<string, Json>): string | null {
    if (!dest) return null;
    const norm = (s: unknown) => String(s || '').replace(/\s|투어|여행|몽골/g, '');
    const d = norm(dest);
    if (!d) return null;
    for (const [name, c] of Object.entries(courses)) {
        const cd = norm(c.destination), cn = norm(name);
        if ((cd && (d.includes(cd) || cd.includes(d))) || (cn && (d.includes(cn) || cn.includes(d)))) return name;
    }
    return null;
}

/** 코스 불러오기 — 일정·대표 명소·요금을 채운다. keepCustomer면 고객이 고른 여행지·차량·관심 지역을 남긴다(옛 loadCourse). */
export function applyCourse(st: QuoteState, course: Json, options: { keepCustomer?: boolean; reqSpots?: string[]; spotLib?: Json } = {}): QuoteState {
    const next: QuoteState = { ...st, balances: clone(st.balances), options: clone(st.options) };
    if (!options.keepCustomer || !next.destination) next.destination = course.destination;
    if (!options.keepCustomer || !next.vehicle) next.vehicle = course.vehicle || '';
    next.intensity = course.intensity || 3;
    next.spots = [...(course.highlights || [])];
    if (options.keepCustomer && options.reqSpots?.length) {
        const lib = options.spotLib || {};
        next.spots = [...new Set([...options.reqSpots.filter(name => lib[name]), ...next.spots])];
    }
    next.days = clone(course.days || []);
    if (course.price && Array.isArray(course.price.balances) && course.price.balances.length) {
        if (Number(course.price.deposit) > 0) next.deposit = Number(course.price.deposit);
        next.balances = clone(course.price.balances);
        if (Array.isArray(course.price.options) && course.price.options.length) next.options = clone(course.price.options);
    } else if (Number(course.base) > 0) {
        // 옛 코스: 1인 견적금액(base)만 있으면 현재 인원 요금표에 반영
        const balance = Math.max(0, Number(course.base) - Number(next.deposit || 0));
        const found = next.balances.find(b => Number(b.pax) === Number(next.pax));
        if (found) { found.economy = balance; found.full = balance; found.amount = balance; }
        else next.balances.push({ pax: Number(next.pax), economy: balance, full: balance });
    }
    return next;
}

const fmtDot = (d: Date) => `${d.getFullYear()}. ${pad2(d.getMonth() + 1)}. ${pad2(d.getDate())}`;
const fmtKor = (d: Date) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
const korDate = (iso: string) => { const p = String(iso).split('-').map(Number); return (p.length === 3 && !p.some(isNaN)) ? `${p[0]}년 ${p[1]}월 ${p[2]}일` : iso; };

/** 견적 문서 만들기(옛 buildQuote와 같은 칸·값). quoteNo는 문서번호 칸에 보이는 값(비면 자동 번호). */
export function buildQuote(st: QuoteState, base: Json, ctx: { quoteNo: string; reqProfile: Json; reqSpots: string[]; spotLib: Json; now?: Date }): Json {
    const n = nightsOf(st);
    const now = ctx.now ?? new Date();
    const Q: Json = clone(base);
    Q.customer = st.customer || '고객';
    Q.destination = st.destination || '몽골';
    Q.quoteNo = ctx.quoteNo || autoQuoteNo(now);
    Q.issueDate = fmtDot(now);
    Q.manager = st.manager || base.manager;
    Q.pax = st.pax;
    Q.paxNote = st.paxNote.trim() || `${st.pax}인`;
    Q.nights = n && n > 0 ? `${n}박 ${n + 1}일` : base.nights;
    Q.vehicle = st.vehicle || base.vehicle;
    Q.intensity = st.intensity;
    if (st.depart && st.return_) {
        Q.period = `${korDate(st.depart)} ~ ${korDate(st.return_)}`;
        Q.periodShort = `${st.depart.replace(/-/g, '. ')} — ${st.return_.slice(5).replace(/-/g, '. ')}`;
    }
    Q.departISO = st.depart; Q.returnISO = st.return_;
    Q.flight = { in: st.flightIn.trim() || '미정', out: st.flightOut.trim() || '미정' };
    Q.pickup = st.pickup.trim() || (st.flightIn.trim() ? st.flightIn.trim() + ' 공항' : '미정');
    Q.drop = st.drop.trim() || (st.flightOut.trim() ? st.flightOut.trim() + ' 공항' : '미정');
    Q.benefits = st.benefits;
    Q.events = st.events.split('\n').map(x => x.trim()).filter(Boolean);
    Q.remark = st.remark.trim() || '-';
    Q.price = { ...base.price, deposit: st.deposit,
        validUntil: fmtKor(new Date(now.getTime() + 7 * 86400000)),
        options: st.options.map(o => ({ label: o.label, calc: o.calc || '' })),
        balances: st.balances.slice().sort((a, b) => a.pax - b.pax).map(b => ({ pax: b.pax, economy: balEco(b), full: balFull(b) })) };
    Q.images = { ...base.images, coverLabel: `${Q.destination} 대표 이미지` };
    Q.days = st.days;
    Q.requestProfile = { ...ctx.reqProfile, preferredSpots: ctx.reqSpots.slice() };
    const lib = ctx.spotLib || {};
    Q.highlights = st.spots.map(name => {
        const s = lib[name] || {};
        return { nameMn: s.nameMn || '', name, desc: s.desc || '', img: s.img || '', subImgs: (s.subImgs && s.subImgs.length ? s.subImgs : ['', '', '', '']) };
    });
    return Q;
}

/** 발행된 견적을 편집 상태로 되돌린다(옛 restoreFromQuote). 견적에 요청 정보가 있으면 그것도 돌려준다. */
export function restoreFromQuote(st: QuoteState, q: Json, base: Json): { st: QuoteState; reqProfile?: Json; reqSpots?: string[] } | null {
    if (!q || typeof q !== 'object') return null;
    const next: QuoteState = { ...st };
    next.customer = q.customer || '';
    next.destination = q.destination || '';
    next.quoteNo = q.quoteNo || '';
    if (q.departISO) { next.depart = q.departISO; next.return_ = q.returnISO || ''; }
    else { const m = String(q.period || '').match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/); if (m) { next.depart = m[1]; next.return_ = m[2]; } }
    next.pax = q.pax || next.pax;
    next.paxNote = q.paxNote || '';
    next.vehicle = q.vehicle || '';
    next.intensity = q.intensity || 3;
    const noTbd = (v: unknown) => (v && v !== '미정') ? String(v) : '';
    next.flightIn = noTbd(q.flight && q.flight.in);
    next.flightOut = noTbd(q.flight && q.flight.out);
    next.manager = q.manager || base.manager || '';
    next.pickup = noTbd(q.pickup).replace(/^(.+) 공항$/, (m, p) => p === next.flightIn ? '' : m);
    next.drop = noTbd(q.drop).replace(/^(.+) 공항$/, (m, p) => p === next.flightOut ? '' : m);
    next.benefits = q.benefits || '';
    next.events = Array.isArray(q.events) ? q.events.join('\n') : '';
    next.remark = (q.remark && q.remark !== '-') ? q.remark : '';
    if (q.price) {
        if (q.price.deposit != null) next.deposit = q.price.deposit;
        next.options = clone(q.price.options || []);
        next.balances = clone(q.price.balances || []);
    }
    next.days = clone(q.days || []);
    next.spots = (q.highlights || []).map((h: Json) => h && h.name).filter(Boolean);
    if (q.requestProfile && typeof q.requestProfile === 'object') {
        const reqProfile = clone(q.requestProfile);
        return { st: next, reqProfile, reqSpots: Array.isArray(reqProfile.preferredSpots) ? reqProfile.preferredSpots.slice() : [] };
    }
    return { st: next };
}

/** 다른 견적의 ‘내용만’ 가져오기 — 고객명·날짜·인원·문서번호·항공은 그대로(옛 importQuoteContent) */
export function importQuoteContent(st: QuoteState, q: Json): QuoteState | null {
    if (!q || typeof q !== 'object') return null;
    const next: QuoteState = { ...st };
    if (q.destination) next.destination = q.destination;
    next.vehicle = q.vehicle || '';
    next.intensity = q.intensity || 3;
    next.benefits = q.benefits || '';
    next.events = Array.isArray(q.events) ? q.events.join('\n') : '';
    next.remark = (q.remark && q.remark !== '-') ? q.remark : '';
    if (q.price) {
        if (q.price.deposit != null) next.deposit = q.price.deposit;
        next.options = clone(q.price.options || []);
        next.balances = clone(q.price.balances || []);
    }
    next.days = clone(q.days || []);
    next.spots = (q.highlights || []).map((h: Json) => h && h.name).filter(Boolean);
    return next;
}

/** 서버의 고객 요청 한 건 → 편집 상태·요청 값(옛 readCurrentRequest) */
export function stateFromRequest(st: QuoteState, item: Json, ctx: RequestContext): { st: QuoteState; ctx: RequestContext; quote: Json | null } {
    const reqSpots = Array.isArray(item.destSpots) ? item.destSpots : [];
    return {
        st: { ...st, email: item.email || '', customer: item.name || '', phone: item.phone || '', depart: item.depart || '', return_: item.return_ || '',
            destination: item.destination || '', vehicle: item.vehicle || '', flightIn: item.flightIn || '', flightOut: item.flightOut || '',
            pax: (item.adult || 0) + (item.child || 0) + (item.infant || 0) || 6 },
        ctx: { ...ctx, reqId: String(item.id), reqToken: item.token || '', fromReq: true, savedEmail: item.email || '',
            reqPax0: { adult: item.adult || 0, child: item.child || 0, infant: item.infant || 0 }, reqSpots,
            reqVehicle: item.vehicle || '', reqReceivedAt: item.receivedAt || '', reqDestination: item.destination || '',
            reqProfile: { tripType: item.tripType || '', travelStyles: Array.isArray(item.travelStyles) ? item.travelStyles : [],
                cityStay: item.cityStay || '', gerStay: item.gerStay || '', request: item.request || '', preferredSpots: reqSpots } },
        quote: item.quote || null,
    };
}

/** 저장할 때 보내는 내용. 요청에서 열었으면 PATCH(견적 + 인원·일정·여행지·연락처), 아니면 새 견적 POST(옛 runSave와 같다). */
export function savePayload(st: QuoteState, q: Json, ctx: RequestContext, share: boolean, now: Date = new Date()):
    { method: 'PATCH'; id: string; body: Json } | { method: 'POST'; body: Json } {
    const email = (st.email || '').trim();
    const n = nightsOf(st);
    if (ctx.reqId && ctx.reqToken) {
        const body: Json = share ? { quote: q, notifyQuote: true } : { quote: q, silentQuote: true };
        const totalNow = st.pax || 0;
        if (totalNow > 0) {
            const o = ctx.reqPax0 || { adult: 0, child: 0, infant: 0 };
            const origTotal = (o.adult || 0) + (o.child || 0) + (o.infant || 0);
            Object.assign(body, origTotal === totalNow ? { adult: o.adult || 0, child: o.child || 0, infant: o.infant || 0 } : { adult: totalNow, child: 0, infant: 0 });
        }
        if (st.depart && st.return_) { body.depart = st.depart; body.return_ = st.return_; body.nights = (n && n > 0) ? n : null; }
        if (st.destination) body.destination = st.destination;
        const tel = st.phone.replace(/[^0-9]/g, '');
        if (tel) body.phone = tel;
        if (email !== ctx.savedEmail) body.email = email;
        return { method: 'PATCH', id: ctx.reqId, body };
    }
    return { method: 'POST', body: {
        status: '진행중',
        name: st.customer.trim(), phone: st.phone.replace(/[^0-9]/g, ''), email,
        destination: st.destination || '',
        depart: st.depart || '', return_: st.return_ || '',
        nights: n && n > 0 ? n : null,
        adult: st.pax || 0, child: 0, infant: 0,
        receivedAt: now.toISOString(),
        source: ctx.anonymousShare ? 'course-share' : 'walkin', quote: q,
        silentQuote: !share,
    } };
}

export const validEmail = (email: string): boolean => !email || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

/** 아래 막대의 예상 총액(인원 × (예약금 + 고른 숙소의 잔금)). 그 인원 잔금이 없으면 null. */
export function estimateTotal(st: QuoteState): { perPerson: number; total: number } | null {
    const b = st.balances.find(x => x.pax === st.pax);
    if (!b) return null;
    const per = (st.deposit || 0) + (st.roomType !== ROOM_FULL ? balEco(b) : balFull(b));
    return { perPerson: per, total: per * st.pax };
}

/** 저장된 일정 한 개로 그 일차를 채운다(일차 번호·날짜는 그대로) */
export function dayFromSnippet(day: QuoteDay, s: Json): QuoteDay {
    return { d: day.d, date: day.date || '', dest: s.dest || '', move: s.move || '', dist: s.dist || '',
        items: [...(s.items || [])], stay: { name: s.stay?.name || '', tags: [...(s.stay?.tags || [])] }, meals: [...(s.meals || ['', '', ''])] };
}

export const emptyDay = (d: number): QuoteDay => ({ d, dest: '', move: '', dist: '', items: [], stay: { name: '', tags: [] }, meals: ['', '', ''] });
export const renumber = (days: QuoteDay[]): QuoteDay[] => days.map((day, i) => ({ ...day, d: i + 1 }));

/** 고객 링크(알림톡 템플릿과 같은 주소 — 바꾸지 말 것, CLAUDE.md 3.1) */
export const customerQuoteLink = (origin: string, token: string): string => origin + '/' + encodeURI('내견적.html') + '?t=' + token;
