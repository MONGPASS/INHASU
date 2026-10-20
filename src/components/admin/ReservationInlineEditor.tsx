import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { reservationDraftFingerprint, readReservationDraft, writeReservationDraft, discardReservationDraft, finishReservationDraftSave, type ReservationDraftSnapshot, type ReservationDraftScope, type ReservationDraftResult, type ReservationLocalDraft } from '../../utils/adminReservationDraft';
import type { ReservationDocContent } from './ReservationDocumentEditor';
import type { Activity, DocumentSettings, TemplateDay } from '../../pages/AdminTemplateManage';
import { createInlineDocument, applyQuoteSnippet, quoteDayFields, updateQuoteDay, fillQuoteDayDates } from '../../utils/reservationInline';
import { uploadImage } from '../../utils/upload';
import { QuoteDayEditor } from './QuoteDayEditor';
import { QuoteSpotSelector, toggleRepresentativeSpot } from './QuoteSpotSelector';
import { ReservationDraftPreview } from './ReservationDraftPreview';
import type { ReservationPreviewContext } from '../../utils/reservationDraftPreview';

export interface ReservationInlineEditorControl {
    prepareLeave: (reason?: 'close' | 'refresh') => boolean;
    isBusy: () => boolean;
    flush: (notify?: boolean) => ReservationDraftResult;
    getState: () => { dirty: boolean; busy: boolean };
    preview: (kind?: 'itinerary' | 'contract') => void;
}

export interface ReservationInlineEditorStatus {
    dirty: boolean;
    busy: boolean;
    locked: boolean;
    message: string;
    failed: boolean;
}

interface Props {
    adminUserId?: string | null;
    onControlChange?: (control: ReservationInlineEditorControl | null) => void;
    reservationId: string;
    initialContent: ReservationDocContent;
    mode: 'itinerary' | 'contract';
    onModeChange?: (mode: 'itinerary' | 'contract') => void;
    startDate: string;
    endDate: string;
    dailyAccommodations?: Array<{ day: number; accommodation: { name: string } }>;
    onSave: (content: ReservationDocContent, dates: { startDate: string; endDate: string }, kind: 'itinerary' | 'contract') => Promise<boolean | void>;
    onDirtyChange: (dirty: boolean) => void;
    onBusyChange?: (busy: boolean) => void;
    onDraftStatusChange?: (pending: boolean) => void;
    onClose: () => void;
    disabled?: boolean;
    externalBusy?: boolean;
    /** The customer work toolbar supplies the save, preview, and return actions. */
    externalActions?: boolean;
    onStatusChange?: (status: ReservationInlineEditorStatus) => void;
    requestedDay?: number;
    requestedDayRevision?: number;
    previewContext?: ReservationPreviewContext;
}

interface Libraries {
    snippets: Record<string, any>;
    snippet_cats: string[];
    spots: Record<string, any>;
    spot_cats: string[];
}

const emptyLibraries = (): Libraries => ({ snippets: {}, snippet_cats: [], spots: {}, spot_cats: [] });
const photoList = (value: unknown): string[] => Array.isArray(value) ? value.filter(item => typeof item === 'string' && item) : [];
const cloneContent = (content: ReservationDocContent) => createInlineDocument(content, null, content.name);
const renumber = (days: TemplateDay[]) => days.map((day, index) => ({ ...day, day: index + 1 }));

