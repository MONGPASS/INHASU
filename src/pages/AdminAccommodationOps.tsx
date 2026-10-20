import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useSearchParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { productCustomerHref, quoteCustomerHref } from '../utils/customerWorkspaceRoutes';
import type { AssignmentSource } from '../utils/reservationAssignment';
import { assignmentFingerprint, editorAssignment, writeAssignmentDraft, readAssignmentDraft, discardAssignmentDraft, type AssignmentDraft, type AssignmentDraftResult } from '../utils/adminAssignmentDraft';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { calendarDateKey } from '../utils/adminTourCalendar';
import { lodgingPeriod, lodgingSummary, materializeLodgingDays, resetLodgingConfirmation, isCancelledLodgingBooking, isConfirmedLodgingBooking } from '../utils/lodgingOperations';
import { readAccommodationReturnTo } from '../utils/accommodationOpsRoutes';
import { loadRegisteredAssignmentResources } from '../utils/registeredAssignmentResources';
import { AccommodationClassicView } from '../components/admin/AccommodationClassicView';
import './AdminAccommodationOps.css';

/**
 * 현지 숙소 담당자를 위한 통합 수배 보드.
 * 팀별 숙박·객실·인실·업체 확정 상태를 한국어로 표시한다.
 * 상태·인실의 기존 저장 값은 유지하고 표시 라벨만 번역한다.
 */

export interface DailyAcc {
    day: number;
    sourceIndex?: number;
    sourceKey?: string;
    date?: string; // 직접 편집 가능한 날짜(yyyy-mm-dd). 없으면 startDate 기준 자동
    accommodation: {
        id?: string;
        name?: string;
        type?: string;
        location?: string;
        address?: string;
        images?: string[];
        description?: string;
        facilities?: string[];
        roomCount?: number | null;
        occupancy?: string;
        bookingStatus?: string;
    };
}
interface Traveler { name?: string; passportName?: string; birthdate?: string; gender?: string; phone?: string }
interface Flight { date?: string; time?: string; flight?: string }
export interface Reservation {
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
    assignedGuide?: { id?: string; name?: string; phone?: string; image?: string; kakaoId?: string; languages?: string[]; specialties?: string[] };
    contractData?: {
        region?: string; category?: string;
        travelers?: Traveler[];
        arrival?: Flight; departure?: Flight;
        agreement?: { agreed?: boolean; name?: string; agreedAt?: string };
        vehicle?: { type?: string; phone?: string };
    };
}

const nightsOf = (r: Reservation) => lodgingPeriod(r).nights;
const todayKey = () => calendarDateKey(new Date());
const isPastTour = (r: Reservation, today: string) => !!calendarDateKey(r.endDate) && calendarDateKey(r.endDate) < today;
const isoOffset = (start?: string, offset = 0) => {
    const key = calendarDateKey(start);
    return key ? new Date(Date.parse(key + 'T00:00:00Z') + offset * 86400000).toISOString().slice(0, 10) : '';
};
const regionOf = (r: Reservation) => r.contractData?.region || r.contractData?.category || '지역 미정';
const summaryOf = (r: Reservation) => { const s = lodgingSummary(r); return { ...s, total: s.expected,
    label: !s.valid ? '날짜 확인 필요' : s.notRequired ? '숙박 없음' : s.allConfirmed ? '업체 확정' : s.assigned > 0 ? '수배 진행 중' : '미배정' }; };

export const AdminAccommodationOps: React.FC = () => {
    const { user, loading } = useUser();
    if (loading || !user || user.role !== 'admin') return <AdminLayout activePage="accommodation-ops" title="숙소 배정 · 현지 운영"><div className="empty">관리자 계정을 확인하고 있습니다.</div></AdminLayout>;
    return <AccommodationBoard key={user.id} userId={user.id} />;
};

