/**
 * 견적 예약 편집기(예약관리) — 화면 없이 계산만 모은 곳. 옛 도구 public/예약관리.html(+ booking.js · quote-booking-workspace.js)을
 * React로 옮기는 첫 단계다. 결과는 옛 문서와 같아야 한다 — tests/quote-booking-editor.test.mjs가 옛 함수를 꺼내 같은 자료로 비교한다.
 *
 * 옛 화면은 입력칸(DOM)에서 예약(BK)을 다시 읽었다(pullForm). 여기서는 입력칸 값을 담은 `BookingForm`을 두고
 * `pullBooking(예약, 입력값, 등록 자원)`이 같은 규칙으로 예약을 만든다. 입력칸의 처음 값은 `formFromBooking`(옛 render와 같다).
 */
import { lodgingPhotos, lodgingSnapshot, lodgingPublicData } from '../../utils/lodgingDisplay';

export type Json = Record<string, any>;
/** 예약 편집기가 읽는 견적 요청(옛 PRE) */
export type BookingRecord = Json & { id: string | number };
export interface BookingLibraries { guides: Record<string, Json>; lodges: Record<string, Json>; vehicles: Record<string, Json> }

// ─────────────── booking.js(공유 틀) ───────────────
export const DEFAULT_DEPOSIT_ACCOUNT = Object.freeze({ bankName: '우리은행', accountNumber: '1002-245-516496', accountHolder: 'DAVAASUREN (헬로볼라)' });
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export function blankBooking(): Json {
    return {
        confirmedAt: '', publishStatus: 'draft', publishedAt: '', days: [],
        assign: { guide: { name: '', nameEn: '', role: '', phone: '', qr: '', img: '', desc: '' },
            vehicle: { model: '', seats: '', luggage: '', plate: '', img: '', imgs: [], desc: '' }, lodges: [] },
        travelers: [],
        travelerSubmission: { status: 'not_requested', requestedAt: '', submittedAt: '', expectedCount: 0, submittedCount: 0 },
        flight: { inDate: '', inDepTime: '', inTime: '', inNo: '', outDate: '', outTime: '', outArrTime: '', outNo: '' },
        pickupLodge: '', travelerNote: '', contractPackageType: '',
        contractInfo: { productName: '', region: '', totalAmount: 0, depositAmount: 0, depositStatus: '미입금', balanceAmount: 0, balanceStatus: '미수령', cashReceipt: '', ...DEFAULT_DEPOSIT_ACCOUNT, note: '' },
        preparedAt: '',
        depositRequest: { status: 'not_sent', requestedAt: '' },
        depositReport: { status: 'none', name: '', reportedAt: '' },
        contractRequest: { status: 'not_sent', requestedAt: '' },
        checklist: { deposit: false, balance: false, flight: false, insurance: false, contract: false },
        contract: null, highlights: [], notes: '', adminMemo: '', autoSeeded: false,
    };
}
/** 저장돼 있던 예약 + 빈 틀(구버전 자료 호환) */
export function normBooking(b: Json | null | undefined): Json {
    const base = blankBooking();
    if (!b) return base;
    const assign = b.assign || {};
    return { ...base, ...b,
        assign: { ...base.assign, ...assign, guide: { ...base.assign.guide, ...(assign.guide || {}) }, vehicle: { ...base.assign.vehicle, ...(assign.vehicle || {}) },
            lodges: Array.isArray(assign.lodges) ? assign.lodges : [] },
        travelers: Array.isArray(b.travelers) ? b.travelers : [],
        travelerSubmission: { ...base.travelerSubmission, ...(b.travelerSubmission || {}) },
        flight: { ...base.flight, ...(b.flight || {}) },
        contractInfo: { ...base.contractInfo, ...(b.contractInfo || {}) },
        depositRequest: { ...base.depositRequest, ...(b.depositRequest || {}) },
        depositReport: { ...base.depositReport, ...(b.depositReport || {}) },
        contractRequest: { ...base.contractRequest, ...(b.contractRequest || {}) },
        checklist: { ...base.checklist, ...(b.checklist || {}) },
        highlights: Array.isArray(b.highlights) ? b.highlights : [],
    };
}
export const daysFromQuote = (q: Json | null | undefined): Json[] => (q && Array.isArray(q.days)) ? clone(q.days) : [];
const balEco = (b: Json) => (b && b.economy != null ? b.economy : ((b && b.amount) || 0));
const balFull = (b: Json) => (b && b.full != null ? b.full : ((b && b.amount) || 0));
/** 견적(1인·인원별·숙소 종류별)에서 계약 금액 — 예약금 = 1인 예약금×인원, 잔금 = 그 인원 잔금×인원 */
export function quoteMoney(rec: Json | null | undefined): { totalAmount: number; depositAmount: number; balanceAmount: number } {
    rec = rec || {};
    const q = rec.quote || null, p = q && q.price;
    if (!p) return { totalAmount: 0, depositAmount: 0, balanceAmount: 0 };
    const pax = Number(q.pax) || ((rec.adult || 0) + (rec.child || 0) + (rec.infant || 0)) || 0;
    const isFull = /풀패키지|최고급|고급/.test(`${rec.pkgTier || ''} ${rec.gerStay || ''}`);
    const bals: Json[] = Array.isArray(p.balances) ? p.balances : [];
    let row = bals.find(b => Number(b.pax) === pax);
    if (!row && bals.length) row = bals.reduce((a, b) => Math.abs(Number(b.pax) - pax) < Math.abs(Number(a.pax) - pax) ? b : a);
    const per = row ? (isFull ? balFull(row) : balEco(row)) : 0;
    const depositAmount = (Number(p.deposit) || 0) * pax, balanceAmount = per * pax;
    return { totalAmount: depositAmount + balanceAmount, depositAmount, balanceAmount };
}
/** 예약이 없는 요청: 견적에서 예약 뼈대를 만든다(서버 functions/lib/quoteBookingSeed.mjs와 같다) */
export function seedBookingFromQuote(rec: Json | null | undefined): Json {
    rec = rec || {};
    const bk = blankBooking(), q = rec.quote || null, qm = quoteMoney(rec);
    bk.days = daysFromQuote(q);
    if (q && Array.isArray(q.highlights)) bk.highlights = clone(q.highlights);
    bk.contractInfo = { ...bk.contractInfo, productName: rec.destination || '', region: rec.destination || '',
        totalAmount: qm.totalAmount, depositAmount: qm.depositAmount, depositStatus: '미입금', balanceAmount: qm.balanceAmount, balanceStatus: '미수령' };
    bk.flight = { ...bk.flight, inDate: rec.depart || '', outDate: rec.return_ || '' };
    bk.autoSeeded = true;
    return bk;
}

