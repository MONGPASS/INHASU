import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { AdminDeliveryHistory } from '../components/admin/AdminDeliveryHistory';
import type { AdminDeliveryData } from '../types/adminDelivery';
import { AdminLayout } from '../components/admin/AdminLayout';
import { CustomerWorkspaceOverview } from '../components/admin/CustomerWorkspaceOverview';
import { QuoteAccountLinkDialog } from '../components/admin/QuoteAccountLinkDialog';
import { QuoteInquiryPanel, type QuoteInquiryHandle, type QuoteInquiryState } from '../components/admin/QuoteInquiryPanel';
import type { QuoteBuilderHandle } from './AdminQuoteBuilder';
import { QuoteBookingEditor, bookingSectionOf, type BookingRunAction, type BookingSection, type QuoteBookingEditorHandle } from '../components/admin/QuoteBookingEditorPanel';
import { CustomerKakaoActions } from '../components/admin/CustomerKakaoActions';
import { Ico, V7Menu, V7Styles, menuAt, type V7MenuItem, type V7MenuState } from '../components/admin/v7/v7Ui';
import { api } from '../lib/api';
import type { V7Source } from '../utils/reservationV7';
import { customerWorkspaceBackLabel, customerWorkspaceReturnTo } from '../utils/customerWorkspaceRoutes';
import { consumedCalendarWorkspaceSearch, readCalendarWorkspaceAction } from '../utils/calendarWorkspaceAction';
import { loadQuoteCustomerRequest, quoteCustomerIsBooking, quoteCustomerWorkspaceModel } from '../utils/quoteCustomerWorkspace';
import '../styles/quote-booking-workspace.css';
import { connectQuoteDesk, findQuoteDeskTool, quoteDeskPageId } from '../components/admin/quoteDesk';
import { adminConfirmLeave } from '../components/admin/ui/adminLeaveConfirm';
import { adminConfirm, adminNotify } from '../components/admin/ui/adminFeedback';
import { AdminButton, AdminCard, AdminEmpty, AdminIconButton, AdminLoading, AdminTabs, AdminTextButton, IconChevronDown, IconChevronLeft, IconCircleExclamationFill, IconLock, IconMoreHorizontal, IconRefresh } from '../components/admin/ui';

/**
 * 견적 고객 통합 작업 — `/admin/customer-workspace/quote/:id`
 *
 * 한 고객의 고객 현황(CustomerWorkspaceOverview)과 작업 화면을 함께 둔다. 작업 화면은 모두 React다(2026-11-24, 예약관리 전환 완료):
 * - 예약 전: 문의 상세(QuoteInquiryPanel) · 견적 편집(QuoteBuilderEditor, 견적서 만들기와 같은 편집기)
 * - 예약 뒤: 예약 편집기(QuoteBookingEditorPanel) — 작업 탭(일정표·계약서·주문자/여행자·결제·배정·운영 메모·발송 이력)
 * 옛 견적 도구 문서(견적관리·견적만들기·예약관리 등)를 iframe으로 끼우던 코드는 지웠다. 그 문서들은 휴대폰 옛 관리자와 결과 비교 테스트용으로만 남는다.
 * 견적 API는 관리자 세션으로 받은 견적 관리자 값(x-admin-token, connectQuoteDesk)을 쓴다.
 */

// connecting: 관리자 세션으로 연결 중 · linked: 연결됨 · unset: 서버에 ADMIN_TOKEN 없음 · failed: 연결 실패
type Phase = 'connecting' | 'linked' | 'unset' | 'failed';
type EditorFlush = { ok: boolean; busy: boolean; dirty?: boolean; error?: string };

// 견적 편집기는 고객 화면에서 그 작업을 열 때만 받는다(고객 현황만 보는 화면이 큰 편집기 코드를 함께 받지 않게).
const QuoteBuilderEditor = lazy(() => import('./AdminQuoteBuilder').then(module => ({ default: module.QuoteBuilderEditor })));

/** 예약 편집기의 작업 탭(옛 예약관리 고객 화면의 data-customer-section과 같은 칸) */
const BOOKING_TABS: Array<[BookingSection, string]> = [['docs', '일정표'], ['contract', '계약서'], ['info', '주문자·여행자'], ['pay', '결제·영수증'], ['assign', '가이드·숙소'], ['notes', '운영·메모'], ['log', '변경·발송 이력']];
const sectionOf = (section: string) => ['guide', 'vehicle', 'stay'].includes(section) ? 'assign' : section === 'send' ? 'docs' : ['flights', 'travelers', 'view-info'].includes(section) ? 'info' : section;

