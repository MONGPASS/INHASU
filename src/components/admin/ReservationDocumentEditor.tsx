import React, { useEffect, useState } from 'react';
import {
    TemplatePreview,
    mergeDocumentSettings,
    defaultDocumentSettings,
    parseDayActivitiesText,
    type DocumentSettings,
    type TemplateDay,
    type ActivityType,
} from '../../pages/AdminTemplateManage';
import { api } from '../../lib/api';
import { DEPOSIT_PAYMENT_METHOD } from '../../constants/company';
import { uploadImage } from '../../utils/upload';
import type { DayInfoContent, DetailContentBlock, TimelineContent, TourProduct } from '../../types/product';
import { TouristSpotPickerModal } from './TouristSpotPickerModal';
import { HotelPickerModal } from './HotelPickerModal';
import type { TouristSpot } from '../../types/touristSpot';
import type { Hotel } from '../../types/hotel';

export interface ReservationDocContent {
    name: string;
    description: string;
    days: TemplateDay[];
    documentSettings: DocumentSettings;
}

interface Props {
    open: boolean;
    onClose: () => void;
    title: string;
    documentType?: 'itinerary' | 'contract';
    /** 템플릿(프리셋) 편집 모드 — 고객 없이 샘플 표시, 전체 문서 페이지 탭 노출 */
    templateMode?: boolean;
    /** 실제 고객 데이터 — TemplatePreview 상단/금액에 자동 표시 (템플릿 모드에선 생략) */
    customer?: {
        tripNumber?: string;
        period?: string;
        tripLength?: string;
        headcount?: string;
        name?: string;
        tripType?: string;
        totalAmount?: number;
        deposit?: number;
        localAmount?: number;
        peopleCount?: number;
    };
    /** 저장돼 있던 문서 내용(없으면 템플릿/기본값) */
    initialContent: ReservationDocContent | null;
    onSave: (content: ReservationDocContent, tourDates?: { startDate: string; endDate: string }) => Promise<void>;
    /** 고객 확정 일정의 기준 여행일. 전달된 경우 편집기에서 수정·저장할 수 있다. */
    tourStartDate?: string;
    tourEndDate?: string;
    /** 가이드·숙소 배정 (상세내역의 picker 재사용) */
    assignedGuide?: { name?: string; phone?: string; image?: string } | null;
    dailyAccommodations?: Array<{ day: number; accommodation: { name?: string } }>;
    onAssignGuide?: () => void;
    onAssignAccommodation?: (day: number) => void;
    /** 확정 숙소 배정 해제 — 해당 일차의 dailyAccommodations 항목을 제거 */
    onUnassignAccommodation?: (day: number) => void;
}