// ─────────────── 처음 열기(옛 init) ───────────────
/** 요청에서 편집할 예약을 만든다: 저장된 예약 정리 또는 견적에서 새로 · 금액·계좌·항공 날짜·대표 명소 기본값 */
export function prepareBooking(pre: BookingRecord): Json {
    const bk = pre.booking ? normBooking(clone(pre.booking)) : seedBookingFromQuote(pre);
    if (pre.booking && pre.booking.publishStatus == null && pre.status === '예약확정') bk.publishStatus = 'published';
    const qm = quoteMoney(pre), saved = pre.booking?.contractInfo;
    bk.contractInfo = { ...bk.contractInfo,
        productName: bk.contractInfo.productName || pre.destination || '',
        region: bk.contractInfo.region || pre.destination || '',
        totalAmount: saved?.totalAmount ?? qm.totalAmount,
        depositAmount: saved?.depositAmount ?? qm.depositAmount,
        depositStatus: bk.contractInfo.depositStatus || (bk.checklist.deposit ? '입금완료' : '미입금'),
        balanceAmount: saved?.balanceAmount ?? qm.balanceAmount,
        balanceStatus: bk.contractInfo.balanceStatus || (bk.checklist.balance ? '입금완료' : '미수령'),
        cashReceipt: bk.contractInfo.cashReceipt || '',
        bankName: bk.contractInfo.bankName || DEFAULT_DEPOSIT_ACCOUNT.bankName,
        accountNumber: bk.contractInfo.accountNumber || DEFAULT_DEPOSIT_ACCOUNT.accountNumber,
        accountHolder: bk.contractInfo.accountHolder || DEFAULT_DEPOSIT_ACCOUNT.accountHolder,
    };
    bk.flight = { ...bk.flight, inDate: bk.flight.inDate || pre.depart || '', outDate: bk.flight.outDate || pre.return_ || '' };
    if (!Array.isArray(pre.booking?.highlights) && pre.quote && Array.isArray(pre.quote.highlights)) bk.highlights = clone(pre.quote.highlights);
    return bk;
}

// ─────────────── 입력칸(옛 render의 값 → pullForm) ───────────────
export const LODGE_GRADES = ['', '일반게르', '고급게르', '호텔'] as const;
export const TRAVELER_GENDERS = ['', '남', '여'] as const;
export const DEPOSIT_STATUSES = ['미입금', '입금완료'] as const;
export const BALANCE_STATUSES = ['미수령', '입금완료', '현지현금전달', '계좌입금', '카드결제'] as const;
export const PACKAGE_TYPES: ReadonlyArray<readonly [string, string]> = [['', '미지정'], ['value', '실속'], ['full', '풀패키지']];
export const GUIDE_ROLES = ['가이드 겸 드라이버', '전문 가이드', '전문 가이드 + 기사'] as const;
export const PRODUCT_NAMES = ['중앙몽골', '고비사막', '홉스골', '남고비 사막앤초원', '중앙몽골+테를지', '울란바타르+테를지', '홉스골+테를지', '고비사막+중앙몽골'] as const;
export const REGIONS = ['중앙몽골', '고비사막', '남고비', '홉스골', '테를지', '울란바타르', '울란바타르+테를지', '중앙몽골+테를지', '홉스골+테를지', '고비사막+중앙몽골'] as const;
export const CASH_RECEIPTS = ['완료', '예정', '해당x', '전자세금계산서', '현금영수증', '미발행'] as const;

export interface LodgeRow { day: string; name: string; grade: string; desc: string }
export interface TravelerRow { type: string; nameKo: string; passportName: string; birth: string; phone: string; gender: string; passportNo: string }
export interface BookingForm {
    guide: { name: string; nameEn: string; role: string; phone: string; qr: string; img: string; desc: string };
    vehicle: { model: string; seats: string; luggage: string; plate: string; desc: string };
    lodges: LodgeRow[];
    travelers: TravelerRow[];
    flight: { inDate: string; inDepTime: string; inTime: string; inNo: string; outDate: string; outTime: string; outArrTime: string; outNo: string };
    pickupLodge: string; travelerNote: string;
    contract: { productName: string; region: string; cashReceipt: string; totalAmount: string; depositAmount: string; balanceAmount: string;
        depositStatus: string; balanceStatus: string; packageType: string; bankName: string; accountNumber: string; accountHolder: string; note: string };
    checklist: { deposit: boolean; balance: boolean; flight: boolean; insurance: boolean; contract: boolean };
    notes: string; memo: string;
    /** 아래 막대의 ‘일정표 공개’ 표시(옛 #publishSchedule) */
    publish: boolean;
}
const s = (value: unknown) => (value == null ? '' : String(value));
/** 고르기 칸: 목록에 없는 값이면 첫 항목이 보인다(옛 select와 같다) */
const pick = (value: unknown, options: readonly string[]) => (options.includes(s(value)) ? s(value) : options[0]);

