/**
 * 견적서 만들기 화면(2026-11-26 Claude Design ‘견적서 만들기 개선’)의 표시 계산 — 저장하는 견적 문서(quoteBuilder.ts의 buildQuote)는 바꾸지 않는다.
 * 한 화면에 섹션 6개(기본 정보 · 코스 · 일자별 일정 · 요금 · 대표 명소 · 혜택·비고)를 차례로 두고,
 * 위 단계 줄의 완료 표시 · 오른쪽 ‘보내기 전 확인’ · 고객 요청 반영 여부 · 아래 막대의 확인 알약을 여기서 계산한다.
 */
import { ROOM_FULL, balEco, balFull, dayDateStr, nightsOf, validEmail, type Json, type QuoteDay, type QuoteState, type RequestContext } from './quoteBuilder';

export const BUILDER_SECTIONS = [
    { id: 'qb-basic', label: '기본 정보' },
    { id: 'qb-course', label: '코스' },
    { id: 'qb-days', label: '일자별 일정' },
    { id: 'qb-price', label: '요금' },
    { id: 'qb-spots', label: '대표 명소' },
    { id: 'qb-notes', label: '혜택 · 비고' },
] as const;
export type BuilderSectionId = typeof BUILDER_SECTIONS[number]['id'];

export type CheckState = 'done' | 'todo' | 'optional';
export interface BuilderCheck { key: string; label: string; note: string; state: CheckState; section: BuilderSectionId }

/** 일정이 비었는지(목적지·세부 일정 둘 다 없음) */
export const dayEmpty = (day: QuoteDay): boolean => !String(day.dest || '').trim() && !(day.items || []).some(line => String(line).trim());

/** 식사 칸: 조식·중식·석식을 쉼표로 이은 한 줄 ↔ 세 칸 배열 */
export const mealsText = (meals: unknown): string => (Array.isArray(meals) ? meals.map(m => String(m ?? '').trim()) : []).join(', ').replace(/^(, )+$/, '');
export function mealsFromText(text: string): string[] {
    const parts = text.split(',').map(part => part.trim());
    return [parts[0] || '', parts[1] || '', parts.slice(2).join(', ').trim()];
}