/** 일정과 계약 조건을 현재 예약 상세 본문 안에서 편집한다. */
export function ReservationInlineEditor(p: Props) {
    const editorRef = useRef<HTMLElement>(null);
    const [draft, setDraftState] = useState(() => cloneContent(p.initialContent));
    const [dates, setDatesState] = useState({ startDate: p.startDate, endDate: p.endDate });
    const [activeMode, setActiveMode] = useState(p.mode);
    const [tripSettingsOpen, setTripSettingsOpen] = useState(!p.initialContent.name || !p.startDate || !p.endDate);
    useEffect(() => {
        if (p.externalActions && (!draft.name || !dates.startDate || !dates.endDate)) setTripSettingsOpen(true);
    }, [p.externalActions, draft.name, dates.startDate, dates.endDate]);
    useEffect(() => {
        if (p.externalActions) editorRef.current?.closest<HTMLElement>('.reservation-workspace-body')?.scrollTo({ top: 0 });
    }, [p.externalActions, activeMode]);
    const [initialBaseline] = useState<ReservationDraftSnapshot>(() => ({ content: cloneContent(p.initialContent), dates: { startDate: p.startDate, endDate: p.endDate } }));
    const baselineRef = useRef(initialBaseline);
    const contentRef = useRef(draft);
    const datesRef = useRef(dates);
    const modeRef = useRef(p.mode);
    const mountedRef = useRef(true);
    const savingRef = useRef(false);
    const uploadingRef = useRef(false);
    const disabledRef = useRef(!!p.disabled);
    disabledRef.current = !!p.disabled;
    const externalBusyRef = useRef(!!p.externalBusy);
    externalBusyRef.current = !!p.externalBusy;
    const callbacks = useRef(p);
    callbacks.current = p;
    const scopeRef = useRef<ReservationDraftScope | null>(null);
    const readyRef = useRef(false);
    const pendingRef = useRef(false);
    const ownedRevision = useRef<string | null>(null);
    const storedDraftPendingRef = useRef(false);
    const [storedDraftPending, setStoredDraftPending] = useState(false);
    const lastStoredFingerprint = useRef('');
    const baseFingerprint = useRef(reservationDraftFingerprint(initialBaseline));
    const acceptedSourceFingerprint = useRef<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [draftReady, setDraftReady] = useState(false);
    const [pendingDraft, setPendingDraft] = useState<{ draft: ReservationLocalDraft; conflict: boolean } | null>(null);
    const [invalidDraft, setInvalidDraft] = useState(false);
    const [savedAt, setSavedAt] = useState<string | null>(null);
    const [draftError, setDraftError] = useState('');
    const [sourceConflict, setSourceConflict] = useState(false);
    const [notice, setNotice] = useState('');
    const [noticeFailed, setNoticeFailed] = useState(false);
    const [libraries, setLibraries] = useState<Libraries>(emptyLibraries);
    const [libraryLoading, setLibraryLoading] = useState(true);
    const [libraryError, setLibraryError] = useState('');
    const [libraryAttempt, setLibraryAttempt] = useState(0);
    const [preview, setPreview] = useState<{ content: ReservationDocContent; dates: { startDate: string; endDate: string }; mode: 'itinerary' | 'contract' } | null>(null);
    const incomingSnapshot = { content: p.initialContent, dates: { startDate: p.startDate, endDate: p.endDate } };
    const incomingFingerprint = reservationDraftFingerprint(incomingSnapshot);
    const latestSourceFingerprint = useRef(incomingFingerprint);
    latestSourceFingerprint.current = incomingFingerprint;
    const fingerprint = useMemo(() => reservationDraftFingerprint({ content: draft, dates }), [draft, dates]);
    const dirty = fingerprint !== reservationDraftFingerprint(baselineRef.current);
    const appliedFingerprint = useRef(incomingFingerprint);
    const locked = !!p.disabled || !!p.externalBusy || saving || uploading || !draftReady || !!pendingDraft || invalidDraft;
    const statusMessage = uploading ? '사진 업로드 중입니다…' : saving ? '문서를 저장하고 있습니다…'
        : pendingDraft ? '보관된 초안을 복원하거나 버린 뒤 편집하세요.'
        : invalidDraft ? '보관된 초안을 확인하고 정리해 주세요.'
        : !draftReady ? '관리자 계정과 문서를 확인하고 있습니다.'
        : draftError || notice || (sourceConflict ? '서버 문서가 변경되었습니다. 현재 초안은 유지됩니다.'
            : dirty ? '변경사항을 저장하세요.' : '현재 저장된 문서를 편집합니다.');
    const statusFailed = noticeFailed || !!draftError || invalidDraft;
    const isBusy = useCallback(() => savingRef.current || uploadingRef.current || externalBusyRef.current, []);
    const isLocked = () => disabledRef.current || isBusy() || !readyRef.current || pendingRef.current;
    const showDraftPreview = useCallback((kind?: 'itinerary' | 'contract') => {
        if (isBusy() || !readyRef.current || pendingRef.current) return;
        setPreview({ content: cloneContent(contentRef.current), dates: { ...datesRef.current }, mode: kind || modeRef.current });
    }, [isBusy]);

    const setDraft = (change: ReservationDocContent | ((current: ReservationDocContent) => ReservationDocContent)) => {
        if (!mountedRef.current || savingRef.current) return;
        const next = typeof change === 'function' ? change(contentRef.current) : change;
        contentRef.current = next;
        setDraftState(next);
    };
    const setDates = (change: { startDate: string; endDate: string } | ((current: { startDate: string; endDate: string }) => { startDate: string; endDate: string })) => {
        if (!mountedRef.current || savingRef.current) return;
        const next = typeof change === 'function' ? change(datesRef.current) : change;
        datesRef.current = next;
        setDatesState(next);
    };
    const flushDraft = useCallback((notify = true): ReservationDraftResult => {
        if (!readyRef.current || pendingRef.current) return { ok: true };
        const snapshot = { content: contentRef.current, dates: datesRef.current };
        const current = reservationDraftFingerprint(snapshot);
        if (current === reservationDraftFingerprint(baselineRef.current) || current === lastStoredFingerprint.current) return { ok: true };
        if (!scopeRef.current) return { ok: false, error: '관리자 계정과 예약을 확인할 수 없어 문서 초안을 보관하지 못했습니다.' };
        let result: ReservationDraftResult;
        try { result = writeReservationDraft(window.localStorage, scopeRef.current, snapshot, baseFingerprint.current, modeRef.current); }
        catch { result = { ok: false, error: '브라우저 저장소를 사용할 수 없어 문서 초안을 보관하지 못했습니다.' }; }
        if (result.ok) {
            lastStoredFingerprint.current = current;
            if (result.revision) ownedRevision.current = result.revision;
            storedDraftPendingRef.current = true;
            if (mountedRef.current) callbacks.current.onDraftStatusChange?.(true);
            if (notify && mountedRef.current) { setSavedAt(result.savedAt || null); setDraftError(''); setStoredDraftPending(true); }
        } else if (notify && mountedRef.current) setDraftError(result.error);
        return result;
    }, []);

    useEffect(() => {
        if (!p.adminUserId || scopeRef.current) return;
        const scope = { userId: p.adminUserId, reservationId: p.reservationId };
        scopeRef.current = scope;
        let loaded: ReturnType<typeof readReservationDraft>;
        try { loaded = readReservationDraft(window.localStorage, scope, baselineRef.current); }
        catch { loaded = { kind: 'unavailable', error: '브라우저 저장소를 사용할 수 없어 문서 초안을 보관하지 못했습니다.' }; }
        if (loaded.kind === 'draft') {
            pendingRef.current = true;
            setPendingDraft({ draft: loaded.draft, conflict: loaded.conflict });
            setSavedAt(loaded.draft.savedAt);
            ownedRevision.current = loaded.draft.revision;
            storedDraftPendingRef.current = true; setStoredDraftPending(true);
        } else if (loaded.kind === 'invalid') {
            pendingRef.current = true;
            setInvalidDraft(true); setDraftError(loaded.error);
        } else if (loaded.kind === 'unavailable') setDraftError(loaded.error);
        readyRef.current = true; setDraftReady(true);
    }, [p.adminUserId, p.reservationId]);

    useEffect(() => {
        if (isBusy()) return;
        modeRef.current = p.mode; setActiveMode(p.mode);
    }, [p.mode, saving, uploading, isBusy]);
    useEffect(() => {
        if (!draftReady || saving || uploading) return;
        if (pendingRef.current) {
            if (pendingDraft && reservationDraftFingerprint(pendingDraft.draft) === incomingFingerprint) {
                pendingRef.current = false; ownedRevision.current = null; storedDraftPendingRef.current = false;
                setPendingDraft(null); setStoredDraftPending(false); callbacks.current.onDraftStatusChange?.(false);
            }
            // A fresh booking fetch can finish while the recovery choice is open.
            if (appliedFingerprint.current !== incomingFingerprint) {
                const fresh = { content: cloneContent(p.initialContent), dates: { startDate: p.startDate, endDate: p.endDate } };
                baselineRef.current = structuredClone(fresh);
                contentRef.current = fresh.content; datesRef.current = fresh.dates;
                setDraftState(fresh.content); setDatesState(fresh.dates);
                appliedFingerprint.current = incomingFingerprint;
                setPendingDraft(current => current ? { ...current, conflict: current.draft.baseFingerprint !== incomingFingerprint } : null);
            }
            return;
        }
        if (dirty) { setSourceConflict(incomingFingerprint !== baseFingerprint.current); return; }
        if (appliedFingerprint.current === incomingFingerprint) return;
        const next = { content: cloneContent(p.initialContent), dates: { startDate: p.startDate, endDate: p.endDate } };
        const changed = reservationDraftFingerprint(next) !== fingerprint;
        baselineRef.current = structuredClone(next);
        baseFingerprint.current = incomingFingerprint;
        appliedFingerprint.current = incomingFingerprint;
        contentRef.current = next.content; datesRef.current = next.dates;
        setDraftState(next.content); setDatesState(next.dates); setSourceConflict(false);
        if (changed) setNotice('');
    }, [incomingFingerprint, fingerprint, dirty, draftReady, saving, uploading]);
    useEffect(() => {
        if (!dirty || !draftReady || pendingDraft || invalidDraft || saving) return;
        const timer = window.setTimeout(() => flushDraft(), 650);
        return () => window.clearTimeout(timer);
    }, [fingerprint, dirty, draftReady, pendingDraft, invalidDraft, saving, flushDraft]);
    useEffect(() => { p.onDirtyChange(dirty); }, [dirty, p.onDirtyChange]);
    useEffect(() => { p.onDraftStatusChange?.(!!pendingDraft || dirty || storedDraftPending); }, [pendingDraft, dirty, storedDraftPending, p.onDraftStatusChange]);
    useEffect(() => { p.onBusyChange?.(saving || uploading); }, [saving, uploading, p.onBusyChange]);
    useEffect(() => {
        callbacks.current.onStatusChange?.({ dirty, busy: saving || uploading, locked, message: statusMessage, failed: statusFailed });
    }, [dirty, saving, uploading, locked, statusMessage, statusFailed]);

    const prepareLeave = useCallback((reason: 'close' | 'refresh' = 'close') => {
        if (isBusy()) { setNotice('저장 또는 사진 업로드가 끝난 뒤 이동해 주세요.'); setNoticeFailed(true); return false; }
        const result = flushDraft();
        if (!result.ok && !window.confirm(result.error + '\n\n초안을 보관하지 못한 상태로 계속할까요?')) return false;
        return true;
    }, [flushDraft, isBusy]);
    useLayoutEffect(() => {
        mountedRef.current = true;
        callbacks.current.onControlChange?.({ prepareLeave, isBusy, flush: flushDraft, preview: showDraftPreview, getState: () => ({ dirty: reservationDraftFingerprint({ content: contentRef.current, dates: datesRef.current }) !== reservationDraftFingerprint(baselineRef.current), busy: isBusy() }) });
        return () => {
            flushDraft(false); mountedRef.current = false;
            let remains = storedDraftPendingRef.current;
            try {
                if (scopeRef.current) {
                    const saved = readReservationDraft(window.localStorage, scopeRef.current, { content: callbacks.current.initialContent, dates: { startDate: callbacks.current.startDate, endDate: callbacks.current.endDate } });
                    if (saved.kind !== 'unavailable') remains = saved.kind === 'draft';
                }
            } catch { /* Keep the last known valid copy when storage access is temporarily blocked. */ }
            callbacks.current.onDraftStatusChange?.(remains);
            callbacks.current.onControlChange?.(null);
            callbacks.current.onBusyChange?.(false);
            callbacks.current.onDirtyChange(false);
        };
    }, [flushDraft, prepareLeave, isBusy]);

    const restoreLocalDraft = () => {
        if (!pendingDraft || isBusy() || disabledRef.current) return;
        const saved = pendingDraft.draft;
        contentRef.current = structuredClone(saved.content); datesRef.current = structuredClone(saved.dates);
        setDraftState(contentRef.current); setDatesState(datesRef.current);
        baseFingerprint.current = saved.baseFingerprint;
        lastStoredFingerprint.current = reservationDraftFingerprint(saved);
        acceptedSourceFingerprint.current = latestSourceFingerprint.current;
        pendingRef.current = false; setPendingDraft(null);
        setSourceConflict(pendingDraft.conflict);
        appliedFingerprint.current = 'restored:' + saved.revision;
        setNotice('일정표와 계약 조건 초안을 복원했습니다. 문서 저장 전에는 고객에게 반영되지 않습니다.'); setNoticeFailed(false);
    };
    const discardLocalDraft = () => {
        if (!scopeRef.current || isBusy()) return;
        let result: ReservationDraftResult;
        try { result = discardReservationDraft(window.localStorage, scopeRef.current); }
        catch { result = { ok: false, error: '보관된 문서 초안을 삭제하지 못했습니다.' }; }
        if (!result.ok) { setDraftError(result.error); return; }
        pendingRef.current = false; ownedRevision.current = null; lastStoredFingerprint.current = '';
        storedDraftPendingRef.current = false; setStoredDraftPending(false); callbacks.current.onDraftStatusChange?.(false);
        const currentSource = { content: cloneContent(callbacks.current.initialContent), dates: { startDate: callbacks.current.startDate, endDate: callbacks.current.endDate } };
        baselineRef.current = structuredClone(currentSource);
        contentRef.current = currentSource.content; datesRef.current = currentSource.dates;
        baseFingerprint.current = reservationDraftFingerprint(currentSource);
        appliedFingerprint.current = baseFingerprint.current;
        setDraftState(currentSource.content); setDatesState(currentSource.dates); setSourceConflict(false);
        setPendingDraft(null); setInvalidDraft(false); setSavedAt(null); setDraftError('');
        setNotice('보관된 초안을 버렸습니다. 현재 서버 문서로 시작합니다.'); setNoticeFailed(false);
    };

    useEffect(() => {
        const controller = new AbortController();
        setLibraryLoading(true);
        setLibraryError('');
        const read = async (key: keyof Libraries) => {
            const response = await fetch(`/api/data/${key}`, { cache: 'no-store', signal: controller.signal });
            const payload = await response.json();
            if (!response.ok || payload?.ok !== true) throw new Error('일정·명소 자료를 불러오지 못했습니다.');
            if (key.endsWith('_cats')) {
                if (payload.data == null) return [];
                if (!Array.isArray(payload.data) || payload.data.some((item: unknown) => typeof item !== 'string')) throw new Error('자료의 지역 목록을 확인할 수 없습니다.');
                return payload.data;
            }
            if (payload.data == null) return {};
            if (typeof payload.data !== 'object' || Array.isArray(payload.data)) throw new Error('일정·명소 자료 형식을 확인할 수 없습니다.');
            return payload.data;
        };
        Promise.all([read('snippets'), read('snippet_cats'), read('spots'), read('spot_cats')])
            .then(([snippets, snippet_cats, spots, spot_cats]) => { if (!controller.signal.aborted) setLibraries({ snippets, snippet_cats, spots, spot_cats }); })
            .catch(error => { if (!controller.signal.aborted) setLibraryError(error?.message || '자료를 불러오지 못했습니다. 다시 시도해 주세요.'); })
            .finally(() => { if (!controller.signal.aborted) setLibraryLoading(false); });
        return () => controller.abort();
    }, [libraryAttempt]);

    const touch = () => { setNotice(''); setNoticeFailed(false); };
    const changeMode = (mode: 'itinerary' | 'contract') => {
        if (isLocked()) return;
        modeRef.current = mode; setActiveMode(mode); p.onModeChange?.(mode);
    };
    const edit = (change: (current: ReservationDocContent) => ReservationDocContent) => { if (isLocked()) return; touch(); setDraft(change); };
    const editDay = (index: number, change: (day: TemplateDay) => TemplateDay) => edit(current => ({ ...current, days: current.days.map((day, i) => i === index ? change(day) : day) }));
    const editActivity = (dayIndex: number, index: number, change: (activity: Activity) => Activity) => editDay(dayIndex, day => ({ ...day, activities: (day.activities || []).map((activity, i) => i === index ? change(activity) : activity) }));
    const editContract = <K extends keyof DocumentSettings['contract'],>(key: K, value: DocumentSettings['contract'][K]) => edit(current => ({ ...current, documentSettings: { ...current.documentSettings, contract: { ...(current.documentSettings?.contract || {}), [key]: value } } }));
    const setDate = (key: keyof typeof dates, value: string) => { if (locked) return; touch(); setDates(current => ({ ...current, [key]: value })); };
    const moveDay = (index: number, target: number) => edit(current => {
        const days = [...current.days];
        if (target < 0 || target >= days.length) return current;
        const [moved] = days.splice(index, 1);
        days.splice(target, 0, moved);
        return { ...current, days: renumber(days) };
    });
    const removeDay = (index: number) => {
        if (isLocked()) return;
        if (draft.days.length <= 1) { setNotice('최소 1일은 필요합니다.'); setNoticeFailed(true); return; }
        edit(current => ({ ...current, days: renumber(current.days.filter((_, i) => i !== index)) }));
    };
    const revealTripSettings = () => {
        setTripSettingsOpen(true);
        if (p.externalActions) requestAnimationFrame(() => editorRef.current?.querySelector('.ri-trip-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    const fillDates = () => {
        if (locked) return;
        if (!dates.startDate) { revealTripSettings(); setNotice('여행 시작일을 먼저 입력하세요.'); setNoticeFailed(true); return; }
        edit(current => ({ ...current, days: fillQuoteDayDates(current.days, dates.startDate) }));
        setNotice('출발일 기준으로 여행일자를 채웠어요 — 각 칸에서 자유롭게 수정할 수 있어요.');
    };
    const loadSnippet = (index: number, name: string) => {
        if (isLocked() || !name || !libraries.snippets[name]) return;
        editDay(index, day => applyQuoteSnippet(day, libraries.snippets[name]));
    };
    const toggleSpot = (name: string, value: any) => edit(current => ({ ...current, highlights: toggleRepresentativeSpot(current.highlights || [], name, value) }));
    const addPhotos = async (dayIndex: number, activityIndex: number | null, files: FileList | null) => {
        if (isLocked() || !files?.length) return;
        uploadingRef.current = true; callbacks.current.onBusyChange?.(true);
        touch(); setUploading(true);
        try {
            const urls = await Promise.all(Array.from(files).map(file => uploadImage(file, 'reservation-docs')));
            if (!mountedRef.current) return;
            setDraft(current => ({ ...current, days: current.days.map((day, index) => index !== dayIndex ? day : activityIndex == null
                ? { ...day, images: [...photoList(day.images), ...urls] }
                : { ...day, activities: (day.activities || []).map((activity, i) => i === activityIndex ? { ...activity, images: [...photoList(activity.images), ...urls] } : activity) }) }));
        } catch (error: any) { if (mountedRef.current) { setNotice(error?.message || '사진을 업로드하지 못했습니다. 다시 시도하세요.'); setNoticeFailed(true); } }
        finally {
            uploadingRef.current = false;
            if (mountedRef.current) { setUploading(false); callbacks.current.onBusyChange?.(savingRef.current); }
        }
    };
    const save = async () => {
        if (isLocked()) return;
        const currentDates = datesRef.current;
        if (!!currentDates.startDate !== !!currentDates.endDate) { revealTripSettings(); setNotice('여행 시작일과 종료일을 함께 입력하세요.'); setNoticeFailed(true); return; }
        if (currentDates.endDate && currentDates.endDate < currentDates.startDate) { revealTripSettings(); setNotice('여행 종료일은 시작일보다 빠를 수 없습니다.'); setNoticeFailed(true); return; }
        if (modeRef.current === 'itinerary' && !contentRef.current.days.length) { setNotice('일차를 추가하고 일정을 작성해 주세요.'); setNoticeFailed(true); return; }
        if (latestSourceFingerprint.current !== baseFingerprint.current && acceptedSourceFingerprint.current !== latestSourceFingerprint.current) {
            if (!window.confirm('편집 중 서버의 문서가 변경되었습니다. 현재 초안으로 문서를 저장할까요?')) return;
            acceptedSourceFingerprint.current = latestSourceFingerprint.current;
        }
        flushDraft();
        const submitted = { content: cloneContent({ ...contentRef.current, days: renumber(contentRef.current.days) }), dates: { ...currentDates } };
        const revision = ownedRevision.current;
        savingRef.current = true; callbacks.current.onBusyChange?.(true);
        setSaving(true); setNotice(''); setNoticeFailed(false);
        try {
            const result = await callbacks.current.onSave(submitted.content, submitted.dates, modeRef.current);
            if (result === false) throw new Error('문서를 저장하지 못했습니다. 초안과 입력 내용은 유지됩니다.');
            // Establish the saved baseline before cleanup can flush/recreate this recovery copy.
            baselineRef.current = structuredClone(submitted);
            baseFingerprint.current = reservationDraftFingerprint(submitted);
            contentRef.current = submitted.content; datesRef.current = submitted.dates;
            let cleared: ReservationDraftResult = { ok: true };
            try { if (scopeRef.current) cleared = finishReservationDraftSave(window.localStorage, scopeRef.current, true, revision); }
            catch { cleared = { ok: false, error: '문서는 저장했지만 보관된 초안을 삭제하지 못했습니다.' }; }
            ownedRevision.current = null; lastStoredFingerprint.current = '';
            let recoveryRemains = false;
            try { if (scopeRef.current) recoveryRemains = readReservationDraft(window.localStorage, scopeRef.current, submitted).kind === 'draft'; }
            catch { recoveryRemains = !cleared.ok; }
            storedDraftPendingRef.current = recoveryRemains;
            if (mountedRef.current) {
                setStoredDraftPending(recoveryRemains); callbacks.current.onDraftStatusChange?.(recoveryRemains);
                setDraftState(submitted.content); setDatesState(submitted.dates); setSavedAt(null); setSourceConflict(false);
                setDraftError(cleared.ok ? '' : cleared.error);
                setNotice('저장했습니다. 고객 공개와 전달은 문서 영역에서 진행하세요.');
            }
        } catch (error: any) {
            if (mountedRef.current) { setNotice(error?.message || '저장하지 못했습니다. 입력한 내용은 남아 있습니다. 다시 시도하세요.'); setNoticeFailed(true); }
        } finally {
            savingRef.current = false;
            if (mountedRef.current) { setSaving(false); callbacks.current.onBusyChange?.(uploadingRef.current); }
        }
    };
    const close = () => { if (prepareLeave()) callbacks.current.onClose(); };
    const jumpToDay = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
        const day = editorRef.current?.querySelectorAll<HTMLElement>('.day-edit')[index];
        day?.querySelector<HTMLButtonElement>('.day-toggle[aria-expanded="false"]')?.click();
        day?.scrollIntoView({ behavior, block: 'start' });
        day?.querySelector<HTMLInputElement>('input.dest')?.focus({ preventScroll: true });
        return !!day;
    }, []);
    const requestedDayApplied = useRef<string | null>(null);
    useEffect(() => {
        const requestedDay = p.requestedDay;
        if (!p.externalActions || locked || activeMode !== 'itinerary' || requestedDay == null || !Number.isInteger(requestedDay) || requestedDay < 1 || requestedDay > draft.days.length) return;
        const requestKey = `${p.reservationId}:${requestedDay}:${p.requestedDayRevision ?? 0}`;
        if (requestedDayApplied.current === requestKey) return;
        if (!editorRef.current) return;
        let disposed = false, firstFrame = 0, settledFrame = 0;
        // The shared widget adds cards before its portals and layout finish settling.
        // Wait for two paint frames, then place the requested day without a competing animation.
        const schedule = () => {
            if (disposed || firstFrame || settledFrame || !editorRef.current?.querySelectorAll('.day-edit')[requestedDay - 1]) return;
            firstFrame = requestAnimationFrame(() => {
                firstFrame = 0;
                settledFrame = requestAnimationFrame(() => {
                    settledFrame = 0;
                    if (disposed || !jumpToDay(requestedDay - 1, 'auto')) return;
                    requestedDayApplied.current = requestKey;
                    observer.disconnect();
                });
            });
        };
        const observer = new MutationObserver(schedule);
        observer.observe(editorRef.current, { childList: true, subtree: true });
        schedule();
        return () => {
            disposed = true;
            observer.disconnect();
            if (firstFrame) cancelAnimationFrame(firstFrame);
            if (settledFrame) cancelAnimationFrame(settledFrame);
        };
    }, [p.externalActions, p.requestedDay, p.requestedDayRevision, p.reservationId, activeMode, draft.days.length, locked, jumpToDay]);
    const contract = draft.documentSettings?.contract || {} as DocumentSettings['contract'];
    const expectedDays = dates.startDate && dates.endDate ? Math.round((Date.parse(dates.endDate) - Date.parse(dates.startDate)) / 86400000) + 1 : null;
    const photos = (urls: string[], remove: (index: number) => void) => urls.length > 0 && <div className="ri-photos">{urls.map((url, i) => <figure key={`${url}-${i}`}><img src={url} alt={`일정 사진 ${i + 1}`} loading="lazy" /><button type="button" disabled={locked} onClick={() => remove(i)} aria-label={`사진 ${i + 1} 삭제`}>×</button></figure>)}</div>;

    return <section ref={editorRef} id="sec-inline-doc" className={`card ri-editor${p.externalActions ? ' ri-editor-workflow' : ''}`} aria-label="예약 문서 본문 편집" aria-busy={saving || uploading}>
        {!p.externalActions && <div className="ri-heading"><div><span className="ri-kicker">예약 문서 작성</span><h2>예약 상세에서 바로 편집하세요</h2><p>작성 중인 초안을 미리보고 저장한 뒤 고객에게 전달하세요.</p></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" className="btn btn-ghost" disabled={locked} onClick={() => showDraftPreview()}>저장 전 초안 미리보기</button><button type="button" className="btn btn-ghost" onClick={close} disabled={saving || uploading || !!p.externalBusy}>편집 닫기</button></div></div>}
        <div className={`ri-draft-status${draftError || sourceConflict || pendingDraft?.conflict ? ' is-warning' : ''}${p.adminUserId && !dirty && !pendingDraft && !storedDraftPending && !invalidDraft && !sourceConflict && !draftError ? ' is-idle' : ''}`} role="status" aria-live="polite">
            {!p.adminUserId ? '관리자 계정을 확인한 뒤 문서를 편집할 수 있습니다.' : pendingDraft ? <>
                <strong>{pendingDraft.conflict ? '현재 서버 문서와 다른 초안이 있습니다.' : '저장하지 않은 일정표·계약서 초안이 있습니다.'}</strong>
                <div>초안 보관: {new Date(pendingDraft.draft.savedAt).toLocaleString('ko-KR')} · 일정·날짜·사진·계약 조건을 함께 복원합니다.{pendingDraft.conflict ? ' 복원 후 현재 문서와 비교해 저장하세요.' : ''}</div>
                <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}><button type="button" className="btn btn-ink btn-sm" disabled={saving || uploading || !!p.externalBusy || !!p.disabled} onClick={restoreLocalDraft}>초안 복원</button><button type="button" className="btn btn-ghost btn-sm" disabled={saving || uploading || !!p.externalBusy} onClick={discardLocalDraft}>초안 버리기</button></div>
            </> : <><strong>{invalidDraft ? '보관된 초안을 확인할 수 없습니다.' : sourceConflict ? '서버 문서가 변경되었습니다. 현재 초안은 유지됩니다.' : dirty ? '작성 중 문서를 이 브라우저에 자동 보관합니다.' : '서버에 저장된 문서를 편집합니다.'}</strong><div>{savedAt ? '마지막 초안 보관: ' + new Date(savedAt).toLocaleString('ko-KR') + ' · ' : ''}현재 관리자 계정과 이 예약에서만 복원됩니다. 문서 저장과 고객 공개·전달은 별도로 진행합니다.</div></>}
            {draftError && <div role="alert" style={{ color: '#9f4d13', marginTop: 6 }}>{draftError}<button type="button" className="btn btn-ghost btn-sm" disabled={saving || uploading || !!p.externalBusy} onClick={() => { if (invalidDraft || !dirty) discardLocalDraft(); else flushDraft(); }} style={{ marginLeft: 8 }}>{invalidDraft || !dirty ? '초안 버리기' : '다시 보관'}</button></div>}
            {!pendingDraft && !invalidDraft && (dirty || storedDraftPending) && <button type="button" className="btn btn-ghost btn-sm" disabled={saving || uploading || !!p.externalBusy} onClick={() => { if (window.confirm('작성 중 문서 변경사항과 보관된 초안을 버리고 서버 문서로 돌아갈까요?')) discardLocalDraft(); }}>초안 버리기</button>}
        </div>
        <div className="ri-editor-tools"><div className="ri-modes" aria-label="문서 편집 종류"><button type="button" className={activeMode === 'itinerary' ? 'is-selected' : ''} aria-pressed={activeMode === 'itinerary'} disabled={locked} onClick={() => changeMode('itinerary')}>확정 일정표</button><button type="button" className={activeMode === 'contract' ? 'is-selected' : ''} aria-pressed={activeMode === 'contract'} disabled={locked} onClick={() => changeMode('contract')}>여행 계약서</button><span>{dirty ? '저장하지 않은 변경사항' : '저장된 문서 기준'}</span></div>
        {p.externalActions && activeMode === 'itinerary' && <nav className="ri-day-navigation" aria-label="일정 편집 바로가기">
            <span>바로가기</span>
            {draft.days.map((day, index) => <button key={index} type="button" disabled={locked} onClick={() => jumpToDay(index)} title={day.title || `${index + 1}일차`}>{index + 1}일차</button>)}
            <button type="button" onClick={() => { const spots = editorRef.current?.querySelector<HTMLDetailsElement>('.ri-spots-collapsible'); if (spots) { spots.open = true; spots.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }}>대표 명소</button>
        </nav>}</div>
        <form id={`reservation-inline-${p.reservationId}`} noValidate onSubmit={event => { event.preventDefault(); void save(); }}>
        <fieldset className={`ri-form${p.externalActions ? ' ri-composer' : ''}`} disabled={locked} inert={locked}>
            <section className="ri-trip-settings" aria-label="여행 기본 정보">
            {p.externalActions && <header className="ri-settings-heading"><span className="ri-settings-mark" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" /><path d="M8 3v4m8-4v4M4 10h16m-11 5h2m3 0h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg></span><div className="ri-settings-title"><h3>{draft.name || '여행 기본 정보'}</h3><p>{dates.startDate || '출발일 미정'}<span>—</span>{dates.endDate || '도착일 미정'}{expectedDays != null && expectedDays > 0 && <b>{expectedDays}일 여행</b>}</p></div><button type="button" className="ri-settings-toggle" aria-expanded={tripSettingsOpen} aria-controls={`reservation-trip-settings-${p.reservationId}`} onClick={() => setTripSettingsOpen(value => !value)}>{tripSettingsOpen ? '접기' : '기본 정보 수정'}<svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 8 5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></button></header>}
            <div id={`reservation-trip-settings-${p.reservationId}`} hidden={p.externalActions && !tripSettingsOpen}>
            <div className="ri-basics"><label className="ri-field ri-wide"><span>여행명</span><input value={draft.name} onChange={e => edit(current => ({ ...current, name: e.target.value }))} /></label><label className="ri-field"><span>여행 시작일</span><input type="date" value={dates.startDate} onChange={e => setDate('startDate', e.target.value)} /></label><label className="ri-field"><span>여행 종료일</span><input type="date" value={dates.endDate} min={dates.startDate || undefined} onChange={e => setDate('endDate', e.target.value)} /></label></div>
            </div>
            </section>
            {activeMode === 'itinerary' ? <>
                <div className="ri-quote-section quote-day-editor">
                    <div className="ri-schedule-heading"><div className="ri-quote-head"><h3>일자별 일정 <span className="ri-schedule-count">{draft.days.length}일</span></h3></div><button type="button" className="ri-fill-dates" onClick={fillDates}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" /><path d="M8 3v4m8-4v4M4 10h16m-8 4v4m-2-2h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>날짜 자동 입력</button></div>
                    {libraryLoading && <p className="ri-library-note" role="status">저장된 일정과 명소를 불러오고 있습니다.</p>}
                    {libraryError && <div className="ri-library-error" role="alert">{libraryError}<button type="button" onClick={() => setLibraryAttempt(current => current + 1)}>다시 시도</button></div>}
                    <QuoteDayEditor syncKey={appliedFingerprint.current} days={draft.days.map((day, index) => ({ ...quoteDayFields(day), d: index + 1 }))}
                        startDate={dates.startDate} endDate={dates.endDate} snippets={libraries.snippets} snippetCats={libraries.snippet_cats} disabled={locked}
                        onField={(index, field, value) => editDay(index, day => updateQuoteDay(day, field === 'move' ? value : { [field]: value }))}
                        onSnippet={loadSnippet} onDelete={removeDay} onReorder={moveDay}
                        onAdd={() => edit(current => ({ ...current, days: [...current.days, { day: current.days.length + 1, date: '', dateMode: 'manual', title: '', items: [], activities: [], meals: {}, accommodation: null }] }))}
                        onNotice={message => { setNotice(message); setNoticeFailed(false); }}
                        renderDetails={dayIndex => {
                            const day = draft.days[dayIndex];
                            if (!day) return null;
                            const assigned = p.dailyAccommodations?.find(stay => stay.day === dayIndex + 1)?.accommodation.name;
                            return <>
                                {assigned && <p className="ri-assigned-stay"><span className="ri-stay-state">배정 완료</span><b>{assigned}</b><span>고객 일정표에 우선 반영됩니다.</span></p>}
                                <details className="ri-rich-details"><summary>사진·상세 설명</summary><div className="ri-rich-body">
                                    <label className="ri-field"><span>지역</span><input value={day.region || ''} onChange={e => editDay(dayIndex, current => ({ ...current, region: e.target.value }))} /></label>
                                    {day.retainedSummary && <p className="ri-library-note">기존 상품 안내 · {day.retainedSummary}</p>}
                                    {photos(photoList(day.images), index => editDay(dayIndex, current => ({ ...current, images: photoList(current.images).filter((_, i) => i !== index) })))}
                                    <label className="ri-upload">＋ 일차 사진 추가<input type="file" accept="image/*" multiple onChange={e => { void addPhotos(dayIndex, null, e.target.files); e.target.value = ''; }} /></label>
                                    {(day.activities || []).map((activity, activityIndex) => <div className="ri-activity" key={activityIndex}>
                                        <strong className="ri-rich-title">{[activity.time, activity.title].filter(Boolean).join(' ') || '사진 일정'}</strong>
                                        <label className="ri-field"><span>상세 설명</span><textarea rows={2} value={activity.description || ''} onChange={e => editActivity(dayIndex, activityIndex, current => ({ ...current, description: e.target.value }))} /></label>
                                        {photos(photoList(activity.images), index => editActivity(dayIndex, activityIndex, current => ({ ...current, images: photoList(current.images).filter((_, i) => i !== index) })))}
                                        <label className="ri-upload">＋ 항목 사진 추가<input type="file" accept="image/*" multiple onChange={e => { void addPhotos(dayIndex, activityIndex, e.target.files); e.target.value = ''; }} /></label>
                                    </div>)}
                                    <label className="ri-field"><span>숙소 태그</span><input value={day.accommodation?.tags || ''} onChange={e => editDay(dayIndex, current => ({ ...current, accommodation: { ...(current.accommodation || { name: '' }), tags: e.target.value } }))} /></label>
                                </div></details>
                            </>;
                        }} />
                </div>
                {p.externalActions ? <details className="ri-spots ri-spots-collapsible">
                    <summary><span><strong>대표 명소</strong><small>필요한 명소를 선택한 순서대로 일정표에 표시합니다.</small></span><b>{(draft.highlights || []).length}개 선택</b></summary>
                    <div className="ri-spots-content">{!libraryLoading && !libraryError && <QuoteSpotSelector spots={libraries.spots} categories={libraries.spot_cats}
                        selected={(draft.highlights || []).map(spot => spot.name)} disabled={locked} onToggle={toggleSpot} />}</div>
                </details> : <div className="ri-spots"><div className="ri-section-title"><div><h3>대표 명소</h3><p>견적서와 같은 화면에서 선택합니다. 선택한 순서대로 고객 일정표에 표시합니다.</p></div></div>
                    {!libraryLoading && !libraryError && <QuoteSpotSelector spots={libraries.spots} categories={libraries.spot_cats}
                        selected={(draft.highlights || []).map(spot => spot.name)} disabled={locked} onToggle={toggleSpot} />}
                </div>}
            </> : <div className="ri-contract"><h3>여행 계약 조건</h3><p className="ri-library-note">현재 문서의 원문을 확인하고 필요한 내용을 수정하세요.</p><label className="ri-field"><span>계약서 서문</span><textarea rows={4} value={contract.intro || ''} onChange={e => editContract('intro', e.target.value)} /></label><div className="ri-contract-fields"><label className="ri-field"><span>지급 방법</span><input value={contract.paymentMethod || ''} onChange={e => editContract('paymentMethod', e.target.value)} /></label><label className="ri-field"><span>지급 기한</span><input value={contract.paymentDeadline || ''} onChange={e => editContract('paymentDeadline', e.target.value)} /></label><label className="ri-field"><span>포함 사항</span><textarea rows={4} value={contract.includedText || ''} onChange={e => editContract('includedText', e.target.value)} /></label><label className="ri-field"><span>불포함 사항</span><textarea rows={4} value={contract.excludedText || ''} onChange={e => editContract('excludedText', e.target.value)} /></label></div><div className="ri-small-heading"><h4>취소 규정</h4><button type="button" onClick={() => editContract('cancellationRows', [...(contract.cancellationRows || []), { period: '', fee: '' }])}>＋ 규정 행 추가</button></div>{(contract.cancellationRows || []).map((row, index) => <div className="ri-cancellation-row" key={index}><label className="ri-field"><span>취소 시점</span><input value={row.period} onChange={e => editContract('cancellationRows', (contract.cancellationRows || []).map((item, i) => i === index ? { ...item, period: e.target.value } : item))} /></label><label className="ri-field"><span>취소 요금</span><input value={row.fee} onChange={e => editContract('cancellationRows', (contract.cancellationRows || []).map((item, i) => i === index ? { ...item, fee: e.target.value } : item))} /></label><button type="button" className="ri-remove" onClick={() => editContract('cancellationRows', (contract.cancellationRows || []).filter((_, i) => i !== index))}>삭제</button></div>)}<label className="ri-field"><span>동의 문구</span><textarea rows={3} value={contract.signatureNote || ''} onChange={e => editContract('signatureNote', e.target.value)} /></label></div>}
        </fieldset>
        <div className="ri-savebar"><span className={noticeFailed ? 'ri-save-error' : ''} role={noticeFailed ? 'alert' : 'status'}>{uploading ? '사진 업로드 중입니다…' : saving ? '문서를 저장하고 있습니다…' : notice || (dirty ? '변경사항을 저장하세요.' : '현재 예약의 문서를 편집합니다.')}</span>{!p.externalActions && <button type="submit" className="btn btn-ink" disabled={locked}>{saving ? '저장 중…' : activeMode === 'contract' ? '계약 조건 저장' : '일정 저장'}</button>}</div>
        {preview && <ReservationDraftPreview {...preview} accountId={p.adminUserId} context={p.previewContext} onClose={() => setPreview(null)} />}
        </form>
    </section>;
}
