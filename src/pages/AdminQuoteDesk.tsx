import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { AdminDeliveryHistory } from '../components/admin/AdminDeliveryHistory';
import type { AdminDeliveryData } from '../types/adminDelivery';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { createPortal } from 'react-dom';
import { ReservationWorkflow } from '../components/admin/ReservationWorkflow';
import { CustomerWorkspaceOverview } from '../components/admin/CustomerWorkspaceOverview';
import { CustomerKakaoActions } from '../components/admin/CustomerKakaoActions';
import { customerWorkspaceReturnTo, quoteCustomerHref } from '../utils/customerWorkspaceRoutes';
import { loadQuoteCustomerRequest, quoteCustomerIsBooking, quoteCustomerWorkspaceModel } from '../utils/quoteCustomerWorkspace';
import workspaceStyles from '../styles/reservation-workspace.css?inline';
import nativeWorkspaceStyles from '../styles/quote-booking-workspace.css?inline';
import '../styles/quote-booking-workspace.css';
import deliveryStyles from '../components/admin/AdminDeliveryHistory.css?inline';
import { quoteFrameNeedsRemount, scheduleQuoteFrameDelay } from '../utils/quoteFrameRecovery';
import {
    connectQuoteDesk,
    findQuoteDeskTool,
    isDesktopViewport,
    normalizeDocPath,
    quoteDeskFrameSrc,
    quoteDeskHref,
    quoteDeskPageId,
    quoteDeskToolForPath,
} from '../components/admin/quoteDesk';

/**
 * 맞춤 견적 데스크 — `/admin/quote-desk/:tool?`
 *
 * 견적 관리 도구(public/견적관리.html 등)를 다시 만들지 않고, 관리자 레이아웃 안에
 * 같은 출처 iframe 으로 끼워 넣는다. 로그인만 통합한다: 관리자 세션으로 견적 도구의
 * 관리자 값을 받아 sessionStorage 에 넣은 뒤 iframe 을 그리므로, 안쪽 화면은 자체
 * 비밀번호 화면 없이 열린다(안쪽 화면의 자체 메뉴는 public/admin-embed.js 가 숨긴다).
 */

// connecting: 관리자 세션으로 연결 중 · linked: iframe 표시 · unset: 서버에 ADMIN_TOKEN 없음 · failed: 연결 실패
type Phase = 'connecting' | 'linked' | 'unset' | 'failed';
interface BookingWorkspaceState {
    bookingId: string; cancelled: boolean; accepted: boolean; deposit: boolean; signed: boolean; confirmed: boolean;
    schedule: boolean; published: boolean; dayCount: number; guideReady: boolean; vehicleReady: boolean;
    lodgeCount: number; lodgeNeeded: number; travelerCount: number; expectedTravelers: number;
}
const workspaceFrameSrc = (customerPage: boolean, tool: ReturnType<typeof findQuoteDeskTool>, id?: string, editorId?: string) => customerPage && tool.key === 'inbox' && id
    ? `/견적관리?id=${encodeURIComponent(id)}&m=0&workspace=1` : quoteDeskFrameSrc(tool, id, editorId);

