import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { uploadImage } from '../utils/upload';
import { AdminLayout } from '../components/admin/AdminLayout';
import {
    AdminButton, AdminCard, AdminChipGroup, AdminDialog, AdminEmpty, AdminError, AdminField, AdminFileButton, AdminIconButton,
    AdminLoading, AdminSearch, AdminStat, AdminStatRow, AdminSwitch, AdminTable, AdminTbody, AdminTd, AdminTextArea, AdminTextInput,
    AdminTh, AdminThead, AdminTr,
} from '../components/admin/ui';
import { IconImage, IconPlus, IconTrash } from '@montage-ui/icon';
import { adminConfirm, adminNotify } from '../components/admin/ui/adminFeedback';
import { adminValidateRequired } from '../components/admin/ui/adminForm';
import './AdminReviewManage.css';

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
type StarFilter = 'all' | '5' | '4' | '3' | '2' | '1';
type RatingValue = '5' | '4' | '3' | '2' | '1';

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

/** 별점(읽기 전용). 별 글자는 장식이고 화면 읽기에는 ‘N점’만 읽힌다. */
const Stars: React.FC<{ rating: number }> = ({ rating }) => (
    <span className="rv-stars" role="img" aria-label={`${rating}점`}>
        {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= rating ? 'is-on' : undefined} aria-hidden="true">★</span>)}
    </span>
);

/**
 * 후기 관리(/admin/reviews) — 목록형 기준(통합 예약 목록): 머리(‘새 후기 등록’) → 지표(누르면 거르기) → 카드 하나 안에 검색·평점 칩 → 표.
 * 노출 스위치는 상품 상세 화면의 후기 목록·평점에만 적용된다(reviews.is_approved). API·저장 형식은 그대로다.
 */
