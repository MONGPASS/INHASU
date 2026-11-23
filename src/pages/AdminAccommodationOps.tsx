import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import type { AssignmentAccommodation, AssignmentGuide, AssignmentSource, AssignmentVehicle, ContractPackageType } from '../utils/reservationAssignment';
import { loadRegisteredAssignmentResources, type RegisteredAssignmentResources } from '../utils/registeredAssignmentResources';
import { addMissingAccommodationNights, alignAccommodationDates, getAccommodationPlan, initialAccommodationRows, type AccommodationSchedule } from '../utils/accommodationSchedule';
import { assignmentFingerprint, editorAssignment, writeAssignmentDraft, readAssignmentDraft, discardAssignmentDraft, type AssignmentDraft, type AssignmentDraftResult } from '../utils/adminAssignmentDraft';
import { toTourDateKey } from '../utils/formatDate';
import { AdminLayout } from '../components/admin/AdminLayout';
import './AdminAccommodationOps.css';
import { isUpcomingTour, tourSerials } from '../utils/accommodationSheet';
import { LodgeAssignBoard } from '../components/admin/accommodation/LodgeAssignBoard';
import { LodgeAssignQueue } from '../components/admin/accommodation/LodgeAssignQueue';
import { AdminSegmented } from '../components/admin/ui';
import { adminConfirm } from '../components/admin/ui/adminFeedback';
import { adminConfirmLeave } from '../components/admin/ui/adminLeaveConfirm';

/**
 * 숙소 배정 · 현지 운영 — Admin Dashboard v3 "05-1" 디자인(한국어).
 * 예약별 숙박일의 숙소·객실·인원·수배 상태와 담당 가이드·차량을 한 화면에서 관리합니다.
 * 저장 값(수배 상태·객실당 인원)은 기존 데이터와 다른 화면이 읽는 원래 표기(몽골어)를 그대로 쓰고, 화면 표시만 한국어로 바꿉니다.
 */

// 배정 보드(예약 대기열 + 숙박별 배정, 기본)와 표로 보기(숙소 배정 스프레드시트와 같은 열) 두 가지. 고른 보기는 이 브라우저에만 기억한다.
// 예전 카드 보기는 2026-11-23 없앴다(오너 결정): 여행자·항공은 표로 보기의 예약 정보 창, 누락 숙박일·날짜 맞추기는 표로 보기의 숙박 줄 아래, 가이드·차량은 가이드 배정 현황에서 한다.
type BoardView = 'board-view' | 'sheet-view';
const VIEW_KEY = 'inhasu:accommodation-board:view';
const VIEWS: BoardView[] = ['board-view', 'sheet-view'];
const storedView = (): BoardView => { try { const v = window.localStorage.getItem(VIEW_KEY) as BoardView | null; return v && VIEWS.includes(v) ? v : 'board-view'; } catch { return 'board-view'; } };
const VIEW_ITEMS: Array<{ value: BoardView; label: string }> = [{ value: 'board-view', label: '배정 보드' }, { value: 'sheet-view', label: '표로 보기' }];
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
    /** 숙소 배정 시트의 분류(G열). 서버가 보낸 값이 있을 때만 저장 요청에 포함한다. */
    assignmentCategory?: string;
    /** 숙소 배정 시트 고객명 칸 — 대표 1인 이름과 고객이 고른 패키지 */
    leadName?: string;
    packagePlan?: 'full' | 'value' | 'mixed' | null;
    contractPackageType?: ContractPackageType;
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

// 오늘 (yyyy-mm-dd, 로컬 기준)
const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const regionOf = (r: Reservation) => (r.contractData?.region || r.contractData?.category || r.productName || '-');
/**
 * 시트에서 고칠 숙박 행. 저장된 행이 없으면 고객 일정으로 만든다.
 * fill: 지역이 비어 있는 숙박일(행 번호)에 함께 넣을 계약 일정 지역. 처음 만든 행의 일정 원문 지역은 시트 지명으로 바꾼다.
 */
