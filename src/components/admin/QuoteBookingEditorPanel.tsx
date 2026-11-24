import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
    AdminBadge, AdminButton, AdminCard, AdminCheckbox, AdminError, AdminField, AdminIconButton, AdminLoading, AdminMessage, AdminSelect, AdminTextArea, AdminTextInput,
    IconClose, IconExternal, IconPlus, type AdminSelectOption,
} from './ui';
import { adminConfirm, adminNotify } from './ui/adminFeedback';
import { QuoteDayEditor } from './QuoteDayEditor';
import { QuoteSpotSelector } from './QuoteSpotSelector';
import { readQuoteLibrary, type QuoteLibraryKey } from './quoteLibraryStore';
import { draftFingerprint, readDraft, removeDraft, validBookingDraft, writeDraft, type DraftRead, type DraftScope } from './quoteDraftStore';
import { guideSheetHref, guideSheetPayload } from './quoteBookingList';
import {
    BALANCE_STATUSES, CASH_RECEIPTS, DEPOSIT_STATUSES, GUIDE_ROLES, LODGE_GRADES, PACKAGE_TYPES, PRODUCT_NAMES, REGIONS, TRAVELER_GENDERS,
    actionBar, afterSave, assignStats, bookingDraftSnapshot, bookingLinks, daysFromQuote, fillFromLibraries, formFromBooking, guideFromLibrary, lodgeFromLibrary,
    lodgePreview, lodgeRowOf, lodgesFromDays, normBooking, prepareBooking, pullBooking, resourcePreview, restoreBookingDraft, saveRequest, stageRequestError,
    toggleHighlight, travelNoticeError, travelerRowOf, vehicleFromLibrary, workflowUi,
    type BookingForm, type BookingLibraries, type BookingRecord, type Json,
} from './quoteBookingEditor';
import './QuoteBookingEditorPanel.css';

/**
 * 견적 예약 편집기(고객 통합 작업 화면 안) — 옛 public/예약관리.html iframe을 대신한다.
 * 계산은 quoteBookingEditor.ts(옛 init·render·pullForm·updateActionBar·saveBookingBody와 같다 — 테스트가 비교), 서버는 같은 `/api/requests/:id`.
 * 화면은 바깥 화면이 고른 작업 한 칸만 보인다(일정표·계약서·주문자/여행자·결제·배정·운영 메모 — 옛 고객 화면의 data-customer-section과 같다).
 * 바깥 화면과의 약속(옛 InhasuQuoteBookingWorkspace·QuoteEditorState와 같다): flushAll(초안 보관) · navigate(작업 위치) · run(전달 메뉴) · links(메뉴 표시) · onState(저장 중·미저장).
 * 옛 화면과 달라진 점: 고객에게 알리는 단계 요청(예약금 안내·계약서 요청·입금 확인·여행자 정보 요청·서명 초기화) 뒤에는 서버의 예약을 다시 읽어 시작한다.
 */
export type BookingSection = 'docs' | 'contract' | 'info' | 'pay' | 'assign' | 'notes' | 'log';
export type BookingRunAction = 'itineraryNotice' | 'copyLink' | 'guideSheet' | 'guidePdf' | 'travelNotice' | 'revert';
export interface BookingEditorState { busy: boolean; dirty: boolean; error: string }
export interface BookingEditorLinks { confirm: string | null; contract: string | null; hasQuote: boolean; travelNoticeLabel: string; travelNoticeDisabled: boolean; undoDisabled: boolean; locked: boolean }
export interface QuoteBookingEditorHandle {
    flushAll: () => { ok: boolean; busy: boolean; dirty?: boolean; error?: string };
    navigate: (section: string) => boolean;
    run: (action: BookingRunAction) => boolean;
    links: () => BookingEditorLinks | null;
}
interface Props {
    requestId: string;
    token: string;
    accountId: string;
    section: BookingSection;
    onState: (state: BookingEditorState) => void;
    /** 서버에 저장한 뒤(바깥 고객 현황을 다시 읽게) */
    onSaved: () => void;
}

const EMPTY_LIBS: BookingLibraries = { guides: {}, lodges: {}, vehicles: {} };
const LODGE_REGION_UNSET = '지역 미지정';
const CANCELLED = /취소|cancelled/i;
const isMap = (value: unknown): value is Record<string, Json> => !!value && typeof value === 'object' && !Array.isArray(value);
const read = async (key: QuoteLibraryKey, token: string) => { try { return (await readQuoteLibrary(key, token)).data; } catch { return null; } };
/** 이 작업 위치로 옮길 때 초점을 줄 칸(옛 quote-booking-workspace.js의 sections) */
const FOCUS: Record<string, [BookingSection, string]> = {
    docs: ['docs', 'qbe-docs'], contract: ['contract', 'qbe-contract'], info: ['info', 'qbe-info'], pay: ['pay', 'qbe-pay'], flights: ['info', 'qbe-flight'],
    travelers: ['info', 'qbe-travelers'], 'view-info': ['info', 'qbe-info'], assign: ['assign', 'qbe-assign'], guide: ['assign', 'qbe-guide'], vehicle: ['assign', 'qbe-vehicle'],
    stay: ['assign', 'qbe-lodges'], send: ['docs', 'qbe-docs'], notes: ['notes', 'qbe-memo'], log: ['log', ''],
};
export const bookingSectionOf = (section: string): BookingSection => (FOCUS[section]?.[0] || 'info');

/** 숙소를 등록 정보의 지역 순서대로 묶는다(옛 lodgeRegionGroups): 지역 목록 순서 → 그 밖의 지역 가나다 → 지역 미지정 */
function lodgeOptions(lodges: Record<string, Json>, order: string[]): AdminSelectOption[] {
    const groups = new Map<string, string[]>();
    Object.entries(lodges).forEach(([name, r]) => { const region = String((r && r.region) || '').trim() || LODGE_REGION_UNSET; if (!groups.has(region)) groups.set(region, []); groups.get(region)!.push(name); });
    const used = Object.values(lodges).map(r => String((r && r.region) || '').trim()).filter(Boolean);
    const regionOrder = [...new Set([...order, ...used])];
    const rank = (r: string) => (r === LODGE_REGION_UNSET ? 2 : regionOrder.includes(r) ? 0 : 1);
    const sorted = [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b) || (rank(a) === 0 ? regionOrder.indexOf(a) - regionOrder.indexOf(b) : a.localeCompare(b, 'ko')));
    const flat = sorted.length === 1 && sorted[0][0] === LODGE_REGION_UNSET;
    return sorted.flatMap(([region, names]) => names.map(name => ({ value: name, label: name, group: flat ? undefined : `${region} (${names.length})` })));
}

function Preview({ title, sub, img, kind }: { title: string; sub: string; img: string; kind: string }) {
    return <div className="qbe-preview">
        <span className="qbe-thumb">{img ? <img src={img} alt={title} /> : <span aria-hidden="true">{kind}</span>}</span>
        <span className="qbe-preview-text"><b>{title}</b><small>{sub || '리소스를 선택하면 고객에게 보일 정보와 이미지 상태가 표시됩니다.'}</small></span>
    </div>;
}