export const AdminQuoteDesk: React.FC = () => {
    const { user } = useUser();
    const accountId = user?.role === 'admin' ? user.id : '';
    const activeAccount = useRef(accountId); activeAccount.current = accountId;
    const { id: bookingId } = useParams<{ id?: string }>();
    const [searchParams] = useSearchParams();
    const workspaceLocation = useLocation();
    const calendarActionRequest = useRef<{ key: string; scope: string; consumed: boolean } | null>(null);
    const returnTo = customerWorkspaceReturnTo(searchParams.get('returnTo'), '/admin/quote-desk/inbox');
    const navigate = useNavigate();
    const [customerResult, setCustomerResult] = useState<{ accountId: string; id: string; record: Record<string, unknown> } | null>(null);
    const customerRecord = customerResult?.accountId === accountId && customerResult.id === bookingId ? customerResult.record : null;
    const [customerError, setCustomerError] = useState('');
    const [customerRefreshing, setCustomerRefreshing] = useState(false);
    const [customerChecked, setCustomerChecked] = useState<{ accountId: string; id: string; at: string } | null>(null);
    const [customerRefresh, setCustomerRefresh] = useState(0);
    const [customerDelivery, setCustomerDelivery] = useState<{ accountId: string; data: AdminDeliveryData } | null>(null);
    // 예약 관리 v7 상세의 진행 단계·박별 숙소는 통합 예약 목록과 같은 견적 예약 요약으로 계산한다.
    const [bookingSummary, setBookingSummary] = useState<{ accountId: string; id: string; item: V7Source | null } | null>(null);
    const v7Source = bookingSummary?.accountId === accountId && bookingSummary.id === bookingId ? bookingSummary.item : null;
    useEffect(() => {
        if (!accountId || !bookingId || !customerRecord || !quoteCustomerIsBooking(customerRecord)) return;
        let cancelled = false;
        api.adminBookings.quote().then(result => {
            if (cancelled) return;
            const found = result.items.find(entry => entry.id === bookingId);
            setBookingSummary({ accountId, id: bookingId, item: found ? { ...(found as unknown as V7Source), type: 'quote_booking' } : null });
        }).catch(() => { if (!cancelled) setBookingSummary({ accountId, id: bookingId, item: null }); });
        return () => { cancelled = true; };
    }, [accountId, bookingId, customerRecord]);
    const recordedDelivery = customerDelivery?.accountId === accountId && customerDelivery.data.bookingId === bookingId && customerDelivery.data.source === 'quote_booking' ? customerDelivery.data : undefined;
    const [customerEditor, setCustomerEditor] = useState<{ id: string; tool: string } | null>(null);
    const [editorExpanded, setEditorExpanded] = useState(false);
    const customerPageRef = useRef<HTMLDivElement>(null);
    const overviewScrollRef = useRef(0);
    const customerEditorTitleRef = useRef<HTMLHeadingElement>(null);
    // 작업 화면은 처음 작업을 고를 때 만들고, 고객 현황으로 접어도 그대로 두어 고치던 내용을 지킨다.
    const [editorMountScope, setEditorMountScope] = useState('');
    const customerEditorScope = JSON.stringify([accountId, bookingId || '']);
    const customerEditorMounted = editorMountScope === customerEditorScope;
    const [pendingSection, setPendingSection] = useState('');
    const pendingSectionRef = useRef(pendingSection); pendingSectionRef.current = pendingSection;
    const activeCustomer = useRef({ accountId, id: bookingId }); activeCustomer.current = { accountId, id: bookingId };
    const linkedToken = useRef('');
    const customerController = useRef<AbortController | null>(null);
    const lastEditorBusy = useRef(false);
    const tool = findQuoteDeskTool(customerEditor && customerEditor.id === bookingId ? customerEditor.tool : customerRecord && quoteCustomerIsBooking(customerRecord) ? 'bookings' : 'inbox');

    const [phase, setPhase] = useState<Phase>('connecting');
    const [linkedAccount, setLinkedAccount] = useState('');
    const linked = phase === 'linked' && linkedAccount === accountId && !!accountId;
    const connectionRequest = useRef(0);
    const connectController = useRef<AbortController | null>(null);
    // 작업 화면 셋(모두 React): 예약 전 문의 상세 · 견적 편집 · 예약 편집
    const nativeInquiry = tool.key === 'inbox';
    const nativeBuilder = tool.key === 'builder';
    const nativeBooking = tool.key === 'bookings';
    const inquiryRef = useRef<QuoteInquiryHandle>(null);
    const builderRef = useRef<QuoteBuilderHandle>(null);
    const bookingRef = useRef<QuoteBookingEditorHandle>(null);
    // ‘작업 화면 다시 불러오기’로 작업 화면을 새로 그릴 때 올린다.
    const [nativeReload, setNativeReload] = useState(0);
    const [editorNotice, setEditorNotice] = useState('');
    const [accountReviewId, setAccountReviewId] = useState('');
    const [editorBusy, setEditorBusy] = useState(false);
    const [sendingKakao, setSendingKakao] = useState(false);
    // 고객 현황 '지금 할 일' 버튼(예약 만들기·입금 확인·서명 안내·예약 확정·일정표 공개)을 서버에 저장하는 중
    const [quickBusy, setQuickBusy] = useState(false);
    const [editorDirty, setEditorDirty] = useState(false);
    const [activeSection, setActiveSection] = useState('docs');
    const blockedReason = useRef({ busy: false, error: '' });
    const handledAttempt = useRef('');
    const navigateWorkspace = (section: string) => {
        setActiveSection(section);
        if (nativeBooking) bookingRef.current?.navigate(section);
    };
    /** 열려 있는 작업 화면의 초안을 보관한다(이동·새로고침·다른 작업 열기 전에) */
    const flushFrame = useCallback((): EditorFlush => {
        if (sendingKakao) return { ok: false, busy: true, error: '카카오 알림 발송이 끝난 뒤 이동해 주세요.' };
        if (nativeInquiry) return inquiryRef.current?.flushAll() || { ok: true, busy: false };
        if (nativeBuilder) return builderRef.current?.flushAll() || { ok: true, busy: false };
        if (nativeBooking) return bookingRef.current?.flushAll() || { ok: true, busy: false };
        return { ok: true, busy: false };
    }, [sendingKakao, nativeInquiry, nativeBuilder, nativeBooking]);
    // 작업 화면의 저장 중·미저장. 고객 현황은 저장이 성공했을 때 onSaved로 한 번만 다시 읽는다.
    // 작업 화면이 처음 상태를 알리면 기다리던 작업 위치(pendingSection)로 옮긴다.
    const focusRef = useRef<(section: string) => boolean>(() => false);
    const receiveNativeState = useCallback((state: QuoteInquiryState) => {
        if (!state.busy && !state.error) setEditorNotice('');
        lastEditorBusy.current = state.busy;
        setEditorBusy(state.busy); setEditorDirty(state.dirty);
        const pending = pendingSectionRef.current;
        if (pending && focusRef.current(pending)) setPendingSection('');
    }, []);
    const blocker = useBlocker(useCallback(({ currentLocation, nextLocation }) => {
        if (currentLocation.pathname === nextLocation.pathname && currentLocation.search === nextLocation.search) return false;
        const result = flushFrame();
        blockedReason.current = { busy: result.busy, error: result.error || '초안을 보관하지 못했습니다.' };
        return result.busy || !result.ok;
    }, [flushFrame]));
    useEffect(() => {
        if (blocker.state === 'unblocked') { handledAttempt.current = ''; return; }
        if (blocker.state !== 'blocked' || handledAttempt.current === blocker.location.key) return;
        handledAttempt.current = blocker.location.key;
        if (blockedReason.current.busy) { setEditorNotice('저장·발송·사진 업로드가 끝난 뒤 이동해 주세요.'); blocker.reset(); }
        else adminConfirmLeave(blocker, blockedReason.current.error + '\n\n초안을 보관하지 못한 상태로 이동할까요?');
    }, [blocker]);
    useEffect(() => {
        const unload = (event: BeforeUnloadEvent) => {
            const result = flushFrame();
            if (result.busy || !result.ok) { event.preventDefault(); event.returnValue = ''; }
        };
        window.addEventListener('beforeunload', unload);
        return () => window.removeEventListener('beforeunload', unload);
    }, [flushFrame]);

    // 1) 관리자 세션으로 견적 API를 연결한다(견적 관리자 값).
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
    // 2) 그 고객의 요청을 읽는다(저장 뒤·창으로 돌아올 때 다시)
    useEffect(() => {
        if (!bookingId || !linked) return;
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
    }, [bookingId, linked, accountId, customerRefresh]);
    useEffect(() => { setEditorExpanded(false); setEditorMountScope(''); setPendingSection(''); setCustomerEditor(null); setEditorDirty(false); overviewScrollRef.current = 0; lastEditorBusy.current = false; }, [bookingId, accountId]);
    useEffect(() => {
        const refresh = () => setCustomerRefresh(value => value + 1);
        window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh);
    }, []);

    /** 작업 화면을 새로 그린다(초안을 보관한 뒤) */
    const reloadFrame = async () => {
        const result = flushFrame();
        if (result.busy) { setEditorNotice('저장·발송·사진 업로드가 끝난 뒤 새로고침해 주세요.'); return; }
        if (!result.ok && !await adminConfirm({ title: '작업 화면 새로고침', message: (result.error || '초안을 보관하지 못했습니다.') + '\n\n초안을 보관하지 못한 상태로 새로고침할까요?', confirmLabel: '새로고침' })) return;
        setNativeReload(value => value + 1);
    };

    const focusCustomerEditor = useCallback((section: string) => {
        setActiveSection(sectionOf(section));
        if (nativeInquiry) return !!inquiryRef.current?.navigate(section);
        if (nativeBuilder) return !!builderRef.current?.navigate(section);
        if (nativeBooking) return !!bookingRef.current?.navigate(section);
        return false;
    }, [nativeInquiry, nativeBuilder, nativeBooking]);
    focusRef.current = focusCustomerEditor;
    useEffect(() => {
        if (!editorExpanded || !pendingSection) return;
        if (focusCustomerEditor(pendingSection)) setPendingSection('');
    }, [editorExpanded, pendingSection, customerRecord, focusCustomerEditor]);
    const openCustomerEditor = async (editorTool: string, section: string) => {
        const result = flushFrame();
        if (result.busy) { setEditorNotice('저장·발송·사진 업로드가 끝난 뒤 작업을 선택해 주세요.'); return; }
        // 확인 창은 비동기라, 창이 떠 있는 동안 고객·계정이 바뀌면 열지 않는다.
        const scope = customerEditorScope;
        if (!result.ok && (!await adminConfirm({ title: '다른 편집기 열기', message: (result.error || '초안을 보관하지 못했습니다.') + '\n\n초안을 보관하지 못한 상태로 다른 편집기를 열까요?', confirmLabel: '열기' })
            || scope !== JSON.stringify([activeCustomer.current.accountId, activeCustomer.current.id || '']))) return;
        if (!editorExpanded) overviewScrollRef.current = customerPageRef.current?.scrollTop || 0;
        setActiveSection(sectionOf(section));
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
    /* '지금 할 일' 버튼: 기존 견적 API 하나로 저장한다. 고객 알림은 서버가 원래 규칙대로 보낸다(예약 접수·서명 안내·확정·일정표).
       작업 화면의 저장과 같은 기록을 바꾸므로, 편집 중이면 먼저 저장하게 하고 끝나면 작업 화면을 최신 내용으로 다시 연다. */
    const QUICK_ACTIONS: Record<string, { body: Record<string, unknown>; done: string }> = {
        'accept-quote': { body: { acceptQuote: true }, done: '예약을 만들었어요. 고객 화면에 예약금·입금 계좌가 보여요.' },
        'confirm-deposit': { body: { confirmDeposit: true }, done: '입금 확인을 기록했어요. 계약서 서명 안내를 요청했어요.' },
        'notify-contract': { body: { notifyContract: true }, done: '계약서 서명 안내를 다시 요청했어요.' },
        'confirm-booking': { body: { status: '예약확정' }, done: '예약을 확정했어요.' },
        'publish-itinerary': { body: { publishItinerary: true }, done: '확정일정표를 공개했어요.' },
    };
    const runQuickAction = async (action: string) => {
        const quick = QUICK_ACTIONS[action], id = bookingId, account = accountId;
        if (!quick || !customerRecord || !id || quickBusy) return;
        if (!canSendCustomerKakao()) return;
        const button = customerModel?.flow?.next.primary?.action === action ? customerModel.flow.next.primary : undefined;
        if (button?.confirm && !await adminConfirm({ title: button.label, message: button.confirm, confirmLabel: button.label })) return;
        if (activeCustomer.current.accountId !== account || activeCustomer.current.id !== id) return;
        setQuickBusy(true);
        try {
            const response = await fetch(`/api/requests/${encodeURIComponent(id)}`, { method: 'PATCH', cache: 'no-store',
                headers: { 'Content-Type': 'application/json', 'x-admin-token': linkedToken.current }, body: JSON.stringify(quick.body) });
            const payload = await response.json().catch(() => null);
            if (!response.ok || payload?.ok !== true) { adminNotify(typeof payload?.error === 'string' && payload.error ? payload.error : '저장하지 못했습니다. 다시 시도해 주세요.', 'error'); return; }
            adminNotify(quick.done, 'success');
            if (!editorExpanded) setEditorMountScope('');
        } catch { adminNotify('연결이 끊겨 저장하지 못했습니다. 다시 시도해 주세요.', 'error'); }
        finally { setQuickBusy(false); setCustomerRefresh(value => value + 1); }
    };
    const customerAction = (action: string) => {
        if (editorBusy || customerRefreshing || sendingKakao || quickBusy) return;
        if (action === 'back') { navigate(returnTo); return; }
        if (!customerRecord) return;
        if (QUICK_ACTIONS[action]) { void runQuickAction(action); return; }
        if (['customer-link', 'quote-preview', 'itinerary-preview'].includes(action)) {
            const token = typeof customerRecord.token === 'string' ? customerRecord.token : '';
            if (!token) { setEditorNotice('고객 링크가 아직 발급되지 않았습니다. 먼저 견적서를 저장해 주세요.'); return; }
            const page = action === 'quote-preview' ? '견적서' : action === 'itinerary-preview' ? '확정일정표' : '내견적';
            window.open(`/${page}?t=${encodeURIComponent(token)}`, '_blank', 'noopener'); return;
        }
        const booked = quoteCustomerIsBooking(customerRecord);
        if (!booked && ['payments', 'assignments', 'operations'].includes(action)) { setEditorNotice('예약 진행 의사를 기록하고 예약관리를 시작하면 결제·배정·운영을 관리할 수 있습니다.'); return; }
        if (['flights', 'travelers', 'view-info', 'customer-detail'].includes(action)) { openCustomerEditor(booked ? 'bookings' : 'inbox', booked ? action === 'customer-detail' ? 'view-info' : action : 'info'); return; }
        if (action === 'quote-edit') { openCustomerEditor('builder', 'docs'); return; }
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
    const customerModel = customerRecord ? { ...quoteCustomerWorkspaceModel(customerRecord, { deliveryHistory: recordedDelivery?.items }), backLabel: customerWorkspaceBackLabel(returnTo),
        documentLabel: quoteCustomerIsBooking(customerRecord) ? '고객 문서 확인·전달' : '견적서 확인·전달',
        documentAction: quoteCustomerIsBooking(customerRecord) ? 'notices' as const : 'documents' as const,
        disabledActions: quoteCustomerIsBooking(customerRecord) ? [] : ['payments', 'assignments', 'operations'],
        disabledActionReason: '예약 진행 후 결제·배정·운영을 관리할 수 있습니다.',
        workLabels: { payments: '결제·영수증', operations: '운영·메모' },
    } : null;
    const customerCheckedAt = customerChecked?.accountId === accountId && customerChecked.id === bookingId ? customerChecked.at : '';
    useEffect(() => {
        const action = readCalendarWorkspaceAction(workspaceLocation.search);
        if (!action || !linked || !customerRecord || !bookingId || customerRefreshing || editorBusy || sendingKakao || editorDirty) return;
        const scope = JSON.stringify([accountId, bookingId]);
        const key = JSON.stringify([scope, workspaceLocation.key, action]);
        if (calendarActionRequest.current?.key === key) return;
        const state = flushFrame();
        if (state.busy || !state.ok) return;
        calendarActionRequest.current = { key, scope, consumed: false };
        customerAction(action);
    }, [linked, customerRecord, bookingId, accountId, customerRefreshing, editorBusy, sendingKakao, editorDirty, workspaceLocation, flushFrame, customerAction]);
    useEffect(() => {
        const request = calendarActionRequest.current;
        if (!request || request.consumed || request.scope !== JSON.stringify([accountId, bookingId]) || !readCalendarWorkspaceAction(workspaceLocation.search)) return;
        // 작업 화면이 그 작업 위치로 옮기면(pendingSection이 비면) 주소의 바로가기를 지운다.
        if (!editorExpanded || !customerEditorMounted || pendingSection || editorBusy || sendingKakao) return;
        request.consumed = true;
        navigate({ pathname: workspaceLocation.pathname, search: consumedCalendarWorkspaceSearch(workspaceLocation.search), hash: workspaceLocation.hash }, { replace: true });
    }, [accountId, bookingId, workspaceLocation, editorExpanded, customerEditorMounted, pendingSection, editorBusy, sendingKakao, navigate]);
    const canSendCustomerKakao = () => {
        if (editorBusy || customerRefreshing || sendingKakao) return false;
        if (editorDirty) { setEditorNotice('편집 중인 내용을 먼저 저장한 뒤 고객에게 카카오 알림을 발송해 주세요.'); return false; }
        return true;
    };
    // 편집 도구줄 메뉴(고객에게 전달 · 가이드 전달 · ⋯)와 현황 머리 ⋯. 예약 편집기의 작업을 부르며 저장·발송 중에는 실행하지 않는다.
    const [toolMenu, setToolMenu] = useState<V7MenuState | null>(null);
    const deliveryButtonRef = useRef<HTMLButtonElement>(null);
    const bookingEditor = nativeBooking && !!bookingId;
    const frameLinks = () => bookingRef.current?.links() || null;
    // 고객에게 나가는 항목(알림·주의사항)만 저장 전 편집 내용이 없어야 한다. 가이드 인쇄는 스스로 저장하고, 되돌리기는 편집 중에 쓰는 기능이다.
    const runFrame = (action: BookingRunAction, needsClean = false) => {
        if (editorBusy || sendingKakao) { setEditorNotice('저장·발송이 끝난 뒤 다시 선택해 주세요.'); return; }
        if (needsClean && !canSendCustomerKakao()) return;
        if (!bookingRef.current?.run(action)) setEditorNotice('지금은 실행할 수 없습니다. 작업 화면의 저장 상태를 확인해 주세요.');
    };
    const openToolMenu = (anchor: HTMLElement, title: string, items: V7MenuItem[]) => setToolMenu(menuAt(anchor, title, items, true));
    const openCustomerLink = (url: string | null) => { if (url) window.open(url, '_blank', 'noopener'); };
    const deliveryMenu = (anchor: HTMLElement) => {
        const l = frameLinks(), noLink = '견적 저장 후 고객 링크가 발급됩니다';
        openToolMenu(anchor, '고객에게 전달', [
            { key: 'notice', label: '확정일정표 알림', sub: '카카오 알림톡으로 확정 일정표 링크를 보냅니다', subTone: 'muted', onPick: () => runFrame('itineraryNotice', true) },
            { key: 'confirm', label: '확정일정표 보기', sub: l?.confirm ? '새 탭에서 엽니다' : noLink, subTone: 'muted', disabled: !l?.confirm, onPick: () => openCustomerLink(l?.confirm || null) },
            { key: 'contract', label: '여행계약서', sub: l?.contract ? '새 탭에서 엽니다' : noLink, subTone: 'muted', disabled: !l?.contract, onPick: () => openCustomerLink(l?.contract || null) },
            { key: 'copy', label: '링크 복사', sub: '고객 견적 페이지 링크를 복사합니다', subTone: 'muted', onPick: () => runFrame('copyLink') },
            { key: 'travel', label: l?.travelNoticeLabel || '주의사항 발송', sub: '여행 주의사항 PDF를 고객에게 보냅니다', subTone: 'muted', disabled: !!l?.travelNoticeDisabled, onPick: () => runFrame('travelNotice', true) },
        ]);
    };
    const guideMenu = (anchor: HTMLElement) => {
        const l = frameLinks();
        openToolMenu(anchor, '가이드 전달', [
            { key: 'sheet', label: '가이드 시트 PDF', sub: '항공편·고객 명단·숙소·일정·거래명세서', subTone: 'muted', onPick: () => runFrame('guideSheet') },
            { key: 'pdf', label: '가이드용 PDF', sub: l && !l.hasQuote ? '견적서를 먼저 작성해 주세요' : '가이드용 일정표를 인쇄합니다', subTone: 'muted', disabled: !!l && !l.hasQuote, onPick: () => runFrame('guidePdf') },
        ]);
    };
    const moreMenu = (anchor: HTMLElement) => {
        const l = editorExpanded ? frameLinks() : null;
        openToolMenu(anchor, '기타 작업', [
            ...(bookingId && customerRecord ? [{ key: 'account', label: '고객 계정 연결', onPick: () => setAccountReviewId(bookingId) }] : []),
            ...(editorExpanded ? [{ key: 'reload', label: '작업 화면 다시 불러오기', onPick: () => { void reloadFrame(); setCustomerRefresh(value => value + 1); } }] : []),
            ...(linked && tool.key === 'bookings' && bookingId ? [{ key: 'log', label: '발송 이력', sub: '변경·발송 이력 탭', subTone: 'muted' as const, onPick: () => { if (editorExpanded && bookingEditor) navigateWorkspace('log'); else customerAction('history'); } }] : []),
            ...(tool.key !== 'builder' || !editorExpanded ? [{ key: 'quote', label: customerRecord?.quote ? '견적서 수정' : '견적서 작성', disabled: !customerRecord, onPick: () => openCustomerEditor('builder', 'docs') }] : []),
            ...(editorExpanded && bookingEditor ? [{ key: 'revert', label: '되돌리기', sub: '마지막 저장 상태로 되돌립니다', subTone: 'warn' as const, disabled: !!l?.undoDisabled, onPick: () => runFrame('revert') }] : []),
        ]);
    };

    return (
        <AdminLayout
            activePage={quoteDeskPageId(tool.key)}
            eyebrow="맞춤 견적"
            title="고객 통합 작업"
            description="선택한 문의·견적의 고객 정보와 일정·문서·예약 업무를 한곳에서 확인합니다."
            flush
            hideHeading={editorExpanded}
            actions={<>
                {/* 고객 현황 머리: 목록 복귀와 ⋯(견적서 수정 · 발송 이력)만. 나머지는 v7 상세 카드와 편집 도구줄이 맡는다. */}
                <AdminButton variant="secondary" leading={<IconChevronLeft />} onClick={() => navigate(returnTo)}>목록으로</AdminButton>
                <AdminIconButton variant="outlined" label="기타 작업" aria-haspopup="menu" onClick={event => moreMenu(event.currentTarget)}>
                    <IconMoreHorizontal />
                </AdminIconButton>
            </>}
        >
            <V7Styles /><V7Menu menu={toolMenu} onClose={() => setToolMenu(null)} />
            {editorNotice && <div role="status" className="adm-msg is-cautionary qd-notice">{editorNotice}</div>}
            {linked ? (
                <div ref={customerPageRef} className={`quote-customer-page${editorExpanded ? ' is-editing' : ''}`}>
                    {bookingId && accountReviewId === bookingId && customerModel && <QuoteAccountLinkDialog key={bookingId} requestId={bookingId}
                        customerName={customerModel.customerName} onClose={() => setAccountReviewId('')} />}
                    {customerError && <div role="alert" className="adm-msg is-cautionary qd-customer-error">{customerError} <AdminTextButton size="sm" disabled={customerRefreshing} onClick={() => setCustomerRefresh(value => value + 1)}>다시 불러오기</AdminTextButton></div>}
                    {customerModel ? <div className="quote-customer-overview" hidden={editorExpanded}>
                        <CustomerWorkspaceOverview model={customerModel} onAction={customerAction} busy={editorBusy || customerRefreshing || sendingKakao || quickBusy}
                            links={{ source: v7Source, userId: accountId, onAssignmentSaved: () => setCustomerRefresh(value => value + 1) }}
                            notificationActions={<CustomerKakaoActions key={`${accountId}:${bookingId}`} source="quote_booking" bookingId={bookingId!}
                                revision={JSON.stringify([customerCheckedAt, customerRecord, recordedDelivery?.items.map(item => [item.id, item.kind, item.channel, item.state, item.at, item.error])])} disabled={editorBusy || customerRefreshing || sendingKakao || editorDirty}
                                disabledReason={editorDirty ? '편집 중인 내용을 먼저 저장한 뒤 고객에게 발송해 주세요.' : undefined}
                                beforeSend={canSendCustomerKakao} onBusyChange={setSendingKakao} onResult={() => setCustomerRefresh(value => value + 1)} onHistory={() => customerAction('history')} />} />
                        {!editorExpanded && bookingId && <div hidden><AdminDeliveryHistory source="quote_booking" bookingId={bookingId} revision={customerRefresh} onData={receiveCustomerDelivery} /></div>}
                    </div> : !customerError && <div role="status" className="qd-customer-loading">고객 정보를 불러오는 중입니다.</div>}
                    {customerRecord && <div id="quote-customer-editor" className={`quote-customer-editor-shell${editorExpanded ? ' is-expanded' : ''}`} inert={!editorExpanded} aria-hidden={!editorExpanded ? true : undefined} aria-labelledby={editorExpanded ? 'quote-customer-editor-title' : undefined}>
                        {editorExpanded && customerModel && <div className="quote-customer-editor-heading">
                            <AdminButton variant="secondary" size="sm" className="quote-customer-return" leading={<IconChevronLeft />} disabled={editorBusy} onClick={closeCustomerEditor}>고객 현황</AdminButton>
                            <div className="quote-customer-focus-identity"><h2 ref={customerEditorTitleRef} tabIndex={-1} id="quote-customer-editor-title">{customerModel.customerName}<span>{customerEditorLabel.title}</span></h2><p>{customerModel.partyLabel}<span aria-hidden="true">·</span>{customerModel.period}</p></div>
                            <span className="quote-customer-focus-status" role="status">{editorBusy ? '작업 처리 중' : customerModel.statusLabel}</span>
                            <div className="quote-customer-editor-tools">
                                {bookingEditor && <AdminButton ref={deliveryButtonRef} variant="secondary" size="sm" disabled={editorBusy} aria-haspopup="menu" onClick={event => deliveryMenu(event.currentTarget)}
                                    leading={<Ico name="lc-send" size={15} color="var(--adm-accent-strong)" />} trailing={<IconChevronDown />}><span className="label">고객에게 전달</span></AdminButton>}
                                {bookingEditor && <AdminButton variant="secondary" size="sm" disabled={editorBusy} aria-haspopup="menu" onClick={event => guideMenu(event.currentTarget)}
                                    leading={<Ico name="lc-file-text" size={15} />} trailing={<IconChevronDown />}><span className="label">가이드 전달</span></AdminButton>}
                                <AdminIconButton variant="outlined" size="sm" disabled={editorBusy} label="기타 작업" aria-haspopup="menu" onClick={event => moreMenu(event.currentTarget)}><IconMoreHorizontal /></AdminIconButton>
                            </div>
                        </div>}
                        {nativeInquiry && customerEditorMounted && <QuoteInquiryPanel key={`${accountId}:${bookingId}:${nativeReload}`} ref={inquiryRef}
                            record={customerRecord as React.ComponentProps<typeof QuoteInquiryPanel>['record']} token={linkedToken.current} onState={receiveNativeState}
                            onSaved={() => setCustomerRefresh(value => value + 1)}
                            onOpenBuilder={() => { void openCustomerEditor('builder', 'docs'); }}
                            onOpenBooking={() => { void openCustomerEditor('bookings', 'docs'); }}
                            onDeleted={() => { setEditorBusy(false); setEditorDirty(false); navigate(returnTo); }} />}
                        {nativeBuilder && customerEditorMounted && <Suspense fallback={<AdminLoading inline label="견적서 편집기를 불러오는 중" />}>
                            <QuoteBuilderEditor key={`${accountId}:${bookingId}:${nativeReload}`} ref={builderRef} embedded requestId={bookingId}
                                onState={receiveNativeState} onSaved={() => setCustomerRefresh(value => value + 1)} />
                        </Suspense>}
                        {nativeBooking && customerEditorMounted && bookingId && <>
                            <AdminTabs label="예약 상세 작업" value={bookingSectionOf(activeSection)} onChange={value => navigateWorkspace(value)}
                                items={BOOKING_TABS.map(([value, label]) => ({ value, label }))} />
                            {bookingSectionOf(activeSection) === 'log' && <AdminDeliveryHistory source="quote_booking" bookingId={bookingId} revision={customerRefresh} onData={receiveCustomerDelivery} onOpenDocument={kind => {
                                navigateWorkspace(kind === 'contract' ? 'contract' : 'docs');
                                // 확정일정표 알림·주의사항은 편집 도구줄의 ‘고객에게 전달’ 메뉴에 있다.
                                if (kind !== 'contract' && deliveryButtonRef.current) deliveryMenu(deliveryButtonRef.current);
                            }} />}
                            <QuoteBookingEditor key={`${accountId}:${bookingId}:${nativeReload}`} ref={bookingRef} requestId={bookingId} token={linkedToken.current} accountId={accountId}
                                section={bookingSectionOf(activeSection)} onState={receiveNativeState} onSaved={() => setCustomerRefresh(value => value + 1)} />
                        </>}
                    </div>}
                </div>
            ) : (
                <div className="qd-connect">
                    {phase === 'connecting' && <AdminLoading inline label="견적 데스크에 연결하는 중" />}
                    {phase === 'unset' && (
                        <AdminCard as="div" className="qd-connect-card">
                            <AdminEmpty icon={<IconLock />} title="견적 데스크가 아직 연결되지 않았습니다"
                                description={<>
                                    서버에 견적 관리자 비밀번호(환경 변수 <b>ADMIN_TOKEN</b>)가 설정되어 있지 않아
                                    견적 문의·예약 화면을 이 관리자 안에서 열 수 없습니다.
                                    Cloudflare Pages의 설정 &gt; 환경 변수에 <b>ADMIN_TOKEN</b>을 등록하고 다시 배포한 뒤 새로고침해 주세요.
                                </>}
                                action={<AdminButton variant="primary" leading={<IconRefresh />} onClick={() => { void connect(); }}>다시 확인</AdminButton>} />
                        </AdminCard>
                    )}
                    {phase === 'failed' && (
                        <AdminCard as="div" className="qd-connect-card">
                            <AdminEmpty icon={<IconCircleExclamationFill />} title="견적 데스크에 연결하지 못했습니다"
                                description="관리자 로그인이 만료되었거나 서버에 연결할 수 없습니다. 다시 시도해도 같으면 다시 로그인해 주세요."
                                action={<>
                                    <AdminButton variant="primary" leading={<IconRefresh />} onClick={() => { void connect(); }}>다시 시도</AdminButton>
                                    <AdminButton variant="secondary" onClick={() => { window.location.href = '/admin/login'; }}>다시 로그인</AdminButton>
                                </>} />
                        </AdminCard>
                    )}
                </div>
            )}
        </AdminLayout>
    );
};

export default AdminQuoteDesk;
