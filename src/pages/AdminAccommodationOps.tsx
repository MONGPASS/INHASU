import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { productCustomerHref, quoteCustomerHref } from '../utils/customerWorkspaceRoutes';
import type { AssignmentAccommodation, AssignmentGuide, AssignmentSource, AssignmentVehicle } from '../utils/reservationAssignment';
import { loadRegisteredAssignmentResources, type RegisteredAssignmentResources } from '../utils/registeredAssignmentResources';
import { selectResourceGuide, selectResourceLodge, selectResourceVehicle } from '../utils/accommodationResourceSelection';
import { addMissingAccommodationNights, alignAccommodationDates, getAccommodationPlan, initialAccommodationRows, scheduleStayRegion, scheduleTimeline, type AccommodationSchedule } from '../utils/accommodationSchedule';
import { assignmentFingerprint, editorAssignment, writeAssignmentDraft, readAssignmentDraft, discardAssignmentDraft, type AssignmentDraft, type AssignmentDraftResult } from '../utils/adminAssignmentDraft';
import { toTourDateKey } from '../utils/formatDate';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { DashboardIcon } from '../components/admin/dashboard/DashboardIcon';
import './AdminAccommodationOps.css';
import { LODGE_BOOKING_STATUSES, isLodgeBookingConfirmed, lodgeBookingLabel } from '../utils/lodgeBookingStatus';

/**
 * 숙소 배정 · 현지 운영 — Admin Dashboard v3 "05-1" 디자인(한국어).
 * 예약별 숙박일의 숙소·객실·인원·수배 상태와 담당 가이드·차량을 한 화면에서 관리합니다.
 * 저장 값(수배 상태·객실당 인원)은 기존 데이터와 다른 화면이 읽는 원래 표기(몽골어)를 그대로 쓰고, 화면 표시만 한국어로 바꿉니다.
 */

// 숙소 예약 상태 정본은 utils/lodgeBookingStatus.ts (보드·고객 상세·예약 상세 공용)
type BookingStatus = string;
const OCCUPANCY_OPTIONS = ['', '1 хүн/өрөө', '2 хүн/өрөө', '3 хүн/өрөө', '4 хүн/өрөө', '5 хүн/өрөө', '6 хүн/өрөө'];
// 숙소 등급 — 선택명은 한국어로 유지(요청)
// 저장 값은 그대로 쓴다(기존 '4성급호텔' 표기 유지). 목록에 없는 기존 값은 선택창이 따로 보여 준다.
const GRADE_OPTIONS = ['', '고급 게르', '디럭스 게르', '일반 게르', '5성급 호텔', '4성급호텔', '3성급 호텔', '목조하우스', '게스트하우스'];
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const occupancyLabel = (value: string) => value ? value.replace(/^(\d+) хүн\/өрөө$/, '$1인 / 객실') : '미정';
type BoardStatus = '미배정' | '진행 중' | '배정 완료';
const KPI_CARDS = [
    { key: 'all', label: '전체 예약', tone: 'all', icon: 'lc-layers', hint: '전체' },
    { key: '미배정', label: '미배정', tone: 'warn', icon: 'lc-circle-alert', hint: '바로 배정' },
    { key: '진행 중', label: '진행 중', tone: 'info', icon: 'lc-loader', hint: '수배 중' },
    { key: '배정 완료', label: '배정 완료', tone: 'ok', icon: 'lc-circle-check', hint: '' },
] as const;

type DailyAcc = AssignmentAccommodation;
interface Traveler { name?: string; passportName?: string; birthdate?: string; gender?: string; phone?: string }
interface Flight { date?: string; time?: string; flight?: string }
const scheduleSourceLabel: Record<string, string> = {
    customer: '고객별 저장 일정', template: '선택한 일정 템플릿', product: '예약 상품 일정',
    booking: '예약 확정 일정', quote: '견적 일정', none: '등록 일정 없음', unavailable: '일정 조회 필요',
};
interface Reservation {
    id: string;
    bookingId: string;
    source: AssignmentSource;
    version: string;
    type?: string;
    productName?: string;
    customerName?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    depositStatus?: string;
    travelers?: number;
    reservationNumber?: string | null;
    createdAt?: string;
    dailyAccommodations?: DailyAcc[];
    schedule?: AccommodationSchedule;
    assignedGuide?: AssignmentGuide;
    contractData?: {
        region?: string; category?: string;
        travelers?: Traveler[];
        arrival?: Flight; departure?: Flight;
        agreement?: { agreed?: boolean; name?: string; agreedAt?: string };
        vehicle?: AssignmentVehicle;
    };
}

const fmtDate = (iso?: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};
const monthKey = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
// 오늘 (yyyy-mm-dd, 로컬 기준)
const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// 투어가 이미 끝났는가 — 종료일(없으면 출발일)이 오늘보다 앞이면 지난 투어
const isPastTour = (r: { startDate?: string; endDate?: string }, today: string) => {
    const last = r.endDate || r.startDate;
    if (!last) return false;
    const d = new Date(last);
    if (Number.isNaN(d.getTime())) return false;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return key < today;
};
const savedStamp = () => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
// 출발일까지 남은 일수. 60일 안쪽으로 다가온 출발은 강조한다.
const departureBadge = (iso?: string) => {
    const key = iso ? toTourDateKey(iso) : '';
    const start = /^\d{4}-\d{2}-\d{2}$/.test(key) ? Date.parse(`${key}T00:00:00Z`) : NaN;
    if (Number.isNaN(start)) return null;
    const days = Math.round((start - Date.parse(`${todayKey()}T00:00:00Z`)) / 86400000);
    return { label: days > 0 ? `D-${days}` : days === 0 ? 'D-DAY' : '출발 완료', soon: days >= 0 && days <= 60 };
};
const weekdayKo = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : WD[d.getDay()];
};
const regionOf = (r: Reservation) => (r.contractData?.region || r.contractData?.category || r.productName || '-');
const genderLabel = (g?: string) => g === '男性' || g === '남성' || g === 'male' ? '남' : g === '女性' || g === '여성' || g === 'female' ? '여' : (g || '-');
const flightLine = (f?: Flight) => [f?.date, f?.time, f?.flight].filter(Boolean).join(' · ') || '-';

const summaryOf = (r: Reservation) => {
    const plan = getAccommodationPlan(r);
    const total = plan.needed;
    const { assigned, confirmed, complete: allConfirmed } = plan;
    return { total, assigned, confirmed, allConfirmed, plan };
};
/** 디자인의 예약 상태: 필요한 숙박일이 모두 확정되고 가이드·차량이 있으면 배정 완료. */
const boardStatusOf = (r: Reservation): BoardStatus => {
    const sum = summaryOf(r), guide = !!r.assignedGuide?.name?.trim(), vehicle = !!r.contractData?.vehicle?.type?.trim();
    if (sum.total !== null && sum.allConfirmed && sum.plan.warnings.length === 0 && guide && vehicle) return '배정 완료';
    return sum.assigned > 0 || sum.confirmed > 0 || guide || vehicle ? '진행 중' : '미배정';
};

const CONFIRMED_STATUSES = ['confirmed', 'paid', 'completed'];

export const AdminAccommodationOps: React.FC = () => {
    const { user, loading } = useUser();
    if (loading || !user || user.role !== 'admin') return <AdminLayout activePage="accommodation-ops" title="숙소 배정 · 현지 운영"><div className="empty">관리자 계정을 확인하고 있습니다.</div></AdminLayout>;
    return <AccommodationBoard key={user.id} userId={user.id} />;
};

function fromApi(item: any): Reservation {
    // 견적 예약은 저장만 해도 빈 배열이 들어가므로, 고객 일정이 있으면 빈 배열도 '아직 배정 전'으로 보고 일차별 행을 펼친다(수정·저장 전에는 서버를 바꾸지 않음).
    const unassigned = item.accommodationsInitialized === false || (!item.assignment.accommodations.length && !!item.schedule?.days?.length);
    return { ...item, bookingId: item.id, id: item.key, assignedGuide: item.assignment.guide,
        dailyAccommodations: unassigned ? undefined : item.assignment.accommodations, contractData: { ...item.contractData, vehicle: item.assignment.vehicle } };
}
async function assignmentRequest(path = '', options: RequestInit = {}) {
    const response = await fetch(`/api/admin/assignments${path}`, { credentials: 'same-origin', cache: 'no-store', ...options });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || '배정 정보를 불러오지 못했습니다.');
    return body;
}