export const QuoteBookingEditor = forwardRef<QuoteBookingEditorHandle, Props>(function QuoteBookingEditor({ requestId, token, accountId, section, onState, onSaved }, ref) {
    const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
    const [loadError, setLoadError] = useState('');
    const [pre, setPre] = useState<BookingRecord | null>(null);
    const [bk, setBk] = useState<Json | null>(null);
    const [form, setForm] = useState<BookingForm | null>(null);
    const [libs, setLibs] = useState<BookingLibraries>(EMPTY_LIBS);
    const [lodgeCats, setLodgeCats] = useState<string[]>([]);
    const [snippets, setSnippets] = useState<{ items: Record<string, Json>; cats: string[] }>({ items: {}, cats: [] });
    const [spots, setSpots] = useState<{ items: Record<string, Json>; cats: string[] }>({ items: {}, cats: [] });
    const [savedJson, setSavedJson] = useState('');
    const [busy, setBusy] = useState('');
    const [pending, setPending] = useState<DraftRead | null>(null);
    const [draftError, setDraftError] = useState('');
    const [syncKey, setSyncKey] = useState(0);
    const busyRef = useRef(''); busyRef.current = busy;
    const preRef = useRef(pre); preRef.current = pre;
    const bkRef = useRef(bk); bkRef.current = bk;
    const formRef = useRef(form); formRef.current = form;
    const libsRef = useRef(libs); libsRef.current = libs;
    const pendingRef = useRef(pending); pendingRef.current = pending;
    const savedRef = useRef(savedJson); savedRef.current = savedJson;
    const scope = useRef<DraftScope | null>(null);
    const baseline = useRef<unknown>(null);
    const lastStored = useRef('');
    const legacyOwned = useRef(false);
    const run = useRef(0);
    const root = useRef<HTMLDivElement>(null);
    const navTarget = useRef('');
    const focusTarget = () => {
        const id = FOCUS[navTarget.current]?.[1]; navTarget.current = '';
        if (!id) return;
        window.requestAnimationFrame(() => {
            const el = root.current?.querySelector<HTMLElement>(`#${id}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            (el?.querySelector<HTMLElement>('select,input,textarea,button') || el)?.focus?.({ preventScroll: true });
        });
    };

    /** 예약을 처음부터 연다(옛 openInitialBooking → init → loadLibs): 요청 읽기 → 예약 정리 → 입력칸 → 등록 자원 채우기 → 초안 확인 */
    const open = useCallback(async (reuseLibs?: BookingLibraries) => {
        const at = ++run.current;
        setLoadError('');
        try {
            const res = await fetch(`/api/requests/${encodeURIComponent(requestId)}`, { headers: { 'x-admin-token': token }, cache: 'no-store' });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.ok || String(data.item?.id) !== requestId) throw new Error('예약을 불러올 수 없습니다. 관리자 로그인과 예약번호를 확인해 주세요.');
            let library = reuseLibs;
            if (!library) {
                const [guides, lodges, vehicles, cats, sn, sc, sp, pc] = await Promise.all(
                    (['guides', 'lodges', 'vehicles', 'lodge_cats', 'snippets', 'snippet_cats', 'spots', 'spot_cats'] as QuoteLibraryKey[]).map(key => read(key, token)));
                library = { guides: isMap(guides) ? guides : {}, lodges: isMap(lodges) ? lodges : {}, vehicles: isMap(vehicles) ? vehicles : {} };
                setLodgeCats(Array.isArray(cats) ? cats.map(String) : []);
                setSnippets({ items: isMap(sn) ? sn : {}, cats: Array.isArray(sc) ? sc.map(String) : [] });
                setSpots({ items: isMap(sp) ? sp : {}, cats: Array.isArray(pc) ? pc.map(String) : [] });
            }
            if (at !== run.current) return;
            const record = data.item as BookingRecord;
            const bk0 = prepareBooking(record);
            const form0 = formFromBooking(bk0, record);
            const bk1 = pullBooking(bk0, form0, EMPTY_LIBS);
            const form1 = fillFromLibraries(form0, bk1, library);
            const bk2 = pullBooking(bk1, form1, library);
            setLibs(library); setPre(record); setBk(bk2); setForm(form1); setSavedJson(JSON.stringify(bk2)); setSyncKey(k => k + 1);
            // 초안: 옛 예약관리와 같은 자리(계정·booking·요청 ID)와 형식이라 서로 복원된다
            scope.current = { account: accountId, kind: 'booking', requestId: String(record.id) };
            baseline.current = bookingDraftSnapshot(record, bk2); lastStored.current = '';
            let found: DraftRead | null;
            try { found = readDraft(localStorage, scope.current, baseline.current, validBookingDraft); }
            catch { found = { kind: 'error', error: '브라우저 저장소를 사용할 수 없어 초안을 확인하지 못했습니다.' }; }
            legacyOwned.current = found?.kind === 'draft' && found.legacy;
            setPending(found && found.kind !== 'empty' ? found : null);
            setDraftError('');
            setPhase('ready');
        } catch (error) {
            if (at !== run.current) return;
            setLoadError(error instanceof Error ? error.message : String(error));
            setPhase('error');
        }
    }, [requestId, token, accountId]);
    useEffect(() => { void open(); return () => { run.current++; }; }, [open]);
    useEffect(() => { if (phase === 'ready' && navTarget.current) focusTarget(); }, [phase]);

    // ── 초안 보관 ──
    const snapshot = () => (preRef.current && bkRef.current ? bookingDraftSnapshot(preRef.current, bkRef.current) : null);
    const flushDraft = useCallback((): string => {
        const current = snapshot();
        if (!scope.current || pendingRef.current || !current) return '';
        const print = draftFingerprint(current);
        if (print === draftFingerprint(baseline.current) || print === lastStored.current) return '';
        let result: ReturnType<typeof writeDraft>;
        try { result = writeDraft(localStorage, scope.current, baseline.current, current); }
        catch { result = { ok: false, error: '브라우저 저장소를 사용할 수 없어 초안을 보관하지 못했습니다.' }; }
        if (result.ok) { lastStored.current = print; setDraftError(''); return ''; }
        setDraftError(result.error); return result.error;
    }, []);
    const commitDraft = () => {
        if (!scope.current) return;
        const removed = removeDraft(localStorage, scope.current);
        if (!removed.ok) adminNotify('저장은 완료됐지만 이전 초안을 지우지 못했습니다. ' + removed.error, 'error');
        legacyOwned.current = false; lastStored.current = '';
        const current = snapshot(); if (current) baseline.current = current;
    };
    useEffect(() => {
        if (phase !== 'ready' || pending) return;
        const timer = window.setTimeout(flushDraft, 400);
        return () => window.clearTimeout(timer);
    }, [bk, pre, phase, pending, flushDraft]);
    useEffect(() => {
        const onHide = () => { flushDraft(); };
        const onLeave = (event: BeforeUnloadEvent) => { if (busyRef.current) { event.preventDefault(); event.returnValue = ''; } else flushDraft(); };
        window.addEventListener('pagehide', onHide); window.addEventListener('beforeunload', onLeave);
        return () => { window.removeEventListener('pagehide', onHide); window.removeEventListener('beforeunload', onLeave); flushDraft(); };
    }, [flushDraft]);
    const restoreDraft = () => {
        if (pending?.kind !== 'draft' || !pre || !bk) return;
        const restored = restoreBookingDraft(pre, bk, pending.value);
        setPre(restored.pre); setBk(restored.bk); setForm(formFromBooking(restored.bk, restored.pre)); setSyncKey(k => k + 1);
        setPending(null); lastStored.current = '';
        adminNotify('초안을 복원했습니다. 저장해야 서버에 반영됩니다.', 'info');
    };
    const discardDraft = () => {
        if (!scope.current) return;
        const removed = removeDraft(localStorage, scope.current);
        if (!removed.ok) { setDraftError(removed.error); return; }
        legacyOwned.current = false; setPending(null);
    };

    // ── 바깥 화면에 알리기 ──
    const dirty = phase === 'ready' && !pending && !!pre && !!bk && draftFingerprint(bookingDraftSnapshot(pre, bk)) !== draftFingerprint(baseline.current);
    const stateRef = useRef(onState); stateRef.current = onState;
    useEffect(() => { stateRef.current({ busy: !!busy, dirty, error: draftError }); }, [busy, dirty, draftError]);
    useEffect(() => () => stateRef.current({ busy: false, dirty: false, error: '' }), []);

    // ── 편집 ──
    const cancelled = !!pre && CANCELLED.test(pre.status || '');
    const locked = !!busy || !!pending || phase !== 'ready';
    /** 입력칸을 바꾸면 옛 화면처럼 곧바로 예약을 다시 읽는다(pullForm) */
    const updateForm = (change: (old: BookingForm) => BookingForm) => {
        const old = formRef.current; if (!old) return;
        const next = change(old);
        setForm(next); formRef.current = next;
        setBk(b => (b ? pullBooking(b, next, libsRef.current) : b));
    };
    const setBooking = (change: (old: Json) => Json, sync = false) => { setBk(b => (b ? change(b) : b)); if (sync) setSyncKey(k => k + 1); };
    const field = <K extends keyof BookingForm>(key: K, value: BookingForm[K]) => updateForm(f => ({ ...f, [key]: value }));
    const sub = <K extends 'guide' | 'vehicle' | 'flight' | 'contract' | 'checklist'>(key: K, change: Partial<BookingForm[K]>) =>
        updateForm(f => ({ ...f, [key]: { ...(f[key] as object), ...change } }));

    // ── 서버 ──
    const patch = async (body: Json): Promise<Json> => {
        const res = await fetch(`/api/requests/${encodeURIComponent(requestId)}`, { method: 'PATCH', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'x-admin-token': token }, body: JSON.stringify(body) });
        if (res.status === 401) throw new Error('관리자 인증이 만료됐어요 — 화면을 새로 고쳐 주세요');
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.ok) throw new Error(j.error || `서버 오류(${res.status})`);
        return j;
    };
    /** 저장(옛 saveBookingBody). 성공하면 true */
    const save = async (opts: { setStatus?: boolean; resetContract?: boolean; action?: 'confirm' | 'publish'; quiet?: boolean; booking?: Json } = {}): Promise<boolean> => {
        const p = preRef.current, b = opts.booking || bkRef.current; if (!p || !b) return false;
        const saved = savedRef.current ? JSON.parse(savedRef.current) : {};
        const check = saveRequest(p, b, saved, { setStatus: opts.setStatus, resetContract: opts.resetContract });
        if (!check.ok) { adminNotify(check.error, 'error'); return false; }
        try {
            const j = await patch(check.patch);
            const after = afterSave(p, check.booking, j, check.patch);
            setPre(after.pre); setBk(after.booking); setForm(formFromBooking(after.booking, after.pre)); setSavedJson(JSON.stringify(after.booking));
            preRef.current = after.pre; bkRef.current = after.booking; savedRef.current = JSON.stringify(after.booking);
            commitDraft(); onSaved();
            if (!opts.quiet) {
                if (opts.action === 'confirm') adminNotify('예약이 확정되고 고객에게 안내됐어요', 'success');
                else if (opts.action === 'publish') {
                    const notice = (j.notifications || []).find((x: Json) => x.type === 'itinerary');
                    adminNotify(notice && notice.status === 'queued' ? '확정 일정표 공개 · 고객 알림톡 발송을 요청했어요' : '일정표는 공개됐어요 — 알림톡 설정·전화번호를 확인해 주세요', notice && notice.status === 'queued' ? 'success' : 'info');
                } else adminNotify('예약정보를 내부 저장했습니다 — 고객에게는 아직 발송되지 않았어요', 'success');
            }
            return true;
        } catch (error) { adminNotify(error instanceof Error ? error.message : '저장하지 못했습니다', 'error'); return false; }
    };
    /** 작업 하나를 잠근 채 실행(옛 runBookingAction): 저장 중·초안 선택 전에는 하지 않는다 */
    const act = async (name: string, work: () => Promise<unknown>) => {
        if (busyRef.current || pendingRef.current || phase !== 'ready') return;
        flushDraft(); setBusy(name); busyRef.current = name;
        try { await work(); } finally { setBusy(''); busyRef.current = ''; }
    };
    /** 고객에게 알리는 단계 요청 뒤: 서버의 예약을 다시 읽어 시작 */
    const reopen = async () => { await open(libsRef.current); onSaved(); };

    const sendStage = (kind: 'deposit' | 'contract') => act(kind, async () => {
        const error = stageRequestError(kind, bkRef.current!);
        if (error) { adminNotify(error, 'error'); return; }
        const label = kind === 'deposit' ? '예약금 입금 안내' : '계약서 서명 요청';
        if (!await adminConfirm({ title: `${label}를 진행할까요?`, message: '현재 입력한 예약정보를 저장한 뒤 고객 페이지에 해당 단계를 표시합니다.', confirmLabel: `${label} 진행` })) return;
        if (!await save({ quiet: true })) return;
        try { await patch(kind === 'deposit' ? { notifyDeposit: true } : { notifyContract: true }); adminNotify(`${label} 단계가 고객 페이지에 표시됩니다`, 'success'); await reopen(); }
        catch (e) { adminNotify(e instanceof Error ? e.message : '발송 실패', 'error'); }
    });
    const confirmDeposit = () => act('confirmDeposit', async () => {
        const b = bkRef.current!, who = b.depositReport?.name ? ` (입금자명 ${b.depositReport.name})` : '';
        if (!await adminConfirm({ title: '입금을 확인했나요?', message: `예약금이 입금완료로 저장되고${who ? who + ',' : ''} 고객에게 계약서 서명과 여행자 정보 입력 요청이 함께 발송됩니다.`, confirmLabel: '입금 확인·자동 발송' })) return;
        if (!await save({ quiet: true })) return;
        try { await patch({ confirmDeposit: true }); adminNotify('입금완료 처리 — 계약서 서명·여행자 정보 요청이 고객 페이지에 표시됩니다', 'success'); await reopen(); }
        catch (e) { adminNotify(e instanceof Error ? e.message : '처리 실패', 'error'); }
    });
    const confirmBooking = () => act('confirm', async () => {
        if (!await adminConfirm({ title: '예약을 확정할까요?', message: '예약금 입금과 계약서 서명을 확인한 뒤 고객에게 예약 확정 알림을 보냅니다.', confirmLabel: '예약 확정하기' })) return;
        await save({ setStatus: true, action: 'confirm' });
    });
    const publish = () => act('publish', async () => {
        if (!await adminConfirm({ title: '확정 일정표를 공개할까요?', message: '가이드·차량·숙소 배정을 포함한 최종 일정표가 고객에게 공개됩니다.', confirmLabel: '일정표 공개하기' })) return;
        const next = { ...formRef.current!, publish: true };
        const booking = pullBooking(bkRef.current!, next, libsRef.current);
        await save({ action: 'publish', booking });
    });
    const requestTravelers = () => act('travelers', async () => {
        if (!preRef.current?.token) { adminNotify('고객 링크가 없는 요청이에요', 'error'); return; }
        if (!await adminConfirm({ title: '여행자 정보 입력을 요청할까요?', message: '현재 예약정보를 먼저 저장한 뒤 고객 페이지에 입력 안내를 표시합니다.', confirmLabel: '입력 요청 보내기' })) return;
        if (!await save({ quiet: true })) return;
        try { await patch({ notifyTravelers: true }); adminNotify('고객에게 여행자 정보 입력 요청을 보냈어요', 'success'); await reopen(); }
        catch (e) { adminNotify(e instanceof Error ? e.message : '요청 발송 실패', 'error'); }
    });
    const resetSign = () => act('resetSign', async () => {
        if (!await adminConfirm({ title: '서명을 초기화할까요?', message: '기존 서명 기록이 삭제되며 고객이 계약서에 다시 서명해야 합니다.', confirmLabel: '서명 초기화', danger: true })) return;
        const next = { ...formRef.current!, checklist: { ...formRef.current!.checklist, contract: false } };
        const booking = { ...pullBooking(bkRef.current!, next, libsRef.current), contract: null };
        if (await save({ resetContract: true, quiet: true, booking })) await reopen();
    });
    const travelNotice = () => act('travelNotice', async () => {
        const p = preRef.current!, tn = p.notify || {};
        const before = tn.travelNoticeSentAt ? `이미 ${String(tn.travelNoticeSentAt).slice(0, 10)}에 보냈어요. 다시 보낼까요?` : '고객에게 여행 주의사항 안내를 지금 보냅니다.';
        const who = p.phone ? `${p.name || '고객'}님(${p.phone})` : `${p.name || '고객'}님`;
        if (!await adminConfirm({ title: '여행 주의사항을 보낼까요?', message: `${before}\n${who}에게 여행 주의사항 PDF 링크가 발송됩니다.`, confirmLabel: '주의사항 발송' })) return;
        try {
            const j = await patch({ notifyTravelNotice: true });
            if (!j.travelNotice || !j.travelNotice.ok) throw new Error(travelNoticeError(j.travelNotice?.reason || '발송 실패'));
            setPre(old => (old ? { ...old, notify: j.notify || old.notify } : old));
            adminNotify('여행 주의사항을 고객에게 발송했어요', 'success'); onSaved();
        } catch (e) { adminNotify(e instanceof Error ? e.message : '발송 실패', 'error'); }
    });
    const revert = async () => {
        if (!savedRef.current) { adminNotify('되돌릴 저장본이 없어요', 'error'); return; }
        if (!await adminConfirm({ title: '변경 내용을 되돌릴까요?', message: '저장하지 않은 변경은 사라지고 마지막 저장 상태로 돌아갑니다.', confirmLabel: '되돌리기', danger: true })) return;
        const restored = normBooking(JSON.parse(savedRef.current));
        setBk(restored); setForm(formFromBooking(restored, preRef.current!)); setSyncKey(k => k + 1);
        adminNotify('마지막 저장 상태로 되돌렸어요', 'info');
    };
    const copyLink = () => {
        const p = preRef.current; if (!p?.token) { adminNotify('고객 토큰이 없는 요청이에요', 'error'); return; }
        navigator.clipboard.writeText(window.location.origin + bookingLinks(p).customer).then(() => adminNotify('고객 링크 복사 — 카톡으로 보내세요', 'success')).catch(() => adminNotify('복사 실패', 'error'));
    };
    /** 가이드 시트·가이드용 PDF: 저장한 뒤 인쇄 창을 연다(팝업 차단을 피하려 창을 먼저 연다) */
    const guideSheet = () => act('print', async () => {
        const win = window.open('about:blank', '_blank');
        if (!win) { adminNotify('팝업이 차단됐어요 — 이 사이트의 팝업을 허용해 주세요', 'error'); return; }
        win.document.write('<p>가이드 시트를 준비하고 있습니다…</p>');
        if (!await save({ quiet: true })) { win.close(); return; }
        const p = preRef.current!;
        try { win.sessionStorage.setItem('leaders_guide_sheet_print', JSON.stringify(guideSheetPayload({ ...p, booking: bkRef.current } as Parameters<typeof guideSheetPayload>[0]))); } catch { /* 큰 예약은 인쇄 창이 서버 원본을 읽는다 */ }
        win.location.replace(guideSheetHref(p.id));
    });
    const guidePdf = () => act('print', async () => {
        const p = preRef.current!;
        if (!p.quote) { adminNotify('발행된 견적이 없어 확정 일정표를 만들 수 없어요', 'error'); return; }
        if (!bkRef.current!.days.length) { adminNotify('확정 일정을 먼저 등록해 주세요', 'error'); return; }
        const win = window.open('about:blank', '_blank');
        if (!win) { adminNotify('팝업이 차단됐어요 — 이 사이트의 팝업을 허용해 주세요', 'error'); return; }
        win.document.write('<p>확정 일정표 PDF를 준비하고 있습니다…</p>');
        if (!await save({ quiet: true })) { win.close(); return; }
        try { localStorage.setItem('leaders_confirmed_print', JSON.stringify({ ...preRef.current, quote: p.quote, booking: { ...bkRef.current, publishStatus: 'published' } })); }
        catch { win.close(); adminNotify('브라우저 저장소를 쓸 수 없어 PDF를 열지 못했습니다.', 'error'); return; }
        win.location.replace('/확정일정표?adminPrint=1&print=1&m=0');
    });
    /** 확정일정표 알림(옛 itinerary-notice.js 창 — 미리보기 후 1회 발송) */
    const itineraryNotice = async () => {
        type NoticeWindow = Window & { ItineraryNotice?: { open: (args: { id: string; token: string }) => void } };
        const w = window as NoticeWindow;
        if (!w.ItineraryNotice) {
            if (!document.querySelector('link[data-itinerary-notice]')) { const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/itinerary-notice.css'; css.dataset.itineraryNotice = '1'; document.head.appendChild(css); }
            await new Promise<void>((resolve, reject) => { const s = document.createElement('script'); s.src = '/itinerary-notice.js'; s.onload = () => resolve(); s.onerror = () => reject(new Error('load')); document.head.appendChild(s); })
                .catch(() => adminNotify('확정일정표 알림 창을 불러오지 못했습니다. 다시 시도해 주세요.', 'error'));
        }
        w.ItineraryNotice?.open({ id: requestId, token });
    };

    useImperativeHandle(ref, () => ({
        flushAll() {
            if (busyRef.current) return { ok: false, busy: true };
            const current = snapshot();
            const isDirty = !!current && !!scope.current && !pendingRef.current && draftFingerprint(current) !== draftFingerprint(baseline.current);
            const error = flushDraft();
            return error ? { ok: false, busy: false, dirty: isDirty, error } : { ok: true, busy: false, dirty: isDirty };
        },
        // 작업 칸은 바깥 화면이 고른다(section). 여기서는 그 칸의 입력에 초점을 주고, 불러오는 중이면 불러온 뒤 준다.
        navigate(target) { navTarget.current = target; if (phase === 'ready') focusTarget(); return true; },
        run(action) {
            if (busyRef.current || pendingRef.current || phase !== 'ready') return false;
            ({ itineraryNotice, copyLink, guideSheet, guidePdf, travelNotice, revert } as Record<BookingRunAction, () => unknown>)[action]?.();
            return true;
        },
        links() {
            const p = preRef.current; if (!p) return null;
            const l = bookingLinks(p), bar = actionBar(p, bkRef.current || {});
            return { confirm: l.confirm ? window.location.origin + l.confirm : null, contract: l.contract ? window.location.origin + l.contract : null, hasQuote: !!p.quote,
                travelNoticeLabel: bar.travelNotice.label, travelNoticeDisabled: false, undoDisabled: !savedRef.current, locked: !!busyRef.current || !!pendingRef.current || phase !== 'ready' };
        },
    }));

    const derived = useMemo(() => (pre && bk ? { stats: assignStats(pre, bk), wf: workflowUi(pre, bk), bar: actionBar(pre, bk), links: bookingLinks(pre) } : null), [pre, bk]);
    const guideOptions = useMemo(() => Object.keys(libs.guides).map(name => ({ value: name, label: name })), [libs.guides]);
    const vehicleOptions = useMemo(() => Object.keys(libs.vehicles).map(name => ({ value: name, label: name })), [libs.vehicles]);
    const lodgeChoices = useMemo(() => lodgeOptions(libs.lodges, lodgeCats), [libs.lodges, lodgeCats]);

    if (phase === 'loading') return <AdminLoading inline label="예약을 불러오는 중…" />;
    if (phase === 'error' || !pre || !bk || !form || !derived) return <AdminError title="예약을 불러오지 못했어요" reason={loadError} onRetry={() => void open()} />;
    const { stats, wf, bar, links } = derived;
    const ci = bk.contractInfo || {}, ts = bk.travelerSubmission || {}, signedAt = bk.contract?.signedAt;
    const expectedTravelers = (Number(pre.adult) || 0) + (Number(pre.child) || 0) + (Number(pre.infant) || 0);
    const text = (label: React.ReactNode, value: string, onChange: (v: string) => void, extra: { id?: string; placeholder?: string; type?: string; list?: string; hint?: React.ReactNode; full?: boolean } = {}) => (
        <AdminField label={label} hint={extra.hint} className={extra.full ? 'is-full' : undefined} id={extra.id}>
            {(id, describedBy) => <AdminTextInput id={id} aria-describedby={describedBy} type={extra.type || 'text'} list={extra.list} placeholder={extra.placeholder} value={value} onChange={e => onChange(e.target.value)} />}
        </AdminField>
    );
    const select = (label: React.ReactNode, value: string, options: AdminSelectOption[], onChange: (v: string) => void) => (
        <AdminField label={label}>{(id) => <AdminSelect id={id} value={value} options={options} onChange={onChange} />}</AdminField>
    );
    const stage = [
        { key: 'deposit', state: bar.deposit, onClick: () => void sendStage('deposit') },
        { key: 'contract', state: bar.contract, onClick: () => void sendStage('contract'), only: ['docs', 'contract'] },
        { key: 'confirm', state: bar.confirm, onClick: () => void confirmBooking() },
        { key: 'publish', state: bar.publish, onClick: () => void publish() },
    ].filter(s => s.state.shown && (!s.only || s.only.includes(section)));
    const showContext = section === 'docs' || section === 'contract';
    const guide = form.guide, vehicle = form.vehicle;

    return (
        <div ref={root} className="qbe">
            {pending && pending.kind !== 'empty' && <AdminMessage tone="cautionary" role="alert"
                title={pending.kind === 'error' ? '초안을 복원하지 못했습니다' : pending.conflict ? '서버 원본과 다른 버전의 초안이 있습니다' : '작성 중이던 초안이 있습니다'}
                actions={<>
                    {pending.kind === 'draft' && <AdminButton size="sm" variant="primary" onClick={restoreDraft}>초안 복원</AdminButton>}
                    <AdminButton size="sm" variant="secondary" onClick={discardDraft}>초안 버리기</AdminButton>
                    {pending.kind === 'error' && <AdminButton size="sm" variant="secondary" onClick={() => { setDraftError(pending.error + ' 입력한 내용은 서버에 직접 저장해 주세요.'); setPending(null); }}>복원 없이 계속</AdminButton>}
                </>}>
                {pending.kind === 'error' ? pending.error : <>{pending.legacy && '이전 형식 초안이므로 현재 계정과 고객의 내용인지 확인해 주세요. '}복원하거나 버린 뒤 편집을 계속하세요.{pending.savedAt && ` (보관 ${new Date(pending.savedAt).toLocaleString('ko-KR')})`}</>}
            </AdminMessage>}
            {draftError && !pending && <AdminMessage tone="cautionary" role="alert">{draftError}</AdminMessage>}
            {cancelled && <AdminMessage tone="cautionary">취소된 예약입니다. 일정표는 고칠 수 없습니다.</AdminMessage>}

            <fieldset className="qbe-fieldset" disabled={locked}>
                {section === 'docs' && <>
                    <AdminCard id="qbe-docs" title="확정 일정표" actions={<>
                        {pre.quote && <AdminButton variant="secondary" size="sm" onClick={async () => {
                            if (bk.days.length && !await adminConfirm({ title: '견적 일정으로 교체할까요?', message: '현재 작성한 확정 일정은 견적서의 일정으로 바뀝니다.', confirmLabel: '일정 교체하기' })) return;
                            setBooking(b => ({ ...b, days: daysFromQuote(pre.quote) }), true); adminNotify('견적 일정을 가져왔어요 — 수정 후 저장하세요', 'info');
                        }}>견적 일정 불러오기</AdminButton>}
                    </>}>
                        {!bk.days.length && <p className="qbe-empty">아직 확정 일정이 없어요. <b>견적 일정 불러오기</b>를 누르면 발행한 견적서의 일정을 그대로 가져와 수정할 수 있어요.</p>}
                        <QuoteDayEditor days={bk.days.map((day: Json, i: number) => ({ ...day, d: i + 1 })) as React.ComponentProps<typeof QuoteDayEditor>['days']} startDate={pre.depart || ''} endDate={pre.return_ || ''} extras
                            snippets={snippets.items} snippetCats={snippets.cats} disabled={locked || cancelled} syncKey={String(syncKey)}
                            onField={(index, key, value) => setBooking(b => { const days = b.days.slice(), day = { ...days[index] }; if (!days[index]) return b;
                                if (key === 'move') Object.assign(day, value); else if (key === 'stay') day.stay = { ...(day.stay || {}), ...value }; else (day as Json)[key] = value;
                                days[index] = day; return { ...b, days }; })}
                            onSnippet={(index, name) => { const s = snippets.items[name]; if (!s) return;
                                setBooking(b => { const days = b.days.slice(), day = days[index]; if (!day) return b;
                                    days[index] = { ...day, dest: s.dest || '', move: s.move || '', dist: s.dist || '', items: [...(s.items || [])], meals: [...(s.meals || [])], stay: { ...(day.stay || {}), name: s.stay?.name || '', tags: [...(s.stay?.tags || [])] } };
                                    return { ...b, days }; }, true);
                                adminNotify('일정 조각을 초안에 적용했습니다', 'info'); }}
                            onDelete={async index => { const day = bkRef.current?.days[index]; if (!day) return;
                                const photos = (day.images || []).length || (day.activities || []).some((item: Json) => item?.images?.length) || day.stay?.img || day.stay?.imgs?.length;
                                if (photos && !await adminConfirm({ title: '사진이 포함된 일정을 삭제할까요?', message: '이 일차의 일정과 사진이 초안에서 삭제됩니다. 저장하기 전 원본은 유지됩니다.', confirmLabel: '일차 삭제' })) return;
                                setBooking(b => ({ ...b, days: b.days.filter((_: Json, i: number) => i !== index).map((d: Json, i: number) => ({ ...d, d: i + 1 })) }), true); }}
                            onReorder={(from, to) => setBooking(b => { if (from < 0 || to < 0 || from >= b.days.length || to >= b.days.length) return b;
                                const days = b.days.slice(); const [moved] = days.splice(from, 1); days.splice(to, 0, moved); return { ...b, days: days.map((d: Json, i: number) => ({ ...d, d: i + 1 })) }; }, true)}
                            onAdd={() => setBooking(b => ({ ...b, days: [...b.days, { d: b.days.length + 1, date: '', dest: '', move: '', dist: '', items: [], stay: { name: '', tags: [] }, meals: [] }] }), true)}
                            onNotice={message => adminNotify(message, 'info')}
                            renderDetails={index => <details className="qbe-tags"><summary>숙소 시설 태그 편집</summary>
                                <AdminTextInput aria-label="숙소 시설 태그" placeholder="전기 O, 샤워 O" disabled={locked || cancelled} defaultValue={(bk.days[index]?.stay?.tags || []).join(', ')}
                                    key={`${syncKey}:${index}`}
                                    onChange={e => { const tags = e.target.value.split(',').map(v => v.trim()).filter(Boolean); setBooking(b => { const days = b.days.slice(); if (!days[index]) return b; days[index] = { ...days[index], stay: { ...(days[index].stay || {}), tags } }; return { ...b, days }; }); }} />
                            </details>} />
                    </AdminCard>
                    <AdminCard title="대표 명소" description="고른 명소가 고객 확정일정표의 ‘대표 명소’ 페이지에 순서대로 나와요 · 여행지 관리에 등록한 목록">
                        <QuoteSpotSelector spots={spots.items} categories={spots.cats} selected={(bk.highlights || []).map((h: Json) => h && h.name).filter(Boolean)} disabled={locked}
                            onToggle={name => setBooking(b => ({ ...b, highlights: toggleHighlight(b.highlights || [], name, spots.items) }))} />
                    </AdminCard>
                </>}

                {/* 배정은 ‘가이드·숙소·차량’ 배정 현황과 ‘숙소 배정’ 메뉴에서만 한다(2026-11-24). 여기서는 저장된 결과만 보여 준다. */}
                {section === 'assign' && <AdminCard id="qbe-assign" title="가이드 · 차량 · 숙소" description="배정은 ‘가이드 배정 현황’과 ‘숙소 배정’ 메뉴에서 해요. 여기서는 배정 결과만 보여요."
                    actions={<>
                        <AdminButton variant="secondary" size="sm" to="/admin/quote-desk/resources?view=schedule">가이드·차량 배정</AdminButton>
                        <AdminButton variant="primary" size="sm" to={`/admin/accommodation-ops?open=${encodeURIComponent(requestId)}&source=quote_booking`}>숙소 배정</AdminButton>
                    </>}>
                    <div className="qbe-assign">
                        <section id="qbe-guide" className="qbe-box">
                            <div className="qbe-box-head"><b>가이드</b></div>
                            {guide.name ? <Preview kind="가이드" {...resourcePreview('guide', guide, libs)} /> : <p className="qbe-unassigned">가이드 미배정</p>}
                        </section>
                        <section id="qbe-vehicle" className="qbe-box">
                            <div className="qbe-box-head"><b>차량</b></div>
                            {vehicle.model ? <Preview kind="차량" {...resourcePreview('vehicle', bk.assign.vehicle, libs)} /> : <p className="qbe-unassigned">차량 미배정</p>}
                        </section>
                        <section id="qbe-lodges" className="qbe-box">
                            <div className="qbe-box-head"><b>일차별 숙소</b></div>
                            {bk.days.length > 0 && <p className="qbe-note">숙박 {stats.lodgeNeeded}일 기준 · 배정 {form.lodges.filter(row => row.name.trim()).length}일 (귀국일 제외)</p>}
                            {/* 숙박해야 하는 날마다 한 줄: 배정된 숙소, 없으면 ‘숙소 미배정’ */}
                            {Array.from({ length: Math.max(stats.lodgeNeeded || 0, ...form.lodges.map((row, i) => Number(row.day) || i + 1)) }, (_, i) => i + 1).map(day => {
                                const row = form.lodges.find((r, i) => (Number(r.day) || i + 1) === day && r.name.trim());
                                return <div key={day} className="qbe-lodge">
                                    <div className="qbe-box-head"><span>{day}일차 숙소</span></div>
                                    {row ? <Preview kind="숙소" {...lodgePreview({ name: row.name.trim(), grade: row.grade }, libs)} /> : <p className="qbe-unassigned">숙소 미배정</p>}
                                </div>;
                            })}
                            {!stats.lodgeNeeded && !form.lodges.length && <p className="qbe-note">숙박이 없는 일정이에요.</p>}
                        </section>
                    </div>
                </AdminCard>}

                {section === 'info' && <AdminCard id="qbe-info" title="주문자 · 여행자 정보" description="저장하면 내부 초안으로 보관됩니다 · 고객 발송은 단계 버튼을 누를 때만 진행됩니다">
                    <section id="qbe-travelers" className="qbe-box">
                        <div className="qbe-box-head"><b>여행자 정보</b><AdminButton variant="secondary" size="sm" onClick={() => void requestTravelers()}>고객에게 입력 요청</AdminButton></div>
                        <AdminMessage tone={ts.status === 'submitted' ? 'positive' : 'info'} title={ts.status === 'submitted' ? '고객 제출 완료' : ts.status === 'requested' ? '입력 요청 발송됨' : '고객이 직접 입력하는 정보입니다.'}>
                            {ts.status === 'submitted' ? `${Number(ts.submittedCount) || bk.travelers.length}/${Number(ts.expectedCount) || expectedTravelers}명 · ${String(ts.submittedAt || '').slice(0, 10)}`
                                : ts.status === 'requested' ? `${Number(ts.submittedCount) || 0}/${Number(ts.expectedCount) || expectedTravelers}명 · 고객 제출 대기 중`
                                : '요청 버튼을 누르면 고객 페이지에 입력 안내가 표시됩니다. 관리자는 예외 상황에서만 아래 항목을 수정해 주세요.'}
                        </AdminMessage>
                        {form.travelers.map((t, i) => {
                            const set = (key: keyof typeof t, value: string) => updateForm(f => ({ ...f, travelers: f.travelers.map((r, j) => j === i ? { ...r, [key]: value } : r) }));
                            return <div key={i} className="qbe-traveler">
                                <div className="qbe-box-head"><span>여행자 {i + 1} · {t.type || '성인'}</span>
                                    <AdminIconButton size="sm" label={`여행자 ${i + 1} 삭제`} onClick={() => updateForm(f => ({ ...f, travelers: f.travelers.filter((_, j) => j !== i) }))}><IconClose /></AdminIconButton></div>
                                <div className="adm-ui-form-grid qbe-grid-3">
                                    {text('한글명', t.nameKo, v => set('nameKo', v), { placeholder: '김세준' })}
                                    {text('여권명', t.passportName, v => set('passportName', v), { placeholder: 'KIM SEJUN' })}
                                    {text('생년월일', t.birth, v => set('birth', v), { placeholder: '2002.11.02' })}
                                    {text('연락처', t.phone, v => set('phone', v), { placeholder: '010-0000-0000' })}
                                    {select('성별', t.gender, TRAVELER_GENDERS.map(g => ({ value: g, label: g || '선택' })), v => set('gender', v))}
                                    {text('여권번호', t.passportNo, v => set('passportNo', v))}
                                </div>
                            </div>;
                        })}
                        <div className="qbe-add"><AdminButton variant="secondary" size="sm" leading={<IconPlus />} onClick={() => updateForm(f => ({ ...f, travelers: [...f.travelers, travelerRowOf({})] }))}>관리자 직접 입력 (예외 처리)</AdminButton></div>
                        <AdminField label="특이사항 (고객 입력 — 고혈압·거동 불편·채식 등)">{(id) => <AdminTextArea id={id} minRows={3} value={form.travelerNote} placeholder="고객이 여행자 정보 입력 화면에서 적은 내용이 표시됩니다" onChange={e => field('travelerNote', e.target.value)} />}</AdminField>
                    </section>
                    <section id="qbe-flight" className="qbe-box">
                        <div className="qbe-box-head"><b>항공 정보</b><small>시간은 24시간 기준 (고객이 여행자 정보 입력 때 함께 작성)</small></div>
                        <div className="adm-ui-form-grid qbe-grid-4">
                            {text('몽골 도착일', form.flight.inDate, v => sub('flight', { inDate: v }), { placeholder: '2026-08-25' })}
                            {text('도착편 출발시간', form.flight.inDepTime, v => sub('flight', { inDepTime: v }), { placeholder: '20:30' })}
                            {text('몽골 도착시간', form.flight.inTime, v => sub('flight', { inTime: v }), { placeholder: '04:30' })}
                            {text('도착 항공편명', form.flight.inNo, v => sub('flight', { inNo: v }), { placeholder: 'OM310' })}
                            {text('몽골 출발일', form.flight.outDate, v => sub('flight', { outDate: v }), { placeholder: '2026-08-31' })}
                            {text('몽골 출발시간', form.flight.outTime, v => sub('flight', { outTime: v }), { placeholder: '20:30' })}
                            {text('출발편 도착시간', form.flight.outArrTime, v => sub('flight', { outArrTime: v }), { placeholder: '06:15' })}
                            {text('출발 항공편명', form.flight.outNo, v => sub('flight', { outNo: v }), { placeholder: 'OM309' })}
                        </div>
                        {text('픽업·샌딩 숙소명 (울란바타르 출발·도착 팀 — 고객 입력)', form.pickupLodge, v => field('pickupLodge', v), { placeholder: '예: 샹그릴라 울란바타르 호텔' })}
                    </section>
                </AdminCard>}

                {section === 'pay' && <AdminCard id="qbe-pay" title="결제 · 계약 정산 정보">
                    <div className="adm-ui-form-grid qbe-grid-3">
                        {text('여행상품명', form.contract.productName, v => sub('contract', { productName: v }), { list: 'qbe-products', placeholder: '선택 또는 직접 입력' })}
                        {text('여행지역', form.contract.region, v => sub('contract', { region: v }), { list: 'qbe-regions', placeholder: '선택 또는 직접 입력' })}
                        {text('현금영수증', form.contract.cashReceipt, v => sub('contract', { cashReceipt: v }), { list: 'qbe-receipts', placeholder: '선택 또는 직접 입력' })}
                        {text('여행경비', form.contract.totalAmount, v => sub('contract', { totalAmount: v }), { type: 'number', placeholder: '6900000' })}
                        {text('예약금', form.contract.depositAmount, v => sub('contract', { depositAmount: v }), { type: 'number', placeholder: '250000' })}
                        {text('잔금', form.contract.balanceAmount, v => sub('contract', { balanceAmount: v }), { type: 'number', placeholder: '6650000' })}
                        {select('예약금 상태', form.contract.depositStatus, DEPOSIT_STATUSES.map(v => ({ value: v, label: v })), v => sub('contract', { depositStatus: v }))}
                        {select('잔금 상태', form.contract.balanceStatus, BALANCE_STATUSES.map(v => ({ value: v, label: v })), v => sub('contract', { balanceStatus: v }))}
                        {select('계약 패키지 유형', form.contract.packageType, PACKAGE_TYPES.map(([value, label]) => ({ value, label })), v => sub('contract', { packageType: v }))}
                        {text('입금 은행', form.contract.bankName, v => sub('contract', { bankName: v }), { placeholder: '예: 국민은행' })}
                        {text('입금 계좌번호', form.contract.accountNumber, v => sub('contract', { accountNumber: v }), { placeholder: '예: 123-456-789012' })}
                        {text('예금주', form.contract.accountHolder, v => sub('contract', { accountHolder: v }), { placeholder: '예: 몽골리아은하수' })}
                        <AdminField label="계약서 비고/기타사항" className="is-full">{(id) => <AdminTextArea id={id} minRows={3} value={form.contract.note} placeholder="추가 안내사항" onChange={e => sub('contract', { note: e.target.value })} />}</AdminField>
                    </div>
                    {wf.task.action === 'confirmDeposit' && <AdminMessage tone="info" title={wf.task.title} actions={<AdminButton size="sm" variant="primary" onClick={() => void confirmDeposit()}>{wf.task.button}</AdminButton>}>{wf.task.desc}</AdminMessage>}
                </AdminCard>}

                {section === 'contract' && <AdminCard id="qbe-contract" title="여행 계약서">
                    <AdminCheckbox checked={form.checklist.contract} disabled label="여행계약서 서명 (고객 서명 시 자동 체크)" />
                    {signedAt ? <div className="qbe-sign">
                        <p><b>{String(signedAt).replace('T', ' ').slice(0, 16)} 서명 완료</b> ({bk.contract.signerName || pre.name})</p>
                        {bk.contract.signImg ? <figure className="qbe-sign-img"><figcaption>고객 서명 원본</figcaption><img src={bk.contract.signImg} alt={`${bk.contract.signerName || pre.name} 고객 서명`} /></figure>
                            : <AdminMessage tone="cautionary">서명 기록은 있으나 원본 이미지가 없습니다. 계약서 화면에서 관리자 인증 상태를 확인해 주세요.</AdminMessage>}
                        <div className="qbe-add">
                            <AdminButton variant="secondary" size="sm" trailing={<IconExternal />} onClick={() => window.open(links.contract, '_blank', 'noopener')}>서명 원본 확인</AdminButton>
                            <AdminButton variant="danger" size="sm" onClick={() => void resetSign()}>서명 초기화</AdminButton>
                        </div>
                    </div> : <AdminMessage tone={ci.depositStatus === '입금완료' ? 'info' : 'cautionary'}
                        title={ci.depositStatus === '입금완료' ? (bk.contractRequest?.status === 'requested' ? '고객 서명 대기' : '서명 요청 전') : '예약금 확인 전'}
                        actions={ci.depositStatus === '입금완료' && links.contract ? <AdminButton size="sm" variant="secondary" trailing={<IconExternal />} onClick={() => window.open(links.contract, '_blank', 'noopener')}>계약서 미리보기</AdminButton> : undefined}>
                        {ci.depositStatus === '입금완료' ? (bk.contractRequest?.status === 'requested' ? '고객에게 계약서 서명 요청을 보냈습니다.' : '예약금 확인이 완료됐습니다. 아래의 계약서 요청 버튼을 눌러 주세요.') : '예약금 입금 확인 전에는 고객에게 서명을 요구하지 않습니다.'}
                    </AdminMessage>}
                </AdminCard>}

                {section === 'notes' && <AdminCard id="qbe-notes" title="운영 · 내부 메모">
                    <div className="qbe-checks">
                        <AdminCheckbox checked={form.checklist.deposit} onChange={v => sub('checklist', { deposit: v })} label="예약금 입금 확인" />
                        <AdminCheckbox checked={form.checklist.balance} onChange={v => sub('checklist', { balance: v })} label="잔금 수령 (현장)" />
                        <AdminCheckbox checked={form.checklist.flight} onChange={v => sub('checklist', { flight: v })} label="항공권 발권 확인" />
                        <AdminCheckbox checked={form.checklist.insurance} onChange={v => sub('checklist', { insurance: v })} label="여행자 보험 가입 안내" />
                    </div>
                    <p className="qbe-note">예약금·잔금 체크는 결제 칸의 입금 상태를 따라 저장됩니다.</p>
                    <div className="adm-ui-form-grid">
                        <AdminField label="추가 메모 (내부 참고용 — 고객에게 보이지 않음)">{(id) => <AdminTextArea id={id} minRows={3} value={form.notes} placeholder="예: 공항 픽업 4:30 입국게이트 앞 — 가이드에게 전달" onChange={e => field('notes', e.target.value)} />}</AdminField>
                        <AdminField label="내부 메모 (고객에게 안 보임)" id="qbe-memo">{(id) => <AdminTextArea id={id} minRows={3} value={form.memo} onChange={e => field('memo', e.target.value)} />}</AdminField>
                    </div>
                </AdminCard>}
            </fieldset>

            {section !== 'log' && <div className="adm-ui-form-bar qbe-bar" role="region" aria-label="저장과 다음 단계">
                <div className="adm-ui-form-bar-status qbe-bar-status">{showContext && <><small>{bar.bottomStep}</small><b>{bar.bottomTask}</b></>}
                    {!stats.missing.length ? <AdminBadge tone="success">필수 항목 완료</AdminBadge> : null}</div>
                <div className="adm-ui-form-bar-actions">
                    {stage.map(s => <AdminButton key={s.key} variant="primary" disabled={locked || s.state.disabled} loading={busy === s.key} onClick={s.onClick}>{s.state.label}</AdminButton>)}
                    <AdminButton variant={bar.saveSecondary && stage.length ? 'secondary' : 'primary'} disabled={locked} loading={busy === 'save'} onClick={() => void act('save', () => save())}>{bar.saveLabel}</AdminButton>
                </div>
            </div>}

            <datalist id="qbe-guide-list">{Object.keys(libs.guides).map(n => <option key={n} value={n} />)}</datalist>
            <datalist id="qbe-vehicle-list">{Object.keys(libs.vehicles).map(n => <option key={n} value={n} />)}</datalist>
            <datalist id="qbe-lodge-list">{Object.keys(libs.lodges).map(n => <option key={n} value={n} />)}</datalist>
            <datalist id="qbe-guide-roles">{GUIDE_ROLES.map(n => <option key={n} value={n} />)}</datalist>
            <datalist id="qbe-products">{PRODUCT_NAMES.map(n => <option key={n} value={n} />)}</datalist>
            <datalist id="qbe-regions">{REGIONS.map(n => <option key={n} value={n} />)}</datalist>
            <datalist id="qbe-receipts">{CASH_RECEIPTS.map(n => <option key={n} value={n} />)}</datalist>
        </div>
    );

});