export const AdminQuoteDesk: React.FC<{ customerPage?: boolean }> = ({ customerPage = false }) => {
    const { user } = useUser();
    const accountId = user?.role === 'admin' ? user.id : '';
    const activeAccount = useRef(accountId); activeAccount.current = accountId;
    const { tool: toolParam, id: customerId } = useParams<{ tool?: string; id?: string }>();
    const [searchParams] = useSearchParams();
    const returnTo = customerWorkspaceReturnTo(searchParams.get('returnTo'), customerPage ? '/admin/quote-desk/inbox' : '/admin/reservations?type=quote_booking');
    const bookingId = customerPage ? customerId : ['bookings', 'inbox', 'builder'].includes(toolParam || '') ? searchParams.get('id') || undefined : undefined;
    const quoteEditorId = toolParam === 'inbox' ? searchParams.get('qe') || undefined : undefined;
    const navigate = useNavigate();
    const [customerResult, setCustomerResult] = useState<{ accountId: string; id: string; record: any } | null>(null);
    const customerRecord = customerResult?.accountId === accountId && customerResult.id === bookingId ? customerResult.record : null;
    const [customerError, setCustomerError] = useState('');
    const [customerRefreshing, setCustomerRefreshing] = useState(false);
    const [customerChecked, setCustomerChecked] = useState<{ accountId: string; id: string; at: string } | null>(null);
    const [customerRefresh, setCustomerRefresh] = useState(0);
    const [customerDelivery, setCustomerDelivery] = useState<{ accountId: string; data: AdminDeliveryData } | null>(null);
    const recordedDelivery = customerDelivery?.accountId === accountId && customerDelivery.data.bookingId === bookingId && customerDelivery.data.source === 'quote_booking' ? customerDelivery.data : undefined;
    const [customerEditor, setCustomerEditor] = useState<{ id: string; tool: string } | null>(null);
    const [editorExpanded, setEditorExpanded] = useState(false);
    const customerPageRef = useRef<HTMLDivElement>(null);
    const overviewScrollRef = useRef(0);
    const customerEditorTitleRef = useRef<HTMLHeadingElement>(null);
    // Mount the original editor on the first explicit task. Folding it afterwards
    // retains the same browsing context and any recoverable, unsaved input.
    const [editorMountScope, setEditorMountScope] = useState('');
    const customerEditorScope = JSON.stringify([accountId, bookingId || '']);
    const customerEditorMounted = editorMountScope === customerEditorScope;
    const [pendingSection, setPendingSection] = useState('');
    const pendingSectionRef = useRef(pendingSection); pendingSectionRef.current = pendingSection;
    const activeCustomer = useRef({ accountId, id: bookingId }); activeCustomer.current = { accountId, id: bookingId };
    const linkedToken = useRef('');
    const customerController = useRef<AbortController | null>(null);
    const lastEditorBusy = useRef(false);
    const tool = findQuoteDeskTool(customerPage ? customerEditor && customerEditor.id === bookingId ? customerEditor.tool : customerRecord && quoteCustomerIsBooking(customerRecord) ? 'bookings' : 'inbox' : toolParam);

    const [phase, setPhase] = useState<Phase>('connecting');
    const [linkedAccount, setLinkedAccount] = useState('');
    const linked = phase === 'linked' && linkedAccount === accountId && !!accountId;
    const connectionRequest = useRef(0);
    const connectController = useRef<AbortController | null>(null);
    const frameKey = `${accountId}:${customerPage ? 'customer-page' : 'quote-workspace'}:${tool.key}:${bookingId || ''}:${quoteEditorId || ''}`;
    // seq 가 바뀌면 iframe 을 새로 만든다(같은 주소를 다시 불러와야 할 때).
    const [frame, setFrame] = useState(() => ({ src: workspaceFrameSrc(customerPage, tool, bookingId, quoteEditorId), seq: 0, routeKey: frameKey }));
    const recoverySrc = useRef(frame.src);
    const [frameLoading, setFrameLoading] = useState(true);
    const [frameDelayed, setFrameDelayed] = useState(false);
    const [reloadAttempt, setReloadAttempt] = useState(0);
    const frameRef = useRef<HTMLIFrameElement>(null);
    // 안쪽 화면이 스스로 옮겨 간 메뉴. 이때는 주소만 맞추고 iframe 은 다시 불러오지 않는다.
    const followedKeyRef = useRef<string | null>(null);
    const followedHrefRef = useRef('');
    const frameReady = frame.routeKey === frameKey || followedKeyRef.current === tool.key;
    const frameIsMounted = linked && frameReady && (!customerPage || !!customerRecord && customerEditorMounted);
    const shownKeyRef = useRef(frameKey);
    const [editorNotice, setEditorNotice] = useState('');
    const [editorBusy, setEditorBusy] = useState(false);
    const [sendingKakao, setSendingKakao] = useState(false);
    const [editorDirty, setEditorDirty] = useState(false);
    const [showDeliveries, setShowDeliveries] = useState(false);
    const [bookingWorkspace, setBookingWorkspace] = useState<BookingWorkspaceState | null>(null);
    const [nativeHosts, setNativeHosts] = useState<{ bookingId: string; top: HTMLElement; navigation: HTMLElement; history: HTMLElement } | null>(null);
    const [activeSection, setActiveSection] = useState('docs');
    const blockedReason = useRef({ busy: false, error: '' });
    const handledAttempt = useRef('');
    const syncFrameLocation = useRef<() => void>(() => {});
    type EditorWindow = Window & { QuoteEditorState?: {
        getState: () => { dirty: boolean; busy: boolean; error?: string };
        flushAll: () => { ok: boolean; dirty?: boolean; busy: boolean; error?: string };
        approveLeaveOnce?: () => void;
    }; InhasuQuoteBookingWorkspace?: { getState: () => BookingWorkspaceState | null; navigate: (section: string) => boolean };
        InhasuQuoteInquiryWorkspace?: { navigate: (section: string) => boolean; flushAll: () => { ok: boolean; busy: boolean; error?: string } }; setStep?: (step: number) => void };
    const navigateWorkspace = (section: string) => {
        setActiveSection(section);
        try { (frameRef.current?.contentWindow as EditorWindow | null)?.InhasuQuoteBookingWorkspace?.navigate(section); }
        catch { setEditorNotice('예약 화면을 새로고침한 뒤 다시 선택해 주세요.'); }
    };
    const flushFrame = useCallback(() => {
        if (sendingKakao) return { ok: false, busy: true, error: '카카오 알림 발송이 끝난 뒤 이동해 주세요.' };
        try {
            const inner = frameRef.current?.contentWindow as EditorWindow | null;
            if (!inner || inner.location.origin !== window.location.origin) return { ok: true, busy: false };
            return inner.QuoteEditorState?.flushAll() || inner.InhasuQuoteInquiryWorkspace?.flushAll() || { ok: true, busy: false };
        } catch { return { ok: false, busy: false, error: '견적 편집 상태를 확인하지 못했습니다. 내용을 저장한 뒤 이동해 주세요.' }; }
    }, [sendingKakao]);
    const sendAccount = useCallback(() => {
        frameRef.current?.contentWindow?.postMessage({ type: 'inhasu-editor-account', version: 1,
            userId: user?.role === 'admin' ? user.id : '' }, window.location.origin);
    }, [user?.id, user?.role]);
    useEffect(() => {
        sendAccount();
        const receive = (event: MessageEvent) => {
            if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
            if (event.data?.type === 'inhasu-editor-ready' && event.data.version === 1) sendAccount();
            if (event.data?.type === 'inhasu-editor-state' && event.data.version === 1) {
                if (!event.data.busy && !event.data.error) setEditorNotice('');
                if (customerPage && lastEditorBusy.current && !event.data.busy) setCustomerRefresh(value => value + 1);
                lastEditorBusy.current = !!event.data.busy;
                setEditorBusy(!!event.data.busy);
                setEditorDirty(!!event.data.dirty);
                const pending = pendingSectionRef.current;
                if (pending) {
                    const inner = frameRef.current?.contentWindow as EditorWindow | null;
                    if (inner?.InhasuQuoteInquiryWorkspace?.navigate(pending) || inner?.InhasuQuoteBookingWorkspace?.navigate(pending)) setPendingSection('');
                }
                syncFrameLocation.current();
            }
            if (event.data?.type === 'inhasu-quote-customer-open' && event.data.version === 1 && typeof event.data.id === 'string' && event.data.id) {
                navigate(quoteCustomerHref(event.data.id, customerPage ? returnTo : quoteDeskHref(tool.key)));
            }
            if (event.data?.type === 'inhasu-quote-record-saved' && event.data.version === 1 && event.data.id === bookingId) setCustomerRefresh(value => value + 1);
            if (event.data?.type === 'inhasu-quote-booking-workspace' && event.data.version === 1 && event.data.state?.bookingId === bookingId) { setBookingWorkspace(event.data.state); syncFrameLocation.current(); }
        };
        window.addEventListener('message', receive);
        return () => window.removeEventListener('message', receive);
    }, [sendAccount, bookingId, customerPage, navigate, returnTo, tool.key]);
    const blocker = useBlocker(useCallback(({ currentLocation, nextLocation }) => {
        if (currentLocation.pathname === nextLocation.pathname && currentLocation.search === nextLocation.search) return false;
        if (followedKeyRef.current && nextLocation.pathname + nextLocation.search === followedHrefRef.current) return false; // Same child document, only synchronizing its address.
        const result = flushFrame();
        blockedReason.current = { busy: result.busy, error: result.error || '초안을 보관하지 못했습니다.' };
        return result.busy || !result.ok;
    }, [flushFrame]));
    useEffect(() => {
        if (blocker.state === 'unblocked') { handledAttempt.current = ''; return; }
        if (blocker.state !== 'blocked' || handledAttempt.current === blocker.location.key) return;
        handledAttempt.current = blocker.location.key;
        if (blockedReason.current.busy) { setEditorNotice('저장·발송·사진 업로드가 끝난 뒤 이동해 주세요.'); blocker.reset(); }
        else if (window.confirm(blockedReason.current.error + '\n\n초안을 보관하지 못한 상태로 이동할까요?')) blocker.proceed();
        else blocker.reset();
    }, [blocker]);
    useEffect(() => {
        const unload = (event: BeforeUnloadEvent) => {
            const result = flushFrame();
            if (result.busy || !result.ok) { event.preventDefault(); event.returnValue = ''; }
        };
        window.addEventListener('beforeunload', unload);
        return () => window.removeEventListener('beforeunload', unload);
    }, [flushFrame]);

    // 1) 관리자 세션으로 견적 도구를 연결한다(sessionStorage 에 관리자 값 저장).
    const connect = useCallback(async () => {
        const request = ++connectionRequest.current;
        connectController.current?.abort();
        const controller = new AbortController(); connectController.current = controller;
        if (!accountId) return;
        setPhase('connecting');
        try {
            const value = await connectQuoteDesk({ accountId, signal: controller.signal, isCurrent: () => activeAccount.current === accountId });
            if (!controller.signal.aborted && request === connectionRequest.current && activeAccount.current === accountId) { linkedToken.current = value || ''; setLinkedAccount(accountId); setPhase(value ? 'linked' : 'unset'); }
        } catch {
            if (!controller.signal.aborted && request === connectionRequest.current && activeAccount.current === accountId) setPhase('failed');
        }
    }, [accountId]);
    useEffect(() => { void connect(); return () => { connectionRequest.current++; connectController.current?.abort(); }; }, [connect]);
    useEffect(() => {
        if (!customerPage || !bookingId || !linked) return;
        const controller = new AbortController(); customerController.current?.abort(); customerController.current = controller;
        const id = bookingId; setCustomerError(''); setCustomerRefreshing(true);
        void loadQuoteCustomerRequest(id, linkedToken.current, controller.signal).then(record => {
            if (!controller.signal.aborted && activeCustomer.current.accountId === accountId && activeCustomer.current.id === id) {
                setCustomerResult({ accountId, id, record });
                setCustomerChecked({ accountId, id, at: new Date().toISOString() });
            }
        }).catch(error => {
            if (!controller.signal.aborted && activeCustomer.current.accountId === accountId && activeCustomer.current.id === id) {
                if ([401, 403, 404].includes(error?.status)) { setCustomerResult(null); setCustomerChecked(null); }
                setCustomerError(error instanceof Error ? error.message : '고객 정보를 불러오지 못했습니다.');
            }
        }).finally(() => { if (!controller.signal.aborted && activeCustomer.current.accountId === accountId && activeCustomer.current.id === id) setCustomerRefreshing(false); });
        return () => controller.abort();
    }, [customerPage, bookingId, linked, accountId, customerRefresh]);
    useEffect(() => {
        if (!customerPage && bookingId && !quoteEditorId && ['bookings', 'inbox'].includes(toolParam || '')) navigate(quoteCustomerHref(bookingId, searchParams.has('returnTo') ? returnTo : quoteDeskHref(toolParam!)), { replace: true });
    }, [customerPage, bookingId, quoteEditorId, toolParam, returnTo, navigate, searchParams]);
    useEffect(() => { setEditorExpanded(false); setEditorMountScope(''); setPendingSection(''); setCustomerEditor(null); setEditorDirty(false); overviewScrollRef.current = 0; lastEditorBusy.current = false; }, [customerPage, bookingId, accountId]);
    useEffect(() => {
        if (!customerPage) return;
        const refresh = () => setCustomerRefresh(value => value + 1);
        window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh);
    }, [customerPage]);
    useEffect(() => {
        setFrameDelayed(false);
        if (!frameIsMounted || customerPage && !editorExpanded || !frameLoading) return;
        return scheduleQuoteFrameDelay(() => setFrameDelayed(true));
    }, [frameIsMounted, customerPage, editorExpanded, frameLoading, frame.seq, frame.src, reloadAttempt]);

    // 2) 주소의 메뉴가 바뀌면(관리자 메뉴에서 다른 화면을 고르면) 그 문서를 불러온다.
    useEffect(() => {
        if (shownKeyRef.current === frameKey) return;
        shownKeyRef.current = frameKey;
        if (followedKeyRef.current === tool.key) {
            followedKeyRef.current = null;
            followedHrefRef.current = '';
            setFrame(prev => ({ ...prev, routeKey: frameKey }));
            return;
        }
        setNativeHosts(null); setBookingWorkspace(null); setActiveSection('docs');
        setEditorBusy(false);
        recoverySrc.current = workspaceFrameSrc(customerPage, tool, bookingId, quoteEditorId);
        setFrame((prev) => ({ src: recoverySrc.current, seq: prev.seq + 1, routeKey: frameKey }));
        setFrameLoading(true);
        // tool 은 tool.key 로 정해진다.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [frameKey]);

    // 3) 안쪽 화면이 다른 견적 화면으로 넘어가면(예: 문의 → 견적서 만들기) 메뉴 표시와 주소를 맞춘다.
    const handleFrameLoad = () => {
        let path = '', innerId = '', innerEditor = '';
        try {
            if (quoteFrameNeedsRemount(frameRef.current?.contentWindow?.location.href, window.location.origin)) return;
            path = frameRef.current?.contentWindow?.location.pathname ?? '';
            innerId = new URLSearchParams(frameRef.current?.contentWindow?.location.search).get('id') || '';
            innerEditor = new URLSearchParams(frameRef.current?.contentWindow?.location.search).get('qe') || '';
            recoverySrc.current = (frameRef.current?.contentWindow?.location.pathname || '') + (frameRef.current?.contentWindow?.location.search || '');
        } catch {
            return; // 다른 출처로 나간 경우 — 읽을 수 없으니 그대로 둔다
        }
        setFrameLoading(false); setFrameDelayed(false);
        sendAccount();
        const current = quoteDeskToolForPath(path);
        if (!current) return;
        if (current.key === 'bookings' && normalizeDocPath(path) === '/예약관리' && innerId) {
            try {
                const doc = frameRef.current?.contentDocument;
                const top = doc?.getElementById('admin-booking-workspace'), navigation = doc?.getElementById('admin-booking-navigation'), history = doc?.getElementById('admin-booking-history');
                const state = (frameRef.current?.contentWindow as EditorWindow | null)?.InhasuQuoteBookingWorkspace?.getState();
                if (doc && top && navigation && history && state?.bookingId === innerId) {
                    doc.documentElement.classList.add('native-booking-workspace');
                    doc.documentElement.classList.toggle('customer-booking-editor', customerPage);
                    if (customerPage && !doc.documentElement.dataset.customerSection) doc.documentElement.dataset.customerSection = 'docs';
                    if (!doc.getElementById('native-booking-workspace-style')) { const style = doc.createElement('style'); style.id = 'native-booking-workspace-style'; style.textContent = workspaceStyles + nativeWorkspaceStyles + deliveryStyles; doc.head.appendChild(style); }
                    setNativeHosts(old => old?.top === top && old.navigation === navigation && old.history === history ? old : { bookingId: innerId, top, navigation, history });
                    setBookingWorkspace(state);
                }
            } catch { /* A standalone or older document retains its existing workflow. */ }
        } else { setNativeHosts(null); setBookingWorkspace(null); }

        // 바깥 창은 데스크톱 폭인데 안쪽(더 좁은 iframe)이 모바일 관리자로 넘어갔으면 데스크톱 화면으로 되돌린다.
        if (current.mobileDoc && normalizeDocPath(path) === current.mobileDoc && isDesktopViewport() && !innerEditor) {
            try {
                frameRef.current?.contentWindow?.location.replace(`${current.doc}?m=0`);
                setFrameLoading(true);
            } catch { /* 그대로 둔다 */ }
            return;
        }

        const detailId = (current.key === 'bookings' && normalizeDocPath(path) === '/예약관리') || current.key === 'builder' ? innerId : '';
        const editorId = current.key === 'inbox' ? innerEditor : '';
        if (customerPage) {
            if (innerId && innerId !== bookingId && ['bookings', 'inbox', 'builder'].includes(current.key)) { navigate(quoteCustomerHref(innerId, returnTo), { replace: true }); return; }
            if (current.key !== tool.key) { followedKeyRef.current = current.key; setCustomerEditor({ id: bookingId || '', tool: current.key }); }
            return;
        }
        if (current.key !== tool.key || (['bookings', 'builder'].includes(current.key) && detailId !== (bookingId || '')) || editorId !== (quoteEditorId || '')) {
            followedKeyRef.current = current.key;
            followedHrefRef.current = quoteDeskHref(current.key) + (detailId ? `?id=${encodeURIComponent(detailId)}` : editorId ? `?qe=${encodeURIComponent(editorId)}` : '');
            if (searchParams.has('returnTo')) followedHrefRef.current += (followedHrefRef.current.includes('?') ? '&' : '?') + 'returnTo=' + encodeURIComponent(returnTo);
            navigate(followedHrefRef.current, { replace: true });
        }
    };
    syncFrameLocation.current = handleFrameLoad;

    // 안쪽 화면만 새로고침한다(안쪽 화면의 자체 새로고침 버튼은 메뉴와 함께 숨겨져 있다).
    const reloadFrame = () => {
        const result = flushFrame();
        if (result.busy) { setEditorNotice('저장·발송·사진 업로드가 끝난 뒤 새로고침해 주세요.'); return; }
        if (!result.ok && !window.confirm((result.error || '초안을 보관하지 못했습니다.') + '\n\n초안을 보관하지 못한 상태로 새로고침할까요?')) return;
        if (!result.ok) (frameRef.current?.contentWindow as EditorWindow | null)?.QuoteEditorState?.approveLeaveOnce?.();
        setFrameLoading(true); setFrameDelayed(false); setReloadAttempt(value => value + 1);
        try {
            const inner = frameRef.current?.contentWindow;
            if (inner && !quoteFrameNeedsRemount(inner.location.href, window.location.origin)) {
                inner.location.reload();
                return;
            }
        } catch { /* 아래에서 iframe 을 새로 만든다 */ }
        setNativeHosts(null); setBookingWorkspace(null);
        setFrame((prev) => ({ src: recoverySrc.current || prev.src, seq: prev.seq + 1, routeKey: frameKey }));
    };

    // 새 창으로 열기: 지금 안쪽에 떠 있는 화면을 단독으로 연다.
    // noopener 를 붙이지 않는다 — 새 창이 이 탭의 sessionStorage(관리자 값)를 이어받아야 자체 로그인 화면이 뜨지 않는다.
    const openStandalone = () => {
        let url = workspaceFrameSrc(customerPage, tool, bookingId, quoteEditorId);
        try {
            const inner = frameRef.current?.contentWindow?.location;
            if (inner && inner.origin === window.location.origin) url = `${inner.pathname}${inner.search}`;
        } catch { /* 기본 문서로 연다 */ }
        window.open(url, '_blank');
    };

    const focusCustomerEditor = useCallback((section: string) => {
        setActiveSection(['guide', 'vehicle', 'stay'].includes(section) ? 'assign' : section === 'send' ? 'docs' : ['flights', 'travelers', 'view-info'].includes(section) ? 'info' : section);
        try {
            const inner = frameRef.current?.contentWindow as EditorWindow | null;
            if (tool.key === 'bookings') return !!inner?.InhasuQuoteBookingWorkspace?.navigate(section);
            if (tool.key === 'inbox') return !!inner?.InhasuQuoteInquiryWorkspace?.navigate(section);
            if (tool.key === 'builder' && inner?.setStep) { inner.setStep(section === 'quote-share' ? 4 : 1); return true; }
        } catch { /* The loading state retains the requested section until the document is ready. */ }
        return false;
    }, [tool.key]);
    useEffect(() => {
        if (!customerPage || !editorExpanded || !pendingSection || frameLoading) return;
        if (focusCustomerEditor(pendingSection)) setPendingSection('');
    }, [customerPage, editorExpanded, pendingSection, frameLoading, bookingWorkspace, customerRecord, focusCustomerEditor]);
    const openCustomerEditor = (editorTool: string, section: string) => {
        const result = flushFrame();
        if (result.busy) { setEditorNotice('저장·발송·사진 업로드가 끝난 뒤 작업을 선택해 주세요.'); return; }
        if (!result.ok && !window.confirm((result.error || '초안을 보관하지 못했습니다.') + '\n\n초안을 보관하지 못한 상태로 다른 편집기를 열까요?')) return;
        if (!editorExpanded) overviewScrollRef.current = customerPageRef.current?.scrollTop || 0;
        setActiveSection(['guide', 'vehicle', 'stay'].includes(section) ? 'assign' : section === 'send' ? 'docs' : ['flights', 'travelers', 'view-info'].includes(section) ? 'info' : section);
        setPendingSection(section); setEditorExpanded(true); setEditorMountScope(customerEditorScope);
        setCustomerEditor({ id: bookingId || '', tool: editorTool });
        requestAnimationFrame(() => {
            if (customerPageRef.current) customerPageRef.current.scrollTop = 0;
            customerEditorTitleRef.current?.focus({ preventScroll: true });
        });
    };
    const closeCustomerEditor = () => {
        const result = flushFrame();
        if (result.busy) { setEditorNotice('저장·발송·사진 업로드가 끝난 뒤 고객 현황으로 돌아가 주세요.'); return; }
        if (!result.ok) { setEditorNotice(result.error || '초안을 보관하지 못했습니다. 저장 후 고객 현황으로 돌아가 주세요.'); return; }
        setEditorExpanded(false);
        requestAnimationFrame(() => {
            if (customerPageRef.current) customerPageRef.current.scrollTop = overviewScrollRef.current;
        });
    };
    const customerAction = (action: string) => {
        if (editorBusy || customerRefreshing || sendingKakao) return;
        if (action === 'back') { navigate(returnTo); return; }
        if (!customerRecord) return;
        if (['customer-link', 'quote-preview', 'itinerary-preview'].includes(action)) {
            const token = typeof customerRecord.token === 'string' ? customerRecord.token : '';
            if (!token) { setEditorNotice('고객 링크가 아직 발급되지 않았습니다. 먼저 견적서를 저장해 주세요.'); return; }
            const page = action === 'quote-preview' ? '견적서' : action === 'itinerary-preview' ? '확정일정표' : '내견적';
            window.open(`/${page}?t=${encodeURIComponent(token)}`, '_blank', 'noopener'); return;
        }
        const booked = quoteCustomerIsBooking(customerRecord);
        if (!booked && ['payments', 'assignments', 'operations'].includes(action)) { setEditorNotice('예약 진행 의사를 기록하고 예약관리를 시작하면 결제·배정·운영을 관리할 수 있습니다.'); return; }
        if (['flights', 'travelers', 'view-info', 'customer-detail'].includes(action)) { openCustomerEditor(booked ? 'bookings' : 'inbox', booked ? action === 'customer-detail' ? 'view-info' : action : 'info'); return; }
        if (action === 'edit-itinerary' || action === 'quote-share') { openCustomerEditor(booked && action !== 'quote-share' ? 'bookings' : 'builder', action === 'quote-share' ? 'quote-share' : 'docs'); return; }
        if (!booked && action === 'documents') { openCustomerEditor('builder', customerRecord.quote ? 'quote-share' : 'docs'); return; }
        const section = action === 'payments' ? 'pay' : action === 'assignments' ? 'assign' : ['guide', 'vehicle', 'stay'].includes(action) ? action : action === 'contract' ? 'contract' : action === 'history' ? 'log' : ['notes', 'operations'].includes(action) ? 'notes' : action === 'send-itinerary' ? 'send' : action === 'documents' ? 'docs' : 'info';
        openCustomerEditor(booked ? 'bookings' : 'inbox', section);
        if (!booked && ['payments', 'guide', 'vehicle', 'stay', 'contract'].includes(action)) setEditorNotice('예약 진행 의사를 기록하고 예약관리를 시작하면 결제·계약·배정을 관리할 수 있습니다.');
    };

    const customerEditorLabels: Record<string, { title: string; description: string }> = {
        docs: { title: '일정표 편집', description: '일자별 일정과 대표 명소를 수정하고, 저장 후 고객 문서를 확인하세요.' },
        contract: { title: '여행 계약서', description: '고객의 계약 동의와 서명 원본을 확인하세요.' },
        info: { title: '주문자 · 여행자 정보', description: '여행자 정보와 항공편, 픽업 장소를 한곳에서 확인하세요.' },
        pay: { title: '결제 · 영수증', description: '예약금과 잔금의 실제 입금 상태, 계좌와 영수증 기록을 관리하세요.' },
        assign: { title: '가이드 · 차량 · 숙소', description: '등록된 자원을 선택하고 일자별 숙소를 배정하세요.' },
        notes: { title: '운영 · 내부 메모', description: '출발 전 확인 사항과 직원용 메모를 관리하세요.' },
        log: { title: '변경 · 발송 이력', description: '문서 발송 결과와 예약 처리 기록을 확인하세요.' },
    };
    const customerEditorLabel = tool.key === 'builder'
        ? { title: customerRecord?.quote ? '견적서 수정' : '견적서 작성', description: '기본 정보부터 일정, 요금, 대표 명소 순서로 작성하세요.' }
        : tool.key === 'inbox'
            ? { title: activeSection === 'notes' ? '상담 · 내부 메모' : '문의 · 고객 정보', description: '문의 내용과 상담 기록을 확인하고 다음 업무를 이어가세요.' }
            : customerEditorLabels[activeSection] || customerEditorLabels.info;
    const receiveCustomerDelivery = (data: AdminDeliveryData) => {
        if (activeCustomer.current.accountId === accountId && activeCustomer.current.id === bookingId && data.source === 'quote_booking' && data.bookingId === bookingId) setCustomerDelivery({ accountId, data });
    };
    const customerModel = customerRecord ? { ...quoteCustomerWorkspaceModel(customerRecord, { deliveryHistory: recordedDelivery?.items }),
        documentLabel: quoteCustomerIsBooking(customerRecord) ? '고객 문서 확인·전달' : '견적서 확인·전달',
        disabledActions: quoteCustomerIsBooking(customerRecord) ? [] : ['payments', 'assignments', 'operations'],
        disabledActionReason: '예약 진행 후 결제·배정·운영을 관리할 수 있습니다.',
        workLabels: { payments: '결제·영수증', operations: '운영·메모' },
    } : null;
    const customerCheckedAt = customerChecked?.accountId === accountId && customerChecked.id === bookingId ? customerChecked.at : '';
    const canSendCustomerKakao = () => {
        if (editorBusy || customerRefreshing || sendingKakao || customerEditorMounted && frameLoading) return false;
        try {
            const inner = frameRef.current?.contentWindow as EditorWindow | null;
            const state = inner?.QuoteEditorState?.getState();
            if (editorDirty || state?.dirty || state?.busy || state?.error) { setEditorNotice('편집 중인 내용을 먼저 저장한 뒤 고객에게 카카오 알림을 발송해 주세요.'); return false; }
        } catch { setEditorNotice('편집 상태를 확인하지 못했습니다. 작업 화면에서 저장 상태를 확인해 주세요.'); return false; }
        return true;
    };

    return (
        <><AdminLayout
            activePage={quoteDeskPageId(tool.key)}
            eyebrow="맞춤 견적"
            title={customerPage ? '고객 통합 작업' : bookingId && tool.key === 'bookings' ? '견적 예약 상세' : tool.label}
            description={customerPage ? '선택한 문의·견적의 고객 정보와 일정·문서·예약 업무를 한곳에서 확인합니다.' : bookingId && tool.key === 'bookings' ? '선택한 고객의 입금·계약·배정·일정표를 관리합니다.' : tool.description}
            flush
            actions={
                <>
                    {(tool.key === 'inbox' || customerPage) && (
                        <button type="button" className="btn btn-blue" disabled={customerPage && !customerRecord} onClick={() => customerPage ? openCustomerEditor('builder', 'docs') : navigate(quoteDeskHref('builder'))}>
                            <Icon name="edit_document" />{customerPage && customerRecord?.quote ? '견적 수정' : '견적 작성'}
                        </button>
                    )}
                    <button type="button" className="btn btn-ghost" onClick={() => navigate(returnTo)}>
                        <Icon name="arrow_back" />{customerPage ? '목록으로' : '통합 예약 목록'}
                    </button>
                    {linked && (!customerPage || editorExpanded) && (
                        <button type="button" className="btn btn-ghost" onClick={() => { reloadFrame(); if (customerPage) setCustomerRefresh(value => value + 1); }}>
                            <Icon name="refresh" />{customerPage ? '작업 화면 다시 불러오기' : '새로고침'}
                        </button>
                    )}
                    {linked && tool.key === 'bookings' && bookingId && <button type="button" className="btn btn-ghost" onClick={() => customerPage ? customerAction('history') : nativeHosts ? navigateWorkspace('log') : setShowDeliveries(v => !v)}>발송 이력</button>}
                    <button type="button" className="btn btn-ghost" onClick={openStandalone}>
                        <Icon name="open_in_new" />새 창으로 열기
                    </button>
                </>
            }
        >
            {editorNotice && <div role="status" style={{ padding: '12px 20px', background: '#fff5e8', color: '#80521b' }}>{editorNotice}</div>}
            {linked ? (
                <div ref={customerPageRef} className={customerPage ? `quote-customer-page${editorExpanded ? ' is-editing' : ''}` : undefined} style={customerPage ? { flex: 1, minHeight: 0, overflow: editorExpanded ? 'hidden' : 'auto', background: '#f5f7fa' } : { position: 'relative', flex: 1, minHeight: 0, background: '#fff' }}>
                    {customerPage && <>
                        {customerError && <div role="alert" style={{ margin: 20, padding: 16, borderRadius: 12, background: '#fff5e8' }}>{customerError} <button type="button" className="btn btn-ghost" disabled={customerRefreshing} onClick={() => setCustomerRefresh(value => value + 1)}>다시 불러오기</button></div>}
                        {customerModel ? <div className="quote-customer-overview" hidden={editorExpanded}>
                            <CustomerWorkspaceOverview model={customerModel} onAction={customerAction} busy={editorBusy || customerRefreshing || sendingKakao}
                                notificationActions={<CustomerKakaoActions key={`${accountId}:${bookingId}`} source="quote_booking" bookingId={bookingId!}
                                    revision={JSON.stringify([customerCheckedAt, customerRecord, recordedDelivery?.items.map(item => [item.id, item.kind, item.channel, item.state, item.at, item.error])])} disabled={editorBusy || customerRefreshing || sendingKakao || editorDirty}
                                    disabledReason={editorDirty ? '편집 중인 내용을 먼저 저장한 뒤 고객에게 발송해 주세요.' : undefined}
                                    beforeSend={canSendCustomerKakao} onBusyChange={setSendingKakao} onResult={() => setCustomerRefresh(value => value + 1)} onHistory={() => customerAction('history')} />} />
                            {!editorExpanded && bookingId && <div hidden><AdminDeliveryHistory source="quote_booking" bookingId={bookingId} revision={customerRefresh} onData={receiveCustomerDelivery} /></div>}
                        </div> : !customerError && <div role="status" style={{ padding: 32 }}>고객 정보를 불러오는 중입니다.</div>}
                    </>}
                    {(!customerPage || customerRecord) && <div id={customerPage ? 'quote-customer-editor' : undefined} className={customerPage ? `quote-customer-editor-shell${editorExpanded ? ' is-expanded' : ''}` : undefined} inert={customerPage && !editorExpanded} aria-hidden={customerPage && !editorExpanded ? true : undefined} aria-labelledby={customerPage && editorExpanded ? 'quote-customer-editor-title' : undefined} style={customerPage ? undefined : { position: 'absolute', inset: 0 }}>
                    {customerPage && editorExpanded && customerModel && <div className="quote-customer-editor-heading">
                        <button type="button" className="btn btn-ghost quote-customer-return" disabled={editorBusy} onClick={closeCustomerEditor}><Icon name="arrow_back" />고객 현황</button>
                        <div className="quote-customer-focus-identity"><h2 ref={customerEditorTitleRef} tabIndex={-1} id="quote-customer-editor-title">{customerModel.customerName}<span>{customerEditorLabel.title}</span></h2><p>{customerModel.partyLabel}<span aria-hidden="true">·</span>{customerModel.period}</p></div>
                        <span className="quote-customer-focus-status" role="status">{editorBusy ? '작업 처리 중' : customerModel.statusLabel}</span>
                    </div>}
                    {frameIsMounted && <iframe
                        key={frame.seq}
                        ref={frameRef}
                        src={frame.src}
                        loading="eager"
                        tabIndex={customerPage && !editorExpanded ? -1 : undefined}
                        title={`맞춤 견적 · ${tool.label}`}
                        onLoad={handleFrameLoad}
                        className={customerPage ? 'quote-customer-editor-frame' : undefined}
                        style={customerPage ? undefined : { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, display: 'block' }}
                    />}
                    {showDeliveries && !nativeHosts && tool.key === 'bookings' && bookingId && <aside className="quote-delivery-panel" aria-label="견적 예약 발송 이력">
                        <button type="button" onClick={() => setShowDeliveries(false)}>이력 닫기</button>
                        <AdminDeliveryHistory source="quote_booking" bookingId={bookingId} revision={customerRefresh} onData={receiveCustomerDelivery} onOpenDocument={kind => {
                            setShowDeliveries(false);
                            try {
                                const doc = frameRef.current?.contentDocument;
                                const target = doc?.getElementById(kind === 'contract' ? 'requestContract' : kind === 'travel_notice' ? 'sendTravelNotice' : 'publishBtn') || doc?.querySelector('.action-bar');
                                target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                (target as HTMLElement | null)?.focus();
                            } catch { setEditorNotice('현재 예약 화면의 문서 발송 버튼에서 내용을 확인해 주세요.'); }
                        }} />
                    </aside>}
                    {frameIsMounted && frameLoading && (
                        <div
                            role="status"
                            aria-live="polite"
                            style={{
                                position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                                background: 'rgba(247,248,250,0.82)', pointerEvents: 'none',
                            }}
                        >
                            <div style={{ display: 'grid', gap: 12, justifyItems: 'center', padding: 20 }}>
                                <span className="row" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-tertiary)' }}>
                                    <Icon name="progress_activity" className="spin" />{frameDelayed ? '불러오기가 지연되고 있습니다' : '화면을 불러오는 중'}
                                </span>
                                {frameDelayed && <button type="button" className="btn btn-ink" style={{ pointerEvents: 'auto' }} onClick={reloadFrame}>다시 불러오기</button>}
                            </div>
                        </div>
                    )}
                    </div>}
                </div>
            ) : (
                <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 32 }}>
                    {phase === 'connecting' && (
                        <span className="row" role="status" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-tertiary)' }}>
                            <Icon name="progress_activity" className="spin" />견적 데스크에 연결하는 중
                        </span>
                    )}

                    {phase === 'unset' && (
                        <div className="card card-pad" style={{ maxWidth: 560 }}>
                            <div className="empty" style={{ padding: '18px 8px 10px' }}>
                                <Icon name="lock" />
                                <p style={{ color: 'var(--text-strong)', fontSize: 16, fontWeight: 800 }}>견적 데스크가 아직 연결되지 않았습니다</p>
                                <p style={{ lineHeight: 1.7, fontWeight: 500 }}>
                                    서버에 견적 관리자 비밀번호(환경 변수 <b>ADMIN_TOKEN</b>)가 설정되어 있지 않아
                                    견적 문의·예약 화면을 이 관리자 안에서 열 수 없습니다.
                                    Cloudflare Pages의 설정 &gt; 환경 변수에 <b>ADMIN_TOKEN</b>을 등록하고 다시 배포한 뒤 새로고침해 주세요.
                                </p>
                            </div>
                            <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
                                <button type="button" className="btn btn-ink" onClick={() => { void connect(); }}>
                                    <Icon name="refresh" />다시 확인
                                </button>
                            </div>
                        </div>
                    )}

                    {phase === 'failed' && (
                        <div className="card card-pad" style={{ maxWidth: 560 }}>
                            <div className="empty" style={{ padding: '18px 8px 10px' }}>
                                <Icon name="warning" />
                                <p style={{ color: 'var(--text-strong)', fontSize: 16, fontWeight: 800 }}>견적 데스크에 연결하지 못했습니다</p>
                                <p style={{ lineHeight: 1.7, fontWeight: 500 }}>
                                    관리자 로그인이 만료되었거나 서버에 연결할 수 없습니다. 다시 시도해도 같으면 다시 로그인해 주세요.
                                </p>
                            </div>
                            <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
                                <button type="button" className="btn btn-ink" onClick={() => { void connect(); }}>
                                    <Icon name="refresh" />다시 시도
                                </button>
                                <button type="button" className="btn btn-ghost" onClick={() => { window.location.href = '/admin/login'; }}>
                                    <Icon name="login" />다시 로그인
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </AdminLayout>
        {linked && tool.key === 'bookings' && bookingId && nativeHosts?.bookingId === bookingId && bookingWorkspace?.bookingId === bookingId && <>
            {!customerPage && createPortal(<div className="reservation-workspace product-workspace quote-native-workspace">
                <ReservationWorkflow cancelled={bookingWorkspace.cancelled} steps={[
                    { id: 'accepted', title: '예약 접수', description: bookingWorkspace.accepted ? '고객 예약 진행 의사 확인됨' : '고객의 예약 진행 의사를 확인하세요', done: bookingWorkspace.accepted, actionLabel: '주문 확인', onAction: () => navigateWorkspace('info') },
                    { id: 'deposit', title: '예약금 확인', description: bookingWorkspace.deposit ? '입금 확인 완료' : '입금 내역 확인 필요', done: bookingWorkspace.deposit, actionLabel: '입금 확인하기', onAction: () => navigateWorkspace('pay') },
                    { id: 'contract', title: '계약 동의', description: bookingWorkspace.signed ? '고객 서명 완료' : '고객 서명 확인 필요', done: bookingWorkspace.signed, actionLabel: '계약서 확인하기', onAction: () => navigateWorkspace('info') },
                    { id: 'schedule', title: '일정 준비', description: bookingWorkspace.schedule ? `${bookingWorkspace.dayCount}일 일정 준비됨` : '견적 일정 불러와 작성', done: bookingWorkspace.schedule, actionLabel: '일정 작성하기', onAction: () => navigateWorkspace('docs') },
                    { id: 'published', title: '일정표 공개', description: bookingWorkspace.published ? '고객에게 공개됨' : bookingWorkspace.confirmed ? '배정과 일정 확인 후 공개하세요' : '고객 수락·입금·서명 후 예약을 확정하세요', done: bookingWorkspace.published, actionLabel: '공개·전달하기', onAction: () => navigateWorkspace('docs') },
                ]} readiness={[
                    { title: '확정 일정', value: bookingWorkspace.schedule ? `${bookingWorkspace.dayCount}일` : '작성 필요', description: '견적의 일정과 같은 카드로 편집합니다', ready: bookingWorkspace.schedule, onAction: () => navigateWorkspace('docs') },
                    { title: '가이드·차량', value: bookingWorkspace.guideReady && bookingWorkspace.vehicleReady ? '배정 완료' : '배정 필요', description: `가이드 ${bookingWorkspace.guideReady ? '완료' : '미정'} · 차량 ${bookingWorkspace.vehicleReady ? '완료' : '미정'}`, ready: bookingWorkspace.guideReady && bookingWorkspace.vehicleReady, onAction: () => navigateWorkspace('assign') },
                    { title: '일자별 숙소', value: bookingWorkspace.lodgeNeeded ? `${bookingWorkspace.lodgeCount}/${bookingWorkspace.lodgeNeeded}박` : '당일 투어', description: '귀국일을 제외한 숙소 확인', ready: bookingWorkspace.lodgeCount >= bookingWorkspace.lodgeNeeded, onAction: () => navigateWorkspace('assign') },
                    { title: '계약·여행자', value: bookingWorkspace.signed ? '동의 완료' : '동의 대기', description: `여행자 ${bookingWorkspace.travelerCount}/${bookingWorkspace.expectedTravelers}명 입력`, ready: bookingWorkspace.signed && bookingWorkspace.travelerCount >= bookingWorkspace.expectedTravelers, onAction: () => navigateWorkspace('info') },
                ]} />
                <p className="quote-native-info">일정·주문·결제·배정은 아래 예약 편집기에 연결됩니다. 저장·고객 공개·발송은 각각의 작업 버튼으로 진행하세요.</p>
            </div>, nativeHosts.top)}
            {createPortal(<nav className="quote-native-tabs" aria-label="예약 상세 작업">{[['docs', '일정표'], ['contract', '계약서'], ['info', '주문자·여행자'], ['pay', '결제·영수증'], ['assign', '가이드·숙소'], ['notes', '운영·메모'], ['log', '변경·발송 이력']].map(([id, label]) => <button key={id} type="button" className={activeSection === id ? 'active' : ''} aria-current={activeSection === id ? 'location' : undefined} onClick={() => navigateWorkspace(id)}>{label}</button>)}</nav>, nativeHosts.navigation)}
            {createPortal(<AdminDeliveryHistory source="quote_booking" bookingId={bookingId} revision={customerRefresh} onData={receiveCustomerDelivery} onOpenDocument={kind => {
                navigateWorkspace(kind === 'contract' ? 'contract' : 'docs');
                const buttonId = kind === 'contract' ? 'contractRequestBtn' : kind === 'travel_notice' ? 'travelNoticeBtn' : 'itineraryNoticeBtn';
                frameRef.current?.contentDocument?.getElementById(buttonId)?.focus({ preventScroll: false });
            }} />, nativeHosts.history)}
        </>}
        </>
    );
};
