import React, { useState, useEffect, useRef } from 'react';

import { api } from '../../lib/api';
import { BRAND } from '../../constants/company';
import { ReservationDocumentEditor, type ReservationDocContent } from './ReservationDocumentEditor';
import { decodeTemplateDescription, mergeDocumentSettings } from '../../pages/AdminTemplateManage';
import { useBlocker } from 'react-router-dom';
import { CustomerWorkspaceOverview } from './CustomerWorkspaceOverview';
import { legacyCustomerOverview } from '../../utils/productCustomerWorkspace';

export interface QuoteRequest {
    id: string;
    type: 'personal' | 'business';
    name: string;
    destination: string;
    headcount: string;
    period: string;
    date: string;
    status: 'new' | 'processing' | 'completed' | 'converted' | 'reservation_requested' | 'answered';
    adminNote?: string;
    estimateUrl?: string;
    userId?: string;
    // Detailed fields
    phone: string;
    email: string;
    travelTypes: string[];
    accommodations: string[];
    vehicle: string;
    budget: string;
    additionalRequest: string;
    attachment?: File | Blob;
    createdAt: string;
    confirmed_price?: number;
    confirmed_start_date?: string;
    confirmed_end_date?: string;
    deposit?: number;
    deposit_status?: 'paid' | 'unpaid';
    balance_status?: 'paid' | 'unpaid';
    itineraryTemplateId?: string;
    itinerary_template_id?: string;
    documentContent?: ReservationDocContent | null;
    document_content?: any;
}

