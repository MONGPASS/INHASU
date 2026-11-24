import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { AdminLayout } from '../components/admin/AdminLayout';
import {
    AdminBadge, AdminButton, AdminCard, AdminChipGroup, AdminDialog, AdminEmpty, AdminError, AdminField, AdminIconButton, AdminLoading, AdminMessage,
    AdminPickCard, AdminSegmented, AdminTable, AdminTabs, AdminTbody, AdminTd, AdminTextArea, AdminTextButton, AdminTextInput, AdminTh, AdminThead, AdminTr,
    IconClose, IconCopy, IconPlus,
} from '../components/admin/ui';
import { adminConfirm, adminNotify } from '../components/admin/ui/adminFeedback';
import { QuoteDayEditor } from '../components/admin/QuoteDayEditor';
import { QuoteSpotSelector } from '../components/admin/QuoteSpotSelector';
import { connectQuoteDesk, findQuoteDeskTool, quoteDeskPageId } from '../components/admin/quoteDesk';
import { loadFallbackCourses, loadFallbackSnippets, loadFallbackSpots, loadQuoteBase } from '../components/admin/quoteLibrary';
import { readQuoteLibrary, type QuoteLibraryKey } from '../components/admin/quoteLibraryStore';
import {
    INTENSITY_DESC, ROOM_ECO, ROOM_FULL, applyCourse, autoQuoteNo, balEco, balFull, buildQuote, customerQuoteLink, dayCountCheck, dayDateStr, dayFromSnippet, emptyContext, emptyDay,
    emptyQuoteState, estimateTotal, importQuoteContent, matchCourse, nightsOf, renumber, restoreFromQuote, savePayload, sortedCourses, stateFromRequest, validEmail,
    type Json, type QuoteDay, type QuoteState, type RequestContext,
} from '../components/admin/quoteBuilder';
import { draftFingerprint, readDraft, removeDraft, validQuoteDraft, writeDraft, type DraftRead, type DraftScope } from '../components/admin/quoteDraftStore';
import { loadQuoteCustomerRequest } from '../utils/quoteCustomerWorkspace';
import { KAKAO_CHANNEL_URL } from '../constants/company';
import './AdminQuoteBuilder.css';

/**
 * 견적서 만들기(`/admin/quote-desk/builder`) — 옛 도구 public/견적만들기.html을 React로 옮겼다(iframe 대신).
 * 단계 5개(기본 정보·코스 → 일자별 일정 → 요금 → 대표 명소 → 혜택·비고) + 아래 막대(예상 총액·이전/다음·저장).
 * - 견적 문서는 components/admin/quoteBuilder.ts의 buildQuote(옛 도구와 같은 칸)로 만들고, 같은 `/api/requests`에 저장한다.
 *   저장하기 = 서버 저장만(silentQuote), 링크 공유하기 = 저장 + 고객 알림톡(notifyQuote) + 고객 링크.
 * - 초안은 옛 편집기(quote-editor-state.js)와 같은 자리·형식(quoteDraftStore.ts)으로 이 브라우저에 보관한다.
 * - 고객 통합 작업 화면 안의 견적 편집(iframe `/견적만들기?id=`)은 아직 옛 문서를 쓴다.
 */
const tool = findQuoteDeskTool('builder');
const STEPS = ['기본정보 · 코스', '일자별 일정', '요금', '대표 명소', '혜택 · 비고'] as const;
const DEFAULT_SPOT_CATS = ['고비', '중앙', '북부', '서부'];
const LEGACY_DRAFT = 'leaders_quote_draft';

interface Library { courses: Record<string, Json>; spots: Record<string, Json>; spotCats: string[]; snippets: Record<string, Json>; snippetCats: string[] }
type Phase = 'connecting' | 'loading' | 'ready' | 'unset' | 'error';

const localJson = (key: string): unknown => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const isMap = (value: unknown): value is Record<string, Json> => !!value && typeof value === 'object' && !Array.isArray(value);
const isList = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');

/** 옛 도구와 같은 순서: 서버 자료 → 이 브라우저 저장분 → 기본값(presets.js) */
async function loadLibrary(token: string): Promise<Library> {
    const read = async (key: QuoteLibraryKey) => { try { return (await readQuoteLibrary(key, token)).data; } catch { return null; } };
    const [courses, spots, spotCats, snippets, snippetCats] = await Promise.all(['courses', 'spots', 'spot_cats', 'snippets', 'snippet_cats'].map(key => read(key as QuoteLibraryKey)));
    return {
        courses: isMap(courses) ? courses : (await loadFallbackCourses().catch(() => ({}))) as Record<string, Json>,
        spots: isMap(spots) ? spots : (await loadFallbackSpots().catch(() => ({}))) as Record<string, Json>,
        spotCats: isList(spotCats) ? spotCats : isList(localJson('leaders_spot_cats')) ? localJson('leaders_spot_cats') as string[] : DEFAULT_SPOT_CATS.slice(),
        snippets: isMap(snippets) ? snippets : (await loadFallbackSnippets().catch(() => ({}))) as Record<string, Json>,
        snippetCats: isList(snippetCats) ? snippetCats : isList(localJson('leaders_snippet_cats')) ? localJson('leaders_snippet_cats') as string[] : [],
    };
}