export const ReservationDocumentEditor: React.FC<Props> = ({ open, onClose, title, documentType = 'itinerary', templateMode = false, customer, initialContent, onSave, tourStartDate, tourEndDate, assignedGuide, dailyAccommodations, onAssignGuide, onAssignAccommodation, onUnassignAccommodation }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [days, setDays] = useState<TemplateDay[]>([]);
    const [docSettings, setDocSettings] = useState<DocumentSettings>(defaultDocumentSettings());
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [saving, setSaving] = useState(false);
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const [draggedDayIndex, setDraggedDayIndex] = useState<number | null>(null);
    const [products, setProducts] = useState<TourProduct[]>([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [loadingProducts, setLoadingProducts] = useState(false);
    // 예약 상품 일정을 자동으로 불러왔을 때 안내 배너에 표시할 상품명
    const [autoLoadedName, setAutoLoadedName] = useState<string | null>(null);
    // 마스터 픽커 — 관광지(항목 채움) / 호텔(일차 숙박정보 채움)
    const [spotTarget, setSpotTarget] = useState<{ d: number; a: number } | null>(null);
    const [hotelDayIdx, setHotelDayIdx] = useState<number | null>(null);

    useEffect(() => {
        if (!open) return;
        setName(initialContent?.name || customer?.tripType || '');
        setDescription(initialContent?.description || '');
        setDays(Array.isArray(initialContent?.days) ? initialContent!.days : []);
        setDocSettings(mergeDocumentSettings(initialContent?.documentSettings));
        setStartDate(tourStartDate || '');
        setEndDate(tourEndDate || '');
        setSelectedDayIndex(0);
        setAutoLoadedName(null);
    }, [open, initialContent, tourStartDate, tourEndDate]);

    useEffect(() => {
        if (!open || products.length > 0) return;
        setLoadingProducts(true);
        api.products.list()
            .then((data: any) => {
                if (!Array.isArray(data)) return;
                const parse = (value: any, fallback: any = []) => {
                    if (typeof value === 'string') {
                        try { return JSON.parse(value); } catch { return fallback; }
                    }
                    return value || fallback;
                };
                const mapped = data.map((item: any) => ({
                    ...item,
                    mainImages: parse(item.mainImages || item.main_images),
                    galleryImages: parse(item.galleryImages || item.gallery_images),
                    detailImages: parse(item.detailImages || item.detail_images),
                    itineraryImages: parse(item.itineraryImages || item.itinerary_images),
                    itineraryBlocks: parse(item.itineraryBlocks || item.itinerary_blocks),
                    highlights: parse(item.highlights),
                    included: parse(item.included),
                    excluded: parse(item.excluded),
                    pricingOptions: parse(item.pricingOptions || item.pricing_options),
                    accommodationOptions: parse(item.accommodationOptions || item.accommodation_options),
                    vehicleOptions: parse(item.vehicleOptions || item.vehicle_options),
                })) as TourProduct[];
                setProducts(mapped);
                const target = (customer?.tripType || '').replace(/\s+/g, '').toLowerCase();
                // 예약 기간(일수) — "3박 4일"(옛 데이터 "3泊4日")→4. 동명/유사명 상품이 여러 개일 때 예약과 같은 일정의 상품을 고르기 위해 사용
                const targetDays = (() => {
                    const tl = customer?.tripLength || '';
                    const md = tl.match(/(\d+)\s*(?:日|일)/);
                    if (md) return parseInt(md[1], 10);
                    const mn = tl.match(/(\d+)\s*(?:泊|박)/);
                    return mn ? parseInt(mn[1], 10) + 1 : null;
                })();
                const matched = mapped.filter(product => {
                    const productName = (product.name || '').replace(/\s+/g, '').toLowerCase();
                    return productName === target || productName.includes(target) || target.includes(productName);
                }).sort((a, b) => {
                    const an = (a.name || '').replace(/\s+/g, '').toLowerCase();
                    const bn = (b.name || '').replace(/\s+/g, '').toLowerCase();
                    // 1) 예약 상품명과 정확히 일치하는 상품 우선
                    const aExact = an === target ? 1 : 0;
                    const bExact = bn === target ? 1 : 0;
                    if (aExact !== bExact) return bExact - aExact;
                    // 2) 예약 기간(일수)과 같은 상품 우선 (4일 예약에 5일 상품이 잡히는 문제 방지)
                    if (targetDays != null) {
                        const aDay = getProductScheduleStats(a).days === targetDays ? 1 : 0;
                        const bDay = getProductScheduleStats(b).days === targetDays ? 1 : 0;
                        if (aDay !== bDay) return bDay - aDay;
                    }
                    // 3) 그 외에는 일정이 풍부한 상품 우선
                    const aStats = getProductScheduleStats(a);
                    const bStats = getProductScheduleStats(b);
                    return (bStats.days * 1000 + bStats.activities) - (aStats.days * 1000 + aStats.activities);
                })[0];
                if (matched) {
                    setSelectedProductId(matched.id);
                    // 예약 일정표를 처음 여는 경우(저장된 문서 없음) 예약 상품 일정을 자동으로 불러옴
                    const freshDoc = !initialContent || !Array.isArray(initialContent.days) || initialContent.days.length === 0;
                    if (!templateMode && documentType === 'itinerary' && freshDoc && getProductScheduleStats(matched).days > 0) {
                        applyProduct(matched, { auto: true });
                    }
                }
            })
            .finally(() => setLoadingProducts(false));
    }, [open, documentType, customer?.tripType, products.length]);

    const textFromProductItem = (item: any) => {
        if (typeof item === 'string') return item;
        return item?.label || item?.title || item?.name || item?.description || '';
    };

    const parseBlockContent = <T,>(content: T | string): T => {
        if (typeof content !== 'string') return content as T;
        try { return JSON.parse(content) as T; } catch { return content as T; }
    };

    const getProductScheduleStats = (product: TourProduct) => {
        const blocks = product.itineraryBlocks || [];
        return {
            days: blocks.filter(block => block.type === 'dayInfo').length,
            activities: blocks.filter(block => block.type === 'timeline').length,
        };
    };

    const productBlocksToDays = (blocks: DetailContentBlock[] = []): TemplateDay[] => {
        const converted: TemplateDay[] = [];
        let current: TemplateDay | null = null;
        for (const block of blocks) {
            if (block.type === 'dayInfo') {
                const info = parseBlockContent<DayInfoContent>(block.content as DayInfoContent | string);
                current = {
                    day: converted.length + 1,
                    date: info.dayDate || '',
                    title: info.title || '',
                    region: '',
                    summary: info.description || '',
                    activities: [],
                    meals: info.meals || {},
                    accommodation: info.accommodation ? {
                        id: info.accommodationHotelId,
                        name: info.accommodation,
                        location: info.accommodationAddress,
                        images: info.accommodationImages || [],
                        description: info.accommodationDescription,
                    } : null,
                };
                converted.push(current);
                continue;
            }
            if (block.type === 'timeline') {
                if (!current) {
                    current = { day: 1, title: '', region: '', summary: '', activities: [], meals: {}, accommodation: null };
                    converted.push(current);
                }
                const timeline = parseBlockContent<TimelineContent>(block.content as TimelineContent | string);
                current.activities.push({
                    time: '',
                    type: 'sightseeing',
                    title: timeline.title || '',
                    description: timeline.description || '',
                    images: timeline.images || [],
                });
            }
        }
        return converted;
    };

    // 상품의 일정·포함/불포함·가격을 편집기에 적용. auto=true 면 빈 일정일 때만 조용히 적용(경고·확인창 없음)
    const applyProduct = (product: TourProduct, opts?: { auto?: boolean }) => {
        const importedDays = productBlocksToDays(product.itineraryBlocks || []);
        const isEmpty = importedDays.length === 0 || importedDays.every(day => !day.title && !day.summary && day.activities.length === 0);
        if (isEmpty) {
            if (!opts?.auto) window.alert('이 상품은 예전 이미지형 일정만 등록되어 있어 DAY 일정으로 불러올 수 없습니다. 목록에서 DAY 개수가 표시된 동일 이름 상품을 선택해 주세요.');
            return;
        }
        if (!opts?.auto && days.length > 0 && !window.confirm('현재 작성 중인 일정과 문서 설정을 상품 정보로 교체할까요?')) return;
        const included = (product.included || []).map(textFromProductItem).filter(Boolean);
        const excluded = (product.excluded || []).map(textFromProductItem).filter(Boolean);
        const defaultPricing = product.pricingOptions?.find(option => option.people === customer?.peopleCount)
            || product.pricingOptions?.[0];

        setName(product.name || customer?.tripType || '');
        setDescription(product.description || '');
        setDays(importedDays);
        setSelectedDayIndex(0);
        setDocSettings(current => ({
            ...current,
            overview: {
                ...current.overview,
                heroTagline: product.description || current.overview.heroTagline,
                pricePerPerson: String(defaultPricing?.pricePerPerson || product.price || current.overview.pricePerPerson),
                includedText: included.join('\n'),
                excludedText: excluded.join('\n'),
                included: included.slice(0, 8).map((label, index) => ({
                    icon: current.overview.included[index]?.icon || 'check_circle',
                    label,
                })),
            },
            guide: {
                ...current.guide,
                paymentInfo: defaultPricing
                    ? `예약금(${DEPOSIT_PAYMENT_METHOD}): 1인 ${defaultPricing.depositPerPerson.toLocaleString('ko-KR')}원\n현지 잔금(현금): 1인 ${defaultPricing.localPaymentPerPerson.toLocaleString('ko-KR')}원`
                    : current.guide.paymentInfo,
            },
        }));
        if (opts?.auto) setAutoLoadedName(product.name || customer?.tripType || '예약 상품');
    };

    const importSelectedProduct = () => {
        const product = products.find(item => item.id === selectedProductId);
        if (!product) return;
        setAutoLoadedName(null);
        applyProduct(product, { auto: false });
    };

    // ── Day / activity 핸들러 ──
    const updateDay = (idx: number, field: keyof TemplateDay, value: any) =>
        setDays(d => d.map((x, i) => i === idx ? { ...x, [field]: value } : x));
    const addDay = () => setDays(d => {
        setSelectedDayIndex(d.length);
        return [...d, { day: d.length + 1, title: '', region: '', summary: '', activities: [], meals: {}, accommodation: null }];
    });
    const removeDay = (idx: number) => setDays(d => {
        const next = d.filter((_, i) => i !== idx).map((x, i) => ({ ...x, day: i + 1 }));
        setSelectedDayIndex(current => Math.max(0, Math.min(current > idx ? current - 1 : current, next.length - 1)));
        return next;
    });
    // 일차 순서 변경(드래그앤드랍) — 이동 후 DAY 번호를 1..N으로 재정렬
    const moveDay = (from: number, to: number) => setDays(d => {
        if (from === to || to < 0 || to >= d.length) return d;
        const arr = [...d];
        const [moved] = arr.splice(from, 1);
        arr.splice(to, 0, moved);
        return arr.map((x, i) => ({ ...x, day: i + 1 }));
    });
    const handleDayDragStart = (index: number) => setDraggedDayIndex(index);
    const handleDayDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedDayIndex === null || draggedDayIndex === index) return;
        const from = draggedDayIndex;
        moveDay(from, index);
        // 선택된 일차가 이동에 따라 유지되도록 인덱스 보정
        setSelectedDayIndex(sel =>
            sel === from ? index
                : from < sel && index >= sel ? sel - 1
                    : from > sel && index <= sel ? sel + 1
                        : sel
        );
        setDraggedDayIndex(index);
    };
    const handleDayDragEnd = () => setDraggedDayIndex(null);
    const addActivity = (dayIdx: number) => setDays(d => d.map((x, i) => i === dayIdx ? { ...x, activities: [...x.activities, { time: '', type: 'sightseeing' as ActivityType, title: '', description: '' }] } : x));
    const removeActivity = (dayIdx: number, actIdx: number) => setDays(d => d.map((x, i) => i === dayIdx ? { ...x, activities: x.activities.filter((_, j) => j !== actIdx) } : x));
    const updateActivity = (dayIdx: number, actIdx: number, field: 'time' | 'title' | 'description', value: string) =>
        setDays(d => d.map((x, i) => i === dayIdx ? { ...x, activities: x.activities.map((a, j) => j === actIdx ? { ...a, [field]: value } : a) } : x));
    // 일정 항목 순서 변경(드래그앤드랍) — moveDay와 같은 방식, 같은 일차 내에서만 이동
    const moveActivityTo = (dayIdx: number, from: number, to: number) => setDays(d => d.map((x, i) => {
        if (i !== dayIdx || from === to || to < 0 || to >= x.activities.length) return x;
        const acts = [...x.activities];
        const [moved] = acts.splice(from, 1);
        acts.splice(to, 0, moved);
        return { ...x, activities: acts };
    }));
    // 일정 항목 사진 업로드 — AdminTemplateManage의 uploadActivityImages와 동일 패턴(WebP 압축 → R2)
    const uploadActivityImages = async (dayIdx: number, actIdx: number, files: FileList | null) => {
        if (!files?.length) return;
        try {
            const urls = await Promise.all(Array.from(files).map(file => uploadImage(file, 'reservation-docs')));
            setDays(d => d.map((x, i) => i === dayIdx ? { ...x, activities: x.activities.map((a, j) => j === actIdx ? { ...a, images: [...(a.images || []), ...urls] } : a) } : x));
        } catch {
            alert('일정 사진 업로드에 실패했습니다.');
        }
    };
    const removeActivityImage = (dayIdx: number, actIdx: number, imgIdx: number) =>
        setDays(d => d.map((x, i) => i === dayIdx ? { ...x, activities: x.activities.map((a, j) => j === actIdx ? { ...a, images: (a.images || []).filter((_, k) => k !== imgIdx) } : a) } : x));

    // 관광지 마스터 → 해당 항목의 제목(비었을 때만)·설명·사진 채움
    const fillItemFromSpot = (d: number, a: number, spot: TouristSpot) => setDays(prev => prev.map((day, i) => {
        if (i !== d) return day;
        const acts = day.activities.map((act, j) => {
            if (j !== a) return act;
            const keepTitle = (act.title || '').trim().length > 0;
            const desc = [spot.description, spot.address].filter(Boolean).join('\n' + '\n');
            return { ...act, title: keepTitle ? act.title : spot.name_kr, description: desc || act.description, images: (spot.images && spot.images.length > 0) ? [...spot.images] : act.images };
        });
        return { ...day, activities: acts };
    }));
    // 호텔 마스터 → 해당 일차의 숙박 정보 채움
    const fillDayFromHotel = (d: number, hotel: Hotel) => setDays(prev => prev.map((day, i) => i === d ? { ...day, accommodation: { id: hotel.id, name: hotel.name_kr, location: hotel.address || '', images: hotel.images || [], description: hotel.description || '' } } : day));

    // ── documentSettings 핸들러 ──
    const updateDocSection = <K extends keyof DocumentSettings>(section: K, patch: Partial<DocumentSettings[K]>) =>
        setDocSettings(s => ({ ...s, [section]: { ...s[section], ...patch } }));
    const updateIncluded = (idx: number, field: 'icon' | 'label', value: string) =>
        setDocSettings(s => ({ ...s, overview: { ...s.overview, included: s.overview.included.map((it, i) => i === idx ? { ...it, [field]: value } : it) } }));
    const updateCancellation = (idx: number, field: 'period' | 'fee', value: string) =>
        setDocSettings(s => ({ ...s, contract: { ...s.contract, cancellationRows: s.contract.cancellationRows.map((r, i) => i === idx ? { ...r, [field]: value } : r) } }));
    const updateGuideNotice = (idx: number, field: 'title' | 'body', value: string) =>
        setDocSettings(s => ({ ...s, guide: { ...s.guide, notices: s.guide.notices.map((n, i) => i === idx ? { ...n, [field]: value } : n) } }));

    const handleSave = async () => {
        // 빈 일정 저장 방지 — 이대로 저장되면 고객 화면에 '일정은 현재 준비 중입니다'만 떠서
        // "저장했는데 일정표가 안 나온다"로 이어진다.
        if (!templateMode && documentType === 'itinerary' && days.length === 0) {
            const ok = window.confirm('일정(DAY)이 하나도 없습니다.\n이대로 저장하면 고객 화면에는 \'일정은 현재 준비 중입니다\'로 표시됩니다.\n\n계속 저장할까요?\n(취소 후 좌측 \'선택 상품 적용\'을 누르면 상품 일정이 채워집니다)');
            if (!ok) return;
        }
        if (!templateMode && (tourStartDate !== undefined || tourEndDate !== undefined)) {
            if ((startDate && !endDate) || (!startDate && endDate)) {
                alert('여행 시작일과 종료일을 모두 입력해 주세요.');
                return;
            }
            if (startDate && endDate && endDate < startDate) {
                alert('여행 종료일은 시작일보다 빠를 수 없습니다.');
                return;
            }
        }
        setSaving(true);
        try {
            await onSave(
                { name, description, days, documentSettings: docSettings },
                (tourStartDate !== undefined || tourEndDate !== undefined) ? { startDate, endDate } : undefined,
            );
            onClose();
        } catch (e: any) {
            alert('저장 실패: ' + (e?.message || e));
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    const totalAmount = customer?.totalAmount || 0;
    const includedCount = docSettings.overview.included.filter(item => item.label?.trim()).length;
    const excludedCount = docSettings.overview.excludedText.split(/\r?\n/).filter(Boolean).length;
    const selectedDay = days[selectedDayIndex];
    const datesEditable = !templateMode && (tourStartDate !== undefined || tourEndDate !== undefined);
    const editableDuration = (() => {
        if (!startDate || !endDate) return undefined;
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T00:00:00`);
        const nights = Math.round((end.getTime() - start.getTime()) / 86400000);
        return Number.isFinite(nights) && nights >= 0 ? `${nights}박 ${nights + 1}일` : undefined;
    })();
    const editablePeriod = startDate && endDate ? `${startDate} ~ ${endDate}` : (startDate || customer?.period || '');
    const previewCustomer = customer ? {
        ...customer,
        period: datesEditable ? editablePeriod : customer.period,
        tripLength: datesEditable ? (editableDuration || customer.tripLength) : customer.tripLength,
    } : customer;

    return (
        <div className="fixed inset-0 z-[210] bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6">
            <div className="bg-[#F5F7FA] dark:bg-slate-900 rounded-2xl w-full h-full flex flex-col overflow-hidden shadow-2xl">
                <div className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-3 min-w-0">
                        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{templateMode ? '일정 프리셋 편집' : '고객 문서 편집'}</p>
                            <p className="truncate text-lg font-bold text-slate-900 dark:text-white">{title}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">취소</button>
                        <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm font-bold bg-[#287DFA] hover:bg-[#1668DC] text-white rounded-lg inline-flex items-center gap-1.5 disabled:opacity-50">
                            <span className="material-symbols-outlined text-base">check</span>{saving ? '저장 중' : '저장'}
                        </button>
                    </div>
                </div>
                {(customer || (documentType === 'contract' && (onAssignGuide || onAssignAccommodation))) && <div className="flex flex-shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
                    <div className={`grid gap-2 sm:grid-cols-3 ${datesEditable ? 'lg:min-w-[760px] lg:grid-cols-5' : 'lg:min-w-[520px]'}`}>
                        <div className="rounded-2xl border border-[#BBD9FF] bg-[#EAF3FF] px-4 py-3 dark:border-teal-900 dark:bg-teal-950/20">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#1668DC]">고객</p>
                            <p className="mt-1 truncate text-sm font-black text-slate-900 dark:text-white">{customer?.name || '고객명 없음'}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">예약번호</p>
                            <p className="mt-1 truncate text-sm font-black text-slate-900 dark:text-white">{customer?.tripNumber || '-'}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">여행기간</p>
                            <p className="mt-1 truncate text-sm font-black text-slate-900 dark:text-white">{editableDuration || customer?.tripLength || '-'}</p>
                        </div>
                        {datesEditable && <>
                            <label className="rounded-2xl border border-[#BBD9FF] bg-white px-4 py-2 dark:border-blue-800 dark:bg-slate-800">
                                <span className="block text-[10px] font-black uppercase tracking-widest text-[#1668DC]">투어 시작일</span>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full border-0 bg-transparent p-0 text-sm font-black text-slate-900 outline-none dark:text-white" />
                            </label>
                            <label className="rounded-2xl border border-[#BBD9FF] bg-white px-4 py-2 dark:border-blue-800 dark:bg-slate-800">
                                <span className="block text-[10px] font-black uppercase tracking-widest text-[#1668DC]">투어 종료일</span>
                                <input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} className="mt-1 w-full border-0 bg-transparent p-0 text-sm font-black text-slate-900 outline-none dark:text-white" />
                            </label>
                        </>}
                    </div>
                    {documentType === 'contract' && (onAssignGuide || onAssignAccommodation) && (
                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        {onAssignGuide && (
                            <button onClick={onAssignGuide} className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#BBD9FF] bg-white px-4 text-sm font-black text-[#1668DC] shadow-sm transition-colors hover:bg-[#EAF3FF] dark:border-teal-700 dark:bg-slate-800 dark:text-teal-300 dark:hover:bg-teal-900/30">
                                <span className="material-symbols-outlined text-[20px]">{assignedGuide?.name ? 'badge' : 'person_add'}</span>
                                <span>{assignedGuide?.name || '가이드 배정'}</span>
                            </button>
                        )}
                        {onAssignAccommodation && (
                            <div className="flex flex-wrap items-center gap-2">
                                {Array.from({ length: Math.max(days.length, dailyAccommodations?.length || 0, 1) }).map((_, i) => {
                                    const dayNum = i + 1;
                                    const a = dailyAccommodations?.find(d => d.day === dayNum);
                                    return (
                                        <button key={i} onClick={() => onAssignAccommodation(dayNum)} className={`inline-flex h-12 items-center gap-1.5 rounded-xl border px-3 text-xs font-black shadow-sm transition-colors hover:bg-[#EAF3FF] dark:hover:bg-teal-900/30 ${a ? 'border-[#BBD9FF] bg-white text-[#1668DC] dark:border-teal-700 dark:bg-slate-800 dark:text-teal-300' : 'border-dashed border-slate-300 bg-white text-slate-500 dark:border-slate-600 dark:bg-slate-800'}`}>
                                            <span className="material-symbols-outlined text-[18px]">hotel</span>
                                            <span>{dayNum}일차: {a?.accommodation?.name || '숙소 선택'}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        </div>
                    )}
                </div>}
                {documentType === 'contract' && <div className="flex flex-shrink-0 items-center gap-2 border-b border-[#BBD9FF] bg-[#EAF3FF] px-6 py-2 text-xs font-bold text-[#287DFA] dark:border-teal-800 dark:bg-teal-900/20">
                    <span className="material-symbols-outlined text-[16px]">tips_and_updates</span>
                    <span>문서를 클릭해서 수정하고, 상단에서 담당 가이드와 일자별 숙소를 배정하면 일정표·계약서에 함께 반영됩니다.</span>
                </div>}
                {autoLoadedName && (
                    <div className="flex flex-shrink-0 items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-6 py-2 text-xs font-bold text-emerald-700">
                        <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                        <span>예약 상품 「{autoLoadedName}」의 일정을 자동으로 불러왔습니다 — <b>항공편 시간 등만 조정</b>하고 저장하세요.</span>
                        <button onClick={() => setAutoLoadedName(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">
                            <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                    </div>
                )}
                <div className="flex-1 overflow-hidden bg-[#F5F7FA] dark:bg-slate-900">
                    {(
                    <div className="grid h-full grid-cols-[240px_minmax(560px,1fr)_280px] overflow-hidden max-xl:grid-cols-[210px_minmax(520px,1fr)] max-lg:block max-lg:overflow-y-auto">
                        <aside className="overflow-y-auto border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 max-lg:border-b max-lg:border-r-0">
                            <div className="mb-4 rounded-xl border border-[#9CC5FF] bg-[#F5F7FA] p-3">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px] text-[#287DFA]">inventory_2</span>
                                    <div>
                                        <p className="text-xs font-black text-slate-800">상품 정보 불러오기</p>
                                        <p className="text-[9px] font-semibold text-slate-400">일정·가격·포함사항을 재사용합니다.</p>
                                    </div>
                                </div>
                                <select
                                    value={selectedProductId}
                                    onChange={event => {
                                        const v = event.target.value;
                                        setSelectedProductId(v);
                                        // 일정이 비어 있으면 선택 즉시 자동 적용 — "선택하고 저장"만 해도
                                        // 일정이 들어가도록. (기존엔 「선택 상품 적용」을 따로 눌러야 해서
                                        // 빈 일정이 저장되고 고객 화면에 '준비 중'만 뜨는 실수가 잦았다)
                                        if (v) {
                                            const p = products.find(item => item.id === v);
                                            const empty = days.length === 0 || days.every(d => !d.title && !(d.activities?.length));
                                            if (p && empty && getProductScheduleStats(p).days > 0) {
                                                setAutoLoadedName(null);
                                                applyProduct(p, { auto: true });
                                            }
                                        }
                                    }}
                                    className="mt-3 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700 outline-none focus:border-[#287DFA]"
                                    disabled={loadingProducts}
                                >
                                    <option value="">{loadingProducts ? '상품 불러오는 중...' : '상품 선택'}</option>
                                    {products.map(product => {
                                        const stats = getProductScheduleStats(product);
                                        return <option key={product.id} value={product.id}>{product.name} ({stats.days}일 · 일정 {stats.activities}개)</option>;
                                    })}
                                </select>
                                <button
                                    type="button"
                                    onClick={importSelectedProduct}
                                    disabled={!selectedProductId}
                                    className="mt-2 flex h-9 w-full items-center justify-center gap-1 rounded-lg bg-[#287DFA] text-[11px] font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <span className="material-symbols-outlined text-[15px]">download</span>
                                    선택 상품 적용
                                </button>
                            </div>
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">일정 구성</p>
                                    <h2 className="mt-1 text-base font-black text-slate-900 dark:text-white">{days.length}일 일정</h2>
                                </div>
                                <button onClick={addDay} className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#287DFA] text-white" title="DAY 추가">
                                    <span className="material-symbols-outlined text-[18px]">add</span>
                                </button>
                            </div>
                            <div className="space-y-2">
                                {days.map((day, index) => (
                                    <div
                                        key={`${day.day}-${index}`}
                                        onClick={() => setSelectedDayIndex(index)}
                                        onDragOver={(e) => handleDayDragOver(e, index)}
                                        onDrop={handleDayDragEnd}
                                        className={`w-full cursor-pointer rounded-xl border p-3 text-left transition-colors ${selectedDayIndex === index ? 'border-[#287DFA] bg-[#EAF3FF] shadow-sm' : 'border-slate-200 bg-white hover:border-[#9CC5FF]'} ${draggedDayIndex === index ? 'opacity-50' : ''}`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1">
                                                <span
                                                    draggable
                                                    onDragStart={() => handleDayDragStart(index)}
                                                    onDragEnd={handleDayDragEnd}
                                                    onClick={(e) => e.stopPropagation()}
                                                    title="드래그하여 일차 순서 변경"
                                                    className="-ml-1 flex cursor-grab items-center text-slate-300 hover:text-slate-500 active:cursor-grabbing"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">drag_indicator</span>
                                                </span>
                                                <span className="text-[10px] font-black text-[#287DFA]">DAY {day.day}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[9px] font-bold text-slate-400">{day.activities.length}개 일정</span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); if (window.confirm(`DAY ${day.day}을(를) 삭제할까요?`)) removeDay(index); }}
                                                    title="DAY 삭제"
                                                    className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300 hover:bg-red-50 hover:text-red-500"
                                                >
                                                    <span className="material-symbols-outlined text-[15px]">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                        <input
                                            value={day.title || ''}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => updateDay(index, 'title', e.target.value)}
                                            placeholder="일차 제목을 입력하세요"
                                            className="mt-1 w-full truncate border-none bg-transparent p-0 text-xs font-black text-slate-800 outline-none placeholder:font-semibold placeholder:text-slate-300 focus:ring-0"
                                        />
                                        <input
                                            value={day.region || ''}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => updateDay(index, 'region', e.target.value)}
                                            placeholder="지역 미정"
                                            className="mt-0.5 w-full truncate border-none bg-transparent p-0 text-[10px] font-semibold text-slate-400 outline-none placeholder:text-slate-300 focus:ring-0"
                                        />
                                        <input
                                            value={day.date || ''}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => updateDay(index, 'date', e.target.value)}
                                            placeholder={startDate ? '기준일로 자동 계산' : '날짜 직접 입력 (예: 9월 20일)'}
                                            className="mt-0.5 w-full truncate border-none bg-transparent p-0 text-[10px] font-semibold text-[#287DFA] outline-none placeholder:text-slate-300 focus:ring-0"
                                        />
                                    </div>
                                ))}
                                <button onClick={addDay} className="flex w-full items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#9CC5FF] px-3 py-3 text-xs font-black text-[#287DFA] hover:bg-[#EAF3FF]">
                                    <span className="material-symbols-outlined text-[16px]">add</span>
                                    {days.length === 0 ? '첫 번째 DAY 추가' : 'DAY 추가'}
                                </button>
                            </div>
                        </aside>

                        <main className="min-w-0 overflow-hidden p-4 max-lg:h-[760px]">
                            <TemplatePreview
                        name={name}
                        description={description}
                        days={days}
                        documentSettings={docSettings}
                        customer={previewCustomer}
                        assignedGuide={assignedGuide}
                        dailyAccommodations={dailyAccommodations}
                        onNameChange={setName}
                        onDescriptionChange={setDescription}
                        onDocSection={updateDocSection}
                        onIncluded={updateIncluded}
                        onCancellation={updateCancellation}
                        onGuideNotice={updateGuideNotice}
                        onDayChange={updateDay}
                        onActivityChange={updateActivity}
                        onAddDay={addDay}
                        onAddActivity={addActivity}
                        onRemoveDay={removeDay}
                        onRemoveActivity={removeActivity}
                        onDayActivitiesText={(d, text) => setDays(ds => ds.map((x, i) => i === d ? { ...x, activities: parseDayActivitiesText(text) } : x))}
                                onMoveActivity={moveActivityTo}
                                onUploadActivityImages={uploadActivityImages}
                                onRemoveActivityImage={removeActivityImage}
                                onPickSpot={(d, a) => setSpotTarget({ d, a })}
                                onPickHotel={(dayIdx) => { if (!templateMode && onAssignAccommodation) { onAssignAccommodation(dayIdx + 1); } else { setHotelDayIdx(dayIdx); } }}
                                onClearHotel={(dayIdx) => {
                                    // 문서 내용의 숙소 + (예약 모드) 확정 배정을 함께 해제
                                    setDays(prev => prev.map((d, i) => i === dayIdx ? { ...d, accommodation: null } : d));
                                    if (!templateMode && onUnassignAccommodation) onUnassignAccommodation(dayIdx + 1);
                                }}
                                defaultPage={documentType === 'contract' ? 'contract' : 'overview'}
                                focusDayIndex={selectedDayIndex}
                                showPageTabs={true}
                            />
                        </main>

                        <aside className="overflow-y-auto border-l border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 max-xl:hidden">
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">여행 요약</p>
                            <div className="mt-3 rounded-xl border border-slate-200 p-3">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px] text-[#287DFA]">calendar_month</span>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400">여행 기간</p>
                                        <p className="text-xs font-black text-slate-800">{editablePeriod || editableDuration || customer?.period || customer?.tripLength || '-'}</p>
                                    </div>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <div className="rounded-lg bg-slate-50 p-2">
                                        <p className="text-[9px] font-bold text-slate-400">인원</p>
                                        <p className="mt-1 text-xs font-black text-slate-800">{customer?.headcount || '-'}</p>
                                    </div>
                                    <div className="rounded-lg bg-slate-50 p-2">
                                        <p className="text-[9px] font-bold text-slate-400">총 금액</p>
                                        <p className="mt-1 text-xs font-black text-[#FF6F00]">{totalAmount ? `${totalAmount.toLocaleString('ko-KR')}원` : "-"}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 rounded-xl border border-slate-200 p-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-black text-slate-800">현재 DAY</p>
                                    <span className="rounded-full bg-[#EAF3FF] px-2 py-1 text-[10px] font-black text-[#287DFA]">DAY {selectedDay?.day || 0}</span>
                                </div>
                                <dl className="mt-3 space-y-2 text-[11px]">
                                    <div className="flex justify-between gap-3"><dt className="font-bold text-slate-400">지역</dt><dd className="truncate font-black text-slate-700">{selectedDay?.region || '미정'}</dd></div>
                                    <div className="flex justify-between gap-3"><dt className="font-bold text-slate-400">날짜</dt><dd className="truncate font-black text-slate-700">{selectedDay?.date || (startDate ? '기준일 자동 계산' : '미정')}</dd></div>
                                    <div className="flex justify-between gap-3"><dt className="font-bold text-slate-400">주요 일정</dt><dd className="font-black text-slate-700">{selectedDay?.activities.length || 0}개</dd></div>
                                    <div className="flex justify-between gap-3"><dt className="font-bold text-slate-400">숙소</dt><dd className="truncate font-black text-slate-700">{dailyAccommodations?.find(item => item.day === selectedDay?.day)?.accommodation?.name || selectedDay?.accommodation?.name || '미정'}</dd></div>
                                </dl>
                            </div>

                            <div className="mt-4 rounded-xl border border-slate-200 p-3">
                                <p className="text-xs font-black text-slate-800">포함·불포함</p>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <div className="rounded-lg bg-emerald-50 p-2 text-center">
                                        <p className="text-[9px] font-bold text-emerald-600">포함 사항</p>
                                        <p className="mt-1 text-lg font-black text-emerald-700">{includedCount}</p>
                                    </div>
                                    <div className="rounded-lg bg-rose-50 p-2 text-center">
                                        <p className="text-[9px] font-bold text-rose-500">불포함 사항</p>
                                        <p className="mt-1 text-lg font-black text-rose-600">{excludedCount}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 space-y-2">
                                {onAssignGuide && <button onClick={onAssignGuide} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-left text-xs font-black text-slate-700 hover:border-[#287DFA]">
                                    <span className="material-symbols-outlined text-[18px] text-[#287DFA]">badge</span>{assignedGuide?.name || '담당 가이드 배정'}
                                </button>}
                                {onAssignAccommodation && selectedDay && <button onClick={() => onAssignAccommodation(selectedDay.day)} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-left text-xs font-black text-slate-700 hover:border-[#287DFA]">
                                    <span className="material-symbols-outlined text-[18px] text-[#287DFA]">hotel</span>DAY {selectedDay.day} 숙소 배정
                                </button>}
                            </div>
                        </aside>
                    </div>
                    )}
                </div>
            </div>

            {/* 마스터 픽커 — 편집기(z-210) 위에 표시 */}
            <TouristSpotPickerModal open={spotTarget !== null} onClose={() => setSpotTarget(null)} onPick={(spot) => { if (spotTarget) fillItemFromSpot(spotTarget.d, spotTarget.a, spot); setSpotTarget(null); }} />
            <HotelPickerModal open={hotelDayIdx !== null} onClose={() => setHotelDayIdx(null)} onPick={(hotel) => { if (hotelDayIdx !== null) fillDayFromHotel(hotelDayIdx, hotel); setHotelDayIdx(null); }} />
        </div>
    );
};