export const lodgeRowOf = (l: Json, i: number): LodgeRow => ({ day: s(l.day || i + 1), name: s(l.name || ''), grade: pick(l.grade, LODGE_GRADES), desc: s(l.descCustom || '') });
export const travelerRowOf = (t: Json): TravelerRow => ({ type: s(t.type || '성인'), nameKo: s(t.nameKo || ''), passportName: s(t.passportName || ''), birth: s(t.birth || ''),
    phone: s(t.phone || ''), gender: pick(t.gender, TRAVELER_GENDERS), passportNo: s(t.passportNo || '') });

export function formFromBooking(bk: Json, pre: BookingRecord): BookingForm {
    const a = bk.assign, c = bk.checklist, fl = bk.flight || {}, ci = bk.contractInfo || {};
    return {
        guide: { name: s(a.guide.name), nameEn: s(a.guide.nameEn), role: s(a.guide.role), phone: s(a.guide.phone), qr: s(a.guide.qr), img: s(a.guide.img), desc: s(a.guide.desc) },
        vehicle: { model: s(a.vehicle.model), seats: s(a.vehicle.seats), luggage: s(a.vehicle.luggage || ''), plate: s(a.vehicle.plate), desc: s(a.vehicle.desc) },
        lodges: a.lodges.map(lodgeRowOf),
        travelers: (bk.travelers || []).map(travelerRowOf),
        flight: { inDate: s(fl.inDate || pre.depart || ''), inDepTime: s(fl.inDepTime || ''), inTime: s(fl.inTime || ''), inNo: s(fl.inNo || ''),
            outDate: s(fl.outDate || pre.return_ || ''), outTime: s(fl.outTime || ''), outArrTime: s(fl.outArrTime || ''), outNo: s(fl.outNo || '') },
        pickupLodge: s(bk.pickupLodge || ''), travelerNote: s(bk.travelerNote || ''),
        contract: { productName: s(ci.productName || pre.destination || ''), region: s(ci.region || pre.destination || ''), cashReceipt: s(ci.cashReceipt || ''),
            totalAmount: s(ci.totalAmount || 0), depositAmount: s(ci.depositAmount || 0), balanceAmount: s(ci.balanceAmount || 0),
            depositStatus: pick(ci.depositStatus || '미입금', DEPOSIT_STATUSES), balanceStatus: pick(ci.balanceStatus || '미수령', BALANCE_STATUSES),
            packageType: pick(bk.contractPackageType, PACKAGE_TYPES.map(([value]) => value)),
            bankName: s(ci.bankName || ''), accountNumber: s(ci.accountNumber || ''), accountHolder: s(ci.accountHolder || ''), note: s(ci.note || '') },
        checklist: { deposit: !!c.deposit, balance: !!c.balance, flight: !!c.flight, insurance: !!c.insurance, contract: !!(c.contract || (bk.contract && bk.contract.signedAt)) },
        notes: s(bk.notes), memo: s(bk.adminMemo),
        publish: bk.publishStatus === 'published',
    };
}

/** 등록 자원을 읽은 뒤: 옛 예약에서 비어 있던 고객 노출 칸만 등록 정보로 채운다(옛 loadLibs의 fillEmpty) */
export function fillFromLibraries(form: BookingForm, bk: Json, libs: BookingLibraries): BookingForm {
    const fill = (current: string, value: unknown) => (!current.trim() && value ? String(value) : current);
    const g = libs.guides[bk.assign.guide.name] || {}, v = libs.vehicles[bk.assign.vehicle.model] || {};
    return { ...form,
        guide: { ...form.guide, phone: fill(form.guide.phone, g.phone || ''), qr: fill(form.guide.qr, g.qr || '') },
        vehicle: { ...form.vehicle, luggage: fill(form.vehicle.luggage, v.luggage || ''), desc: fill(form.vehicle.desc, v.desc || '') } };
}

