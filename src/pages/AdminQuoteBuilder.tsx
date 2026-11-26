import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { AdminLayout } from '../components/admin/AdminLayout';
import { AdminButton, AdminDialog, AdminEmpty, AdminError, AdminLoading, AdminMessage, AdminPickCard, AdminTextButton, AdminTextInput, IconCopy } from '../components/admin/ui';
import { adminConfirm, adminNotify } from '../components/admin/ui/adminFeedback';
import { connectQuoteDesk, findQuoteDeskTool, quoteDeskPageId } from '../components/admin/quoteDesk';
import { loadFallbackCourses, loadFallbackSnippets, loadFallbackSpots, loadQuoteBase } from '../components/admin/quoteLibrary';
import { readQuoteLibrary, type QuoteLibraryKey } from '../components/admin/quoteLibraryStore';
import {
    ROOM_FULL, applyCourse, autoQuoteNo, buildQuote, customerQuoteLink, dayFromSnippet, emptyContext, emptyDay,
    emptyQuoteState, importQuoteContent, matchCourse, nightsOf, renumber, restoreFromQuote, savePayload, sortedCourses, stateFromRequest, validEmail,
    type Json, type QuoteDay, type QuoteState, type RequestContext,
} from '../components/admin/quoteBuilder';
import {
    BUILDER_SECTIONS, builderChecks, clockText, maskPhone, paxText, periodText, priceSummary, receivedText, requestItems, sectionMarks, shortDay, syncDayDates, tripLength,
    type BuilderSectionId,
} from '../components/admin/quoteBuilderView';
import { BasicSection, BuilderBar, BuilderChecks, BuilderHead, BuilderStepNav, CourseSection, DaysSection, NotesSection, PriceSection, RequestCard, SpotsSection, SummaryCard } from '../components/admin/QuoteBuilderSections';
import { draftFingerprint, readDraft, removeDraft, validQuoteDraft, writeDraft, type DraftRead, type DraftScope } from '../components/admin/quoteDraftStore';
import { loadQuoteCustomerRequest } from '../utils/quoteCustomerWorkspace';
import { KAKAO_CHANNEL_URL } from '../constants/company';
import './AdminQuoteBuilder.css';

/**
 * 견적서 만들기(`/admin/quote-desk/builder`) — 옛 도구 public/견적만들기.html을 React로 옮겼다(iframe 대신).
 * 화면은 2026-11-26 Claude Design ‘견적서 만들기 개선’(고객 요청 있을 때 / 직접 만들 때): 머리 줄 → 붙는 단계 줄 → 한 화면의 섹션 6개
 * (기본 정보·코스·일자별 일정·요금·대표 명소·혜택·비고, 부품은 components/admin/QuoteBuilderSections.tsx) + 오른쪽(고객 요청·보내기 전 확인 / 견적 요약)
 * + 아래 막대(예상 총액·확인할 것·미리보기·저장·링크 공유). 표시 계산은 components/admin/quoteBuilderView.ts.
 * - 견적 문서는 components/admin/quoteBuilder.ts의 buildQuote(옛 도구와 같은 칸)로 만들고, 같은 `/api/requests`에 저장한다.
 *   저장하기 = 서버 저장만(silentQuote), 링크 공유하기 = 저장 + 고객 알림톡(notifyQuote) + 고객 링크.
 * - 초안은 옛 편집기(quote-editor-state.js)와 같은 자리·형식(quoteDraftStore.ts)으로 이 브라우저에 보관한다.
 * - 고객 통합 작업 화면 안의 견적 편집도 같은 편집기(QuoteBuilderEditor, embedded)를 끼워 쓴다(옛 iframe `/견적만들기?id=` 대신).
 *   바깥 화면은 ref의 flushAll()로 이동 전에 초안을 보관하고 onState로 저장 중·미저장을 받는다(옛 QuoteEditorState와 같은 약속).
 */
const tool = findQuoteDeskTool('builder');
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