/** 여행 기간 글자 “2박 3일”(날짜가 없으면 빈 값) */
export function tripLength(st: Pick<QuoteState, 'depart' | 'return_'>): string {
    const n = nightsOf(st);
    return n && n > 0 ? `${n}박 ${n + 1}일` : '';
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const parseIso = (iso: string): Date | null => {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
};
/** “11.26 (목)” */
export const shortDay = (iso: string): string => { const d = parseIso(iso); return d ? `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')} (${DOW[d.getDay()]})` : ''; };
/** 머리 줄의 기간 “2026.11.26 – 11.28” */
export function periodText(st: Pick<QuoteState, 'depart' | 'return_'>): string {
    const a = parseIso(st.depart), b = parseIso(st.return_);
    if (!a) return '';
    const head = `${a.getFullYear()}.${String(a.getMonth() + 1).padStart(2, '0')}.${String(a.getDate()).padStart(2, '0')}`;
    if (!b) return head;
    const tail = `${b.getFullYear() !== a.getFullYear() ? b.getFullYear() + '.' : ''}${String(b.getMonth() + 1).padStart(2, '0')}.${String(b.getDate()).padStart(2, '0')}`;
    return `${head} – ${tail}`;
}

/** 일차 날짜가 출발일에서 자동으로 채운 값인지(어느 자리의 자동 날짜와도 같으면 자동) */
const autoDate = (date: string, depart: string, count: number): boolean => {
    if (!date) return true;
    for (let i = 0; i < count + 1; i++) if (dayDateStr(depart, i) === date) return true;
    return false;
};
/** 출발일 기준 날짜를 일차 자리에 맞춘다 — 직접 적은 날짜는 그대로 둔다. prevDepart는 바뀌기 전 출발일 */
export function syncDayDates(days: QuoteDay[], depart: string, prevDepart = depart): QuoteDay[] {
    if (!depart) return days;
    return days.map((day, i) => {
        const date = String(day.date || '');
        const auto = autoDate(date, prevDepart, days.length) || autoDate(date, depart, days.length);
        const next = dayDateStr(depart, i);
        return auto && date !== next ? { ...day, date: next } : day;
    });
}

/** 코스의 기간 글자 — 코스 관리의 nights 칸, 없으면 일정 수로 */
export function courseLength(course: Json): string {
    const nights = String(course?.nights || '').trim();
    if (nights) return nights;
    const count = Array.isArray(course?.days) ? course.days.length : 0;
    return count ? `${Math.max(0, count - 1)}박 ${count}일` : '';
}
const compact = (s: string) => s.replace(/\s/g, '');

/** 코스 고르기 목록: 지역(코스의 여행지)·검색어로 거르고, 여행 기간과 맞는 코스를 먼저 */
export function courseRows(sorted: Array<[string, Json]>, opts: { region: string; query: string; length: string }) {
    const q = opts.query.trim();
    const rows = sorted
        .filter(([name, c]) => (opts.region === 'all' || String(c.destination || '') === opts.region) && (!q || name.includes(q) || String(c.destination || '').includes(q)))
        .map(([name, c]) => ({ name, region: String(c.destination || ''), length: courseLength(c), match: !!opts.length && compact(courseLength(c)) === compact(opts.length) }));
    return rows.filter(r => r.match).concat(rows.filter(r => !r.match));
}
export function courseRegions(sorted: Array<[string, Json]>): Array<{ value: string; label: string; count: number }> {
    const counts = new Map<string, number>();
    sorted.forEach(([, c]) => { const r = String(c.destination || '').trim(); if (r) counts.set(r, (counts.get(r) || 0) + 1); });
    return [{ value: 'all', label: '전체', count: sorted.length }, ...[...counts].map(([value, count]) => ({ value, label: value, count }))];
}

/** 일정 불러오기: 저장된 일정(일정 관리)을 지역별로 묶는다 */
export function snippetGroups(snippets: Record<string, Json>, cats: string[], opts: { cat: string; query: string }) {
    const q = opts.query.trim();
    const order = [...cats];
    Object.values(snippets).forEach(s => { const c = String(s?.cat || ''); if (!order.includes(c)) order.push(c); });
    return order
        .filter(cat => opts.cat === 'all' || cat === opts.cat)
        .map(cat => ({ cat, name: cat || '분류 없음', items: Object.keys(snippets).filter(name => String(snippets[name]?.cat || '') === cat && (!q || name.includes(q) || String(snippets[name]?.dest || '').includes(q))) }))
        .filter(group => group.items.length > 0);
}

/** 대표 명소 고르기: 지역 칩·검색 */
export function spotRows(spots: Record<string, Json>, opts: { region: string; query: string }) {
    const q = opts.query.trim();
    return Object.keys(spots).filter(name => {
        const s = spots[name] || {};
        if (opts.region !== 'all' && String(s.region || '') !== opts.region) return false;
        return !q || name.includes(q) || String(s.short || s.desc || '').includes(q) || String(s.nameMn || '').includes(q);
    });
}
export function spotRegions(spots: Record<string, Json>, cats: string[]) {
    const order = [...cats];
    Object.values(spots).forEach(s => { const r = String(s?.region || ''); if (r && !order.includes(r)) order.push(r); });
    const count = (r: string) => Object.values(spots).filter(s => String(s?.region || '') === r).length;
    return [{ value: 'all', label: '전체', count: Object.keys(spots).length }, ...order.map(r => ({ value: r, label: r, count: count(r) })).filter(r => r.count > 0)];
}

/** 같은 인원의 잔금 줄 */
export const balanceFor = (st: Pick<QuoteState, 'balances' | 'pax'>) => st.balances.find(b => b.pax === st.pax) || null;

/** 오른쪽·아래 막대의 금액(인원 × (예약금 + 잔금)). 그 인원 잔금이 없으면 null */
export function priceSummary(st: QuoteState) {
    const b = balanceFor(st);
    if (!b) return null;
    const full = st.roomType === ROOM_FULL;
    const balance = full ? balFull(b) : balEco(b);
    const other = full ? balEco(b) : balFull(b);
    const per = (st.deposit || 0) + balance;
    return {
        full, balance, per, total: per * st.pax,
        deposit: (st.deposit || 0) * st.pax, rest: balance * st.pax,
        otherTotal: ((st.deposit || 0) + other) * st.pax,
    };
}

export type RequestMark = 'ok' | 'warn' | 'info';
export interface RequestItem { key: string; label: string; note: string; mark: RequestMark; section: BuilderSectionId }

const dayText = (day: QuoteDay) => [day.dest, ...(day.items || [])].map(x => String(x || '')).join(' ');
const daysWith = (days: QuoteDay[], words: string[]) => days.map((day, i) => words.some(w => w && dayText(day).includes(w)) ? i + 1 : 0).filter(Boolean);
const dayList = (nums: number[]) => nums.slice(0, 3).join('·') + '일차' + (nums.length > 3 ? ' 외' : '');

/**
 * 고객 요청 사항이 지금 견적에 들어갔는지(참고용 표시 — 저장·발송을 막지 않는다).
 * 희망 명소 → 대표 명소·일정, 여행 스타일 → 일정 글자, 도시 숙소 → 일정표 숙소, 게르 → 총액 기준, 차량 → 기본 정보 차량.
 */
export function requestItems(st: QuoteState, ctx: RequestContext): RequestItem[] {
    if (!ctx.fromReq) return [];
    const p = ctx.reqProfile || {};
    const items: RequestItem[] = [];
    (ctx.reqSpots || []).forEach(name => {
        const at = st.spots.indexOf(name), days = daysWith(st.days, [name]);
        const ok = at >= 0 || days.length > 0;
        items.push({ key: 'spot:' + name, label: name, section: at >= 0 || !ok ? 'qb-spots' : 'qb-days', mark: ok ? 'ok' : 'warn',
            note: ok ? [days.length ? dayList(days) + ' 일정' : '', at >= 0 ? `대표 명소 ${at + 1}번` : ''].filter(Boolean).join(', ') : '대표 명소·일정에 아직 없어요' });
    });
    (Array.isArray(p.travelStyles) ? p.travelStyles : []).forEach((style: string) => {
        const words = String(style).split(/[·,/]/).map(w => w.trim()).filter(Boolean);
        const days = daysWith(st.days, words);
        items.push({ key: 'style:' + style, label: style, section: 'qb-days', mark: days.length ? 'ok' : 'info',
            note: days.length ? `${dayList(days)} 일정에 포함` : '일정에서 확인해 주세요' });
    });
    const city = String(p.cityStay || '');
    if (city && city !== '상관없음') {
        const grade = city.match(/(\d)\s*성급/)?.[1];
        const word = grade ? `${grade}성급` : city.includes('게스트') ? '게스트' : city.replace(/\(.*\)/, '').trim();
        const stays = st.days.map(day => String(day.stay?.name || ''));
        const ok = stays.some(name => name.includes(word));
        items.push({ key: 'city', label: city, section: 'qb-days', mark: ok ? 'ok' : 'warn',
            note: ok ? '일정표 숙소에 반영' : `견적 숙소에 ${word}이 없어요. 숙소나 업그레이드 안내를 확인해 주세요` });
    }
    const ger = String(p.gerStay || '');
    if (ger && ger !== '상관없음') {
        const wantFull = ger.includes('고급');
        const ok = wantFull === (st.roomType === ROOM_FULL);
        items.push({ key: 'ger', label: ger, section: 'qb-price', mark: ok ? 'ok' : 'warn',
            note: ok ? `${wantFull ? '풀패키지 · 고급 게르' : '실속형 · 일반 게르'} 기준으로 계산 중` : `총액 기준이 ${wantFull ? '실속형' : '풀패키지'}이에요` });
    }
    const car = String(ctx.reqVehicle || '');
    if (car && car !== '상관없음') {
        const name = car.replace(/\(.*\)/, '').trim();
        const ok = !!name && st.vehicle.includes(name);
        items.push({ key: 'car', label: car, section: 'qb-basic', mark: ok ? 'ok' : 'warn',
            note: ok ? '기본 정보 차량에 반영' : st.vehicle ? `견적 차량은 ‘${st.vehicle}’이에요` : '기본 정보 차량이 비어 있어요' });
    }
    return items;
}

/** 오른쪽 ‘보내기 전 확인’ 목록 */
export function builderChecks(st: QuoteState, ctx: RequestContext, pickedCourse: string): BuilderCheck[] {
    const checks: BuilderCheck[] = [];
    const missing = [
        !st.customer.trim() && !ctx.anonymousShare ? '고객명' : '',
        !st.destination.trim() ? '여행지' : '',
        !(st.pax > 0) ? '인원' : '',
        !validEmail((st.email || '').trim()) ? '이메일 형식' : '',
    ].filter(Boolean);
    checks.push({ key: 'basic', label: '기본 정보', section: 'qb-basic', state: missing.length ? 'todo' : 'done', note: missing.length ? missing.join('·') + ' 확인' : '' });
    checks.push({ key: 'course', label: '코스', section: 'qb-course', state: pickedCourse || st.days.length ? 'done' : 'optional', note: pickedCourse || (st.days.length ? '직접 작성' : '선택 · 미선택') });
    const n = nightsOf(st);
    const need = n && n > 0 ? n + 1 : 0;
    const empty = st.days.map((day, i) => dayEmpty(day) ? i + 1 : 0).filter(Boolean);
    const daysNote = !st.days.length ? '일정 없음'
        : need && need !== st.days.length ? `일정 ${st.days.length}일 · ${need}일 필요`
        : empty.length > 3 ? `${empty.length}일 미작성` : empty.length ? `${dayList(empty)} 미작성` : `${st.days.length}일`;
    checks.push({ key: 'days', label: '일자별 일정', section: 'qb-days', state: !st.days.length || empty.length || (need && need !== st.days.length) ? 'todo' : 'done', note: daysNote });
    const b = balanceFor(st);
    checks.push({ key: 'price', label: '요금', section: 'qb-price', state: b ? 'done' : 'todo', note: b ? `${st.pax}인 기준` : `${st.pax}인 잔금 없음` });
    checks.push({ key: 'spots', label: '대표 명소', section: 'qb-spots', state: st.spots.length ? 'done' : 'todo', note: `${st.spots.length}곳` });
    const reqItems = ctx.fromReq ? requestItems(st, ctx) : [];
    if (reqItems.length) {
        const items = reqItems, warns = items.filter(i => i.mark === 'warn');
        checks.push({ key: 'request', label: '고객 요청 반영', section: warns[0]?.section || 'qb-basic', state: warns.length ? 'todo' : 'done',
            note: warns.length ? `${warns[0].label}${warns.length > 1 ? ` 외 ${warns.length - 1}건` : ''} 확인` : `${items.filter(i => i.mark === 'ok').length}개 반영` });
    }
    const flight = st.flightIn.trim() || st.flightOut.trim();
    checks.push({ key: 'flight', label: '항공편', section: 'qb-basic', state: flight ? 'done' : 'optional', note: flight ? '입력됨' : '선택 · 미입력' });
    return checks;
}

/** 위 단계 줄: 섹션마다 완료 표시와 짧은 꼬리 글자 */
export function sectionMarks(st: QuoteState, checks: BuilderCheck[]): Record<BuilderSectionId, { done: boolean; note: string }> {
    const by = (key: string) => checks.find(c => c.key === key);
    const filled = st.days.filter(day => !dayEmpty(day)).length;
    const days = by('days');
    return {
        'qb-basic': { done: by('basic')?.state === 'done', note: '' },
        'qb-course': { done: by('course')?.state === 'done', note: '' },
        'qb-days': { done: days?.state === 'done', note: days?.state === 'done' ? '' : `${filled}/${st.days.length}일` },
        'qb-price': { done: by('price')?.state === 'done', note: '' },
        'qb-spots': { done: by('spots')?.state === 'done', note: '' },
        'qb-notes': { done: !!(st.benefits.trim() || st.events.trim()), note: '' },
    };
}

/** 연락처 가림 “010-5717-7***” */
export function maskPhone(phone: string): string {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 8) return phone ? phone.replace(/.{3}$/, '***') : '';
    const head = digits.slice(0, 3), mid = digits.slice(3, digits.length - 4), tail = digits.slice(-4);
    return `${head}-${mid}-${tail.slice(0, 1)}***`;
}

/** “11.26 (목) 오후 4:12” */
export function receivedText(iso: string): string {
    const d = new Date(iso);
    if (!iso || isNaN(d.getTime())) return '';
    const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
    return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')} (${DOW[d.getDay()]}) ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${m}`;
}

/** “오후 5:45” */
export function clockText(time: number): string {
    const d = new Date(time);
    const h = d.getHours();
    return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 인원 구성 “성인 2명 · 아동 1명” */
export function paxText(p: { adult: number; child: number; infant: number } | null): string {
    if (!p) return '';
    return [p.adult ? `성인 ${p.adult}명` : '', p.child ? `아동 ${p.child}명` : '', p.infant ? `유아 ${p.infant}명` : ''].filter(Boolean).join(' · ');
}