/** 입력칸 → 예약(옛 pullForm). 일정(days)·대표 명소·서명·요청 상태 등 입력칸이 없는 칸은 그대로 둔다. */
export function pullBooking(bk: Json, form: BookingForm, libs: BookingLibraries): Json {
    const next: Json = { ...bk, assign: { ...bk.assign } };
    const t = (value: string) => value.trim();
    const g = form.guide;
    next.assign.guide = { name: t(g.name), nameEn: t(g.nameEn), role: t(g.role), phone: t(g.phone), qr: t(g.qr), img: t(g.img), desc: t(g.desc) };
    const prevVehicle = bk.assign.vehicle || {};
    const vehicle: Json = { model: t(form.vehicle.model), seats: t(form.vehicle.seats), luggage: t(form.vehicle.luggage), plate: t(form.vehicle.plate), img: '', imgs: [], desc: '' };
    // 숙소: 같은 일차·같은 이름이면 이전 기록(수배 상태 등)을 지키고, 등록 정보의 사진·태그를 함께 넣는다
    const prevLodges: Json[] = bk.assign.lodges || [];
    const previousByDay = new Map(prevLodges.map(l => [Number(l.day), l]));
    next.assign.lodges = form.lodges.map((row, index): Json => {
        const name = t(row.name), previous = prevLodges[index] || {};
        const lib: Json = lodgingSnapshot(libs.lodges[name], previous.name === name ? previous : {});
        const descCustom = t(row.desc), day = Number(row.day) || 0;
        const stored = previousByDay.get(day), roomCount = stored?.roomCount;
        return { ...(stored?.name === name ? stored : {}), ...lodgingPublicData(lib), day, ...(roomCount != null && roomCount !== '' ? { roomCount } : {}), name,
            grade: row.grade, region: lib.region || '', img: lib.img || '', imgs: Array.isArray(lib.imgs) ? lib.imgs : (lib.img ? [lib.img] : []), tags: lib.tags || '',
            descCustom, desc: descCustom || lib.desc || '' };
    }).filter(l => l.name || l.roomCount != null || l.mailStatus || l.mailSentDate || l.bookingStatus === '배정X');
    // 차량 사진·특징은 등록 정보에서, 기사는 같은 차량이면 이전 값을 지킨다
    const vlib = libs.vehicles[vehicle.model] || {};
    if (vlib.img) vehicle.img = vlib.img;
    vehicle.imgs = Array.isArray(vlib.imgs) ? vlib.imgs : (vlib.img ? [vlib.img] : []);
    vehicle.desc = t(form.vehicle.desc) || vlib.desc || '';
    const sameVehicle = (prevVehicle.model || prevVehicle.type || '') === vehicle.model;
    vehicle.driver = (sameVehicle ? prevVehicle.driver : '') || vlib.driver || '';
    vehicle.phone = (sameVehicle ? (prevVehicle.phone || prevVehicle.driverPhone) : '') || vlib.phone || '';
    next.assign.vehicle = vehicle;
    next.travelers = form.travelers.map(r => ({ type: r.type || '성인', nameKo: t(r.nameKo), passportName: t(r.passportName), birth: t(r.birth), phone: t(r.phone), gender: r.gender || '', passportNo: t(r.passportNo) }))
        .filter(r => r.nameKo || r.passportName || r.phone || r.passportNo);
    const fl = form.flight;
    next.flight = { inDate: t(fl.inDate), inDepTime: t(fl.inDepTime), inTime: t(fl.inTime), inNo: t(fl.inNo), outDate: t(fl.outDate), outTime: t(fl.outTime), outArrTime: t(fl.outArrTime), outNo: t(fl.outNo) };
    next.pickupLodge = t(form.pickupLodge);
    next.travelerNote = t(form.travelerNote);
    const ci = form.contract;
    next.contractPackageType = t(ci.packageType);
    next.contractInfo = { productName: t(ci.productName), region: t(ci.region), cashReceipt: t(ci.cashReceipt), bankName: t(ci.bankName), accountNumber: t(ci.accountNumber), accountHolder: t(ci.accountHolder), note: ci.note,
        totalAmount: Number(t(ci.totalAmount)) || 0, depositAmount: Number(t(ci.depositAmount)) || 0, depositStatus: t(ci.depositStatus) || '미입금',
        balanceAmount: Number(t(ci.balanceAmount)) || 0, balanceStatus: t(ci.balanceStatus) || '미수령' };
    next.checklist = { ...form.checklist,
        deposit: next.contractInfo.depositStatus === '입금완료',
        balance: ['입금완료', '현지현금전달', '현장현금전달'].includes(next.contractInfo.balanceStatus) };
    next.notes = form.notes; next.adminMemo = form.memo;
    next.publishStatus = form.publish ? 'published' : 'draft';
    return next;
}

