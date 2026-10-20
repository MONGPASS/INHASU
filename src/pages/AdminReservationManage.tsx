import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { api } from '../lib/api';
import { useUser } from '../contexts/UserContext';
import { useNavigate, useBlocker, useParams, useLocation } from 'react-router-dom';
import type { QuoteBookingSummary } from '../../functions/lib/quoteBookings';
import { type QuoteRequest, ConvertSelectionModal, QuoteDetailModal } from '../components/admin/QuoteModals';
import { sendNotificationEmail } from '../lib/email';
import { sendNotification } from '../utils/notification';
import type { ReservationDocContent } from '../components/admin/ReservationDocumentEditor';
import { decodeTemplateDescription, mergeDocumentSettings } from './AdminTemplateManage';
import { toTourDateKey } from '../utils/formatDate';
import { copyText } from '../utils/copyText';
import { readDepositReport, type DepositReport } from '../utils/reservationDetail';
import { BRAND, DEPOSIT_ACCOUNT } from '../constants/company';
import { won } from '../components/desktop-primitives/mwTokens';
import { ReservationWorkflow } from '../components/admin/ReservationWorkflow';
import { ReservationDocuments } from '../components/admin/ReservationDocuments';
import { AdminDeliveryHistory } from '../components/admin/AdminDeliveryHistory';
import type { AdminDeliveryData } from '../types/adminDelivery';
import { ReservationOperations, type ReservationOperationsControl, type ReservationOperationsStatus } from '../components/admin/ReservationOperations';
import { reservationWorkspaceStatus, emptyReservationOperations, type ReservationOperations as Operations } from '../utils/reservationWorkspace';
import { productScheduleDays } from '../../functions/lib/productItinerary';
import '../styles/reservation-workspace.css';
import { ReservationInlineEditor, type ReservationInlineEditorControl, type ReservationInlineEditorStatus } from '../components/admin/ReservationInlineEditor';
import { createInlineDocument } from '../utils/reservationInline';
import { readReservationDraft, reservationDraftNavigationDecision, type ReservationDraftNavigationDecision, type ReservationDraftSnapshot } from '../utils/adminReservationDraft';
import '../styles/reservation-inline.css';
import { readReservationList, reservationListSearch, reservationExportRows, reservationSelectionKey } from '../utils/adminReservationList';
import { readProductVehicle } from '../utils/reservationAssignment';
import { guideAssignmentConflicts, validAssignmentPeriod } from '../utils/assignmentAvailability';
import { CustomerWorkspaceOverview } from '../components/admin/CustomerWorkspaceOverview';
import { CustomerKakaoActions } from '../components/admin/CustomerKakaoActions';
import { CustomerVehicleAssignment } from '../components/admin/CustomerVehicleAssignment';
import { customerProductReference } from '../utils/customerProductReference';
import { loadRegisteredAssignmentResources, type RegisteredAssignmentResources } from '../utils/registeredAssignmentResources';
import { productWorkspaceReservation, legacyWorkspaceReservation, productCustomerOverview, sameAccountProductBookings } from '../utils/productCustomerWorkspace';
import { productCustomerHref, quoteCustomerHref, legacyQuoteCustomerHref, customerWorkspaceReturnTo } from '../utils/customerWorkspaceRoutes';
import { accommodationOpsHref } from '../utils/accommodationOpsRoutes';
import { consumedCalendarWorkspaceSearch, readCalendarWorkspaceAction } from '../utils/calendarWorkspaceAction';
import '../styles/product-customer-workspace.css';
import '../styles/customer-workspace-editor.css';
import '../styles/reservation-itinerary-designer.css';
import '../styles/admin-redesign-bookings.css';

// Reservation Interface
interface Reservation {
    id: string;
    reservationNumber?: string;
    type: 'product' | 'quote' | 'quote_booking';
    country?: string;
    quoteBooking?: QuoteBookingSummary['quoteBooking'];
    productName: string;
    productId?: string; // 예약한 상품 ID (신규 예약부터 저장 — 동명 상품 혼동 방지)
    customerName: string;
    notes?: string;
    peopleKnown?: number | null;
    startDate?: string;
    endDate?: string;
    departureMs?: number;
    date: string;
    bookedAt: string;
    bookedAtMs?: number;
    status: 'pending_payment' | 'paid' | 'confirmed' | 'cancelled' | 'new' | 'processing' | 'answered' | 'reservation_requested' | 'converted' | 'completed' | 'on_hold';

    // Payment Fields
    totalAmount: number;
    deposit: number;
    depositStatus: 'unpaid' | 'paid';
    balance: number;
    balanceStatus: 'unpaid' | 'paid';
    /** 고객이 마이페이지에서 알린 예약금 '입금 완료' 신고(입금자명·시각). 입금 확인 후에도 기록으로 남는다. */
    depositReport?: DepositReport | null;

    // Document URLs
    contractUrl?: string; // Excel Sheet URL
    itineraryUrl?: string; // Excel Sheet URL
    itineraryTemplateId?: string; // selected itinerary template
    documentContent?: ReservationDocContent | null; // 고객별 편집·저장된 문서 내용

    contractData?: {
        travelers?: Array<{ name?: string; passportName?: string; age?: number | string; birthdate?: string; phone?: string; gender?: string }>;
        arrival?: { date?: string; time?: string; flight?: string };
        departure?: { date?: string; time?: string; flight?: string };
        region?: string;
        category?: string;
        vehicle?: Record<string, unknown>;
        issuedDate?: string;
        agreement?: { agreed?: boolean; name?: string; agreedAt?: string };
        customerSubmittedAt?: string;
    };

    // Assigned Guide & Accommodation
    assignedGuide?: {
        id: string;
        name: string;
        image: string;
        introduction: string;
        phone: string;
        kakaoId: string;
        languages: string[];
        specialties: string[];
    };
    dailyAccommodations?: Array<{
        day: number;
        accommodation: {
            id: string;
            name: string;
            type: string;
            location: string;
            images: string[];
            description: string;
            facilities: string[];
        };
    }>;

    history?: Array<{
        timestamp: string;
        type: string;
        description: string;
        detail?: string;
    }>;

    userId?: string;
    areAssignmentsVisibleToUser?: boolean;

    headcount: string;
    totalPeople: number;
    phone: string;
    email: string;
    manager?: string;
    source?: string; // 주문 경로: kakao | email | phone | website | visit | other (옛 저장값: line)
    adminOperations?: Operations;

    // Quote Specific
    quoteDetail?: QuoteRequest;
}

const SOURCE_OPTIONS: Array<{ v: string; l: string }> = [
    { v: 'kakao', l: '카카오톡' },
    { v: 'email', l: '메일' },
    { v: 'phone', l: '전화' },
    { v: 'website', l: '홈페이지' },
    { v: 'visit', l: '직접방문' },
    { v: 'other', l: '기타' },
];
// 선택지에서는 뺐지만 예전에 저장된 주문 경로(LINE)는 라벨·색을 그대로 보여 준다.
const LEGACY_SOURCE_LABELS: Record<string, string> = { line: 'LINE' };
const sourceLabel = (s?: string) => SOURCE_OPTIONS.find(o => o.v === s)?.l || LEGACY_SOURCE_LABELS[s || ''] || (s || '');
const sourceColor = (s?: string): { bg: string; fg: string } => ({
    kakao: { bg: '#FFF4B8', fg: '#5C4700' },
    line: { bg: '#E4F7EC', fg: '#0F7A43' },
    email: { bg: '#E8F2FF', fg: '#0B6FE0' },
    phone: { bg: '#FEF6E7', fg: '#B45309' },
    website: { bg: '#F1F2F4', fg: '#5F636B' },
    visit: { bg: '#EEEDFE', fg: '#534AB7' },
    other: { bg: '#F1F2F4', fg: '#8A8F99' },
}[s || ''] || { bg: '#F1F2F4', fg: '#8A8F99' });
const BLANK_ADD = { customerName: '', phone: '', email: '', source: 'kakao', productName: '', productId: '', startDate: '', endDate: '', people: '1', totalAmount: '', deposit: '', status: 'pending_payment', notes: '' };

/** 고객이 '입금 완료'를 신고했는데 아직 입금 확인을 하지 않은 예약 — 목록의 「입금 신고」 배지와 상세의 강조 표시에 쓴다. */
const hasOpenDepositReport = (r: Reservation) =>
    r.type !== 'quote' && !!r.depositReport && r.depositStatus !== 'paid' && r.status !== 'cancelled';