export interface QuoteBuilderState { busy: boolean; dirty: boolean; error: string }
export interface QuoteBuilderFlush { ok: boolean; busy: boolean; dirty?: boolean; error?: string }
export interface QuoteBuilderHandle {
    /** 초안을 이 브라우저에 보관한다(옛 QuoteEditorState.flushAll과 같은 결과) */
    flushAll: () => QuoteBuilderFlush;
    /** 고객 화면의 작업 이동: quote-share → 혜택·비고(아래 막대의 링크 공유), 그 밖 → 일자별 일정 섹션으로 옮겨 간다 */
    navigate: (section: string) => boolean;
}
interface ShellParts { actions: React.ReactNode; description: string; content: React.ReactNode }
interface EditorProps {
    /** 고객 화면에 끼울 때 — 주소 대신 이 요청을 열고, 주소·다른 화면이 넘긴 값(코스 공유 등)은 건드리지 않는다 */
    embedded?: boolean;
    requestId?: string;
    onState?: (state: QuoteBuilderState) => void;
    /** 서버 저장이 끝난 뒤(바깥 고객 현황을 다시 읽게) */
    onSaved?: (requestId: string) => void;
    /** 화면 틀(독립 화면은 AdminLayout). 없으면 끼워 쓰는 틀 */
    shell?: (parts: ShellParts) => React.ReactNode;
}
/** 끼워 쓰는 틀: 머리 줄·단계 줄은 본문(BuilderHead·BuilderStepNav)이 그린다 */
const embeddedShell = ({ content }: ShellParts) => <div className="qbd-embedded">{content}</div>;