// Helper functions for currency formatting
const formatNumber = (num: number | string) => {
    if (!num && num !== 0) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const unformatNumber = (str: string) => {
    return parseInt(str.replace(/,/g, '')) || 0;
};

const parsePeopleCount = (value?: string) => {
    const matches = String(value || '').match(/\d+/g);
    if (!matches || matches.length === 0) return 1;
    return Math.max(1, matches.reduce((sum, count) => sum + parseInt(count, 10), 0));
};

const parseDocumentPricePerPerson = (content?: ReservationDocContent | null) => {
    const raw = content?.documentSettings?.overview?.pricePerPerson;
    const parsed = typeof raw === 'string' ? parseInt(raw.replace(/[^\d]/g, ''), 10) : Number(raw || 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

const syncDocumentPrice = (content: ReservationDocContent | null, pricePerPerson: number): ReservationDocContent | null => {
    if (!content) return content;
    const settings = mergeDocumentSettings(content.documentSettings);
    return {
        ...content,
        documentSettings: {
            ...settings,
            overview: {
                ...settings.overview,
                pricePerPerson: pricePerPerson > 0 ? String(pricePerPerson) : settings.overview.pricePerPerson,
            },
        },
    };
};

const normalizeDocumentContent = (value: any): ReservationDocContent | null => {
    if (!value) return null;
    let parsed = value;
    for (let depth = 0; depth < 2 && typeof parsed === 'string'; depth += 1) {
        try { parsed = JSON.parse(parsed); } catch { return null; }
    }
    return parsed && typeof parsed === 'object' ? parsed as ReservationDocContent : null;
};

// Conversion Modal Component
export const ConvertSelectionModal: React.FC<{
    request: QuoteRequest | null;
    onClose: () => void;
    onConvert: (data: { startDate: string; endDate: string; totalAmount: number; deposit: number }) => void;
}> = ({ request, onClose, onConvert }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [totalAmount, setTotalAmount] = useState(0);
    const [deposit, setDeposit] = useState(0);

    useEffect(() => {
        if (!request) return;

        // 1순위: 이미 견적서에서 확정된 금액/날짜가 있으면 우선 사용
        if (request.confirmed_start_date) setStartDate(request.confirmed_start_date.substring(0, 10));
        if (request.confirmed_end_date) setEndDate(request.confirmed_end_date.substring(0, 10));
        if (request.confirmed_price) {
            setTotalAmount(request.confirmed_price);
            setDeposit(request.deposit || Math.floor(request.confirmed_price * 0.1));
            return;
        }

        // 2순위: 확정 데이터 없으면 period 문자열 파싱
        if (!request.confirmed_start_date && request.period && request.period.includes('~')) {
            const parts = request.period.split('~').map(p => p.trim());
            if (parts.length === 2) {
                if (parts[0].includes('-') && parts[0].length >= 10) {
                    setStartDate(parts[0].substring(0, 10));
                    setEndDate(parts[1].substring(0, 10));
                } else if (parts[0].includes('.')) {
                    const year = new Date().getFullYear();
                    const [startMonth, startDay] = parts[0].split('.').map(n => n.padStart(2, '0'));
                    const [endMonth, endDay] = parts[1].split('.').map(n => n.padStart(2, '0'));
                    setStartDate(`${year}-${startMonth}-${startDay}`);
                    setEndDate(`${year}-${endMonth}-${endDay}`);
                }
            }
        }

        // 3순위: 금액은 예산 문자열에서 파싱
        if (!request.confirmed_price && request.budget) {
            const budgetMatch = request.budget.match(/(\d+)/);
            if (budgetMatch) {
                const budgetNum = parseInt(budgetMatch[1]) * 10000;
                setTotalAmount(budgetNum);
                setDeposit(Math.floor(budgetNum * 0.1));
            }
        }
    }, [request]);

    if (!request) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">sync_alt</span>
                        예약 확정 및 전환
                    </h3>
                    <button onClick={onClose} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700">
                        <span className="material-symbols-outlined text-slate-500">close</span>
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="p-3 bg-teal-50 dark:bg-teal-900/20 text-teal-800 dark:text-teal-200 text-sm rounded-lg mb-4">
                        <b>{request.name}</b>님의 견적 요청을 정식 예약으로 전환합니다.<br />
                        확정된 일정과 금액을 입력해주세요.
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">여행 시작일</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">여행 종료일</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">총 확정 금액 (원)</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="0"
                                    value={formatNumber(totalAmount)}
                                    onChange={e => {
                                        const val = unformatNumber(e.target.value);
                                        setTotalAmount(val);
                                        if (deposit === 0) setDeposit(Math.floor(val * 0.1));
                                    }}
                                    className="w-full px-3 py-2.5 border rounded-lg bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-primary font-bold text-right pr-8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">원</span>
                            </div>
                            {totalAmount > 0 && (
                                <p className="text-[10px] font-bold text-primary/70 ml-1">
                                    ≈ {typeof totalAmount === 'number' && !isNaN(totalAmount) ? (totalAmount / 10000).toLocaleString('ko-KR') : 0}만 원
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">예약금 (원)</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="0"
                                    value={formatNumber(deposit)}
                                    onChange={e => setDeposit(unformatNumber(e.target.value))}
                                    className="w-full px-3 py-2.5 border rounded-lg bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-primary font-bold text-right text-primary pr-8"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">원</span>
                            </div>
                            {deposit > 0 && (
                                <p className="text-[10px] font-bold text-primary/70 ml-1">
                                    ≈ {typeof deposit === 'number' && !isNaN(deposit) ? (deposit / 10000).toLocaleString('ko-KR') : 0}만 원
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Balance Preview */}
                    <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${totalAmount - deposit < 0 ? 'bg-red-50 border-red-100' : 'bg-primary/5 border-primary/10'}`}>
                        <div className="flex flex-col">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${totalAmount - deposit < 0 ? 'text-red-600' : 'text-primary'}`}>예상 현지 지불 잔금</span>
                            {totalAmount - deposit < 0 && (
                                <span className="text-[9px] text-red-500 font-bold mt-0.5 animate-pulse">! 예약금이 총액을 초과했습니다</span>
                            )}
                        </div>
                        <span className={`text-base font-extrabold ${totalAmount - deposit < 0 ? 'text-red-600' : 'text-primary'}`}>
                            {typeof totalAmount === 'number' && typeof deposit === 'number' && !isNaN(totalAmount) && !isNaN(deposit) ? (totalAmount - deposit).toLocaleString('ko-KR') : 0}원
                        </span>
                    </div>
                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg text-sm"
                    >
                        취소
                    </button>
                    <button
                        onClick={() => {
                            if (!startDate || !endDate || totalAmount <= 0) {
                                alert('날짜와 금액을 모두 입력해주세요.');
                                return;
                            }
                            onConvert({ startDate, endDate, totalAmount, deposit });
                        }}
                        className="px-4 py-2 bg-primary-dark hover:bg-primary-dark text-white font-bold rounded-lg text-sm shadow-lg shadow-primary/20"
                    >
                        예약 생성 및 확정
                    </button>
                </div>
            </div>
        </div>
    );
};

// Quote Detail Modal (Updated to receive onOpenConvert)
export const QuoteDetailModal: React.FC<{
    request: QuoteRequest | null;
    onClose: () => void;
    onSendEstimate: (url: string, note: string, priceDetail: any, startDate: string, endDate: string, itineraryTemplateId?: string) => void;
    onOpenConvert: () => void;
    onUpdateQuote: (id: string, updates: Partial<QuoteRequest>) => Promise<boolean | void>;
    fullPage?: boolean;
}> = ({ request, onClose, onSendEstimate, onOpenConvert, onUpdateQuote, fullPage = false }) => {
    const [estimateUrl, setEstimateUrl] = useState(request?.estimateUrl || '');
    const [adminNote, setAdminNote] = useState(request?.adminNote || '');
    const [copiedEstimateUrl, setCopiedEstimateUrl] = useState(false);
    const [previewSaving, setPreviewSaving] = useState(false);

    // 맞춤 일정표 — 고객 견적 페이지에 함께 보낼 일정표 템플릿
    const [templatesList, setTemplatesList] = useState<any[]>([]);
    const [itineraryTemplateId, setItineraryTemplateId] = useState<string>(request?.itineraryTemplateId || request?.itinerary_template_id || '');
    const [quoteDocumentContent, setQuoteDocumentContent] = useState<ReservationDocContent | null>(
        normalizeDocumentContent(request?.documentContent || request?.document_content)
    );
    const [docEditorOpen, setDocEditorOpen] = useState(false);
    const [workflowOpen, setWorkflowOpen] = useState(!fullPage);
    const [workspaceDirty, setWorkspaceDirty] = useState(false);
    const [workspaceSaving, setWorkspaceSaving] = useState(false);
    const savingLock = useRef(false);
    const [workspaceNotice, setWorkspaceNotice] = useState('');
    const [activeSec, setActiveSec] = useState<'info' | 'quote'>('info');
    const bodyRef = useRef<HTMLDivElement | null>(null);
    const scrollToSec = (id: 'info' | 'quote') => {
        setActiveSec(id);
        setWorkflowOpen(true);
        requestAnimationFrame(() => bodyRef.current?.querySelector(`#qsec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    useEffect(() => {
        api.itineraryTemplates.list().then((d: any) => { if (Array.isArray(d)) setTemplatesList(d); }).catch(() => {});
    }, []);

    // --- Added for Centralized UI Integration ---
    const [priceDetail, setPriceDetail] = useState({
        totalAmount: request?.confirmed_price ?? ((parseDocumentPricePerPerson(normalizeDocumentContent(request?.documentContent || request?.document_content)) || 0) * parsePeopleCount(request?.headcount)),
        deposit: request?.deposit || 0,
        depositStatus: request?.deposit_status || 'unpaid',
        balanceStatus: request?.balance_status || 'unpaid',
        pricePerPerson: parseDocumentPricePerPerson(normalizeDocumentContent(request?.documentContent || request?.document_content)) || 0,
        peopleCount: parsePeopleCount(request?.headcount),
        manualTotal: request?.confirmed_price !== null && request?.confirmed_price !== undefined
    });

    // Confirmed Dates
    const [confirmedStartDate, setConfirmedStartDate] = useState(request?.confirmed_start_date || '');
    const [confirmedEndDate, setConfirmedEndDate] = useState(request?.confirmed_end_date || '');

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        destination: '',
        headcount: '',
        period: '',
        budget: '',
        travelTypes: [] as string[],
        accommodations: [] as string[],
        vehicle: '',
        confirmedPrice: 0,
        deposit: 0
    });
    const workspaceBusy = workspaceSaving || previewSaving;
    const navigationBlocker = useBlocker(({ currentLocation, nextLocation }) => fullPage && (workspaceBusy || workspaceDirty || isEditing || docEditorOpen)
        && `${currentLocation.pathname}${currentLocation.search}` !== `${nextLocation.pathname}${nextLocation.search}`);
    useEffect(() => {
        if (navigationBlocker.state !== 'blocked') return;
        if (workspaceBusy) { setWorkspaceNotice('견적 저장·고객 전달을 마친 뒤 이동해 주세요.'); navigationBlocker.reset(); return; }
        if (window.confirm('저장하지 않은 견적 내용이 있을 수 있습니다. 변경사항을 버리고 이동할까요?')) navigationBlocker.proceed();
        else navigationBlocker.reset();
    }, [navigationBlocker, workspaceBusy]);
    useEffect(() => {
        if (!fullPage) return;
        const protect = (event: BeforeUnloadEvent) => { if (workspaceBusy || workspaceDirty || isEditing || docEditorOpen) { event.preventDefault(); event.returnValue = ''; } };
        window.addEventListener('beforeunload', protect); return () => window.removeEventListener('beforeunload', protect);
    }, [fullPage, workspaceBusy, workspaceDirty, isEditing, docEditorOpen]);
    const closeWorkspace = () => {
        if (workspaceBusy) { setWorkspaceNotice('견적 저장·고객 전달을 마친 뒤 이동해 주세요.'); return; }
        onClose(); // The data router applies the same guard to back buttons and browser history.
    };
    const updateQuote = async (id: string, updates: Partial<QuoteRequest>, clearDirty = false) => {
        if (savingLock.current) return false;
        savingLock.current = true; setWorkspaceSaving(true);
        try { const saved = await onUpdateQuote(id, updates); if (saved !== false && clearDirty) setWorkspaceDirty(false); return saved; }
        finally { savingLock.current = false; setWorkspaceSaving(false); }
    };

    useEffect(() => {
        if (request) {
            setEstimateUrl(request.estimateUrl || '');
            setAdminNote(request.adminNote || '');
            setEditForm({
                destination: request.destination,
                headcount: request.headcount,
                period: request.period,
                budget: request.budget,
                travelTypes: request.travelTypes,
                accommodations: request.accommodations,
                vehicle: request.vehicle,
                confirmedPrice: request.confirmed_price || 0,
                deposit: request.deposit || 0
            });
            const content = normalizeDocumentContent(request.documentContent || request.document_content);
            const peopleCount = parsePeopleCount(request.headcount);
            const pricePerPerson = parseDocumentPricePerPerson(content) || (request.confirmed_price && peopleCount ? Math.round(request.confirmed_price / peopleCount) : 0);
            const calculatedTotal = pricePerPerson * peopleCount;
            // Reset priceDetail when request changes
            setPriceDetail({
                totalAmount: request.confirmed_price ?? calculatedTotal,
                deposit: request.deposit || 0,
                depositStatus: request.deposit_status || 'unpaid',
                balanceStatus: request.balance_status || 'unpaid',
                pricePerPerson,
                peopleCount,
                manualTotal: request.confirmed_price !== null && request.confirmed_price !== undefined && request.confirmed_price !== calculatedTotal
            });
            setConfirmedStartDate(request.confirmed_start_date || '');
            setConfirmedEndDate(request.confirmed_end_date || '');
            setItineraryTemplateId(request.itineraryTemplateId || request.itinerary_template_id || '');
            setQuoteDocumentContent(content);
        }
    }, [request?.id]);

    const handleSaveEdit = async () => {
        if (!request) return;

        const saved = await updateQuote(request.id, {
            ...editForm
        } as any);
        if (saved !== false) setIsEditing(false);
    };

    if (!request) return null;

    // 문서 편집기 (견적용) — 고객 데이터 자동 채움, document_content 저장
    const quotePeople = priceDetail.peopleCount || parsePeopleCount(request.headcount);
    const quoteHeadcount = quotePeople === parsePeopleCount(request.headcount)
        ? request.headcount
        : `${quotePeople}명`;
    const quoteBalance = Math.max(0, (priceDetail.totalAmount || 0) - (priceDetail.deposit || 0));
    const updatePricePerPerson = (nextPricePerPerson: number) => {
        setPriceDetail(prev => {
            const peopleCount = prev.peopleCount || 1;
            const nextTotal = nextPricePerPerson * peopleCount;
            return {
                ...prev,
                pricePerPerson: nextPricePerPerson,
                totalAmount: prev.manualTotal ? prev.totalAmount : nextTotal,
                deposit: prev.deposit ? prev.deposit : Math.floor(nextTotal * 0.1),
            };
        });
    };
    const updatePeopleCount = (nextPeopleCount: number) => {
        setPriceDetail(prev => {
            const peopleCount = Math.max(1, nextPeopleCount || 1);
            const nextTotal = (prev.pricePerPerson || 0) * peopleCount;
            return {
                ...prev,
                peopleCount,
                totalAmount: prev.manualTotal ? prev.totalAmount : nextTotal,
                deposit: prev.deposit ? prev.deposit : Math.floor(nextTotal * 0.1),
            };
        });
    };
    const updateManualTotal = (manualTotal: boolean) => {
        setPriceDetail(prev => ({
            ...prev,
            manualTotal,
            totalAmount: manualTotal ? prev.totalAmount : (prev.pricePerPerson || 0) * (prev.peopleCount || 1),
        }));
    };
    const docTripLength = (() => {
        if (!confirmedStartDate || !confirmedEndDate) return '';
        const s = new Date(confirmedStartDate); const e = new Date(confirmedEndDate);
        const ms = e.getTime() - s.getTime();
        if (isNaN(ms) || ms < 0) return '';
        const nights = Math.round(ms / 86400000);
        return `${nights}박 ${nights + 1}일`;
    })();
    const docCustomer = {
        tripNumber: request.id.slice(0, 8).toUpperCase(),
        period: request.period || '',
        tripLength: docTripLength || undefined,
        headcount: quoteHeadcount || '',
        name: request.name,
        tripType: request.destination,
        totalAmount: priceDetail.totalAmount || undefined,
        deposit: priceDetail.deposit || undefined,
        localAmount: priceDetail.totalAmount ? quoteBalance : undefined,
        peopleCount: quotePeople || undefined,
    };
    const templateToDocumentContent = (templateId: string): ReservationDocContent | null => {
        const tpl = templatesList.find((t: any) => t.id === templateId);
        if (!tpl) return null;
        const decoded = decodeTemplateDescription(tpl.description || '');
        let templateDays: any[] = [];
        try { templateDays = typeof tpl.days === 'string' ? JSON.parse(tpl.days || '[]') : (tpl.days || []); } catch { templateDays = []; }
        return {
            name: tpl.name || '',
            description: decoded.description || '',
            days: structuredClone(templateDays),
            documentSettings: structuredClone(decoded.documentSettings),
        };
    };
    const docInitialContent: ReservationDocContent | null = (() => {
        const dc = quoteDocumentContent;
        if (dc && (Array.isArray(dc.days) || dc.documentSettings)) {
            return syncDocumentPrice({ name: dc.name || '', description: dc.description || '', days: dc.days || [], documentSettings: mergeDocumentSettings(dc.documentSettings) }, priceDetail.pricePerPerson);
        }
        return syncDocumentPrice(templateToDocumentContent(itineraryTemplateId), priceDetail.pricePerPerson);
    })();
    const saveQuoteDoc = async (content: ReservationDocContent) => {
        const incomingPricePerPerson = parseDocumentPricePerPerson(content);
        const syncedPricePerPerson = incomingPricePerPerson || priceDetail.pricePerPerson;
        const syncedContent = syncDocumentPrice(content, syncedPricePerPerson) || content;
        const peopleCount = priceDetail.peopleCount || quotePeople || 1;
        const nextTotal = incomingPricePerPerson > 0 && !priceDetail.manualTotal
            ? incomingPricePerPerson * peopleCount
            : priceDetail.totalAmount;
        const nextDeposit = priceDetail.deposit;
        if (incomingPricePerPerson > 0 && incomingPricePerPerson !== priceDetail.pricePerPerson) {
            setPriceDetail(prev => ({
                ...prev,
                pricePerPerson: incomingPricePerPerson,
                totalAmount: nextTotal,
                deposit: nextDeposit,
            }));
        }
        setQuoteDocumentContent(syncedContent);
        const saved = await updateQuote(request.id, {
            itineraryTemplateId,
            documentContent: syncedContent,
            confirmed_price: nextTotal,
            deposit: nextDeposit,
        } as any);
        if (saved === false) return;
        // 저장 검증 — 서버에 실제로 일정이 남았는지 재조회로 확인.
        // 세션 만료(401)·마이그레이션 누락 등으로 조용히 실패하면 고객 미리보기에
        // '준비 중'만 떠서 원인을 알 수 없으므로, 여기서 바로 드러낸다.
        try {
            const fresh: any = await api.quotes.get(request.id);
            const savedDays = fresh?.documentContent?.days ?? fresh?.itinerary?.days;
            if (!Array.isArray(savedDays) || savedDays.length === 0) {
                alert('⚠️ 일정이 서버에 저장되지 않았습니다.\n\n관리자 로그인이 풀렸을 수 있습니다 — 로그인 상태를 확인하고 다시 저장해 주세요.\n반복되면 /api/migrate-db 실행이 필요할 수 있습니다.');
            }
        } catch { /* 재조회 실패는 무시 — 저장 실패는 위 update 에러로 이미 드러남 */ }
    };
    const saveQuoteBasics = async (): Promise<boolean> => {
        const syncedContent = syncDocumentPrice(quoteDocumentContent, priceDetail.pricePerPerson);
        if (syncedContent) setQuoteDocumentContent(syncedContent);
        const saved = await updateQuote(request.id, {
            ...(isEditing ? editForm : {}), adminNote, estimateUrl,
            headcount: quoteHeadcount,
            confirmed_price: priceDetail.totalAmount,
            deposit: priceDetail.deposit,
            confirmed_start_date: confirmedStartDate,
            confirmed_end_date: confirmedEndDate,
            itineraryTemplateId,
            documentContent: syncedContent,
        } as any, true);
        if (saved !== false) setIsEditing(false);
        return saved !== false;
    };
    const handleTemplateChange = async (templateId: string) => {
        setItineraryTemplateId(templateId);
        const content = templateId ? templateToDocumentContent(templateId) : null;
        const incomingPricePerPerson = parseDocumentPricePerPerson(content);
        const syncedContent = syncDocumentPrice(content, incomingPricePerPerson || priceDetail.pricePerPerson);
        if (incomingPricePerPerson > 0) {
            const nextTotal = incomingPricePerPerson * (priceDetail.peopleCount || quotePeople || 1);
            setPriceDetail(prev => ({
                ...prev,
                pricePerPerson: incomingPricePerPerson,
                totalAmount: prev.manualTotal ? prev.totalAmount : nextTotal,
                deposit: prev.deposit ? prev.deposit : Math.floor(nextTotal * 0.1),
            }));
        }
        setQuoteDocumentContent(syncedContent);
        const saved = await updateQuote(request.id, {
            itineraryTemplateId: templateId,
            documentContent: syncedContent,
        } as any);
        if (saved === false) return;
    };

    const quoteStatusMeta: Record<string, { label: string; tone: string }> = {
        new: { label: '신규 요청', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
        processing: { label: '견적 작성 중', tone: 'bg-orange-50 text-orange-700 border-orange-200' },
        answered: { label: '견적 발송 완료', tone: 'bg-blue-50 text-blue-700 border-blue-200' },
        reservation_requested: { label: '예약 요청', tone: 'bg-purple-50 text-purple-700 border-purple-200' },
        converted: { label: '예약 전환 완료', tone: 'bg-slate-100 text-slate-600 border-slate-200' },
        completed: { label: '완료', tone: 'bg-teal-50 text-teal-700 border-teal-200' },
    };

    const workflowSteps = [
        { key: 'new', label: '요청 확인', icon: 'fact_check' },
        { key: 'processing', label: '견적 작성', icon: 'edit_note' },
        { key: 'answered', label: '고객 발송', icon: 'outgoing_mail' },
        { key: 'reservation_requested', label: '예약 요청', icon: 'event_available' },
        { key: 'converted', label: '예약 전환', icon: 'task_alt' },
    ];

    const currentStepIndex = Math.max(0, workflowSteps.findIndex((step) => step.key === request.status));
    const statusMeta = quoteStatusMeta[request.status] || quoteStatusMeta.new;
    const hasQuoteItinerary = (docInitialContent?.days?.length ?? 0) > 0;
    const hasQuoteSchedule = hasQuoteItinerary || Boolean(confirmedStartDate && confirmedEndDate);
    const effectivePricePerPerson = priceDetail.pricePerPerson || parseDocumentPricePerPerson(docInitialContent);
    const effectiveTotalAmount = priceDetail.totalAmount;
    const effectiveDeposit = priceDetail.deposit;
    const missingSendItems = [
        !request.destination || !request.headcount || !request.period ? '여행 조건' : '',
        !hasQuoteSchedule ? '제안 일정 또는 시작/종료일' : '',
        effectiveTotalAmount <= 0 ? '총 견적금액' : '',
        effectiveTotalAmount < effectiveDeposit ? '예약금이 총액보다 작거나 같아야 함' : '',
    ].filter(Boolean);
    const checklistItems = [
        { label: '여행 조건 확인', done: Boolean(request.destination && request.headcount && request.period) },
        { label: '제안 일정 확인', done: hasQuoteSchedule },
        { label: '금액/예약금 입력', done: effectiveTotalAmount > 0 && effectiveTotalAmount >= effectiveDeposit },
        { label: '견적서 링크', done: Boolean(estimateUrl), optional: true },
        { label: '고객 안내문', done: Boolean(adminNote.trim()), optional: true },
    ];
    // 발송 필수 = 여행 조건 + 제안 일정(문서 일정 또는 날짜) + 금액. 견적서 링크/안내문은 선택.
    const canSendEstimate = missingSendItems.length === 0;
    const quickNotes = [
        {
            label: '기본 안내',
            text: '견적 내용을 확인해 주세요. 일정·요금에 문제가 없으시면 예약 상담으로 진행해 주세요.',
        },
        {
            label: '상담 유도',
            text: '희망하신 조건에 맞춰 일정과 요금을 조정했습니다. 궁금한 점이나 변경을 원하시는 부분이 있으면 편하게 문의해 주세요.',
        },
    ];

    const handleSend = async () => {
        if (!canSendEstimate) {
            alert(`견적 발송 전에 아래 항목을 확인해 주세요.\n\n- ${missingSendItems.join('\n- ')}`);
            scrollToSec('quote');
            return;
        }
        const normalizedPriceDetail = {
            ...priceDetail,
            pricePerPerson: effectivePricePerPerson,
            totalAmount: effectiveTotalAmount,
            deposit: effectiveDeposit,
        };
        const syncedContent = syncDocumentPrice(quoteDocumentContent, normalizedPriceDetail.pricePerPerson);
        if (syncedContent) setQuoteDocumentContent(syncedContent);
        const saved = await updateQuote(request.id, {
            headcount: quoteHeadcount,
            confirmed_price: normalizedPriceDetail.totalAmount,
            deposit: normalizedPriceDetail.deposit,
            confirmed_start_date: confirmedStartDate,
            confirmed_end_date: confirmedEndDate,
            itineraryTemplateId,
            documentContent: syncedContent,
        } as any);
        if (saved === false) return;
        savingLock.current = true; setWorkspaceSaving(true);
        try { await onSendEstimate(estimateUrl, adminNote, normalizedPriceDetail, confirmedStartDate, confirmedEndDate, itineraryTemplateId); }
        finally { savingLock.current = false; setWorkspaceSaving(false); }
    };
    const estimatePageUrl = `${window.location.origin}/estimate/${request.id}`;
    const quoteSent = request.status === 'answered';
    const handlePreview = async () => {
        if (previewSaving) return;
        if (!quoteSent && !hasQuoteItinerary) {
            const shouldEdit = window.confirm('일정표가 아직 없어 고객 화면에는 \'준비 중\'으로 표시됩니다.\n문서 편집기를 열어 일정을 만들까요?\n\n(취소를 누르면 현재 금액을 저장한 뒤 미리보기를 엽니다)');
            if (shouldEdit) {
                setDocEditorOpen(true);
                return;
            }
        }

        // 팝업 차단을 피하려고 사용자 클릭 시점에 창을 먼저 만들고,
        // 현재 입력값 저장이 끝난 뒤 최신 고객 페이지로 이동시킨다.
        const previewWindow = window.open('about:blank', '_blank');
        if (previewWindow) {
            previewWindow.document.title = '견적 미리보기 준비 중';
            previewWindow.document.body.textContent = '최신 견적 내용을 저장하는 중입니다…';
        }

        setPreviewSaving(true);
        try {
            const saved = await saveQuoteBasics();
            if (!saved) {
                previewWindow?.close();
                return;
            }
            if (!previewWindow) {
                alert('견적 내용은 저장되었습니다. 브라우저에서 팝업을 허용한 뒤 미리보기를 다시 눌러 주세요.');
                return;
            }
            previewWindow.location.replace(`${estimatePageUrl}?preview=${Date.now()}`);
        } finally {
            setPreviewSaving(false);
        }
    };
    const quoteDocStatusText = quoteSent
        ? '발송 완료 · 재발송 가능'
        : hasQuoteItinerary && !canSendEstimate
            ? `일정 작성됨 · ${missingSendItems[0] || '확인 필요'}`
        : canSendEstimate
            ? hasQuoteItinerary ? '작성됨 · 발송 대기' : '금액만 발송 가능'
            : '확정 일정·금액 입력 필요';
    const copyEstimatePageUrl = async () => {
        await navigator.clipboard.writeText(estimatePageUrl);
        setCopiedEstimateUrl(true);
        setTimeout(() => setCopiedEstimateUrl(false), 1500);
    };
    const copyEstimateCustomerMessage = async () => {
        const message = [
            `${request.name} 님`,
            '',
            `안녕하세요. ${BRAND.name}입니다.`,
            '견적이 준비되었습니다.',
            '아래 링크에서 일정·요금을 확인해 주세요.',
            estimatePageUrl,
            '',
            '내용에 문제가 없으시면 페이지 안의 예약 상담으로 진행해 주세요.',
        ].join('\n');
        await navigator.clipboard.writeText(message);
        setCopiedEstimateUrl(true);
        setTimeout(() => setCopiedEstimateUrl(false), 1500);
    };
    const statusTone: Record<string, string> = { new: 'b-red', processing: 'b-amber', answered: 'b-blue', reservation_requested: 'b-purple', converted: 'b-gray', completed: 'b-green' };
    const nextAction = (() => {
        if (request.status === 'converted' || request.status === 'completed') return null;
        if (request.status === 'reservation_requested') return { label: '예약으로 전환', desc: '고객이 예약을 요청했습니다 — 확정 내용으로 전환하세요.', icon: 'sync_alt', onClick: onOpenConvert };
        if (!canSendEstimate) return { label: '견적 작성 · 누락 항목 확인', desc: `${missingSendItems[0] || '필수 항목'} 확인이 필요합니다.`, icon: 'edit_note', onClick: () => scrollToSec('quote') };
        if (request.status !== 'answered') return { label: '견적서 발송 처리', desc: '입력 완료 — 고객에게 견적을 발송하세요.', icon: 'send', onClick: handleSend };
        return { label: '재발송 · 고객 응답 대기', desc: '발송 완료 — 예약 요청을 기다리는 중입니다.', icon: 'mark_email_read', onClick: handleSend };
    })();

    const overview = { ...legacyCustomerOverview(request, docInitialContent), documentLabel: '견적서 확인·전달', documentHint: '견적 내용을 확인한 뒤 안내문 복사·발송을 선택합니다.',
        disabledActions: ['payments', 'assignments', 'operations'], disabledActionReason: '예약으로 전환한 뒤 결제·배정·운영을 관리합니다.' };
    const overviewAction = (action: string) => {
        if (workspaceBusy) return;
        if (action === 'back') { closeWorkspace(); return; }
        if (action === 'customer-link') { void copyEstimatePageUrl(); return; }
        if (action === 'edit-itinerary') { setWorkflowOpen(true); setDocEditorOpen(true); return; }
        if (action === 'edit-info') { setIsEditing(true); scrollToSec('info'); return; }
        if (['view-info', 'flights', 'travelers'].includes(action)) { scrollToSec('info'); return; }
        if (overview.disabledActions.includes(action)) return;
        if (action === 'convert') { onOpenConvert(); return; }
        scrollToSec(action === 'history' || action === 'notes' ? 'info' : 'quote');
    };
    return (<>
        <div className={fullPage ? 'product-customer-page' : 'drawer-scrim reservation-workspace-scrim'} style={fullPage ? undefined : { zIndex: 100 }} onClick={fullPage ? undefined : closeWorkspace}>
            <div className={`drawer reservation-workspace tcom${fullPage ? ' product-customer-fullpage legacy-customer-fullpage' : ''}`} onClick={e => e.stopPropagation()}>
                {workspaceNotice && <div className="product-customer-warning" role="status">{workspaceNotice}</div>}
                {fullPage && <><CustomerWorkspaceOverview model={overview} onAction={overviewAction} busy={workspaceBusy} />{workflowOpen && <div className="product-customer-controls"><button type="button" className="btn btn-ghost" aria-controls="legacy-customer-detail" disabled={workspaceBusy || workspaceDirty || isEditing} onClick={() => setWorkflowOpen(false)}>고객 현황으로 돌아가기</button></div>}</>}
                <div id="legacy-customer-detail" className="product-customer-detail" hidden={fullPage && !workflowOpen} onChangeCapture={() => setWorkspaceDirty(true)} inert={workspaceBusy} aria-busy={workspaceBusy}>

                {/* Header */}
                <div className="drawer-head">
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="row" style={{ gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                            <span className="tag-type quote">맞춤견적</span>
                            <span className="cell-mono" style={{ fontSize: 13 }}>#{request.id.slice(0, 8).toUpperCase()}</span>
                        </div>
                        <div className="page-title" style={{ fontSize: 17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{request.destination || '맞춤 견적'} · {request.name}</div>
                    </div>
                    <span className={`badge ${statusTone[request.status] || 'b-gray'}`}>{statusMeta.label}</span>
                    <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={closeWorkspace}><span className="material-symbols-outlined">close</span></button>
                </div>

                {/* NEXT — 견적 워크플로의 다음 할 일 */}
                <div className={`next-bar${nextAction ? '' : ' all-done'}`}>
                    <span className="nb-label">{nextAction ? '다음 할 일' : '처리 완료'}</span>
                    {nextAction ? (
                        <>
                            <button className="btn btn-sm btn-ink" onClick={nextAction.onClick}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{nextAction.icon}</span>{nextAction.label}
                            </button>
                            <span className="nb-desc">{nextAction.desc}</span>
                        </>
                    ) : (
                        <span className="row" style={{ gap: 6, fontSize: 13, fontWeight: 800, color: 'var(--mrt-green)' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 17 }}>check_circle</span>예약 전환까지 완료된 견적입니다
                        </span>
                    )}
                    <span className="step-dots">
                        {workflowSteps.map((s, i) => <span key={s.key} className={`sd${i < currentStepIndex ? ' on' : ''}`} title={s.label} />)}
                        <span className="sd-n">{currentStepIndex}/{workflowSteps.length}</span>
                    </span>
                </div>

                {/* 섹션 앵커 */}
                <div className="tc-anchors">
                    {([['info', '요청 정보'], ['quote', '견적 제안서 작성']] as const).map(([id, label]) => (
                        <button key={id} type="button" className={activeSec === id ? 'active' : ''} onClick={() => scrollToSec(id)}>{label}</button>
                    ))}
                </div>

                <div className="reservation-workspace-main">
                <div className="drawer-body reservation-workspace-body" ref={bodyRef}>
                    <div className="stack" style={{ gap: 18 }}>

                    <section id="qsec-info" style={{ scrollMarginTop: 8 }}>
                        <div className="stack" style={{ gap: 14 }}>
                        <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'stretch' }}>
                            <div className="card">
                                <div className="card-head"><span className="material-symbols-outlined" style={{ fontSize: 17, color: 'var(--mrt-gray-600)' }}>person</span><h2>신청자 정보</h2></div>
                                <div className="card-pad" style={{ paddingTop: 12 }}>
                                    <div className="kv"><span>이름</span><b>{request.name}</b></div>
                                    <div className="kv"><span>연락처</span><b style={{ fontVariantNumeric: 'tabular-nums' }}>{request.phone || '—'}</b></div>
                                    <div className="kv" style={{ borderBottom: 'none' }}><span>이메일</span><b style={{ textAlign: 'right' }}>{request.email || '—'}</b></div>
                                </div>
                            </div>
                            <div className="card">
                                <div className="card-head"><span className="material-symbols-outlined" style={{ fontSize: 17, color: 'var(--mrt-gray-600)' }}>explore</span><h2>여행 조건</h2>
                                    <div className="spacer" style={{ flex: 1 }} />
                                    <button className="link-action" onClick={() => isEditing ? handleSaveEdit() : setIsEditing(true)}>{isEditing ? '저장 완료' : '정보 수정'}</button>
                                </div>
                                <div className="card-pad" style={{ paddingTop: 12 }}>
                                    <div className="kv"><span>여행지</span>{isEditing ? <input className="inp" style={{ width: 160, height: 30 }} value={editForm.destination} onChange={e => setEditForm({ ...editForm, destination: e.target.value })} /> : <b>{request.destination || '미정'}</b>}</div>
                                    <div className="kv"><span>인원</span>{isEditing ? <input className="inp" style={{ width: 120, height: 30 }} value={editForm.headcount} onChange={e => setEditForm({ ...editForm, headcount: e.target.value })} /> : <b>{request.headcount || '미정'}</b>}</div>
                                    <div className="kv"><span>희망 일정</span>{isEditing ? <input className="inp" style={{ width: 160, height: 30 }} value={editForm.period} onChange={e => setEditForm({ ...editForm, period: e.target.value })} /> : <b>{request.period || '미정'}</b>}</div>
                                    <div className="kv" style={{ borderBottom: 'none' }}><span>예산 / 차량</span>{isEditing ? <input className="inp" style={{ width: 120, height: 30 }} value={editForm.budget} onChange={e => setEditForm({ ...editForm, budget: e.target.value })} /> : <b>{request.budget || '미정'} · {request.vehicle || '차량 미정'}</b>}</div>
                                </div>
                            </div>
                        </div>
                        <div className="card">
                            <div className="card-head"><span className="material-symbols-outlined" style={{ fontSize: 17, color: 'var(--mrt-gray-600)' }}>format_list_bulleted</span><h2>상세 요청</h2></div>
                            <div className="card-pad" style={{ paddingTop: 12 }}>
                                <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                                    {request.travelTypes.map(t => <span key={t} className="badge b-blue">{t}</span>)}
                                    {request.accommodations.map(t => <span key={t} className="badge b-gray">{t}</span>)}
                                </div>
                                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{request.additionalRequest || '추가 요청사항이 없습니다.'}</p>
                            </div>
                        </div>
                        </div>
                    </section>

                    <section id="qsec-quote" style={{ scrollMarginTop: 8 }}>
                        <div className="card">
                            <div className="card-head"><span className="material-symbols-outlined" style={{ fontSize: 17, color: 'var(--mrt-gray-600)' }}>edit_note</span><h2>견적 제안서 작성 — 일정·금액</h2>
                                <div className="spacer" style={{ flex: 1 }} />
                                <button className="btn btn-sm btn-ghost" onClick={saveQuoteBasics}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>일정·금액 저장
                                </button>
                            </div>
                            <div className="card-pad" style={{ paddingTop: 12 }}>
                                <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <label className="field" style={{ marginBottom: 0 }}><span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 5 }}>시작일</span>
                                        <input type="date" className="inp" value={confirmedStartDate} onChange={(e) => setConfirmedStartDate(e.target.value)} /></label>
                                    <label className="field" style={{ marginBottom: 0 }}><span style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 5 }}>종료일</span>
                                        <input type="date" className="inp" value={confirmedEndDate} onChange={(e) => setConfirmedEndDate(e.target.value)} /></label>
                                </div>
                                <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                                    <div className="pay-cell">
                                        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>1인 기준가</span></div>
                                        <div className="row" style={{ gap: 4 }}>
                                            <input type="text" className="inp" style={{ textAlign: 'right', fontWeight: 800 }} value={formatNumber(priceDetail.pricePerPerson)} placeholder="0"
                                                onChange={(e) => updatePricePerPerson(unformatNumber(e.target.value))} />
                                            <span className="cell-muted" style={{ fontSize: 12, flex: 'none' }}>원</span>
                                        </div>
                                    </div>
                                    <div className="pay-cell">
                                        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>인원</span></div>
                                        <div className="row" style={{ gap: 4 }}>
                                            <input type="number" min={1} className="inp" style={{ textAlign: 'right', fontWeight: 800 }} value={priceDetail.peopleCount}
                                                onChange={(e) => updatePeopleCount(Number(e.target.value))} />
                                            <span className="cell-muted" style={{ fontSize: 12, flex: 'none' }}>명</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                                    <div className="pay-cell">
                                        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                                            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>총 견적금액</span>
                                            <label className="row" style={{ gap: 5, fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)' }}>
                                                <input type="checkbox" checked={priceDetail.manualTotal} onChange={(e) => updateManualTotal(e.target.checked)} />
                                                직접 입력
                                            </label>
                                        </div>
                                        <div className="row" style={{ gap: 4 }}>
                                            <input type="text" className="inp" style={{ textAlign: 'right', fontWeight: 800 }} value={formatNumber(priceDetail.totalAmount)} placeholder="0"
                                                disabled={!priceDetail.manualTotal}
                                                onChange={(e) => setPriceDetail(prev => ({ ...prev, totalAmount: unformatNumber(e.target.value) }))} />
                                            <span className="cell-muted" style={{ fontSize: 12, flex: 'none' }}>원</span>
                                        </div>
                                    </div>
                                    <div className="pay-cell paid">
                                        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>예약금</span></div>
                                        <div className="row" style={{ gap: 4 }}>
                                            <input type="text" className="inp" style={{ textAlign: 'right', fontWeight: 800 }} value={formatNumber(priceDetail.deposit)} placeholder="0"
                                                onChange={(e) => setPriceDetail({ ...priceDetail, deposit: unformatNumber(e.target.value) })} />
                                            <span className="cell-muted" style={{ fontSize: 12, flex: 'none' }}>원</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="row" style={{ justifyContent: 'space-between', marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--mrt-gray-50)' }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>예상 잔금 (현지 결제)</span>
                                    <b className="cell-price" style={{ fontSize: 15 }}>{quoteBalance.toLocaleString('ko-KR')}원</b>
                                </div>
                            </div>
                        </div>
                    </section>

                    </div>
                </div>

                {/* 우측 액션 레일 — 확정 문서 발송과 같은 문서 단위 흐름 */}
                <aside className="reservation-action-rail">
                    <div className="action-rail-head">
                        <div>
                            <span className="action-rail-eyebrow">DOCUMENTS</span>
                            <h2>문서와 고객 발송</h2>
                        </div>
                        <span className={`badge ${quoteSent ? 'b-green' : canSendEstimate ? 'b-blue' : 'b-amber'}`}>
                            {quoteSent ? '1/1 완료' : '0/1 대기'}
                        </span>
                    </div>

                    <div className="action-rail-stack">
                        <section className="action-doc active">
                            <button type="button" className="action-doc-title">
                                <span className="action-doc-icon tint-blue"><span className="material-symbols-outlined">request_quote</span></span>
                                <span>
                                    <b>견적 제안서</b>
                                    <small>{quoteDocStatusText}</small>
                                </span>
                                <span className="material-symbols-outlined">{quoteSent ? 'check_circle' : 'chevron_right'}</span>
                            </button>
                            {!quoteSent && (
                                <select className="inp" value={itineraryTemplateId} onChange={(e) => handleTemplateChange(e.target.value)}>
                                    <option value="">일정표 없음 (비용만 안내)</option>
                                    {templatesList.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                                </select>
                            )}
                            <div className="action-doc-buttons">
                                {!quoteSent ? (
                                    <>
                                        <button className="btn btn-sm btn-blue" onClick={handleSend} title={!canSendEstimate ? `확인 필요: ${missingSendItems.join(', ')}` : undefined}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>고객에게 발송
                                        </button>
                                        <button className="btn btn-sm btn-ghost" onClick={() => setDocEditorOpen(true)}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_document</span>{request.documentContent || request.document_content ? '편집' : '견적서 만들기'}
                                        </button>
                                        <button className="btn btn-sm btn-ghost" onClick={handlePreview} disabled={previewSaving}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span>{previewSaving ? '저장 중…' : '미리보기'}
                                        </button>
                                        <button className="btn btn-sm btn-ghost" onClick={copyEstimatePageUrl}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{copiedEstimateUrl ? 'check' : 'content_copy'}</span>{copiedEstimateUrl ? '복사됨' : '링크'}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button className="btn btn-sm btn-blue" onClick={handlePreview} disabled={previewSaving}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span>{previewSaving ? '저장 중…' : '미리보기'}
                                        </button>
                                        <button className="btn btn-sm btn-ghost" onClick={() => setDocEditorOpen(true)}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_document</span>편집
                                        </button>
                                        <button className="btn btn-sm btn-ghost" onClick={copyEstimatePageUrl}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{copiedEstimateUrl ? 'check' : 'content_copy'}</span>{copiedEstimateUrl ? '복사됨' : '링크'}
                                        </button>
                                        <button className="btn btn-sm btn-ghost" onClick={handleSend}>
                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>forward_to_inbox</span>재발송
                                        </button>
                                    </>
                                )}
                            </div>
                        </section>

                        {request.status === 'reservation_requested' && (
                            <button className="btn btn-blue action-send-all" onClick={onOpenConvert}>
                                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>sync_alt</span>예약으로 전환
                            </button>
                        )}
                    </div>

                    <div className="action-rail-group">
                        <h3>고객 공유</h3>
                        <button className="action-link" onClick={copyEstimateCustomerMessage}>
                            <span className="material-symbols-outlined">content_copy</span>
                            <span><b>고객 안내문 복사</b><small>견적 페이지 링크와 확인 안내를 함께 복사합니다.</small></span>
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                        <button className="action-link" onClick={copyEstimatePageUrl}>
                            <span className="material-symbols-outlined">link</span>
                            <span><b>고객 페이지 링크</b><small>고객이 견적 내용과 일정을 확인하는 페이지입니다.</small></span>
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>

                    <div className="action-rail-group">
                        <h3>외부 견적서 링크 <span style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>(선택)</span></h3>
                        <input type="url" className="inp" value={estimateUrl} onChange={(e) => setEstimateUrl(e.target.value)} placeholder="https://... (비우면 시스템 견적 페이지)" />
                    </div>

                    <div className="action-rail-group">
                        <h3>고객 안내문 <span style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>(선택)</span></h3>
                        <div className="row" style={{ gap: 5, marginBottom: 6, flexWrap: 'wrap' }}>
                            {quickNotes.map((note) => (
                                <button key={note.label} className="btn btn-sm btn-ghost" onClick={() => { setAdminNote(note.text); setWorkspaceDirty(true); }}>{note.label}</button>
                            ))}
                        </div>
                        <textarea className="inp" style={{ height: 84, padding: '8px 10px', resize: 'vertical' }} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="고객 화면에 그대로 보이므로 한국어 안내문을 입력하세요." />
                    </div>

                    <div className="action-rail-group">
                        <h3>발송 전 체크</h3>
                        {checklistItems.map((item) => (
                            <div key={item.label} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>{item.label}{item.optional && <span style={{ marginLeft: 4, fontSize: 10.5, color: 'var(--text-tertiary)' }}>선택</span>}</span>
                                <span className="material-symbols-outlined" style={{ fontSize: 17, color: item.done ? 'var(--mrt-green)' : 'var(--mrt-gray-300)' }}>{item.done ? 'check_circle' : 'radio_button_unchecked'}</span>
                            </div>
                        ))}
                    </div>
                </aside>
                </div>

                {/* Footer */}
                <div className="drawer-foot">
                    <span className="cell-muted" style={{ fontSize: 12 }}>요청 일시: {request.date} ({request.createdAt})</span>
                    <div className="spacer" style={{ flex: 1 }} />
                    <button className="btn btn-ghost" onClick={closeWorkspace}>닫기</button>
                </div>
                </div>
            </div>
        </div>


            <ReservationDocumentEditor
                open={docEditorOpen}
                onClose={() => setDocEditorOpen(false)}
                title={`${request.name || '고객'} · 견적 제안서`}
                customer={docCustomer}
                initialContent={docInitialContent}
                onSave={saveQuoteDoc}
            />

    </>
    );
};