/** 다른 화면에서 넘겨준 값(한 번만 읽고 지운다): 코스 관리의 공유 견적, 옛 견적 문의의 견적 작성 */
function takeHandoffs(params: URLSearchParams): { shareCourse: string; anonymous: boolean; prefillId: string } {
    let shareCourse = params.get('course') || '', anonymous = params.get('share') === '1', prefillId = '';
    try {
        const share = JSON.parse(sessionStorage.getItem('leaders_course_share') || 'null');
        if (share && share.course) { shareCourse = share.course; anonymous = !!share.anonymous; }
        sessionStorage.removeItem('leaders_course_share');
    } catch { /* 저장소를 쓸 수 없는 창 */ }
    try {
        const pre = JSON.parse(localStorage.getItem('leaders_prefill') || 'null');
        if (pre) { prefillId = String(pre.id || ''); localStorage.removeItem('leaders_prefill'); }
    } catch { /* 저장소를 쓸 수 없는 창 */ }
    return { shareCourse, anonymous, prefillId };
}

export const AdminQuoteBuilder: React.FC = () => {
    const { user } = useUser();
    const accountId = user?.role === 'admin' ? user.id : '';
    const [params, setParams] = useSearchParams();
    const paramsRef = useRef(params); paramsRef.current = params;
    const [phase, setPhase] = useState<Phase>('connecting');
    const [loadError, setLoadError] = useState('');
    const [base, setBase] = useState<Json>({});
    const [lib, setLib] = useState<Library>({ courses: {}, spots: {}, spotCats: [], snippets: {}, snippetCats: [] });
    const [st, setSt] = useState<QuoteState>(() => emptyQuoteState({}));
    const [ctx, setCtx] = useState<RequestContext>(emptyContext);
    const [autoNo, setAutoNo] = useState(() => autoQuoteNo());
    const [step, setStep] = useState(0);
    const [syncKey, setSyncKey] = useState(0);
    const [pickedCourse, setPickedCourse] = useState('');
    const [pending, setPending] = useState<DraftRead | null>(null);
    const [draftError, setDraftError] = useState('');
    const [busy, setBusy] = useState<'' | 'save' | 'share'>('');
    const [link, setLink] = useState('');
    const [clone, setClone] = useState<{ open: boolean; loading: boolean; error: string; items: Json[] }>({ open: false, loading: false, error: '', items: [] });
    const [optionDraft, setOptionDraft] = useState({ label: '', calc: '' });
    const [balanceDraft, setBalanceDraft] = useState({ pax: '', eco: '', full: '' });
    const token = useRef('');
    const boot = useRef(0);
    const handoff = useRef<ReturnType<typeof takeHandoffs> | null>(null);
    const stRef = useRef(st); stRef.current = st;
    const scope = useRef<DraftScope | null>(null);
    const baseline = useRef<unknown>(null);
    const lastStored = useRef('');
    const legacyOwned = useRef(false);
    const pendingRef = useRef(pending); pendingRef.current = pending;
    const busyRef = useRef(busy); busyRef.current = busy;

    // ── 처음 열기: 연결 → 기본값·자료 → (요청이면) 원본 → 시작 내용 → 초안 확인 ──
    const start = useCallback(async () => {
        const run = ++boot.current;
        if (!accountId) return;
        setLoadError('');
        try {
            setPhase('connecting');
            const value = token.current || await connectQuoteDesk({ accountId });
            if (run !== boot.current) return;
            if (!value) { setPhase('unset'); return; }
            token.current = value;
            setPhase('loading');
            handoff.current ??= takeHandoffs(paramsRef.current);
            const { shareCourse, anonymous, prefillId } = handoff.current;
            const [quoteBase, library] = await Promise.all([loadQuoteBase(), loadLibrary(value)]);
            if (run !== boot.current) return;
            let s = emptyQuoteState(quoteBase), c: RequestContext = { ...emptyContext(), anonymousShare: anonymous };
            let legacyId = '';
            const legacy = localJson(LEGACY_DRAFT) as Json | null;
            if (!prefillId && !shareCourse && legacy?.st && validQuoteDraft(legacy.st)) legacyId = String(legacy.reqId || '');
            const id = paramsRef.current.get('id') || prefillId || legacyId;
            let restore: Json | null = null;
            if (id) {
                const item = await loadQuoteCustomerRequest(id, value).catch(error => { throw new Error(error?.status === 404 ? '이 견적의 원본을 찾지 못했습니다. 견적 문의 목록에서 다시 열어 주세요.' : '이 견적의 원본을 불러오지 못했습니다. 다시 시도해 주세요.'); });
                if (run !== boot.current) return;
                const r = stateFromRequest(s, item, c);
                s = r.st; c = r.ctx; restore = r.quote;
            }
            let picked = '', message = '';
            const restored = restore ? restoreFromQuote(s, restore, quoteBase) : null;
            if (restored) {
                s = restored.st;
                if (restored.reqProfile) c = { ...c, reqProfile: restored.reqProfile, reqSpots: restored.reqSpots || [] };
                message = '발행된 견적서를 불러왔습니다 — 수정 후 다시 발행하세요';
            } else if (c.fromReq) {
                const matched = matchCourse(s.destination, library.courses);
                if (matched) { s = applyCourse(s, library.courses[matched], { keepCustomer: true, reqSpots: c.reqSpots, spotLib: library.spots }); picked = matched; }
                else s = { ...s, spots: c.reqSpots.filter(name => library.spots[name]) };
            } else if (shareCourse && library.courses[shareCourse]) {
                c = { ...c, anonymousShare: true };
                s = applyCourse({ ...s, customer: '' }, library.courses[shareCourse]); picked = shareCourse;
                message = `“${shareCourse}” 공유 견적 — 고객 정보 없이 발행할 수 있어요`;
            } else {
                const first = Object.keys(library.courses)[0];
                if (first) { s = applyCourse(s, library.courses[first]); picked = first; message = `“${first}” 코스를 불러왔습니다`; }
            }
            setBase(quoteBase); setLib(library); setSt(s); setCtx(c); setPickedCourse(picked); setAutoNo(autoQuoteNo()); setStep(0); setSyncKey(k => k + 1);
            if (c.reqId && paramsRef.current.get('id') !== c.reqId) { const q = new URLSearchParams(paramsRef.current); q.set('id', c.reqId); setParams(q, { replace: true }); }
            // 초안: 옛 편집기와 같은 자리(계정·종류·요청 ID). 원본과 다르면 복원/버리기를 고를 때까지 편집을 잠근다.
            scope.current = { account: accountId, kind: 'quote', requestId: c.reqId };
            baseline.current = s; lastStored.current = '';
            let found: DraftRead | null = null;
            try { found = readDraft(localStorage, scope.current, s, validQuoteDraft, LEGACY_DRAFT); }
            catch { found = { kind: 'error', error: '브라우저 저장소를 사용할 수 없어 초안을 확인하지 못했습니다.' }; }
            legacyOwned.current = found?.kind === 'draft' && found.legacy;
            setPending(found && found.kind !== 'empty' ? found : null);
            setDraftError('');
            setPhase('ready');
            if (message && !(found && found.kind !== 'empty')) adminNotify(message, 'info');
        } catch (error) {
            if (run !== boot.current) return;
            setLoadError(error instanceof Error ? error.message : String(error));
            setPhase('error');
        }
    }, [accountId, setParams]);

    useEffect(() => { token.current = ''; void start(); return () => { boot.current++; }; }, [start]);

    // ── 초안 보관: 고칠 때마다 잠시 뒤 이 브라우저에 보관(원본과 같으면 보관하지 않는다) ──
    const flushDraft = useCallback((): boolean => {
        if (!scope.current || pendingRef.current) return true;
        const current = draftFingerprint(stRef.current);
        if (current === draftFingerprint(baseline.current) || current === lastStored.current) return true;
        let result: ReturnType<typeof writeDraft>;
        try { result = writeDraft(localStorage, scope.current, baseline.current, stRef.current); }
        catch { result = { ok: false, error: '브라우저 저장소를 사용할 수 없어 초안을 보관하지 못했습니다.' }; }
        if (result.ok) { lastStored.current = current; setDraftError(''); return true; }
        setDraftError(result.error); return false;
    }, []);
    const commitDraft = (nextRequestId: string) => {
        if (!scope.current) return;
        const removed = removeDraft(localStorage, scope.current, legacyOwned.current ? LEGACY_DRAFT : undefined);
        if (!removed.ok) adminNotify('저장은 완료됐지만 이전 초안을 지우지 못했습니다. ' + removed.error, 'error');
        legacyOwned.current = false;
        scope.current = { ...scope.current, requestId: nextRequestId };
        baseline.current = stRef.current; lastStored.current = ''; setDraftError('');
    };
    useEffect(() => {
        if (phase !== 'ready' || pending) return;
        const timer = window.setTimeout(flushDraft, 400);
        return () => window.clearTimeout(timer);
    }, [st, phase, pending, flushDraft]);
    useEffect(() => {
        const onHide = () => { flushDraft(); };
        const onLeave = (event: BeforeUnloadEvent) => { if (busyRef.current) { event.preventDefault(); event.returnValue = ''; } else flushDraft(); };
        window.addEventListener('pagehide', onHide); window.addEventListener('beforeunload', onLeave);
        return () => { window.removeEventListener('pagehide', onHide); window.removeEventListener('beforeunload', onLeave); flushDraft(); };
    }, [flushDraft]);

    const restoreDraft = () => {
        if (pending?.kind !== 'draft') return;
        setSt(old => ({ ...old, ...(pending.value as Partial<QuoteState>) })); setSyncKey(k => k + 1);
        setPending(null); lastStored.current = '';
        adminNotify('초안을 복원했습니다. 저장해야 서버에 반영됩니다.', 'info');
    };
    const discardDraft = () => {
        if (!scope.current) return;
        const removed = removeDraft(localStorage, scope.current, legacyOwned.current ? LEGACY_DRAFT : undefined);
        if (!removed.ok) { setDraftError(removed.error); return; }
        legacyOwned.current = false; setPending(null);
    };
    const continueWithoutDraft = () => { if (pending?.kind === 'error') { setDraftError(pending.error + ' 입력한 내용은 서버에 직접 저장해 주세요.'); setPending(null); } };

    // ── 편집 ──
    const patch = (next: Partial<QuoteState>) => setSt(old => ({ ...old, ...next }));
    const locked = !!busy || !!pending;
    const loadCourse = (name: string) => {
        const course = lib.courses[name]; if (!course) return;
        setSt(old => applyCourse(old, course)); setPickedCourse(name); setSyncKey(k => k + 1);
        adminNotify(`“${name}” 코스를 불러왔습니다`, 'info');
    };
    const setDay = (index: number, field: string, value: any) => setSt(old => {
        const days = old.days.slice(), day = { ...days[index] };
        if (field === 'move') { day.move = value.move; day.dist = value.dist; }
        // 숙소 이름만 바꿀 때 그 숙소의 다른 칸(사진·설명 등)은 남긴다
        else if (field === 'stay') day.stay = { ...(day.stay || {}), ...value };
        else (day as Json)[field] = value;
        days[index] = day; return { ...old, days };
    });
    const setDays = (days: QuoteDay[]) => { setSt(old => ({ ...old, days })); setSyncKey(k => k + 1); };
    const fillDates = () => {
        if (!st.depart) { adminNotify('기본 정보에서 출발일을 먼저 입력하세요.', 'error'); return; }
        setDays(st.days.map((day, i) => ({ ...day, date: dayDateStr(st.depart, i) })));
        adminNotify('출발일 기준으로 여행일자를 채웠어요 — 각 칸에서 자유롭게 고칠 수 있어요.', 'info');
    };
    const addOption = () => {
        const label = optionDraft.label.trim(), calc = optionDraft.calc.trim();
        if (!label) { adminNotify('항목 이름을 입력하세요.', 'error'); return; }
        patch({ options: [...st.options, { label, calc }] }); setOptionDraft({ label: '', calc: '' });
    };
    const addBalance = () => {
        const pax = parseInt(balanceDraft.pax), eco = parseInt(balanceDraft.eco), full = parseInt(balanceDraft.full);
        if (isNaN(pax) || (isNaN(eco) && isNaN(full))) { adminNotify('인원과 금액을 입력하세요.', 'error'); return; }
        const exists = st.balances.some(b => b.pax === pax);
        patch({ balances: exists ? st.balances.map(b => b.pax === pax ? { ...b, economy: eco || 0, full: full || 0 } : b) : [...st.balances, { pax, economy: eco || 0, full: full || 0 }] });
        setBalanceDraft({ pax: '', eco: '', full: '' });
    };
    const setBalance = (pax: number, key: 'economy' | 'full', value: string) =>
        patch({ balances: st.balances.map(b => b.pax === pax ? { ...b, [key]: parseInt(value) || 0 } : b) });
    const sortedBalances = useMemo(() => st.balances.slice().sort((a, b) => a.pax - b.pax), [st.balances]);

    const quote = () => buildQuote(stRef.current, base, { quoteNo: stRef.current.quoteNo || autoNo, reqProfile: ctx.reqProfile, reqSpots: ctx.reqSpots, spotLib: lib.spots });
    const preview = (doc: '/견적서' | '/일정지도') => {
        try { localStorage.setItem('leaders_quote', JSON.stringify(quote())); }
        catch { adminNotify('브라우저 저장소를 쓸 수 없어 미리보기를 열지 못했습니다.', 'error'); return; }
        if (!window.open(doc, '_blank')) adminNotify('팝업을 허용한 뒤 다시 열어 주세요.', 'error');
    };

    const openClone = async () => {
        setClone({ open: true, loading: true, error: '', items: [] });
        try {
            const res = await fetch('/api/requests', { headers: { 'x-admin-token': token.current }, cache: 'no-store' });
            if (res.status === 401) throw new Error('관리자 인증이 만료됐어요. 화면을 새로 고쳐 주세요.');
            if (!res.ok) throw new Error(`목록을 불러오지 못했어요(${res.status}).`);
            const body = await res.json();
            setClone({ open: true, loading: false, error: '', items: (body.items || []).filter((x: Json) => x && x.quote && x.id !== ctx.reqId) });
        } catch (error) { setClone({ open: true, loading: false, error: error instanceof Error ? error.message : String(error), items: [] }); }
    };
    const pickClone = async (item: Json) => {
        const who = item.quote?.customer || item.name || '이 고객';
        if (st.days.length && !await adminConfirm({ title: '다른 견적에서 복제', confirmLabel: '복제',
            message: `현재 일정·명소·요금을 “${who}” 견적 내용으로 바꿉니다.\n고객명·날짜·인원은 그대로 둡니다. 계속할까요?` })) return;
        const next = importQuoteContent(stRef.current, item.quote);
        if (!next) return;
        setSt(next); setSyncKey(k => k + 1); setClone(c => ({ ...c, open: false }));
        adminNotify(`“${who}” 견적을 복제했습니다 — 고객 정보만 확인한 뒤 발행하세요.`, 'success');
    };

    const reset = async () => {
        if (!await adminConfirm({ title: '초기화', confirmLabel: '모두 지우기', danger: true, message: '입력한 내용을 모두 지울까요?' })) return;
        try { localStorage.removeItem('leaders_quote'); } catch { /* 저장소를 쓸 수 없는 창 */ }
        setSt(emptyQuoteState(base)); setPickedCourse(''); setAutoNo(autoQuoteNo()); setStep(0); setSyncKey(k => k + 1);
        if (scope.current) removeDraft(localStorage, scope.current, legacyOwned.current ? LEGACY_DRAFT : undefined);
        lastStored.current = '';
        adminNotify('초기화되었습니다.', 'info');
    };

    /** 저장하기 = 서버 저장만(고객 알림 없음) · 링크 공유하기 = 저장 + 고객 알림톡 + 고객 링크(옛 runSave) */
    const runSave = async (share: boolean) => {
        if (busy || pending || phase !== 'ready') return;
        let s = stRef.current;
        const email = (s.email || '').trim();
        if (!validEmail(email)) { adminNotify('예약자 이메일 주소를 확인해 주세요.', 'error'); setStep(0); return; }
        if (!s.customer.trim() && !ctx.anonymousShare) { adminNotify('먼저 고객명을 입력하세요.', 'error'); setStep(0); return; }
        if (ctx.anonymousShare && !s.customer.trim()) { s = { ...s, customer: '여행 고객' }; setSt(s); stRef.current = s; }
        if (share && !await adminConfirm({ title: '고객에게 견적 보내기', confirmLabel: '보내기',
            message: '이 견적을 고객에게 보낼까요?\n고객에게 견적서 도착 알림톡이 발송되고, 보낼 링크가 만들어집니다.' })) return;
        flushDraft();
        setBusy(share ? 'share' : 'save');
        try {
            const q = buildQuote(s, base, { quoteNo: s.quoteNo || autoNo, reqProfile: ctx.reqProfile, reqSpots: ctx.reqSpots, spotLib: lib.spots });
            const payload = savePayload(s, q, ctx, share);
            let next: RequestContext = ctx, notification: Json | null = null;
            const res = await fetch(payload.method === 'PATCH' ? `/api/requests/${encodeURIComponent(payload.id)}` : '/api/requests', {
                method: payload.method, headers: { 'Content-Type': 'application/json', 'x-admin-token': token.current }, body: JSON.stringify(payload.body),
            });
            if (res.status === 401) throw new Error('관리자 인증이 만료됐어요. 화면을 새로 고쳐 주세요.');
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body.ok) throw new Error(body.error || `서버 오류(${res.status})`);
            notification = (body.notifications || []).find((x: Json) => x.type === 'quote') || null;
            if (payload.method === 'POST') {
                if (!body.token) throw new Error('고객 링크 값을 받지 못했습니다.');
                next = { ...ctx, reqId: String(body.id || ctx.reqId), reqToken: String(body.token) };
            }
            next = { ...next, savedEmail: email };
            setCtx(next);
            commitDraft(next.reqId);
            if (next.reqId && paramsRef.current.get('id') !== next.reqId) { const query = new URLSearchParams(paramsRef.current); query.set('id', next.reqId); setParams(query, { replace: true }); }
            if (!share) { adminNotify('저장했어요 — 고객에게는 아직 보내지 않았어요.', 'success'); return; }
            const url = customerQuoteLink(window.location.origin, next.reqToken);
            try { await navigator.clipboard.writeText(url); } catch { /* 링크 창에서 복사할 수 있다 */ }
            setLink(url);
            adminNotify(notification?.status === 'queued' ? '고객에게 보냈어요 · 알림톡 발송을 요청했어요.' : '링크를 만들었어요(알림톡 설정·전화번호를 확인해 주세요).', notification?.status === 'queued' ? 'success' : 'info');
        } catch (error) {
            adminNotify('저장하지 못했습니다: ' + (error instanceof Error ? error.message : '서버 연결을 확인하세요'), 'error');
        } finally { setBusy(''); }
    };

    // ── 화면 ──
    const total = estimateTotal(st);
    const nights = nightsOf(st);
    const dayCheck = dayCountCheck(st);
    const last = step === STEPS.length - 1;
    const headTitle = `${st.customer.trim() || '새 견적'} · ${st.destination.trim() || '여행지 미정'}`;
    const text = (key: keyof QuoteState, label: string, extra: { placeholder?: string; type?: string; hint?: React.ReactNode; full?: boolean; maxLength?: number } = {}) => (
        <AdminField label={label} hint={extra.hint} className={extra.full ? 'is-full' : undefined}>
            {(id, describedBy) => <AdminTextInput id={id} aria-describedby={describedBy} type={extra.type || 'text'} placeholder={extra.placeholder} maxLength={extra.maxLength}
                value={String(st[key] ?? '')} onChange={e => patch({ [key]: extra.type === 'number' ? (parseInt(e.target.value) || 0) : e.target.value } as Partial<QuoteState>)} />}
        </AdminField>
    );

    const body = phase === 'connecting' || phase === 'loading' ? <AdminLoading label="견적서 편집기를 준비하는 중…" />
        : phase === 'unset' ? <AdminError title="견적 데스크가 연결되지 않았어요" reason="서버에 견적 관리자 값(ADMIN_TOKEN)이 설정되어 있어야 견적서를 만들 수 있습니다." />
        : phase === 'error' ? <AdminError title="견적서 편집기를 열지 못했습니다" reason={loadError} onRetry={() => void start()} />
        : <>
            {pending && pending.kind !== 'empty' && <AdminMessage tone="cautionary" role="alert"
                title={pending.kind === 'error' ? '초안을 복원하지 못했습니다' : pending.conflict ? '서버 원본과 다른 버전의 초안이 있습니다' : '작성 중이던 초안이 있습니다'}
                actions={<>
                    {pending.kind === 'draft' && <AdminButton size="sm" variant="primary" onClick={restoreDraft}>초안 복원</AdminButton>}
                    <AdminButton size="sm" variant="secondary" onClick={discardDraft}>초안 버리기</AdminButton>
                    {pending.kind === 'error' && <AdminButton size="sm" variant="secondary" onClick={continueWithoutDraft}>복원 없이 계속</AdminButton>}
                </>}>
                {pending.kind === 'error' ? pending.error : <>{pending.legacy && '이전 형식 초안이므로 현재 계정과 고객의 내용인지 확인해 주세요. '}복원하거나 버린 뒤 편집을 계속하세요.{pending.savedAt && ` (보관 ${new Date(pending.savedAt).toLocaleString('ko-KR')})`}</>}
            </AdminMessage>}
            {draftError && !pending && <AdminMessage tone="cautionary" role="alert">{draftError}</AdminMessage>}
            <AdminCard flush className="qbd-steps">
                <AdminTabs label="작성 단계" value={String(step)} onChange={value => setStep(Number(value))}
                    items={STEPS.map((label, i) => ({ value: String(i), label: `${i + 1}. ${label}` }))} />
            </AdminCard>
            <fieldset className="qbd-fieldset" disabled={locked}>
                {step === 0 && <>
                    <AdminCard title="기본 정보" description="고객·일정·항공 정보를 입력합니다.">
                        <div className="adm-ui-form-grid qbd-grid-3">
                            {text('customer', '고객명', { placeholder: '예) 강민지' })}
                            {text('phone', '연락처', { placeholder: '01012345678', type: 'tel' })}
                            {text('email', '예약자 이메일', { placeholder: 'name@example.com', type: 'email', maxLength: 120, hint: '이 Google 계정이면 마이페이지에 표시됩니다.' })}
                            {text('destination', '여행지', { placeholder: '예) 고비' })}
                            <AdminField label="문서번호">{(id) => <AdminTextInput id={id} value={st.quoteNo || autoNo} onChange={e => patch({ quoteNo: e.target.value })} />}</AdminField>
                            {text('pax', '인원(명)', { type: 'number' })}
                            {text('depart', '투어 시작일(선택)', { type: 'date' })}
                            {text('return_', '투어 종료일(선택)', { type: 'date', hint: nights && nights > 0 ? `총 ${nights}박 ${nights + 1}일` : nights !== null && nights <= 0 ? '귀국일이 입국일보다 빨라요' : undefined })}
                            {text('vehicle', '차량', { placeholder: '예) 하이에이스' })}
                            {text('flightIn', '항공 IN', { placeholder: '예) 08/06 - 04:30' })}
                            {text('flightOut', '항공 OUT', { placeholder: '예) 08/10 - 18:15' })}
                            {text('manager', '담당자', { placeholder: '예) 볼라' })}
                            {text('pickup', '픽업', { placeholder: "비우면 '항공 IN + 공항' 자동" })}
                            {text('drop', '드랍', { placeholder: "비우면 '항공 OUT + 공항' 자동" })}
                            {text('paxNote', '인원 표기', { placeholder: '예) 6인 (남2/여4)', hint: "비우면 'N인'" })}
                        </div>
                        <div className="qbd-intensity">
                            <span className="qbd-label">여행강도(난이도) · 견적서에 점 5개로 표시</span>
                            <AdminChipGroup label="여행강도" value={String(st.intensity)} onChange={v => patch({ intensity: Number(v) })}
                                items={[1, 2, 3, 4, 5].map(i => ({ value: String(i), label: String(i) }))} />
                            <span className="qbd-muted">{st.intensity}단계 · {INTENSITY_DESC[st.intensity] || ''}</span>
                        </div>
                    </AdminCard>
                    <AdminCard title="코스 불러오기" description="코스를 고르면 일정·대표 명소·기본 요금이 한 번에 채워집니다. 이후 각 단계에서 자유롭게 고치세요."
                        actions={<AdminButton variant="secondary" size="sm" leading={<IconCopy />} onClick={() => void openClone()}>다른 견적에서 복제</AdminButton>}>
                        {Object.keys(lib.courses).length ? <div className="qbd-courses">
                            {sortedCourses(lib.courses).map(([name, c]) => (
                                <AdminPickCard key={name} selected={pickedCourse === name} onClick={() => loadCourse(name)}>
                                    <b className="qbd-course-name">{name}</b><small className="qbd-muted">{[c.destination, c.nights].filter(Boolean).join(' · ')}</small>
                                </AdminPickCard>
                            ))}
                        </div> : <AdminEmpty title="등록된 코스가 없습니다" description="견적 관리 → 코스 관리에서 추가하세요." />}
                    </AdminCard>
                </>}
                {step === 1 && <AdminCard title="일자별 일정" description="목적지·이동·세부 일정을 고치세요. 한 줄에 하나씩, “*”로 시작하면 강조, “(”로 시작하면 회색입니다."
                    actions={<AdminButton variant="secondary" size="sm" onClick={fillDates}>출발일 기준 여행일자 자동 입력</AdminButton>}>
                    {dayCheck && (dayCheck.ok
                        ? <p className="qbd-check is-ok">여행 기간({dayCheck.nights}박 {dayCheck.need}일)과 일정 칸 수가 맞습니다.</p>
                        : <p className="qbd-check is-warn">여행 기간은 {dayCheck.nights}박 {dayCheck.need}일인데 일정 칸은 {dayCheck.have}개입니다. 아래에서 일자를 추가·삭제해 맞춰 주세요.</p>)}
                    <QuoteDayEditor days={st.days.map((day, i) => ({ ...day, d: i + 1 })) as any} startDate={st.depart} endDate={st.return_} extras={false}
                        snippets={lib.snippets} snippetCats={lib.snippetCats} disabled={locked} syncKey={String(syncKey)}
                        onField={setDay}
                        onSnippet={(i, name) => { const s = lib.snippets[name]; if (!s) return; setDays(st.days.map((day, j) => j === i ? dayFromSnippet(day, s) : day)); adminNotify(`“${name}” 일정을 불러왔습니다`, 'info'); }}
                        onDelete={i => { if (st.days.length <= 1) { adminNotify('최소 1일은 필요합니다.', 'error'); return; } setDays(renumber(st.days.filter((_, j) => j !== i))); }}
                        onReorder={(from, to) => { const days = st.days.slice(); const [moved] = days.splice(from, 1); days.splice(to, 0, moved); setDays(renumber(days)); }}
                        onAdd={() => setDays(renumber([...st.days, emptyDay(st.days.length + 1)]))}
                        onNotice={message => adminNotify(message, 'info')} />
                </AdminCard>}
                {step === 2 && <>
                    <AdminCard title="예약금 · 총액 기준" description="예약금(1인)과 아래 막대의 예상 총액을 어느 숙소 기준으로 볼지 정합니다.">
                        <div className="qbd-row">
                            <AdminField label="예약금(1인)">{(id) => <AdminTextInput id={id} type="number" step={1000} trailing="원" value={String(st.deposit)} onChange={e => patch({ deposit: parseInt(e.target.value) || 0 })} />}</AdminField>
                            <div className="qbd-seg"><span className="qbd-label">하단 총액 계산 기준 숙소</span>
                                <AdminSegmented label="총액 기준 숙소" value={st.roomType} onChange={v => patch({ roomType: v })} items={[{ value: ROOM_ECO, label: '실속형' }, { value: ROOM_FULL, label: '풀패키지' }]} /></div>
                        </div>
                    </AdminCard>
                    <AdminCard title="추가 및 할인 사항" description="견적서에 안내로 표시됩니다(자동 계산 없음).">
                        {st.options.length ? <ul className="qbd-options">
                            {st.options.map((o, i) => (
                                <li key={i}><b>{o.label}</b><span className="qbd-muted">{o.calc || ''}</span>
                                    <AdminIconButton size="sm" label={`${o.label} 빼기`} onClick={() => patch({ options: st.options.filter((_, j) => j !== i) })}><IconClose /></AdminIconButton></li>
                            ))}
                        </ul> : <p className="qbd-muted">등록된 추가·할인 안내가 없습니다.</p>}
                        <div className="qbd-add">
                            <AdminTextInput aria-label="새 항목" placeholder="항목(예: 게르 업그레이드)" value={optionDraft.label} onChange={e => setOptionDraft(d => ({ ...d, label: e.target.value }))} />
                            <AdminTextInput aria-label="금액 안내" placeholder="금액 안내(예: 50,000원*1박)" value={optionDraft.calc} onChange={e => setOptionDraft(d => ({ ...d, calc: e.target.value }))} />
                            <AdminButton variant="secondary" leading={<IconPlus />} onClick={addOption}>옵션 추가</AdminButton>
                        </div>
                    </AdminCard>
                    <AdminCard title="인원별 잔금(1인 기준)" description="실속형 = 일반 게르, 풀패키지 = 고급 게르">
                        {sortedBalances.length ? <AdminTable label="인원별 잔금" cardOff>
                            <AdminThead><AdminTr><AdminTh>인원</AdminTh><AdminTh>실속형</AdminTh><AdminTh>풀패키지</AdminTh><AdminTh align="right">빼기</AdminTh></AdminTr></AdminThead>
                            <AdminTbody>{sortedBalances.map(b => (
                                <AdminTr key={b.pax}>
                                    <AdminTd nowrap><b>{b.pax}인</b></AdminTd>
                                    <AdminTd><AdminTextInput aria-label={`${b.pax}인 실속형 잔금`} type="number" step={1000} trailing="원" value={String(balEco(b))} onChange={e => setBalance(b.pax, 'economy', e.target.value)} /></AdminTd>
                                    <AdminTd><AdminTextInput aria-label={`${b.pax}인 풀패키지 잔금`} type="number" step={1000} trailing="원" value={String(balFull(b))} onChange={e => setBalance(b.pax, 'full', e.target.value)} /></AdminTd>
                                    <AdminTd align="right"><AdminIconButton size="sm" label={`${b.pax}인 잔금 빼기`} onClick={() => patch({ balances: st.balances.filter(x => x.pax !== b.pax) })}><IconClose /></AdminIconButton></AdminTd>
                                </AdminTr>
                            ))}</AdminTbody>
                        </AdminTable> : <p className="qbd-muted">인원별 잔금을 추가하세요.</p>}
                        <div className="qbd-add">
                            <AdminTextInput aria-label="인원" type="number" placeholder="인원" value={balanceDraft.pax} onChange={e => setBalanceDraft(d => ({ ...d, pax: e.target.value }))} />
                            <AdminTextInput aria-label="실속형 금액" type="number" placeholder="실속형(원)" value={balanceDraft.eco} onChange={e => setBalanceDraft(d => ({ ...d, eco: e.target.value }))} />
                            <AdminTextInput aria-label="풀패키지 금액" type="number" placeholder="풀패키지(원)" value={balanceDraft.full} onChange={e => setBalanceDraft(d => ({ ...d, full: e.target.value }))} />
                            <AdminButton variant="secondary" leading={<IconPlus />} onClick={addBalance}>인원 추가</AdminButton>
                        </div>
                    </AdminCard>
                </>}
                {step === 3 && <AdminCard title="대표 명소" description="고른 순서대로 지도·견적서에 표시됩니다. 설명·몽골어 지명은 여행지 관리에서 자동으로 채워집니다.">
                    <QuoteSpotSelector spots={lib.spots} categories={lib.spotCats} selected={st.spots} disabled={locked}
                        onToggle={name => setSt(old => ({ ...old, spots: old.spots.includes(name) ? old.spots.filter(n => n !== name) : [...old.spots, name] }))} />
                </AdminCard>}
                {step === 4 && <AdminCard title="혜택 · 이벤트 · 비고" description="견적서 기본 정보 표에 그대로 표시됩니다. 비우면 견적서에 빈 칸으로 나옵니다.">
                    <div className="adm-ui-form-grid">
                        {text('benefits', '여행사 혜택', { placeholder: '예) 판초 1인1개, 캠핑의자 세트, 낙타양말 증정', full: true })}
                        <AdminField label="참여 가능 이벤트" hint="한 줄에 하나씩" className="is-full">
                            {(id, describedBy) => <AdminTextArea id={id} aria-describedby={describedBy} minRows={5} value={st.events} placeholder={'❤️1번: 후기이벤트 참여시 1인 1만원할인\n❤️2번: 인스타 후기 작성시 1인 2만원할인'} onChange={e => patch({ events: e.target.value })} />}
                        </AdminField>
                        {text('remark', '비고', { placeholder: "특이사항(비우면 '-')", full: true })}
                    </div>
                </AdminCard>}
            </fieldset>
            <div className="adm-ui-form-bar qbd-bar" role="region" aria-label="예상 총액과 저장">
                <div className="adm-ui-form-bar-status qbd-total">
                    <small>{st.pax}인 · {st.roomType === ROOM_FULL ? '풀패키지' : '실속형'} 기준 예상 총액</small>
                    {total ? <b>{total.total.toLocaleString('ko-KR')}원 <span>· 1인 {total.perPerson.toLocaleString('ko-KR')}원</span></b> : <b>— <span>· {st.pax}인 잔금 미입력</span></b>}
                </div>
                <div className="adm-ui-form-bar-actions">
                    <AdminButton variant="secondary" disabled={step === 0} onClick={() => setStep(s => s - 1)}>이전</AdminButton>
                    {!last && <AdminButton variant="primary" onClick={() => setStep(s => s + 1)}>다음 · {STEPS[step + 1]}</AdminButton>}
                    {last && <AdminButton variant="secondary" loading={busy === 'save'} disabled={locked} onClick={() => void runSave(false)}>저장하기</AdminButton>}
                    {last && <AdminButton variant="primary" loading={busy === 'share'} disabled={locked} onClick={() => void runSave(true)}>링크 공유하기</AdminButton>}
                </div>
            </div>
        </>;

    return (
        <AdminLayout
            activePage={quoteDeskPageId('builder')}
            title={tool.label}
            description={phase === 'ready' ? `${headTitle} · 문서번호 ${st.quoteNo || autoNo}` : tool.description}
            eyebrow={null}
            actions={phase === 'ready' ? <>
                {ctx.reqId && <AdminBadge tone="info">{ctx.anonymousShare ? '공유 견적' : '고객 요청'}</AdminBadge>}
                <AdminTextButton tone="assistive" disabled={locked} onClick={() => void reset()}>초기화</AdminTextButton>
                <AdminButton variant="secondary" disabled={!!pending} onClick={() => preview('/일정지도')}>지도 미리보기</AdminButton>
                <AdminButton variant="secondary" disabled={!!pending} onClick={() => preview('/견적서')}>견적서 미리보기</AdminButton>
                <AdminButton variant="secondary" loading={busy === 'save'} disabled={locked} onClick={() => void runSave(false)}>저장하기</AdminButton>
                <AdminButton variant="primary" loading={busy === 'share'} disabled={locked} onClick={() => void runSave(true)}>링크 공유하기</AdminButton>
            </> : undefined}
        >
            <div className="adm-ui-page is-form qbd-page">{body}</div>
            <AdminDialog open={clone.open} onClose={() => setClone(c => ({ ...c, open: false }))} title="다른 견적에서 복제" size="md"
                description="일정·명소·요금·차량·혜택을 그대로 가져오고, 고객명·날짜·인원은 지금 값을 둡니다.">
                {clone.loading ? <AdminLoading label="발행된 견적을 불러오는 중…" />
                    : clone.error ? <AdminError reason={clone.error} onRetry={() => void openClone()} />
                    : clone.items.length ? <div className="qbd-clone-list">
                        {clone.items.map(item => {
                            const q = item.quote || {};
                            const period = q.period || (item.depart ? item.depart + (item.return_ ? ' ~ ' + item.return_ : '') : '');
                            return (
                                <AdminPickCard key={String(item.id)} onClick={() => void pickClone(item)}>
                                    <b className="qbd-course-name">{q.customer || item.name || '고객'}{(q.destination || item.destination) && ` · ${q.destination || item.destination}`}</b>
                                    <small className="qbd-muted">{[period, q.nights, (q.days || []).length ? `일정 ${(q.days || []).length}일` : '', (q.highlights || []).length ? `명소 ${(q.highlights || []).length}곳` : ''].filter(Boolean).join(' · ')}</small>
                                </AdminPickCard>
                            );
                        })}
                    </div> : <AdminEmpty title="복제할 수 있는 발행된 견적이 아직 없어요" />}
            </AdminDialog>
            <AdminDialog open={!!link} onClose={() => setLink('')} title="견적서가 저장됐어요" size="sm"
                description="아래 링크를 고객에게 보내세요. 견적을 고쳐 다시 발행하면 같은 링크에 반영됩니다.">
                <div className="qbd-link">
                    <AdminTextInput aria-label="고객 링크" readOnly value={link} onFocus={e => e.currentTarget.select()} />
                    <AdminButton variant="secondary" leading={<IconCopy />} onClick={() => { navigator.clipboard.writeText(link).then(() => adminNotify('링크가 복사됐어요.', 'success')).catch(() => adminNotify('복사하지 못했어요 — 링크를 직접 복사해 주세요.', 'error')); }}>복사</AdminButton>
                </div>
                <div className="qbd-link-actions">
                    <AdminTextButton onClick={() => window.open(KAKAO_CHANNEL_URL, '_blank', 'noopener')}>카톡 채널</AdminTextButton>
                    <AdminTextButton onClick={() => window.open(link, '_blank', 'noopener')}>고객 화면 열기</AdminTextButton>
                </div>
            </AdminDialog>
        </AdminLayout>
    );
};

export default AdminQuoteBuilder;