export const QuoteBuilderEditor = forwardRef<QuoteBuilderHandle, EditorProps>(function QuoteBuilderEditor({ embedded = false, requestId, onState, onSaved, shell }, ref) {
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
    const [pickedCourse, setPickedCourse] = useState('');
    const [pending, setPending] = useState<DraftRead | null>(null);
    const [draftError, setDraftError] = useState('');
    const [busy, setBusy] = useState<'' | 'save' | 'share'>('');
    const [link, setLink] = useState('');
    const [clone, setClone] = useState<{ open: boolean; loading: boolean; error: string; items: Json[] }>({ open: false, loading: false, error: '', items: [] });
    const [rawOpen, setRawOpen] = useState(false);
    /** 머리 줄의 저장 표시: 이 브라우저에 초안을 보관한 시각 · 서버에 저장한 시각 */
    const [draftAt, setDraftAt] = useState(0);
    const [savedAt, setSavedAt] = useState(0);
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
    // 바깥 화면이 고른 섹션(불러오기가 끝나면 그 섹션으로 옮겨 간다)
    const navSection = useRef<BuilderSectionId | null>(null);

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
            handoff.current ??= embedded ? { shareCourse: '', anonymous: false, prefillId: '' } : takeHandoffs(paramsRef.current);
            const { shareCourse, anonymous, prefillId } = handoff.current;
            const [quoteBase, library] = await Promise.all([loadQuoteBase(), loadLibrary(value)]);
            if (run !== boot.current) return;
            let s = emptyQuoteState(quoteBase), c: RequestContext = { ...emptyContext(), anonymousShare: anonymous };
            let legacyId = '';
            const legacy = localJson(LEGACY_DRAFT) as Json | null;
            if (!prefillId && !shareCourse && legacy?.st && validQuoteDraft(legacy.st)) legacyId = String(legacy.reqId || '');
            const id = (embedded ? requestId : paramsRef.current.get('id')) || prefillId || legacyId;
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
            // 고객 요청에 기간은 있는데 일정이 비었으면(맞는 코스 없음) 기간만큼 빈 일차를 만들어 둔다
            if (c.fromReq && !restored && !s.days.length) {
                const n = nightsOf(s);
                if (n && n > 0 && n < 60) s = { ...s, days: syncDayDates(renumber(Array.from({ length: n + 1 }, () => emptyDay(0))), s.depart) };
            }
            setBase(quoteBase); setLib(library); setSt(s); setCtx(c); setPickedCourse(picked); setAutoNo(autoQuoteNo()); setDraftAt(0); setSavedAt(0);
            if (!embedded && c.reqId && paramsRef.current.get('id') !== c.reqId) { const q = new URLSearchParams(paramsRef.current); q.set('id', c.reqId); setParams(q, { replace: true }); }
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
    }, [accountId, setParams, embedded, requestId]);

    useEffect(() => { token.current = ''; void start(); return () => { boot.current++; }; }, [start]);

    // ── 초안 보관: 고칠 때마다 잠시 뒤 이 브라우저에 보관(원본과 같으면 보관하지 않는다) ──
    const flushDraft = useCallback((): string => {
        if (!scope.current || pendingRef.current) return '';
        const current = draftFingerprint(stRef.current);
        if (current === draftFingerprint(baseline.current) || current === lastStored.current) return '';
        let result: ReturnType<typeof writeDraft>;
        try { result = writeDraft(localStorage, scope.current, baseline.current, stRef.current); }
        catch { result = { ok: false, error: '브라우저 저장소를 사용할 수 없어 초안을 보관하지 못했습니다.' }; }
        if (result.ok) { lastStored.current = current; setDraftError(''); setDraftAt(Date.now()); return ''; }
        setDraftError(result.error); return result.error;
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
        setSt(old => ({ ...old, ...(pending.value as Partial<QuoteState>) }));
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
        setSt(old => { const next = applyCourse(old, course); return { ...next, days: syncDayDates(next.days, next.depart) }; }); setPickedCourse(name);
        adminNotify(`“${name}” 코스를 불러왔습니다`, 'info');
    };
    const setDay = (index: number, field: string, value: unknown) => setSt(old => {
        const days = old.days.slice(), day = { ...days[index] };
        // 숙소 이름만 바꿀 때 그 숙소의 다른 칸(사진·태그 등)은 남긴다
        if (field === 'stay') day.stay = { ...(day.stay || {}), ...(value as Json) };
        else (day as Json)[field] = value;
        days[index] = day; return { ...old, days };
    });
    /** 일차를 더하거나 빼거나 옮긴 뒤: 번호를 다시 매기고, 시작일에서 자동으로 채운 날짜는 새 자리에 맞춘다(직접 적은 날짜는 그대로) */
    const setDays = (days: QuoteDay[]) => setSt(old => ({ ...old, days: syncDayDates(renumber(days), old.depart) }));
    /** 시작일·종료일: 자동 날짜를 다시 맞추고, 기간보다 일정 칸이 적으면 빈 일차를 더한다(넘치는 일차는 지우지 않는다) */
    const setDates = (depart: string, return_: string) => setSt(old => {
        let days = syncDayDates(old.days, depart, old.depart);
        const n = nightsOf({ depart, return_ });
        if (n && n > 0 && n < 60 && days.length < n + 1) {
            days = syncDayDates(renumber([...days, ...Array.from({ length: n + 1 - days.length }, () => emptyDay(0))]), depart);
        }
        return { ...old, depart, return_, days };
    });
    const toggleSpot = (name: string) => setSt(old => ({ ...old, spots: old.spots.includes(name) ? old.spots.filter(n => n !== name) : [...old.spots, name] }));
    const moveSpot = (from: number, to: number) => setSt(old => { const spots = old.spots.slice(); const [moved] = spots.splice(from, 1); spots.splice(to, 0, moved); return { ...old, spots }; });
    const loadDefaults = async () => {
        const d = emptyQuoteState(base);
        if ((st.benefits.trim() || st.events.trim()) && !await adminConfirm({ title: '자주 쓰는 문구 불러오기', confirmLabel: '불러오기',
            message: '지금 적힌 여행사 혜택·참여 가능 이벤트를 기본 문구로 바꿀까요?' })) return;
        patch({ benefits: d.benefits, events: d.events });
        adminNotify('기본 문구를 불러왔어요.', 'info');
    };
    const copyText = (value: string, label: string) => {
        navigator.clipboard.writeText(value).then(() => adminNotify(`${label}를 복사했어요.`, 'success')).catch(() => adminNotify('복사하지 못했어요.', 'error'));
    };

    const quote = () => buildQuote(stRef.current, base, { quoteNo: stRef.current.quoteNo || autoNo, reqProfile: ctx.reqProfile, reqSpots: ctx.reqSpots, spotLib: lib.spots });
    const preview = (doc: '/견적서' | '/일정지도') => {
        try { localStorage.setItem('leaders_quote', JSON.stringify(quote())); }
        catch { adminNotify('브라우저 저장소를 쓸 수 없어 미리보기를 열지 못했습니다.', 'error'); return; }
        if (!window.open(doc, '_blank')) adminNotify('팝업을 허용한 뒤 다시 열어 주세요.', 'error');
    };

    // ── 섹션 이동(위 단계 줄 · 확인 목록 · 바깥 고객 화면) ──
    const [active, setActive] = useState<BuilderSectionId>('qb-basic');
    const [jump, setJump] = useState(0);
    const goSection = useCallback((id: BuilderSectionId) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActive(id);
    }, []);
    useEffect(() => {
        if (phase !== 'ready') return;
        const onScroll = () => {
            const nav = document.querySelector('.qbd-steps');
            const line = (nav?.getBoundingClientRect().bottom ?? 0) + 24;
            let current: BuilderSectionId = BUILDER_SECTIONS[0].id;
            for (const s of BUILDER_SECTIONS) { const el = document.getElementById(s.id); if (el && el.getBoundingClientRect().top <= line) current = s.id; }
            setActive(a => (a === current ? a : current));
        };
        onScroll();
        window.addEventListener('scroll', onScroll, true);
        return () => window.removeEventListener('scroll', onScroll, true);
    }, [phase]);
    useEffect(() => {
        if (phase !== 'ready' || !navSection.current) return;
        const id = navSection.current;
        const frame = window.requestAnimationFrame(() => goSection(id));
        return () => window.cancelAnimationFrame(frame);
    }, [phase, jump, goSection]);

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
        setSt({ ...next, days: syncDayDates(next.days, next.depart) }); setClone(c => ({ ...c, open: false }));
        adminNotify(`“${who}” 견적을 복제했습니다 — 고객 정보만 확인한 뒤 발행하세요.`, 'success');
    };

    const reset = async () => {
        if (!await adminConfirm({ title: '초기화', confirmLabel: '모두 지우기', danger: true, message: '입력한 내용을 모두 지울까요?' })) return;
        try { localStorage.removeItem('leaders_quote'); } catch { /* 저장소를 쓸 수 없는 창 */ }
        setSt(emptyQuoteState(base)); setPickedCourse(''); setAutoNo(autoQuoteNo()); goSection('qb-basic');
        if (scope.current) removeDraft(localStorage, scope.current, legacyOwned.current ? LEGACY_DRAFT : undefined);
        lastStored.current = ''; setDraftAt(0);
        adminNotify('초기화되었습니다.', 'info');
    };

    /** 저장하기 = 서버 저장만(고객 알림 없음) · 링크 공유하기 = 저장 + 고객 알림톡 + 고객 링크(옛 runSave) */
    const runSave = async (share: boolean) => {
        if (busy || pending || phase !== 'ready') return;
        let s = stRef.current;
        const email = (s.email || '').trim();
        if (!validEmail(email)) { adminNotify('예약자 이메일 주소를 확인해 주세요.', 'error'); goSection('qb-basic'); return; }
        if (!s.customer.trim() && !ctx.anonymousShare) { adminNotify('먼저 고객명을 입력하세요.', 'error'); goSection('qb-basic'); return; }
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
            onSaved?.(next.reqId);
            setSavedAt(Date.now()); setDraftAt(0);
            if (!embedded && next.reqId && paramsRef.current.get('id') !== next.reqId) { const query = new URLSearchParams(paramsRef.current); query.set('id', next.reqId); setParams(query, { replace: true }); }
            if (!share) { adminNotify('저장했어요 — 고객에게는 아직 보내지 않았어요.', 'success'); return; }
            const url = customerQuoteLink(window.location.origin, next.reqToken);
            try { await navigator.clipboard.writeText(url); } catch { /* 링크 창에서 복사할 수 있다 */ }
            setLink(url);
            adminNotify(notification?.status === 'queued' ? '고객에게 보냈어요 · 알림톡 발송을 요청했어요.' : '링크를 만들었어요(알림톡 설정·전화번호를 확인해 주세요).', notification?.status === 'queued' ? 'success' : 'info');
        } catch (error) {
            adminNotify('저장하지 못했습니다: ' + (error instanceof Error ? error.message : '서버 연결을 확인하세요'), 'error');
        } finally { setBusy(''); }
    };

    // ── 바깥 화면(고객 통합 작업)과의 약속 ──
    const draftErrorRef = useRef(draftError); draftErrorRef.current = draftError;
    const dirty = phase === 'ready' && !pending && draftFingerprint(st) !== draftFingerprint(baseline.current);
    const stateRef = useRef(onState); stateRef.current = onState;
    useEffect(() => { stateRef.current?.({ busy: !!busy, dirty, error: draftError }); }, [busy, dirty, draftError]);
    useEffect(() => () => stateRef.current?.({ busy: false, dirty: false, error: '' }), []);
    useImperativeHandle(ref, () => ({
        flushAll() {
            if (busyRef.current) return { ok: false, busy: true };
            const isDirty = !!scope.current && !pendingRef.current && draftFingerprint(stRef.current) !== draftFingerprint(baseline.current);
            const error = flushDraft();
            return error ? { ok: false, busy: false, dirty: isDirty, error } : { ok: true, busy: false, dirty: isDirty };
        },
        navigate(section) { navSection.current = section === 'quote-share' ? 'qb-notes' : 'qb-days'; setJump(j => j + 1); return true; },
    }), [flushDraft]);

    // ── 화면 ──
    const sorted = useMemo(() => sortedCourses(lib.courses), [lib.courses]);
    const checks = builderChecks(st, ctx, pickedCourse);
    const marks = sectionMarks(st, checks);
    const todos = checks.filter(c => c.state === 'todo');
    const price = priceSummary(st);
    const length = tripLength(st);
    const profile = ctx.reqProfile || {};
    const reqItems = requestItems(st, ctx);
    const headName = st.customer.trim() || (ctx.anonymousShare ? '공유 견적' : '새 견적');
    const headMeta = [st.destination.trim() || '여행지 미정', `${st.pax}명`, periodText(st), `문서번호 ${st.quoteNo || autoNo}`].filter(Boolean).join(' · ');
    const headStatus = busy ? '서버에 저장하는 중…' : pending ? '초안 확인 필요' : draftAt ? `임시 보관 · ${clockText(draftAt)}` : savedAt ? `저장됨 · ${clockText(savedAt)}` : '';
    const course = pickedCourse ? lib.courses[pickedCourse] : null;
    const summaryRows: Array<[string, React.ReactNode]> = [
        ['고객', <b key="c">{st.customer.trim() || '—'} · {st.pax}명</b>],
        ['여행', <>{st.depart ? `${shortDay(st.depart)}${st.return_ ? ` – ${shortDay(st.return_)}` : ''}` : '날짜 미정'}<br /><span className="qbd-muted">{[length, `강도 ${st.intensity}/5`].filter(Boolean).join(' · ')}</span></>],
        ['코스', pickedCourse ? [pickedCourse, course?.destination].filter(Boolean).join(' · ') : '직접 작성'],
        ['차량', st.vehicle || '—'],
        ['담당', st.manager || '—'],
    ];
    const requestRows = ([
        ['희망 여행', ctx.reqDestination || ''],
        ['여행 유형', String(profile.tripType || '')],
        ['인원 구성', paxText(ctx.reqPax0)],
    ] as Array<[string, string]>).filter(([, v]) => v);
    const rawRows = ([
        ['고객명', st.customer], ['연락처', st.phone], ['이메일', st.email],
        ['희망 여행', ctx.reqDestination || ''], ['희망 명소', (ctx.reqSpots || []).join(', ')],
        ['여행 기간', [st.depart, st.return_].filter(Boolean).join(' ~ ')], ['인원 구성', paxText(ctx.reqPax0)],
        ['여행 유형', String(profile.tripType || '')], ['여행 스타일', (Array.isArray(profile.travelStyles) ? profile.travelStyles : []).join(', ')],
        ['도시 숙소', String(profile.cityStay || '')], ['게르', String(profile.gerStay || '')], ['차량', ctx.reqVehicle || ''],
        ['접수', receivedText(ctx.reqReceivedAt || '')], ['요청 사항', String(profile.request || '')],
    ] as Array<[string, string]>).filter(([, v]) => v);
    const menu = [
        { key: 'map', label: '지도 미리보기', description: '대표 명소 순서대로 지도를 열어요', disabled: !!pending, onSelect: () => preview('/일정지도') },
        { key: 'clone', label: '다른 견적에서 복제', description: '일정·명소·요금을 가져와요', disabled: locked, onSelect: () => void openClone() },
        { key: 'reset', label: '초기화', description: '입력한 내용을 모두 지워요', disabled: locked, onSelect: () => void reset() },
    ];

    const body = phase === 'connecting' || phase === 'loading' ? <AdminLoading label="견적서 편집기를 준비하는 중…" />
        : phase === 'unset' ? <AdminError title="견적 데스크가 연결되지 않았어요" reason="서버에 견적 관리자 값(ADMIN_TOKEN)이 설정되어 있어야 견적서를 만들 수 있습니다." />
        : phase === 'error' ? <AdminError title="견적서 편집기를 열지 못했습니다" reason={loadError} onRetry={() => void start()} />
        : <>
            {/* 고객 통합 작업 화면 안에서는 바깥 화면이 고객 이름 줄을 그린다 */}
            {!embedded && <BuilderHead backTo={ctx.reqId ? `/admin/customer-workspace/quote/${encodeURIComponent(ctx.reqId)}` : undefined}
                name={headName} badge={ctx.fromReq ? '고객 요청' : ctx.anonymousShare ? '공유 견적' : '직접 작성'} meta={headMeta} status={headStatus} menu={menu} />}
            <BuilderStepNav marks={marks} active={active} onGo={goSection} />
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
            <div className="qbd-layout">
                <fieldset className="qbd-main" disabled={locked}>
                    <BasicSection st={st} patch={patch} setDates={setDates} autoNo={autoNo} />
                    <CourseSection courses={lib.courses} sorted={sorted} picked={pickedCourse} length={length} help={!ctx.fromReq} onPick={loadCourse} onClone={() => void openClone()} />
                    <DaysSection days={st.days} depart={st.depart} snippets={lib.snippets} snippetCats={lib.snippetCats} help={!ctx.fromReq}
                        onField={setDay}
                        onSnippet={(i, name) => { const s = lib.snippets[name]; if (!s) return; setDays(st.days.map((day, j) => j === i ? dayFromSnippet(day, s) : day)); }}
                        onDelete={i => { if (st.days.length <= 1) { adminNotify('최소 1일은 필요합니다.', 'error'); return; } setDays(st.days.filter((_, j) => j !== i)); }}
                        onReorder={(from, to) => { const days = st.days.slice(); const [moved] = days.splice(from, 1); days.splice(to, 0, moved); setDays(days); }}
                        onAdd={() => setDays([...st.days, emptyDay(st.days.length + 1)])} />
                    <PriceSection st={st} patch={patch} />
                    <SpotsSection spots={lib.spots} spotCats={lib.spotCats} selected={st.spots} onToggle={toggleSpot} onClear={() => patch({ spots: [] })} onReorder={moveSpot} onMap={() => preview('/일정지도')} />
                    <NotesSection st={st} patch={patch} onDefaults={() => void loadDefaults()} />
                </fieldset>
                <aside className="qbd-aside" aria-label={ctx.fromReq ? '고객 요청과 보내기 전 확인' : '견적 요약'}>
                    {ctx.fromReq ? <>
                        <RequestCard received={receivedText(ctx.reqReceivedAt || '')} rows={requestRows} items={reqItems} phone={st.phone} phoneMasked={maskPhone(st.phone)}
                            requestNo={ctx.reqId.slice(0, 8)} onGo={goSection} onCopy={copyText} onRaw={() => setRawOpen(true)} />
                        <div className="qbd-card"><BuilderChecks checks={checks} onGo={goSection} /></div>
                    </> : <SummaryCard rows={summaryRows} price={price} pax={st.pax} optionCount={st.options.length}>
                        <BuilderChecks checks={checks} onGo={goSection} />
                    </SummaryCard>}
                </aside>
            </div>
            <BuilderBar pax={st.pax} full={!!price?.full || st.roomType === ROOM_FULL} total={price ? price.total : null} per={price ? price.per : null}
                todo={todos.length ? { text: `보내기 전 확인 ${todos.length}건 · ${todos.map(t => t.note || t.label).join(', ')}`, section: todos[0].section } : null}
                onTodo={goSection} busy={busy} locked={locked} pendingDraft={!!pending}
                onPreview={() => preview('/견적서')} onSave={() => void runSave(false)} onShare={() => void runSave(true)} />
        </>;

    const description = phase === 'ready' ? headMeta : tool.description;
    return (
        <>
            {(shell || embeddedShell)({ actions: undefined, description, content: <div className={`adm-ui-page qbd-page${embedded ? ' is-embedded' : ''}`}>{body}</div> })}
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
            <AdminDialog open={rawOpen} onClose={() => setRawOpen(false)} title="고객 요청 내용" size="md"
                description="고객이 견적 요청서에 적은 내용이에요. 고객명·연락처·이메일·기간은 지금 견적의 값이에요.">
                <dl className="qbd-dl qbd-raw">{rawRows.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>
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
        </>
    );
});

/** 견적서 만들기 독립 화면(`/admin/quote-desk/builder`) — 머리 줄은 본문(BuilderHead)이 그린다 */
export const AdminQuoteBuilder: React.FC = () => (
    <QuoteBuilderEditor shell={({ description, content }) => (
        <AdminLayout activePage={quoteDeskPageId('builder')} title={tool.label} description={description} eyebrow={null} headingInBody>{content}</AdminLayout>
    )} />
);

export default AdminQuoteBuilder;