const sheetRowsWithFill = (r: Reservation, fill?: Record<number, string>): DailyAcc[] => {
    const fresh = !r.dailyAccommodations;
    return (r.dailyAccommodations ?? initialAccommodationRows(r)).map((d, i) => {
        const area = fill?.[i];
        const hasStored = !fresh && !!(d.accommodation?.region || d.accommodation?.location);
        return area && !hasStored ? { ...d, accommodation: { ...d.accommodation, location: area, region: area } } : d;
    });
};
const genderLabel = (g?: string) => g === '男性' || g === '남성' || g === 'male' ? '남' : g === '女性' || g === '여성' || g === 'female' ? '여' : (g || '-');
const flightLine = (f?: Flight) => [f?.date, f?.time, f?.flight].filter(Boolean).join(' · ') || '-';

const CONFIRMED_STATUSES = ['confirmed', 'paid', 'completed'];
/** 표로 보기의 예약 정보 창: 입국·출국 항공, 여행자 명단, 고객 일정 출처(예전 카드 보기의 ‘여행자 · 항공’). */
const tourDetailOf = (r: Reservation) => ({
    flights: [{ label: '입국 항공 (몽골 도착)', line: flightLine(r.contractData?.arrival) }, { label: '출국 항공 (몽골 출발)', line: flightLine(r.contractData?.departure) }],
    travelers: (r.contractData?.travelers || []).map(t => ({ name: t.name || '-', passportName: t.passportName || '-', birthdate: t.birthdate || '-', gender: genderLabel(t.gender), phone: t.phone || '-' })),
    scheduleLabel: `${scheduleSourceLabel[r.schedule?.source || 'none'] || '고객 일정'} · ${r.schedule?.days.length || 0}일`,
    signer: r.contractData?.agreement?.name || '',
});

export const AdminAccommodationOps: React.FC = () => {
    const { user, loading } = useUser();
    if (loading || !user || user.role !== 'admin') return <AdminLayout activePage="accommodation-ops" title="숙소 배정"><div className="empty">관리자 계정을 확인하고 있습니다.</div></AdminLayout>;
    return <AccommodationBoard key={user.id} userId={user.id} />;
};