export const AdminReviewManage: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [reviews, setReviews] = useState<ReviewRow[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [retrying, setRetrying] = useState(false);
    const [listFilter, setListFilter] = useState<ListFilter>('all');
    const [starFilter, setStarFilter] = useState<StarFilter>('all');
    const [busyId, setBusyId] = useState<string | null>(null);

    // 수동 등록 창
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

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

    const retry = async () => {
        setRetrying(true);
        try { await fetchReviews(); } finally { setRetrying(false); }
    };

    const handleDelete = async (review: ReviewRow) => {
        if (!await adminConfirm(`${review.author} 님의 후기를 삭제할까요? 되돌릴 수 없습니다.`)) return;
        setBusyId(review.id);
        try {
            await api.reviews.delete(review.id);
            setReviews((list) => list.filter((r) => r.id !== review.id));
        } catch (error) {
            console.error('Failed to delete review:', error);
            adminNotify('삭제에 실패했습니다.');
        } finally {
            setBusyId(null);
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

    const handleImageUpload = async (files: File[]) => {
        const filesToProcess = files.slice(0, MAX_IMAGES - formData.images.length);
        if (filesToProcess.length === 0 || uploading) return;

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
        setFormData((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    };

    const openModal = () => {
        setFormData(EMPTY_FORM);
        setIsModalOpen(true);
    };
    const closeModal = () => {
        if (submitting) return;
        if (uploading) { adminNotify('사진을 다 올린 뒤 닫아 주세요.'); return; }
        setIsModalOpen(false);
    };

    const handleSubmit = async () => {
        if (submitting || uploading) return;
        if (!adminValidateRequired() || !formData.author.trim() || !formData.content.trim()) return;

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
            void fetchReviews();
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
        && (starFilter === 'all' || Math.round(review.rating) === Number(starFilter))
        && (!q || [review.author, review.content, review.productName, review.title].some((v) => v.toLowerCase().includes(q))),
    ), [reviews, listFilter, starFilter, q]);

    // 실제 후기 자료로 센 지표
    const totalReviews = reviews.length;
    const avgRating = reviews.length ? reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length : 0;
    const photoReviews = reviews.filter((r) => r.images.length > 0).length;
    const hiddenReviews = reviews.filter((r) => !r.approved).length;
    const starCount = (n: number) => reviews.filter((r) => Math.round(r.rating) === n).length;
    // 5·4·3점은 늘 두고, 실제 1·2점 후기가 있으면 그 칩도 보여 거를 수 있게 한다.
    const starItems: Array<{ value: StarFilter; label: string; count?: number }> = [
        { value: 'all', label: '전체 평점' },
        ...[5, 4, 3, 2, 1].filter((n) => n >= 3 || starCount(n) > 0).map((n) => ({ value: String(n) as StarFilter, label: `${n}점`, count: starCount(n) })),
    ];
    const pickFilter = (filter: ListFilter) => setListFilter((current) => (current === filter || filter === 'all' ? 'all' : filter));
    // 불러오기 전이나 처음 불러오기에 실패했으면 0으로 단정하지 않는다.
    const shown = (value: React.ReactNode) => (loaded && !(loadError && !reviews.length) ? value : '–');

    const formDirty = JSON.stringify(formData) !== JSON.stringify(EMPTY_FORM);
    const canSubmit = !!(formData.author.trim() && formData.content.trim()) && !uploading;

    const list = !loaded ? <AdminLoading label="후기를 불러오는 중…" />
        : loadError && !reviews.length ? <AdminError reason={`목록을 불러오지 못했습니다: ${loadError}`} onRetry={() => void retry()} retrying={retrying} />
        : filteredReviews.length === 0 ? (
            <AdminEmpty
                title={reviews.length ? '조건에 맞는 후기가 없어요.' : '등록된 후기가 없어요.'}
                description={reviews.length ? '검색어나 평점·지표 거르기를 바꿔 보세요.' : '‘새 후기 등록’으로 받은 후기를 옮겨 둘 수 있어요.'}
            />
        ) : (
            <AdminTable label="후기 목록" className="rv-table">
                <AdminThead>
                    <AdminTr>
                        <AdminTh>후기</AdminTh>
                        <AdminTh className="rv-c-author">작성자</AdminTh>
                        <AdminTh className="rv-c-product">상품</AdminTh>
                        <AdminTh className="rv-c-date">작성일</AdminTh>
                        <AdminTh align="center" className="rv-c-active">노출</AdminTh>
                        <AdminTh align="right" className="rv-c-actions">관리</AdminTh>
                    </AdminTr>
                </AdminThead>
                <AdminTbody>
                    {filteredReviews.map((review) => (
                        <AdminTr key={review.id} className={review.approved ? undefined : 'is-hidden'}>
                            <AdminTd className="rv-review">
                                <span className="rv-review-in">
                                    <Stars rating={Math.round(review.rating)} />
                                    {review.title && <span className="rv-title">{review.title}</span>}
                                    <span className="rv-body">{review.content}</span>
                                    {review.images.length > 0 && (
                                        <span className="rv-photos">
                                            {review.images.map((url, i) => (
                                                <a key={`${url}-${i}`} href={url} target="_blank" rel="noopener noreferrer" title="사진 크게 보기">
                                                    <img src={url} alt={`${review.author} 님 후기 사진 ${i + 1}`} loading="lazy" />
                                                </a>
                                            ))}
                                        </span>
                                    )}
                                </span>
                            </AdminTd>
                            <AdminTd className="rv-c-author"><span className="rv-author">{review.author}</span></AdminTd>
                            <AdminTd className="rv-c-product">{review.productName || '—'}</AdminTd>
                            <AdminTd nowrap className="rv-c-date">{review.date ? review.date.replace(/-/g, '.') : '—'}</AdminTd>
                            <AdminTd align="center" className="rv-c-active">
                                <AdminSwitch size="sm" checked={review.approved} disabled={busyId === review.id}
                                    aria-label={`${review.author} 님 후기 상품 상세에 노출`} onChange={() => void toggleApproved(review)} />
                            </AdminTd>
                            <AdminTd align="right" className="rv-c-actions">
                                <AdminIconButton size="sm" label={`${review.author} 님 후기 삭제`} className="rv-danger" disabled={busyId === review.id}
                                    onClick={() => void handleDelete(review)}><IconTrash /></AdminIconButton>
                            </AdminTd>
                        </AdminTr>
                    ))}
                </AdminTbody>
            </AdminTable>
        );

    return (
        <AdminLayout
            activePage="reviews"
            title="후기 관리"
            description="노출 스위치는 상품 상세 화면의 후기 목록과 평점에 적용됩니다."
            actions={<AdminButton variant="primary" leading={<IconPlus />} onClick={openModal}>새 후기 등록</AdminButton>}
        >
            <div className="rv-page">
                <AdminStatRow label="후기 현황" className="rv-stats">
                    <AdminStat label="전체 후기" value={shown(totalReviews)} unit="건" active={listFilter === 'all'} onClick={() => pickFilter('all')} />
                    <AdminStat label="평균 평점" value={shown(avgRating.toFixed(1))} unit="점" />
                    <AdminStat label="포토 후기" value={shown(photoReviews)} unit="건" active={listFilter === 'photo'} onClick={() => pickFilter('photo')} />
                    <AdminStat label="숨김 후기" value={shown(hiddenReviews)} unit="건" attention={hiddenReviews > 0} active={listFilter === 'hidden'} onClick={() => pickFilter('hidden')} />
                </AdminStatRow>

                <AdminCard flush className="rv-card">
                    <div className="rv-filters">
                        <AdminSearch value={searchTerm} onChange={setSearchTerm} placeholder="작성자 · 내용 · 상품명 검색" aria-label="후기 검색" />
                        <AdminChipGroup label="평점" items={starItems} value={starFilter} onChange={setStarFilter} />
                        <span className="rv-count" role="status"><b>{filteredReviews.length}</b>건</span>
                    </div>
                    {list}
                    <p className="rv-note">노출/숨김은 상품 상세 화면의 후기 목록과 평점에 적용됩니다. 홈·후기 모아보기 화면은 현재 숨김 여부와 관계없이 후기를 보여 줍니다.</p>
                </AdminCard>
            </div>

            <AdminDialog
                open={isModalOpen}
                onClose={closeModal}
                title="수동 후기 등록"
                dirty={formDirty}
                onSubmit={() => void handleSubmit()}
                submitLabel="등록하기"
                submitting={submitting}
                submitDisabled={!canSubmit}
            >
                <div className="rv-form-grid">
                    <AdminField id="rv-author" label="작성자" required>
                        <AdminTextInput id="rv-author" placeholder="예: 김철수" value={formData.author}
                            onChange={(e) => setFormData({ ...formData, author: e.target.value })} />
                    </AdminField>
                    <AdminField id="rv-product" label="상품명">
                        <AdminTextInput id="rv-product" placeholder="예: 고비사막 투어" value={formData.productName}
                            onChange={(e) => setFormData({ ...formData, productName: e.target.value })} />
                    </AdminField>
                    <AdminField id="rv-date" label="작성일" hint="원래 후기가 작성된 날짜. 비우면 오늘로 저장합니다.">
                        <AdminTextInput id="rv-date" type="date" value={formData.writtenDate}
                            onChange={(e) => setFormData({ ...formData, writtenDate: e.target.value })} />
                    </AdminField>
                </div>
                <AdminField id="rv-rating" label="평점">
                    <AdminChipGroup<RatingValue>
                        label="평점"
                        items={(['5', '4', '3', '2', '1'] as RatingValue[]).map((n) => ({ value: n, label: `${'★'.repeat(Number(n))} ${n}점` }))}
                        value={String(formData.rating) as RatingValue}
                        onChange={(value) => setFormData({ ...formData, rating: Number(value) })}
                    />
                </AdminField>
                <AdminField id="rv-title" label="제목">
                    <AdminTextInput id="rv-title" placeholder="예: 잊을 수 없는 최고의 여행!" value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                </AdminField>
                <AdminField id="rv-content" label="내용" required>
                    <AdminTextArea id="rv-content" minRows={5} placeholder="후기 내용을 입력하세요" value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })} />
                </AdminField>
                <AdminField id="rv-photos" label="사진" hint={`${formData.images.length} / ${MAX_IMAGES}장 · 한 번에 여러 장을 고를 수 있어요.`}>
                    <div className="rv-upload">
                        {formData.images.map((img, idx) => (
                            <figure key={`${img}-${idx}`} className="rv-upload-item">
                                <img src={img} alt={`올린 사진 ${idx + 1}`} />
                                <AdminIconButton size="sm" label={`사진 ${idx + 1} 빼기`} className="rv-danger" onClick={() => removeImage(idx)}><IconTrash /></AdminIconButton>
                            </figure>
                        ))}
                        {formData.images.length < MAX_IMAGES && (
                            <AdminFileButton accept="image/*" multiple variant="secondary" leading={<IconImage />} loading={uploading}
                                onFiles={(files) => void handleImageUpload(files)}>
                                {uploading ? '올리는 중…' : '사진 추가'}
                            </AdminFileButton>
                        )}
                    </div>
                </AdminField>
            </AdminDialog>
        </AdminLayout>
    );
};
