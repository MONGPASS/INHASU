import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { api } from '../lib/api';
import { uploadImage } from '../utils/upload';

// Review text constraints — keep in sync with any backend validation.
const REVIEW_MIN_LENGTH = 10;
const REVIEW_MAX_LENGTH = 2000;

type Mode = 'reservation' | 'free';

// Draft autosave key — survives login redirects and accidental navigations.
const DRAFT_KEY = 'review-write-draft';

interface ReviewDraft {
    mode: Mode;
    selectedReservationId: string;
    selectedProductId: string;
    visitMonth: string;
    rating: number;
    content: string;
    images: string[];
}

const loadDraft = (): ReviewDraft | null => {
    try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        // Minimal shape check — bail out if anything looks off so we never crash
        // because of a malformed draft from an older app version.
        if (typeof parsed !== 'object' || parsed === null) return null;
        return parsed as ReviewDraft;
    } catch {
        return null;
    }
};

const clearDraft = () => {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
};

interface ReservationLite {
    id: string;
    productId?: string;
    productName: string;
    startDate: string;
    endDate: string;
}

interface ReservationApiRow {
    id: string;
    userId?: string;
    user_id?: string;
    customerEmail?: string;
    customer_email?: string;
    email?: string;
    productId?: string;
    product_id?: string;
    productName?: string;
    product_name?: string;
    startDate?: string;
    start_date?: string;
    endDate?: string;
    end_date?: string;
    status?: string;
}

interface ProductLite {
    id: string;
    name: string;
    thumbnail?: string;
}

const STAR_FILL = '#facc15';
const STAR_EMPTY = '#e5e7eb';

// Build YYYY-MM options for the last 24 months (most-recent first) for the visit-month picker.
const buildVisitMonthOptions = (): { value: string; label: string }[] => {
    const out: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
        out.push({ value, label });
    }
    return out;
};