function fromApi(item: any): Reservation {
    return { ...item, bookingId: item.id, id: item.key, assignedGuide: item.assignment.guide,
        dailyAccommodations: item.accommodationsInitialized === false ? undefined : item.assignment.accommodations, contractData: { ...item.contractData, vehicle: item.assignment.vehicle } };
}
async function assignmentRequest(path = '', options: RequestInit = {}) {
    const response = await fetch(`/api/admin/assignments${path}`, { credentials: 'same-origin', cache: 'no-store', ...options });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || '배정 정보를 불러오지 못했습니다.');
    return body;
}

const AccommodationBoard: React.FC<{ userId: string }> = ({ userId }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialParams = useRef(new URLSearchParams(searchParams));
    const returnTo = readAccommodationReturnTo(searchParams.get('returnTo'), '');
    const [reservations, setReservationsState] = useState<Reservation[]>([]);
    const rowsRef = useRef<Reservation[]>([]), dirtyRef = useRef(new Set<string>());
    const mounted = useRef(true), savingRef = useRef<string | null>(null), generation = useRef(0);
    const storedSnapshots = useRef(new Map<string, string>());
    const savedLodgingRows = useRef(new Map<string, DailyAcc[]>());
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

    const [q, setQ] = useState(initialParams.current.get('q') || '');
    const [month, setMonth] = useState(initialParams.current.get('month') || 'all');
    const [year, setYear] = useState(() => /^\d{4}-\d{2}$/.test(initialParams.current.get('month') || '') ? Number(initialParams.current.get('month')!.slice(0, 4)) : new Date().getFullYear());
    const [region, setRegion] = useState(initialParams.current.get('region') || 'all');
    const [confirmFilter, setConfirmFilter] = useState<'all' | 'pending' | 'done' | 'missing'>(['pending', 'done', 'missing'].includes(initialParams.current.get('state') || '') ? initialParams.current.get('state') as 'pending' | 'done' | 'missing' : 'all');
    const [scope, setScope] = useState<'confirmed' | 'all' | 'check'>(initialParams.current.get('scope') === 'check' ? 'check' : initialParams.current.get('scope') === 'all' ? 'all' : 'confirmed');
    const [includePast, setIncludePast] = useState(initialParams.current.get('past') === '1');
    const [selectedKey, setSelectedKey] = useState(initialParams.current.get('open') ? `${initialParams.current.get('source') || 'product'}:${initialParams.current.get('open')}` : '');
    const [lodgeResources, setLodgeResources] = useState<any[]>([]);
    const [catalogWarning, setCatalogWarning] = useState('');
    // 등록 목록에 없는 숙소를 직접 입력 중인 칸 (key = `${reservationId}:${dayIndex}`)
    const [manualHotels, setManualHotels] = useState<Set<string>>(new Set());

    const draftScope = useCallback((r: Reservation) => ({ userId, source: r.source, id: r.bookingId }), [userId]);
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
            for (const row of arr) if (!failedSource(row.source)) savedLodgingRows.current.set(row.id, structuredClone(row.dailyAccommodations || []));
            setReservations(arr);
            setExpanded(prev => new Set([...Object.keys(nextPending), ...[...prev].filter(id => arr.some(r => r.id === id && failedSource(r.source)))]));
            setLoadWarnings(data.warnings || []);
        } catch (e) {
            if (mounted.current && requestGeneration === generation.current) setLoadWarnings([e instanceof Error ? e.message : '예약을 불러오지 못했습니다. 이전 자료를 유지합니다.']);
        } finally {
            if (mounted.current && requestGeneration === generation.current) setLoading(false);
        }
    };
    useEffect(() => { load(); }, []);
    useEffect(() => {
        const controller = new AbortController();
        loadRegisteredAssignmentResources({ accountId: userId, signal: controller.signal, isCurrent: () => mounted.current, kinds: ['lodges'] })
            .then(value => { if (!controller.signal.aborted) { setLodgeResources(value.lodges); setCatalogWarning(value.warnings.join(' ')); } })
            .catch(error => { if (error?.name !== 'AbortError' && !controller.signal.aborted) setCatalogWarning('등록 숙소 목록을 불러오지 못했습니다. 다시 확인해 주세요.'); });
        return () => controller.abort();
    }, [userId]);
    const hotelOptions = useMemo(() => lodgeResources.map(h => ({ ...h, key: 'lodge:' + h.id })).filter(h => h.name), [lodgeResources]);
    const needsRepair = (r: Reservation) => isCancelledLodgingBooking(r) || !lodgingPeriod(r).valid || lodgingSummary(r).issues.length > 0;
    const base = useMemo(() => reservations.filter(r => scope === 'check' ? needsRepair(r)
        : !isCancelledLodgingBooking(r) && lodgingPeriod(r).valid && (scope === 'all' || isConfirmedLodgingBooking(r)) && (scope === 'all' || nightsOf(r) > 0)), [reservations, scope]);
    const checkCount = reservations.filter(needsRepair).length;
    const regionOptions = useMemo(() => [...new Set(base.map(regionOf))].sort(), [base]);
    const beforeMonth = useMemo(() => {
        const needle = q.trim().toLowerCase(), today = todayKey();
        return base.filter(r => {
            if (scope !== 'check' && !includePast && isPastTour(r, today)) return false;
            if (region !== 'all' && regionOf(r) !== region) return false;
            return !needle || [r.customerName,r.productName,r.reservationNumber,regionOf(r),...(r.dailyAccommodations || []).map(d => d.accommodation?.name)].some(value => value?.toLowerCase().includes(needle));
        });
    }, [base,q,region,includePast,scope]);
    const matching = useMemo(() => beforeMonth.filter(r => {
        const period = lodgingPeriod(r);
        return month === 'all' || !period.valid || period.startDate.slice(0, 7) <= month && period.endDate.slice(0, 7) >= month;
    }), [beforeMonth,month]);
    const filtered = useMemo(() => matching.filter(r => {
        const summary = summaryOf(r);
        return confirmFilter === 'all' || confirmFilter === 'done' && (summary.allConfirmed || summary.notRequired)
            || confirmFilter === 'pending' && !summary.allConfirmed && !summary.notRequired
            || confirmFilter === 'missing' && summary.missing > 0;
    }).sort((a,b) => Number(isPastTour(a,todayKey())) - Number(isPastTour(b,todayKey())) || Number(summaryOf(a).allConfirmed) - Number(summaryOf(b).allConfirmed)
        || (a.startDate || '').localeCompare(b.startDate || '') || a.id.localeCompare(b.id)), [matching,confirmFilter]);
    useEffect(() => {
        const next = new URLSearchParams(searchParams);
        next.delete('view'); next.delete('product');
        for (const [key,value,empty] of [['q',q,''],['month',month,'all'],['region',region,'all'],['state',confirmFilter,'all'],['scope',scope,'confirmed'],['past',includePast?'1':'','']] as const) {
            if (value === empty) next.delete(key); else next.set(key,value);
        }
        if (selectedKey) { const row = reservations.find(r => r.id === selectedKey); if (row) { next.set('open',row.bookingId); next.set('source',row.source); } }
        if (next.toString() !== searchParams.toString()) setSearchParams(next,{replace:true});
    },[q,month,region,confirmFilter,scope,includePast,selectedKey,reservations,searchParams,setSearchParams]);

    // ── 펼침/구체화 ──
    const openRow = (r: Reservation, day?: number) => {
        // 목록에서는 원래 저장된 행만 펼친다. 특정 숙박일 링크는 그 빈 밤만 편집용으로 연다.
        if (day && Number.isInteger(day) && lodgingSummary(r).slots.some(slot => slot.day === day && slot.rowIndex === null)) {
            const rows = r.dailyAccommodations || [];
            const requested = materializeLodgingDays(r).slice(rows.length).find(row => row.day === day);
            if (requested) setReservations(prev => prev.map(x => x.id === r.id ? { ...x, dailyAccommodations: [...rows,requested] } : x));
        }
        setExpanded(prev => new Set(prev).add(r.id));
        setSelectedKey(r.id);
    };
    const toggleExpand = (r: Reservation) => expanded.has(r.id) ? setExpanded(prev => { const n = new Set(prev); n.delete(r.id); return n; }) : openRow(r);

    // ?open=<reservationId> — 예약 상세의 「숙소 보드에서 수배 관리」 링크로 진입 시 해당 예약을 자동 펼침
    const openedFromUrl = useRef(!initialParams.current.get('open'));
    useEffect(() => {
        if (openedFromUrl.current || reservations.length === 0) return;
        const id = initialParams.current.get('open');
        if (!id) return;
        const source = initialParams.current.get('source') || 'product';
        const target = reservations.find(x => x.bookingId === id && x.source === source);
        if (!target) return;
        openedFromUrl.current = true;
        // 돌아온 보드의 필터는 유지하고, 진입한 팀이 숨겨진 경우에만 표시 범위를 넓힌다.
        if (!filtered.some(row => row.id === target.id)) {
            setQ(''); setMonth('all'); setRegion('all'); setConfirmFilter('all'); setIncludePast(true);
            if (needsRepair(target)) setScope('check'); else setScope('all');
        }
        const requestedDay = Number(initialParams.current.get('day'));
        openRow(target, requestedDay);
        window.setTimeout(() => {
            if (!mounted.current) return;
            const night = Number.isInteger(requestedDay) && requestedDay > 0
                ? document.getElementById(`lodging-night-${encodeURIComponent(target.id)}-${requestedDay}`)
                : null;
            (night || document.getElementById(`acc-row-${target.id}`))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
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
        return () => { flushDrafts(false); mounted.current = false; generation.current++; window.removeEventListener('beforeunload', h); window.removeEventListener('pagehide', hide); document.removeEventListener('click', navigating, true); };
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
        }
        const next = { ...pendingRef.current }; delete next[row.id]; pendingRef.current = next; setPendingDrafts(next);
        setNotice(restore ? '초안을 복원했습니다. 확인 후 저장해야 서버에 반영됩니다.' : '초안을 버리고 현재 서버 정보를 유지합니다.');
    };
    // 날짜 정렬은 표시 순서만 바꾸며 기존 박 번호·확정 상태를 유지한다.
    const sortDays = (rId: string) => {
        if (savingRef.current || pendingRef.current[rId]) return;
        let changed = false;
        setReservations(prev => prev.map(r => {
            if (r.id !== rId) return r;
            const rows = [...(r.dailyAccommodations || [])];
            rows.sort((a,b) => (calendarDateKey(a.date) || isoOffset(r.startDate,a.day-1)).localeCompare(calendarDateKey(b.date) || isoOffset(r.startDate,b.day-1)) || a.day-b.day);
            changed = rows.some((row,index) => row !== r.dailyAccommodations?.[index]);
            return changed ? { ...r, dailyAccommodations: rows } : r;
        }));
        if (changed) {
            setManualHotels(previous => new Set([...previous].filter(key => !key.startsWith(`${rId}:`))));
            markDirty(rId);
        }
    };
    // 인덱스 기준 편집(일차 번호·날짜를 직접 수정해도 안전)
    const patchDay = (rId: string, idx: number, patch: Partial<DailyAcc['accommodation']>) => {
        if (savingRef.current || pendingRef.current[rId]) return;
        setReservations(prev => prev.map(r => {
            if (r.id !== rId) return r;
            const rows = (r.dailyAccommodations || []).map((d, i) => i === idx ? resetLodgingConfirmation(d, { ...d, accommodation: { ...d.accommodation, ...patch } }, r.startDate) : d);
            return { ...r, dailyAccommodations: rows };
        }));
        markDirty(rId);
    };
    // 일차(번호)·날짜 직접 편집
    const patchDayMeta = (rId: string, idx: number, patch: { day?: number; date?: string }) => {
        if (savingRef.current || pendingRef.current[rId]) return;
        setReservations(prev => prev.map(r => {
            if (r.id !== rId) return r;
            const rows = (r.dailyAccommodations || []).map((d, i) => i === idx ? resetLodgingConfirmation(d, { ...d, ...patch }, r.startDate) : d);
            return { ...r, dailyAccommodations: rows };
        }));
        markDirty(rId);
    };
    const addDay = (row: Reservation) => {
        if (savingRef.current || pendingRef.current[row.id]) return;
        const oldRows = row.dailyAccommodations || [];
        const next = materializeLodgingDays(row)[oldRows.length];
        if (!next) return;
        setReservations(prev => prev.map(r => r.id === row.id ? { ...r, dailyAccommodations: [...oldRows,next] } : r));
        markDirty(row.id);
    };
    const removeDay = (rId: string, idx: number) => {
        if (savingRef.current || pendingRef.current[rId]) return;
        setManualHotels(previous => new Set([...previous].filter(key => !key.startsWith(`${rId}:`))));
        setReservations(prev => prev.map(r => {
            if (r.id !== rId) return r;
            const rows = (r.dailyAccommodations || []).filter((_, i) => i !== idx);
            return { ...r, dailyAccommodations: rows };
        }));
        markDirty(rId);
    };
    const populateNights = (row: Reservation) => {
        if (savingRef.current || pendingRef.current[row.id]) return;
        setReservations(prev => prev.map(r => r.id === row.id ? { ...r, dailyAccommodations: materializeLodgingDays(r) } : r));
        markDirty(row.id);
    };
    // 담당 가이드(assignedGuide)·차량(contractData.vehicle) 편집 — 기존 컬럼에 저장(마이그레이션 불필요)
    const patchGuide = (rId: string, patch: { name?: string; phone?: string }) => {
        if (savingRef.current || pendingRef.current[rId]) return;
        setReservations(prev => prev.map(r => r.id === rId ? { ...r, assignedGuide: { ...(r.assignedGuide || {}), ...(patch.name !== undefined && patch.name !== r.assignedGuide?.name ? { id: '' } : {}), ...patch } } : r));
        markDirty(rId);
    };
    const patchVehicle = (rId: string, patch: { type?: string; phone?: string }) => {
        if (savingRef.current || pendingRef.current[rId]) return;
        setReservations(prev => prev.map(r => r.id === rId
            ? { ...r, contractData: { ...(r.contractData || {}), vehicle: { ...(r.contractData?.vehicle || {}), ...patch } } }
            : r));
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
            savedLodgingRows.current.set(r.id, structuredClone(fromApi(data.item).dailyAccommodations || []));
            setReservations(prev => prev.map(x => x.id === r.id ? fromApi(data.item) : x));
            dirtyRef.current.delete(r.id); setDirty(new Set(dirtyRef.current));
            storedSnapshots.current.delete(r.id);
            const result = local.ok && local.revision ? discardAssignmentDraft(window.localStorage, draftScope(r), local.revision) : { ok: true } as const;
            setNotice(!local.ok ? '서버 저장은 완료했습니다. 다만 브라우저 초안 저장소를 확인해 주세요. ' + local.error : result.ok ? '배정 정보를 저장했습니다.' : result.error);
        } catch (e: any) {
            if (mounted.current && requestGeneration === generation.current) setNotice((e?.message || '저장하지 못했습니다.') + (local.ok ? ' 변경 내용과 브라우저 초안을 유지합니다.' : ' 화면의 변경 내용은 유지합니다. ' + local.error));
        } finally {
            if (mounted.current && requestGeneration === generation.current) { savingRef.current = null; setSavingId(null); }
        }
    };

    const openTeam = (r: Reservation, day?: number) => {
        if (!filtered.some(row => row.id === r.id)) {
            setQ(''); setMonth('all'); setRegion('all'); setConfirmFilter('all'); setIncludePast(true);
            setScope(needsRepair(r) ? 'check' : 'all');
        }
        openRow(r,day);
        requestAnimationFrame(() => document.getElementById(day ? `lodging-night-${encodeURIComponent(r.id)}-${day}` : `acc-row-${r.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    };
    const customerHref = (r: Reservation) => {
        const boardParams = new URLSearchParams(searchParams);
        const parentReturnTo = readAccommodationReturnTo(boardParams.get('returnTo'), '');
        if (!/^\/admin\/(calendar|reservations)(\?|$)/.test(parentReturnTo)) boardParams.delete('returnTo');
        const back = `/admin/accommodation-ops?${boardParams}`;
        return r.source === 'quote_booking' ? quoteCustomerHref(r.bookingId, back) : productCustomerHref(r.bookingId, back);
    };
    const chooseHotel = (r: Reservation, index: number, key: string) => {
        if (savingRef.current || pendingRef.current[r.id]) return;
        const option = hotelOptions.find(hotel => hotel.key === key);
        if (key === '__manual__') { setManualHotels(previous => new Set(previous).add(`${r.id}:${index}`)); return; }
        setManualHotels(previous => { const next=new Set(previous); next.delete(`${r.id}:${index}`); return next; });
        if (key === '__saved__') return;
        patchDay(r.id,index,{ id:option?.id || '', name:option?.name || '', type:option?.type || option?.grade || '', location:option?.location || '',
            address:option?.address || '',
            images:option?.images || [], description:option?.description || '', facilities:option?.facilities || [], bookingStatus:'Илгээгээгүй' });
    };
    const resetFilters = () => { setQ(''); setMonth('all'); setYear(new Date().getFullYear()); setRegion('all'); setConfirmFilter('all'); setScope('confirmed'); setIncludePast(false); };
    return <AdminLayout activePage="accommodation-ops" title="숙소 배정 · 현지 운영"
        actions={<>{returnTo && <a className="btn btn-ghost" href={returnTo}><Icon name="arrow_back" />이전 화면</a>}<button type="button" className="btn btn-ghost" onClick={load} disabled={loading || !!savingId}><Icon name="refresh" />새로고침</button></>}>
        <AccommodationClassicView items={filtered} monthItems={beforeMonth} allItems={reservations}
            q={q} month={month} year={year} region={region} scope={scope} state={confirmFilter} regions={regionOptions} includePast={includePast}
            checkCount={checkCount} loading={loading} notice={notice} warnings={loadWarnings} catalogWarning={catalogWarning}
            pending={pendingDrafts} expanded={expanded} dirty={dirty} selectedKey={selectedKey} savingId={savingId} choices={hotelOptions} manual={manualHotels}
            onQ={setQ} onMonth={setMonth} onYear={next => { setYear(next); if (month !== 'all') setMonth(String(next) + month.slice(4)); }} onRegion={setRegion} onScope={setScope} onState={setConfirmFilter} onPast={setIncludePast} onReset={resetFilters}
            onToggle={toggleExpand} onOpen={openTeam} customerHref={customerHref} onSave={save} onResolve={resolveDraft}
            onPatch={patchDay} onMeta={patchDayMeta} onChoose={chooseHotel} onRemove={removeDay} onAdd={addDay} onPopulate={populateNights} onSort={sortDays}
            onGuide={patchGuide} onVehicle={patchVehicle}
            requestChanged={(r,d) => { const previous=savedLodgingRows.current.get(r.id)?.find(row=>row.day===d.day); return !!previous && resetLodgingConfirmation(previous,d,r.startDate)!==d; }} />
    </AdminLayout>;
};