const AccommodationBoard: React.FC<{ userId: string }> = ({ userId }) => {
    const [reservations, setReservationsState] = useState<Reservation[]>([]);
    const rowsRef = useRef<Reservation[]>([]), dirtyRef = useRef(new Set<string>());
    // 서버에서 받은 행 그대로. '변경 취소'는 이 값으로 되돌린다.
    const savedRows = useRef(new Map<string, Reservation>());
    const mounted = useRef(true), savingRef = useRef<string | null>(null), generation = useRef(0);
    const storedSnapshots = useRef(new Map<string, string>());
    const pendingRef = useRef<Record<string, { draft: AssignmentDraft; conflict: boolean }>>({});
    const [pendingDrafts, setPendingDrafts] = useState<Record<string, { draft: AssignmentDraft; conflict: boolean }>>({});
    const [notice, setNotice] = useState('');
    const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
    const setReservations = useCallback<React.Dispatch<React.SetStateAction<Reservation[]>>>((update) => {
        if (!mounted.current) return;
        const next = typeof update === 'function' ? update(rowsRef.current) : update;
        rowsRef.current = next; setReservationsState(next);
    }, []);
    const [loading, setLoading] = useState(true);
    const [dirty, setDirty] = useState<Set<string>>(new Set());
    const [savingId, setSavingId] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [materialized, setMaterialized] = useState<Set<string>>(new Set());
    const [travelersClosed, setTravelersClosed] = useState<Set<string>>(new Set());
    const [savedAt, setSavedAt] = useState<Record<string, string>>({});

    const [q, setQ] = useState('');
    const [month, setMonth] = useState('all');
    const [year, setYear] = useState(() => new Date().getFullYear());
    const [region, setRegion] = useState('all');
    const [statusFilter, setStatusFilter] = useState<'all' | BoardStatus>('all');
    const [scope, setScope] = useState<'confirmed' | 'all'>('confirmed');
    const [resources, setResources] = useState<RegisteredAssignmentResources>({ guides: [], lodges: [], vehicles: [], warnings: [] });
    const [resourcesLoading, setResourcesLoading] = useState(false);
    const resourceGeneration = useRef(0), resourceController = useRef<AbortController | null>(null);
    // 공통 목록에 없는 숙소를 직접 입력 중인 칸 (key = `${reservationId}:${dayIndex}`)
    const [manualHotels, setManualHotels] = useState<Set<string>>(new Set());
    const [listHotels, setListHotels] = useState<Set<string>>(new Set());
    // 등록 숙소의 지역에 없는 지역을 직접 입력 중인 칸 (key는 숙소와 동일)
    const [manualRegions, setManualRegions] = useState<Set<string>>(new Set());
    const [listRegions, setListRegions] = useState<Set<string>>(new Set());
    const [clearedRegions, setClearedRegions] = useState<Set<string>>(new Set());

    const draftScope = useCallback((r: Reservation) => ({ userId, source: r.source, id: r.bookingId }), [userId]);
    const loadResources = useCallback(async () => {
        resourceController.current?.abort();
        const controller = new AbortController(), requestGeneration = ++resourceGeneration.current;
        resourceController.current = controller;
        const isCurrent = () => mounted.current && !controller.signal.aborted && requestGeneration === resourceGeneration.current;
        setResourcesLoading(true);
        try {
            const saved = await loadRegisteredAssignmentResources({ accountId: userId, signal: controller.signal, isCurrent });
            if (isCurrent()) setResources(saved);
        } catch {
            if (isCurrent()) setResources(prev => ({ ...prev, warnings: ['공통 가이드·숙소·차량 자료를 불러오지 못했습니다. 기존 배정과 직접 입력은 유지됩니다.'] }));
        } finally {
            if (isCurrent()) setResourcesLoading(false);
        }
    }, [userId]);
    const flushDrafts = useCallback((notify = true): AssignmentDraftResult => {
        for (const row of rowsRef.current) {
            if (!dirtyRef.current.has(row.id) || pendingRef.current[row.id]) continue;
            const assignment = editorAssignment(row), fingerprint = row.version + assignmentFingerprint(assignment);
            if (storedSnapshots.current.get(row.id) === fingerprint) continue;
            const result = writeAssignmentDraft(window.localStorage, draftScope(row), row.version, assignment);
            if (!result.ok) { if (notify && mounted.current) setNotice(result.error); return result; }
            storedSnapshots.current.set(row.id, fingerprint);
        }
        return { ok: true };
    }, [draftScope]);
    const load = async () => {
        if (savingRef.current) { setNotice('저장이 끝난 뒤 새로고침해 주세요.'); return; }
        const stored = flushDrafts(); if (!stored.ok) return;
        if (dirtyRef.current.size && !window.confirm('변경 내용을 브라우저 초안으로 보관했습니다. 최신 예약을 다시 불러올까요?')) return;
        void loadResources();
        const requestGeneration = ++generation.current;
        setLoading(true);
        try {
            const data = await assignmentRequest();
            if (!mounted.current || requestGeneration !== generation.current) return;
            const failedSource = (source: AssignmentSource) => data.availability?.[source] === false;
            const arr: Reservation[] = [...(Array.isArray(data.items) ? data.items : []).map(fromApi), ...rowsRef.current.filter(r => failedSource(r.source))];
            const nextPending: typeof pendingDrafts = Object.fromEntries(Object.entries(pendingRef.current).filter(([key]) => rowsRef.current.some(r => r.id === key && failedSource(r.source))));
            for (const row of arr) {
                if (failedSource(row.source)) continue;
                const saved = readAssignmentDraft(window.localStorage, draftScope(row), row.version);
                if (saved.draft) nextPending[row.id] = { draft: saved.draft, conflict: !!saved.conflict };
                else if (saved.error) setNotice(saved.error);
            }
            pendingRef.current = nextPending; setPendingDrafts(nextPending);
            storedSnapshots.current.clear();
            dirtyRef.current = new Set([...dirtyRef.current].filter(id => arr.some(r => r.id === id && failedSource(r.source)))); setDirty(new Set(dirtyRef.current));
            savedRows.current = new Map(arr.map(row => [row.id, failedSource(row.source) ? savedRows.current.get(row.id) || row : row]));
            setReservations(arr);
            setMaterialized(new Set());
            setExpanded(prev => new Set([...Object.keys(nextPending), ...[...prev].filter(id => arr.some(r => r.id === id && failedSource(r.source)))]));
            if (Object.keys(nextPending).length) { setQ(''); setScope('all'); setMonth('all'); setRegion('all'); setStatusFilter('all'); }
            setLoadWarnings(data.warnings || []);
        } catch (e) {
            if (mounted.current && requestGeneration === generation.current) setLoadWarnings([e instanceof Error ? e.message : '예약을 불러오지 못했습니다. 이전 자료를 유지합니다.']);
        } finally {
            if (mounted.current && requestGeneration === generation.current) setLoading(false);
        }
    };
    useEffect(() => { load(); }, []);
    const lodgeById = useMemo(() => new Map(resources.lodges.map(lodge => [lodge.id, lodge])), [resources.lodges]);
    const lodgeRegions = useMemo(() => [...new Set(resources.lodges.map(lodge => (lodge.region || lodge.location).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko-KR')), [resources.lodges]);

    const base = useMemo(() => reservations.filter(r => scope === 'all' ? true
        : (CONFIRMED_STATUSES.includes(r.status || '') || r.depositStatus === 'paid' || r.type === 'quote')), [reservations, scope]);
    /** 연도 막대에 표시할 월별 건수 + 이동 가능한 연도 범위 */
    const monthStats = useMemo(() => {
        const perMonth = new Map<string, number>();
        const years = new Set<number>();
        base.forEach(r => {
            const k = monthKey(r.startDate);
            if (!k) return;
            perMonth.set(k, (perMonth.get(k) || 0) + 1);
            years.add(Number(k.slice(0, 4)));
        });
        years.add(new Date().getFullYear());
        const list = Array.from(years).sort();
        return { perMonth, minYear: list[0], maxYear: list[list.length - 1], total: base.length };
    }, [base]);
    const regionOptions = useMemo(() => {
        const set = new Set<string>();
        base.forEach(r => { const k = regionOf(r); if (k && k !== '-') set.add(k); });
        return Array.from(set).sort();
    }, [base]);
    const filtered = useMemo(() => {
        const today = todayKey();
        const needle = q.trim().toLowerCase();
        return base.filter(r => {
            if (month !== 'all' && monthKey(r.startDate) !== month) return false;
            if (region !== 'all' && regionOf(r) !== region) return false;
            if (statusFilter !== 'all' && boardStatusOf(r) !== statusFilter) return false;
            if (needle) {
                const hay = `${r.customerName || ''} ${r.productName || ''} ${r.reservationNumber || ''} ${regionOf(r)}`.toLowerCase();
                if (!hay.includes(needle)) return false;
            }
            return true;
        }).sort((a, b) => {
            // 끝난 투어는 항상 아래로, 그 안에서는 최근에 끝난 것부터
            const pa = isPastTour(a, today) ? 1 : 0;
            const pb = isPastTour(b, today) ? 1 : 0;
            if (pa !== pb) return pa - pb;
            if (pa === 1) return (b.startDate || '').localeCompare(a.startDate || '');
            // 다가오는 투어는 미확정 먼저 → 출발일 가까운 순
            const da = summaryOf(a).allConfirmed ? 1 : 0;
            const db = summaryOf(b).allConfirmed ? 1 : 0;
            if (da !== db) return da - db;
            return (a.startDate || '').localeCompare(b.startDate || '');
        });
    }, [base, q, month, region, statusFilter]);
    const counts = useMemo(() => {
        let done = 0, pending = 0;
        filtered.forEach(r => { summaryOf(r).allConfirmed ? done++ : pending++; });
        return { total: filtered.length, done, pending };
    }, [filtered]);

    // ── 펼침/구체화 ──
    const openRow = (r: Reservation) => {
        if (!materialized.has(r.id)) {
            setReservations(prev => prev.map(x => x.id === r.id ? { ...x, dailyAccommodations: initialAccommodationRows(x) } : x));
            setMaterialized(prev => new Set(prev).add(r.id));
        }
        setExpanded(prev => new Set(prev).add(r.id));
    };
    const toggleExpand = (r: Reservation) => expanded.has(r.id) ? setExpanded(prev => { const n = new Set(prev); n.delete(r.id); return n; }) : openRow(r);

    // ?open=<reservationId> — 예약 상세의 「숙소 보드에서 수배 관리」 링크로 진입 시 해당 예약을 자동 펼침
    const openedFromUrl = useRef(false);
    useEffect(() => {
        if (openedFromUrl.current || reservations.length === 0) return;
        const id = new URLSearchParams(window.location.search).get('open');
        if (!id) return;
        const source = new URLSearchParams(window.location.search).get('source') || 'product';
        const target = reservations.find(x => x.bookingId === id && x.source === source);
        if (!target) return;
        openedFromUrl.current = true;
        // 확정 전 예약이면 기본 필터(확정 예약만)에 걸려 안 보이므로 전체 보기로 전환
        if (!(CONFIRMED_STATUSES.includes(target.status || '') || target.depositStatus === 'paid' || target.type === 'quote')) setScope('all');
        openRow(target);
        setTimeout(() => { if (mounted.current) document.getElementById(`acc-row-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 200);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reservations]);

    // ── 편집 ──
    const markDirty = (rId: string) => { dirtyRef.current = new Set(dirtyRef.current).add(rId); setDirty(new Set(dirtyRef.current)); };
    useEffect(() => {
        if (!dirty.size || savingId) return;
        const timer = window.setTimeout(() => flushDrafts(), 650);
        return () => window.clearTimeout(timer);
    }, [reservations, dirty, savingId, flushDrafts]);
    const blocker = useBlocker(useCallback(({ currentLocation, nextLocation }) => {
        if (currentLocation.pathname === nextLocation.pathname && currentLocation.search === nextLocation.search) return false;
        const result = flushDrafts();
        return !!savingRef.current || !result.ok;
    }, [flushDrafts]));
    useEffect(() => {
        if (blocker.state !== 'blocked') return;
        if (savingRef.current) { setNotice('저장 중에는 다른 메뉴로 이동할 수 없습니다.'); blocker.reset(); }
        else if (window.confirm('초안을 보관하지 못했습니다. 변경 내용이 사라질 수 있습니다. 이동할까요?')) blocker.proceed();
        else blocker.reset();
    }, [blocker]);
    useEffect(() => {
        mounted.current = true;
        const h = (e: BeforeUnloadEvent) => { const result = flushDrafts(false); if (savingRef.current || !result.ok) { e.preventDefault(); e.returnValue = ''; } };
        const hide = () => { flushDrafts(false); };
        const navigating = (event: MouseEvent) => {
            if (!savingRef.current || !(event.target instanceof Element)) return;
            const anchor = event.target.closest('a[href]');
            if (anchor && anchor.getAttribute('target') !== '_blank') { event.preventDefault(); event.stopPropagation(); setNotice('저장이 끝난 뒤 다른 화면으로 이동해 주세요.'); }
        };
        window.addEventListener('beforeunload', h);
        window.addEventListener('pagehide', hide);
        document.addEventListener('click', navigating, true);
        return () => { flushDrafts(false); mounted.current = false; generation.current++; resourceGeneration.current++; resourceController.current?.abort(); window.removeEventListener('beforeunload', h); window.removeEventListener('pagehide', hide); document.removeEventListener('click', navigating, true); };
    }, [flushDrafts]);
    const resolveDraft = (row: Reservation, restore: boolean) => {
        const pending = pendingRef.current[row.id]; if (!pending || savingRef.current) return;
        if (restore) {
            const a = pending.draft.assignment;
            setReservations(prev => prev.map(r => r.id === row.id ? { ...r, assignedGuide: a.guide,
                dailyAccommodations: a.accommodations, contractData: { ...r.contractData, vehicle: a.vehicle } } : r));
            markDirty(row.id);
        } else {
            const result = discardAssignmentDraft(window.localStorage, draftScope(row), pending.draft.revision);
            if (!result.ok) { setNotice(result.error); return; }
            setReservations(prev => prev.map(r => r.id === row.id && !r.dailyAccommodations ? { ...r, dailyAccommodations: initialAccommodationRows(r) } : r));
        }
        const next = { ...pendingRef.current }; delete next[row.id]; pendingRef.current = next; setPendingDrafts(next);
        setMaterialized(prev => new Set(prev).add(row.id));
        setNotice(restore ? '초안을 복원했습니다. 확인 후 저장해야 서버에 반영됩니다.' : '초안을 버리고 현재 서버 정보를 유지합니다.');
    };
    // 저장된 숙소·객실을 유지하면서 관리자가 명시한 경우에만 고객 일정의 날짜에 맞춘다.
    const alignDates = (rId: string) => {
        if (savingRef.current || pendingRef.current[rId]) return;
        setReservations(prev => prev.map(r => {
            if (r.id !== rId) return r;
            return { ...r, dailyAccommodations: alignAccommodationDates(r) };
        }));
        markDirty(rId);
    };
    // 인덱스 기준 편집(일차 번호·날짜를 직접 수정해도 안전)
    const patchDay = (rId: string, idx: number, patch: Partial<DailyAcc['accommodation']>) => {
        if (savingRef.current || pendingRef.current[rId]) return;
        setReservations(prev => prev.map(r => {
            if (r.id !== rId) return r;
            const rows = (r.dailyAccommodations || []).map((d, i) => i === idx ? { ...d, accommodation: { ...d.accommodation, ...patch } } : d);
            return { ...r, dailyAccommodations: rows };
        }));
        markDirty(rId);
    };
    // 일차(번호)·날짜 직접 편집
    const patchDayMeta = (rId: string, idx: number, patch: { day?: number; date?: string }) => {
        if (savingRef.current || pendingRef.current[rId]) return;
        setReservations(prev => prev.map(r => {
            if (r.id !== rId) return r;
            const rows = (r.dailyAccommodations || []).map((d, i) => i === idx ? { ...d, ...patch,
                ...(patch.date !== undefined && d.date && patch.date !== d.date ? { accommodation: { ...d.accommodation, bookingStatus: 'Илгээгээгүй' as BookingStatus } } : {}),
            } : d);
            return { ...r, dailyAccommodations: rows };
        }));
        markDirty(rId);
    };
    const addDay = (rId: string) => {
        if (savingRef.current || pendingRef.current[rId]) return;
        setReservations(prev => prev.map(r => {
            if (r.id !== rId) return r;
            const rows = [...(r.dailyAccommodations || [])];
            const maxDay = rows.reduce((m, d) => Math.max(m, d.day || 0), 0);
            const night = getAccommodationPlan(r).nights.find(item => item.day === maxDay + 1);
            rows.push({ day: maxDay + 1, date: night?.usable ? night.date : '', accommodation: {} });
            return { ...r, dailyAccommodations: rows };
        }));
        markDirty(rId);
    };
    const removeDay = (rId: string, idx: number) => {
        if (savingRef.current || pendingRef.current[rId]) return;
        setReservations(prev => prev.map(r => {
            if (r.id !== rId) return r;
            const rows = (r.dailyAccommodations || []).filter((_, i) => i !== idx);
            return { ...r, dailyAccommodations: rows };
        }));
        markDirty(rId);
    };
    // 며칠 연속 같은 숙소를 쓰는 일정이 많아 앞 일차 내용을 그대로 가져온다. 일차·날짜는 유지하고 수배는 새로 시작한다.
    const copyPreviousDay = (rId: string, idx: number) => {
        if (savingRef.current || pendingRef.current[rId]) return;
        const target = rowsRef.current.find(r => r.id === rId)?.dailyAccommodations?.[idx];
        if (target?.accommodation?.name?.trim() && !window.confirm(`${target.day}일차에 입력한 숙소를 앞 일차 내용으로 바꿀까요?`)) return;
        setReservations(prev => prev.map(r => {
            if (r.id !== rId) return r;
            const rows = (r.dailyAccommodations || []).map((d, i, all) => i === idx ? { ...d, accommodation: { ...all[i - 1].accommodation, bookingStatus: 'Илгээгээгүй' as BookingStatus } } : d);
            return { ...r, dailyAccommodations: rows };
        }));
        const mKey = `${rId}:${idx}`;
        for (const setKeys of [setManualHotels, setListHotels, setManualRegions, setListRegions, setClearedRegions]) setKeys(prev => { const next = new Set(prev); next.delete(mKey); return next; });
        markDirty(rId);
    };
    const addMissingNights = (row: Reservation) => {
        if (savingRef.current || pendingRef.current[row.id]) return;
        setReservations(prev => prev.map(r => r.id === row.id ? { ...r, dailyAccommodations: addMissingAccommodationNights(r) } : r));
        markDirty(row.id);
    };
    // 담당 가이드(assignedGuide)·차량(contractData.vehicle) 편집 — 기존 컬럼에 저장(마이그레이션 불필요)
    const patchGuide = (rId: string, patch: { name?: string; phone?: string }) => {
        if (savingRef.current || pendingRef.current[rId]) return;
        setReservations(prev => prev.map(r => r.id === rId ? { ...r, assignedGuide: patch.name !== undefined && patch.name !== r.assignedGuide?.name
            ? { id: '', name: patch.name, phone: r.assignedGuide?.phone || '', ...patch }
            : { ...(r.assignedGuide || {}), ...patch } } : r));
        markDirty(rId);
    };
    const patchVehicle = (rId: string, patch: Partial<AssignmentVehicle>) => {
        if (savingRef.current || pendingRef.current[rId]) return;
        setReservations(prev => prev.map(r => r.id === rId
            ? { ...r, contractData: { ...(r.contractData || {}), vehicle: { type: '', phone: '', ...(r.contractData?.vehicle || {}), ...(patch.type !== undefined && patch.type !== r.contractData?.vehicle?.type ? { resource: undefined } : {}), ...patch } } }
            : r));
        markDirty(rId);
    };
    const chooseGuide = (rId: string, resourceId: string) => {
        if (resourcesLoading || savingRef.current || pendingRef.current[rId]) return;
        const resource = resources.guides.find(guide => guide.id === resourceId);
        if (!resource) return;
        setReservations(prev => prev.map(r => r.id === rId ? { ...r, assignedGuide: selectResourceGuide(r.assignedGuide, resource) } : r));
        markDirty(rId);
    };
    const chooseVehicle = (rId: string, resourceName: string) => {
        if (resourcesLoading || savingRef.current || pendingRef.current[rId]) return;
        const resource = resources.vehicles.find(vehicle => vehicle.type === resourceName);
        if (!resource) return;
        setReservations(prev => prev.map(r => r.id === rId ? { ...r, contractData: { ...(r.contractData || {}), vehicle: selectResourceVehicle(r.contractData?.vehicle, resource) } } : r));
        markDirty(rId);
    };
    const save = async (r: Reservation) => {
        if (savingRef.current || pendingRef.current[r.id]) return;
        savingRef.current = r.id;
        setSavingId(r.id);
        const requestGeneration = generation.current;
        const local = writeAssignmentDraft(window.localStorage, draftScope(r), r.version, editorAssignment(r));
        if (local.ok && local.revision) storedSnapshots.current.set(r.id, r.version + assignmentFingerprint(editorAssignment(r)));
        try {
            const data = await assignmentRequest(`/${r.source}/${encodeURIComponent(r.bookingId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expectedVersion: r.version, assignment: editorAssignment(r) }) });
            if (!mounted.current || requestGeneration !== generation.current) return;
            // 방금 저장한 행(모두 지운 경우 포함)을 이 화면에서 그대로 보여 준다.
            const savedRow: Reservation = { ...fromApi(data.item), dailyAccommodations: data.item.assignment.accommodations };
            savedRows.current.set(r.id, savedRow);
            setReservations(prev => prev.map(x => x.id === r.id ? savedRow : x));
            dirtyRef.current.delete(r.id); setDirty(new Set(dirtyRef.current));
            storedSnapshots.current.delete(r.id);
            setSavedAt(prev => ({ ...prev, [r.id]: savedStamp() }));
            const result = local.ok && local.revision ? discardAssignmentDraft(window.localStorage, draftScope(r), local.revision) : { ok: true } as const;
            setNotice(!local.ok ? '서버 저장은 완료했습니다. 다만 브라우저 초안 저장소를 확인해 주세요. ' + local.error : result.ok ? '배정 정보를 저장했습니다.' : result.error);
        } catch (e: any) {
            if (mounted.current && requestGeneration === generation.current) setNotice((e?.message || '저장하지 못했습니다.') + (local.ok ? ' 변경 내용과 브라우저 초안을 유지합니다.' : ' 화면의 변경 내용은 유지합니다. ' + local.error));
        } finally {
            if (mounted.current && requestGeneration === generation.current) { savingRef.current = null; setSavingId(null); }
        }
    };

    // 저장 전 편집과 브라우저 초안을 버리고 마지막으로 받은 서버 배정으로 되돌린다. 서버는 바꾸지 않는다.
    const resetRow = (r: Reservation) => {
        const saved = savedRows.current.get(r.id);
        if (!saved || savingRef.current || pendingRef.current[r.id]) return;
        if (!window.confirm('저장하지 않은 변경 내용을 취소할까요?')) return;
        const result = discardAssignmentDraft(window.localStorage, draftScope(r));
        if (!result.ok) { setNotice(result.error); return; }
        setReservations(prev => prev.map(x => x.id === r.id ? { ...saved, dailyAccommodations: initialAccommodationRows(saved) } : x));
        dirtyRef.current.delete(r.id); setDirty(new Set(dirtyRef.current));
        storedSnapshots.current.delete(r.id);
        for (const setKeys of [setManualHotels, setListHotels, setManualRegions, setListRegions, setClearedRegions]) setKeys(prev => new Set([...prev].filter(key => !key.startsWith(`${r.id}:`))));
        setNotice('변경 내용을 취소했어요.');
    };

    const statusCounts = useMemo(() => {
        const counts: Record<BoardStatus, number> = { '미배정': 0, '진행 중': 0, '배정 완료': 0 };
        base.forEach(r => { counts[boardStatusOf(r)]++; });
        return counts;
    }, [base]);
    const yearTotal = Array.from({ length: 12 }, (_, i) => monthStats.perMonth.get(`${year}-${String(i + 1).padStart(2, '0')}`) || 0).reduce((a, b) => a + b, 0);
    const filtersOn = !!(q.trim() || scope !== 'confirmed' || region !== 'all' || statusFilter !== 'all' || month !== 'all');
    const resetFilters = () => { setQ(''); setScope('confirmed'); setRegion('all'); setStatusFilter('all'); setMonth('all'); };

    return (
        <AdminLayout
            activePage="accommodation-ops"
            title="숙소 배정 · 현지 운영"
            actions={<button type="button" onClick={load} disabled={loading || !!savingId} className="btn"><Icon name="refresh" />새로고침</button>}
        >
            <div className="lo-board">
            {notice && <div className="lo-notice" role="status">{notice}</div>}
            {loadWarnings.map((warning, i) => <div key={i} role="alert" className="lo-notice is-warn">{warning}</div>)}
            {resources.warnings.map((warning, i) => <div key={`resource-${i}`} role="alert" className="lo-notice is-warn">{warning}</div>)}
            {Object.keys(pendingDrafts).length > 0 && <div className="lo-notice is-draft" role="status">복구 가능한 배정 초안 {Object.keys(pendingDrafts).length}건이 있어요. 펼친 예약에서 복원 또는 버리기를 골라 주세요.</div>}

            <div className="lo-summary">
                {KPI_CARDS.map(({ key, label, tone, icon, hint }) => {
                    const n = key === 'all' ? base.length : statusCounts[key];
                    const on = statusFilter === key, hot = tone === 'warn' && n > 0;
                    return (
                        <button key={key} type="button" data-tone={tone} aria-pressed={on} className={`lo-kpi${on ? ' is-on' : ''}${hot ? ' is-hot' : ''}${tone === 'ok' && n > 0 ? ' is-filled' : ''}`} onClick={() => setStatusFilter(on || key === 'all' ? 'all' : key)}>
                            <span className="lo-kpi-icon"><DashboardIcon name={icon} size={18} /></span>
                            <span className="lo-kpi-body"><span className="lo-kpi-label">{label}</span><span className="lo-kpi-num"><b>{n}</b><small>팀</small></span></span>
                            <span className="lo-kpi-hint">{on ? '선택됨' : tone === 'warn' && n === 0 ? '' : hint}</span>
                        </button>
                    );
                })}
            </div>

            <div className="lo-filters">
                <label className="lo-search">
                    <DashboardIcon name="lc-search" size={16} />
                    <input aria-label="고객·여행·예약번호 검색" placeholder="고객, 여행, 예약번호로 검색" value={q} onChange={e => setQ(e.target.value)} />
                </label>
                <select className="lo-select" aria-label="예약 범위" value={scope} onChange={e => setScope(e.target.value as any)}>
                    <option value="confirmed">확정 예약만</option>
                    <option value="all">전체 예약</option>
                </select>
                <select className="lo-select" aria-label="지역" value={region} onChange={e => setRegion(e.target.value)}>
                    <option value="all">전체 지역</option>
                    {regionOptions.map(rg => <option key={rg} value={rg}>{rg}</option>)}
                </select>
                {filtersOn && <button type="button" className="lo-reset" onClick={resetFilters}>필터 초기화</button>}
                <span className="lo-count">보이는 예약 <b>{counts.total}</b> · 숙소 확정 <b>{counts.done}</b> · 확인 필요 <b className="is-warn">{counts.pending}</b></span>
            </div>

            {/* 출발 월 — 연도 이동 + 월별 건수, 누르면 그 달만 표시 */}
            <div className="lo-months">
                <div className="lo-months-head">
                    <span className="lo-months-label"><DashboardIcon name="lc-calendar" size={16} />출발 월</span>
                    <span className="lo-year">
                        <button type="button" aria-label="이전 연도" disabled={year <= monthStats.minYear} onClick={() => setYear(y => y - 1)}><DashboardIcon name="lc-chevron-left" size={14} /></button>
                        <b>{year}년</b>
                        <button type="button" aria-label="다음 연도" disabled={year >= monthStats.maxYear} onClick={() => setYear(y => y + 1)}><DashboardIcon name="lc-chevron-right" size={14} /></button>
                    </span>
                    <button type="button" className={`lo-year-all${month === 'all' ? ' is-on' : ''}`} onClick={() => setMonth('all')}>전체 {monthStats.total}팀 · {year}년 {yearTotal}팀</button>
                </div>
                <div className="lo-month-scroll"><div className="lo-month-grid">
                    {Array.from({ length: 12 }, (_, i) => {
                        const key = `${year}-${String(i + 1).padStart(2, '0')}`;
                        const n = monthStats.perMonth.get(key) || 0;
                        const active = month === key;
                        return (
                            <button key={key} type="button" disabled={n === 0} aria-pressed={active} onClick={() => setMonth(active ? 'all' : key)} title={n === 0 ? '이 달에 출발하는 예약이 없어요' : `${i + 1}월 출발 ${n}팀`}
                                className={`lo-month${active ? ' is-on' : ''}${n ? ' has-tours' : ''}`}>
                                <span>{i + 1}월</span><small>{n ? `${n}팀` : '—'}</small>
                            </button>
                        );
                    })}
                </div></div>
            </div>

            <section className="lo-table" aria-label="숙소 배정 예약 목록">
                <div className="lo-head" aria-hidden="true">
                    <span>고객</span><span>여행 일정</span><span>숙소</span><span>배정 진행</span><span>상태</span><span />
                </div>
                {loading && <p className="lo-empty">예약을 불러오고 있어요…</p>}
                {!loading && filtered.length === 0 && <div className="lo-empty"><p>조건에 맞는 예약이 없어요.</p>{filtersOn && <button type="button" onClick={resetFilters}>필터 초기화</button>}</div>}
                {!loading && filtered.map(r => {
                    const sum = summaryOf(r);
                    const status = boardStatusOf(r);
                    const open = expanded.has(r.id);
                    const isDirty = dirty.has(r.id);
                    // 초안 선택 전에는 행이 구체화되지 않으므로 잠긴 화면에도 고객 일정의 숙박일을 그대로 보여 준다.
                    const rows = open ? (r.dailyAccommodations || sum.plan.rows) : [];
                    const cd = r.contractData || {};
                    const travelers = cd.travelers || [];
                    const hotels = [...new Set((r.dailyAccommodations || []).map(d => (d.accommodation?.name || '').trim()).filter(Boolean))];
                    const hasGuide = !!r.assignedGuide?.name?.trim(), hasVehicle = !!cd.vehicle?.type?.trim();
                    const progress = sum.total === null ? '필요 숙박일 확인' : sum.total === 0 ? '숙박 없음' : `${sum.confirmed}/${sum.total}박 확정`;
                    const progressNote = sum.plan.warnings.length > 0 || (sum.total !== null && sum.total > 0 && !sum.allConfirmed) ? '숙박일 확인 필요' : !hasGuide || !hasVehicle ? '가이드·차량 확인' : '배정 완료';
                    const isQuote = r.type === 'quote' || r.source === 'quote_booking';
                    const departure = departureBadge(r.startDate);
                    const travelersOpen = !travelersClosed.has(r.id);
                    const nightSegments = sum.plan.nightStates.length ? sum.plan.nightStates : ['empty' as const];
                    return (
                        <React.Fragment key={r.id}>
                            <div id={`acc-row-${r.id}`} role="button" tabIndex={0} aria-expanded={open} className={`lo-row${open ? ' is-open' : ''}`} onClick={() => toggleExpand(r)}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(r); } }}>
                                <span className="lo-customer">
                                    <span className="lo-customer-name">
                                        <b>{r.customerName || '-'}</b>
                                        {isDirty && <em className="lo-kind" data-kind="dirty">변경됨</em>}
                                        {pendingDrafts[r.id] && <em className="lo-kind" data-kind="draft">초안</em>}
                                    </span>
                                    <small>{isQuote ? '견적 고객' : '상품 예약'} · {regionOf(r)} · {r.travelers || '-'}명{r.reservationNumber && ` · #${r.reservationNumber}`}</small>
                                </span>
                                <span className="lo-range">
                                    <b>{fmtDate(r.startDate)} – {fmtDate(r.endDate)}</b>
                                    <small>
                                        <span className={sum.total === null ? 'is-alert' : ''}>{sum.total === null ? '기간 확인 필요' : sum.total === 0 ? '당일' : `${sum.total}박 ${sum.total + 1}일`}</span>
                                        {departure && <>·<span className={`lo-dday${departure.soon ? ' is-alert' : ''}`}>{departure.label}</span></>}
                                    </small>
                                </span>
                                <span className={`lo-hotels${hotels.length ? '' : ' is-empty'}`}>{hotels.length ? `${hotels[0]}${hotels.length > 1 ? ` 외 ${hotels.length - 1}` : ''}` : '숙소 미배정'}</span>
                                <span className="lo-progress">
                                    <span className="lo-progress-text">
                                        <b className={sum.allConfirmed && sum.total ? 'is-done' : ''}>{progress}</b>
                                        <small className={progressNote === '배정 완료' ? 'is-done' : ''}>{progressNote}</small>
                                    </span>
                                    <span className="lo-segments" aria-hidden="true">{nightSegments.map((state, index) => <i key={index} data-state={state} />)}</span>
                                </span>
                                <span className="lo-status-cell"><span className="lo-status" data-status={status}><i />{status}</span></span>
                                <span className="lo-chev"><DashboardIcon name="lc-chevron-down" size={18} /></span>
                            </div>
                            {open && (
                                <div className="lo-detail">
                                    {pendingDrafts[r.id] && <div className="lo-notice is-draft" role="status">
                                        <p>{pendingDrafts[r.id].conflict ? '초안 보관 후 서버 예약이 변경되었습니다. 현재 예약에 초안 배정을 적용할지 확인하세요.' : '이 계정과 예약에 보관된 배정 초안이 있습니다.'}</p>
                                        <span className="lo-actions">
                                            <button type="button" className="lo-btn is-ink" disabled={!!savingId} onClick={() => resolveDraft(r, true)}>초안 복원</button>
                                            <button type="button" className="lo-btn" disabled={!!savingId} onClick={() => resolveDraft(r, false)}>초안 버리기</button>
                                        </span>
                                    </div>}
                                    <fieldset disabled={!!savingId || !!pendingDrafts[r.id]} className="lo-fieldset">

                                    {/* 여행자 · 항공 */}
                                    <section className="lo-card">
                                        <button type="button" className="lo-card-toggle" aria-expanded={travelersOpen} onClick={() => setTravelersClosed(prev => { const next = new Set(prev); if (next.has(r.id)) next.delete(r.id); else next.add(r.id); return next; })}>
                                            <DashboardIcon name="lc-users" size={16} /><h3>여행자 · 항공</h3>
                                            <span className="lo-card-chev"><DashboardIcon name="lc-chevron-down" size={18} /></span>
                                        </button>
                                        {travelersOpen && <>
                                            <div className="lo-flights">
                                                <div><span><DashboardIcon name="lc-plane-landing" size={14} />입국 항공 (몽골 도착)</span><b>{flightLine(cd.arrival)}</b></div>
                                                <div><span><DashboardIcon name="lc-plane-takeoff" size={14} />출국 항공 (몽골 출발)</span><b>{flightLine(cd.departure)}</b></div>
                                            </div>
                                            {travelers.length > 0 ? (
                                                <div className="lo-scroll">
                                                    <table className="lo-mini">
                                                        <thead><tr><th>#</th><th>여권 영문명</th><th>이름</th><th>생년월일</th><th>성별</th><th>연락처</th></tr></thead>
                                                        <tbody>
                                                            {travelers.map((t, i) => (
                                                                <tr key={i}><td>{i + 1}</td><td><b>{t.passportName || '-'}</b></td><td>{t.name || '-'}</td><td>{t.birthdate || '-'}</td><td>{genderLabel(t.gender)}</td><td>{t.phone || '-'}</td></tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : <p className="lo-note">여행자 정보 없음 (계약서 제출 전)</p>}
                                            <details className="lo-schedule">
                                                <summary><span className="lo-schedule-chev"><DashboardIcon name="lc-chevron-right" size={14} /></span>전체 고객 일정 보기</summary>
                                                <div className="lo-meta">
                                                    {cd.agreement?.name && <span>전자 서명 <b>{cd.agreement.name}</b></span>}
                                                    <span>고객 일정 기준 <b>{scheduleSourceLabel[r.schedule?.source || 'none'] || '고객 일정'}</b> · {r.schedule?.days.length || 0}일</span>
                                                </div>
                                                {(r.schedule?.days || []).length ? <div className="lo-plan-days">
                                                    {r.schedule!.days.map((day, index) => {
                                                        const dayRegion = scheduleStayRegion(day, lodgeRegions, r.schedule?.source);
                                                        const steps = scheduleTimeline(day.summary);
                                                        return <details key={index} className="lo-plan-day" open={index === 0}>
                                                            <summary>
                                                                <span className="lo-plan-chev"><DashboardIcon name="lc-chevron-down" size={16} /></span>
                                                                <b>{day.day}일차</b>
                                                                <span className="lo-plan-date">{day.date || '날짜 미정'}{day.date && ` ${weekdayKo(day.date)}`}</span>
                                                                <span className="lo-pill lo-plan-region" data-tone={dayRegion ? 'ok' : undefined} data-empty={dayRegion ? undefined : 'true'}>{dayRegion || '지역 미입력'}</span>
                                                                {day.title && day.title !== dayRegion && <span className="lo-plan-title">{day.title}</span>}
                                                                <small>{steps.length}개 일정</small>
                                                            </summary>
                                                            {steps.length ? <ol className="lo-timeline">
                                                                {steps.map((step, stepIndex) => <li key={stepIndex} data-tone={step.tone || undefined}>{step.time && <time>{step.time}</time>}<span>{step.text}</span></li>)}
                                                            </ol> : <p className="lo-muted lo-plan-empty">일정 내용 없음</p>}
                                                        </details>;
                                                    })}
                                                </div> : <p className="lo-muted">저장된 고객 일정이 없습니다. 숙소 배정은 기존 내용을 유지합니다.</p>}
                                            </details>
                                        </>}
                                    </section>

                                    {/* 일차별 숙소 */}
                                    <section className="lo-card">
                                        <header className="lo-card-head"><DashboardIcon name="lc-bed" size={16} /><h3>일차별 숙소</h3>
                                            <span className="lo-pill" data-tone={sum.allConfirmed && sum.total ? 'ok' : 'info'}>{progress}</span>
                                            <span className="lo-spacer" />
                                            <a className="lo-btn" href={r.source === 'quote_booking' ? quoteCustomerHref(r.bookingId, '/admin/accommodation-ops') : productCustomerHref(r.bookingId, '/admin/accommodation-ops')} title="고객 통합 작업 화면에서 이 예약을 엽니다.">
                                                <DashboardIcon name="lc-external-link" size={14} />예약 상세
                                            </a>
                                            <button type="button" className="lo-btn" title="저장된 숙소와 객실은 유지하고 고객 일정의 해당 일차 날짜에 맞춥니다." disabled={!sum.plan.canAlignDates} onClick={() => alignDates(r.id)}>
                                                <DashboardIcon name="lc-calendar" size={14} />여행 날짜에 맞추기
                                            </button>
                                        </header>
                                        {!sum.total && <p className="lo-note">{sum.total === null ? '여행 기간을 확인하면 필요한 숙박일을 계산할 수 있습니다.' : '당일 여행으로 숙박 배정이 필요하지 않습니다.'}</p>}
                                        {pendingDrafts[r.id] && <div role="status" className="lo-warn">보관된 초안이 있어 잠겨 있어요. 이 예약 맨 위에서 ‘초안 복원’ 또는 ‘초안 버리기’를 고르면 수정할 수 있어요.</div>}
                                        {sum.plan.warnings.map((warning, index) => <div key={index} role="alert" className="lo-warn">{warning}</div>)}
                                        <div className="lo-night-list">
                                            {rows.map((d, idx) => {
                                                const acc = d.accommodation || {};
                                                const scheduleDay = r.schedule?.days.find(day => day.day === d.day);
                                                const scheduleRegion = scheduleDay ? scheduleStayRegion(scheduleDay, lodgeRegions, r.schedule?.source) : '';
                                                const mKey = `${r.id}:${idx}`;
                                                const nightRegion = (acc.location || '').trim() || (clearedRegions.has(mKey) ? '' : scheduleRegion);
                                                const regionLodges = nightRegion ? resources.lodges.filter(lodge => [lodge.region, lodge.location].some(value => value.trim().toLocaleLowerCase('ko-KR') === nightRegion.toLocaleLowerCase('ko-KR'))) : [];
                                                const otherLodges = nightRegion ? resources.lodges.filter(lodge => !regionLodges.includes(lodge)) : resources.lodges;
                                                const hasName = (acc.name || '').trim().length > 0;
                                                const bookingStatus = hasName ? (acc.bookingStatus || 'Илгээгээгүй') : 'Илгээгээгүй';
                                                const nm = acc.name || '';
                                                const inMaster = !!acc.id && lodgeById.get(acc.id)?.name === nm;
                                                const manual = manualHotels.has(mKey) || (!listHotels.has(mKey) && !!nm && !inMaster);
                                                const loc = acc.location || '';
                                                // 숙소를 고르기 전에는 일정 지역을 보여 주되, 저장 값은 관리자가 숙소나 지역을 고를 때 정해진다.
                                                const shownRegion = loc || (hasName ? '' : nightRegion);
                                                const regionChoices = scheduleRegion && !lodgeRegions.includes(scheduleRegion) ? [scheduleRegion, ...lodgeRegions] : lodgeRegions;
                                                const regionManual = manualRegions.has(mKey) || (!listRegions.has(mKey) && !!loc && !regionChoices.includes(loc));
                                                const previous = idx > 0 ? rows[idx - 1].accommodation : undefined;
                                                return (
                                                    <article key={idx} className="lo-night" data-state={!hasName ? 'empty' : isLodgeBookingConfirmed(bookingStatus) ? 'confirmed' : 'assigned'}>
                                                        <header className="lo-night-head">
                                                            <label className="lo-day-no">
                                                                <input type="number" min={1} aria-label="숙박 일차" style={{ width: `${String(d.day).length + 0.4}ch` }} value={d.day} onChange={e => patchDayMeta(r.id, idx, { day: parseInt(e.target.value) || idx + 1 })} /><span>일차</span></label>
                                                            <span className="lo-date-pill">
                                                                <input type="date" className="lo-date" aria-label="숙박 날짜" value={d.date || ''} onChange={e => patchDayMeta(r.id, idx, { date: e.target.value })} />
                                                                {d.date && <span className="lo-dow">{weekdayKo(d.date)}</span>}
                                                            </span>
                                                            <span className="lo-night-place" title={scheduleDay?.summary || undefined}><DashboardIcon name="lc-map-pin" size={14} />{nightRegion || scheduleDay?.title || '장소 미정'}</span>
                                                            <span className="lo-spacer" />
                                                            {previous && <button type="button" className="lo-btn lo-copy" disabled={!previous.name && !previous.location} title="앞 일차의 지역·숙소·등급·객실·인원을 그대로 가져옵니다. 예약 상태는 미발송으로 시작합니다." onClick={() => copyPreviousDay(r.id, idx)}>
                                                                <DashboardIcon name="lc-copy" size={14} />앞 일차와 동일
                                                            </button>}
                                                            <button type="button" className="lo-icon-btn is-danger" title="이 숙박일 삭제" aria-label={`${d.day}일차 숙박 삭제`} onClick={() => { if (window.confirm(`${d.day}일차 숙박을 삭제할까요?`)) removeDay(r.id, idx); }}>
                                                                <DashboardIcon name="lc-trash" size={15} />
                                                            </button>
                                                        </header>
                                                        {(sum.plan.rowWarnings[idx] || []).map((warning, index) => <div key={index} role="alert" className="lo-night-warn">{warning}</div>)}
                                                        <div className="lo-night-fields">
                                                        <div className="lo-field"><span>지역</span>{regionManual ? (
                                                            // 등록 숙소의 지역에서 선택하며 과거 값과 직접 입력은 그대로 유지한다.
                                                            <div className="lo-region-manual">
                                                                <input className="lo-input lo-region" aria-label="숙박 지역" value={loc} placeholder="지역 입력" onChange={e => patchDay(r.id, idx, { location: e.target.value, region: e.target.value })} />
                                                                <button type="button" className="lo-icon-btn" title="등록 지역 목록에서 선택"
                                                                    onClick={() => { setManualRegions(prev => { const n = new Set(prev); n.delete(mKey); return n; }); setListRegions(prev => new Set(prev).add(mKey)); }}>
                                                                    <DashboardIcon name="lc-search" size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <select className="lo-input lo-region" aria-label="숙박 지역 선택" disabled={resourcesLoading} value={shownRegion}
                                                                onChange={e => {
                                                                    const v = e.target.value;
                                                                    if (v === '__manual__') { setManualRegions(prev => new Set(prev).add(mKey)); setListRegions(prev => { const next = new Set(prev); next.delete(mKey); return next; }); return; }
                                                                    setClearedRegions(prev => { const next = new Set(prev); if (v) next.delete(mKey); else next.add(mKey); return next; });
                                                                    patchDay(r.id, idx, { location: v, region: v });
                                                                }}>
                                                                <option value="">{resourcesLoading ? '지역 불러오는 중…' : '지역 선택…'}</option>
                                                                {loc && !regionChoices.includes(loc) && <option value={loc}>{loc}</option>}
                                                                {regionChoices.map(choice => <option key={choice} value={choice}>{choice}</option>)}
                                                                <option value="__manual__">직접 입력</option>
                                                            </select>
                                                        )}</div>
                                                        <div className="lo-field"><span>숙소</span>{manual ? (
                                                            // 공통 숙소에서 선택하며 과거 배정과 직접 입력은 그대로 유지한다.
                                                            <div className="lo-hotel-manual">
                                                                <input className="lo-input" value={nm} placeholder="숙소명 직접 입력" aria-label="숙소명 직접 입력"
                                                                    onChange={e => {
                                                                        if (!manualHotels.has(mKey)) setManualHotels(prev => new Set(prev).add(mKey));
                                                                        if (e.target.value !== nm) patchDay(r.id, idx, { name: e.target.value, id: undefined, images: [], description: '', facilities: [], location: shownRegion, region: shownRegion, address: '', roomAmenities: [], sharedFacilities: [], bookingStatus: 'Илгээгээгүй' });
                                                                    }} />
                                                                <button type="button" className="lo-icon-btn" title="등록 숙소 목록에서 선택"
                                                                    onClick={() => { setManualHotels(prev => { const n = new Set(prev); n.delete(mKey); return n; }); setListHotels(prev => new Set(prev).add(mKey)); }}>
                                                                    <DashboardIcon name="lc-search" size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <select className="lo-input lo-hotel" aria-label="등록 숙소 선택" disabled={resourcesLoading} value={inMaster ? acc.id : nm ? '__current__' : ''}
                                                                onChange={e => {
                                                                    const v = e.target.value;
                                                                    if (v === '__manual__') { setManualHotels(prev => new Set(prev).add(mKey)); setListHotels(prev => { const next = new Set(prev); next.delete(mKey); return next; }); return; }
                                                                    const lodge = lodgeById.get(v);
                                                                    if (lodge) patchDay(r.id, idx, selectResourceLodge(d, lodge).accommodation);
                                                                }}>
                                                                <option value="">{resourcesLoading ? '등록 숙소 불러오는 중…' : '등록 숙소 선택…'}</option>
                                                                {!inMaster && nm && <option value="__current__">현재 배정: {nm}</option>}
                                                                {nightRegion ? <>
                                                                    <optgroup label={`${nightRegion === scheduleRegion ? '일정 지역' : '선택 지역'}: ${nightRegion}`}>{regionLodges.map(lodge => <option key={lodge.id} value={lodge.id}>{lodge.name}</option>)}</optgroup>
                                                                    <optgroup label="전체 다른 지역">{otherLodges.map(lodge => <option key={lodge.id} value={lodge.id}>{lodge.name}</option>)}</optgroup>
                                                                </> : resources.lodges.map(lodge => <option key={lodge.id} value={lodge.id}>{lodge.name}</option>)}
                                                                <option value="__manual__">직접 입력 (목록에 없는 숙소)</option>
                                                            </select>
                                                        )}</div>
                                                        <div className="lo-field"><span>등급</span>
                                                            <select className="lo-input" aria-label="숙소 등급" value={acc.type || ''} onChange={e => patchDay(r.id, idx, { type: e.target.value || undefined })}>
                                                                {acc.type && !GRADE_OPTIONS.includes(acc.type) && <option value={acc.type}>{acc.type}</option>}
                                                                {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g || '미정'}</option>)}
                                                            </select>
                                                        </div>
                                                        <div className="lo-field"><span>객실</span><input className="lo-input" type="number" min={0} aria-label="객실 수" value={acc.roomCount ?? ''} placeholder="0" onChange={e => patchDay(r.id, idx, { roomCount: e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value) || 0) })} /></div>
                                                        <div className="lo-field"><span>인원</span>
                                                            <select className="lo-input" aria-label="객실당 인원" value={acc.occupancy || ''} onChange={e => patchDay(r.id, idx, { occupancy: e.target.value || undefined })}>
                                                                {acc.occupancy && !OCCUPANCY_OPTIONS.includes(acc.occupancy) && <option value={acc.occupancy}>{acc.occupancy}</option>}
                                                                {OCCUPANCY_OPTIONS.map(o => <option key={o} value={o}>{occupancyLabel(o)}</option>)}
                                                            </select>
                                                        </div>
                                                        <div className="lo-field"><span>예약 상태</span>
                                                            <span className="lo-status-select" data-status={hasName ? bookingStatus : 'none'}>
                                                                <i />
                                                                <select className="lo-input" aria-label="숙소 예약 상태" value={bookingStatus} disabled={!hasName}
                                                                    onChange={e => patchDay(r.id, idx, { bookingStatus: e.target.value as BookingStatus })}>
                                                                    {!LODGE_BOOKING_STATUSES.some(s => s.value === bookingStatus) && <option value={bookingStatus}>{lodgeBookingLabel(bookingStatus)}</option>}
                                                                    {LODGE_BOOKING_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                                                </select>
                                                            </span>
                                                        </div>
                                                        </div>
                                                    </article>
                                                );
                                            })}
                                            {/* 숙박 행이 없는 일차도 고객 일정은 보여 준다. 저장된 배정은 명시적으로 추가할 때만 바뀐다. */}
                                            {sum.plan.missingNights.filter(night => night.title || night.summary).map(night => (
                                                <div key={`missing-${night.day}`} className="lo-night is-plan">
                                                    <b>{night.day}일차</b>
                                                    <span className="lo-dow">{night.date || '날짜 미정'}{night.date && ` ${weekdayKo(night.date)}`}</span>
                                                    <div className="lo-night-route"><b>{night.title || night.region || '일정'}</b>{night.summary && <small>{night.summary.split('\n').map(line => line.trim()).filter(Boolean).join(' · ')}</small>}</div>
                                                </div>
                                            ))}
                                            {sum.plan.missingNights.some(night => night.title || night.summary)
                                                ? <p className="lo-empty-row">위 일차는 숙소 행이 아직 없어요. '누락 숙박일 추가'를 누르면 숙소를 배정할 수 있어요.</p>
                                                : rows.length === 0 && <p className="lo-empty-row">숙박일이 없어요. '숙박일 추가'로 추가해 주세요.</p>}
                                        </div>
                                        <div className="lo-actions">
                                            <button type="button" className="lo-btn is-dashed" onClick={() => addDay(r.id)}><DashboardIcon name="lc-plus" size={15} />숙박일 추가</button>
                                            {sum.plan.missingNights.length > 0 && <button type="button" className="lo-btn is-dashed" disabled={sum.plan.addableNights.length === 0} onClick={() => addMissingNights(r)}><DashboardIcon name="lc-plus" size={15} />누락 숙박일 추가</button>}
                                        </div>
                                    </section>

                                    {/* 담당 가이드 · 투어 차량 */}
                                    <div className="lo-crew">
                                        <section className="lo-card">
                                            <header className="lo-card-head"><DashboardIcon name="lc-user-round" size={16} /><h3>담당 가이드</h3>
                                                <span className="lo-pill" data-tone={hasGuide ? 'ok' : 'alert'}>{hasGuide ? '배정됨' : '미배정'}</span></header>
                                            <select className="lo-input" aria-label="등록 가이드 선택" disabled={resourcesLoading} value={resources.guides.some(guide => guide.id === r.assignedGuide?.id) ? r.assignedGuide?.id || '' : ''} onChange={e => chooseGuide(r.id, e.target.value)}>
                                                <option value="">{resourcesLoading ? '등록 가이드 불러오는 중…' : '등록 가이드 선택 · 직접 입력 가능'}</option>
                                                {resources.guides.map(guide => <option key={guide.id} value={guide.id}>{guide.name}</option>)}
                                            </select>
                                            <div className="lo-crew-row">
                                                <input className="lo-input" aria-label="가이드 이름 직접 입력" value={r.assignedGuide?.name || ''} placeholder="가이드 이름 직접 입력" onChange={e => patchGuide(r.id, { name: e.target.value })} />
                                                <input className="lo-input" aria-label="가이드 연락처" value={r.assignedGuide?.phone || ''} placeholder="가이드 연락처" onChange={e => patchGuide(r.id, { phone: e.target.value })} />
                                            </div>
                                        </section>
                                        <section className="lo-card">
                                            <header className="lo-card-head"><DashboardIcon name="lc-car" size={16} /><h3>투어 차량</h3>
                                                <span className="lo-pill" data-tone={hasVehicle ? 'ok' : 'alert'}>{hasVehicle ? '배정됨' : '미배정'}</span></header>
                                            <select className="lo-input" aria-label="등록 차량 선택" disabled={resourcesLoading} value={r.contractData?.vehicle?.resource && resources.vehicles.some(vehicle => vehicle.type === r.contractData?.vehicle?.type) ? r.contractData.vehicle.type : ''} onChange={e => chooseVehicle(r.id, e.target.value)}>
                                                <option value="">{resourcesLoading ? '등록 차량 불러오는 중…' : '등록 차량 선택 · 직접 입력 가능'}</option>
                                                {resources.vehicles.map(vehicle => <option key={vehicle.type} value={vehicle.type}>{vehicle.name}</option>)}
                                            </select>
                                            <div className="lo-crew-row">
                                                <input className="lo-input" aria-label="차종 직접 입력" value={r.contractData?.vehicle?.type || ''} placeholder="차종 직접 입력" onChange={e => patchVehicle(r.id, { type: e.target.value })} />
                                                <input className="lo-input" aria-label="기사 연락처" value={r.contractData?.vehicle?.phone || ''} placeholder="기사 연락처" onChange={e => patchVehicle(r.id, { phone: e.target.value })} />
                                            </div>
                                        </section>
                                    </div>
                                    </fieldset>

                                    <div className="lo-savebar">
                                        <span className={`lo-savebar-text${isDirty ? ' is-dirty' : ''}`}>{isDirty ? '저장하지 않은 변경 사항이 있어요.' : savedAt[r.id] ? `${savedAt[r.id]} 저장됨 · 저장된 배정 기준이에요.` : '저장된 배정 기준이에요.'}</span>
                                        {isDirty && <button type="button" className="lo-btn lo-reset-row" disabled={!!savingId} onClick={() => resetRow(r)}>변경 취소</button>}
                                        <button type="button" className="lo-save" disabled={!isDirty || !!savingId || !!pendingDrafts[r.id]} onClick={() => save(r)}>
                                            <DashboardIcon name="lc-check" size={15} />{savingId === r.id ? '저장하는 중…' : '배정 저장'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </section>
            </div>
        </AdminLayout>
    );
};
