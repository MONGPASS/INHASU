import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { uploadImage } from '../utils/upload';
import { AdminLayout } from '../components/admin/AdminLayout';
import { DashboardIcon } from '../components/admin/dashboard/DashboardIcon';
import './AdminContentManage.css';
import { adminConfirm, adminNotify } from '../components/admin/ui/adminFeedback';
import { adminValidateRequired } from '../components/admin/ui/adminForm';

interface ReviewRow {
    id: string;
    author: string;
    date: string;
    rating: number;
    productName: string;
    title: string;
    content: string;
    images: string[];
    /** reviews.is_approved — 상품 상세 화면의 후기 노출 여부 */
    approved: boolean;
}

type ListFilter = 'all' | 'photo' | 'hidden';

const MAX_IMAGES = 5;

const EMPTY_FORM = {
    author: '',
    writtenDate: '', // 작성일 (원래 후기가 작성된 날짜)
    productName: '',
    title: '',
    rating: 5,
    content: '',
    images: [] as string[],
};

/** Lucide outlines (ISC) that DashboardIcon does not carry. Keys keep the `lc-` prefix for the icon-subset check. */
const LOCAL_ICONS = {
    'lc-message-square-quote': <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 12a2 2 0 0 0 2-2V8H8" /><path d="M14 12a2 2 0 0 0 2-2V8h-2" /></>,
    'lc-images': <><path d="M18 22H4a2 2 0 0 1-2-2V6" /><path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18" /><circle cx="12" cy="8" r="2" /><rect width="16" height="16" x="6" y="2" rx="2" /></>,
    'lc-eye-off': <><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" /><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" /><path d="m2 2 20 20" /></>,
    'lc-inbox': <><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>,
} as const;

const LocalIcon: React.FC<{ name: keyof typeof LOCAL_ICONS; size?: number }> = ({ name, size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flex: 'none', display: 'block' }}>
        {LOCAL_ICONS[name]}
    </svg>
);

const parseImages = (value: unknown): string[] => {
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value;
        return Array.isArray(parsed) ? parsed.filter((url): url is string => typeof url === 'string' && url !== '') : [];
    } catch {
        return [];
    }
};

const reviewFromApi = (r: any): ReviewRow => ({
    id: r.id,
    author: r.author_name || r.user_name || '(이름 없음)',
    date: r.created_at ? String(r.created_at).substring(0, 10) : '',
    rating: Number(r.rating) || 0,
    productName: r.product_name || '',
    title: r.title || '',
    content: r.content || '',
    images: parseImages(r.images),
    approved: !(r.is_approved === 0 || r.is_approved === false || r.is_approved === '0'),
});

const Stars: React.FC<{ rating: number }> = ({ rating }) => (
    <span className="rv-stars" aria-label={`${rating}점`}>
        {[1, 2, 3, 4, 5].map((n) => <span key={n} data-on={n <= rating || undefined}>★</span>)}
    </span>
);