// ─────────────── 입력 도우미 ───────────────
/** 가이드를 등록 정보에서 고르면 칸을 채운다(옛 applyGuide). 없는 이름이면 null */
export function guideFromLibrary(name: string, libs: BookingLibraries): BookingForm['guide'] | null {
    const r = libs.guides[name]; if (!r) return null;
    return { name, nameEn: s(r.nameEn || ''), role: s(r.role || ''), phone: s(r.phone || ''), qr: s(r.qr || ''), img: s(r.img || ''), desc: s(r.desc || '') };
}
/** 차량을 등록 정보에서 고르면 칸을 채운다(옛 applyVehicle) */
export function vehicleFromLibrary(name: string, libs: BookingLibraries): BookingForm['vehicle'] | null {
    const r = libs.vehicles[name]; if (!r) return null;
    return { model: name, seats: s(r.seats || ''), luggage: s(r.luggage || ''), plate: s(r.plate || ''), desc: s(r.desc || '') };
}
/** 숙소를 등록 정보에서 고르면: 이름·등급(있으면), 숙소 설명은 비운다(옛 lodge-pick) */
export function lodgeFromLibrary(row: LodgeRow, name: string, libs: BookingLibraries): LodgeRow {
    const lib = libs.lodges[name] || {};
    return { ...row, name, grade: lib.grade ? pick(lib.grade, LODGE_GRADES) : row.grade, desc: '' };
}
/** 확정 일정표의 숙소를 그대로 배정 목록으로(옛 lodgeFromDays) — 예약의 숙소 목록을 이것으로 바꾸고 입력칸은 lodgeRowOf로 */
export function lodgesFromDays(days: Json[]): Json[] {
    const noBr = (v: unknown) => s(v).replace(/<br\s*\/?>/gi, ' ').trim();
    return days.map((d, i) => ({ day: i + 1, name: noBr((d.stay || {}).name), grade: '' })).filter(l => l.name && l.name !== '숙소미포함');
}
/** 대표 명소 고르기/빼기(옛 renderSpots의 클릭) */
export function toggleHighlight(highlights: Json[], name: string, spots: Record<string, Json>): Json[] {
    const names = highlights.map(h => h && h.name), i = names.indexOf(name);
    if (i >= 0) return highlights.filter((_, j) => j !== i);
    const spot = spots[name] || {};
    return [...highlights, { nameMn: spot.nameMn || '', name, desc: spot.desc || '', img: spot.img || '', subImgs: (spot.subImgs && spot.subImgs.length ? spot.subImgs : ['', '', '', '']) }];
}
/** 고객 화면에 보일 가이드·차량 미리보기 정보(옛 previewHtml): 비어 있는 칸은 등록 정보로 */
export function resourcePreview(type: 'guide' | 'vehicle', rec: Json, libs: BookingLibraries): { title: string; sub: string; img: string } {
    rec = rec || {};
    if (type === 'guide' && rec.name && libs.guides[rec.name]) {
        const lib = libs.guides[rec.name];
        rec = { ...rec, img: rec.img || lib.img || '', desc: rec.desc || lib.desc || '', nameEn: rec.nameEn || lib.nameEn || '', role: rec.role || lib.role || '' };
    }
    if (type === 'vehicle' && rec.model && libs.vehicles[rec.model]) {
        const lib = libs.vehicles[rec.model];
        rec = { ...rec, img: rec.img || lib.img || '', imgs: (Array.isArray(rec.imgs) && rec.imgs.length) ? rec.imgs : (Array.isArray(lib.imgs) ? lib.imgs : []),
            luggage: rec.luggage || lib.luggage || '', desc: rec.desc || lib.desc || '' };
    }
    const name = rec.name || rec.model, img = rec.img || '';
    const imgs = Array.isArray(rec.imgs) ? rec.imgs.length : (img ? 1 : 0);
    const title = name || (type === 'guide' ? '가이드 미선택' : '차량 미선택');
    const sub = type === 'guide' ? [rec.nameEn, rec.role, rec.desc].filter(Boolean).join(' · ')
        : [rec.seats, rec.luggage, rec.desc, imgs ? `이미지 ${imgs}장` : ''].filter(Boolean).join(' · ');
    return { title, sub, img };
}
/** 숙소 미리보기(옛 lodgePreviewHtml) */
export function lodgePreview(row: { name: string; grade?: string }, libs: BookingLibraries): { title: string; sub: string; img: string } {
    const lib = libs.lodges[row.name] || {}, rec: Json = { ...lib, ...row };
    const photos = lodgingPhotos(rec);
    return { title: rec.name || '숙소 미선택', img: photos[0] || '',
        sub: [rec.grade, rec.region, rec.desc || rec.tags, photos.length ? `이미지 ${photos.length}장` : ''].filter(Boolean).join(' · ') };
}