/** 입금 신고 시각: "10. 12. 오후 03:04". 날짜를 읽을 수 없으면 ''. */
const formatReportTime = (iso?: string) => {
    const d = new Date(iso || '');
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

interface ProductSummary {
    hasItinerary?: boolean;
    id?: string;
    name?: string;
    category?: string;
    thumbnail?: string;
    mainImages?: any; // API가 mainImages/main_images 두 표기를 모두 내려줌 (배열 또는 JSON 문자열)
    itineraryBlocks?: any;
    itineraryImages?: any;
    documentProduct?: any;
}

const quoteWorkflowMeta: Record<string, { label: string; hint: string; icon: string }> = {
    new: {
        label: '신규 요청',
        hint: '요청 조건 확인 필요',
        icon: 'fiber_new',
    },
    processing: {
        label: '견적 작성 중',
        hint: '일정·금액 입력 단계',
        icon: 'edit_note',
    },
    answered: {
        label: '견적 발송 완료',
        hint: '고객 확인 대기',
        icon: 'mark_email_read',
    },
    reservation_requested: {
        label: '예약 요청',
        hint: '예약 전환 필요',
        icon: 'priority_high',
    },
    converted: {
        label: '예약 전환 완료',
        hint: '예약 관리에서 진행',
        icon: 'task_alt',
    },
};

const getQuoteAction = (reservation: Reservation) => {
    if (reservation.type === 'quote_booking') return { label: '예약 관리', description: '입금·계약·배정·일정표 관리', icon: 'visibility', nextStatus: null, primary: true };
    if (reservation.type !== 'quote') {
        return {
            label: '상세 확인',
            description: reservation.status === 'pending_payment' ? '입금 상태 확인' : '예약 내용 관리',
            icon: 'visibility',
            nextStatus: null as Reservation['status'] | null,
            primary: false,
        };
    }

    switch (reservation.status) {
        case 'new':
            return {
                label: '검토 시작',
                description: '클릭하면 검토 중으로 변경',
                icon: 'play_arrow',
                nextStatus: 'processing' as Reservation['status'],
                primary: true,
            };
        case 'processing':
            return {
                label: '견적 작성',
                description: '금액·메모·URL 입력',
                icon: 'edit_note',
                nextStatus: null,
                primary: true,
            };
        case 'answered':
            return {
                label: '재확인',
                description: '발송 내용 확인·재발송',
                icon: 'outgoing_mail',
                nextStatus: null,
                primary: false,
            };
        case 'reservation_requested':
            return {
                label: '예약 전환',
                description: '예약 생성 필요',
                icon: 'sync_alt',
                nextStatus: null,
                primary: true,
            };
        default:
            return {
                label: '견적 관리',
                description: '상세 내용 확인',
                icon: 'manage_search',
                nextStatus: null,
                primary: false,
            };
    }
};

const getWorkflowMeta = (reservation: Reservation) => {
    if (reservation.quoteBooking) return { label: reservation.quoteBooking.label, hint: reservation.quoteBooking.hint, icon: 'event_note' };
    if (reservation.type === 'quote') {
        return quoteWorkflowMeta[reservation.status] || {
            label: '견적 진행',
            hint: '상태 확인 필요',
            icon: 'request_quote',
        };
    }

    if (reservation.status === 'pending_payment') {
        return {
            label: '입금 대기',
            hint: '예약금 확인 필요',
            icon: 'payments',
        };
    }

    if (reservation.status === 'confirmed' || reservation.status === 'paid') {
        return {
            label: reservation.status === 'confirmed' ? '예약 확정' : '결제 완료',
            hint: '일정 운영 관리',
            icon: 'event_available',
        };
    }

    return {
        label: STATUS_LABELS[reservation.status] || '예약 관리',
        hint: '상세 확인',
        icon: 'assignment',
    };
};

// status → design-system badge tone (b-*) for the new admin console look
const STATUS_TONE: Record<string, string> = {
    new: 'b-purple',
    reservation_requested: 'b-purple',
    processing: 'b-amber',
    pending_payment: 'b-amber',
    answered: 'b-blue',
    paid: 'b-blue',
    confirmed: 'b-green',
    cancelled: 'b-gray',
    completed: 'b-gray',
    converted: 'b-gray',
};

// 「곧 출발하는 투어」에 노출할 확정 상태 — 입금 대기(pending_payment)는 제외한다.
const CONFIRMED_TOUR_STATUSES = new Set(['confirmed', 'paid']);

const STATUS_LABELS: Record<string, string> = {
    completed: '여행 완료',
    on_hold: '보류',
    pending_payment: '입금 대기',
    paid: '결제 완료',
    confirmed: '예약 확정',
    cancelled: '취소됨',
    new: '신규 견적',
    processing: '견적 작성중',
    answered: '견적 발송됨',
    reservation_requested: '예약 요청됨',
    converted: '예약 전환됨',
};

// 숙소 배정 보드(Байр захиалга)의 수배 상태(몽골어 저장값) → 한국어 라벨·색.
// 상세에서는 읽기 전용 표시만 — 상태의 원천은 보드(몽골 현지 스태프).
const BOOKING_STATUS_KO: Record<string, { label: string; bg: string; fg: string }> = {
    'Илгээгээгүй': { label: '수배 미발송', bg: '#EEF1F5', fg: '#5F636B' },
    'Имэйл илгээсэн': { label: '메일 발송됨', bg: '#E8F2FF', fg: '#0B6FE0' },
    'Хариу ирсэн': { label: '회신 수신', bg: '#FEF6E7', fg: '#B45309' },
    'Баталгаажсан': { label: '수배 확정', bg: '#E4F7EC', fg: '#0F7A43' },
};

const StatusDropdown = ({ status, onChange, disabled = false }: { status: string, onChange: (s: Reservation['status']) => void, disabled?: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const labels = STATUS_LABELS;

    const statusKey = status as keyof typeof labels;
    const tone = STATUS_TONE[status] || 'b-gray';

    const handleSelect = (newStatus: Reservation['status']) => {
        onChange(newStatus);
        setIsOpen(false);
    };

    return (
        <div className="statusdd" ref={dropdownRef}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className={`badge statusdd-btn ${tone}`}
            >
                <span className={`sd-dot ${tone}`} />
                <span>{labels[statusKey] || status}</span>
                <Icon name={isOpen ? 'expand_less' : 'expand_more'} style={{ fontSize: 16, opacity: 0.7 }} />
            </button>

            {isOpen && (
                <div className="statusdd-menu">
                    {(Object.keys(labels) as Array<keyof typeof labels>).map((key) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => handleSelect(key as Reservation['status'])}
                            className={`statusdd-item${status === key ? ' on' : ''}`}
                        >
                            <span className={`sd-dot ${STATUS_TONE[key] || 'b-gray'}`} />
                            <span style={{ flex: 1 }}>{labels[key]}</span>
                            {status === key && <Icon name="check" style={{ fontSize: 14 }} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const ReservationDetailModal = ({ reservation, onClose, onUpdate, onRefresh, updating = false, refreshing = false, refreshedAt, refreshError, products = [], fullPage = false, bookingSelector }: { reservation: Reservation | null, onClose: () => void, onUpdate: (updated: Reservation, silent?: boolean) => Promise<boolean>, onRefresh: () => void, updating?: boolean, refreshing?: boolean, refreshedAt?: string, refreshError?: string, products?: ProductSummary[], fullPage?: boolean, bookingSelector?: React.ReactNode }) => {
    const { user, loading: userLoading } = useUser();
    const workspaceLocation = useLocation();
    const workspaceNavigate = useNavigate();
    const calendarActionHandler = useRef<((action: string) => boolean | void) | null>(null);
    const handledCalendarAction = useRef('');
    const inlineControlRef = useRef<ReservationInlineEditorControl | null>(null);
    const docDraftSourceRef = useRef<ReservationDraftSnapshot | null>(null);
    const [docDraftPending, setDocDraftPending] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Reservation | null>(null);
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [guideConfirmation, setGuideConfirmation] = useState<{ guide: any; message: string } | null>(null);
    const [pickerSaveError, setPickerSaveError] = useState('');
    const [showAccommodationModal, setShowAccommodationModal] = useState(false);
    const [selectedDay, setSelectedDay] = useState(1);
    const [guideList, setGuideList] = useState<any[]>([]);
    const [guideSearch, setGuideSearch] = useState('');
    const [accommodationSearch, setAccommodationSearch] = useState('');
    const [accommodationRegion, setAccommodationRegion] = useState('');
    const [resourceBookings, setResourceBookings] = useState<any[]>([]);
    const [resourceNotice, setResourceNotice] = useState('');
    const [resourceLoading, setResourceLoading] = useState(false);
    const [recentAssignments, setRecentAssignments] = useState<{ guides: string[]; stays: string[] }>({ guides: [], stays: [] });
    const [memoDraft, setMemoDraft] = useState('');
    const [memoFocused, setMemoFocused] = useState(false);
    const [copiedDocId, setCopiedDocId] = useState<string | null>(null);
    const [templatesList, setTemplatesList] = useState<any[]>([]);
    const [sendingItinerary, setSendingItinerary] = useState(false);
    const [sendingContract, setSendingContract] = useState(false);
    const [sendingAllDocs, setSendingAllDocs] = useState(false);
    const [sendingKakao, setSendingKakao] = useState(false);
    const deliveryLock = useRef(false);
    const deliveryKeys = useRef<Record<string, string>>({});
    const [deliveryRevision, setDeliveryRevision] = useState(0);
    const [recordedDelivery, setRecordedDelivery] = useState<AdminDeliveryData | null>(null);
    const [inlineEditorOpen, setInlineEditorOpen] = useState(false);
    const [inlineDirty, setInlineDirty] = useState(false);
    const [inlineBusy, setInlineBusy] = useState(false);
    const [inlineUiStatus, setInlineUiStatus] = useState<ReservationInlineEditorStatus>({ dirty: false, busy: false, locked: true, message: '', failed: false });
    const [requestedDocumentDay, setRequestedDocumentDay] = useState<number | undefined>();
    const [documentFocusRevision, setDocumentFocusRevision] = useState(0);
    const [activeDocument, setActiveDocument] = useState<'itinerary' | 'contract'>('itinerary');
    const [applyingTemplate, setApplyingTemplate] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [operationsDirty, setOperationsDirty] = useState(false);
    const [operationsUiStatus, setOperationsUiStatus] = useState<ReservationOperationsStatus>({ dirty: false, busy: false, message: '', failed: false });
    const operationsControlRef = useRef<ReservationOperationsControl | null>(null);
    const [quickAssignment, setQuickAssignment] = useState<'stay' | 'vehicle' | null>(null);
    const [quickAssignmentDirty, setQuickAssignmentDirty] = useState(false);
    const [registeredResources, setRegisteredResources] = useState<{ scope: string; data: RegisteredAssignmentResources } | null>(null);
    const [registeredLoading, setRegisteredLoading] = useState(false);
    const [registeredNotice, setRegisteredNotice] = useState('');
    const [registeredRevision, setRegisteredRevision] = useState(0);
    const registeredScope = `${user?.role || ''}:${user?.id || ''}:${reservation?.id || ''}`;
    const activeRegisteredScope = useRef(registeredScope); activeRegisteredScope.current = registeredScope;
    const needsRegisteredResources = showGuideModal || showAccommodationModal || quickAssignment === 'vehicle';
    const registered = registeredResources?.scope === registeredScope ? registeredResources.data : null;
    const registeredPending = needsRegisteredResources && (registeredLoading || (!registered && !registeredNotice));
    useEffect(() => {
        if (!needsRegisteredResources || user?.role !== 'admin' || !user.id) return;
        const controller = new AbortController(), scope = registeredScope;
        setRegisteredLoading(true); setRegisteredNotice('');
        const isCurrent = () => !controller.signal.aborted && activeRegisteredScope.current === scope;
        loadRegisteredAssignmentResources({ accountId: user.id, signal: controller.signal, isCurrent })
            .then(data => { if (isCurrent()) { setRegisteredResources({ scope, data }); setRegisteredNotice(data.warnings.join(' ')); } })
            .catch(() => { if (isCurrent()) { setRegisteredResources(null); setRegisteredNotice('등록된 배정 자원을 불러오지 못했습니다. 자원 목록을 다시 불러와 주세요.'); } })
            .finally(() => { if (isCurrent()) setRegisteredLoading(false); });
        return () => controller.abort();
    }, [needsRegisteredResources, registeredScope, registeredRevision, user?.id, user?.role]);
    const [workflowOpen, setWorkflowOpen] = useState(!fullPage);
    const overviewScrollPosition = useRef(0);
    useEffect(() => {
        if (userLoading || !user?.id || !reservation?.id || !docDraftSourceRef.current) { setDocDraftPending(false); return; }
        try {
            const recovery = readReservationDraft(window.localStorage, { userId: user.id, reservationId: reservation.id }, docDraftSourceRef.current);
            if (recovery.kind !== 'unavailable') setDocDraftPending(recovery.kind === 'draft');
        } catch { /* Preserve the last known valid draft if this browser blocks storage access. */ }
    }, [userLoading, user?.id, reservation?.id, reservation?.documentContent, reservation?.startDate, reservation?.endDate, templatesList, products, editForm?.id]);
    const [navigationNotice, setNavigationNotice] = useState('');
    const approvedWorkspaceClose = useRef(false);
    const workspaceDecision = useRef<ReservationDraftNavigationDecision>({ blocked: false });
    const handledWorkspaceNavigation = useRef<string | null>(null);
    const workspaceIsBusy = React.useCallback(() => refreshing || deliveryLock.current || updating || inlineBusy || operationsUiStatus.busy || !!inlineControlRef.current?.isBusy() || publishing || applyingTemplate || sendingItinerary || sendingContract || sendingAllDocs || sendingKakao,
        [refreshing, updating, inlineBusy, operationsUiStatus.busy, publishing, applyingTemplate, sendingItinerary, sendingContract, sendingAllDocs, sendingKakao]);
    useEffect(() => { approvedWorkspaceClose.current = false; setNavigationNotice(''); }, [reservation?.id]);
    const workspaceBlocker = useBlocker(React.useCallback(({ currentLocation, nextLocation }) => {
        if (approvedWorkspaceClose.current) return false;
        const decision = reservationDraftNavigationDecision(currentLocation, nextLocation, workspaceIsBusy(), () => inlineControlRef.current?.flush() || { ok: true }, isEditing || operationsDirty || quickAssignmentDirty || !!memoDraft.trim());
        workspaceDecision.current = decision;
        return decision.blocked;
    }, [workspaceIsBusy, isEditing, operationsDirty, quickAssignmentDirty, memoDraft]));
    useEffect(() => {
        if (workspaceBlocker.state === 'unblocked') { handledWorkspaceNavigation.current = null; return; }
        if (workspaceBlocker.state !== 'blocked') return;
        const key = workspaceBlocker.location.key + workspaceBlocker.location.pathname + workspaceBlocker.location.search;
        if (handledWorkspaceNavigation.current === key) return;
        handledWorkspaceNavigation.current = key;
        const decision = workspaceDecision.current;
        if (workspaceIsBusy() || (decision.blocked && decision.reason === 'busy')) {
            setNavigationNotice('문서 저장·사진 업로드·고객 전달이 끝난 뒤 다른 메뉴로 이동해 주세요.');
            workspaceBlocker.reset();
            return;
        }
        if (!decision.blocked) { workspaceBlocker.proceed(); return; }
        const message = decision.reason === 'draft_storage_failure'
            ? decision.error + '\n\n초안을 보관하지 못한 상태로 이동할까요?'
            : '저장하지 않은 주문·운영 정보가 있습니다. 이 변경사항을 버리고 이동할까요?';
        if (window.confirm(message)) workspaceBlocker.proceed();
        else workspaceBlocker.reset();
    }, [workspaceBlocker, workspaceIsBusy]);
    useEffect(() => {
        const beforeUnload = (event: BeforeUnloadEvent) => {
            const result = inlineControlRef.current?.flush(false) || { ok: true };
            if (!approvedWorkspaceClose.current && (workspaceIsBusy() || !result.ok || isEditing || operationsDirty || quickAssignmentDirty || memoDraft.trim())) { event.preventDefault(); event.returnValue = ''; }
        };
        const pageHide = () => { inlineControlRef.current?.flush(false); };
        window.addEventListener('beforeunload', beforeUnload); window.addEventListener('pagehide', pageHide);
        return () => { window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('pagehide', pageHide); };
    }, [workspaceIsBusy, isEditing, operationsDirty, quickAssignmentDirty, memoDraft]);
    const closeWorkspace = () => {
        if (workspaceIsBusy()) { setNavigationNotice('처리 중인 작업이 끝난 뒤 예약 상세를 닫아 주세요.'); return; }
        if ((isEditing || operationsDirty || quickAssignmentDirty || memoDraft.trim() || (!inlineControlRef.current && inlineDirty)) && !window.confirm('저장하지 않은 변경사항이 있습니다. 예약 상세를 닫을까요?')) return;
        if (inlineControlRef.current && !inlineControlRef.current.prepareLeave()) return;
        approvedWorkspaceClose.current = true;
        onClose();
    };
    const refreshWorkspace = () => {
        if (workspaceIsBusy() || isEditing || operationsDirty || quickAssignmentDirty || memoDraft.trim()) return;
        if (inlineControlRef.current && !inlineControlRef.current.prepareLeave('refresh')) return;
        onRefresh();
    };
    // 고객 전용 화면은 업무별 패널, 기존 모달은 원페이지 앵커를 유지한다.
    const [activeSec, setActiveSec] = useState<'docs' | 'inline-doc' | 'ops' | 'info' | 'pay' | 'assign' | 'log'>('docs');
    const bodyRef = useRef<HTMLDivElement | null>(null);
    const scrollToSec = (id: 'docs' | 'inline-doc' | 'ops' | 'info' | 'pay' | 'assign' | 'log') => {
        const group = id === 'inline-doc' ? 'docs' : id;
        if (fullPage) {
            if (workspaceIsBusy()) return;
            if (quickAssignmentDirty || (isEditing && group !== (activeSec === 'pay' ? 'pay' : 'info')) || (inlineDirty && group !== 'docs') || (operationsDirty && group !== 'ops')) {
                setNavigationNotice('현재 작성 중인 내용을 저장하거나 취소한 뒤 다른 업무를 열어 주세요.');
                return;
            }
            setNavigationNotice('');
        }
        if (fullPage && !workflowOpen) overviewScrollPosition.current = window.scrollY;
        setActiveSec(id);
        setWorkflowOpen(true);
        requestAnimationFrame(() => {
            if (fullPage) bodyRef.current?.scrollTo({ top: 0 });
            else bodyRef.current?.querySelector(`#sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    };
    const returnToCustomerOverview = () => {
        if (workspaceIsBusy()) { setNavigationNotice('저장·업로드·발송이 끝난 뒤 고객 현황으로 돌아갈 수 있습니다.'); return; }
        const recovery = inlineControlRef.current?.flush() || { ok: true };
        if (!recovery.ok) { setNavigationNotice(recovery.error || '초안을 보관하지 못했습니다. 저장 후 고객 현황으로 돌아가 주세요.'); return; }
        setNavigationNotice('');
        setWorkflowOpen(false);
        requestAnimationFrame(() => window.scrollTo({ top: overviewScrollPosition.current }));
    };

    useEffect(() => {
        api.itineraryTemplates.list().then((data: any) => {
            if (Array.isArray(data)) setTemplatesList(data);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (showGuideModal && guideList.length === 0) {
            api.tourGuides.list().then((data: any) => {
                if (Array.isArray(data)) setGuideList(data.filter((g: any) => g.status !== 'pending'));
            }).catch(() => {});
        }
    }, [showGuideModal]);
    useEffect(() => { setGuideSearch(''); setAccommodationSearch(''); setAccommodationRegion(''); }, [reservation?.id]);
    useEffect(() => { if (!showGuideModal) setGuideConfirmation(null); }, [showGuideModal]);
    useEffect(() => { setPickerSaveError(''); }, [showGuideModal, showAccommodationModal]);
    useEffect(() => {
        try { const value = JSON.parse(sessionStorage.getItem(`inhasu:recent-assignments:${user?.id || 'none'}`) || '{}');
            setRecentAssignments({ guides: Array.isArray(value.guides) ? value.guides.filter((id: unknown) => typeof id === 'string').slice(0, 8) : [], stays: Array.isArray(value.stays) ? value.stays.filter((id: unknown) => typeof id === 'string').slice(0, 8) : [] });
        } catch { setRecentAssignments({ guides: [], stays: [] }); }
    }, [user?.id]);

    useEffect(() => {
        if (!showGuideModal || user?.role !== 'admin') return;
        const controller = new AbortController(); setResourceLoading(true); setResourceNotice('');
        fetch('/api/admin/assignments', { credentials: 'include', cache: 'no-store', signal: controller.signal })
            .then(async response => { const payload = await response.json(); if (!response.ok || !Array.isArray(payload.items)) throw new Error(); return payload; })
            .then(payload => { if (!controller.signal.aborted) { setResourceBookings(payload.items); setResourceNotice(payload.warnings?.join(' ') || ''); } })
            .catch(() => { if (!controller.signal.aborted) { setResourceBookings([]); setResourceNotice('최신 배정 현황을 확인하지 못했습니다. 가이드 일정을 별도로 확인하세요.'); } })
            .finally(() => { if (!controller.signal.aborted) setResourceLoading(false); });
        return () => controller.abort();
    }, [showGuideModal, user?.id, user?.role]);

    useEffect(() => {
        setEditForm(reservation);
    }, [reservation]);

    useEffect(() => {
        const action = readCalendarWorkspaceAction(workspaceLocation.search);
        if (!fullPage || !action || userLoading || user?.role !== 'admin' || !reservation?.id || editForm?.id !== reservation.id || !calendarActionHandler.current) return;
        if (workspaceIsBusy() || isEditing || inlineDirty || operationsDirty || quickAssignmentDirty || docDraftPending || memoDraft.trim()) return;
        const key = JSON.stringify([user.id, reservation.id, workspaceLocation.key, action]);
        if (handledCalendarAction.current === key) return;
        handledCalendarAction.current = key;
        if (calendarActionHandler.current(action) === true) return;
        workspaceNavigate({ pathname: workspaceLocation.pathname, search: consumedCalendarWorkspaceSearch(workspaceLocation.search), hash: workspaceLocation.hash }, { replace: true });
    }, [fullPage, userLoading, user?.role, user?.id, reservation?.id, editForm?.id, workspaceLocation, workspaceNavigate, workspaceIsBusy, isEditing, inlineDirty, operationsDirty, quickAssignmentDirty, docDraftPending, memoDraft]);

    if (!reservation || !editForm) return null;

    // Toggle Payment Status Logic
    const toggleTotalStatus = () => {
        // Master toggle logic
        // If currently paid -> switch to pending (unpaid)
        // If currently not paid -> switch to paid AND mark all sub-payments as paid
        const isCurrentlyPaid = editForm.status === 'paid';

        const newStatus: Reservation['status'] = isCurrentlyPaid ? 'pending_payment' : 'paid';


        const updated = {
            ...editForm,
            status: newStatus,
            depositStatus: isCurrentlyPaid ? editForm.depositStatus : 'paid',
            balanceStatus: isCurrentlyPaid ? editForm.balanceStatus : 'paid'
        };

        setEditForm(updated);
        if (!isEditing) onUpdate(updated);
    };

    const toggleDepositStatus = () => {
        const newStatus: 'paid' | 'unpaid' = editForm.depositStatus === 'paid' ? 'unpaid' : 'paid';
        // 계좌이체 + 입금 신고 흐름의 마지막 단계: 입금 대기 중인 예약의 예약금을 확인하면 예약이 확정된다.
        // (저장 시 handleUpdateReservation 이 상태 변경 기록·사이트 알림·입금 확인 메일을 처리한다.)
        const confirmsBooking = newStatus === 'paid' && editForm.type !== 'quote' && editForm.status === 'pending_payment';
        if (confirmsBooking && !isEditing
            && !window.confirm('예약금 입금을 확인 처리할까요?\n예약이 「예약 확정」으로 바뀌고 고객에게 입금 확인 안내가 발송됩니다.')) {
            return;
        }
        const updated: Reservation = { ...editForm, depositStatus: newStatus, status: confirmsBooking ? 'confirmed' : editForm.status };
        setEditForm(updated);
        if (!isEditing) onUpdate(updated);
    };

    const toggleBalanceStatus = () => {
        const newStatus: 'paid' | 'unpaid' = editForm.balanceStatus === 'paid' ? 'unpaid' : 'paid';
        const updated = { ...editForm, balanceStatus: newStatus };
        setEditForm(updated);
        if (!isEditing) onUpdate(updated);
    };

    const handleSave = async () => {
        if (editForm) {
            if (!editForm.customerName.trim()) { alert('고객 이름을 입력하세요.'); return; }
            if (editForm.totalAmount < 0 || editForm.deposit < 0 || editForm.deposit > editForm.totalAmount) { alert('예약금은 0원부터 총 여행 금액 사이로 입력하세요.'); return; }
            if (editForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) { alert('고객 이메일을 확인하세요.'); return; }
            const finalData = {
                ...editForm,
                balance: editForm.totalAmount - editForm.deposit
            };
            if (await onUpdate(finalData)) setIsEditing(false);
        }
    };

    const handleCancel = () => {
        setEditForm(reservation);
        setIsEditing(false);
    };

    const guideConflicts = (guide: any) => guideAssignmentConflicts(resourceBookings, guide, { id: reservation.id, source: 'product', startDate: reservation.startDate, endDate: reservation.endDate });
    const rememberAssignment = (kind: 'guides' | 'stays', id: string) => {
        if (!id || !user?.id) return;
        setRecentAssignments(prev => { const next = { ...prev, [kind]: [id, ...prev[kind].filter(value => value !== id)].slice(0, 8) }; try { sessionStorage.setItem(`inhasu:recent-assignments:${user.id}`, JSON.stringify(next)); } catch { /* recent choices are optional */ } return next; });
    };
    const handleGuideAssign = async (guide: any, confirmed = false) => {
        if (!reservation || workspaceIsBusy() || resourceLoading || registeredPending) return;
        setPickerSaveError('');
        const conflicts = guideConflicts(guide);
        const periodUnknown = !validAssignmentPeriod(reservation) || resourceBookings.some(row => !['cancelled', 'on_hold'].includes(row.status) && !validAssignmentPeriod(row));
        const overlapMessage = conflicts.length ? `같은 기간에 ${conflicts.length}건의 배정이 있습니다.\n${conflicts.map(row => `${row.customerName} · ${row.startDate} ~ ${row.endDate}`).join('\n')}` : '';
        const unknownMessage = resourceNotice || periodUnknown ? '배정 일정 전체를 확인하지 못했습니다. 가이드에게 직접 확인해 주세요.' : '';
        if (!confirmed && fullPage && (overlapMessage || unknownMessage)) { setGuideConfirmation({ guide, message: [overlapMessage, unknownMessage].filter(Boolean).join('\n\n') }); return; }
        if (!confirmed && !fullPage) {
            if (overlapMessage && !window.confirm(overlapMessage + '\n\n겹치는 일정을 확인했고 이 가이드를 배정할까요?')) return;
            if (unknownMessage && !window.confirm(unknownMessage + '\n직접 확인한 뒤 배정할까요?')) return;
        }
        setGuideConfirmation(null);

        const parseArr = (v: any) => {
            if (Array.isArray(v)) return v;
            if (typeof v === 'string') {
                try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
            }
            return [];
        };
        const updated = {
            ...reservation,
            assignedGuide: {
                id: guide.id,
                name: guide.name,
                image: guide.image,
                introduction: guide.introduction || guide.bio || '',
                phone: guide.phone,
                kakaoId: guide.kakaoId,
                languages: parseArr(guide.languages),
                specialties: parseArr(guide.specialties),
                ...(guide._fromResources ? { qr: guide.qr || '', nameEn: guide.nameEn || '', role: guide.role || '' } : {})
            },
            history: [
                ...(reservation.history || []),
                {
                    timestamp: new Date().toISOString(),
                    type: 'modification',
                    description: '담당 가이드가 결정되었습니다.',
                    detail: `${guide.name}`
                }
            ]
        };

        if (await onUpdate(updated, fullPage)) { rememberAssignment('guides', guide.id); setShowGuideModal(false); if (fullPage) setNavigationNotice(`담당 가이드를 배정했습니다. (${guide.name})`); }
        else setPickerSaveError(`${guide.name} 가이드 배정을 저장하지 못했습니다. 선택창에서 다시 시도해 주세요.`);
    };

    const handleAccommodationAssign = async (accommodation: any) => {
        if (!reservation || workspaceIsBusy() || registeredPending) return;
        setPickerSaveError('');

        const dailyAccommodations = reservation.dailyAccommodations || [];
        const existingIndex = dailyAccommodations.findIndex(d => d.day === selectedDay);
        const prevEntry: any = existingIndex >= 0 ? dailyAccommodations[existingIndex] : null;
        const prevAcc: any = prevEntry?.accommodation || {};
        // 숙소가 실제로 바뀌면 수배(예약 요청)는 다시 해야 하므로 수배 상태를 초기화한다.
        const hotelChanged = !!prevAcc.name && ['id', 'name', 'type', 'location'].some(key => String(prevAcc[key] || '') !== String(accommodation[key] || ''));

        const newDaily = {
            ...(prevEntry || {}), // day·date 등 메타 유지
            day: selectedDay,
            accommodation: {
                // 숙소 배정 보드(Байр захиалга)가 관리하는 운영 필드(방·인실·수배상태)를 보존 —
                // 통째로 교체하면 상세에서 숙소만 바꿔도 보드의 수배 진행 상황이 사라진다.
                ...prevAcc,
                id: accommodation.id,
                name: accommodation.name,
                type: accommodation.type,
                location: accommodation.location,
                address: accommodation.address || '',
                images: accommodation.images,
                description: accommodation.description,
                facilities: accommodation.facilities,
                ...(hotelChanged ? { bookingStatus: 'Илгээгээгүй' } : {}),
            }
        };

        let updatedDailies;
        if (existingIndex >= 0) {
            updatedDailies = [...dailyAccommodations];
            updatedDailies[existingIndex] = newDaily;
        } else {
            updatedDailies = [...dailyAccommodations, newDaily].sort((a, b) => a.day - b.day);
        }

        const updated = {
            ...reservation,
            dailyAccommodations: updatedDailies,
            history: [
                ...(reservation.history || []),
                {
                    timestamp: new Date().toISOString(),
                    type: 'modification',
                    description: `${selectedDay}일차 숙소가 확정되었습니다.`,
                    detail: hotelChanged
                        ? `${accommodation.name} (숙소 변경 — 수배 상태 초기화)`
                        : `${accommodation.name}`
                }
            ]
        };

        if (await onUpdate(updated, fullPage)) { rememberAssignment('stays', accommodation.id); setShowAccommodationModal(false); if (fullPage) setNavigationNotice(`${selectedDay}일차에 ${accommodation.name} 숙소를 배정했습니다.`); }
        else setPickerSaveError(`${selectedDay}일차 ${accommodation.name} 숙소 배정을 저장하지 못했습니다. 선택창에서 다시 시도해 주세요.`);
    };

    // 확정 숙소 배정 해제 — 해당 일차의 dailyAccommodations 항목 제거 (문서 편집기의 "선택 해제")
    const handleAccommodationUnassign = (day: number) => {
        if (!reservation) return;
        const existing = (reservation.dailyAccommodations || []).find(d => d.day === day);
        if (!existing) return;
        const updated = {
            ...reservation,
            dailyAccommodations: (reservation.dailyAccommodations || []).filter(d => d.day !== day),
            history: [
                ...(reservation.history || []),
                {
                    timestamp: new Date().toISOString(),
                    type: 'modification',
                    description: `${day}일차 숙소 확정을 해제했습니다.`,
                    detail: `${existing.accommodation?.name || ''}`
                }
            ]
        };
        onUpdate(updated);
    };

    // Derived data
    const memos = (reservation.history || []).filter((h: any) => h.type === 'admin_memo');
    const timelineEvents = (reservation.history || []).filter((h: any) => h.type !== 'admin_memo');
    const paidAmount = (editForm.depositStatus === 'paid' ? editForm.deposit : 0) + (editForm.balanceStatus === 'paid' ? (editForm.totalAmount - editForm.deposit) : 0);
    const paidPercent = editForm.totalAmount > 0 ? Math.round((paidAmount / editForm.totalAmount) * 100) : 0;
    const getInitials = (name: string) => (name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const reservationNumber = (reservation as any).reservationNumber || reservation.id;
    // 보안: 고객 문서 링크는 추측 가능한 예약번호(MNxxx)가 아닌 UUID(reservation.id)로 생성
    const itineraryUrl = `${window.location.origin}/documents/itinerary/${reservation.id}`;
    const itineraryPreviewUrl = `${itineraryUrl}?preview=1`;
    const contractUrl = `${window.location.origin}/documents/contract/${reservation.id}`;
    const selectedTemplate = templatesList.find((t: any) => t.id === editForm.itineraryTemplateId);
    // 일정표 준비됨 = 템플릿 선택 OR 편집기로 직접 작성·저장된 문서 보유
    const exactProducts = products.filter(p => p.name === reservation.productName);
    const reservationProduct = reservation.productId ? products.find(p => p.id === reservation.productId) : exactProducts.length === 1 ? exactProducts[0] : undefined;
    const itineraryCanPublish = ['confirmed', 'paid', 'completed'].includes(reservation.status);
    const publishItinerary = () => api.documents.itinerary.publish(reservation.id);
    const contractTravelers = editForm.contractData?.travelers || [];
    const contractHasTravelers = contractTravelers.length > 0 && !!contractTravelers[0]?.name;
    const contractAgreement = editForm.contractData?.agreement;
    // 고객이 계약서에서 직접 제출한 내용(여권·항공편·동의)이 있으면 이 페이지에 바로 요약 표시
    const contractSubmitted = contractHasTravelers || !!editForm.contractData?.customerSubmittedAt || !!contractAgreement?.agreed
        || [editForm.contractData?.arrival, editForm.contractData?.departure].some(flight => flight?.date || flight?.time || flight?.flight);
    const fmtFlightLine = (f?: { date?: string; time?: string; flight?: string }) => {
        const parts = [f?.date, f?.time, f?.flight].filter(Boolean);
        return parts.length ? parts.join(' · ') : '미입력';
    };
    // 고객이 계약서에서 직접 여행자 정보를 작성하므로, 이메일만 있으면 발송 가능
    const contractReady = !!reservation.email;
    // 발송 기록 판별 — 옛 일본어 기록('日程'/'契約')과 새 한국어 기록('일정'/'계약')을 모두 인식한다.
    const acceptedDelivery = (kind: 'itinerary' | 'contract', channel?: string) => recordedDelivery?.bookingId === reservation.id
        && recordedDelivery.items.some(item => item.kind === kind && item.state === 'accepted' && (!channel || item.channel === channel));
    const itineraryChanged = recordedDelivery?.bookingId === reservation.id && !!recordedDelivery.documents?.itinerary?.needsResend;
    const contractChanged = recordedDelivery?.bookingId === reservation.id && !!recordedDelivery.documents?.contract?.needsResend;
    const itineraryEmailSent = acceptedDelivery('itinerary', 'email') || timelineEvents.some((e: any) => e.type === 'email' && (e.detail === itineraryUrl || String(e.description || '').includes('日程') || String(e.description || '').includes('일정')));
    const contractEmailSent = acceptedDelivery('contract', 'email') || timelineEvents.some((e: any) => e.type === 'email' && (e.detail === contractUrl || String(e.description || '').includes('契約') || String(e.description || '').includes('계약')));
    const itinerarySent = acceptedDelivery('itinerary') || itineraryEmailSent;
    const contractSent = acceptedDelivery('contract') || contractEmailSent;
    const emailChanged = (kind: 'itinerary' | 'contract', fallback: boolean) => {
        if (!(kind === 'itinerary' ? itineraryEmailSent : contractEmailSent)) return false;
        const data = recordedDelivery?.bookingId === reservation.id ? recordedDelivery : undefined;
        const last = data?.items.find(item => item.kind === kind && item.channel === 'email' && item.state === 'accepted');
        return last?.revision && data?.documents?.[kind]?.revision ? last.revision !== data.documents[kind].revision : fallback;
    };
    const itineraryEmailChanged = emailChanged('itinerary', itineraryChanged), contractEmailChanged = emailChanged('contract', contractChanged);

    // ── 문서 편집기(예약/견적 자동 채움) ──
    const _sd = (reservation as any).startDate;
    const _ed = (reservation as any).endDate;
    const _nights = (_sd && _ed) ? Math.round((new Date(_ed).getTime() - new Date(_sd).getTime()) / 86400000) : NaN;
    const docTripLength = Number.isFinite(_nights) && _nights >= 0 ? `${_nights}박 ${_nights + 1}일` : undefined;
    const docInitialContent: ReservationDocContent | null = (() => {
        const dc = reservation.documentContent;
        if (dc && (Array.isArray(dc.days) || dc.documentSettings)) {
            return { ...dc, name: dc.name || '', description: dc.description || '', days: dc.days || [], documentSettings: mergeDocumentSettings(dc.documentSettings) };
        }
        if (selectedTemplate) {
            const decoded = decodeTemplateDescription(selectedTemplate.description || '');
            let tDays: any[] = [];
            try { tDays = typeof selectedTemplate.days === 'string' ? JSON.parse(selectedTemplate.days || '[]') : (selectedTemplate.days || []); } catch { tDays = []; }
            return { name: selectedTemplate.name || '', description: decoded.description || '', days: tDays, documentSettings: decoded.documentSettings };
        }
        return null;
    })();
    // 일자별 숙소 배정이 비어 있어도 일정표에는 "상품 일정의 기본 숙소"가 적용된다.
    // 그 기본 숙소(문서/템플릿 일자 숙소)를 빈 칸에 회색으로 보여줘 혼동을 없앤다.
    const defaultAccomForDay = (day: number): { name?: string; type?: string; location?: string; images?: string[] } | null => {
        const days = docInitialContent?.days ?? productScheduleDays(reservationProduct);
        if (!days || !days.length) return null;
        const d = days.find((x: any) => Number(x?.day) === day) || days[day - 1];
        const acc = d?.accommodation;
        if (!acc) return null;
        if (typeof acc === 'string') return { name: acc };
        return {
            name: acc.name,
            type: acc.type,
            location: acc.location,
            images: Array.isArray(acc.images) ? acc.images : (acc.images ? [acc.images] : []),
        };
    };
    const saveDocContent = async (content: ReservationDocContent, tourDates?: { startDate: string; endDate: string }, kind = activeDocument) => {
        const saved = await onUpdate({
            ...reservation,
            documentContent: content,
            ...(tourDates ? {
                startDate: tourDates.startDate,
                endDate: tourDates.endDate,
                date: tourDates.startDate && tourDates.endDate ? `${tourDates.startDate} ~ ${tourDates.endDate}` : '날짜 미정',
            } : {}),
            history: [...(reservation.history || []), { timestamp: new Date().toISOString(), type: 'modification', description: `${kind === 'contract' ? '계약 조건을' : '확정 일정표를'} 저장했습니다.` }],
        }, true);
        if (!saved) throw new Error('문서를 저장하지 못했습니다. 입력한 내용은 편집기에 남아 있습니다.');
        setDeliveryRevision(v => v + 1);
        return saved;
    };

    const applyDocumentTemplate = async (id: string) => {
        if (!id) return;
        const template = templatesList.find(t => t.id === id);
        if (!template) return;
        if (reservation.documentContent && !window.confirm('저장된 고객 문서의 일정과 조건을 선택한 템플릿으로 교체할까요?')) return;
        const decoded = decodeTemplateDescription(template.description || '');
        let days = template.days || [];
        if (typeof days === 'string') { try { days = JSON.parse(days); } catch { alert('템플릿 일정을 읽을 수 없습니다.'); return; } }
        if (!Array.isArray(days)) { alert('템플릿 일정을 읽을 수 없습니다.'); return; }
        setApplyingTemplate(true);
        try {
            await onUpdate({ ...reservation, itineraryTemplateId: id,
                documentContent: { name: template.name || '', description: decoded.description, days, documentSettings: decoded.documentSettings },
                history: [...(reservation.history || []), { timestamp: new Date().toISOString(), type: 'modification', description: '문서 템플릿을 적용했습니다.', detail: template.name }],
            });
        } finally { setApplyingTemplate(false); }
    };

    const openInlineDocument = (kind: 'itinerary' | 'contract', day?: number) => {
        if (reservation.status === 'cancelled' || workspaceIsBusy()) return;
        if (fullPage && (operationsDirty || quickAssignmentDirty)) { setNavigationNotice('작성 중인 운영·배정 정보를 먼저 저장하거나 취소해 주세요.'); return; }
        if (isEditing) { alert('주문 정보 변경사항을 먼저 저장하세요.'); return; }
        if (fullPage && !workflowOpen) overviewScrollPosition.current = window.scrollY;
        if (fullPage) bodyRef.current?.scrollTo({ top: 0 });
        setWorkflowOpen(true);
        setRequestedDocumentDay(day);
        setDocumentFocusRevision(value => value + 1);
        setActiveDocument(kind); setInlineEditorOpen(true);
        setActiveSec('inline-doc');
        if (!fullPage) requestAnimationFrame(() => bodyRef.current?.querySelector('#sec-inline-doc')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    const closeInlineDocument = () => {
        if (workspaceIsBusy()) return;
        setInlineEditorOpen(false); setInlineDirty(false);
        if (fullPage) { setActiveSec('docs'); requestAnimationFrame(() => bodyRef.current?.scrollTo({ top: 0 })); }
    };
    const inlineSeed = createInlineDocument(docInitialContent, reservationProduct?.documentProduct, reservation.productName);
    docDraftSourceRef.current = { content: inlineSeed, dates: { startDate: reservation.startDate || '', endDate: reservation.endDate || '' } };
    const scheduleDays = docInitialContent?.days ?? productScheduleDays(reservationProduct);
    const workspace = reservationWorkspaceStatus({ ...reservation, days: scheduleDays, agreement: contractAgreement, travelers: contractTravelers });
    const itineraryReady = workspace.scheduleReady;
    const publishCustomerItinerary = async () => {
        if (!canStartDelivery()) return;
        deliveryLock.current = true;
        setPublishing(true);
        try {
            await publishItinerary();
            if (await onUpdate({ ...reservation, itineraryUrl }, true)) alert('확정 일정표를 고객에게 공개했습니다. 메일이나 안내문으로 전달할 수 있습니다.');
        } catch (e: any) { alert(`공개 실패: ${e.message || e}`); }
        finally { deliveryLock.current = false; setPublishing(false); }
    };

    const addHistory = (entry: { type: string; description: string; detail?: string }) => ({
        ...reservation,
        history: [
            ...(reservation.history || []),
            { timestamp: new Date().toISOString(), ...entry }
        ]
    });

    // 고객에게 카카오톡으로 보낼 예약금 입금 안내문 (예약번호·예약금·입금 계좌·입금 후 신고 방법)
    const copyDepositGuide = async () => {
        const body = [
            `[${BRAND.name}] 예약금 입금 안내`,
            '',
            `${reservation.customerName || '고객'} 님, 예약해 주셔서 감사합니다.`,
            '아래 계좌로 예약금을 입금해 주세요.',
            '',
            `■ 예약번호: ${reservationNumber}`,
            `■ 상품: ${reservation.productName || ''}`,
            `■ 예약금: ${won(editForm.deposit || 0)}`,
            `■ 입금 계좌: ${DEPOSIT_ACCOUNT.bank} ${DEPOSIT_ACCOUNT.number}`,
            `■ 예금주: ${DEPOSIT_ACCOUNT.holder}`,
            '',
            "입금하신 뒤 홈페이지 마이페이지 > 예약 내역 > 예약 상세에서 '예약금 입금 완료했어요'를 눌러 입금자명을 알려 주세요.",
            `${window.location.origin}/mypage/reservations/${reservation.id}`,
            '',
            '담당자가 입금을 확인하면 예약이 확정됩니다. 잔금은 현지에서 현금으로 결제합니다.',
        ].join('\n');
        // 복사가 막힌 환경이면 버튼 표시를 바꾸지 않는다(조용히 실패).
        if (!(await copyText(body))) return;
        setCopiedDocId('deposit-guide');
        setTimeout(() => setCopiedDocId(null), 1500);
    };

    const copyCustomerMessage = async (kind: 'itinerary' | 'contract' | 'final') => {
        if (!canStartDelivery()) return;
        deliveryLock.current = true;
        setPublishing(true);
        try {
            if (kind !== 'contract') await publishItinerary();
            const url = kind === 'contract' ? contractUrl : kind === 'final' ? `확정 일정표: ${itineraryUrl}\n계약서: ${contractUrl}` : itineraryUrl;
            const title = kind === 'contract' ? '해외여행 계약서' : kind === 'itinerary' ? '확정 일정표' : '출발 전 최종 안내';
            const body = `${reservation.customerName || '고객'} 님\n\n안녕하세요. ${BRAND.name}입니다.\n${reservation.productName}의 ${title}를 준비했습니다.\n아래 링크에서 내용을 확인해 주세요.\n\n${url}\n\n궁금한 점이나 수정을 원하시는 부분이 있으면 이 메시지에 바로 회신해 주세요.`;
            await navigator.clipboard.writeText(body);
            if (kind !== 'contract') await onUpdate({ ...reservation, itineraryUrl }, true);
            setCopiedDocId(`${kind}-message`);
            setTimeout(() => setCopiedDocId(null), 1500);
        } catch (e: any) { alert(`공유 실패: ${e.message || e}`); }
        finally { deliveryLock.current = false; setPublishing(false); }
    };

    // ── 숙소 수배 의뢰서 (담당자에게 보낼 여행자·항공편·상품 요약) ──
    const bookingSheet = () => {
        const cd = editForm.contractData || {};
        const nights = tripDays > 1 ? `${tripDays - 1}박 ${tripDays}일` : '';
        const total = editForm.totalAmount || 0;
        const deposit = editForm.deposit || 0;
        // 몽골어 수배서 PDF(printBookingSheet)는 현지 담당자가 읽으므로 '원' 대신 통화 기호(₩)로 적는다.
        const wonMn = (n: number) => `₩${(n || 0).toLocaleString('ko-KR')}`;
        return {
            number: reservationNumber,
            product: reservation.productName || '',
            period: reservation.date || '',
            nights,
            people: `${reservation.totalPeople || contractTravelers.length || ''}명`,
            arrival: fmtFlightLine(cd.arrival),
            departure: fmtFlightLine(cd.departure),
            travelers: contractTravelers,
            total: won(total),
            deposit: won(deposit),
            balance: won(total - deposit),
            totalMn: wonMn(total),
            depositMn: wonMn(deposit),
            balanceMn: wonMn(total - deposit),
            memos: memos.map((m: any) => String(m.description || '').trim()).filter(Boolean),
            signed: contractAgreement?.agreed
                ? `${contractAgreement.name || ''}${contractAgreement.agreedAt ? ` (${contractAgreement.agreedAt.split('T')[0]})` : ''}`
                : '미동의',
        };
    };

    const copyBookingText = async () => {
        const d = bookingSheet();
        const lines: string[] = [
            `[숙소 수배 의뢰] ${d.number}`,
            `상품: ${d.product}`,
            `기간: ${d.period}${d.nights ? ` (${d.nights})` : ''}`,
            `인원: ${d.people}`,
            `도착편: ${d.arrival}`,
            `출발편: ${d.departure}`,
            '',
            `투어 비용: ${d.total}  /  예약금: ${d.deposit}  /  잔금: ${d.balance}`,
            '',
            '◆ 여행자 명단 (여권명 / 이름 / 생년월일 / 성별 / 연락처)',
            ...d.travelers.map((t, i) => `${i + 1}. ${(t.passportName || '-').toUpperCase()} / ${t.name || '-'} / ${t.birthdate || '-'} / ${t.gender || '-'} / ${t.phone || '-'}`),
        ];
        if (d.memos.length) {
            lines.push('', '◆ 메모', ...d.memos.map((m) => `- ${m}`));
        }
        await navigator.clipboard.writeText(lines.join('\n'));
        setCopiedDocId('booking');
        setTimeout(() => setCopiedDocId(null), 1500);
    };

    const printBookingSheet = () => {
        const d = bookingSheet();
        const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] as string));
        const cell = (v: any) => esc(v || '-');
        // 수배서 PDF는 현지(몽골) 담당자용 — 라벨은 몽골어. 데이터(이름·날짜·금액 등)는 원본 유지.
        const genderMn = (g: any) => {
            const s = String(g || '').trim();
            if (/女|여성|female|^f$/i.test(s)) return 'Эмэгтэй';
            if (/男|남성|male|^m$/i.test(s)) return 'Эрэгтэй';
            return s || '-';
        };
        const nightsMn = tripDays > 1 ? `${tripDays - 1} шөнө ${tripDays} өдөр` : '';
        const peopleCount = reservation.totalPeople || contractTravelers.length || '';
        const peopleMn = peopleCount ? `${peopleCount} хүн` : '-';
        const signedMn = contractAgreement?.agreed
            ? `${contractAgreement.name || ''}${contractAgreement.agreedAt ? ` (${contractAgreement.agreedAt.split('T')[0]})` : ''}`
            : 'Зөвшөөрөөгүй';
        const travelerRows = d.travelers.map((t, i) => `
            <tr>
                <td class="c">${i + 1}</td>
                <td class="up b">${cell((t.passportName || '').toUpperCase())}</td>
                <td>${cell(t.name)}</td>
                <td class="c">${cell(t.birthdate)}</td>
                <td class="c">${esc(genderMn(t.gender))}</td>
                <td>${cell(t.phone)}</td>
            </tr>`).join('');
        const memoBlock = d.memos.length ? `
            <h2>Тэмдэглэл</h2>
            <ul style="margin:0;padding-left:18px">${d.memos.map((m) => `<li style="margin:4px 0;font-size:12.5px;line-height:1.5;white-space:pre-wrap">${esc(m)}</li>`).join('')}</ul>` : '';
        const html = `<!doctype html><html lang="mn"><head><meta charset="utf-8"><title>Зочид буудлын захиалга ${esc(d.number)}</title>
        <style>
          *{box-sizing:border-box} body{font-family:'Noto Sans','Arial','Malgun Gothic',sans-serif;color:#111;margin:0;padding:28px 32px}
          h1{font-size:20px;margin:0 0 4px} .sub{color:#666;font-size:12px;margin:0 0 18px}
          .meta{width:100%;border-collapse:collapse;margin-bottom:18px}
          .meta td{border:1px solid #d7dee8;padding:8px 10px;font-size:13px}
          .meta td.k{background:#eef4ff;color:#1656d6;font-weight:700;width:135px;white-space:nowrap}
          h2{font-size:14px;margin:18px 0 8px;color:#0b1b45;border-left:4px solid #287dfa;padding-left:8px}
          table{width:100%;border-collapse:collapse} th,td{border:1px solid #d7dee8;padding:7px 9px;font-size:12.5px;text-align:left}
          th{background:#f4f8ff;color:#0b1b45;font-weight:700} td.c{text-align:center} td.b{font-weight:700} td.up{text-transform:uppercase}
          .foot{margin-top:22px;color:#888;font-size:11px;border-top:1px solid #e5e9f0;padding-top:10px}
          @media print{body{padding:0} @page{margin:14mm}}
        </style></head><body>
          <h1>Зочид буудлын захиалгын хүсэлт</h1>
          <p class="sub">${esc(BRAND.nameEn)} · Захиалгын дугаар: ${esc(d.number)}</p>
          <table class="meta">
            <tr><td class="k">Аяллын нэр</td><td colspan="3">${esc(d.product)}</td></tr>
            <tr><td class="k">Аяллын хугацаа</td><td>${esc(d.period)}${nightsMn ? ` <b>(${esc(nightsMn)})</b>` : ''}</td><td class="k">Хүний тоо</td><td>${esc(peopleMn)}</td></tr>
            <tr><td class="k">Ирэх нислэг</td><td colspan="3">${esc(d.arrival)}</td></tr>
            <tr><td class="k">Буцах нислэг</td><td colspan="3">${esc(d.departure)}</td></tr>
            <tr><td class="k">Аяллын төлбөр</td><td class="b">${esc(d.totalMn)}</td><td class="k">Урьдчилгаа / Үлдэгдэл</td><td>${esc(d.depositMn)} / ${esc(d.balanceMn)}</td></tr>
          </table>
          <h2>Аялагчдын жагсаалт</h2>
          <table><thead><tr><th style="width:36px">№</th><th>Паспортын нэр</th><th>Нэр</th><th style="width:120px">Төрсөн огноо</th><th style="width:70px">Хүйс</th><th style="width:150px">Холбоо барих</th></tr></thead>
          <tbody>${travelerRows}</tbody></table>
          ${memoBlock}
          <p class="foot">Цахим гарын үсэг: ${esc(signedMn)} · Хэвлэсэн өдрийн байдлаарх мэдээлэл. Хувийн мэдээлэл агуулсан тул анхааралтай хадгална уу.</p>
        </body></html>`;
        const w = window.open('', '_blank', 'width=920,height=1000');
        if (!w) { alert('팝업이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 다시 시도해 주세요.'); return; }
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => { try { w.print(); } catch { /* 사용자가 수동 인쇄 */ } }, 350);
    };

    // ── 가이드용 안내서 PDF ──
    // 확정 일정 데이터는 그대로 사용하되, 가이드 업무에 필요한 항공편·고객·일정만
    // 이미지 없이 압축한 전용 인쇄 레이아웃(DocumentItinerary의 guide 모드)으로 연다.
    // 가이드 전용 정보(항공편·요청메모·담당가이드·차량)는 고객용 API 응답에 없으므로
    // localStorage(같은 origin·일회성)로만 전달한다 — 고객에게는 절대 노출되지 않는다.
    const printGuideSheet = () => {
        const d = bookingSheet();
        const g: any = (reservation.assignedGuide as any) || {};
        const v: any = (editForm.contractData as any)?.vehicle || {};
        const payload = {
            customerName: reservation.customerName || '',
            people: d.people || '',
            arrival: d.arrival || '',
            departure: d.departure || '',
            guideName: g.name || '',
            guidePhone: g.phone || '',
            vehicleType: v.type || v.name || '',
            vehiclePhone: v.phone || '',
            memos: d.memos || [],
        };
        try { localStorage.setItem(`guideDoc:${reservation.id}`, JSON.stringify(payload)); } catch { /* ignore */ }
        // Chromium은 숨은 iframe에서 window.print()를 호출해도 상위 관리자 화면을
        // 인쇄하는 경우가 있다. 전용 창을 동기적으로 열어 가이드 문서만 A4로 인쇄한다.
        const url = `${window.location.origin}/documents/itinerary/${reservation.id}?guide=1&autoprint=1&autoclose=1`;
        const printWindow = window.open(url, '_blank', 'popup=yes,width=920,height=1100');
        if (!printWindow) {
            alert('팝업이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 다시 눌러 주세요.');
            return;
        }
        try { printWindow.focus(); } catch { /* 새 창에서 자동 인쇄 계속 */ }
    };

    // ── 공항 미팅용 가이드 피켓 ──
    // 고정 디자인 PNG 위에 예약 고객명과 투어 기간만 캔버스로 합성해 즉시 내려받는다.
    const downloadGuidePicket = async () => {
        const customerName = String(reservation.customerName || '').trim().toUpperCase();
        if (!customerName) { alert('고객 이름이 없어 가이드 피켓을 만들 수 없습니다.'); return; }

        const parseDate = (value: any) => {
            const match = String(value || '').match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
            if (!match) return null;
            return { year: match[1], month: match[2].padStart(2, '0'), day: match[3].padStart(2, '0') };
        };
        const contractData: any = editForm.contractData || {};
        const start = parseDate((reservation as any).startDate || contractData.arrival?.date);
        const end = parseDate((reservation as any).endDate || contractData.departure?.date);
        if (!start || !end) { alert('투어 시작일과 종료일을 먼저 입력해 주세요.'); return; }
        const period = start.year === end.year
            ? `${start.year}.${start.month}.${start.day} - ${end.month}.${end.day}`
            : `${start.year}.${start.month}.${start.day} - ${end.year}.${end.month}.${end.day}`;

        try {
            const template = await new Promise<HTMLImageElement>((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error('피켓 디자인을 불러오지 못했습니다.'));
                // 파일명을 버전 고정해 CDN/브라우저가 이전 흰색 템플릿을 재사용하지 않게 한다.
                image.src = '/assets/guide-picket-template-dark-v2.png';
            });
            try { await document.fonts?.ready; } catch { /* 시스템 글꼴로 계속 진행 */ }

            const canvas = document.createElement('canvas');
            canvas.width = template.naturalWidth;
            canvas.height = template.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('이미지 생성 기능을 사용할 수 없습니다.');
            ctx.drawImage(template, 0, 0);

            // 고객명: 첨부 피켓처럼 포스터 중앙을 가득 채운 민트 그라데이션 타이포.
            // 긴 이름은 한 줄에 들어올 때까지 자동 축소한다.
            const nameMaxWidth = canvas.width * 0.92;
            let nameFontSize = Math.round(canvas.width * 0.17);
            const nameFontFamily = '"Arial Black", Impact, "Pretendard", "Helvetica Neue", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `900 ${nameFontSize}px ${nameFontFamily}`;
            while (ctx.measureText(customerName).width > nameMaxWidth && nameFontSize > 62) {
                nameFontSize -= 2;
                ctx.font = `900 ${nameFontSize}px ${nameFontFamily}`;
            }
            const nameY = canvas.height * 0.625;
            const nameGradient = ctx.createLinearGradient(
                0,
                nameY - nameFontSize * 0.58,
                0,
                nameY + nameFontSize * 0.58,
            );
            nameGradient.addColorStop(0, '#F7FFFD');
            nameGradient.addColorStop(0.38, '#D2F8F1');
            nameGradient.addColorStop(1, '#5CCDBB');
            ctx.save();
            ctx.shadowColor = 'rgba(0, 18, 20, 0.72)';
            ctx.shadowBlur = Math.max(4, canvas.width * 0.004);
            ctx.shadowOffsetY = Math.max(4, canvas.height * 0.004);
            ctx.lineJoin = 'round';
            ctx.lineWidth = Math.max(1.5, canvas.width * 0.0015);
            ctx.strokeStyle = 'rgba(226, 255, 250, 0.34)';
            ctx.fillStyle = nameGradient;
            ctx.strokeText(customerName, canvas.width / 2, nameY, nameMaxWidth);
            ctx.fillText(customerName, canvas.width / 2, nameY, nameMaxWidth);
            ctx.restore();

            // 날짜: 하단 검정 플라크 정중앙.
            const dateMaxWidth = canvas.width * 0.31;
            let dateFontSize = Math.round(canvas.width * 0.033);
            ctx.font = `900 ${dateFontSize}px "Arial Black", Arial, sans-serif`;
            while (ctx.measureText(period).width > dateMaxWidth && dateFontSize > 26) {
                dateFontSize -= 1;
                ctx.font = `900 ${dateFontSize}px "Arial Black", Arial, sans-serif`;
            }
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#8DE6D5';
            ctx.shadowColor = 'rgba(115, 239, 216, 0.22)';
            ctx.shadowBlur = Math.max(2, canvas.width * 0.002);
            ctx.shadowOffsetY = 1;
            ctx.fillText(period, canvas.width / 2, canvas.height * 0.79, dateMaxWidth);
            ctx.restore();

            const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
                (value) => value ? resolve(value) : reject(new Error('PNG 변환에 실패했습니다.')),
                'image/png',
            ));
            const safeName = customerName.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 70);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `가이드_피켓_${safeName}_${start.year}${start.month}${start.day}.png`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error: any) {
            alert(error?.message || '가이드 피켓을 만들지 못했습니다.');
        }
    };

    const downloadBookingSheetExcel = () => {
        const d = bookingSheet();
        const startDate = String((reservation as any).startDate || '').slice(0, 10);
        const addDays = (date: string, offset: number) => {
            if (!date) return '';
            const base = new Date(`${date}T00:00:00`);
            if (Number.isNaN(base.getTime())) return '';
            base.setDate(base.getDate() + offset);
            return base.toISOString().slice(0, 10);
        };
        const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] as string));
        const safeFile = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 80);
        const endDate = String((reservation as any).endDate || '').slice(0, 10);
        const arrivalDate = editForm.contractData?.arrival?.date || startDate;
        const departureDate = editForm.contractData?.departure?.date || endDate;
        const days = scheduleDays;
        const dayByNumber = (day: number) => days.find((item: any) => Number(item?.day) === day) || days[day - 1] || {};
        const uniqueText = (items: any[]) => Array.from(new Set(items.map((item) => String(item || '').trim()).filter(Boolean))).join(', ');
        const inferTravelRegion = () => {
            const q = reservation.quoteDetail as any;
            const quoteRegions = [
                ...(Array.isArray(q?.destinations) ? q.destinations : []),
                ...(Array.isArray(q?.themes) ? q.themes : []),
                q?.region,
                q?.category,
                q?.destination,
            ];
            const direct = uniqueText([editForm.contractData?.region, editForm.contractData?.category, ...quoteRegions]);
            if (direct) return direct;
            const fromDays = uniqueText(days.map((day: any) => day?.region));
            if (fromDays) return fromDays;
            const product = `${reservation.productName || ''} ${d.product || ''}`;
            const inferred = [
                /고비|ゴビ|gobi/i.test(product) && '고비사막',
                /승마|乗馬|horse/i.test(product) && '승마',
                /홉스굴|홉스골|フブスグル|khuvsgul/i.test(product) && '홉스굴',
                /중앙|中央|テレルジ|terelj|테를지|테렐지|쳉헤르|ツェンヘル/i.test(product) && '중앙몽골',
            ].filter(Boolean);
            return uniqueText(inferred);
        };
        const tripRegion = inferTravelRegion();
        const roomCountDefault = reservation.totalPeople ? `${Math.max(1, Math.ceil(reservation.totalPeople / 2))}개` : '';
        // 숙소 수배서는 숙박 박수 기준(마지막 날=출발일 제외). 박수를 넘는 저장 데이터가 있으면 그대로 포함해 유실 방지.
        const rows = Array.from({ length: accomRowCount }, (_, i) => {
            const day = i + 1;
            const dayContent = dayByNumber(day);
            const assigned = reservation.dailyAccommodations?.find((item) => item.day === day);
            const fallback = defaultAccomForDay(day);
            const accommodation = assigned?.accommodation || fallback || {};
            const dayDestination = uniqueText([dayContent.region, dayContent.title]) || `${day}일차`;
            return {
                customerName: reservation.customerName || '',
                arrivalDate,
                departureDate,
                people: d.people,
                scheduleLength: d.nights || docTripLength || '',
                travelRegion: tripRegion,
                travelStartPeriod: startDate && endDate ? `${startDate} ~ ${endDate}` : (startDate || d.period),
                day,
                dayDestination,
                stayDate: addDays(startDate, i),
                hotelGrade: accommodation.type || '',
                roomCount: roomCountDefault,
                hotelName: accommodation.name || '',
                hotelStatus: assigned ? '확정' : '미확정',
            };
        });
        const headers: Array<[keyof typeof rows[number], string]> = [
            ['customerName', '고객명'],
            ['arrivalDate', '도착일'],
            ['departureDate', '출발일'],
            ['people', '인원수'],
            ['scheduleLength', '일정'],
            ['travelRegion', '여행지역'],
            ['travelStartPeriod', '여행시작기간'],
            ['day', '일차'],
            ['dayDestination', '일차별 여행지'],
            ['stayDate', '숙박일'],
            ['hotelGrade', '숙소등급'],
            ['roomCount', '방수'],
            ['hotelName', '호텔/숙소 이름'],
            ['hotelStatus', '숙소 확정 여부'],
        ];
        const tableRows = rows.map((row) => `
            <tr>${headers.map(([key]) => `<td>${esc(row[key])}</td>`).join('')}</tr>
        `).join('');
        const html = `<!doctype html><html><head><meta charset="utf-8">
        <style>
          table{border-collapse:collapse;font-family:Arial,'Malgun Gothic',sans-serif;font-size:11pt}
          th{background:#0f766e;color:#fff;font-weight:700;border:1px solid #0b5f59;padding:6px 8px;white-space:nowrap}
          td{border:1px solid #cbd5e1;padding:6px 8px;white-space:pre-wrap;vertical-align:top}
          .meta td{background:#f8fafc;font-weight:700}
        </style></head><body>
          <table class="meta">
            <tr><td>숙소 수배 시트</td><td>${esc(d.number)}</td><td>${esc(d.product)}</td><td>${esc(d.period)}</td></tr>
          </table>
          <br>
          <table>
            <thead><tr>${headers.map(([, label]) => `<th>${esc(label)}</th>`).join('')}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body></html>`;
        const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeFile(`수배서_${d.number}_${reservation.customerName || ''}`)}.xls`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const deliverDocument = async (kind: 'itinerary' | 'contract', data: Parameters<typeof sendNotificationEmail>[2]) => {
        const scope = `${reservation.id}:${kind}`;
        const key = deliveryKeys.current[scope] ||= crypto.randomUUID();
        const result = await sendNotificationEmail(reservation.email!, kind === 'contract' ? 'CONTRACT_READY' : 'ITINERARY_READY', data, key);
        if (result.success || (result.error as any)?.delivery?.state === 'failed') delete deliveryKeys.current[scope];
        setDeliveryRevision(v => v + 1);
        return result;
    };
    const canStartDelivery = () => {
        if (workspaceIsBusy()) return false;
        if (inlineDirty || docDraftPending || isEditing || operationsDirty || quickAssignmentDirty) { alert('작성 중인 내용이나 보관된 초안을 먼저 확인하고 저장한 뒤 고객에게 발송해 주세요.'); return false; }
        return true;
    };
    const sendItineraryToCustomer = async () => {
        if (!canStartDelivery()) return;
        if (!itineraryReady || !reservation.email) {
            alert(!reservation.email ? '고객 이메일이 없습니다.' : '일정표 템플릿을 먼저 선택해 주세요.');
            return;
        }
        if (itineraryEmailSent && !window.confirm('이미 이메일로 접수된 일정표 안내를 다시 보낼까요?')) return;
        deliveryLock.current = true;
        setSendingItinerary(true);
        try {
            await publishItinerary();
            const result = await deliverDocument('itinerary', {
                customerName: reservation.customerName,
                productName: reservation.productName,
                reservationId: reservationNumber,
                reservationDbId: reservation.id,
                reservationNumber,
                userId: reservation.userId,
                travelDates: reservation.date,
                itineraryUrl,
            });
            if (!result.success) throw result.error || new Error('이메일 발송에 실패했습니다.');
            // 발송됨 플래그 저장 → 고객 마이페이지에서 확정 일정표가 "발송됨"으로 표시됨(itineraryUrl을 플래그로 사용)
            const recorded = await onUpdate({ ...addHistory({ type: 'email', description: '확정 일정표를 고객님께 발송했습니다.', detail: itineraryUrl }), itineraryUrl }, true);
            alert(recorded ? '일정표 안내를 고객에게 발송했습니다.' : '메일은 발송했지만 발송 이력을 저장하지 못했습니다. 새로고침하여 확인하세요.');
        } catch (e: any) {
            alert(`발송 실패: ${e.message || e}`);
        } finally {
            deliveryLock.current = false;
            setSendingItinerary(false);
        }
    };

    const sendContractToCustomer = async () => {
        if (!canStartDelivery()) return;
        if (!reservation.email) {
            alert('고객 이메일이 없습니다.');
            return;
        }
        if (contractEmailSent && !window.confirm('이미 이메일로 접수된 계약서 안내를 다시 보낼까요?')) return;
        deliveryLock.current = true;
        setSendingContract(true);
        try {
            const result = await deliverDocument('contract', {
                customerName: reservation.customerName,
                productName: reservation.productName,
                reservationId: reservationNumber,
                reservationDbId: reservation.id,
                reservationNumber,
                userId: reservation.userId,
                travelDates: reservation.date,
                contractUrl,
            });
            if (!result.success) throw result.error || new Error('이메일 발송에 실패했습니다.');
            // 발송됨 플래그 저장 → 고객 마이페이지에서 해외여행 계약서가 "발송됨"으로 표시됨(contractUrl을 플래그로 사용)
            const recorded = await onUpdate({ ...addHistory({ type: 'email', description: '해외여행 계약서를 고객님께 발송했습니다.', detail: contractUrl }), contractUrl }, true);
            alert(recorded ? '계약서 안내를 고객에게 발송했습니다.' : '메일은 발송했지만 발송 이력을 저장하지 못했습니다. 새로고침하여 확인하세요.');
        } catch (e: any) {
            alert(`발송 실패: ${e.message || e}`);
        } finally {
            deliveryLock.current = false;
            setSendingContract(false);
        }
    };

    const sendReadyDocumentsToCustomer = async () => {
        if (!canStartDelivery()) return;
        if (!reservation.email) {
            alert('고객 이메일이 없습니다.');
            return;
        }

        const jobs: Array<{
            key: 'itinerary' | 'contract';
            title: string;
            ready: boolean;
            sent: boolean;
            send: () => ReturnType<typeof sendNotificationEmail>;
            history: { type: string; description: string; detail: string };
        }> = [
            {
                key: 'itinerary',
                title: '일정표',
                ready: itineraryReady && itineraryCanPublish,
                sent: itineraryEmailSent && !itineraryEmailChanged,
                send: () => deliverDocument('itinerary', {
                    customerName: reservation.customerName,
                    productName: reservation.productName,
                    reservationId: reservationNumber,
                    reservationDbId: reservation.id,
                    reservationNumber,
                    userId: reservation.userId,
                    travelDates: reservation.date,
                    itineraryUrl,
                }),
                history: { type: 'email', description: '확정 일정표를 고객님께 발송했습니다.', detail: itineraryUrl },
            },
            {
                key: 'contract',
                title: '계약서',
                ready: contractReady,
                sent: contractEmailSent && !contractEmailChanged,
                send: () => deliverDocument('contract', {
                    customerName: reservation.customerName,
                    productName: reservation.productName,
                    reservationId: reservationNumber,
                    reservationDbId: reservation.id,
                    reservationNumber,
                    userId: reservation.userId,
                    travelDates: reservation.date,
                    contractUrl,
                }),
                history: { type: 'email', description: '해외여행 계약서를 고객님께 발송했습니다.', detail: contractUrl },
            },
        ];

        const readyJobs = jobs.filter((job) => job.ready && !job.sent);
        if (readyJobs.length === 0) {
            alert('새로 발송할 준비된 문서가 없습니다. 이미 발송했거나 필수 정보가 부족합니다.');
            return;
        }

        deliveryLock.current = true;
        setSendingAllDocs(true);
        setSendingItinerary(readyJobs.some((job) => job.key === 'itinerary'));
        setSendingContract(readyJobs.some((job) => job.key === 'contract'));

        const sentHistories: Array<{ timestamp: string; type: string; description: string; detail: string }> = [];
        const sentKeys: string[] = [];
        try {
            for (const job of readyJobs) {
                if (job.key === 'itinerary') await publishItinerary();
                const result = await job.send();
                if (!result.success) throw result.error || new Error(`${job.title} 이메일 발송에 실패했습니다.`);
                sentKeys.push(job.key);
                sentHistories.push({ timestamp: new Date().toISOString(), ...job.history });
            }

            // 발송한 문서만 "발송됨" 플래그 저장 → 고객 마이페이지에 발송됨으로 표시
            const recorded = await onUpdate({
                ...reservation,
                ...(sentKeys.includes('itinerary') ? { itineraryUrl } : {}),
                ...(sentKeys.includes('contract') ? { contractUrl } : {}),
                history: [
                    ...(reservation.history || []),
                    ...sentHistories,
                ],
            }, true);
            alert(recorded ? `${readyJobs.map((job) => job.title).join(', ')} 안내를 고객에게 발송했습니다.` : '메일은 발송했지만 발송 이력을 저장하지 못했습니다. 새로고침하여 확인하세요.');
        } catch (e: any) {
            if (sentKeys.length) await onUpdate({ ...reservation,
                ...(sentKeys.includes('itinerary') ? { itineraryUrl } : {}),
                ...(sentKeys.includes('contract') ? { contractUrl } : {}),
                history: [...(reservation.history || []), ...sentHistories] }, true);
            alert(`통합 발송 실패: ${e.message || e}`);
        } finally {
            deliveryLock.current = false;
            setSendingAllDocs(false);
            setSendingItinerary(false);
            setSendingContract(false);
        }
    };

    const addMemo = async () => {
        const text = memoDraft.trim();
        if (!text || workspaceIsBusy()) return;
        if (isEditing || operationsDirty || inlineDirty) { setNavigationNotice('작성 중인 주문·운영·문서 내용을 먼저 저장한 뒤 메모를 저장해 주세요.'); return; }
        const updated = {
            ...reservation,
            history: [
                ...(reservation.history || []),
                { timestamp: new Date().toISOString(), type: 'admin_memo', description: text }
            ]
        };
        if (await onUpdate(updated, true)) {
            setMemoDraft(current => current.trim() === text ? '' : current);
            setMemoFocused(false);
        }
    };

    const deleteMemo = (ts: string) => {
        const updated = {
            ...reservation,
            history: (reservation.history || []).filter((h: any) => h.timestamp !== ts)
        };
        onUpdate(updated);
    };

    const timelineIcon: Record<string, string> = {
        created: 'add_circle',
        email: 'mail',
        note: 'sticky_note_2',
        call: 'call',
        modification: 'edit_note',
        payment: 'payments',
        document_added: 'description',
        assignment: 'assignment_ind',
    };

    const SECTION_ANCHORS: Array<{ id: 'docs' | 'inline-doc' | 'ops' | 'info' | 'pay' | 'assign' | 'log'; label: string; hint: string; icon: string }> = [
        { id: 'docs', label: '일정표·계약서', hint: '편집 · 미리보기 · 전달', icon: 'description' },
        ...(!fullPage && inlineEditorOpen ? [{ id: 'inline-doc' as const, label: '문서 작성', hint: '작성 중인 문서', icon: 'edit' }] : []),
        { id: 'info', label: '주문자 정보', hint: '예약자 · 여행자 · 항공편', icon: 'person' },
        { id: 'pay', label: '결제', hint: '여행금액 · 예약금 · 잔금', icon: 'payments' },
        { id: 'assign', label: '가이드·숙소', hint: '등록 자원 선택 · 배정', icon: 'hotel' },
        { id: 'ops', label: '운영·영수증', hint: '차량 · 수배 · 발급 기록', icon: 'receipt_long' },
        { id: 'log', label: '메모·이력', hint: '상담 메모 · 변경 · 발송', icon: 'history' },
    ];
    const detailSection = activeSec === 'inline-doc' ? 'docs' : activeSec;
    const currentSection = SECTION_ANCHORS.find(item => item.id === detailSection)!;
    const workTabs = fullPage ? [
        { ...SECTION_ANCHORS[0], key: 'docs', documentKind: 'itinerary' as const, label: '일정표' },
        { ...SECTION_ANCHORS[0], key: 'contract', documentKind: 'contract' as const, label: '계약서' },
        ...SECTION_ANCHORS.slice(1).map(item => ({ ...item, key: item.id, documentKind: undefined,
            label: ({ info: '주문자·여행자', pay: '결제·영수증', ops: '운영·메모', log: '변경·발송 이력' } as Record<string, string>)[item.id] || item.label })),
    ] : SECTION_ANCHORS.map(item => ({ ...item, key: item.id, documentKind: undefined }));
    const tabIsSelected = (item: typeof workTabs[number]) => (fullPage ? detailSection : activeSec) === item.id && (!item.documentKind || item.documentKind === activeDocument);

    // 여행 일수 — 시작/종료일 차이를 1순위로(가장 정확), 없으면 "n박"(옛 데이터 "n泊") 문자열, 그래도 없으면 일정 일수/배정 수
    const tripDays = (() => {
        if (!Number.isNaN(_nights) && _nights >= 1) return _nights + 1;
        const m = String(reservation.date || '').match(/(\d+)\s*[박泊]/);
        if (m) return parseInt(m[1]) + 1;
        const docDays = scheduleDays.length;
        if (docDays > 0) return docDays;
        return Math.max((reservation.dailyAccommodations || []).length, 1);
    })();
    // 숙박 박수 — 4박 5일이면 숙소는 4박(1~4일차 밤). 마지막 날(출발일)에는 숙소 슬롯이 없어야
    // 숙소 배정 보드(Байр захиалга, 박수 기준)와 일차가 일치한다.
    const stayNights = (() => {
        if (!Number.isNaN(_nights) && _nights >= 1) return _nights;
        const m = String(reservation.date || '').match(/(\d+)\s*[박泊]/);
        if (m) return parseInt(m[1]);
        const docDays = scheduleDays.length;
        if (docDays > 1) return docDays - 1;
        return Math.max((reservation.dailyAccommodations || []).length, 1);
    })();
    // 이미 박수를 넘는 일차(예: 5일차)에 저장된 배정이 있으면 숨기지 않고 경고와 함께 보여준다.
    const storedAccomMaxDay = Math.max(0, ...(reservation.dailyAccommodations || []).map(d => Number(d.day) || 0));
    const accomRowCount = Math.max(stayNights, storedAccomMaxDay);
    // 일차별 숙박 날짜 (n일차 밤 = 시작일 + n-1)
    const stayDateLabel = (day: number): string => {
        const sd = String((reservation as any).startDate || '').slice(0, 10);
        if (!sd) return '';
        const dt = new Date(`${sd}T00:00:00`);
        if (Number.isNaN(dt.getTime())) return '';
        dt.setDate(dt.getDate() + day - 1);
        const wd = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()];
        return `${dt.getMonth() + 1}/${dt.getDate()}(${wd})`;
    };

    // 새 숙소 선택은 공통 등록 자원만 사용한다. 현재 배정은 선택 전까지 그대로 유지한다.
    // 이미지가 출처마다 JSON 문자열/배열로 달라 _thumb로 안전하게 통일.
    const firstAccImage = (a: any): string | undefined => {
        if (a?.thumbnail) return a.thumbnail;
        let imgs = a?.images;
        if (typeof imgs === 'string') { try { imgs = JSON.parse(imgs || '[]'); } catch { imgs = []; } }
        return Array.isArray(imgs) ? imgs.find((x: any) => typeof x === 'string' && x) : undefined;
    };
    const pickerAccommodations = (registered?.lodges || []).map(a => ({ ...a, _thumb: firstAccImage(a) }));

    // 문서별 마지막 발송 일시 (history의 email 이벤트에서)
    const lastEmailAt = (url: string, keywords: string[]) => {
        const kind = url === contractUrl ? 'contract' : 'itinerary';
        const receipt = recordedDelivery?.bookingId === reservation.id ? recordedDelivery.items.filter(item => item.kind === kind && item.channel === 'email' && item.state === 'accepted').map(item => ({ timestamp: item.at })) : [];
        const ev = [...timelineEvents.filter((e: any) => e.type === 'email' && (e.detail === url || keywords.some(keyword => String(e.description || '').includes(keyword)))), ...receipt].sort((a: any, b: any) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0))[0];
        return ev?.timestamp ? new Date(ev.timestamp).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    };
    // 옛 일본어 기록('日程'/'契約')과 새 한국어 기록('일정'/'계약')을 모두 인식
    const itinerarySentAt = lastEmailAt(itineraryUrl, ['日程', '일정']);
    const contractSentAt = lastEmailAt(contractUrl, ['契約', '계약']);
    const steps = [
        { id: 'accepted', title: '예약 접수', description: '주문 내용 확인', done: true, actionLabel: '주문 확인', onAction: () => scrollToSec('info') },
        { id: 'deposit', title: '예약금 확인', description: workspace.depositPaid ? '입금 확인 완료' : '입금 내역 확인 필요', done: workspace.depositPaid, actionLabel: '입금 확인하기', onAction: () => scrollToSec('pay') },
        { id: 'contract', title: '계약 동의', description: workspace.signed ? '고객 동의 완료' : contractSent ? '서명 요청됨 · 고객 동의 대기' : '계약서 전달 필요', done: workspace.signed, actionLabel: '계약서 확인하기', onAction: () => { scrollToSec('docs'); setActiveDocument('contract'); } },
        { id: 'schedule', title: '일정 준비', description: itineraryReady ? `${scheduleDays.length}일 일정 준비됨` : '상품 일정 불러와 작성', done: itineraryReady, actionLabel: '일정 작성하기', onAction: () => openInlineDocument('itinerary') },
        { id: 'published', title: '일정표 공개', description: workspace.published ? itinerarySent ? '공개됨 · 안내 서비스 접수' : '공개됨 · 고객 전달 가능' : '내용 확인 후 고객에게 공개', done: workspace.published, actionLabel: '공개·전달하기', onAction: () => scrollToSec('docs') },
    ];
    const readiness = [
        { title: '확정 일정', value: itineraryReady ? `${scheduleDays.length}일` : '작성 필요', description: reservation.documentContent ? '고객별 저장 일정' : selectedTemplate ? '선택한 템플릿 일정' : reservationProduct ? '예약한 상품의 일정' : '일정을 작성하세요', ready: itineraryReady, onAction: () => openInlineDocument('itinerary') },
        { title: '가이드·차량', value: workspace.guideReady ? reservation.assignedGuide?.name || '배정됨' : '가이드 미배정', description: readProductVehicle(reservation.adminOperations, reservation.contractData).type ? `차량 · ${readProductVehicle(reservation.adminOperations, reservation.contractData).type}` : '차량 배정 기록 필요', ready: workspace.guideReady && !!readProductVehicle(reservation.adminOperations, reservation.contractData).type, onAction: () => scrollToSec(workspace.guideReady ? 'ops' : 'assign') },
        { title: '일자별 숙소', value: workspace.nights ? `${workspace.stayCount}/${workspace.nights}박` : '당일 투어', description: workspace.accommodationsReady ? '필요한 숙박일 준비됨' : '귀국일을 제외한 숙소 확인', ready: workspace.accommodationsReady, onAction: () => scrollToSec('assign') },
        { title: '계약·여행자', value: workspace.signed ? '동의 완료' : '동의 대기', description: `여행자 ${workspace.travelerCount}/${reservation.totalPeople || 0}명 입력`, ready: workspace.signed && workspace.travelersReady, onAction: () => scrollToSec('info') },
    ];

    // 예약된 상품의 대표 이미지.
    // 1순위: 예약에 저장된 상품 ID 정확 매칭 (신규 예약부터 저장됨).
    // 2순위(과거 예약): 상품명이 '유일하게' 정확히 일치할 때만 —
    //   동명 상품(예: 은하수 대자연 만끽 투어 4일/5일)이 있으면 추측하지 않고 이미지 생략.
    // 수동 예약(자유 입력 상품명)은 대부분 미매칭 → 이미지 없이 기존 그대로.
    const rankRecent = (items: any[], recent: string[]) => [...items].sort((a, b) => {
        const rank = (id: string) => recent.includes(id) ? recent.indexOf(id) : 999;
        return rank(a.id) - rank(b.id);
    });
    const registeredGuideNames = new Set((registered?.guides || []).map(guide => String(guide.name || '').trim()));
    const pickerGuides = [...(registered?.guides || []), ...guideList.filter(guide => !registeredGuideNames.has(String(guide.name || '').trim()))];
    const visibleGuides = rankRecent(pickerGuides.filter(guide => [guide.name, guide.phone, guide.languages].join(' ').toLowerCase().includes(guideSearch.toLowerCase().trim())), recentAssignments.guides);
    const isCurrentGuide = (guide: any) => !!reservation.assignedGuide && ((guide.id && guide.id === reservation.assignedGuide.id) || guide.name === reservation.assignedGuide.name);
    const guideLanguages = (value: any): string[] => { try { const parsed = typeof value === 'string' ? JSON.parse(value) : value; return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string').slice(0, 3) : []; } catch { return []; } };
    const stayRegion = (stay: any) => String(stay.region || stay.location || '지역 미정');
    const accommodationRegions = [...new Set(pickerAccommodations.map(stayRegion))].sort();
    const visibleAccommodations = rankRecent(pickerAccommodations.filter(stay => (!accommodationRegion || stayRegion(stay) === accommodationRegion) && [stay.name, stay.location, stay.type].join(' ').toLowerCase().includes(accommodationSearch.toLowerCase().trim())), recentAssignments.stays);
    const selectedAccommodation = reservation.dailyAccommodations?.find(stay => Number(stay.day) === selectedDay)?.accommodation;
    const isCurrentAccommodation = (stay: any) => !!selectedAccommodation && ((stay.id && stay.id === selectedAccommodation.id) || stay.name === selectedAccommodation.name);
    const bookedProduct = customerProductReference(reservation, products);
    const productImage = bookedProduct?.image;

    const overview = productCustomerOverview(reservation, scheduleDays, workspace, {
        vehicle: readProductVehicle(reservation.adminOperations, reservation.contractData).type,
        itineraryReady, itinerarySent, contractSent, itineraryChanged, contractChanged, deliveryHistory: recordedDelivery?.items,
    });
    overview.bookedProduct = bookedProduct;
    const kakaoDirty = inlineDirty || docDraftPending || isEditing || operationsDirty || quickAssignmentDirty;
    const notificationActions = <CustomerKakaoActions key={reservation.id} source="product" bookingId={reservation.id}
        revision={JSON.stringify([deliveryRevision, reservation, recordedDelivery?.items.map(item => [item.id, item.kind, item.channel, item.state, item.at, item.error])])} disabled={workspaceIsBusy() || kakaoDirty}
        disabledReason={kakaoDirty ? '변경사항과 보관된 초안을 먼저 저장한 뒤 고객에게 발송해 주세요.' : undefined}
        beforeSend={canStartDelivery} onBusyChange={setSendingKakao} onResult={() => setDeliveryRevision(value => value + 1)}
        onHistory={() => overviewAction('history')} />;
    const refreshHint = '고객 제출·결제·배정·문서의 저장된 정보를 다시 불러옵니다. 고객에게 발송하지 않습니다.';
    const refreshControl = <div className="cw-refresh-control">
        <button type="button" className="cw-text-button" title={refreshHint} disabled={workspaceIsBusy() || isEditing || operationsDirty || quickAssignmentDirty || !!memoDraft.trim()} aria-busy={refreshing} onClick={refreshWorkspace}><Icon name="refresh" />예약 정보 새로고침</button>
        <span className="cw-refresh-status" role="status" aria-live="polite">{refreshing ? '저장된 예약 정보를 불러오는 중…' : refreshedAt ? `불러온 시각 ${new Date(refreshedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : '고객 제출·결제·배정·문서 다시 불러오기'}</span>
        <p className="cw-refresh-hint">고객 제출·결제·배정·문서의 저장된 정보를 불러옵니다.</p>
        {refreshError && <p className="cw-refresh-notice" role="alert">{refreshError}</p>}
    </div>;
    const orderDirty = isEditing && JSON.stringify(editForm) !== JSON.stringify(reservation);
    const resumeWorkLabel = inlineDirty ? activeDocument === 'contract' ? '여행 계약서 편집' : '일정표 편집'
        : operationsDirty ? '운영·영수증 작성' : orderDirty ? detailSection === 'pay' ? '결제 정보 수정' : '주문자 정보 수정' : '';
    const closeQuickAssignment = () => {
        if (workspaceIsBusy()) return;
        if (quickAssignmentDirty && !window.confirm('저장하지 않은 차량 정보를 버리고 닫을까요?')) return;
        setQuickAssignment(null); setQuickAssignmentDirty(false);
    };
    const saveQuickVehicle = async (vehicle: { type: string; phone: string; resource?: Record<string, any> }) => {
        if (workspaceIsBusy() || isEditing || inlineDirty || operationsDirty) return false;
        const currentVehicle = readProductVehicle(reservation.adminOperations, reservation.contractData);
        const saved = await onUpdate({ ...reservation,
            adminOperations: { ...emptyReservationOperations(), ...(reservation.adminOperations || {}), vehicle: vehicle.type, driverPhone: vehicle.phone },
            ...(vehicle.resource ? { contractData: { ...(reservation.contractData || {}), vehicle: { ...vehicle.resource, type: vehicle.type, model: vehicle.type, phone: vehicle.phone } } } : {}),
            history: [...(reservation.history || []), { timestamp: new Date().toISOString(), type: 'modification',
                description: vehicle.type ? '배정 차량 정보를 저장했습니다.' : '차량 배정을 해제했습니다.',
                detail: vehicle.type || currentVehicle.type }],
        }, true);
        if (saved) setNavigationNotice(vehicle.type ? '차량 배정을 저장했습니다.' : '차량 배정을 해제했습니다.');
        return saved;
    };
    const quickAssignmentEditor = quickAssignment === 'vehicle'
        ? <CustomerVehicleAssignment key={reservation.id} value={readProductVehicle(reservation.adminOperations, reservation.contractData)} vehicles={registered?.vehicles || []} loading={registeredPending} resourceNotice={registeredNotice} onRetry={() => setRegisteredRevision(value => value + 1)} disabled={workspaceIsBusy()} onSave={saveQuickVehicle} onDirtyChange={setQuickAssignmentDirty} onClose={closeQuickAssignment} onSaved={() => { setQuickAssignmentDirty(false); setQuickAssignment(null); }} />
        : quickAssignment === 'stay' && workspace.nights <= 0 ? <section className="cw-quick-assignment" aria-label="숙소 바로 배정">
            <header><strong>일자별 숙소 바로 배정</strong><button type="button" className="cw-text-button" disabled={workspaceIsBusy()} onClick={closeQuickAssignment}>닫기</button></header>
            <p>{validAssignmentPeriod(reservation) ? '당일 투어는 숙소 배정이 필요하지 않습니다.' : '여행 시작일과 종료일을 먼저 확인해 주세요.'}</p>
        </section> : null;
    const overviewAction = (action: string, id?: string) => {
        if (workspaceIsBusy()) return;
        if (action === 'back') { closeWorkspace(); return; }
        if (quickAssignmentDirty) { setNavigationNotice('입력 중인 차량 정보를 먼저 저장하거나 차량 편집을 닫아 주세요.'); return; }
        if (fullPage && ['guide', 'stay', 'vehicle'].includes(action)) {
            if (reservation.status === 'cancelled') { setNavigationNotice('취소된 예약의 배정은 변경할 수 없습니다.'); return; }
            if (isEditing || inlineDirty || operationsDirty) { setNavigationNotice('작성 중인 주문·일정·운영 정보를 먼저 저장한 뒤 배정해 주세요.'); return; }
            setNavigationNotice('');
            setWorkflowOpen(false);
            if (action === 'guide') { setQuickAssignment(null); setPickerSaveError(''); setGuideConfirmation(null); setShowGuideModal(true); }
            else if (action === 'stay') {
                if (docDraftPending || memoDraft.trim()) { setNavigationNotice('작성 중인 문서 초안·메모를 먼저 저장한 뒤 숙소를 관리해 주세요.'); return; }
                const nextDay = Array.from({ length: Math.min(100, workspace.nights) }, (_, index) => index + 1).find(day => !reservation.dailyAccommodations?.some(stay => Number(stay.day) === day && stay.accommodation?.name?.trim())) || 1;
                workspaceNavigate(accommodationOpsHref('product', reservation.id, workspaceLocation.pathname + consumedCalendarWorkspaceSearch(workspaceLocation.search) + workspaceLocation.hash, nextDay));
                return true;
            } else setQuickAssignment('vehicle');
            return;
        }
        if (action === 'customer-link') { void copyCustomerMessage(workspace.published ? 'itinerary' : 'contract'); return; }
        if (action === 'send-itinerary') { void sendItineraryToCustomer(); return; }
        if (action === 'edit-itinerary') { const selectedDay = id ? overview.days.find(day => day.id === id)?.day : undefined; if (selectedDay) openInlineDocument('itinerary', selectedDay); else openInlineDocument('itinerary'); return; }
        if (action === 'contract') { openInlineDocument('contract'); return; }
        if (action === 'itinerary' || action === 'contract-preview') { if (canStartDelivery()) window.open(action === 'itinerary' ? itineraryPreviewUrl : contractUrl, '_blank', 'noopener,noreferrer'); return; }
        if (action === 'guide-pdf') { printGuideSheet(); return; }
        if (['view-info', 'customer-detail', 'flights', 'travelers'].includes(action)) {
            if (inlineDirty || docDraftPending || operationsDirty || isEditing && activeSec === 'pay') { setNavigationNotice('작성 중인 내용을 먼저 저장하거나 취소한 뒤 고객 정보를 확인해 주세요.'); return; }
            scrollToSec('info');
            if (!['view-info', 'customer-detail'].includes(action)) requestAnimationFrame(() => requestAnimationFrame(() => {
                const target = bodyRef.current?.querySelector(`#product-customer-${action}`);
                if (target && !target.closest('[hidden]')) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }));
            return;
        }
        if (action === 'documents') {
            if (inlineDirty || docDraftPending || operationsDirty || isEditing) { setNavigationNotice('작성 중인 내용을 먼저 저장하거나 취소한 뒤 문서를 확인하고 전달해 주세요.'); return; }
            setInlineEditorOpen(false);
            setActiveDocument(id?.includes('contract') ? 'contract' : 'itinerary');
            scrollToSec('docs');
            return;
        }
        if (action === 'edit-info') { if (inlineDirty || operationsDirty) { setNavigationNotice('작성 중인 문서·운영 정보를 먼저 저장해 주세요.'); return; } setIsEditing(true); scrollToSec('info'); return; }
        if ((action === 'guide' || action === 'stay') && isEditing) { setNavigationNotice('주문 정보 변경사항을 먼저 저장한 뒤 배정해 주세요.'); return; }
        const section = { payments: 'pay', assignments: 'assign', operations: 'ops', guide: 'assign', stay: 'assign', vehicle: 'ops', history: 'log', notes: 'log', documents: 'docs' }[action] as 'pay' | 'assign' | 'ops' | 'log' | 'docs' | undefined;
        if (section) scrollToSec(section);
    };
    calendarActionHandler.current = overviewAction;

    return (<>
        <div className={fullPage ? `product-customer-page${workflowOpen ? ' cw-is-working' : ''}` : 'drawer-scrim reservation-workspace-scrim'} onClick={fullPage ? undefined : closeWorkspace}>
            <div className={`drawer reservation-workspace product-workspace tcom${fullPage ? ' product-customer-fullpage' : ''}`} role={fullPage ? 'region' : 'dialog'} aria-modal={fullPage ? undefined : true} aria-label="상품 예약 상세 작업" onClick={e => e.stopPropagation()}>
                {navigationNotice && (!fullPage || !workflowOpen) && <div role="status" aria-live="polite" style={{ padding: '10px 16px', background: '#fff5e8', color: '#8f4c13', fontSize: 13 }}>{navigationNotice}</div>}
                {docDraftPending && (!fullPage || !workflowOpen) && <div role="status" style={{ padding: '10px 16px', background: '#edfaf6', color: '#145c4c', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><span>미저장 문서 초안이 있습니다. 일정 편집에서 복원·버리기를 선택한 뒤 저장하세요.</span><button type="button" className="btn btn-ghost btn-sm" disabled={workspaceIsBusy() || reservation.status === 'cancelled'} onClick={() => openInlineDocument('itinerary')}>초안 확인</button></div>}

                {fullPage && <>
                    <div id="product-customer-overview" hidden={workflowOpen}>
                    {resumeWorkLabel && <div className="cw-resume-work"><div><strong>{resumeWorkLabel} 내용이 저장되지 않았습니다.</strong><span>입력한 내용을 이어서 확인하고 저장하세요.</span></div><button type="button" className="btn btn-ink" disabled={workspaceIsBusy()} onClick={() => setWorkflowOpen(true)}>{resumeWorkLabel} 이어서 하기<Icon name="arrow_forward" /></button></div>}
                    <CustomerWorkspaceOverview model={overview} onAction={overviewAction} busy={workspaceIsBusy()} notificationActions={notificationActions} directAssignments assignmentEditor={quickAssignmentEditor} bookingSelector={bookingSelector && <fieldset className="product-customer-bookings" disabled={workspaceIsBusy()}>{bookingSelector}</fieldset>} noteComposer={<div className="product-customer-note"><textarea aria-label="고객 내부 메모" value={memoDraft} disabled={workspaceIsBusy()} onChange={e => setMemoDraft(e.target.value)} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void addMemo(); } }} rows={3} placeholder="고객 상담 내용을 기록하세요." /><button type="button" className="btn btn-ink btn-sm" disabled={workspaceIsBusy() || isEditing || operationsDirty || inlineDirty || quickAssignmentDirty || !memoDraft.trim()} onClick={() => void addMemo()}>메모 저장</button></div>} />

                    </div>
                </>}

                <div id="product-customer-detail" className={`product-customer-detail${fullPage ? ' cw-detail-workspace cw-focus-workspace' : ''}`} hidden={fullPage && !workflowOpen}>

                {/* Header */}
                <div className={`drawer-head${fullPage ? ' cw-detail-toolbar' : ''}`}>
                    {fullPage ? <><button type="button" className="btn btn-ghost cw-overview-back" disabled={workspaceIsBusy()} onClick={returnToCustomerOverview}><Icon name="arrow_back" />고객 현황</button><div className="cw-detail-identity"><h2>{reservation.customerName || '고객'} <span>{reservation.headcount}</span></h2><p>{reservation.productName} · {reservation.date}</p></div></> : <>
                    {productImage && (
                        <img src={productImage} alt={reservation.productName} loading="lazy"
                            style={{ width: 52, height: 52, flex: 'none', borderRadius: 12, objectFit: 'cover', border: '1px solid var(--mrt-gray-200, #E6E8EC)' }} />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="row" style={{ gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                            <span className={`tag-type ${reservation.type !== 'quote' ? 'reservation' : 'quote'}`}>
                                {reservation.type !== 'quote' ? '일반상품' : '맞춤견적'}
                            </span>
                            <span className="cell-mono" style={{ fontSize: 13 }}>#{(reservation as any).reservationNumber || reservation.id.slice(0, 8).toUpperCase()}</span>
                        </div>
                        <div className="page-title" style={{ fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{reservation.productName}</div>
                        <p className="rw-customer-line">{reservation.customerName} · {reservation.date} · {reservation.headcount}</p>
                    </div>
                    </>}
                    <StatusDropdown
                        status={editForm.status}
                        disabled={workspaceIsBusy()}
                        onChange={(s) => { if (workspaceIsBusy()) return; setEditForm({ ...editForm, status: s }); if (!isEditing) onUpdate({ ...editForm, status: s }); }}
                    />
                    {fullPage ? refreshControl : <button type="button" className="btn btn-sm btn-ghost" title={refreshHint} onClick={refreshWorkspace} disabled={workspaceIsBusy() || isEditing || operationsDirty || quickAssignmentDirty || !!memoDraft.trim()}><Icon name="refresh" />예약 정보 새로고침</button>}
                    {!fullPage && <button className="icon-btn" aria-label="예약 상세 닫기" style={{ width: 36, height: 36 }} onClick={closeWorkspace}><Icon name="close" /></button>}
                </div>

                <div className={`tc-anchors${fullPage ? ' cw-work-tabs' : ''}`} role={fullPage ? 'tablist' : undefined} aria-label="예약 상세 업무">
                    {workTabs.map(a => (
                        <button key={a.key} id={`customer-work-${a.key}`} type="button" role={fullPage ? 'tab' : undefined} aria-selected={fullPage ? tabIsSelected(a) : undefined} aria-controls={fullPage ? a.id === 'docs' ? 'customer-documents-panel' : a.id === 'ops' ? 'customer-operations-panel' : `sec-${a.id}` : undefined} tabIndex={fullPage && !tabIsSelected(a) ? -1 : undefined} disabled={workspaceIsBusy()} className={tabIsSelected(a) ? 'active' : ''} onClick={() => a.documentKind ? overviewAction('documents', a.documentKind) : scrollToSec(a.id)} onKeyDown={event => {
                            if (!fullPage || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                            event.preventDefault();
                            const index = workTabs.findIndex(item => item.key === a.key);
                            const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? workTabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + workTabs.length) % workTabs.length;
                            const target = workTabs[nextIndex];
                            document.getElementById(`customer-work-${target.key}`)?.focus();
                        }}>
                            {fullPage && <Icon name={a.icon} />}<span className="cw-work-tab-copy"><strong>{a.label}</strong>{fullPage && <small>{a.hint}</small>}</span>
                            {a.id === 'log' && memos.length > 0 && <span className="dtab-ct">{memos.length}</span>}
                        </button>
                    ))}
                </div>

                {fullPage && navigationNotice && <div className="cw-detail-notice" role="status" aria-live="polite">{navigationNotice}</div>}
                <div className="reservation-workspace-main">
                {/* Body */}
                <div className="drawer-body reservation-workspace-body" ref={bodyRef} inert={workspaceIsBusy()} aria-busy={workspaceIsBusy()}>
                    <div className="stack" style={{ gap: 18 }}>
                    {fullPage && !(detailSection === 'docs' && inlineEditorOpen) && <div className="cw-panel-heading"><div><h2>{workTabs.find(tabIsSelected)?.label || currentSection.label}</h2><p>{currentSection.hint}</p></div><span>{inlineDirty && detailSection === 'docs' || operationsDirty && detailSection === 'ops' || isEditing && (detailSection === 'info' || detailSection === 'pay') ? '저장하지 않은 변경사항' : '선택한 업무만 표시됩니다'}</span></div>}
                    {!fullPage && <ReservationWorkflow steps={steps} readiness={readiness} cancelled={workspace.cancelled} />}
                    <div id="customer-documents-panel" role={fullPage ? 'tabpanel' : undefined} aria-labelledby={fullPage ? activeDocument === 'contract' ? 'customer-work-contract' : 'customer-work-docs' : undefined} hidden={fullPage && detailSection !== 'docs'}>
                    <ReservationDocuments activeKind={fullPage ? activeDocument : undefined} days={scheduleDays} source={reservation.documentContent ? '고객별 작성 일정' : selectedTemplate?.name || (reservationProduct ? '예약 상품 일정' : '아직 작성된 일정이 없습니다')}
                        ready={itineraryReady} published={workspace.published} canPublish={itineraryCanPublish}
                        itinerarySent={itinerarySent} itinerarySentAt={itinerarySentAt} signed={workspace.signed}
                        contractSent={contractSent} contractSentAt={contractSentAt} travelerCount={workspace.travelerCount}
                        itineraryEmailSent={itineraryEmailSent} contractEmailSent={contractEmailSent}
                        itineraryChanged={itineraryEmailChanged} contractChanged={contractEmailChanged}
                        email={reservation.email} sending={sendingItinerary || sendingContract || sendingAllDocs || publishing || updating || inlineBusy} copied={copiedDocId}
                        templates={templatesList} templateId={editForm.itineraryTemplateId || ''} applyingTemplate={applyingTemplate}
                        onTemplate={applyDocumentTemplate} onEdit={openInlineDocument} onPublish={publishCustomerItinerary}
                        onPreview={(kind, print) => { if (canStartDelivery()) window.open(kind === 'itinerary' ? itineraryPreviewUrl + (print ? '&autoprint=1' : '') : contractUrl + (print ? '?autoprint=1' : ''), '_blank', 'noopener,noreferrer'); }}
                        onDraftPreview={kind => { if (inlineControlRef.current) inlineControlRef.current.preview(kind); else openInlineDocument(kind); }}
                        onSend={kind => kind === 'itinerary' ? sendItineraryToCustomer() : sendContractToCustomer()} onCopy={copyCustomerMessage}
                        onSendAll={sendReadyDocumentsToCustomer} onGuidePdf={printGuideSheet} disabled={workspace.cancelled || isEditing}
                        hasUnsavedChanges={inlineDirty || docDraftPending}
                        inlineEditor={inlineEditorOpen ? <ReservationInlineEditor key={`${user?.id || 'unverified'}:${reservation.id}`} adminUserId={userLoading ? null : user?.id || null} reservationId={reservation.id} initialContent={inlineSeed}
                            previewContext={{ customerName: reservation.customerName, reservationNumber, travelers: reservation.totalPeople, totalAmount: reservation.totalAmount, depositAmount: reservation.deposit, balanceAmount: reservation.balance }}
                            mode={activeDocument} onModeChange={setActiveDocument} startDate={reservation.startDate || ''} endDate={reservation.endDate || ''}
                            dailyAccommodations={reservation.dailyAccommodations} onSave={saveDocContent} onDirtyChange={setInlineDirty}
                            onBusyChange={setInlineBusy} onDraftStatusChange={setDocDraftPending} externalBusy={publishing || applyingTemplate || sendingItinerary || sendingContract || sendingAllDocs || updating}
                            externalActions={fullPage} onStatusChange={setInlineUiStatus} requestedDay={requestedDocumentDay} requestedDayRevision={documentFocusRevision}
                            onControlChange={control => { inlineControlRef.current = control; }}
                            onClose={closeInlineDocument} disabled={workspace.cancelled || updating || isEditing} /> : null} />
                    </div>
                    <div hidden={fullPage && detailSection !== 'log'}>
                    <AdminDeliveryHistory source="product" bookingId={reservation.id} revision={JSON.stringify([deliveryRevision, reservation.documentContent, reservation.startDate, reservation.endDate, reservation.totalPeople, reservation.totalAmount, reservation.deposit, reservation.balance, reservation.assignedGuide, reservation.dailyAccommodations, reservation.contractData, reservation.adminOperations, reservation.areAssignmentsVisibleToUser])}
                        busy={sendingItinerary || sendingContract || sendingAllDocs || updating || inlineBusy || publishing}
                        onData={data => setRecordedDelivery(data)} onOpenDocument={kind => {
                            scrollToSec('docs'); setActiveDocument(kind === 'contract' ? 'contract' : 'itinerary');
                        }} />
                    </div>
                    <section id="sec-info" role={fullPage ? 'tabpanel' : undefined} aria-labelledby={fullPage ? 'customer-work-info' : undefined} hidden={fullPage && detailSection !== 'info'} style={{ scrollMarginTop: 8 }}>
                        {/* 주문 정보 — 여행/예약자 */}
                        <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'stretch' }}>
                            <div className="card">
                                <div className="card-head"><Icon name="flight_takeoff" style={{ color: 'var(--mrt-gray-600)' }} /><h2>여행 정보</h2></div>
                                <div className="card-pad" style={{ paddingTop: 14 }}>
                                    <div className="kv"><span>여행 기간</span><b>{reservation.date}</b></div>
                                    <div className="kv">
                                        <span>인원</span>
                                        {isEditing ? (
                                            <span className="row" style={{ gap: 4 }}>
                                                <input
                                                    type="number"
                                                    value={editForm.totalPeople || ''}
                                                    onChange={(e) => setEditForm(prev => prev ? ({ ...prev, totalPeople: parseInt(e.target.value) || 0, headcount: `${e.target.value}명` }) : null)}
                                                    className="inp"
                                                    style={{ width: 72, height: 32 }}
                                                />
                                                <span className="cell-muted" style={{ fontSize: 12 }}>명</span>
                                            </span>
                                        ) : (
                                            <b>{reservation.headcount}</b>
                                        )}
                                    </div>
                                    <div className="kv"><span>접수일</span><b>{reservation.bookedAt}</b></div>
                                    <div className="kv" style={{ borderBottom: 'none' }}><span>상품</span><b style={{ textAlign: 'right', whiteSpace: 'normal' }}>{reservation.productName}</b></div>
                                </div>
                            </div>
                            <div className="card">
                                <div className="card-head"><Icon name="person" style={{ color: 'var(--mrt-gray-600)' }} /><h2>예약자 정보</h2></div>
                                <div className="card-pad" style={{ paddingTop: 14 }}>
                                    <div className="kv"><span>이름</span>{isEditing ? <input className="inp" aria-label="예약자 이름" value={editForm.customerName} onChange={e => setEditForm({ ...editForm, customerName: e.target.value })}/> : <b>{reservation.customerName}</b>}</div>
                                    <div className="kv"><span>연락처</span>{isEditing ? <input className="inp" type="tel" aria-label="예약자 연락처" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })}/> : <b style={{ fontVariantNumeric: 'tabular-nums' }}>{reservation.phone || '—'}</b>}</div>
                                    <div className="kv" style={{ borderBottom: 'none' }}><span>이메일</span>{isEditing ? <input className="inp" type="email" aria-label="예약자 이메일" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })}/> : <b style={{ textAlign: 'right' }}>{reservation.email || '—'}</b>}</div>
                                </div>
                            </div>
                        </div>

                        {/* 고객이 계약서에서 직접 작성·제출한 내용(여권·항공편·동의)을 이 페이지에 바로 표시 */}
                        {(fullPage || contractSubmitted) && (
                            <div className="card" style={{ marginTop: 14 }}>
                                <div className="card-head">
                                    <Icon name="assignment_ind" style={{ color: 'var(--mrt-gray-600)' }} />
                                    <h2>여행자·항공편 정보</h2>
                                    <div style={{ flex: 1 }} />
                                    <button type="button" className="btn btn-sm btn-ghost" style={{ flex: 'none' }} onClick={copyBookingText} title="여행자·항공편 정보를 텍스트로 복사 (카톡·메일에 붙여넣기)">
                                        <Icon name={copiedDocId === 'booking' ? 'check' : 'content_copy'} />{copiedDocId === 'booking' ? '복사됨' : '복사'}
                                    </button>
                                    <button type="button" className="btn btn-sm btn-blue" style={{ flex: 'none' }} onClick={printBookingSheet} title="숙소 수배 의뢰서를 PDF로 저장·인쇄">
                                        <Icon name="picture_as_pdf" />수배서 PDF
                                    </button>
                                    <button type="button" className="btn btn-sm btn-ink" style={{ flex: 'none' }} onClick={printGuideSheet} title="가이드용 안내서(확정 일정표·항공편·고객명·요청사항)를 PDF로 저장·인쇄">
                                        <Icon name="hiking" />가이드 PDF
                                    </button>
                                    <button type="button" className="btn btn-sm btn-ink" style={{ flex: 'none' }} onClick={downloadGuidePicket} title="고객명과 투어 기간이 자동 입력된 공항 미팅 피켓을 PNG로 다운로드">
                                        <Icon name="badge" />가이드 피켓
                                    </button>
                                    <button type="button" className="btn btn-sm btn-ghost" style={{ flex: 'none' }} onClick={downloadBookingSheetExcel} title="일차별 숙소 수배 정보를 Excel 파일로 다운로드">
                                        <Icon name="table_view" />수배서 Excel
                                    </button>
                                    {contractAgreement?.agreed
                                        ? <span className="badge b-green" style={{ flex: 'none' }}>동의 완료{contractAgreement.agreedAt ? ` · ${contractAgreement.agreedAt.split('T')[0]}` : ''}</span>
                                        : <span className="badge b-amber" style={{ flex: 'none' }}>미동의</span>}
                                </div>
                                <div className="card-pad" style={{ paddingTop: 14 }}>
                                    {!contractSubmitted && <div style={{ marginBottom: 16, padding: 16, background: '#f6f8fa', borderRadius: 12 }}><p style={{ fontSize: 13, color: '#6b7684', margin: '0 0 12px' }}>고객이 계약서에서 여행자와 항공편을 입력하면 이곳에 반영됩니다. 계약서 전달 후 고객 입력 내용을 확인해 주세요.</p><button type="button" className="btn btn-sm btn-ghost" disabled={workspaceIsBusy()} onClick={() => overviewAction('documents', 'contract')}>계약서 전달 관리</button></div>}
                                    {/* 항공편 — 픽업·샌딩 수배용, 가장 중요 */}
                                    <div id="product-customer-flights" className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14, scrollMarginTop: 20 }}>
                                        <div className="pay-cell">
                                            <div className="row" style={{ gap: 6, marginBottom: 6, color: 'var(--text-secondary)' }}>
                                                <Icon name="flight_land" /><span style={{ fontSize: 12.5, fontWeight: 700 }}>도착편 (몽골 도착)</span>
                                            </div>
                                            <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtFlightLine(editForm.contractData?.arrival)}</div>
                                        </div>
                                        <div className="pay-cell">
                                            <div className="row" style={{ gap: 6, marginBottom: 6, color: 'var(--text-secondary)' }}>
                                                <Icon name="flight_takeoff" /><span style={{ fontSize: 12.5, fontWeight: 700 }}>출발편 (몽골 출발)</span>
                                            </div>
                                            <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtFlightLine(editForm.contractData?.departure)}</div>
                                        </div>
                                    </div>

                                    {/* 여행자별 여권 정보 */}
                                    <div id="product-customer-travelers" style={{ scrollMarginTop: 20 }}>
                                    {!contractTravelers.length && <p style={{ padding: 16, margin: 0, borderRadius: 12, background: '#f6f8fa', color: '#6b7684', fontSize: 13 }}>등록된 여행자가 없습니다. 예약 인원 {reservation.totalPeople || '미정'}명과 고객 제출 내용을 확인해 주세요.</p>}
                                    {contractTravelers.map((t, i) => (
                                        <div key={i} style={{ paddingTop: i ? 10 : 0, marginTop: i ? 10 : 0, borderTop: i ? '1px solid var(--mrt-gray-100)' : 'none' }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>여행자 {i + 1}</div>
                                            <div className="kv"><span>여권 표기명</span><b style={{ textTransform: 'uppercase', textAlign: 'right' }}>{t.passportName || '—'}</b></div>
                                            <div className="kv"><span>이름</span><b style={{ textAlign: 'right' }}>{t.name || '—'}</b></div>
                                            <div className="kv"><span>생년월일 · 성별</span><b style={{ textAlign: 'right' }}>{[t.birthdate, t.gender].filter(Boolean).join(' · ') || '—'}</b></div>
                                            <div className="kv" style={{ borderBottom: 'none' }}><span>연락처</span><b style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t.phone || '—'}</b></div>
                                        </div>
                                    ))}
                                    </div>

                                    {contractAgreement?.agreed && (
                                        <div className="kv" style={{ borderBottom: 'none', borderTop: '1px solid var(--mrt-gray-100)', marginTop: 10, paddingTop: 10 }}>
                                            <span>전자 서명</span><b style={{ textAlign: 'right' }}>{contractAgreement.name || '—'}</b>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>

                    <div id="customer-operations-panel" role={fullPage ? 'tabpanel' : undefined} aria-labelledby={fullPage ? 'customer-work-ops' : undefined} hidden={fullPage && detailSection !== 'ops'}><ReservationOperations reservationId={reservation.id} value={{ ...(reservation.adminOperations || emptyReservationOperations()), vehicle: readProductVehicle(reservation.adminOperations, reservation.contractData).type, driverPhone: readProductVehicle(reservation.adminOperations, reservation.contractData).phone } as Operations} onSave={next => workspaceIsBusy() ? Promise.resolve(false) : onUpdate({ ...reservation, adminOperations: next }, true)} disabled={workspaceIsBusy() || isEditing} onDirtyChange={setOperationsDirty} externalActions={fullPage} formId={`reservation-operations-${reservation.id}`} onControlChange={control => { operationsControlRef.current = control; }} onStatusChange={setOperationsUiStatus}/></div>
                    <section id="sec-pay" role={fullPage ? 'tabpanel' : undefined} aria-labelledby={fullPage ? 'customer-work-pay' : undefined} hidden={fullPage && detailSection !== 'pay'} style={{ scrollMarginTop: 8 }}>
                    <div className="stack" style={{ gap: 14 }}>
                            {fullPage && <div className="cw-receipt-shortcut"><span>현금영수증 발급·정산 기록은 운영 정보에서 관리합니다.</span><button type="button" className="btn btn-sm btn-ghost" disabled={workspaceIsBusy() || isEditing} onClick={() => scrollToSec('ops')}>영수증 기록 관리<Icon name="chevron_right" /></button></div>}
                            {/* Payment with Progress Ring */}
                            <div className="card card-pad">
                                <div className="row" style={{ marginBottom: 16, gap: 16 }}>
                                    <div className="ring">
                                        <svg width="62" height="62" viewBox="0 0 62 62">
                                            <circle cx="31" cy="31" r="26" fill="none" stroke="var(--mrt-gray-100)" strokeWidth="6" />
                                            <circle cx="31" cy="31" r="26" fill="none" stroke="#0f766e" strokeWidth="6" strokeLinecap="round"
                                                strokeDasharray={2 * Math.PI * 26}
                                                strokeDashoffset={2 * Math.PI * 26 * (1 - paidPercent / 100)}
                                                transform="rotate(-90 31 31)"
                                                style={{ transition: 'stroke-dashoffset 500ms cubic-bezier(0.16, 1, 0.3, 1)' }}
                                            />
                                        </svg>
                                        <span className="ring-n">{paidPercent}<small>%</small></span>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div className="cell-muted" style={{ fontSize: 12.5 }}>
                                            {paidPercent >= 100 ? '완납 완료' : `잔액 ${won((editForm.totalAmount || 0) - paidAmount)}`}
                                        </div>
                                        <div className="row" style={{ gap: 6, marginTop: 2 }}>
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    aria-label="총 여행금액"
                                                    value={editForm.totalAmount}
                                                    onChange={(e) => setEditForm({ ...editForm, totalAmount: Number(e.target.value), balance: Number(e.target.value) - editForm.deposit })}
                                                    className="inp"
                                                    style={{ width: 140, height: 36 }}
                                                />
                                            ) : (
                                                <>
                                                    <span className="cell-price" style={{ fontSize: 22 }}>{won(paidAmount || 0)}</span>
                                                    <span className="cell-muted" style={{ fontSize: 12 }}>/ {won(editForm.totalAmount || 0)}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={toggleTotalStatus}
                                        className={`btn btn-sm ${editForm.status === 'paid' ? 'btn-blue' : 'btn-ghost'}`}
                                    >
                                        <Icon name="done_all" />
                                        {editForm.status === 'paid' ? '전액완납' : '완납 처리'}
                                    </button>
                                </div>
                                {/* Deposit + Balance cells */}
                                <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div className={`pay-cell${editForm.depositStatus === 'paid' ? ' paid' : ''}`}>
                                        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                                            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>예약금</span>
                                            <span className={`badge ${editForm.depositStatus === 'paid' ? 'b-green' : 'b-amber'}`}>
                                                {editForm.depositStatus === 'paid' ? '입금' : '미납'}
                                            </span>
                                        </div>
                                        {isEditing ? (
                                            <input
                                                type="number"
                                                aria-label="예약금 금액"
                                                value={editForm.deposit}
                                                onChange={(e) => setEditForm({ ...editForm, deposit: Number(e.target.value), balance: editForm.totalAmount - Number(e.target.value) })}
                                                className="inp"
                                                style={{ height: 36 }}
                                            />
                                        ) : (
                                            <div className="cell-price" style={{ fontSize: 16 }}>{won(editForm.deposit || 0)}</div>
                                        )}
                                        {/* 고객이 마이페이지에서 알린 입금 신고 — 입금 확인 전에는 강조, 확인 후에는 기록으로 남긴다 */}
                                        {editForm.type !== 'quote' && editForm.depositReport && (
                                            <div
                                                style={{
                                                    marginTop: 8, padding: '8px 10px', borderRadius: 8, fontSize: 12, lineHeight: 1.55,
                                                    background: hasOpenDepositReport(editForm) ? '#FFF3DC' : 'rgba(255,255,255,0.7)',
                                                    color: hasOpenDepositReport(editForm) ? '#8A5A10' : 'var(--text-secondary)',
                                                }}
                                            >
                                                <b>고객 입금 신고</b>: 입금자명 {editForm.depositReport.name || '—'}
                                                {formatReportTime(editForm.depositReport.reportedAt) ? ` · ${formatReportTime(editForm.depositReport.reportedAt)}` : ''}
                                            </div>
                                        )}
                                        {editForm.depositStatus !== 'paid' && (
                                            <button onClick={toggleDepositStatus} className="btn btn-sm btn-blue" style={{ width: '100%', marginTop: 10 }}>
                                                <Icon name="check" />입금 확인
                                            </button>
                                        )}
                                        {editForm.depositStatus === 'paid' && (
                                            <button onClick={toggleDepositStatus} className="btn btn-sm btn-ghost" style={{ width: '100%', marginTop: 10 }}>
                                                입금 취소
                                            </button>
                                        )}
                                    </div>
                                    <div className={`pay-cell${editForm.balanceStatus === 'paid' ? ' paid' : ''}`}>
                                        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                                            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>잔금</span>
                                            <span className={`badge ${editForm.balanceStatus === 'paid' ? 'b-green' : 'b-amber'}`}>
                                                {editForm.balanceStatus === 'paid' ? '입금' : '미납'}
                                            </span>
                                        </div>
                                        <div className="cell-price" style={{ fontSize: 16 }}>
                                            {won((editForm.totalAmount || 0) - (editForm.deposit || 0))}
                                        </div>
                                        {editForm.balanceStatus !== 'paid' && (
                                            <button onClick={toggleBalanceStatus} className="btn btn-sm btn-blue" style={{ width: '100%', marginTop: 10 }}>
                                                <Icon name="check" />입금 확인
                                            </button>
                                        )}
                                        {editForm.balanceStatus === 'paid' && (
                                            <button onClick={toggleBalanceStatus} className="btn btn-sm btn-ghost" style={{ width: '100%', marginTop: 10 }}>
                                                입금 취소
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {/* 예약금 미입금 예약: 고객에게 카카오톡으로 보낼 입금 안내문(계좌·금액·신고 방법) */}
                                {editForm.type !== 'quote' && editForm.depositStatus !== 'paid' && editForm.status !== 'cancelled' && (
                                    <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                                        <button type="button" className="btn btn-sm btn-ghost" style={{ flex: 'none' }} onClick={copyDepositGuide} title="예약번호·예약금·입금 계좌·입금 후 신고 방법을 담은 고객 안내문을 복사합니다">
                                            <Icon name="content_copy" />{copiedDocId === 'deposit-guide' ? '복사됨' : '입금 안내문 복사'}
                                        </button>
                                        <span className="cell-muted" style={{ fontSize: 12, minWidth: 0 }}>
                                            입금 계좌: {DEPOSIT_ACCOUNT.bank} {DEPOSIT_ACCOUNT.number} ({DEPOSIT_ACCOUNT.holder})
                                        </span>
                                    </div>
                                )}
                            </div>

                    </div>
                    </section>

                    <section id="sec-assign" role={fullPage ? 'tabpanel' : undefined} aria-labelledby={fullPage ? 'customer-work-assign' : undefined} hidden={fullPage && detailSection !== 'assign'} style={{ scrollMarginTop: 8 }}>
                    <div className="stack" style={{ gap: 14 }}>
                            {/* 담당 가이드 */}
                            <div className="card">
                                <div className="card-head">
                                    <Icon name="badge" style={{ color: 'var(--mrt-gray-600)' }} /><h2>담당 가이드</h2>
                                    <div className="spacer" style={{ flex: 1 }} />
                                    <button className="link-action" onClick={() => setShowGuideModal(true)}>
                                        {reservation.assignedGuide ? '변경' : '배정'}<Icon name="chevron_right" />
                                    </button>
                                </div>
                                <div className="card-pad" style={{ paddingTop: 12 }}>
                                    {reservation.assignedGuide ? (
                                        <div className="assign-row">
                                            {reservation.assignedGuide.image ? (
                                                <img className="avatar round" src={reservation.assignedGuide.image} alt={reservation.assignedGuide.name} />
                                            ) : (
                                                <span className="avatar round tint-blue">{getInitials(reservation.assignedGuide.name)}</span>
                                            )}
                                            <div style={{ minWidth: 0 }}>
                                                <div className="cell-strong">{reservation.assignedGuide.name}</div>
                                                <div className="cell-muted" style={{ fontSize: 12 }}>{reservation.assignedGuide.phone}</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="assign-empty" onClick={() => setShowGuideModal(true)}>
                                            <Icon name="person_add" />가이드를 배정하세요
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 일자별 숙소 배정 + 고객 알림 발송 */}
                            <div className="card">
                                <div className="card-head">
                                    <Icon name="hotel" style={{ color: 'var(--mrt-gray-600)' }} /><h2>일자별 숙소 배정</h2>
                                    <div className="spacer" style={{ flex: 1 }} />
                                    <a className="link-action" href={accommodationOpsHref('product', reservation.id, workspaceLocation.pathname + consumedCalendarWorkspaceSearch(workspaceLocation.search) + workspaceLocation.hash)} title="숙소 배정 보드에서 이 예약의 수배 상태·방·인실을 관리합니다.">
                                        <Icon name="night_shelter" />숙소 보드에서 수배 관리
                                    </a>
                                    <button
                                        className="link-action"
                                        onClick={async () => {
                                            if (!reservation.assignedGuide && (!reservation.dailyAccommodations || reservation.dailyAccommodations.length === 0)) {
                                                alert('배정된 가이드나 숙소가 없습니다.');
                                                return;
                                            }
                                            onUpdate({
                                                ...reservation,
                                                areAssignmentsVisibleToUser: true,
                                                history: [
                                                    ...(reservation.history || []),
                                                    { timestamp: new Date().toISOString(), type: 'modification', description: '담당 가이드·숙소 안내를 발송했습니다.' }
                                                ]
                                            });
                                            try {
                                                await sendNotificationEmail(reservation.email, 'GUIDE_ASSIGNED', {
                                                    customerName: reservation.customerName,
                                                    productName: reservation.productName,
                                                    guideName: reservation.assignedGuide?.name,
                                                    guidePhone: reservation.assignedGuide?.phone,
                                                    userId: reservation.userId,
                                                    reservationId: reservationNumber,
                                                    reservationDbId: reservation.id,
                                                });
                                            } catch (e) { console.error('GUIDE_ASSIGNED email failed', e); }
                                        }}
                                        title="가이드/숙소 확정 안내를 고객에게 이메일+사이트 알림으로 보냅니다."
                                    >
                                        <Icon name={reservation.areAssignmentsVisibleToUser ? 'mark_email_read' : 'send'} />
                                        {reservation.areAssignmentsVisibleToUser ? '알림 재발송' : '고객에게 알림 발송'}
                                    </button>
                                </div>
                                <div className="card-pad" style={{ paddingTop: 12 }}>
                                    <p className="cell-muted" style={{ fontSize: 11.5, marginBottom: 10, lineHeight: 1.5 }}>
                                        비워두면 <b>상품 일정의 기본 숙소</b>가 그대로 일정표에 적용됩니다. 실제 묵을 숙소를 확정하려면 날짜별로 「직접 지정」하세요.
                                    </p>
                                    <div className="stack" style={{ gap: 8 }}>
                                        {Array.from({ length: accomRowCount }, (_, i) => i + 1).map((day) => {
                                            const assigned = reservation.dailyAccommodations?.find(d => d.day === day);
                                            const overNights = day > stayNights; // 출발일 이후 — 숙박이 없어야 하는 일차
                                            return (
                                                <div className="accom-day" key={day}>
                                                    <span className="th-day" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                                                        <span>{day}일차</span>
                                                        {stayDateLabel(day) && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--mrt-gray-400)' }}>{stayDateLabel(day)} 밤</span>}
                                                    </span>
                                                    {assigned ? (
                                                        <div className="assign-row" style={{ flex: 1, padding: 0 }}>
                                                            {(assigned.accommodation.images && assigned.accommodation.images[0]) ? (
                                                                <img className="thumb" src={assigned.accommodation.images[0]} alt={assigned.accommodation.name} loading="lazy" />
                                                            ) : (
                                                                <span className="thumb" style={{ display: 'grid', placeItems: 'center', color: 'var(--mrt-gray-400)' }}><Icon name="hotel" /></span>
                                                            )}
                                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                                <div className="cell-strong">
                                                                    {assigned.accommodation.name}
                                                                    {overNights && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 999, background: '#FFECEC', color: '#D0342C' }}>박수 초과 · 출발일</span>}
                                                                </div>
                                                                <div className="cell-muted" style={{ fontSize: 12 }}>{assigned.accommodation.location || '—'}</div>
                                                                {(() => {
                                                                    // 보드에서 관리하는 수배 진행 상황을 상세에서도 보이게 (읽기 전용)
                                                                    const acc: any = assigned.accommodation;
                                                                    const bs = acc.bookingStatus ? BOOKING_STATUS_KO[String(acc.bookingStatus)] : undefined;
                                                                    const rooms = [acc.roomCount != null && acc.roomCount !== '' ? `방 ${acc.roomCount}` : '', acc.occupancy || ''].filter(Boolean).join(' · ');
                                                                    if (!bs && !rooms) return null;
                                                                    return (
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4, flexWrap: 'wrap' }}>
                                                                            {bs && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: bs.bg, color: bs.fg }}>{bs.label}</span>}
                                                                            {rooms && <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--mrt-gray-500)' }}>{rooms}</span>}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                            <button className="act-btn" title="변경" onClick={() => { setSelectedDay(day); setShowAccommodationModal(true); }}><Icon name="edit" /></button>
                                                            <button className="act-btn" title="배정 해제" onClick={() => handleAccommodationUnassign(day)}><Icon name="close" /></button>
                                                        </div>
                                                    ) : (() => {
                                                        if (overNights) return <div className="cell-muted" style={{ flex: 1, fontSize: 12, alignSelf: 'center' }}>출발일 — 숙박 없음</div>;
                                                        const def = defaultAccomForDay(day);
                                                        if (def?.name) {
                                                            return (
                                                                <div className="assign-row" style={{ flex: 1, padding: 0 }}>
                                                                    {def.images && def.images[0] ? (
                                                                        <img className="thumb" src={def.images[0]} alt={def.name} loading="lazy" style={{ opacity: 0.7 }} />
                                                                    ) : (
                                                                        <span className="thumb" style={{ display: 'grid', placeItems: 'center', color: 'var(--mrt-gray-400)' }}><Icon name="hotel" /></span>
                                                                    )}
                                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                                        <div className="cell-strong" style={{ color: 'var(--mrt-gray-500)' }}>
                                                                            {def.name}
                                                                            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: 'var(--mrt-gray-100)', color: 'var(--mrt-gray-500)' }}>상품 기본</span>
                                                                        </div>
                                                                        <div className="cell-muted" style={{ fontSize: 12 }}>{def.location || '일정표에 적용 중 · 비워두면 이대로 발송'}</div>
                                                                    </div>
                                                                    <button className="btn btn-sm btn-ghost" onClick={() => { setSelectedDay(day); setShowAccommodationModal(true); }}>
                                                                        <Icon name="edit" />직접 지정
                                                                    </button>
                                                                </div>
                                                            );
                                                        }
                                                        return (
                                                            <button className="accom-empty" onClick={() => { setSelectedDay(day); setShowAccommodationModal(true); }}>
                                                                <Icon name="add" />숙소 선택
                                                            </button>
                                                        );
                                                    })()}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                    </div>
                    </section>

                    <section id="sec-log" role={fullPage ? 'tabpanel' : undefined} aria-labelledby={fullPage ? 'customer-work-log' : undefined} hidden={fullPage && detailSection !== 'log'} style={{ scrollMarginTop: 8 }}>
                    <div className="stack" style={{ gap: 14 }}>
                            {/* Admin Memo */}
                            <div className="card">
                                <div className="card-head">
                                    <Icon name="sticky_note_2" style={{ color: 'var(--mrt-gray-600)' }} /><h2>관리자 메모</h2>
                                    <div className="spacer" style={{ flex: 1 }} />
                                    <span className="cell-muted" style={{ fontSize: 11.5 }}>고객 비공개 · 내부 전용</span>
                                </div>
                                <div className="card-pad" style={{ paddingTop: 12 }}>
                                    <div className="memo-box">
                                        <textarea
                                            value={memoDraft}
                                            onChange={e => setMemoDraft(e.target.value)}
                                            onFocus={() => setMemoFocused(true)}
                                            onBlur={() => setMemoFocused(false)}
                                            onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') addMemo(); }}
                                            placeholder="이 예약에 대한 메모를 남기세요. (예: 고객 특이사항, 파트너 연락 결과…)"
                                            rows={memoFocused || memoDraft ? 3 : 2}
                                        />
                                        <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
                                            <span className="cell-muted" style={{ fontSize: 11.5 }}>⌘ + Enter 로 저장</span>
                                            <button
                                                onClick={addMemo}
                                                disabled={!memoDraft.trim()}
                                                className={`btn btn-sm ${memoDraft.trim() ? 'btn-ink' : 'btn-soft'}`}
                                            >
                                                메모 추가
                                            </button>
                                        </div>
                                    </div>
                                    {memos.length > 0 && (
                                        <div className="stack" style={{ gap: 8, marginTop: 12 }}>
                                            {[...memos].reverse().map((m: any) => (
                                                <div className="memo-item" key={m.timestamp}>
                                                    <p>{m.description}</p>
                                                    <div className="row" style={{ gap: 6, marginTop: 6 }}>
                                                        <b style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Admin</b>
                                                        <span className="cell-muted" style={{ fontSize: 11 }}>· {new Date(m.timestamp).toLocaleString('ko-KR')}</span>
                                                        <div className="spacer" style={{ flex: 1 }} />
                                                        <button className="act-btn danger" style={{ width: 26, height: 26 }} onClick={() => deleteMemo(m.timestamp)} title="메모 삭제">
                                                            <Icon name="delete_outline" style={{ fontSize: 15 }} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* History Timeline */}
                            <div className="card">
                                <div className="card-head"><Icon name="history" style={{ color: 'var(--mrt-gray-600)' }} /><h2>처리 이력</h2></div>
                                {timelineEvents.length > 0 ? (
                                    <div style={{ padding: '8px 20px 16px' }}>
                                        {[...timelineEvents].reverse().map((e: any, i: number, arr: any[]) => (
                                            <div key={i} className="tl-row">
                                                <span className="tl-ico tint-blue"><Icon name={timelineIcon[e.type] || 'radio_button_checked'} /></span>
                                                {i < arr.length - 1 && <span className="tl-line" />}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div className="cell-strong" style={{ fontSize: 13, whiteSpace: 'normal' }}>{e.description}</div>
                                                    {e.detail && <div className="cell-muted" style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.detail}</div>}
                                                    <div className="cell-muted" style={{ fontSize: 11.5 }}>
                                                        {e.timestamp ? new Date(e.timestamp).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty"><Icon name="history" /><p>처리 이력이 없습니다.</p></div>
                                )}
                            </div>
                    </div>
                    </section>
                    </div>
                </div>

                {fullPage && <aside className="cw-work-context" aria-label="선택한 고객의 예약 요약">
                    <section className="cw-context-card">
                        <h3>예약 요약</h3>
                        <strong className="cw-context-customer">{reservation.customerName || '고객명 미입력'}</strong>
                        <p>{reservation.productName || '상품명 미입력'}</p>
                        <dl><div><dt>여행 기간</dt><dd>{reservation.date || '미등록'}</dd></div><div><dt>인원</dt><dd>{reservation.headcount || '미등록'}</dd></div><div><dt>팀 금액</dt><dd>{overview.payment.total === null ? '확인 필요' : won(overview.payment.total)}</dd></div><div><dt>계약 동의</dt><dd>{workspace.signed ? '고객 동의 완료' : '고객 동의 전'}</dd></div><div><dt>일정표</dt><dd>{workspace.published ? '고객 공개됨' : '고객 공개 전'}</dd></div></dl>
                    </section>
                    <section className="cw-context-card">
                        <h3>업무 진행</h3>
                        <ol>{overview.steps.map((step, index) => <li key={step.id} className={step.done ? 'is-done' : step.current ? 'is-current' : ''}><span aria-hidden="true">{step.done ? '✓' : index + 1}</span><div><strong>{step.label}</strong><small>{step.done ? '완료' : step.current ? '진행 중' : '대기'}</small></div></li>)}</ol>
                    </section>
                </aside>}
                </div>

                {/* Footer */}
                <div className="drawer-foot">
                    {fullPage ? <>
                        <div className="cw-action-status" role={(inlineUiStatus.failed && detailSection === 'docs' && inlineEditorOpen) || (detailSection === 'ops' && operationsUiStatus.failed) ? 'alert' : 'status'}><strong>{detailSection === 'docs' && inlineEditorOpen ? activeDocument === 'contract' ? '계약서 편집' : '일정표 편집' : currentSection.label}</strong><span>{detailSection === 'docs' && inlineEditorOpen ? inlineUiStatus.message : detailSection === 'ops' ? operationsUiStatus.message : isEditing ? '변경사항을 저장하거나 취소할 수 있습니다.' : '고객 현황으로 돌아가도 현재 작업은 유지됩니다.'}</span></div>
                        <div className="cw-action-buttons">
                            {isEditing ? <><button type="button" className="btn btn-ghost" disabled={workspaceIsBusy()} onClick={handleCancel}>취소</button><button type="button" className="btn btn-ink" disabled={workspaceIsBusy()} onClick={handleSave}><Icon name="save" />{updating ? '저장 중…' : detailSection === 'pay' ? '결제 금액 저장' : '주문자 정보 저장'}</button></>
                                : detailSection === 'docs' && inlineEditorOpen ? <>
                                    <button type="button" className="btn btn-ghost" disabled={workspaceIsBusy() || inlineUiStatus.locked} onClick={() => inlineControlRef.current?.preview(activeDocument)}><Icon name="visibility" />미리보기</button>
                                    <button type="button" className="btn btn-ghost" disabled={workspaceIsBusy() || inlineUiStatus.locked || inlineDirty || docDraftPending} title={inlineDirty || docDraftPending ? '변경사항을 저장한 뒤 문서를 확인하고 전달할 수 있습니다.' : undefined} onClick={closeInlineDocument}>문서 확인·전달<Icon name="arrow_forward" /></button>
                                    <button type="submit" form={`reservation-inline-${reservation.id}`} className="btn btn-ink" disabled={workspaceIsBusy() || inlineUiStatus.locked || workspace.cancelled}><Icon name="save" />{workspaceIsBusy() ? '저장 중…' : activeDocument === 'contract' ? '계약서 저장' : '일정 저장'}</button>
                                </> : detailSection === 'docs' ? <><button type="button" className="btn btn-ghost" disabled={workspaceIsBusy() || workspace.cancelled} onClick={() => openInlineDocument('contract')}>계약서 편집</button><button type="button" className="btn btn-ink" disabled={workspaceIsBusy() || workspace.cancelled} onClick={() => openInlineDocument('itinerary')}><Icon name="edit" />일정표 편집</button></>
                                    : detailSection === 'ops' ? <><button type="button" className="btn btn-ghost" disabled={workspaceIsBusy() || !operationsUiStatus.dirty} onClick={() => operationsControlRef.current?.cancel()}>변경 취소</button><button type="submit" className="btn btn-ink" form={`reservation-operations-${reservation.id}`} disabled={workspaceIsBusy() || !operationsUiStatus.dirty}><Icon name="save" />{operationsUiStatus.busy ? '저장 중…' : '운영 정보 저장'}</button></>
                                        : detailSection === 'info' || detailSection === 'pay' ? <button type="button" className="btn btn-ink" disabled={workspaceIsBusy()} onClick={() => setIsEditing(true)}><Icon name="edit" />{detailSection === 'pay' ? '결제 금액 수정' : '주문자 정보 수정'}</button> : null}
                        </div>
                    </> : isEditing ? (
                        <>
                            <button onClick={handleCancel} className="btn btn-ghost" disabled={workspaceIsBusy()}>취소</button>
                            <div className="spacer" style={{ flex: 1 }} />
                            <button onClick={handleSave} className="btn btn-ink" disabled={workspaceIsBusy()}><Icon name="check" />{updating ? '저장 중…' : '저장'}</button>
                        </>
                    ) : (
                        <>
                            <button onClick={closeWorkspace} className="btn btn-ghost" disabled={workspaceIsBusy()}>예약 목록으로</button>
                            <div className="spacer" style={{ flex: 1 }} />
                            {inlineEditorOpen && (!fullPage || detailSection === 'docs') ? <button type="submit" form={`reservation-inline-${reservation.id}`} className="btn btn-ink" disabled={workspaceIsBusy() || workspace.cancelled}><Icon name="save" />{workspaceIsBusy() ? '처리 중…' : '문서 저장'}</button>
                                : !fullPage || detailSection === 'info' || detailSection === 'pay' ? <button onClick={() => setIsEditing(true)} className="btn btn-ink" disabled={workspaceIsBusy()}><Icon name="edit" />{fullPage ? detailSection === 'pay' ? '결제 금액 수정' : '주문자 정보 수정' : '수정'}</button>
                                : fullPage && detailSection === 'docs' ? <button type="button" onClick={() => openInlineDocument('itinerary')} className="btn btn-ink" disabled={workspaceIsBusy() || workspace.cancelled}><Icon name="edit" />일정표 편집</button> : null}
                        </>
                    )}
                </div>

                {copiedDocId === 'final-message' && (
                    <div className="drawer-toast"><Icon name="check_circle" fill />고객 안내문이 복사되었습니다</div>
                )}
                </div>
            </div>
        </div>

        {/* Guide Selection Modal */}
        {showGuideModal && (
            <div className="picker-scrim" onClick={() => { if (!workspaceIsBusy()) setShowGuideModal(false); }}>
                <div className="picker crp-picker" role="dialog" aria-modal="true" aria-label="등록된 가이드 선택" onClick={e => e.stopPropagation()}>
                    <div className="card-head">
                        <div><h2>등록 가이드 선택</h2><span className="crp-current">현재 배정 · {reservation.assignedGuide?.name || '미배정'}</span></div>
                        <div className="spacer" style={{ flex: 1 }} />
                        <button className="icon-btn" aria-label="가이드 선택 닫기" disabled={workspaceIsBusy()} style={{ width: 34, height: 34 }} onClick={() => setShowGuideModal(false)}><Icon name="close" /></button>
                    </div>
                    <div className="crp-search"><input className="inp" aria-label="가이드 이름·연락처 검색" placeholder="이름·연락처·언어로 가이드 찾기" value={guideSearch} onChange={e => setGuideSearch(e.target.value)} /><div className="crp-results-caption"><span>가이드 {visibleGuides.length}명</span><small>이름을 누르면 배정이 저장됩니다.</small></div><p role="status" className="cell-muted">{registeredPending ? '등록된 가이드 목록을 불러오는 중입니다…' : resourceLoading ? '최신 배정 일정을 확인하고 있습니다…' : resourceNotice || '기간이 겹치는 가이드는 확인 후 배정할 수 있습니다.'}</p></div>
                    {registeredNotice && <div className="product-customer-warning" role="status">{registeredNotice}<button type="button" className="cw-text-button" disabled={registeredLoading} onClick={() => setRegisteredRevision(value => value + 1)}>자원 목록 다시 불러오기</button></div>}
                    {guideConfirmation && <div className="product-customer-warning" role="alert"><strong>{guideConfirmation.guide.name} 배정 확인</strong><p style={{ whiteSpace: 'pre-line' }}>{guideConfirmation.message}</p><div className="row" style={{ gap: 8 }}><button type="button" className="btn btn-sm btn-ink" disabled={workspaceIsBusy() || registeredLoading || resourceLoading} onClick={() => void handleGuideAssign(guideConfirmation.guide, true)}>일정 확인 후 배정</button><button type="button" className="btn btn-sm btn-ghost" disabled={workspaceIsBusy()} onClick={() => setGuideConfirmation(null)}>취소</button></div></div>}
                    {pickerSaveError && <div className="product-customer-warning" role="alert">{pickerSaveError}</div>}
                    <div className="picker-list">
                        {visibleGuides.length === 0 ? (
                            <div className="empty"><Icon name="person_off" /><p>{registeredPending ? '등록 가이드를 불러오고 있습니다…' : '조건에 맞는 가이드가 없습니다'}</p>{guideSearch && <button type="button" className="cw-text-button" onClick={() => setGuideSearch('')}>검색어 지우기</button>}</div>
                        ) : visibleGuides.map((guide: any) => (
                            <button
                                key={guide.id}
                                className={`picker-item${isCurrentGuide(guide) ? ' is-current' : ''}`}
                                aria-label={`${guide.name} ${isCurrentGuide(guide) ? '현재 배정 · 다시 선택' : '가이드 배정'}`}
                                disabled={workspaceIsBusy() || resourceLoading || registeredPending}
                                onClick={() => { void handleGuideAssign(guide); }}
                            >
                                {guide.image ? (
                                    <img className="avatar round" src={guide.image} alt={guide.name} />
                                ) : (
                                    <span className="avatar round tint-blue"><Icon name="person" /></span>
                                )}
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div className="cell-strong">{guide.name}{isCurrentGuide(guide) && <span className="crp-current-badge">현재 배정</span>}{guide._fromResources && <span className="badge b-green" style={{ marginLeft: 6, fontSize: 10 }}>배정 자원</span>}</div>
                                    {!!guideConflicts(guide).length && <div className="badge b-amber">같은 기간 배정 {guideConflicts(guide).length}건</div>}
                                    <div className="cell-muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{guide.phone}</div>
                                    {(guide.introduction || guide.bio) && <div className="crp-introduction">{guide.introduction || guide.bio}</div>}
                                    {!!guideLanguages(guide.languages).length && (
                                        <div className="row" style={{ gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                                            {guideLanguages(guide.languages).map((l: string) => (
                                                <span key={l} className="badge b-blue" style={{ fontSize: 10, padding: '1px 7px' }}>{l}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <span className="crp-pick-action">{isCurrentGuide(guide) ? '선택됨' : '배정'}<Icon name={isCurrentGuide(guide) ? 'check' : 'add'} /></span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* Accommodation Selection Modal */}
        {showAccommodationModal && (
            <div className="picker-scrim" onClick={() => { if (!workspaceIsBusy()) setShowAccommodationModal(false); }}>
                <div className="picker crp-picker" role="dialog" aria-modal="true" aria-label={`${selectedDay}일차 등록된 숙소 선택`} onClick={e => e.stopPropagation()}>
                    <div className="card-head">
                        <div><h2>{selectedDay}일차 등록 숙소 선택</h2><span className="crp-current">현재 배정 · {selectedAccommodation?.name || '미배정'}</span></div>
                        <div className="spacer" style={{ flex: 1 }} />
                        <button className="icon-btn" aria-label="숙소 선택 닫기" disabled={workspaceIsBusy()} style={{ width: 34, height: 34 }} onClick={() => setShowAccommodationModal(false)}><Icon name="close" /></button>
                    </div>
                    {workspace.nights > 1 && <div className="crp-day-tabs" aria-label="숙소 배정 일차 선택">{Array.from({ length: Math.min(100, workspace.nights) }, (_, index) => {
                        const day = index + 1, stay = reservation.dailyAccommodations?.find(item => Number(item.day) === day)?.accommodation;
                        return <button type="button" key={day} aria-pressed={selectedDay === day} disabled={workspaceIsBusy()} onClick={() => { setSelectedDay(day); setPickerSaveError(''); }}><strong>{day}일차</strong><small>{stay?.name || '미배정 · 숙소 선택'}</small></button>;
                    })}</div>}
                    <div className="crp-search"><div className="crp-search-filters"><input className="inp" aria-label="숙소 이름·지역 검색" placeholder="이름·지역으로 숙소 찾기" value={accommodationSearch} onChange={e => setAccommodationSearch(e.target.value)}/><select className="inp" aria-label="숙소 지역" value={accommodationRegion} onChange={e => setAccommodationRegion(e.target.value)}><option value="">전체 지역</option>{accommodationRegions.map(region => <option key={region} value={region}>{region}</option>)}</select></div><div className="crp-results-caption"><span>숙소 {visibleAccommodations.length}곳</span><small>선택하면 {selectedDay}일차에 저장됩니다.</small></div></div>
                    {(registeredLoading || registeredNotice) && <div className="product-customer-warning" role="status">{registeredLoading ? '등록된 숙소 목록을 불러오는 중입니다…' : registeredNotice}{!registeredLoading && <button type="button" className="cw-text-button" onClick={() => setRegisteredRevision(value => value + 1)}>자원 목록 다시 불러오기</button>}</div>}
                    {pickerSaveError && <div className="product-customer-warning" role="alert">{pickerSaveError}</div>}
                    <div className="picker-list">
                        {visibleAccommodations.length === 0 ? (
                            <div className="empty"><Icon name="hotel" /><p>{registeredPending ? '등록 숙소를 불러오고 있습니다…' : '조건에 맞는 숙소가 없습니다'}</p>{(accommodationSearch || accommodationRegion) && <button type="button" className="cw-text-button" onClick={() => { setAccommodationSearch(''); setAccommodationRegion(''); }}>검색 조건 지우기</button>}</div>
                        ) : visibleAccommodations.map((acc: any) => (
                            <button
                                key={acc.id}
                                className={`picker-item${isCurrentAccommodation(acc) ? ' is-current' : ''}`}
                                aria-label={`${selectedDay}일차 ${acc.name} ${isCurrentAccommodation(acc) ? '현재 배정 · 다시 선택' : '숙소 배정'}`}
                                disabled={workspaceIsBusy() || registeredPending}
                                onClick={() => { void handleAccommodationAssign(acc); }}
                            >
                                {acc._thumb ? (
                                    <img className="thumb sq" src={acc._thumb} alt={acc.name} loading="lazy" />
                                ) : (
                                    <span className="thumb sq" style={{ display: 'grid', placeItems: 'center', color: 'var(--mrt-gray-400)' }}><Icon name="hotel" /></span>
                                )}
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div className="cell-strong">
                                        {acc.name}
                                        {isCurrentAccommodation(acc) && <span className="crp-current-badge">현재 배정</span>}
                                        {acc._fromResources && <span className="badge b-green" style={{ marginLeft: 6, fontSize: 10 }}>공통 등록 숙소</span>}
                                    </div>
                                    {acc.type && <div className="cell-muted" style={{ fontSize: 12 }}>{acc.type}</div>}
                                    {acc.location && <div className="cell-muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.location}</div>}
                                </div>
                                <span className="crp-pick-action">{isCurrentAccommodation(acc) ? '선택됨' : `${selectedDay}일차 배정`}<Icon name={isCurrentAccommodation(acc) ? 'check' : 'add'} /></span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

    </>);
};

export const AdminReservationManage: React.FC<{ customerPage?: boolean; customerSource?: 'product' | 'quote' }> = ({ customerPage = false, customerSource = 'product' }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id: customerReservationId = '' } = useParams<{ id: string }>();
    const { user, loading: userLoading } = useUser();
    const customerScope = `${userLoading ? 'loading' : user?.id || 'anonymous'}:${user?.role || ''}:${customerSource}:${customerReservationId}`;
    const currentScope = useRef(customerScope); currentScope.current = customerScope;
    const fetchSequence = useRef(0);
    const [loadedCustomerScope, setLoadedCustomerScope] = useState('');
    const [customerLoadError, setCustomerLoadError] = useState('');
    const [customerSync, setCustomerSync] = useState<{ scope: string; at?: string; error?: string }>({ scope: '' });
    const [sameBookings, setSameBookings] = useState<{ scope: string; items: Array<{ id: string; label: string }>; warning: string }>({ scope: '', items: [], warning: '' });
    const returnTo = customerWorkspaceReturnTo(new URLSearchParams(location.search).get('returnTo'));
    const [isLoading, setIsLoading] = useState(false);
    const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
    const [sortOrder, setSortOrder] = useState(() => readReservationList(window.location.search).sortOrder);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
    const [updatingCount, setUpdatingCount] = useState(0);
    useEffect(() => { setUpdatingCount(0); }, [customerScope]);

    // Filter States
    const [searchTerm, setSearchTerm] = useState(() => readReservationList(window.location.search).searchTerm);
    const [filterStatus, setFilterStatus] = useState(() => readReservationList(window.location.search).filterStatus);
    const [filterPayment, setFilterPayment] = useState(() => readReservationList(window.location.search).filterPayment);
    const [filterType, setFilterType] = useState(() => readReservationList(window.location.search).filterType);
    const [filterDeparture, setFilterDeparture] = useState(() => readReservationList(window.location.search).filterDeparture);
    const [filterSource, setFilterSource] = useState(() => readReservationList(window.location.search).filterSource);
    const [convertTarget, setConvertTarget] = useState<QuoteRequest | null>(null);
    // 수동 예약 추가(카카오톡·메일 등 사이트 외 주문)
    const [showAddModal, setShowAddModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [addForm, setAddForm] = useState({ ...BLANK_ADD });

    // Pagination State
    const [currentPage, setCurrentPage] = useState(() => readReservationList(window.location.search).currentPage);
    const [loadedOnce, setLoadedOnce] = useState(false);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());
    const [exportMode, setExportMode] = useState<'filtered' | 'selected' | 'confirmed'>('filtered');
    const itemsPerPage = 8;

    // Reservations State
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [products, setProducts] = useState<ProductSummary[]>([]);
    useEffect(() => {
        if (!customerPage || customerSource !== 'product' || userLoading || user?.role !== 'admin' || loadedCustomerScope !== customerScope || !selectedReservation?.userId) return;
        let cancelled = false;
        const scope = customerScope, customerUserId = selectedReservation.userId;
        const currentBooking = { id: selectedReservation.id, label: [selectedReservation.reservationNumber || selectedReservation.id, selectedReservation.productName, selectedReservation.date, selectedReservation.headcount].filter(Boolean).join(' · ') };
        api.reservations.list().then(rows => {
            if (!cancelled && currentScope.current === scope) {
                const items = sameAccountProductBookings(Array.isArray(rows) ? rows : [], customerUserId);
                if (!items.some(item => item.id === currentBooking.id)) items.unshift(currentBooking);
                setSameBookings({ scope, items, warning: '' });
            }
        }).catch(() => {
            if (!cancelled && currentScope.current === scope) setSameBookings({ scope, items: [], warning: '같은 계정의 다른 예약을 확인하지 못했습니다. 현재 예약은 계속 관리할 수 있습니다.' });
        });
        return () => { cancelled = true; };
    }, [customerPage, customerSource, customerScope, loadedCustomerScope, selectedReservation?.userId, userLoading, user?.role]);
    useEffect(() => { if (!loadedOnce || isLoading) return;
        const valid = new Set(reservations.map(reservationSelectionKey));
        setSelectedRows(prev => { const next = new Set([...prev].filter(key => valid.has(key))); return next.size === prev.size ? prev : next; });
    }, [reservations, loadedOnce, isLoading]);

    useEffect(() => {
        if (customerPage) return;
        // Replace this list's URL without creating one browser-history entry per keystroke.
        const search = reservationListSearch({ searchTerm, filterStatus, filterPayment, filterType, filterDeparture, filterSource, sortOrder, currentPage }, window.location.search);
        if (search !== window.location.search) window.history.replaceState(window.history.state, '', window.location.pathname + search + window.location.hash);
    }, [customerPage, searchTerm, filterStatus, filterPayment, filterType, filterDeparture, filterSource, sortOrder, currentPage]);
    useEffect(() => {
        if (customerPage) return;
        const restore = () => { const state = readReservationList(window.location.search);
            setSearchTerm(state.searchTerm); setFilterStatus(state.filterStatus); setFilterPayment(state.filterPayment); setFilterType(state.filterType);
            setFilterDeparture(state.filterDeparture); setFilterSource(state.filterSource); setSortOrder(state.sortOrder); setCurrentPage(state.currentPage);
        };
        window.addEventListener('popstate', restore); return () => window.removeEventListener('popstate', restore);
    }, [customerPage]);

    const toTime = (value: any) => {
        if (!value) return 0;
        const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateOnly) {
            const [, year, month, day] = dateOnly;
            return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
        }
        const time = new Date(value).getTime();
        return Number.isNaN(time) ? 0 : time;
    };

    const fetchReservations = async () => {
        if (customerPage) {
            const scope = customerScope, sequence = ++fetchSequence.current;
            const active = () => currentScope.current === scope && fetchSequence.current === sequence;
            if (userLoading || user?.role !== 'admin' || !customerReservationId) { setReservations([]); setSelectedReservation(null); setProducts([]); setLoadedCustomerScope(''); setCustomerSync({ scope: '' }); setIsLoading(false); return; }
            const hasCurrentRecord = loadedCustomerScope === scope && selectedReservation?.id === customerReservationId;
            setIsLoading(true); setCustomerLoadError('');
            setCustomerSync(previous => previous.scope === scope ? { ...previous, error: undefined } : { scope });
            try {
                const [result, productResult] = await Promise.allSettled([
                    customerSource === 'quote' ? api.quotes.get(customerReservationId) : api.reservations.get(customerReservationId),
                    customerSource === 'product' ? api.products.list() : Promise.resolve([]),
                ]);
                if (!active()) return;
                if (result.status === 'rejected') throw result.reason;
                if (!result.value || String(result.value.id) !== customerReservationId) throw Object.assign(new Error('선택한 고객의 예약을 찾지 못했습니다.'), { status: 404 });
                const row = customerSource === 'quote' ? legacyWorkspaceReservation(result.value) : productWorkspaceReservation(result.value);
                setProducts(productResult.status === 'fulfilled' && Array.isArray(productResult.value) ? productResult.value.map((p: any) => ({
                    id: p.id, name: p.name, category: p.category, thumbnail: p.thumbnail, mainImages: p.mainImages ?? p.main_images,
                    itineraryBlocks: p.itineraryBlocks ?? p.itinerary_blocks, itineraryImages: p.itineraryImages ?? p.itinerary_images, documentProduct: p,
                })) : hasCurrentRecord ? products : []);
                setLoadWarnings(productResult.status === 'rejected' ? ['상품 원본 정보를 불러오지 못했습니다. 저장된 고객 문서는 그대로 확인할 수 있습니다.'] : []);
                setReservations([row]); setSelectedReservation(row); setLoadedCustomerScope(scope);
                setCustomerSync({ scope, at: new Date().toISOString() });
            } catch (error: any) {
                if (!active()) return;
                if (hasCurrentRecord && ![401, 403, 404].includes(error?.status)) {
                    setCustomerSync(previous => ({ scope, at: previous.scope === scope ? previous.at : undefined, error: '새로고침에 실패해 이전에 불러온 정보를 표시합니다. 예약 정보 새로고침을 다시 눌러 주세요.' }));
                } else {
                    setReservations([]); setSelectedReservation(null); setProducts([]); setLoadedCustomerScope(scope);
                    setCustomerSync({ scope });
                    setCustomerLoadError(error?.status === 404 ? '선택한 예약 또는 견적 문의가 없습니다. 삭제되었거나 주소가 변경되었을 수 있습니다.' : error?.status === 401 ? '관리자 로그인이 만료되었습니다. 다시 로그인해 주세요.' : error?.status === 403 ? '이 고객 정보를 조회할 관리자 권한이 없습니다.' : '고객 정보를 불러오지 못했습니다. 다시 시도해 주세요.');
                }
            } finally { if (active()) { setIsLoading(false); setLoadedOnce(true); } }
            return;
        }
        setIsLoading(true);
        try {

            // Fetch reservations and quotes independently so one failure doesn't block the other
            const [resSettled, quoteSettled, productSettled, bookingSettled] = await Promise.allSettled([
                api.reservations.list(),
                api.quotes.list(),
                api.products.list(),
                api.adminBookings.quote(),
            ]);
            const resData = resSettled.status === 'fulfilled' ? resSettled.value : null;
            const quoteData = quoteSettled.status === 'fulfilled' ? quoteSettled.value : null;
            const productData = productSettled.status === 'fulfilled' ? productSettled.value : null;
            if (quoteSettled.status === 'rejected') console.error('[Admin] quotes fetch failed:', quoteSettled.reason);
            if (resSettled.status === 'rejected') console.error('[Admin] reservations fetch failed:', resSettled.reason);
            if (productSettled.status === 'rejected') console.error('[Admin] products fetch failed:', productSettled.reason);
            if (Array.isArray(productData)) {
                setProducts(productData.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    category: p.category,
                    thumbnail: p.thumbnail,
                    mainImages: p.mainImages ?? p.main_images,
                    itineraryBlocks: p.itineraryBlocks ?? p.itinerary_blocks,
                    itineraryImages: p.itineraryImages ?? p.itinerary_images,
                    documentProduct: p,
                    hasItinerary: [p.itineraryBlocks ?? p.itinerary_blocks, p.itineraryImages ?? p.itinerary_images].some(value => {
                        try { return (typeof value === 'string' ? JSON.parse(value) : value)?.length > 0; } catch { return false; }
                    }),
                })));
            }

            const warnings: string[] = [];
            if (resSettled.status === 'rejected') warnings.push('상품 예약을 불러오지 못했습니다. 이전 목록을 표시합니다.');
            if (quoteSettled.status === 'rejected') warnings.push('이전 견적 문의를 불러오지 못했습니다. 이전 목록을 표시합니다.');
            if (bookingSettled.status === 'rejected') warnings.push('견적 예약을 불러오지 못했습니다. 이전 목록을 표시합니다.');
            else if (bookingSettled.value.skipped) warnings.push(`견적 데이터 ${bookingSettled.value.skipped}건을 읽지 못했습니다. 원본 확인이 필요합니다.`);
            if (productSettled.status === 'rejected') warnings.push('상품 정보를 불러오지 못했습니다.');
            setLoadWarnings(warnings);
            const allItems: Reservation[] = [];
            if (bookingSettled.status === 'fulfilled') {
                allItems.push(...bookingSettled.value.items.map((b): Reservation => ({
                    ...b, status: b.status as Reservation['status'],
                    date: b.startDate ? `${b.startDate} ~ ${b.endDate || ''}` : '날짜 미정',
                    bookedAt: b.createdAt ? new Date(b.createdAt).toLocaleDateString('ko-KR') : '',
                    bookedAtMs: toTime(b.createdAt), departureMs: toTime(b.startDate),
                })));
            }

            // Map Reservations
            if (resData) {
                const mappedReservations: Reservation[] = resData.map((r: any) => {
                    // start_date/end_date는 "YYYY-MM-DD"와 ISO 타임스탬프가 섞여 저장돼 있다.
                    // ISO 값을 그대로 자르면 출발일이 하루 앞당겨 보이므로 여기서 한 번에 정규화한다.
                    const startDate = toTourDateKey(r.startDate || r.start_date);
                    const endDate = toTourDateKey(r.endDate || r.end_date);
                    const createdAt = r.createdAt || r.created_at;
                    const travelers = r.travelers || r.totalPeople || r.total_people || 0;
                    const totalAmount = Number(r.totalPrice ?? r.total_price ?? r.total_amount ?? r.price_breakdown?.total ?? r.totalAmount ?? 0);
                    const depositAmt = Number(r.depositAmount ?? r.deposit_amount ?? r.price_breakdown?.deposit ?? r.deposit ?? 0);
                    return {
                    id: r.id,
                    reservationNumber: r.reservationNumber || r.reservation_number || null,
                    type: 'product', // 사이트의 type=tour도 상품 예약으로 표시
                    productName: r.productName || r.product_name,
                    productId: r.productId || r.product_id,
                    customerName: r.customerName || r.customer_name || r.customer_info?.name || 'Unknown',
                    notes: typeof r.notes === 'string' ? r.notes : '',
                    country: r.country || r.customerCountry || r.customer_country || r.customer_info?.country || '한국',
                    startDate,
                    endDate,
                    departureMs: toTime(startDate),
                    date: startDate
                        ? `${new Date(toTime(startDate)).toLocaleDateString('ko-KR')} ~ ${endDate ? new Date(toTime(endDate)).toLocaleDateString('ko-KR') : ''}`
                        : r.duration || '날짜 미정',
                    bookedAt: createdAt ? new Date(createdAt).toLocaleDateString('ko-KR') : '',
                    status: r.status,
                    bookedAtMs: toTime(createdAt),
                    totalAmount,
                    deposit: depositAmt,
                    depositStatus: r.depositStatus || r.deposit_status || (r.status === 'pending_payment' ? 'unpaid' : 'paid'),
                    balance: Number(r.balanceAmount ?? r.balance_amount ?? r.price_breakdown?.local ?? Math.max(0, totalAmount - depositAmt)),
                    balanceStatus: r.balanceStatus || r.balance_status || 'unpaid',
                    depositReport: readDepositReport(r),
                    contractUrl: r.contractUrl || r.contract_url,
                    itineraryUrl: r.itineraryUrl || r.itinerary_url,
                    itineraryTemplateId: r.itineraryTemplateId || r.itinerary_template_id,
                    contractData: (() => {
                        const raw = r.contractData || r.contract_data;
                        if (!raw) return undefined;
                        if (typeof raw === 'object') return raw;
                        try { return JSON.parse(raw); } catch { return undefined; }
                    })(),
                    documentContent: (() => {
                        const raw = r.documentContent || r.document_content;
                        if (!raw) return null;
                        let parsed = raw;
                        for (let depth = 0; depth < 2 && typeof parsed === 'string'; depth += 1) {
                            try { parsed = JSON.parse(parsed); } catch { return null; }
                        }
                        return parsed && typeof parsed === 'object' ? parsed : null;
                    })(),
                    assignedGuide: r.assignedGuide || r.assigned_guide,
                    dailyAccommodations: r.dailyAccommodations || r.daily_accommodations,
                    history: r.history || [],
                    areAssignmentsVisibleToUser: r.areAssignmentsVisibleToUser || r.are_assignments_visible_to_user || false,
                    headcount: travelers ? `${travelers}명` : '미정',
                    totalPeople: travelers,
                    phone: r.phone || r.customerPhone || r.customer_phone || r.customer_info?.phone || '',
                    email: r.email || r.customerEmail || r.customer_email || r.customer_info?.email || '',
                    manager: r.manager || r.assignedAdmin || r.assigned_admin || 'Admin',
                    source: r.source || undefined, // 주문 경로 — 목록의 경로 배지와 「경로」 필터가 이 값을 쓴다
                    adminOperations: r.adminOperations,
                    userId: r.userId || r.user_id,
                    };
                });
                allItems.push(...mappedReservations);
            }

            // Map Quotes
            if (quoteData) {
                // Filter out already transformed converted quotes if necessary,
                // but usually API returns all. We filter in map or before.
                // The original code filtered: .neq('status', 'converted')
                // We should filter client side if API doesn't.
                // Assuming API returns all.
                const activeQuotes = quoteData.filter((q: any) => q.status !== 'converted');

                const mappedQuotes: Reservation[] = activeQuotes.map((q: any) => {
                    const createdAt = q.createdAt || q.created_at;
                    return {
                        id: q.id,
                        type: 'quote',
                        productName: `${q.destination || '몽골'} 맞춤 견적`,
                        customerName: q.name,
                        date: q.period || '일정 미정',
                        bookedAt: createdAt ? new Date(createdAt).toLocaleDateString('ko-KR') : '',
                        bookedAtMs: toTime(createdAt),
                        status: q.status,
                        totalAmount: q.confirmedPrice || q.confirmed_price || 0,
                        deposit: q.deposit || 0,
                        depositStatus: 'unpaid',
                        balance: (q.confirmedPrice || q.confirmed_price || 0) - (q.deposit || 0),
                        balanceStatus: 'unpaid',
                        headcount: q.headcount,
                        totalPeople: 0,
                        phone: q.phone,
                        email: q.email,
                        manager: q.manager || 'Admin',
                        userId: q.userId || q.user_id,
                        quoteDetail: {
                            ...q,
                            userId: q.userId || q.user_id,
                            travelTypes: q.travelTypes || q.travel_types || [],
                            accommodations: q.accommodations || [],
                            additionalRequest: q.additionalRequest || q.additional_request,
                            adminNote: q.adminNote || q.admin_note,
                            estimateUrl: q.estimateUrl || q.estimate_url,
                            confirmedPrice: q.confirmedPrice || q.confirmed_price,
                            confirmed_price: q.confirmed_price || q.confirmedPrice,
                            confirmed_start_date: q.confirmed_start_date || q.confirmedStartDate,
                            confirmed_end_date: q.confirmed_end_date || q.confirmedEndDate,
                            deposit: q.deposit || 0,
                            deposit_status: q.deposit_status || q.depositStatus || 'unpaid',
                            balance_status: q.balance_status || q.balanceStatus || 'unpaid',
                            itineraryTemplateId: q.itineraryTemplateId || q.itinerary_template_id || '',
                            date: createdAt ? new Date(createdAt).toLocaleDateString() : ''
                        }
                    };
                });
                allItems.push(...mappedQuotes);
            }

            allItems.sort((a, b) => (b.bookedAtMs || 0) - (a.bookedAtMs || 0));
            setReservations(prev => [...allItems, ...prev.filter(item =>
                (item.type === 'product' && resSettled.status === 'rejected')
                || (item.type === 'quote' && quoteSettled.status === 'rejected')
                || (item.type === 'quote_booking' && bookingSettled.status === 'rejected'))]
                .sort((a, b) => (b.bookedAtMs || 0) - (a.bookedAtMs || 0)));

        } catch (error) {
            console.error('Error fetching data:', error);
            setLoadWarnings(['예약 목록을 불러오지 못했습니다. 새로고침해 주세요.']);
        } finally {
            setIsLoading(false);
            setLoadedOnce(true);
        }
    };
    // End of fetchReservations

    // 상세를 열 때 해당 예약을 서버에서 재조회 — 숙소 배정 보드 등 다른 화면에서
    // 방금 저장한 배정·가이드·계약 데이터가 목록 로드 시점보다 새것일 수 있다.
    const openReservation = (res: Reservation, replace = false) => {
        const p = new URLSearchParams(window.location.search); p.delete('open'); p.delete('kind');
        const listReturnTo = '/admin/reservations' + (p.toString() ? '?' + p.toString() : '');
        if (!customerPage && res.type === 'product') { navigate(productCustomerHref(res.id, listReturnTo), { replace }); return; }
        if (!customerPage && res.type === 'quote') { navigate(legacyQuoteCustomerHref(res.id, listReturnTo), { replace }); return; }
        if (res.type === 'quote_booking') { navigate(quoteCustomerHref(res.id, listReturnTo), { replace }); return; }
        setSelectedReservation(res);
        if (res.type === 'quote') return;
        api.reservations.get(res.id).then((fresh: any) => {
            if (!fresh || !fresh.id) return;
            const merge = (x: Reservation): Reservation => ({
                ...x,
                dailyAccommodations: fresh.dailyAccommodations ?? x.dailyAccommodations,
                assignedGuide: fresh.assignedGuide ?? x.assignedGuide,
                contractData: fresh.contractData ?? x.contractData,
                documentContent: (() => { let value = fresh.documentContent; for (let i = 0; i < 3 && typeof value === 'string'; i++) { try { value = JSON.parse(value); } catch { return x.documentContent; } } return value === undefined ? x.documentContent : value; })(),
                startDate: fresh.startDate ?? x.startDate,
                endDate: fresh.endDate ?? x.endDate,
                date: fresh.startDate && fresh.endDate ? `${fresh.startDate} ~ ${fresh.endDate}` : x.date,
                adminOperations: fresh.adminOperations ?? x.adminOperations,
                history: fresh.history ?? x.history,
                status: fresh.status ?? x.status,
                depositStatus: fresh.depositStatus ?? x.depositStatus,
                balanceStatus: fresh.balanceStatus ?? x.balanceStatus,
                totalAmount: fresh.totalAmount ?? x.totalAmount,
                deposit: fresh.deposit ?? x.deposit,
                balance: fresh.balance ?? x.balance,
                itineraryUrl: fresh.itineraryUrl ?? x.itineraryUrl,
                contractUrl: fresh.contractUrl ?? x.contractUrl,
                areAssignmentsVisibleToUser: fresh.areAssignmentsVisibleToUser ?? x.areAssignmentsVisibleToUser,
                itineraryTemplateId: fresh.itineraryTemplateId ?? x.itineraryTemplateId,
                customerName: fresh.customerName ?? x.customerName,
                email: fresh.email ?? x.email,
                phone: fresh.phone ?? x.phone,
                notes: fresh.notes ?? x.notes,
                depositReport: readDepositReport(fresh) ?? x.depositReport, // 목록을 불러온 뒤에 들어온 입금 신고
            });
            setSelectedReservation(prev => (prev && prev.id === res.id && prev.type === res.type) ? merge(prev) : prev);
            setReservations(prev => prev.map(x => x.id === res.id && x.type === res.type ? merge(x) : x));
        }).catch(() => { /* 재조회 실패 시 목록 데이터 그대로 사용 */ });
    };

    // ?open=<reservationId> — 숙소 보드(Байр захиалга)의 「Захиалгын дэлгэрэнгүй」 링크로
    // 진입 시 해당 예약 상세를 자동으로 연다.
    const openedFromUrl = React.useRef('');
    useEffect(() => {
        if (customerPage) return;
        const openId = new URLSearchParams(window.location.search).get('open');
        if (!openId) { openedFromUrl.current = ''; return; }
        const openType = new URLSearchParams(window.location.search).get('kind') || 'product';
        const key = `${openType}:${openId}`;
        if (openedFromUrl.current === key || reservations.length === 0) return;
        const target = reservations.find(r => r.id === openId && r.type === openType);
        if (!target) return;
        openedFromUrl.current = key;
        openReservation(target, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customerPage, location.search, reservations]);

    const handleUpdateReservation = async (updated: Reservation, silent = false): Promise<boolean> => {
        const operationScope = customerScope;
        const active = () => currentScope.current === operationScope;
        if (!active() || userLoading || user?.role !== 'admin') return false;
        if (updated.type === 'quote_booking') return false;
        setUpdatingCount(count => count + 1);
        try {
            // Find old reservation from local state instead of fetching
            // (Assuming local state has full history, which it does from fetchReservations)
            const oldReservation = reservations.find(r => r.id === updated.id && r.type === updated.type);

            if (!oldReservation) throw new Error('Reservation not found');

            // Use updated.history as base so memos/entries added inside the modal are preserved.
            // Fall back to oldReservation.history if updated didn't provide one.
            let history = updated.history ? [...updated.history] : (oldReservation.history ? [...oldReservation.history] : []);

            // Add history entry for status change if changed
            if (oldReservation.status !== updated.status) {
                const statusLabels: Record<string, string> = {
                    pending_payment: '입금 대기',
                    paid: '결제 완료',
                    confirmed: '예약 확정',
                    cancelled: '취소됨'
                };
                history.push({
                    timestamp: new Date().toISOString(),
                    type: 'status_change',
                    description: `예약 상태가 변경되었습니다: ${statusLabels[updated.status] || updated.status}`,
                    detail: `${oldReservation.status} -> ${updated.status}`
                });
            }

            // Add history entry for itinerary upload if changed
            if (updated.itineraryUrl && (!oldReservation.itineraryUrl || oldReservation.itineraryUrl !== updated.itineraryUrl)) {
                history.push({
                    timestamp: new Date().toISOString(),
                    type: 'document_added',
                    description: '확정 일정표를 고객에게 공개했습니다.',
                    detail: updated.itineraryUrl
                });
            }

            // Add history entry for contract upload if changed
            if (updated.contractUrl && (!oldReservation.contractUrl || oldReservation.contractUrl !== updated.contractUrl)) {
                history.push({
                    timestamp: new Date().toISOString(),
                    type: 'document_added',
                    description: '해외여행 계약서가 업로드되었습니다',
                    detail: updated.contractUrl
                });
            }

            // Prepare update object (Map camelCase back to snake_case for DB)
            // 숙소 배정·가이드·계약 데이터는 이 모달에서 실제로 바뀐 경우에만 전송한다.
            // (PUT은 보낸 키만 갱신하는 부분 업데이트) — 항상 보내면 숙소 배정 보드 등
            // 다른 화면이 저장한 최신 값을 이 페이지의 오래된 복사본으로 덮어써 버린다.
            const updatePayload: any = {
                status: updated.status,
                deposit_status: updated.depositStatus,
                balance_status: updated.balanceStatus,
                contract_url: updated.contractUrl,
                itinerary_url: updated.itineraryUrl,
                itinerary_template_id: updated.itineraryTemplateId,
                ...(updated.startDate !== oldReservation.startDate ? { start_date: updated.startDate || null } : {}),
                ...(updated.endDate !== oldReservation.endDate ? { end_date: updated.endDate || null } : {}),
                ...(updated.contractData !== oldReservation.contractData ? { contract_data: updated.contractData } : {}),
                ...(updated.documentContent !== oldReservation.documentContent ? { document_content: updated.documentContent } : {}),
                ...(updated.adminOperations !== oldReservation.adminOperations ? { admin_operations: updated.adminOperations } : {}),
                ...(updated.assignedGuide !== oldReservation.assignedGuide ? { assigned_guide: updated.assignedGuide } : {}),
                ...(updated.dailyAccommodations !== oldReservation.dailyAccommodations ? { daily_accommodations: updated.dailyAccommodations } : {}),
                history: history,
                are_assignments_visible_to_user: updated.areAssignmentsVisibleToUser,
                total_people: updated.totalPeople,
                updated_at: new Date().toISOString()
            };

            // Update price_breakdown if amounts changed
            // Note: We need to access old price breakdown from oldReservation (which is camelCase mapped)
            // But we stored raw? No, we mapped it to flat fields.
            // We should reconstruct price_breakdown if we want to update it.
            // But simpler: just send the fields we know.
            // If backend handles partial updates, good.
            // If we want to update price_breakdown, we need to construct it.
            if (updated.totalAmount !== oldReservation.totalAmount || updated.deposit !== oldReservation.deposit) {
                updatePayload.priceBreakdown = {
                    total: updated.totalAmount,
                    deposit: updated.deposit,
                    local: updated.totalAmount - updated.deposit
                };
            }

            // Also update flat amount fields if DB has them
            updatePayload.total_amount = updated.totalAmount;
            updatePayload.deposit_amount = updated.deposit;
            updatePayload.balance_amount = Math.max(0, updated.totalAmount - updated.deposit);
            if (updated.customerName !== oldReservation.customerName) updatePayload.customerName = updated.customerName;
            if (updated.email !== oldReservation.email) updatePayload.customerEmail = updated.email;
            if (updated.phone !== oldReservation.phone) updatePayload.customerPhone = updated.phone;


            // Call API
            if (updated.type === 'quote') {
                // Quotes might have different update logic or endpoint?
                // For now assuming we treat them as reservations if they are in this list?
                // Actually quotes are in 'quotes' table, reservations in 'reservations'.
                // If updated.type is quote, we should use quotes API?
                // But the UI seems to treat them unified.
                // However, the ID will be found in 'quotes' table.
                await api.quotes.update(updated.id, updatePayload);
            } else {
                await api.reservations.update(updated.id, updatePayload);
            }
            if (!active()) return false;

            // Optimistic update locally
            const saved = { ...updated, history, paymentKnown: { total: updated.totalAmount, deposit: updated.deposit, balance: Math.max(0, updated.totalAmount - updated.deposit) } };
            setReservations(prev => prev.map(r => r.id === updated.id && r.type === updated.type ? saved : r));
            setSelectedReservation(prev => prev?.id === updated.id && prev.type === updated.type ? saved : prev);

            // Notification Logic
            if (oldReservation.status !== updated.status && updated.userId) {
                const statusMessages: Record<string, string> = {
                    confirmed: '예약이 확정되었습니다!',
                    paid: '입금이 확인되었습니다. 곧 예약이 확정됩니다.',
                    cancelled: '예약이 취소되었습니다.'
                };
                if (statusMessages[updated.status]) {
                    await sendNotification({
                        userId: updated.userId,
                        type: 'reservation',
                        title: '예약 상태 업데이트',
                        message: `${updated.productName} — ${statusMessages[updated.status]}`,
                        link: `/mypage/reservations`
                    });
                }
            }

            if (updated.areAssignmentsVisibleToUser && !oldReservation.areAssignmentsVisibleToUser && updated.userId) {
                if (!active()) return false;
                await sendNotification({
                    userId: updated.userId,
                    type: 'reservation',
                    title: '담당 가이드·숙소 안내',
                    message: `${updated.productName}의 담당 가이드와 숙소가 확정되었습니다. 확인해 주세요.`,
                    link: `/mypage/reservations`
                });
            }

            // 예약금 입금 확인(입금 대기 → 예약 확정): 고객에게 입금 확인 메일을 보낸다.
            // 사이트 알림은 위의 상태 변경 알림("예약이 확정되었습니다!")이 맡으므로 여기서는 userId 를 넘기지 않는다.
            const depositConfirmed = updated.type !== 'quote'
                && oldReservation.depositStatus !== 'paid' && updated.depositStatus === 'paid'
                && oldReservation.status === 'pending_payment' && updated.status === 'confirmed';
            if (depositConfirmed) {
                if (!active()) return false;
                let mailNote = '고객 이메일이 없어 입금 확인 메일은 보내지 않았습니다.';
                if (updated.email) {
                    const mail = await sendNotificationEmail(updated.email, 'PAYMENT_CONFIRMED', {
                        customerName: updated.customerName,
                        productName: updated.productName,
                        reservationNumber: updated.reservationNumber || updated.id.slice(0, 8).toUpperCase(),
                        reservationDbId: updated.id,
                        paymentAmount: updated.deposit,
                        balanceAmount: Math.max(0, updated.totalAmount - updated.deposit),
                    });
                    if (!active()) return false;
                    mailNote = mail.success
                        ? '고객에게 입금 확인 메일을 보냈습니다.'
                        : '입금 확인 메일은 보내지 못했습니다. 고객에게 따로 알려 주세요.';
                }
                alert(`예약금 입금을 확인했습니다. 예약이 확정되었습니다.\n${mailNote}`);
                return true;
            }

            if (!active()) return false;
            if (!silent) alert('예약 정보가 업데이트되었습니다.');
            return true;
            // Only fetch if strictly necessary, otherwise optimistic is fine.
            // fetchReservations(); 
        } catch (error) {
            console.error('Error updating reservation:', error);
            if (!silent) alert('예약 정보 수정에 실패했습니다.');
            return false;
        } finally { if (active()) setUpdatingCount(count => Math.max(0, count - 1)); }
    };

    const handleStatusChange = async (id: string, newStatus: string, type: string) => {
        if (type === 'quote_booking') return;
        try {
            if (type === 'quote') {
                await api.quotes.update(id, { status: newStatus });
            } else {
                await api.reservations.update(id, { status: newStatus });
            }

            // Find current item to get userId
            const targetItem = reservations.find(r => r.id === id && r.type === type);
            if (targetItem && targetItem.userId) {
                const statusMessages: Record<string, string> = {
                    confirmed: '예약이 확정되었습니다!',
                    paid: '입금이 확인되었습니다.',
                    cancelled: '예약이 취소되었습니다.',
                    answered: '견적이 도착했습니다.',
                };
                if (statusMessages[newStatus]) {
                    await sendNotification({
                        userId: targetItem.userId,
                        type: 'reservation',
                        title: type === 'quote' ? '견적 상태 업데이트' : '예약 상태 업데이트',
                        message: `${targetItem.productName} — ${statusMessages[newStatus]}`,
                        link: type === 'quote' ? '/mypage/estimates' : '/mypage/reservations'
                    });
                }
            }

            const updatedStatus = newStatus as Reservation['status'];

            // Optimistic update
            setReservations(prev => prev.map(r => r.id === id && r.type === type ? {
                ...r,
                status: updatedStatus,
                quoteDetail: r.quoteDetail ? { ...r.quoteDetail, status: updatedStatus as QuoteRequest['status'] } : r.quoteDetail,
            } : r));
            if (selectedReservation && selectedReservation.id === id && selectedReservation.type === type) {
                setSelectedReservation(prev => prev ? {
                    ...prev,
                    status: updatedStatus,
                    quoteDetail: prev.quoteDetail ? { ...prev.quoteDetail, status: updatedStatus as QuoteRequest['status'] } : prev.quoteDetail,
                } : null);
            }

        } catch (error) {
            console.error('Failed to update status:', error);
            alert('상태 업데이트에 실패했습니다.');
        }
    };

    const handleDelete = async (id: string, type: string) => {
        if (type === 'quote_booking') return;
        if (!window.confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

        try {
            if (type === 'quote') {
                await api.quotes.delete(id);
            } else {
                await api.reservations.delete(id);
            }

            alert('삭제되었습니다.');
            setReservations(prev => prev.filter(r => r.id !== id || r.type !== type));
            if (selectedReservation?.id === id && selectedReservation.type === type) setSelectedReservation(null);

        } catch (error: any) {
            console.error('Error deleting item:', error);
            alert(`삭제 중 오류가 발생했습니다: ${error.message}`);
        }
    };


    useEffect(() => {
        fetchReservations();
        return () => { fetchSequence.current += 1; };
    }, [customerPage, customerPage ? customerScope : 'list']);

    // Filter Logic
    const handleCreateReservation = async () => {
        if (!addForm.customerName.trim()) { alert('고객명을 입력해 주세요.'); return; }
        setCreating(true);
        try {
            const total = Number(addForm.totalAmount) || 0;
            const deposit = Number(addForm.deposit) || 0;
            await api.reservations.create({
                type: 'tour',
                product_name: addForm.productName.trim() || '맞춤 예약',
                ...(addForm.productId ? { product_id: addForm.productId } : {}),
                customer_info: { name: addForm.customerName.trim(), email: addForm.email.trim(), phone: addForm.phone.trim() },
                total_people: Number(addForm.people) || 1,
                start_date: addForm.startDate || null,
                end_date: addForm.endDate || null,
                status: addForm.status || 'pending_payment',
                source: addForm.source,
                price_breakdown: { total, deposit, local: Math.max(0, total - deposit) },
                notes: addForm.notes.trim() || null,
            });
            setShowAddModal(false);
            setAddForm({ ...BLANK_ADD });
            await fetchReservations();
            alert('예약이 추가되었습니다.');
        } catch (e: any) {
            alert('추가 실패: ' + (e?.message || e));
        } finally {
            setCreating(false);
        }
    };

    const filteredReservations = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        return reservations.filter(res => {
            const haystack = [
                res.id,
                res.reservationNumber,
                res.customerName,
                res.email,
                res.phone,
                res.productName,
                res.country,
                res.headcount,
            ].filter(Boolean).join(' ').toLowerCase();

            const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
            const matchesStatus = filterStatus === '전체 상태' ||
                (filterStatus === '계약 서명 대기' && res.quoteBooking?.label === '계약 서명 대기') ||
                (filterStatus === '최종 확정 대기' && res.quoteBooking?.label === '최종 확정 대기') ||
                (filterStatus === '입금 대기' && res.status === 'pending_payment') ||
                (filterStatus === '결제 완료' && res.status === 'paid') ||
                (filterStatus === '예약 확정' && res.status === 'confirmed') ||
                (filterStatus === '취소됨' && res.status === 'cancelled') ||
                (filterStatus === '신규 견적' && res.status === 'new') ||
                (filterStatus === '견적 작성 중' && res.status === 'processing') ||
                (filterStatus === '견적 발송 완료' && res.status === 'answered') ||
                (filterStatus === '예약 요청' && res.status === 'reservation_requested') ||
                (filterStatus === '보류' && res.status === 'on_hold') ||
                (filterStatus === '여행 완료' && res.status === 'completed');
            const matchesType = (filterType === '전체 유형' && res.type !== 'quote') ||
                (filterType === '맞춤 견적 예약' && res.type === 'quote_booking') ||
                (filterType === '이전 견적 문의' && res.type === 'quote') ||
                (filterType === '일반 상품' && res.type === 'product');
            const matchesPayment = filterPayment === '전체 결제' ||
                (filterPayment === '예약금 미입금' && res.depositStatus !== 'paid') ||
                (filterPayment === '예약금 입금' && res.depositStatus === 'paid') ||
                (filterPayment === '잔금 미입금' && res.balanceStatus !== 'paid') ||
                (filterPayment === '잔금 입금' && res.balanceStatus === 'paid');
            const matchesDeparture = !filterDeparture || res.startDate === filterDeparture;
            const matchesSource = filterSource === '전체 경로' || (res.source || '') === filterSource;

            return matchesSearch && matchesStatus && matchesType && matchesPayment && matchesDeparture && matchesSource;
        }).sort((a, b) => sortOrder === 'departure'
            ? (a.departureMs || Number.MAX_SAFE_INTEGER) - (b.departureMs || Number.MAX_SAFE_INTEGER)
            : (b.bookedAtMs || 0) - (a.bookedAtMs || 0));
    }, [searchTerm, filterStatus, filterPayment, filterType, filterDeparture, filterSource, reservations, sortOrder]);
    useEffect(() => { if (loadedOnce && !isLoading) setCurrentPage(page => Math.min(page, Math.max(1, Math.ceil(filteredReservations.length / itemsPerPage)))); }, [filteredReservations.length, loadedOnce, isLoading]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredReservations.length / itemsPerPage);
    const displayedReservations = filteredReservations.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const upcomingTours = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayMs = today.getTime();
        const horizonMs = todayMs + 30 * 86400000;

        return reservations
            .filter((reservation) => {
                const departureMs = reservation.departureMs || toTime(reservation.startDate);
                // 입금 대기·취소·견적은 제외하고 확정된 팀(예약 확정 / 결제 완료)만 노출한다.
                return reservation.type !== 'quote'
                    && CONFIRMED_TOUR_STATUSES.has(reservation.status)
                    && departureMs >= todayMs
                    && departureMs <= horizonMs;
            })
            .sort((a, b) => (a.departureMs || toTime(a.startDate)) - (b.departureMs || toTime(b.startDate)))
            .map((reservation) => {
                const departureMs = reservation.departureMs || toTime(reservation.startDate);
                return {
                    reservation,
                    departureMs,
                    daysUntil: Math.max(0, Math.round((departureMs - todayMs) / 86400000)),
                };
            });
    }, [reservations]);

    const formatUpcomingDate = (value?: string) => {
        if (!value) return '날짜 미정';
        const time = toTime(toTourDateKey(value));
        if (!time) return '날짜 미정';
        return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' }).format(new Date(time));
    };

    // Stats
    const stats = useMemo(() => {

        const hasContractSent = (r: Reservation) => r.quoteBooking?.contractRequested || Boolean(r.history?.some((event: any) =>
            event.type === 'email' && (String(event.description || '').includes('契約') || String(event.description || '').includes('계약') || String(event.detail || '').includes('/documents/contract/'))
        ));

        return {
            total: reservations.filter(r => r.type !== 'quote').length,
            pending: reservations.filter(r => r.type !== 'quote' && !['cancelled', 'completed'].includes(r.status) && (r.depositStatus !== 'paid' || r.status === 'pending_payment')).length,
            confirmed: reservations.filter(r => r.status === 'confirmed' || r.status === 'paid').length,
            quoteBookings: reservations.filter(r => r.type === 'quote_booking').length,
            contractSent: reservations.filter(hasContractSent).length,
            departingSoon: upcomingTours.length,
        };
    }, [reservations, upcomingTours]);

    const downloadConfirmedReservationsExcel = () => {
        const confirmedReservations = reservationExportRows(reservations, filteredReservations, selectedRows, exportMode)
            .sort((a: any, b: any) => toTime(a.startDate) - toTime(b.startDate));

        if (confirmedReservations.length === 0) {
            alert('선택한 내보내기 범위에 예약이 없습니다.');
            return;
        }

        const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] as string));
        const uniqueText = (items: any[]) => Array.from(new Set(items.map((item) => String(item || '').trim()).filter(Boolean))).join(', ');
        const normalizeName = (value: any) => String(value || '').replace(/\s+/g, '').toLowerCase();
        const formatFlight = (f: any, fallbackDate: string) => uniqueText([f?.date || fallbackDate, f?.time, f?.flight]);
        const productCategoryOf = (reservation: Reservation) => {
            const product = products.find((p) =>
                normalizeName(p.name) === normalizeName(reservation.productName)
                || normalizeName(reservation.productName).includes(normalizeName(p.name))
                || normalizeName(p.name).includes(normalizeName(reservation.productName))
            );
            return product?.category || '';
        };
        const toKoreanRegion = (value: any) => {
            const text = uniqueText(Array.isArray(value) ? value : [value]);
            if (!text) return '';
            const rules: Array<[RegExp, string]> = [
                [/central|중앙|中央|テレルジ|terelj|테를지|테렐지|ub|울란바토르|ウランバートル|쳉헤르|ツェンヘル|미니사막|ミニ砂漠/i, '중앙몽골'],
                [/gobi|고비|ゴビ/i, '고비사막'],
                [/horse|승마|乗馬/i, '승마'],
                [/khuvsgul|huvsgul|홉스굴|홉스골|フブスグル/i, '홉스굴'],
                [/trek|트레킹|トレッキング/i, '트레킹'],
                [/golf|골프|ゴルフ/i, '골프'],
            ];
            const mapped = rules.filter(([re]) => re.test(text)).map(([, label]) => label);
            return uniqueText(mapped) || text;
        };
        const translateDestinationKo = (value: any) => {
            let text = String(value || '').trim();
            if (!text) return '';
            const replacements: Array<[RegExp, string]> = [
                [/ウランバートル|Ulaanbaatar|UB/gi, '울란바토르'],
                [/テレルジ|Terelj|테렐지/gi, '테를지'],
                [/チンギスハーン国際空港|Chinggis Khaan International Airport/gi, '칭기스칸 국제공항'],
                [/ツェンヘル|Tsenkher|쳉헤르/gi, '쳉헤르'],
                [/ミニ砂漠|Elsen Tasarkhai|エルセンタサルハイ/gi, '미니사막'],
                [/カラコルム|Karakorum|Kharkhorin/gi, '카라코룸'],
                [/ホスタイ|Hustai/gi, '호스타이'],
                [/ゴビ|Gobi/gi, '고비사막'],
                [/ダランザドガド|Dalanzadgad/gi, '달란자드가드'],
                [/ヨリーンアム|Yolyn Am/gi, '욜링암'],
                [/バヤンザグ|Bayanzag/gi, '바얀작'],
                [/ホンゴル砂丘|Khongor/gi, '홍고르 사막'],
                [/フブスグル|Khuvsgul|Huvsgul|홉스골/gi, '홉스굴'],
                [/乗馬|Horse Riding/gi, '승마'],
                [/市内観光/gi, '시내 관광'],
                [/到着/gi, '도착'],
                [/出発/gi, '출발'],
                [/観光/gi, '관광'],
                [/温泉/gi, '온천'],
            ];
            for (const [from, to] of replacements) text = text.replace(from, to);
            return text;
        };
        const addDays = (date: string, offset: number) => {
            if (!date) return '';
            const base = new Date(`${date}T00:00:00`);
            if (Number.isNaN(base.getTime())) return '';
            base.setDate(base.getDate() + offset);
            return base.toISOString().slice(0, 10);
        };
        const tripDaysOf = (reservation: Reservation) => {
            const sd = String((reservation as any).startDate || '').slice(0, 10);
            const ed = String((reservation as any).endDate || '').slice(0, 10);
            if (sd && ed) {
                const nights = Math.round((new Date(`${ed}T00:00:00`).getTime() - new Date(`${sd}T00:00:00`).getTime()) / 86400000);
                if (!Number.isNaN(nights) && nights >= 0) return nights + 1;
            }
            const docDays = (reservation.documentContent?.days as any[] | undefined)?.length || 0;
            if (docDays > 0) return docDays;
            return Math.max((reservation.dailyAccommodations || []).length, 1);
        };
        const tripLengthOf = (reservation: Reservation) => {
            const sd = String((reservation as any).startDate || '').slice(0, 10);
            const ed = String((reservation as any).endDate || '').slice(0, 10);
            if (sd && ed) {
                const nights = Math.round((new Date(`${ed}T00:00:00`).getTime() - new Date(`${sd}T00:00:00`).getTime()) / 86400000);
                if (!Number.isNaN(nights) && nights >= 0) return `${nights}박 ${nights + 1}일`;
            }
            return reservation.date || '';
        };
        const dayContentOf = (reservation: Reservation, day: number) => {
            const days = (reservation.documentContent?.days as any[] | undefined) || [];
            return days.find((item: any) => Number(item?.day) === day) || days[day - 1] || {};
        };
        const defaultAccommodationOf = (reservation: Reservation, day: number) => {
            const dayContent = dayContentOf(reservation, day);
            const acc = dayContent?.accommodation;
            if (!acc) return null;
            if (typeof acc === 'string') return { name: acc };
            return acc;
        };
        const inferRegionOf = (reservation: Reservation) => {
            const q = reservation.quoteDetail as any;
            const days = (reservation.documentContent?.days as any[] | undefined) || [];
            const quoteRegions = [
                ...(Array.isArray(q?.destinations) ? q.destinations : []),
                ...(Array.isArray(q?.themes) ? q.themes : []),
                q?.region,
                q?.category,
                q?.destination,
            ];
            const category = productCategoryOf(reservation);
            if (category) return toKoreanRegion(category);
            const direct = toKoreanRegion([reservation.contractData?.region, reservation.contractData?.category, ...quoteRegions]);
            if (direct) return direct;
            const fromDays = uniqueText(days.map((day: any) => day?.region));
            if (fromDays) return toKoreanRegion(fromDays);
            const product = reservation.productName || '';
            return toKoreanRegion(uniqueText([
                /고비|ゴビ|gobi/i.test(product) && '고비사막',
                /승마|乗馬|horse/i.test(product) && '승마',
                /홉스굴|홉스골|フブスグル|khuvsgul/i.test(product) && '홉스굴',
                /중앙|中央|テレルジ|terelj|테를지|테렐지|쳉헤르|ツェンヘル/i.test(product) && '중앙몽골',
            ].filter(Boolean)));
        };

        const rows = confirmedReservations.flatMap((reservation) => {
            const startDate = String((reservation as any).startDate || '').slice(0, 10);
            const endDate = String((reservation as any).endDate || '').slice(0, 10);
            const arrivalFlight = formatFlight(reservation.contractData?.arrival, startDate);
            const departureFlight = formatFlight(reservation.contractData?.departure, endDate);
            const travelPeriod = startDate && endDate ? `${startDate} ~ ${endDate}` : (startDate || reservation.date || '');
            const peopleText = reservation.totalPeople ? `${reservation.totalPeople}명` : reservation.headcount;
            const roomCountDefault = reservation.totalPeople ? `${Math.max(1, Math.ceil(reservation.totalPeople / 2))}개` : '';
            const tripDays = tripDaysOf(reservation);
            // 숙박 박수 기준(출발일 제외). 박수를 넘는 일차에 저장된 배정이 있으면 유실 없이 포함.
            const storedMaxDay = Math.max(0, ...(reservation.dailyAccommodations || []).map((item) => Number(item.day) || 0));
            const stayNights = Math.max(tripDays > 1 ? tripDays - 1 : tripDays, storedMaxDay);
            const englishCustomerName = (reservation.contractData?.travelers || [])
                .map((t) => t?.passportName)
                .find(Boolean) || reservation.customerName || '';

            return Array.from({ length: stayNights }, (_, i) => {
                const day = i + 1;
                const dayContent = dayContentOf(reservation, day);
                const assigned = reservation.dailyAccommodations?.find((item) => item.day === day);
                const fallback = defaultAccommodationOf(reservation, day);
                const accommodation: any = assigned?.accommodation || fallback || {};
                return {
                    customerName: String(englishCustomerName).toUpperCase(),
                    arrivalFlight,
                    departureFlight,
                    people: peopleText || '',
                    scheduleLength: tripLengthOf(reservation),
                    travelRegion: inferRegionOf(reservation),
                    travelStartPeriod: travelPeriod,
                    day,
                    dayDestination: translateDestinationKo(uniqueText([dayContent.region, dayContent.title]) || `${day}일차`),
                    stayDate: addDays(startDate, i),
                    hotelGrade: accommodation.type || '',
                    roomCount: roomCountDefault,
                    hotelName: accommodation.name || '',
                    hotelStatus: assigned ? '확정' : '미확정',
                };
            });
        });
        const headers: Array<[keyof typeof rows[number], string]> = [
            ['customerName', '고객명'],
            ['arrivalFlight', '도착일 / 항공편명 / 시간'],
            ['departureFlight', '출발일 / 항공편명 / 시간'],
            ['people', '인원수'],
            ['scheduleLength', '일정'],
            ['travelRegion', '여행지역'],
            ['travelStartPeriod', '여행시작기간'],
            ['day', '일차'],
            ['dayDestination', '일차별 여행지'],
            ['stayDate', '숙박일'],
            ['hotelGrade', '숙소등급'],
            ['roomCount', '방수'],
            ['hotelName', '호텔/숙소 이름'],
            ['hotelStatus', '숙소 확정 여부'],
        ];
        const tableRows = rows.map((row) => `<tr>${headers.map(([key]) => `<td>${esc(row[key])}</td>`).join('')}</tr>`).join('');
        const html = `<!doctype html><html><head><meta charset="utf-8">
        <style>
          table{border-collapse:collapse;font-family:Arial,'Malgun Gothic',sans-serif;font-size:11pt}
          th{background:#0f766e;color:#fff;font-weight:700;border:1px solid #0b5f59;padding:6px 8px;white-space:nowrap}
          td{border:1px solid #cbd5e1;padding:6px 8px;white-space:pre-wrap;vertical-align:top}
          .meta td{background:#f8fafc;font-weight:700}
        </style></head><body>
          <table class="meta"><tr><td>예약 숙소 수배 통합 시트 · ${esc(exportMode === 'selected' ? '선택 예약' : exportMode === 'confirmed' ? '전체 확정·결제 팀' : '현재 조회 결과')}</td><td>${confirmedReservations.length}건</td><td>${new Date().toISOString().slice(0, 10)}</td></tr></table>
          <br>
          <table><thead><tr>${headers.map(([, label]) => `<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table>
        </body></html>`;
        const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `예약_${exportMode}_숙소수배_${new Date().toISOString().slice(0, 10)}.xls`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const detailWorkspaces = customerPage ? <>
            {selectedReservation && selectedReservation.type === 'product' && (
                <ReservationDetailModal
                    key={`${customerScope}:${selectedReservation.id}`} fullPage={customerPage} reservation={selectedReservation}
                    onClose={() => customerPage ? navigate(returnTo) : setSelectedReservation(null)}
                    onUpdate={handleUpdateReservation}
                    onRefresh={() => customerPage ? void fetchReservations() : selectedReservation && openReservation(selectedReservation)}
                    updating={updatingCount > 0}
                    refreshing={customerPage && isLoading}
                    refreshedAt={customerSync.scope === customerScope ? customerSync.at : undefined}
                    refreshError={customerSync.scope === customerScope ? customerSync.error : undefined}
                    products={products}
                    bookingSelector={customerPage && sameBookings.scope === customerScope ? sameBookings.items.length > 1 ? <label>같은 고객의 예약 <select aria-label="같은 계정의 다른 상품 예약" value={selectedReservation.id} onChange={event => navigate(productCustomerHref(event.target.value, returnTo))}>{sameBookings.items.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label> : sameBookings.warning ? <span role="status">{sameBookings.warning}</span> : undefined : undefined}
                />
            )}



            {selectedReservation && selectedReservation.type === 'quote' && selectedReservation.quoteDetail && (
                <QuoteDetailModal
                    key={`${customerScope}:${selectedReservation.id}`} fullPage={customerPage} request={selectedReservation.quoteDetail}
                    onClose={() => customerPage ? navigate(returnTo) : setSelectedReservation(null)}
                    onUpdateQuote={async (id, updates) => {
                        const active = () => currentScope.current === customerScope && user?.role === 'admin';
                        if (!active()) return false;
                        try {
                            await api.quotes.update(id, {
                                destination: updates.destination,
                                headcount: updates.headcount,
                                period: updates.period,
                                budget: updates.budget,
                                travel_types: updates.travelTypes,
                                accommodations: updates.accommodations,
                                vehicle: updates.vehicle,
                                confirmed_price: updates.confirmed_price ?? (updates as any).confirmedPrice,
                                confirmed_start_date: updates.confirmed_start_date,
                                confirmed_end_date: updates.confirmed_end_date,
                                deposit: updates.deposit,
                                itinerary_template_id: updates.itineraryTemplateId,
                                document_content: updates.documentContent,
                                ...(updates.adminNote !== undefined ? { admin_note: updates.adminNote } : {}),
                                ...(updates.estimateUrl !== undefined ? { estimate_url: updates.estimateUrl } : {}),
                                updated_at: new Date().toISOString()
                            });
                            if (!active()) return false;
                            await fetchReservations();
                            return true;
                        } catch (e) {
                            console.error(e);
                            alert('견적 수정 실패');
                            return false;
                        }
                    }}
                    onSendEstimate={async (url, note, priceDetail, confirmedStartDate, confirmedEndDate, itineraryTemplateId) => {
                        const active = () => currentScope.current === customerScope && user?.role === 'admin';
                        if (!active()) return;
                        // Handle Send Estimate
                        try {
                            // 1. Update Database
                            await api.quotes.update(selectedReservation.id, {
                                status: 'answered',
                                admin_note: note,
                                estimate_url: url,
                                confirmed_price: priceDetail.totalAmount ?? null,
                                deposit: priceDetail.deposit ?? null,
                                confirmed_start_date: confirmedStartDate || null,
                                confirmed_end_date: confirmedEndDate || null,
                                itinerary_template_id: itineraryTemplateId || null,
                                updated_at: new Date().toISOString()
                            });
                            if (!active()) return;

                            // 2. Send Email (Separate try-catch to not block UI success if email fails)
                            try {
                                const emailResult = await sendNotificationEmail(
                                    selectedReservation.email,
                                    'ESTIMATE_COMPLETED',
                                    {
                                        customerName: selectedReservation.customerName,
                                        destination: selectedReservation.productName.replace(' 맞춤 견적', ''),
                                        estimateUrl: url,
                                        adminNote: note,
                                        quoteId: selectedReservation.id,
                                        totalAmount: priceDetail.totalAmount,
                                        userId: selectedReservation.userId,
                                    }
                                );
                                if (!active()) return;

                                if (!emailResult.success) {
                                    console.error('Email Send Error:', emailResult.error);
                                    alert('견적 정보는 저장되었으나, 이메일 발송에 실패했습니다.');
                                } else {
                                    alert(`견적서가 발송되었습니다. (이메일 알림 포함)\n확정 금액: ${priceDetail.totalAmount ? won(priceDetail.totalAmount) : '미입력'}`);
                                }
                            } catch (emailError) {
                                console.error('Email Unexpected Error:', emailError);
                                alert('견적 정보는 저장되었으나, 이메일 발송 중 오류가 발생했습니다.');
                            }

                            if (!active()) return;
                            await fetchReservations();
                            if (!customerPage) setSelectedReservation(null);

                        } catch (e: any) {
                            console.error(e);
                            alert(`견적서 발송 실패: ${e.message}`);
                        }
                    }}
                    onOpenConvert={() => {
                        if (selectedReservation.quoteDetail) {
                            setConvertTarget(selectedReservation.quoteDetail);
                        }
                    }}
                />
            )}
            {convertTarget && (
                <ConvertSelectionModal
                    request={convertTarget}
                    onClose={() => setConvertTarget(null)}
                    onConvert={async (data) => {
                        const active = () => currentScope.current === customerScope && user?.role === 'admin';
                        if (!active()) return;
                        try {
                            // 1. Create Reservation
                            const reservationPayload = {
                                type: 'quote',
                                product_name: `${convertTarget.destination} 맞춤 견적`,
                                customer_name: convertTarget.name,
                                customer_phone: convertTarget.phone,
                                customer_email: convertTarget.email,
                                total_people: parseInt(convertTarget.headcount.replace(/[^0-9]/g, '')) || 0,
                                start_date: data.startDate,
                                end_date: data.endDate,
                                status: 'pending_payment',
                                price_breakdown: {
                                    total: data.totalAmount,
                                    deposit: data.deposit,
                                    local: data.totalAmount - data.deposit
                                },
                                user_id: convertTarget.userId
                            };

                            await api.reservations.create(reservationPayload);
                            if (!active()) return;

                            // 2. Update Quote Status
                            await api.quotes.update(convertTarget.id, {
                                status: 'converted',
                                updated_at: new Date().toISOString()
                            });
                            if (!active()) return;

                            alert('예약이 성공적으로 생성되었습니다.');

                            // Optionally send email here too?
                            // await sendNotificationEmail(...)

                            setConvertTarget(null);
                            if (!customerPage) setSelectedReservation(null);
                            fetchReservations();

                        } catch (e: any) {
                            console.error(e);
                            alert(`예약 생성 실패: ${e.message}`);
                        }
                    }}
                />
            )}
    </> : null;

    const toggleTheme = () => {
        setIsDarkMode(!isDarkMode);
        document.documentElement.classList.toggle('dark');
    };

    if (customerPage) {
        const validScope = loadedCustomerScope === customerScope;
        const loading = userLoading || !validScope || (isLoading && !selectedReservation);
        return <AdminLayout activePage="reservations" title="고객 예약 관리" description="선택한 고객의 일정·계약·결제·배정을 한 화면에서 관리합니다." showSearch={false}>
            {loading ? <div className="card product-customer-loading" role="status">고객 정보를 불러오고 있습니다…</div>
                : customerLoadError || !selectedReservation ? <div className="card product-customer-loading" role="alert"><h2>고객 정보를 확인해 주세요</h2><p>{customerLoadError || '선택한 예약을 찾지 못했습니다.'}</p><div className="row"><button type="button" className="btn btn-ghost" onClick={() => navigate(returnTo)}>목록으로</button><button type="button" className="btn btn-ink" onClick={() => void fetchReservations()}>다시 불러오기</button></div></div>
                    : <>{customerSource === 'quote' && isLoading && <div role="status">저장된 문의·견적 정보를 불러오고 있습니다…</div>}{customerSource === 'quote' && customerSync.scope === customerScope && customerSync.error && <div className="product-customer-warning" role="alert">{customerSync.error}</div>}{loadWarnings.map((warning, i) => <div className="product-customer-warning" role="status" key={i}>{warning}</div>)}{detailWorkspaces}</>}
        </AdminLayout>;
    }

    return (
        <>
            <AdminLayout
                activePage="reservations"
                title="통합 예약 관리"
                description="상품 예약과 실제 견적 예약의 입금·계약·출발 일정을 함께 확인합니다."
                showSearch={false}
                isDarkMode={isDarkMode}
                toggleTheme={toggleTheme}
                actions={
                    <>
                        <button
                            type="button"
                            onClick={() => { setAddForm({ ...BLANK_ADD }); setShowAddModal(true); }}
                            className="btn btn-ink"
                            title="카카오톡·메일·전화 등 사이트 외 주문을 수동으로 예약에 추가"
                        >
                            <Icon name="add" />
                            수동 예약 추가
                        </button>
                        <select className="select" aria-label="Excel 내보내기 범위" value={exportMode} onChange={e => setExportMode(e.target.value as typeof exportMode)}>
                            <option value="filtered">현재 조회 결과</option><option value="selected">선택 예약 {selectedRows.size}건</option><option value="confirmed">전체 확정·결제 팀</option>
                        </select>
                        <button type="button" onClick={downloadConfirmedReservationsExcel} className="btn btn-soft" disabled={isLoading || (exportMode === 'selected' && !selectedRows.size)} title="선택한 범위의 일차별 숙소 수배 정보를 다운로드">
                            <Icon name="table_view" />예약 Excel
                        </button>
                        <button
                            type="button"
                            onClick={fetchReservations}
                            disabled={isLoading}
                            className="btn btn-ghost"
                        >
                            <Icon name="refresh" />
                            새로고침
                        </button>
                    </>
                }
            >
                <div className="stack route-anim admin-redesign-bookings" style={{ gap: 18, fontFamily: 'var(--font-sans)' }}>
                    {loadWarnings.length > 0 && <div className="card card-pad" role="alert" style={{ borderColor: '#D99635' }}>
                        {loadWarnings.map(message => <div key={message}>{message}</div>)}
                        <button type="button" className="btn btn-sm btn-ghost" disabled={isLoading} onClick={fetchReservations}>다시 불러오기</button>
                    </div>}
                    {isLoading && <div role="status" aria-live="polite">예약 목록을 불러오는 중…</div>}
                    {/* Summary Cards */}
                    <section className="arb-kpi-grid" aria-label="예약 운영 현황">
                        {[
                            { label: '전체 예약', value: stats.total, icon: 'folder_managed', tint: 'tint-blue', note: '상품 · 맞춤 견적 예약', detail: `맞춤 견적 ${stats.quoteBookings}건` },
                            { label: '입금 대기', value: stats.pending, icon: 'payments', tint: 'tint-amber', note: '예약금 확인이 필요한 예약', detail: '실제 입금 확인 기준' },
                            { label: '예약 확정', value: stats.confirmed, icon: 'verified', tint: 'tint-green', note: '확정 · 결제 완료 예약', detail: '상품과 견적을 함께 조회' },
                            { label: '계약 안내 기록', value: stats.contractSent, icon: 'contract', tint: 'tint-purple', note: '저장된 계약 안내 기록', detail: '고객의 계약 동의와 구분' },
                            { label: '출발 예정', value: stats.departingSoon, icon: 'flight_takeoff', tint: 'tint-red', note: '30일 이내 출발하는 확정 팀', detail: '가까운 출발일부터 확인' },
                        ].map(card => (
                            <article key={card.label} className="arb-kpi">
                                <div className="arb-kpi-heading">
                                    <span className={`metric-ico ${card.tint}`}><Icon name={card.icon} fill /></span>
                                    <span>{card.label}</span>
                                </div>
                                <div className="arb-kpi-value"><strong>{card.value}</strong><span>건</span></div>
                                <span className="arb-kpi-meter" aria-hidden="true"><span style={{ width: `${stats.total ? Math.min(100, card.value / stats.total * 100) : 0}%` }} /></span>
                                <div className="arb-kpi-detail"><span>{card.note}</span><strong>{card.detail}</strong></div>
                            </article>
                        ))}
                    </section>

                    {/* Upcoming tours — operational departure radar */}
                    <section className="card upcoming-tours" aria-labelledby="upcoming-tours-title">
                        <div className="card-head">
                            <span className="metric-ico tint-red upcoming-tours-icon"><Icon name="flight_takeoff" fill /></span>
                            <div style={{ minWidth: 0 }}>
                                <h2 id="upcoming-tours-title">곧 출발하는 투어</h2>
                                <div className="sub">30일 이내 출발 · 확정 팀만 · 가까운 날짜순</div>
                            </div>
                            <div className="spacer" />
                            <span className="badge b-red"><span className="pulse" />{upcomingTours.length}건 예정</span>
                        </div>
                        {upcomingTours.length > 0 ? (
                            <div className="upcoming-tour-list">
                                {upcomingTours.slice(0, 5).map(({ reservation, daysUntil }) => {
                                    const dueTone = daysUntil <= 3 ? 'due-now' : daysUntil <= 7 ? 'due-week' : 'due-later';
                                    const peopleText = reservation.headcount || (reservation.totalPeople ? `${reservation.totalPeople}명` : '인원 미정');
                                    return (
                                        <div className="upcoming-tour-row" key={`${reservation.type}:${reservation.id}`}>
                                            <div className={`upcoming-tour-due ${dueTone}`}>
                                                <strong>{daysUntil === 0 ? '오늘 출발' : `D-${daysUntil}`}</strong>
                                                <span>{formatUpcomingDate(reservation.startDate)}</span>
                                            </div>
                                            <div className="upcoming-tour-product">
                                                <strong>{reservation.productName || '상품명 미정'}</strong>
                                                <span>#{reservation.reservationNumber || reservation.id.slice(0, 8).toUpperCase()}</span>
                                            </div>
                                            <div className="upcoming-tour-customer">
                                                <strong>{reservation.customerName || '고객명 미정'}</strong>
                                                <span>{peopleText}{reservation.phone ? ` · ${reservation.phone}` : ''}</span>
                                            </div>
                                            <div className="upcoming-tour-actions">
                                                <span className={`badge ${STATUS_TONE[reservation.status] || 'b-gray'}`}>
                                                    <span className="pulse" />{STATUS_LABELS[reservation.status] || reservation.status}
                                                </span>
                                                <button type="button" className="btn btn-sm btn-ghost" onClick={() => openReservation(reservation)}>
                                                    <Icon name="visibility" />상세
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {upcomingTours.length > 5 && (
                                    <div className="upcoming-tour-more">가까운 5건을 표시 중입니다. 이후 일정이 {upcomingTours.length - 5}건 더 있습니다.</div>
                                )}
                            </div>
                        ) : (
                            <div className="upcoming-tour-empty">
                                <Icon name="event_available" />
                                <div><strong>30일 이내 출발 예정인 확정 투어가 없습니다.</strong><span>예약이 확정(입금 완료)되고 출발일이 등록되면 이곳에 자동으로 표시됩니다.</span></div>
                            </div>
                        )}
                    </section>

                    {/* Filter Section */}
                    <section className="arb-booking-board">
                    <div className="arb-filters">
                        <div className="arb-search-header">
                            <label className="tb-search" style={{ flex: 1, minWidth: 240 }}>
                                <Icon name="search" />
                                <input
                                    type="text"
                                    placeholder="고객명 / 이메일 / 전화번호 / 예약번호 / 상품명"
                                    aria-label="고객·연락처·예약번호·상품 검색"
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                />
                            </label>
                        </div>
                        <div className="arb-status-tabs" aria-label="주요 예약 상태">
                            {['전체 상태', '입금 대기', '예약 확정', '계약 서명 대기', '최종 확정 대기'].map(status => <button key={status} type="button" aria-pressed={filterStatus === status} className={filterStatus === status ? 'active' : ''} onClick={() => { setFilterStatus(status); setCurrentPage(1); }}>{status === '전체 상태' ? '전체' : status}</button>)}
                        </div>
                        <div className="toolbar arb-filter-controls" style={{ marginBottom: 0 }}>

                            <select aria-label="예약 상태" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }} className="select">
                                <option>전체 상태</option>
                                <option value="입금 대기">입금 대기</option>
                                <option value="결제 완료">결제 완료</option>
                                <option value="예약 확정">예약 확정</option>
                                <option value="계약 서명 대기">계약 서명 대기</option>
                                <option value="최종 확정 대기">최종 확정 대기</option>
                                {filterType === '이전 견적 문의' && <>
                                    <option value="신규 견적">신규 견적</option>
                                    <option value="견적 작성 중">견적 작성 중</option>
                                    <option value="견적 발송 완료">견적 발송 완료</option>
                                    <option value="예약 요청">예약 요청</option>
                                </>}
                                <option value="보류">보류</option><option value="여행 완료">여행 완료</option>
                                <option value="취소됨">취소됨</option>
                            </select>
                            <select aria-label="입금 상태" value={filterPayment} onChange={(e) => { setFilterPayment(e.target.value); setCurrentPage(1); }} className="select">
                                <option>전체 결제</option>
                                <option>예약금 미입금</option>
                                <option>예약금 입금</option>
                                <option>잔금 미입금</option>
                                <option>잔금 입금</option>
                            </select>
                            <input type="date" aria-label="출발일 필터" value={filterDeparture} onChange={(e) => { setFilterDeparture(e.target.value); setCurrentPage(1); }} className="select" style={{ paddingRight: 13 }} />
                            <select aria-label="주문 경로" value={filterSource} onChange={(e) => { setFilterSource(e.target.value); setCurrentPage(1); }} className="select" title="주문 경로">
                                <option value="전체 경로">전체 경로</option>
                                {SOURCE_OPTIONS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                            </select>
                            <button
                                onClick={() => { setSearchTerm(''); setFilterStatus('전체 상태'); setFilterPayment('전체 결제'); setFilterType('전체 유형'); setFilterDeparture(''); setFilterSource('전체 경로'); setSortOrder('recent'); setCurrentPage(1); }}
                                className="btn btn-soft btn-sm"
                            >
                                <Icon name="restart_alt" />
                                초기화
                            </button>
                        </div>

                        <div className="chip-row arb-types" aria-label="예약 유형" style={{ marginTop: 14 }}>
                            {['전체 유형', '일반 상품', '맞춤 견적 예약', '이전 견적 문의'].map(type => (
                                <button key={type} aria-pressed={filterType === type} onClick={() => { setFilterType(type); setCurrentPage(1); }} className={`chip${filterType === type ? ' active' : ''}`}>
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Reservation List */}
                    <div className="arb-list">
                        <div className="card-head arb-list-header">
                            <h2>통합 예약 목록</h2>
                            <span className="cell-muted" style={{ fontSize: 13 }}>{filteredReservations.length}건</span>
                            {!!selectedRows.size && <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSelectedRows(new Set())}>선택 {selectedRows.size}건 해제</button>}
                            <div className="spacer" />
                            <select className="inp" aria-label="예약 정렬" style={{ width: 'auto' }} value={sortOrder} onChange={e => { setSortOrder(e.target.value); setCurrentPage(1); }}>
                                <option value="recent">최근 예약순</option><option value="departure">출발일순</option>
                            </select>
                        </div>
                        <div className="tbl-wrap">
                            <table className="tbl arb-table" aria-label="통합 예약 목록">
                                <thead><tr>
                                    <th><div className="arb-customer-head"><input type="checkbox" aria-label="현재 페이지 예약 전체 선택" checked={displayedReservations.some(r => r.type !== 'quote') && displayedReservations.filter(r => r.type !== 'quote').every(r => selectedRows.has(reservationSelectionKey(r)))} onChange={e => {
                                        const checked = e.target.checked; setSelectedRows(prev => { const next = new Set(prev); displayedReservations.filter(r => r.type !== 'quote').forEach(r => { const key = reservationSelectionKey(r); if (checked) next.add(key); else next.delete(key); }); return next; });
                                    }}/><span>고객 · 예약번호</span></div></th>
                                    <th>상품 · 인원</th><th>투어일</th><th>진행 상황</th><th className="r">팀 금액</th><th className="r">관리</th>
                                </tr></thead>
                                <tbody>{displayedReservations.map(res => {
                                    const workflow = getWorkflowMeta(res), nextAction = getQuoteAction(res), reservationNo = res.reservationNumber || res.id.slice(0,8).toUpperCase();
                                    const selected = selectedRows.has(reservationSelectionKey(res));
                                    return <tr key={reservationSelectionKey(res)} className={selected ? 'is-selected' : undefined} aria-selected={selected} onClick={() => openReservation(res)}>
                                        <td><div className="arb-customer-cell"><div className="arb-row-selection" onClick={e=>e.stopPropagation()}>{res.type !== 'quote' && <input type="checkbox" aria-label={`${res.customerName} 예약 선택`} checked={selected} onChange={e=>{
                                            const checked=e.target.checked;setSelectedRows(prev=>{const next=new Set(prev),key=reservationSelectionKey(res);if(checked)next.add(key);else next.delete(key);return next;});
                                        }}/>}</div><div className="arb-customer-copy"><strong>{res.customerName || '고객명 미입력'}</strong><span>{res.phone || res.email || '연락처 미입력'}</span><div className="arb-record"><b>#{reservationNo}</b><span className={`tag-type ${res.type==='product'?'reservation':'quote'}`}>{res.type==='quote_booking'?'견적 예약':res.type==='quote'?'이전 견적 문의':'상품 예약'}</span>{res.source&&<small>{sourceLabel(res.source)}</small>}</div></div></div></td>
                                        <td><div className="arb-product-cell"><strong title={res.productName}><Icon name="location_on"/>{res.productName || '상품명 미입력'}</strong><span><Icon name="groups"/>{res.headcount || '인원 미정'}</span></div></td>
                                        <td><div className="arb-tour-cell"><strong>{res.date || '투어일 미등록'}</strong><span>접수 {res.bookedAt || '미등록'}</span></div></td>
                                        <td><div className="arb-workflow-cell"><span className={`badge ${STATUS_TONE[res.status] || 'b-gray'}`}><Icon name={workflow.icon} style={{fontSize:14}}/>{workflow.label}</span>{res.quoteBooking?.hint&&<small>{res.quoteBooking.hint}</small>}{res.type!=='quote'&&<div className="arb-payment-steps">{[{label:'예약금',paid:res.depositStatus==='paid'},{label:'잔금',paid:res.balanceStatus==='paid'}].map(step=><span key={step.label} className={step.paid?'is-done':''}><i aria-hidden="true"/><span>{step.label} {step.paid?'확인':'대기'}</span></span>)}</div>}{hasOpenDepositReport(res)&&<span className="badge b-blue" title={`고객 입금 신고 · ${formatReportTime(res.depositReport?.reportedAt)}`}><Icon name="notifications" style={{fontSize:14}}/>입금 신고 · {res.depositReport?.name || '—'}</span>}</div></td>
                                        <td className="r"><div className="arb-amount-cell"><strong>{typeof res.totalAmount==='number'&&Number.isFinite(res.totalAmount)&&res.totalAmount>=0?won(res.totalAmount):'금액 미확인'}</strong>{res.type!=='quote'&&<span>{res.balanceStatus==='paid'?'잔금 확인':'잔금 대기'}</span>}</div></td>
                                        <td className="r" onClick={e=>e.stopPropagation()}><div className="row-actions arb-row-actions"><button type="button" className={`btn btn-sm ${nextAction.primary?'btn-blue':'btn-ink'}`} title={nextAction.description} onClick={()=>{if(nextAction.nextStatus)handleStatusChange(res.id,nextAction.nextStatus,res.type);else openReservation(res);}}><Icon name={nextAction.icon}/>{nextAction.label}</button><button type="button" className="act-btn" title="상세" aria-label={`${res.customerName} 상세 보기`} onClick={()=>openReservation(res)}><Icon name="visibility"/></button>{res.type!=='quote_booking'&&<button type="button" className="act-btn danger" title="삭제" aria-label={`${res.customerName} 예약 삭제`} onClick={()=>handleDelete(res.id,res.type)}><Icon name="delete"/></button>}</div></td>
                                    </tr>;
                                })}</tbody>
                            </table>
                            {displayedReservations.length === 0 && (
                                <div className="empty"><Icon name="manage_search" /><p>{isLoading ? '예약 목록을 불러오는 중…' : '검색 결과가 없습니다.'}</p></div>
                            )}
                        </div>

                        {/* Pagination */}
                        <div className="row arb-pagination" style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)' }}>
                            <span className="cell-muted" style={{ fontSize: 12 }}>
                                총 {filteredReservations.length}건 중 {filteredReservations.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredReservations.length)} 표시
                            </span>
                            <div className="spacer" style={{ flex: 1 }} />
                            <div className="row" style={{ gap: 8 }}>
                                <button aria-label="이전 예약 페이지" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="act-btn">
                                    <Icon name="chevron_left" />
                                </button>
                                <span className="cell-mono" style={{ fontSize: 12 }}>{Math.min(currentPage, Math.max(totalPages, 1))} / {Math.max(totalPages, 1)}</span>
                                <button aria-label="다음 예약 페이지" onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.max(totalPages, 1)))} disabled={currentPage >= totalPages || totalPages === 0} className="act-btn">
                                    <Icon name="chevron_right" />
                                </button>
                            </div>
                        </div>
                    </div>
                    </section>
                </div>
            </AdminLayout>

            {showAddModal && (
                <div onClick={() => !creating && setShowAddModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 16, padding: '20px 22px', boxShadow: '0 20px 60px rgba(0,0,0,.25)', fontFamily: 'var(--font-sans)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text-strong)' }}>수동 예약 추가</h2>
                            <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => setShowAddModal(false)}><Icon name="close" /></button>
                        </div>
                        <p className="cell-muted" style={{ fontSize: 12, margin: '0 0 16px' }}>카카오톡·메일·전화 등 사이트 외 주문을 직접 등록합니다.</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <label style={{ gridColumn: '1 / -1' }} className="rw-field"><span>예약 상품 선택</span>
                                <select className="inp" aria-label="예약 상품 선택" value={addForm.productId} disabled={creating} onChange={e => { const id = e.target.value; const product = products.find(p => p.id === id); setAddForm(f => ({ ...f, productId: id, ...(product ? { productName: product.name } : {}) })); }}>
                                    <option value="">맞춤 예약 · 직접 입력</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select><small>기존 상품을 선택하면 해당 상품의 일정·사진·대표 명소를 사용합니다.</small>
                            </label>
                            {[
                                { k: 'customerName', label: '고객명 *', el: <input className="inp" style={{ width: '100%' }} value={addForm.customerName} onChange={e => setAddForm(f => ({ ...f, customerName: e.target.value }))} placeholder="고객명" /> },
                                { k: 'source', label: '주문 경로', el: <select className="select" style={{ width: '100%' }} value={addForm.source} onChange={e => setAddForm(f => ({ ...f, source: e.target.value }))}>{SOURCE_OPTIONS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}</select> },
                                { k: 'phone', label: '연락처', el: <input className="inp" style={{ width: '100%' }} value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-1234-5678" /> },
                                { k: 'email', label: '이메일', el: <input className="inp" style={{ width: '100%' }} value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} placeholder="example@mail.com" /> },
                                { k: 'productName', label: '상품 / 투어명', full: true, el: <input className="inp" style={{ width: '100%' }} value={addForm.productName} readOnly={!!addForm.productId} onChange={e => setAddForm(f => ({ ...f, productName: e.target.value }))} placeholder="예: 은하수 대자연 만끽 투어 (4일)" /> },
                                { k: 'startDate', label: '여행 시작일', el: <input type="date" className="inp" style={{ width: '100%' }} value={addForm.startDate} onChange={e => setAddForm(f => ({ ...f, startDate: e.target.value }))} /> },
                                { k: 'endDate', label: '여행 종료일', el: <input type="date" className="inp" style={{ width: '100%' }} value={addForm.endDate} onChange={e => setAddForm(f => ({ ...f, endDate: e.target.value }))} /> },
                                { k: 'people', label: '인원', el: <input type="number" min={1} className="inp" style={{ width: '100%' }} value={addForm.people} onChange={e => setAddForm(f => ({ ...f, people: e.target.value }))} /> },
                                { k: 'status', label: '상태', el: <select className="select" style={{ width: '100%' }} value={addForm.status} onChange={e => setAddForm(f => ({ ...f, status: e.target.value }))}><option value="pending_payment">입금 대기</option><option value="confirmed">예약 확정</option><option value="paid">결제 완료</option></select> },
                                { k: 'totalAmount', label: '총금액 (원)', el: <input type="number" min={0} className="inp" style={{ width: '100%' }} value={addForm.totalAmount} onChange={e => setAddForm(f => ({ ...f, totalAmount: e.target.value }))} placeholder="0" /> },
                                { k: 'deposit', label: '예약금 (원)', el: <input type="number" min={0} className="inp" style={{ width: '100%' }} value={addForm.deposit} onChange={e => setAddForm(f => ({ ...f, deposit: e.target.value }))} placeholder="0" /> },
                                { k: 'notes', label: '메모', full: true, el: <textarea className="inp" style={{ width: '100%', minHeight: 60, resize: 'vertical' }} value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} placeholder="주문 메모 (카카오톡 ID 등)" /> },
                            ].map(field => (
                                <div key={field.k} style={field.full ? { gridColumn: '1 / -1' } : undefined}>
                                    <label className="cell-muted" style={{ fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 5 }}>{field.label}</label>
                                    {field.el}
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
                            <button className="btn btn-ghost" onClick={() => setShowAddModal(false)} disabled={creating}>취소</button>
                            <button className="btn btn-ink" onClick={handleCreateReservation} disabled={creating}><Icon name="check" />{creating ? '추가 중…' : '예약 추가'}</button>
                        </div>
                    </div>
                </div>
            )}

        </>
    );
};