export const ReviewWrite: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const invitedReservationId = searchParams.get('reservationId') || '';

    // Initialize from any persisted draft so users who got bounced through the
    // login flow (or accidentally navigated away) don't lose what they typed.
    const initialDraft = loadDraft();

    const [mode, setMode] = useState<Mode>(initialDraft?.mode ?? 'reservation');
    const [selectedReservationId, setSelectedReservationId] = useState<string>(invitedReservationId || initialDraft?.selectedReservationId || '');
    const [selectedProductId, setSelectedProductId] = useState<string>(initialDraft?.selectedProductId ?? '');
    const [visitMonth, setVisitMonth] = useState<string>(initialDraft?.visitMonth ?? '');
    const [rating, setRating] = useState<number>(initialDraft?.rating ?? 4);
    const [content, setContent] = useState(initialDraft?.content ?? '');
    const [images, setImages] = useState<string[]>(initialDraft?.images ?? []);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Autosave the draft on every change. Cheap (small JSON, sessionStorage)
    // and avoids the user losing input across login redirects.
    useEffect(() => {
        const draft: ReviewDraft = {
            mode,
            selectedReservationId,
            selectedProductId,
            visitMonth,
            rating,
            content,
            images,
        };
        try {
            sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch {
            // sessionStorage might be unavailable (private mode); silently skip.
        }
    }, [mode, selectedReservationId, selectedProductId, visitMonth, rating, content, images]);

    const [completedReservations, setCompletedReservations] = useState<ReservationLite[]>([]);
    const [allProducts, setAllProducts] = useState<ProductLite[]>([]);

    const visitMonthOptions = useMemo(buildVisitMonthOptions, []);

    useEffect(() => {
        // Fetch user's completed reservations.
        // api.auth.me() already unwraps the { user } envelope and returns the
        // user object directly (or null), so we don't read `.user` on the result.
        const fetchReservations = async () => {
            try {
                const me = await api.auth.me();
                if (!me) return;

                const data = await api.reservations.list();
                if (!Array.isArray(data)) return;
                const reservationData = data as ReservationApiRow[];

                const today = new Intl.DateTimeFormat('sv-SE', {
                    timeZone: 'Asia/Tokyo',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                }).format(new Date());
                const myCompleted = reservationData.filter((r) => {
                    const endDate = String(r.endDate || r.end_date || '').slice(0, 10);
                    const belongsToUser = (r.userId || r.user_id) === me.id
                        || (!!me.email && String(r.customerEmail || r.customer_email || r.email || '').toLowerCase() === me.email.toLowerCase());
                    const eligibleStatus = ['confirmed', 'paid', 'completed'].includes(r.status || '');
                    const tourHasEnded = r.status === 'completed' || (!!endDate && endDate < today);
                    return belongsToUser && eligibleStatus && tourHasEnded;
                });
                myCompleted.sort((a, b) => new Date(b.startDate || b.start_date || '').getTime() - new Date(a.startDate || a.start_date || '').getTime());

                const mapped: ReservationLite[] = myCompleted.map((r) => ({
                    id: r.id,
                    productId: r.productId || r.product_id,
                    productName: r.productName || r.product_name || '몽골 투어',
                    startDate: r.startDate || r.start_date || '',
                    endDate: r.endDate || r.end_date || '',
                }));
                setCompletedReservations(mapped);

                if (invitedReservationId && mapped.some((r) => r.id === invitedReservationId)) {
                    setMode('reservation');
                    setSelectedReservationId(invitedReservationId);
                }

                // If the user has no completed reservations, default to "free" mode so they
                // can still write a review (off-platform / Instagram / custom-quote travelers).
                if (mapped.length === 0) {
                    setMode('free');
                }
            } catch (error) {
                console.error('Failed to fetch reservations:', error);
            }
        };

        // Fetch active products (used by free-mode product picker)
        const fetchProducts = async () => {
            try {
                const data = await api.products.list();
                if (!Array.isArray(data)) return;
                const mapped: ProductLite[] = data
                    .filter((p: any) => p.status === 'active')
                    .map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        thumbnail: p.thumbnail || (Array.isArray(p.mainImages) && p.mainImages[0]) || (Array.isArray(p.main_images) && p.main_images[0]),
                    }));
                setAllProducts(mapped);
            } catch (error) {
                console.error('Failed to fetch products:', error);
            }
        };

        fetchReservations();
        fetchProducts();
    }, [invitedReservationId]);

    const selectedReservation = completedReservations.find(r => r.id === selectedReservationId);
    const selectedProduct = allProducts.find(p => p.id === selectedProductId);

    const canSubmit = useMemo(() => {
        if (submitting) return false;
        if (content.trim().length < REVIEW_MIN_LENGTH) return false;
        if (mode === 'reservation') return !!selectedReservationId;
        if (mode === 'free') return !!selectedProductId && !!visitMonth;
        return false;
    }, [submitting, content, mode, selectedReservationId, selectedProductId, visitMonth]);

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        const maxImages = 10;
        const remainingSlots = maxImages - images.length;
        const filesToProcess = Array.from(files).slice(0, remainingSlots);

        try {
            const uploadPromises = filesToProcess.map(file => uploadImage(file, 'reviews'));
            const uploadedUrls = await Promise.all(uploadPromises);
            setImages(prev => [...prev, ...uploadedUrls]);
        } catch (error) {
            alert('이미지 업로드에 실패했습니다.');
        }

        event.target.value = '';
    };

    const handleRemoveImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!canSubmit) return;

        // Strip any HTML/script tags the user might paste; keep plain text only.
        const sanitized = DOMPurify.sanitize(content, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();

        if (sanitized.length < REVIEW_MIN_LENGTH) {
            alert(`후기는 ${REVIEW_MIN_LENGTH}자 이상 작성해 주세요.`);
            return;
        }
        if (sanitized.length > REVIEW_MAX_LENGTH) {
            alert(`후기는 ${REVIEW_MAX_LENGTH}자 이내로 작성해 주세요.`);
            return;
        }

        // Resolve which tour the review is about based on the active mode.
        let productId = '';
        let productName = '';
        let visitDateLabel = '';

        if (mode === 'reservation' && selectedReservation) {
            productId = selectedReservation.productId || '';
            productName = selectedReservation.productName;
            visitDateLabel = selectedReservation.startDate.slice(0, 7) + ' 방문';
        } else if (mode === 'free' && selectedProduct) {
            productId = selectedProduct.id;
            productName = selectedProduct.name;
            visitDateLabel = visitMonth + ' 방문';
        } else {
            return;
        }

        setSubmitting(true);
        try {
            // api.auth.me() returns the user object directly (or null).
            const me = await api.auth.me();
            if (!me) {
                // Session expired mid-write — bounce to login. AuthGuard catches the
                // page-entry case; this branch only triggers on a stale session.
                navigate('/login');
                return;
            }

            const reviewData = {
                product_id: productId,
                product_name: productName,
                rating,
                title: `${productName} 후기`,
                content: sanitized,
                images,
                visit_date: visitDateLabel,
            };

            if (mode === 'reservation' && selectedReservation) {
                await api.reviews.createForReservation(selectedReservation.id, reviewData);
            } else {
                await api.reviews.create(reviewData);
            }

            // Submission succeeded — discard the persisted draft so the form is
            // empty next time the user lands here.
            clearDraft();
            setIsSuccessModalOpen(true);
        } catch (error: any) {
            console.error('Failed to save review:', error);
            alert('후기 저장에 실패했습니다: ' + (error.message || 'Unknown error'));
        } finally {
            setSubmitting(false);
        }
    };

    const hasReservations = completedReservations.length > 0;

    return (
        <div className="bg-background-light dark:bg-background-dark font-display text-[#0e1a18] dark:text-white min-h-screen">
            <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark group/design-root overflow-x-hidden">
                {/* TopAppBar */}
                <div className="sticky top-0 z-50 flex items-center bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-4 justify-between border-b border-gray-100 dark:border-zinc-800">
                    <button
                        onClick={() => navigate(-1)}
                        className="text-[#0e1a18] dark:text-white flex size-10 items-center justify-start cursor-pointer"
                    >
                        <span className="material-symbols-outlined">arrow_back_ios</span>
                    </button>
                    <h2 className="text-[#0e1a18] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-10">후기 작성</h2>
                </div>

                <div className="flex-1 pb-32">
                    {/* Mode toggle: pick how to identify the tour the review is about */}
                    <div className="px-4 pt-6">
                        <h3 className="text-[#0e1a18] dark:text-white text-xl font-bold leading-tight tracking-[-0.015em] mb-4">
                            참가하신 투어
                        </h3>
                        <div className="grid grid-cols-2 gap-2 mb-4 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl">
                            <button
                                type="button"
                                onClick={() => hasReservations && setMode('reservation')}
                                disabled={!hasReservations}
                                className={`py-2.5 rounded-lg text-sm font-bold transition-all ${mode === 'reservation'
                                    ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm'
                                    : 'text-gray-500 disabled:opacity-50'
                                    }`}
                            >
                                예약에서 선택{hasReservations ? ` (${completedReservations.length}건)` : ''}
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('free')}
                                className={`py-2.5 rounded-lg text-sm font-bold transition-all ${mode === 'free'
                                    ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm'
                                    : 'text-gray-500'
                                    }`}
                            >
                                투어 직접 선택
                            </button>
                        </div>

                        {/* Reservation mode list */}
                        {mode === 'reservation' && (
                            <div className="flex flex-col gap-3">
                                {hasReservations ? (
                                    completedReservations.map((reservation) => (
                                        <div
                                            key={reservation.id}
                                            onClick={() => setSelectedReservationId(reservation.id)}
                                            className={`flex items-center gap-4 bg-white dark:bg-[#1a2e2a] p-4 rounded-xl border-2 shadow-sm cursor-pointer transition-all ${selectedReservationId === reservation.id ? 'border-primary' : 'border-transparent opacity-60'
                                                }`}
                                        >
                                            <div className="bg-primary/10 flex items-center justify-center aspect-square rounded-lg size-16 shrink-0">
                                                <span className="material-symbols-outlined text-primary">tour</span>
                                            </div>
                                            <div className="flex flex-col justify-center flex-1 min-w-0">
                                                <p className="text-[#0e1a18] dark:text-white text-base font-bold leading-normal line-clamp-1">
                                                    {reservation.productName}
                                                </p>
                                                <p className={`text-sm font-medium leading-normal ${selectedReservationId === reservation.id ? 'text-primary' : 'text-gray-500'}`}>
                                                    {reservation.startDate} {reservation.endDate !== reservation.startDate && `- ${reservation.endDate.slice(5)}`}
                                                </p>
                                            </div>
                                            {selectedReservationId === reservation.id && (
                                                <div className="shrink-0">
                                                    <span
                                                        className="material-symbols-outlined text-primary"
                                                        style={{ fontVariationSettings: "'FILL' 1" }}
                                                    >
                                                        check_circle
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-gray-400">
                                        <p>완료된 예약이 없습니다.</p>
                                        <p className="text-xs pt-2">'투어 직접 선택'에서도 후기를 남길 수 있습니다.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Free mode: product picker + visit month */}
                        {mode === 'free' && (
                            <div className="flex flex-col gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-[#0e1a18] dark:text-white mb-2">
                                        투어 선택
                                    </label>
                                    <select
                                        value={selectedProductId}
                                        onChange={(e) => setSelectedProductId(e.target.value)}
                                        className="w-full p-3 rounded-xl bg-white dark:bg-[#1a2e2a] border border-gray-200 dark:border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-base text-[#0e1a18] dark:text-white"
                                    >
                                        <option value="">— 투어를 선택해 주세요 —</option>
                                        {allProducts.map((p) => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-[#0e1a18] dark:text-white mb-2">
                                        여행 시기
                                    </label>
                                    <select
                                        value={visitMonth}
                                        onChange={(e) => setVisitMonth(e.target.value)}
                                        className="w-full p-3 rounded-xl bg-white dark:bg-[#1a2e2a] border border-gray-200 dark:border-zinc-700 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-base text-[#0e1a18] dark:text-white"
                                    >
                                        <option value="">— 여행하신 달을 선택해 주세요 —</option>
                                        {visitMonthOptions.map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section: Rating */}
                    <div className="px-4 pt-8">
                        <h3 className="text-[#0e1a18] dark:text-white text-xl font-bold leading-tight tracking-[-0.015em] mb-2">이번 여행은 어떠셨나요?</h3>
                        <p className="text-gray-500 text-sm mb-6">별점을 선택해 주세요.</p>
                        <div className="flex justify-center gap-2 py-4">
                            {[1, 2, 3, 4, 5].map((star) => {
                                const on = star <= rating;
                                return (
                                    <span
                                        key={star}
                                        onClick={() => setRating(star)}
                                        className="material-symbols-outlined cursor-pointer"
                                        style={{
                                            fontSize: '36px',
                                            color: on ? STAR_FILL : STAR_EMPTY,
                                            fontVariationSettings: on ? "'FILL' 1" : "'FILL' 0",
                                        }}
                                    >
                                        star
                                    </span>
                                );
                            })}
                        </div>
                    </div>

                    {/* Section: Photo Upload */}
                    <div className="px-4 pt-8">
                        <div className="flex justify-between items-end mb-4">
                            <h3 className="text-[#0e1a18] dark:text-white text-xl font-bold leading-tight tracking-[-0.015em]">사진 업로드</h3>
                            <p className="text-gray-500 text-sm"><span className="text-primary font-bold">{images.length}</span>/10</p>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                            {/* Upload Button */}
                            <label className="flex flex-col items-center justify-center shrink-0 size-24 bg-white dark:bg-[#1a2e2a] border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageUpload}
                                    className="hidden"
                                    disabled={images.length >= 10}
                                />
                                <span className="material-symbols-outlined text-gray-400">add_a_photo</span>
                                <span className="text-[10px] text-gray-400 mt-1 font-bold">추가</span>
                            </label>

                            {/* Uploaded Images */}
                            {images.map((image, index) => (
                                <div
                                    key={index}
                                    className="relative shrink-0 size-24 rounded-xl bg-center bg-cover"
                                    style={{ backgroundImage: `url("${image}")` }}
                                >
                                    <div
                                        onClick={() => handleRemoveImage(index)}
                                        className="absolute -top-2 -right-2 bg-gray-900 text-white rounded-full p-1 border-2 border-white dark:border-zinc-900 shadow-sm cursor-pointer hover:bg-red-600 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-xs block">close</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Section: Detailed Review */}
                    <div className="px-4 pt-8 pb-10">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[#0e1a18] dark:text-white text-xl font-bold leading-tight tracking-[-0.015em]">상세 후기</h3>
                            <span className={`text-xs font-medium ${content.length > REVIEW_MAX_LENGTH ? 'text-red-500' : content.length >= REVIEW_MIN_LENGTH ? 'text-primary' : 'text-gray-400'}`}>
                                {content.length} / {REVIEW_MAX_LENGTH}
                            </span>
                        </div>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value.slice(0, REVIEW_MAX_LENGTH))}
                            maxLength={REVIEW_MAX_LENGTH}
                            className="w-full min-h-[200px] p-4 rounded-xl bg-white dark:bg-[#1a2e2a] border border-gray-100 dark:border-zinc-800 focus:border-primary focus:ring-1 focus:ring-primary outline-none text-base resize-none transition-all placeholder:text-gray-400 text-[#0e1a18] dark:text-white"
                            placeholder="몽골에서의 소중한 추억을 들려주세요 (날씨, 가이드, 숙소 등 자유롭게 적어 주세요)"
                        ></textarea>
                        <p className="text-xs text-gray-400 mt-1.5">{REVIEW_MIN_LENGTH}자 이상, {REVIEW_MAX_LENGTH}자 이내로 작성해 주세요.</p>
                    </div>
                </div>

                {/* Sticky Bottom Button */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light dark:via-background-dark to-transparent z-[60]">
                    <div className="max-w-md mx-auto">
                        <button
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            className="w-full bg-primary hover:bg-[#19a186] disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-lg font-bold py-4 rounded-xl shadow-lg transition-colors active:scale-[0.98]"
                        >
                            {submitting ? '전송 중...' : '작성 완료'}
                        </button>
                    </div>
                    <div className="h-4"></div> {/* iOS Home Indicator Area */}
                </div>

                {/* Success Modal */}
                {isSuccessModalOpen && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                        <div className="mx-6 w-full max-w-[320px] transform overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 p-6 shadow-2xl transition-all animate-in fade-in zoom-in duration-200">
                            <div className="flex flex-col items-center justify-center pt-4 pb-6">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                                    <span
                                        className="material-symbols-outlined text-primary text-4xl"
                                        style={{ fontVariationSettings: "'FILL' 1" }}
                                    >
                                        check_circle
                                    </span>
                                </div>
                                <h3 className="text-[#0e1a18] dark:text-white tracking-tight text-xl font-bold leading-tight text-center px-2">
                                    후기가<br />등록되었습니다
                                </h3>
                                <p className="text-zinc-500 dark:text-zinc-400 text-sm font-normal leading-relaxed pt-3 px-4 text-center">
                                    후기를 남겨 주셔서 감사합니다.<br />실제 여행자의 이야기는 다른 고객님께 큰 도움이 됩니다.
                                </p>
                            </div>
                            <div className="flex pt-2">
                                <button
                                    onClick={() => navigate('/reviews')}
                                    className="flex h-14 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-primary text-white text-base font-bold leading-normal tracking-wide active:scale-[0.98] transition-transform hover:bg-[#19a186]"
                                >
                                    <span className="truncate">확인</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