export const AdminReviewManage: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [reviews, setReviews] = useState<ReviewRow[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [listFilter, setListFilter] = useState<ListFilter>('all');
    const [starFilter, setStarFilter] = useState(0);
    const [busyId, setBusyId] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Fetch reviews from API
    const fetchReviews = async () => {
        try {
            const data = await api.reviews.list();
            if (Array.isArray(data)) setReviews(data.map(reviewFromApi));
            setLoadError('');
        } catch (error) {
            console.error('Error fetching reviews:', error);
            setLoadError(error instanceof Error ? error.message : String(error));
        } finally {
            setLoaded(true);
        }
    };

    useEffect(() => {
        void fetchReviews();
    }, []);

    const handleDelete = async (id: string) => {
        if (await adminConfirm('정말 이 후기를 삭제하시겠습니까?')) {
            setBusyId(id);
            try {
                await api.reviews.delete(id);
                setReviews((list) => list.filter((r) => r.id !== id));
            } catch (error) {
                console.error('Failed to delete review:', error);
                adminNotify('삭제에 실패했습니다.');
            } finally {
                setBusyId(null);
            }
        }
    };

    const toggleApproved = async (review: ReviewRow) => {
        const approved = !review.approved;
        setBusyId(review.id);
        setReviews((list) => list.map((r) => (r.id === review.id ? { ...r, approved } : r)));
        try {
            await api.reviews.update(review.id, { is_approved: approved ? 1 : 0 });
        } catch (error) {
            console.error('Failed to change review visibility:', error);
            setReviews((list) => list.map((r) => (r.id === review.id ? { ...r, approved: review.approved } : r)));
            adminNotify('노출 상태를 바꾸지 못했습니다.');
        } finally {
            setBusyId(null);
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        const remainingSlots = MAX_IMAGES - formData.images.length;
        const filesToProcess = Array.from(files).slice(0, remainingSlots);
        event.target.value = '';
        if (filesToProcess.length === 0) return;

        setUploading(true);
        try {
            const urls = await Promise.all(filesToProcess.map((file) => uploadImage(file, 'reviews')));
            setFormData((prev) => ({ ...prev, images: [...prev.images, ...urls].slice(0, MAX_IMAGES) }));
        } catch (error) {
            console.error('Review image upload failed:', error);
            adminNotify('이미지 업로드 실패');
        } finally {
            setUploading(false);
        }
    };

    const removeImage = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index),
        }));
    };

    const closeModal = () => {
        if (submitting || uploading) return;
        setIsModalOpen(false);
    };

    const handleSubmit = async () => {
        if (!adminValidateRequired() || !formData.author.trim() || !formData.content.trim()) return;
        if (submitting || uploading) return;

        setSubmitting(true);
        try {
            const { error } = await api.reviews.create({
                author_name: formData.author,
                product_name: formData.productName,
                title: formData.title,
                rating: formData.rating,
                content: formData.content,
                images: formData.images,
                created_at: formData.writtenDate ? new Date(formData.writtenDate).toISOString() : new Date().toISOString(),
            }) as any;

            if (error) throw error;

            adminNotify('리뷰가 등록되었습니다.');
            setIsModalOpen(false);
            setFormData(EMPTY_FORM);
            void fetchReviews(); // Refresh list
        } catch (error: any) {
            console.error('Error adding review:', error);
            adminNotify('등록 실패: ' + (error?.message || error));
        } finally {
            setSubmitting(false);
        }
    };

    const q = searchTerm.trim().toLowerCase();
    const filteredReviews = useMemo(() => reviews.filter((review) =>
        (listFilter === 'all' || (listFilter === 'photo' ? review.images.length > 0 : !review.approved))
        && (!starFilter || Math.round(review.rating) === starFilter)
        && (!q || [review.author, review.content, review.productName, review.title].some((v) => v.toLowerCase().includes(q))),
    ), [reviews, listFilter, starFilter, q]);

    // Derived metrics from the real review data
    const totalReviews = reviews.length;
    const avgRating = reviews.length
        ? (reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length)
        : 0;
    const photoReviews = reviews.filter((r) => r.images.length > 0).length;
    const hiddenReviews = reviews.filter((r) => !r.approved).length;
    const starCount = (n: number) => reviews.filter((r) => Math.round(r.rating) === n).length;
    // 디자인은 5·4·3점 칩만 두지만, 실제 1·2점 후기가 있으면 그 칩도 보여 거를 수 있게 한다.
    const starChips = [5, 4, 3, 2, 1].filter((n) => n >= 3 || starCount(n) > 0);

    const kpis: Array<{ label: string; icon: React.ReactNode; value: string | number; unit: string; filter?: ListFilter; warn?: boolean }> = [
        { label: '전체 후기', icon: <LocalIcon name="lc-message-square-quote" />, value: totalReviews, unit: '건', filter: 'all' },
        { label: '평균 평점', icon: <DashboardIcon name="lc-star" />, value: avgRating.toFixed(1), unit: '점' },
        { label: '포토 후기', icon: <LocalIcon name="lc-images" />, value: photoReviews, unit: '건', filter: 'photo' },
        { label: '숨김 후기', icon: <LocalIcon name="lc-eye-off" />, value: hiddenReviews, unit: '건', filter: 'hidden', warn: hiddenReviews > 0 },
    ];

    const canSubmit = !!(formData.author.trim() && formData.content.trim()) && !uploading && !submitting;
    const emptyText = !loaded
        ? '불러오는 중…'
        : loadError
            ? `목록을 불러오지 못했습니다: ${loadError}`
            : reviews.length ? '조건에 맞는 후기가 없어요.' : '등록된 후기가 없어요.';

    return (
        <AdminLayout
            activePage="reviews"
            title="후기 관리"
            actions={
                <button type="button" className="btn btn-ink" onClick={() => setIsModalOpen(true)}>
                    <DashboardIcon name="lc-plus" />새 후기 등록
                </button>
            }
        >
            <div className="cm-page rv-page route-anim">
                <section className="cm-kpis is-wide" aria-label="후기 현황">
                    {kpis.map((kpi) => {
                        const n = Number(kpi.value);
                        const body = <>
                            <span className="cm-kpi-head">
                                <span className="cm-kpi-ico" data-tone={kpi.warn ? 'warn' : n ? 'has' : 'zero'}>{kpi.icon}</span>
                                <span className="cm-kpi-label">{kpi.label}</span>
                            </span>
                            <span className="cm-kpi-value"><span className="cm-kpi-num" data-zero={!n || undefined}>{loaded ? kpi.value : '–'}</span><span className="cm-kpi-unit">{kpi.unit}</span></span>
                        </>;
                        if (!kpi.filter) return <div key={kpi.label} className="cm-kpi is-static">{body}</div>;
                        const on = kpi.filter !== 'all' && listFilter === kpi.filter;
                        return (
                            <button key={kpi.label} type="button" className="cm-kpi" aria-pressed={on}
                                onClick={() => setListFilter(on || kpi.filter === 'all' ? 'all' : kpi.filter!)}>
                                {body}
                            </button>
                        );
                    })}
                </section>

                <div className="cm-toolbar">
                    <label className="cm-search">
                        <DashboardIcon name="lc-search" color="var(--text-tertiary)" />
                        <input
                            placeholder="작성자 · 내용 · 상품명 검색"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            aria-label="후기 검색"
                        />
                    </label>
                    <div className="cm-chips" aria-label="평점">
                        <button type="button" className="cm-chip" aria-pressed={starFilter === 0} onClick={() => setStarFilter(0)}>전체 평점</button>
                        {starChips.map((n) => (
                            <button key={n} type="button" className="cm-chip" aria-pressed={starFilter === n} onClick={() => setStarFilter(n)}>
                                ★ {n}점<span className="cm-chip-n">{starCount(n)}</span>
                            </button>
                        ))}
                    </div>
                    <span className="cm-count"><b>{filteredReviews.length}</b>건</span>
                </div>

                <section className="cm-card" aria-label="후기 목록">
                    {filteredReviews.map((review) => (
                        <div key={review.id} className="rv-row" data-hidden={!review.approved || undefined}>
                            <div className="rv-row-main">
                                <span className="rv-avatar">{review.author.slice(0, 1)}</span>
                                <div className="rv-row-text">
                                    <div className="rv-row-top">
                                        <span className="rv-name">{review.author}</span>
                                        <Stars rating={Math.round(review.rating)} />
                                        <span className="rv-meta">{[review.productName, review.date.replace(/-/g, '.')].filter(Boolean).join(' · ')}</span>
                                    </div>
                                    {review.title && <span className="rv-title">{review.title}</span>}
                                    <span className="rv-body">{review.content}</span>
                                    {review.images.length > 0 && (
                                        <div className="rv-photos">
                                            {review.images.map((url, i) => (
                                                <a key={`${url}-${i}`} href={url} target="_blank" rel="noopener noreferrer" title="사진 크게 보기">
                                                    <img src={url} alt={`${review.author} 님 후기 사진 ${i + 1}`} loading="lazy" />
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="rv-row-actions">
                                <button
                                    type="button"
                                    className="cm-switch"
                                    aria-pressed={review.approved}
                                    disabled={busyId === review.id}
                                    title={review.approved ? '상품 상세 후기에서 숨기기' : '상품 상세 후기에 다시 보이기'}
                                    onClick={() => void toggleApproved(review)}
                                >
                                    <span className="cm-switch-track"><span className="cm-switch-knob" /></span>{review.approved ? '노출' : '숨김'}
                                </button>
                                <button type="button" className="cm-icon-btn is-danger" title="삭제" aria-label="후기 삭제" disabled={busyId === review.id} onClick={() => void handleDelete(review.id)}>
                                    <DashboardIcon name="lc-trash" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {filteredReviews.length === 0 && (
                        <div className="cm-empty">
                            {loadError ? <DashboardIcon name="lc-circle-alert" size={32} /> : <LocalIcon name="lc-inbox" size={32} />}
                            <span>{emptyText}</span>
                        </div>
                    )}
                </section>
                <p className="cm-hint">노출/숨김은 상품 상세 화면의 후기 목록과 평점에 적용됩니다. 홈·후기 모아보기 화면은 현재 숨김 여부와 관계없이 후기를 보여 줍니다.</p>
            </div>

            {/* Manual Register Modal */}
            {isModalOpen && (
                <div className="cm-scrim" onClick={closeModal}>
                    <div className="cm-modal" role="dialog" aria-modal="true" aria-labelledby="rv-modal-title" onClick={(e) => e.stopPropagation()}>
                        <div className="cm-modal-head">
                            <h2 id="rv-modal-title">수동 후기 등록</h2>
                            <button type="button" className="cm-icon-btn" title="닫기" aria-label="닫기" onClick={closeModal}>
                                <DashboardIcon name="lc-x" />
                            </button>
                        </div>

                        <div className="cm-modal-body">
                            <div className="cm-grid-2">
                                <label className="cm-field">
                                    <span className="cm-label adm-req">작성자</span>
                                    <input type="text" className="cm-input" placeholder="예: 김철수" value={formData.author}
                                        onChange={(e) => setFormData({ ...formData, author: e.target.value })} />
                                </label>
                                <label className="cm-field">
                                    <span className="cm-label">상품명</span>
                                    <input type="text" className="cm-input" placeholder="예: 고비사막 투어" value={formData.productName}
                                        onChange={(e) => setFormData({ ...formData, productName: e.target.value })} />
                                </label>
                                <label className="cm-field">
                                    <span className="cm-label">작성일 <span className="cm-label-sub">· 원래 작성된 날짜</span></span>
                                    <input type="date" className="cm-input" value={formData.writtenDate}
                                        onChange={(e) => setFormData({ ...formData, writtenDate: e.target.value })} />
                                </label>
                            </div>
                            <div className="cm-field">
                                <span className="cm-label">평점 · {formData.rating}점</span>
                                <div className="rv-rate">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button key={star} type="button" title={`${star}점`} aria-label={`${star}점`} aria-pressed={star === formData.rating}
                                            data-on={star <= formData.rating || undefined} onClick={() => setFormData({ ...formData, rating: star })}>★</button>
                                    ))}
                                </div>
                            </div>
                            <label className="cm-field">
                                <span className="cm-label">제목</span>
                                <input type="text" className="cm-input" placeholder="예: 잊을 수 없는 최고의 여행!" value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                            </label>
                            <label className="cm-field">
                                <span className="cm-label adm-req">내용</span>
                                <textarea className="cm-textarea" placeholder="후기 내용을 입력하세요" value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })} />
                            </label>
                            <div className="cm-field">
                                <span className="cm-label">사진 <span className="cm-label-sub">· {formData.images.length} / {MAX_IMAGES}장</span></span>
                                <div className="rv-upload">
                                    {formData.images.map((img, idx) => (
                                        <span key={`${img}-${idx}`} className="rv-upload-thumb">
                                            <img src={img} alt={`올린 사진 ${idx + 1}`} />
                                            <button type="button" onClick={() => removeImage(idx)} title="삭제" aria-label={`사진 ${idx + 1} 삭제`}>
                                                <DashboardIcon name="lc-x" size={12} color="#fff" />
                                            </button>
                                        </span>
                                    ))}
                                    {formData.images.length < MAX_IMAGES && (
                                        <label className="rv-upload-add" aria-disabled={uploading || undefined}>
                                            <DashboardIcon name={uploading ? 'lc-loader' : 'lc-image-plus'} size={18} />
                                            {uploading ? '올리는 중' : '추가'}
                                            <input type="file" accept="image/*" multiple disabled={uploading} onChange={(e) => void handleImageUpload(e)} />
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="cm-modal-foot">
                            <span className="cm-hint">{uploading ? '사진을 올리는 중이에요' : canSubmit || submitting ? '' : '작성자와 내용을 입력하면 등록할 수 있어요'}</span>
                            <button type="button" className="cm-btn" onClick={closeModal} disabled={submitting || uploading}>취소</button>
                            <button type="button" className="cm-btn is-primary" onClick={() => void handleSubmit()} disabled={!canSubmit}>{submitting ? '등록 중…' : '등록하기'}</button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};