// ─────────────── 진행 상태(옛 assignStats · workflowUi · updateActionBar) ───────────────
export interface AssignStats { guideOk: boolean; vehicleOk: boolean; lodgeCount: number; lodgeNeeded: number; signed: boolean; checklistDone: number; missing: string[] }
const accepted = (pre: BookingRecord) => !!(pre.decision && pre.decision.status === 'accepted') || pre.status === '예약확정';
export function assignStats(pre: BookingRecord, bk: Json): AssignStats {
    const a = bk.assign || {}, days: Json[] = bk.days || [];
    const guideOk = !!(a.guide && a.guide.name), vehicleOk = !!(a.vehicle && a.vehicle.model);
    const lodgeCount = (a.lodges || []).filter((l: Json) => l && l.name).length;
    // 일정 카드를 덜 적었다고 여행 기간이 줄지 않는다 — 올바른 출발·귀국일이 먼저, 없을 때만 카드 수
    const dateStamp = (value: unknown) => {
        const key = String(value || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return NaN;
        const stamp = Date.parse(key + 'T00:00:00Z');
        return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === key ? stamp : NaN;
    };
    const departure = dateStamp(pre?.depart), returning = dateStamp(pre?.return_);
    const lodgeNeeded = Number.isFinite(departure) && Number.isFinite(returning) && returning >= departure ? Math.round((returning - departure) / 86400000) : Math.max(days.length - 1, 0);
    const signed = !!(bk.contract && bk.contract.signedAt);
    const checklistDone = Object.values(bk.checklist || {}).filter(Boolean).length;
    const missing: string[] = [];
    if (!accepted(pre)) missing.push('고객 수락 미확인');
    if (!days.length) missing.push('확정 일정 없음');
    if (!guideOk) missing.push('가이드 미배정');
    if (!vehicleOk) missing.push('차량 미배정');
    if (lodgeNeeded && lodgeCount < lodgeNeeded) missing.push(`숙소 ${lodgeNeeded - lodgeCount}일 미배정`);
    if (!signed) missing.push('계약 미서명');
    if (!bk.contractInfo || bk.contractInfo.depositStatus !== '입금완료') missing.push('예약금 미입금');
    return { guideOk, vehicleOk, lodgeCount, lodgeNeeded, signed, checklistDone, missing };
}
const OPS_ONLY = ['고객 수락 미확인', '계약 미서명', '예약금 미입금'];
/** 일정·배정 누락(공개 전에 채워야 하는 것만) */
export const operationsMissing = (stats: AssignStats) => stats.missing.filter(m => !OPS_ONLY.includes(m));

/** 지금 할 일의 종류(옛 data-action) */
export type BookingTaskAction = 'none' | 'bookingInfo' | 'deposit' | 'confirmDeposit' | 'contract' | 'confirm' | 'assign' | 'publish' | 'openSchedule';
export interface BookingTask { title: string; desc: string; action: BookingTaskAction; button: string; tone: '' | 'waiting' | 'complete' }
export interface BookingWorkflow {
    steps: Array<{ label: string; done: boolean; detail: string }>; active: number; task: BookingTask;
    accepted: boolean; prepared: boolean; depositSent: boolean; paid: boolean; contractSent: boolean; signed: boolean; confirmed: boolean; published: boolean; operationsReady: boolean; assigned: boolean;
}
export function workflowUi(pre: BookingRecord, bk: Json): BookingWorkflow {
    const ci = bk.contractInfo || {}, st = assignStats(pre, bk), isAccepted = accepted(pre);
    const prepared = !!bk.preparedAt;
    const depositSent = !!(bk.depositRequest && bk.depositRequest.status === 'requested');
    const depositReported = !!(bk.depositReport && bk.depositReport.status === 'reported');
    const paid = ci.depositStatus === '입금완료';
    const contractSent = !!(bk.contractRequest && bk.contractRequest.status === 'requested');
    const signed = !!(bk.contract && bk.contract.signedAt);
    const confirmed = pre.status === '예약확정';
    const published = bk.publishStatus === 'published';
    const operationsReady = !!bk.days.length && st.guideOk && st.vehicleOk && (!st.lodgeNeeded || st.lodgeCount >= st.lodgeNeeded);
    const steps = [
        { label: '고객 수락', done: isAccepted, detail: isAccepted ? '완료' : '대기' },
        { label: '예약금', done: paid, detail: paid ? '입금완료' : (depositReported ? '신고됨·확인 필요' : depositSent ? '입금 대기' : '안내 전') },
        { label: '계약서', done: signed, detail: signed ? '서명완료' : (contractSent ? '서명 대기' : '요청 전') },
        { label: '예약 확정', done: confirmed, detail: confirmed ? '완료' : '확정 전' },
        { label: '일정표', done: published, detail: published ? '공개됨' : (operationsReady ? '공개 준비' : '배정 필요') },
    ];
    const active = published ? 5 : !isAccepted ? 1 : !paid ? 2 : !signed ? 3 : !confirmed ? 4 : 5;
    let task: BookingTask;
    if (!isAccepted) task = { title: '고객의 예약 진행 의사를 기다리고 있습니다', desc: '고객이 카톡·전화로 예약 진행 의사를 밝히면 견적 문의 화면에서 ‘예약 진행 기록’을 눌러 주세요.', action: 'none', button: '', tone: 'waiting' };
    else if (!prepared) task = { title: '예약 기본정보를 작성해 주세요', desc: '여행자·항공·금액 정보를 확인하고 먼저 내부 저장해 주세요.', action: 'bookingInfo', button: '예약정보 작성하기', tone: '' };
    else if (!paid && !depositSent) task = { title: '고객에게 예약금 안내를 표시해 주세요', desc: '저장된 예약금과 계좌정보를 확인한 뒤 고객 페이지에 입금 안내를 표시합니다.', action: 'deposit', button: '예약금 안내 표시하기', tone: '' };
    else if (!paid && depositReported) task = { title: `입금 신고를 확인해 주세요 (입금자명 ${(bk.depositReport && bk.depositReport.name) || '-'})`, desc: '고객이 입금 완료를 알렸습니다. 계좌에서 입금을 확인한 뒤 누르면 입금완료로 저장되고 계약서 서명·여행자 정보 요청이 고객 페이지에 표시됩니다.', action: 'confirmDeposit', button: '입금 확인 완료 (자동 진행)', tone: '' };
    else if (!paid) task = { title: '예약금 입금을 확인해 주세요', desc: '고객 화면에 입금 안내가 표시되었습니다. 고객이 카톡으로 입금을 알리면 계좌 확인 후 아래 버튼을 눌러 주세요 — 입금완료 저장과 계약서·여행자 정보 요청이 한 번에 진행됩니다.', action: 'confirmDeposit', button: '입금 확인 완료 (자동 진행)', tone: 'waiting' };
    else if (!signed && !contractSent) task = { title: '고객에게 계약서 서명을 요청해 주세요', desc: '예약금 입금이 확인되어 계약서 요청을 보낼 수 있습니다.', action: 'contract', button: '계약서 요청 보내기', tone: '' };
    else if (!signed) task = { title: '고객의 계약서 서명을 기다리고 있습니다', desc: '서명 요청이 발송되었습니다. 필요하면 계약서 요청을 다시 보낼 수 있습니다.', action: 'contract', button: '계약서 요청 재전송', tone: 'waiting' };
    else if (!confirmed) task = { title: '예약을 최종 확정해 주세요', desc: '예약금 입금과 계약서 서명이 모두 확인되었습니다.', action: 'confirm', button: '예약 확정하기', tone: '' };
    else if (!published && !operationsReady) task = { title: '확정 일정과 배정 정보를 완성해 주세요', desc: `현재 누락: ${operationsMissing(st).join(' · ') || '운영 배정 확인'}. 입력 후 ‘배정정보 저장’을 눌러야 일정표 공개 버튼이 열립니다.`, action: 'assign', button: '누락 배정 입력하기', tone: 'waiting' };
    else if (!published) task = { title: '고객에게 확정 일정표를 공개해 주세요', desc: '운영 배정이 완료되어 최종 일정표를 공개할 수 있습니다.', action: 'publish', button: '일정표 공개하기', tone: '' };
    else task = { title: '예약 절차가 모두 완료되었습니다', desc: '고객이 확정 일정표를 확인할 수 있습니다. 변경 사항은 저장 후 다시 확인해 주세요.', action: 'openSchedule', button: '고객 일정표 보기', tone: 'complete' };
    const assigned = st.guideOk && st.vehicleOk && (!st.lodgeNeeded || st.lodgeCount >= st.lodgeNeeded);
    return { steps, active, task, accepted: isAccepted, prepared, depositSent, paid, contractSent, signed, confirmed, published, operationsReady, assigned };
}

export interface StageButton { label: string; disabled: boolean; shown: boolean }
export interface BookingActionBar {
    deposit: StageButton; contract: StageButton; confirm: StageButton; publish: StageButton;
    travelNotice: { label: string; title: string };
    bottomStep: string; bottomTask: string; saveLabel: string; saveSecondary: boolean;
}
/** 아래 막대(옛 updateActionBar): 지금 할 일에 맞는 단계 버튼 하나만 보이고 저장 버튼 이름이 바뀐다 */
export function actionBar(pre: BookingRecord, bk: Json): BookingActionBar {
    const wf = workflowUi(pre, bk);
    const { paid, signed, confirmed, published, depositSent, contractSent } = wf;
    const shown = (action: BookingTaskAction) => wf.task.action === action;
    const tn = pre.notify || {}, tnSentAt = String(tn.travelNoticeSentAt || ''), tnCount = Number(tn.travelNoticeSentCount) || 0;
    // 아래 단계 표시는 고객 통합 작업의 7단계와 같은 번호·이름(src/utils/quoteCustomerWorkspace.ts의 flowSteps)
    const flow7: Array<[string, boolean]> = [['견적서', true], ['고객 답변', wf.accepted], ['예약금', wf.paid], ['계약서 서명', wf.signed], ['예약 확정', wf.confirmed], ['배정', wf.assigned], ['일정표 공개', wf.published]];
    const flowAt = flow7.findIndex(step => !step[1]);
    const stage = ['deposit', 'contract', 'confirm', 'publish'].includes(wf.task.action);
    return {
        deposit: { label: paid ? '예약금 확인 완료' : (depositSent ? '예약금 안내 재전송' : '예약금 안내 보내기'), disabled: paid, shown: shown('deposit') },
        contract: { label: signed ? '계약 서명완료' : (contractSent ? '계약서 요청 재전송' : '계약서 요청 보내기'), disabled: !paid || signed, shown: shown('contract') },
        confirm: { label: confirmed ? '예약 확정됨' : '예약 확정하기', disabled: confirmed || !paid || !signed, shown: shown('confirm') },
        publish: { label: published ? '일정표 공개됨' : '일정표 공개하기', disabled: published || !confirmed, shown: shown('publish') },
        travelNotice: { label: tnSentAt ? '주의사항 재발송' : '주의사항 발송',
            title: tnSentAt ? `마지막 발송 ${tnSentAt.slice(0, 10)} · 총 ${tnCount}회 — 다시 보낼 수 있습니다` : '여행 주의사항 PDF를 고객에게 지금 보냅니다' },
        bottomStep: flowAt < 0 ? '예약 절차 완료' : `${flowAt + 1}/${flow7.length}단계 · ${flow7[flowAt][0]}`,
        bottomTask: wf.task.title,
        saveLabel: wf.task.action === 'assign' ? '배정정보 저장' : wf.task.action === 'bookingInfo' ? '예약정보 저장' : '임시 저장',
        saveSecondary: stage,
    };
}

/** 바깥 화면(진행 단계 카드·준비 상태)에 알리는 요약(옛 QuoteBookingWorkspace.snapshot) */
export function workspaceSnapshot(pre: BookingRecord, bk: Json, stats: AssignStats) {
    const days: Json[] = Array.isArray(bk?.days) ? bk.days : [], ci = bk?.contractInfo || {};
    const travelers: Json[] = Array.isArray(bk?.travelers) ? bk.travelers : [];
    const expected = (Number(pre?.adult) || 0) + (Number(pre?.child) || 0) + (Number(pre?.infant) || 0);
    return { bookingId: String(pre?.id || ''), cancelled: /취소|cancelled/i.test(pre?.status || ''),
        accepted: pre?.decision?.status === 'accepted' || pre?.status === '예약확정',
        deposit: ci.depositStatus === '입금완료', signed: !!bk?.contract?.signedAt,
        confirmed: pre?.status === '예약확정', schedule: days.length > 0, dayCount: days.length,
        published: bk?.publishStatus === 'published', guideReady: !!stats?.guideOk, vehicleReady: !!stats?.vehicleOk,
        lodgeCount: Number(stats?.lodgeCount) || 0, lodgeNeeded: Number(stats?.lodgeNeeded) || 0,
        travelerCount: travelers.filter(person => person && (person.nameKo || person.passportName)).length, expectedTravelers: expected };
}

// ─────────────── 초안·저장(옛 bookingSnapshot · saveBookingBody · 단계 요청) ───────────────
/** 이 브라우저 초안에 넣는 값: 서명 원본은 빼고 요청의 이름·기간·인원을 함께(quote-editor-state.js의 booking 초안과 같은 모양) */
export function bookingDraftSnapshot(pre: BookingRecord, bk: Json): Json {
    const { contract: _contract, ...editable } = bk;
    return { ...editable, _requestFields: { name: pre.name || '', depart: pre.depart || '', return_: pre.return_ || '', adult: pre.adult || 0, child: pre.child || 0, infant: pre.infant || 0 } };
}
/** 초안 복원: 서명 원본은 지금 것을 두고, 요청 칸(이름·기간·인원)은 요청에 되돌린다 */
export function restoreBookingDraft(pre: BookingRecord, bk: Json, value: Json): { pre: BookingRecord; bk: Json } {
    const { _requestFields: requestFields, ...rest } = value;
    const next = normBooking({ ...rest, contract: bk.contract });
    return { pre: requestFields && typeof requestFields === 'object' ? { ...pre, ...requestFields } : pre, bk: next };
}

export type SaveCheck = { ok: false; error: string } | { ok: true; patch: Json; booking: Json };
/**
 * 저장 내용(옛 saveBookingBody의 확인과 PATCH 본문). booking은 이미 pullBooking을 거친 예약.
 * - setStatus(예약 확정): 고객 수락·계약 서명·예약금 입금이 모두 있어야 하고 확정일을 처음이면 오늘로
 * - 공개로 바꿀 때: 예약확정(또는 지금 확정) + 일정·배정 누락 없음
 */
export function saveRequest(pre: BookingRecord, booking: Json, saved: Json | null, opts: { setStatus?: boolean; resetContract?: boolean; today?: string } = {}): SaveCheck {
    const bk: Json = { ...booking };
    if (opts.setStatus) {
        const missing: string[] = [];
        if (!accepted(pre)) missing.push('고객 수락');
        if (!(bk.contract && bk.contract.signedAt)) missing.push('계약 서명');
        if (bk.contractInfo.depositStatus !== '입금완료') missing.push('예약금 입금');
        if (missing.length) return { ok: false, error: '예약확정 전 확인: ' + missing.join(', ') };
        if (!bk.confirmedAt) bk.confirmedAt = opts.today || new Date().toISOString().slice(0, 10);
    }
    if (bk.publishStatus === 'published' && (saved || {}).publishStatus !== 'published') {
        const effectiveConfirmed = pre.status === '예약확정' || !!opts.setStatus;
        const opsMissing = operationsMissing(assignStats(pre, bk));
        if (!effectiveConfirmed) return { ok: false, error: '예약확정 후 고객 일정표를 공개할 수 있어요' };
        if (opsMissing.length) return { ok: false, error: '일정표 공개 전 확인: ' + opsMissing.join(', ') };
    }
    bk.autoSeeded = false;
    const patch: Json = { booking: bk };
    if (pre.name) patch.name = pre.name;
    if (pre.depart) patch.depart = pre.depart;
    if (pre.return_) patch.return_ = pre.return_;
    patch.adult = pre.adult || 0; patch.child = pre.child || 0; patch.infant = pre.infant || 0;
    if (opts.resetContract) patch.resetContract = true;
    if (opts.setStatus) patch.status = '예약확정';
    return { ok: true, patch, booking: bk };
}
/** 저장 성공 뒤: 요청 상태와 준비 시각(옛 saveBookingBody의 성공 처리) */
export function afterSave(pre: BookingRecord, booking: Json, response: Json, patch: Json, now: string = new Date().toISOString()): { pre: BookingRecord; booking: Json } {
    const status = response.status || patch.status || pre.status;
    const bk = { ...booking, preparedAt: booking.preparedAt || response.preparedAt || now };
    return { pre: { ...pre, status, booking: bk }, booking: bk };
}
/** 고객 단계 요청 전 확인(옛 sendStageRequestBody): 예약금 안내는 금액·계좌, 계약서 요청은 입금완료가 있어야 한다 */
export function stageRequestError(kind: 'deposit' | 'contract', bk: Json): string {
    const ci = bk.contractInfo || {};
    if (kind === 'deposit' && (!(Number(ci.depositAmount) > 0) || !ci.bankName || !ci.accountNumber || !ci.accountHolder)) return '예약금·은행·계좌번호·예금주를 모두 입력해 주세요';
    if (kind === 'contract' && ci.depositStatus !== '입금완료') return '예약금 입금 확인 후 계약서 요청이 가능합니다';
    return '';
}
/** 여행 주의사항 발송 실패 사유를 관리자가 할 일로 바꾼다(옛 sendTravelNoticeBody) */
export function travelNoticeError(reason: string): string {
    if (/template not set/i.test(reason)) return '알림톡 템플릿이 설정되지 않았어요 — 승인된 템플릿 ID를 SOLAPI_TEMPLATE_TRAVEL_NOTICE_ID에 등록해 주세요';
    if (/유효한 템플릿|template.*(not found|invalid)|invalid.*template/i.test(reason)) return '템플릿 ID가 올바르지 않아요 — Solapi에 등록된 템플릿 ID(KA01TP…)인지 확인해 주세요';
    if (/pf_id/i.test(reason)) return '카카오 채널(SOLAPI_PF_ID) 설정이 필요해요';
    return /invalid phone/i.test(reason) ? '고객 연락처가 등록되어 있지 않아요 — 예약 정보에서 연락처를 먼저 채워주세요' : reason;
}
/** 고객 문서 주소(주소 고정 — CLAUDE.md 3.1) */
export const bookingLinks = (pre: BookingRecord) => ({
    customer: pre.token ? `/${encodeURI('내견적.html')}?t=${pre.token}` : '',
    confirm: pre.token ? `/확정일정표.html?t=${encodeURIComponent(pre.token)}` : '',
    contract: pre.token ? `/계약서.html?t=${encodeURIComponent(pre.token)}&adminId=${encodeURIComponent(String(pre.id))}&return=manage` : '',
});