function fromApi(item: any): Reservation {
    // 견적 예약은 저장만 해도 빈 배열이 들어가므로, 고객 일정이 있으면 빈 배열도 '아직 배정 전'으로 보고 일차별 행을 펼친다(수정·저장 전에는 서버를 바꾸지 않음).
    const unassigned = item.accommodationsInitialized === false || (!item.assignment.accommodations.length && !!item.schedule?.days?.length);
    return { ...item, bookingId: item.id, id: item.key, assignedGuide: item.assignment.guide,
        assignmentCategory: typeof item.assignment.category === 'string' ? item.assignment.category : undefined,
        dailyAccommodations: unassigned ? undefined : item.assignment.accommodations, contractData: { ...item.contractData, vehicle: item.assignment.vehicle } };
}
async function assignmentRequest(path = '', options: RequestInit = {}) {
    const response = await fetch(`/api/admin/assignments${path}`, { credentials: 'same-origin', cache: 'no-store', ...options });
    const body = await response.json();
    // 가이드 중복(guide_conflict)은 화면이 확인 후 다시 저장할 수 있게 사유 코드를 함께 넘긴다.
    if (!response.ok) throw Object.assign(new Error(body.error || '배정 정보를 불러오지 못했습니다.'), { code: body.code, conflicts: body.conflicts });
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
    // 표로 보기에서 펼치고 강조할 예약(예약 상세의 ?open= 링크, 배정 보드의 ‘여행자·일정 보기’). seq가 바뀔 때마다 다시 연다.
    const [focus, setFocus] = useState<{ id: string; info: boolean; seq: number } | null>(null);
    const focusSeq = useRef(0);
    const focusTour = (id: string, info = false) => { focusSeq.current += 1; setFocus({ id, info, seq: focusSeq.current }); };
    // 숙소 배정에 들어오면 확정 여부와 관계없이 전체 예약을 보여 준다.
    const [scope, setScope] = useState<'confirmed' | 'all'>('all');
    const [view, setViewState] = useState<BoardView>(() => new URLSearchParams(window.location.search).get('open') ? 'sheet-view' : storedView());
    const setView = (next: BoardView) => { setViewState(next); try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* 보기 기억은 편의 기능 */ } };
    // 지난 투어는 숨기되, 예약 상세의 링크로 직접 연 예약은 보여 준다.
    const [pinned, setPinned] = useState<Set<string>>(new Set());
    const [savingAll, setSavingAll] = useState(false);
    const [resources, setResources] = useState<RegisteredAssignmentResources>({ guides: [], lodges: [], vehicles: [], warnings: [] });
    const [resourcesLoading, setResourcesLoading] = useState(false);
    const resourceGeneration = useRef(0), resourceController = useRef<AbortController | null>(null);
    // 표로 보기에서 숙소지역을 일부러 비운 칸 (key = `${reservationId}:${dayIndex}`)
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
        if (dirtyRef.current.size && !await adminConfirm('변경 내용을 브라우저 초안으로 보관했습니다. 최신 예약을 다시 불러올까요?')) return;
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
            if (Object.keys(nextPending).length) setScope('all');
            setLoadWarnings(data.warnings || []);
        } catch (e) {
            if (mounted.current && requestGeneration === generation.current) setLoadWarnings([e instanceof Error ? e.message : '예약을 불러오지 못했습니다. 이전 자료를 유지합니다.']);
        } finally {
            if (mounted.current && requestGeneration === generation.current) setLoading(false);
        }
    };
    useEffect(() => { load(); }, []);
    const lodgeRegions = useMemo(() => [...new Set(resources.lodges.map(lodge => (lodge.region || lodge.location).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko-KR')), [resources.lodges]);

    // 오늘 이후(오늘 포함) 진행되는 투어만 숙소 배정 대상으로 보여 준다. 복구할 초안이 있는 예약은 정리할 수 있게 남긴다.
    const today = todayKey();
    const base = useMemo(() => reservations.filter(r => (isUpcomingTour(r, today) || pinned.has(r.id) || !!pendingDrafts[r.id]) && (scope === 'all' ? true
        : (CONFIRMED_STATUSES.includes(r.status || '') || r.depositStatus === 'paid' || r.type === 'quote'))), [reservations, scope, pinned, today, pendingDrafts]);
    const serials = useMemo(() => tourSerials(reservations), [reservations]);
    // ?open=<reservationId>&source= — 예약 상세의 ‘숙소 배정에서 관리’ 링크로 들어오면 표로 보기에서 그 예약을 펼치고 강조한다
    const openedFromUrl = useRef(false);
    useEffect(() => {
        if (openedFromUrl.current || reservations.length === 0) return;
        const id = new URLSearchParams(window.location.search).get('open');
        if (!id) return;
        const source = new URLSearchParams(window.location.search).get('source') || 'product';
        const target = reservations.find(x => x.bookingId === id && x.source === source);
        if (!target) return;
        openedFromUrl.current = true;
        setPinned(prev => new Set(prev).add(target.id));
        // 확정 전 예약이면 ‘확정 예약만’ 필터에 걸려 안 보이므로 전체 보기로 전환
        if (!(CONFIRMED_STATUSES.includes(target.status || '') || target.depositStatus === 'paid' || target.type === 'quote')) setScope('all');
        focusTour(target.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reservations]);

    // 배정 보드의 ‘여행자·일정 보기’ — 표로 보기에서 그 예약을 펼치고 예약 정보 창(여행자·항공·계약서)을 연다.
    const openDetails = (id: string) => {
        const target = rowsRef.current.find(r => r.id === id);
        if (!target) return;
        setView('sheet-view');
        setPinned(prev => new Set(prev).add(target.id));
        focusTour(target.id, true);
    };

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
        else adminConfirmLeave(blocker, '초안을 보관하지 못했습니다. 변경 내용이 사라질 수 있습니다. 이동할까요?');
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
            setReservations(prev => prev.map(r => r.id === row.id ? { ...r, assignedGuide: a.guide, assignmentCategory: a.category ?? r.assignmentCategory,
                dailyAccommodations: a.accommodations, contractData: { ...r.contractData, vehicle: a.vehicle } } : r));
            markDirty(row.id);
        } else {
            const result = discardAssignmentDraft(window.localStorage, draftScope(row), pending.draft.revision);
            if (!result.ok) { setNotice(result.error); return; }
            setReservations(prev => prev.map(r => r.id === row.id && !r.dailyAccommodations ? { ...r, dailyAccommodations: initialAccommodationRows(r) } : r));
        }
        const next = { ...pendingRef.current }; delete next[row.id]; pendingRef.current = next; setPendingDrafts(next);
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
    // fill(시트): 지역이 비어 있는 숙박일에 계약 일정의 지역을 함께 넣는다. 처음 만든 행의 일정 원문 지역은 시트 지명으로 바꾼다.
    const patchDay = (rId: string, idx: number, patch: Partial<DailyAcc['accommodation']>, fill?: Record<number, string>) => {
        if (savingRef.current || pendingRef.current[rId]) return;
        setReservations(prev => prev.map(r => {
            if (r.id !== rId) return r;
            const rows = sheetRowsWithFill(r, fill).map((d, i) => i === idx ? { ...d, accommodation: { ...d.accommodation, ...patch } } : d);
            return { ...r, dailyAccommodations: rows };
        }));
        markDirty(rId);
    };
    // 숙소 배정 시트: 마지막 숙박 다음 날로 숙박을 하나 더한다(저장 전 행이면 계약 일정 지역과 함께 만든다).
    const addSheetNight = (rId: string, fill?: Record<number, string>) => {
        if (savingRef.current || pendingRef.current[rId]) return;
        setReservations(prev => prev.map(r => {
            if (r.id !== rId) return r;
            const rows = sheetRowsWithFill(r, fill);
            const maxDay = rows.reduce((m, d) => Math.max(m, d.day || 0), 0);
            const last = [...rows].reverse().find(d => /^\d{4}-\d{2}-\d{2}/.test(d.date || ''))?.date?.slice(0, 10) || (r.startDate && toTourDateKey(r.startDate));
            const next = last && /^\d{4}-\d{2}-\d{2}$/.test(last) ? (() => { const d = new Date(`${last}T00:00:00`); d.setDate(d.getDate() + (rows.length ? 1 : 0)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })() : '';
            return { ...r, dailyAccommodations: [...rows, { day: maxDay + 1, date: next, accommodation: {} }] };
        }));
        markDirty(rId);
    };
    const patchCategory = (rId: string, category: string) => {
        if (savingRef.current || pendingRef.current[rId]) return;
        setReservations(prev => prev.map(r => r.id === rId ? { ...r, assignmentCategory: category } : r));
        markDirty(rId);
    };
    const savePackage = async (rId: string, contractPackageType: ContractPackageType) => {
        const row = rowsRef.current.find(r => r.id === rId);
        if (!row || savingRef.current || pendingRef.current[rId] || (row.contractPackageType || '') === contractPackageType) return;
        savingRef.current = rId;
        setSavingId(rId);
        try {
            const data = await assignmentRequest(`/${row.source}/${encodeURIComponent(row.bookingId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expectedVersion: row.version, assignment: { contractPackageType } }) });
            if (!mounted.current) return;
            const saved = fromApi(data.item);
            savedRows.current.set(rId, saved);
            // 숙소·가이드의 미저장 편집은 시트에 두고, 패키지와 다음 저장에 사용할 버전만 갱신한다.
            setReservations(prev => prev.map(r => r.id === rId ? { ...r, contractPackageType: saved.contractPackageType, version: saved.version } : r));
            setNotice('계약 패키지를 저장했습니다.');
        } catch (error) {
            if (mounted.current) setNotice(error instanceof Error ? error.message : '계약 패키지를 저장하지 못했습니다.');
        } finally {
            savingRef.current = null;
            if (mounted.current) setSavingId(null);
        }
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
    const addMissingNights = (row: Reservation) => {
        if (savingRef.current || pendingRef.current[row.id]) return;
        setReservations(prev => prev.map(r => r.id === row.id ? { ...r, dailyAccommodations: addMissingAccommodationNights(r) } : r));
        markDirty(row.id);
    };
    const save = async (r: Reservation, allowGuideConflict = false): Promise<void> => {
        if (savingRef.current || pendingRef.current[r.id]) return;
        // 가이드는 이 화면에서 바꾸지 않는다. 다른 화면에서 바뀐 가이드와 겹친다고 서버가 거절할 때만 확인 후 다시 저장한다.
        const allowGuide = allowGuideConflict;
        let retry = false;
        savingRef.current = r.id;
        setSavingId(r.id);
        const requestGeneration = generation.current;
        const local = writeAssignmentDraft(window.localStorage, draftScope(r), r.version, editorAssignment(r));
        if (local.ok && local.revision) storedSnapshots.current.set(r.id, r.version + assignmentFingerprint(editorAssignment(r)));
        try {
            const data = await assignmentRequest(`/${r.source}/${encodeURIComponent(r.bookingId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expectedVersion: r.version, assignment: editorAssignment(r), ...(allowGuide ? { allowGuideConflict: true } : {}) }) });
            if (!mounted.current || requestGeneration !== generation.current) return;
            // 방금 저장한 행(모두 지운 경우 포함)을 이 화면에서 그대로 보여 준다.
            const savedRow: Reservation = { ...fromApi(data.item), dailyAccommodations: data.item.assignment.accommodations };
            savedRows.current.set(r.id, savedRow);
            setReservations(prev => prev.map(x => x.id === r.id ? savedRow : x));
            dirtyRef.current.delete(r.id); setDirty(new Set(dirtyRef.current));
            storedSnapshots.current.delete(r.id);
            const result = local.ok && local.revision ? discardAssignmentDraft(window.localStorage, draftScope(r), local.revision) : { ok: true } as const;
            setNotice(!local.ok ? '서버 저장은 완료했습니다. 다만 브라우저 초안 저장소를 확인해 주세요. ' + local.error : result.ok ? '배정 정보를 저장했습니다.' : result.error);
        } catch (e: any) {
            // 다른 화면에서 방금 같은 기간에 이 가이드를 배정했으면 서버가 거절한다. 확인하면 그대로 다시 저장한다.
            if (mounted.current && requestGeneration === generation.current && e?.code === 'guide_conflict' && !allowGuide
                && await adminConfirm(`${e.message}\n그래도 배정할까요?`)) retry = true;
            else if (mounted.current && requestGeneration === generation.current) setNotice((e?.message || '저장하지 못했습니다.') + (local.ok ? ' 변경 내용과 브라우저 초안을 유지합니다.' : ' 화면의 변경 내용은 유지합니다. ' + local.error));
        } finally {
            if (mounted.current && requestGeneration === generation.current) { savingRef.current = null; setSavingId(null); }
        }
        if (retry) { const latest = rowsRef.current.find(x => x.id === r.id); if (latest) return save(latest, true); }
    };

    // 저장된 숙박 행이 없는 예약은 고객 일정으로 행을 보여 주되, 지역은 시트가 계약 일정에서 시트 지명으로 불러오도록 비워 둔다(처음 고칠 때 함께 저장).
    const sheetRowsOf = (tour: { id: string }) => { const r = tour as Reservation; return r.dailyAccommodations ?? initialAccommodationRows(r).map(row => { const { location, region, ...rest } = row.accommodation; return { ...row, accommodation: rest }; }); };
    // 시트에서 여러 예약을 고친 뒤 한 번에 저장한다. 예약마다 버전을 확인하며 하나라도 실패하면 거기서 멈춘다.
    const saveAll = async () => {
        if (savingRef.current) return;
        setSavingAll(true);
        try {
            for (const id of [...dirtyRef.current]) {
                if (pendingRef.current[id]) continue;
                const row = rowsRef.current.find(r => r.id === id);
                if (!row) continue;
                await save(row);
                if (!mounted.current || dirtyRef.current.has(id)) break;
            }
        } finally { if (mounted.current) setSavingAll(false); }
    };

    // 저장 전 편집과 브라우저 초안을 버리고 마지막으로 받은 서버 배정으로 되돌린다. 서버는 바꾸지 않는다.
    const resetRow = async (r: Reservation) => {
        const saved = savedRows.current.get(r.id);
        if (!saved || savingRef.current || pendingRef.current[r.id]) return;
        if (!await adminConfirm('저장하지 않은 변경 내용을 취소할까요?')) return;
        const result = discardAssignmentDraft(window.localStorage, draftScope(r));
        if (!result.ok) { setNotice(result.error); return; }
        setReservations(prev => prev.map(x => x.id === r.id ? { ...saved, dailyAccommodations: initialAccommodationRows(saved) } : x));
        dirtyRef.current.delete(r.id); setDirty(new Set(dirtyRef.current));
        storedSnapshots.current.delete(r.id);
        setClearedRegions(prev => new Set([...prev].filter(key => !key.startsWith(`${r.id}:`))));
        setNotice('변경 내용을 취소했어요.');
    };

    return (
        <AdminLayout
            activePage="accommodation-ops"
            eyebrow={null}
            title="숙소 배정"
            description="체크인이 가까운 예약부터 숙박별로 배정하고, 숙소 연락 단계까지 한곳에서 확인합니다."
            actions={<AdminSegmented label="보기 방식" items={VIEW_ITEMS} value={view} onChange={setView} />}
        >
            <div className="lo-board">
            {notice && <div className="lo-notice adm-msg" role="status">{notice}</div>}
            {loadWarnings.map((warning, i) => <div key={i} role="alert" className="lo-notice is-warn adm-msg is-cautionary">{warning}</div>)}
            {Object.keys(pendingDrafts).length > 0 && <div className="lo-notice is-draft adm-msg is-cautionary" role="status">복구 가능한 배정 초안 {Object.keys(pendingDrafts).length}건이 있어요. 펼친 예약에서 복원 또는 버리기를 골라 주세요.</div>}

            {view === 'board-view' && <LodgeAssignQueue tours={base} loading={loading} rowsOf={sheetRowsOf} plannedNights={t => getAccommodationPlan(t as Reservation).nights.length}
                lodges={resources.lodges} lodgeRegions={lodgeRegions} resourcesLoading={resourcesLoading} dirty={dirty} pending={pendingDrafts} savingId={savingId}
                clearedAreas={clearedRegions} onAreaCleared={(key, cleared) => setClearedRegions(prev => { const next = new Set(prev); if (cleared) next.add(key); else next.delete(key); return next; })}
                onPatch={patchDay} onPackage={savePackage}
                onSave={id => { const row = rowsRef.current.find(r => r.id === id); if (row) void save(row); }}
                onDiscard={id => { const row = rowsRef.current.find(r => r.id === id); if (row) void resetRow(row); }}
                onResolveDraft={(id, restore) => { const row = rowsRef.current.find(r => r.id === id); if (row) resolveDraft(row, restore); }}
                onAddNight={addSheetNight} onRemoveNight={removeDay} onOpenCard={openDetails} />}
            {view === 'sheet-view' && <LodgeAssignBoard tours={base} loading={loading} rowsOf={sheetRowsOf} plannedNights={t => getAccommodationPlan(t as Reservation).nights.length}
                regionOf={t => regionOf(t as Reservation)} contactOf={t => (t as Reservation).contractData?.travelers?.find(x => x.phone?.trim())?.phone?.trim() || ''}
                serials={serials} lodges={resources.lodges} lodgeRegions={lodgeRegions} resourcesLoading={resourcesLoading} dirty={dirty} pending={pendingDrafts} savingId={savingId} savingAll={savingAll}
                scope={scope} onScope={setScope}
                clearedAreas={clearedRegions} onAreaCleared={(key, cleared) => setClearedRegions(prev => { const next = new Set(prev); if (cleared) next.add(key); else next.delete(key); return next; })}
                onPatch={patchDay} onCategory={patchCategory} onPackage={savePackage}
                onSave={id => { const row = rowsRef.current.find(r => r.id === id); if (row) void save(row); }}
                onSaveAll={() => void saveAll()}
                onResolveDraft={(id, restore) => { const row = rowsRef.current.find(r => r.id === id); if (row) resolveDraft(row, restore); }}
                onAddNight={addSheetNight} onRemoveNight={removeDay}
                onDiscard={id => { const row = rowsRef.current.find(r => r.id === id); if (row) void resetRow(row); }}
                planOf={t => getAccommodationPlan(t as Reservation)}
                onAlignDates={alignDates}
                onAddMissing={id => { const row = rowsRef.current.find(r => r.id === id); if (row) addMissingNights(row); }}
                detailOf={t => tourDetailOf(t as Reservation)}
                focus={focus} />}
            </div>
        </AdminLayout>
    );
};
