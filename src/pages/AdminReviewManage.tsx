import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { uploadImage } from '../utils/upload';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';

export const AdminReviewManage: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [reviews, setReviews] = useState<any[]>([]);
    const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all');
    const [photoOnly, setPhotoOnly] = useState(false);
    const [busyReview, setBusyReview] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        author: '',
        writtenDate: '', // 작성일 (원래 후기가 작성된 날짜)
        visitDate: '',
        productName: '',
        title: '', // 제목
        rating: 5,
        content: '',
        images: [] as string[]
    });

    // Fetch reviews from API
    const fetchReviews = async () => {
        try {
            const data = await api.reviews.list();
            if (Array.isArray(data)) {
                setReviews(data.map((r: any) => {
                    let parsedImages: string[] = [];
                    try {
                        parsedImages = typeof r.images === 'string' ? JSON.parse(r.images || '[]') : (Array.isArray(r.images) ? r.images : []);
                    } catch { parsedImages = []; }
                    return {
                        id: r.id,
                        author: r.author_name || r.user_name || '(이름 없음)',
                        date: r.created_at ? r.created_at.substring(0, 10) : '',
                        visitDate: r.visit_date || '',
                        rating: r.rating || 0,
                        product_name: r.product_name || '',
                        content: r.content || '',
                        title: r.title || '',
                        isApproved: r.is_approved !== 0 && r.is_approved !== false,
                        images: parsedImages
                    };
                }));
            }
        } catch (error) {
            console.error('Error fetching reviews:', error);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, []);

    const handleDelete = async (id: string) => {
        if (window.confirm('정말 이 후기를 삭제하시겠습니까?')) {
            try {
                await api.reviews.delete(id);
                setReviews(reviews.filter(r => r.id !== id));
            } catch (error) {
                console.error('Failed to delete review:', error);
                alert('삭제에 실패했습니다.');
            }
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        const maxImages = 5;
        const remainingSlots = maxImages - formData.images.length;
        const filesToProcess = Array.from(files).slice(0, remainingSlots);

        try {
            const uploadPromises = filesToProcess.map(file => uploadImage(file, 'reviews'));
            const urls = await Promise.all(uploadPromises);
            setFormData(prev => ({ ...prev, images: [...prev.images, ...urls] }));
        } catch (error) {
            console.error('Review image upload failed:', error);
            alert('이미지 업로드 실패');
        }
        event.target.value = '';
    };

    const removeImage = (index: number) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async () => {
        if (!formData.author || !formData.content) {
            alert('작성자와 내용은 필수입니다.');
            return;
        }

        try {
            const { error } = await api.reviews.create({
                author_name: formData.author,
                visit_date: formData.visitDate,
                product_name: formData.productName,
                title: formData.title,
                rating: formData.rating,
                content: formData.content,
                images: formData.images,
                created_at: formData.writtenDate ? new Date(formData.writtenDate).toISOString() : new Date().toISOString()
            }) as any;

            if (error) throw error;

            alert('리뷰가 등록되었습니다.');
            setIsModalOpen(false);
            setFormData({
                author: '',
                writtenDate: '',
                visitDate: '',
                productName: '',
                title: '',
                rating: 5,
                content: '',
                images: []
            });
            fetchReviews(); // Refresh list
        } catch (error: any) {
            console.error('Error adding review:', error);
            alert('등록 실패: ' + error.message);
        }
    };

    const filteredReviews = reviews.filter(review =>
        (ratingFilter === 'all' || Number(review.rating) === ratingFilter) && (!photoOnly || review.images?.length > 0) && (
        (review.author || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (review.content || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (review.product_name && review.product_name.toLowerCase().includes(searchTerm.toLowerCase())))
    );
    const toggleApproval = async (review: any) => {
        if (busyReview) return;
        setBusyReview(review.id);
        try { await api.reviews.update(review.id, { is_approved: !review.isApproved }); setReviews(current => current.map(item => item.id === review.id ? { ...item, isApproved: !review.isApproved } : item)); }
        catch { alert('후기 노출 상태를 저장하지 못했습니다.'); }
        finally { setBusyReview(null); }
    };

    // Derived metrics from the real review data
    const totalReviews = reviews.length;
    const avgRating = reviews.length
        ? (reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length)
        : 0;
    const photoReviews = reviews.filter(r => r.images && r.images.length > 0).length;
    const fiveStarReviews = reviews.filter(r => Number(r.rating) === 5).length;

    return (
        <AdminLayout
            activePage="reviews"
            title="후기 관리"
            actions={
                <button className="btn btn-ink" onClick={() => setIsModalOpen(true)}>
                    <Icon name="add" />새 후기 등록
                </button>
            }
        >
            <div className="rd-content-page rd-review-page">
                <section className="rd-content-kpis">
                    {[
                        { label: '전체 후기', value: totalReviews, unit: '건', icon: 'rate_review', active: ratingFilter === 'all' && !photoOnly, choose: () => { setRatingFilter('all'); setPhotoOnly(false); } },
                        { label: '평균 평점', value: avgRating.toFixed(1), unit: '점', icon: 'star', active: false, choose: () => { setRatingFilter('all'); setPhotoOnly(false); } },
                        { label: '포토 후기', value: photoReviews, unit: '건', icon: 'photo_library', active: photoOnly, choose: () => { setPhotoOnly(value => !value); setRatingFilter('all'); } },
                        { label: '5점 후기', value: fiveStarReviews, unit: '건', icon: 'grade', active: ratingFilter === 5, choose: () => { setRatingFilter(5); setPhotoOnly(false); } },
                    ].map(item => <button type="button" key={item.label} className={'rd-content-kpi' + (item.active ? ' is-selected' : '')} aria-pressed={item.active} onClick={item.choose}><span><i><Icon name={item.icon} /></i><b>{item.label}</b></span><strong>{item.value}<small>{item.unit}</small></strong></button>)}
                </section>
                <div className="rd-content-filters">
                    <label className="rd-content-search"><Icon name="search" /><input placeholder="작성자 · 내용 · 상품명 검색" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} /></label>
                    <div className="rd-content-chips">{(['all', 5, 4, 3, 2, 1] as const).map(rating => <button type="button" key={rating} className={ratingFilter === rating ? 'is-selected' : ''} aria-pressed={ratingFilter === rating} onClick={() => setRatingFilter(rating)}>{rating === 'all' ? '전체' : rating + '점'}<span>{rating === 'all' ? reviews.length : reviews.filter(review => Number(review.rating) === rating).length}</span></button>)}</div>
                    <span className="rd-content-count"><b>{filteredReviews.length}</b>건</span>
                </div>
                <section className="rd-content-panel">
                    {filteredReviews.map(review => <article key={review.id} className="rd-review-row">
                        <span className="rd-content-avatar">{(review.author || '관').slice(0, 1)}</span>
                        <div className="rd-review-copy">
                            <div className="rd-review-meta"><strong>{review.author}</strong><span className="rd-review-stars" aria-label={Number(review.rating) + '점'}>{Array.from({length: 5}, (_, index) => <span key={index} className={index < Number(review.rating) ? 'is-on' : ''}>★</span>)}</span><small>{[review.product_name, review.date, review.visitDate].filter(Boolean).join(' · ')}</small></div>
                            {review.title && <b>{review.title}</b>}
                            <p>{review.content}</p>
                            {review.images?.length > 0 && <div className="rd-review-photos">{review.images.map((url: string, index: number) => <a key={index} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={'후기 사진 ' + (index + 1)} loading="lazy" /></a>)}</div>}
                        </div>
                        <div className="rd-review-actions"><button type="button" className="rd-content-visibility" aria-pressed={review.isApproved} disabled={busyReview !== null} onClick={() => { void toggleApproval(review); }}><span className={`switch${review.isApproved ? ' on' : ''}`}><span className="knob" /></span>{review.isApproved ? '노출' : '숨김'}</button><button type="button" className="act-btn danger" title="삭제" onClick={() => handleDelete(review.id)}><Icon name="delete" /></button></div>
                    </article>)}
                    {!filteredReviews.length && <div className="empty"><Icon name="inbox" /><p>조건에 맞는 후기가 없습니다.</p></div>}
                </section>
            </div>
            {/* Manual Register Modal */}
            {isModalOpen && (
                <div className="picker-scrim" onClick={() => setIsModalOpen(false)}>
                    <div
                        className="picker rd-content-dialog rd-review-dialog"
                        style={{ width: 560, maxHeight: 'calc(100dvh - 48px)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="card-head">
                            <h2>수동 리뷰 등록</h2>
                            <div className="spacer" />
                            <button className="act-btn" title="닫기" onClick={() => setIsModalOpen(false)}>
                                <Icon name="close" />
                            </button>
                        </div>

                        <div className="card-pad" style={{ overflowY: 'auto' }}>
                            <div className="stack" style={{ gap: 16 }}>
                                <div>
                                    <label className="metric-label" style={{ display: 'block', marginBottom: 6 }}>작성자 명</label>
                                    <input
                                        type="text"
                                        className="tb-search"
                                        style={{ width: '100%' }}
                                        placeholder="예: 김철수"
                                        value={formData.author}
                                        onChange={e => setFormData({ ...formData, author: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="metric-label" style={{ display: 'block', marginBottom: 6 }}>작성일 (원래 후기가 작성된 날짜)</label>
                                    <input
                                        type="date"
                                        className="tb-search"
                                        style={{ width: '100%' }}
                                        value={formData.writtenDate}
                                        onChange={e => setFormData({ ...formData, writtenDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="metric-label" style={{ display: 'block', marginBottom: 6 }}>방문 시기</label>
                                    <input
                                        type="text"
                                        className="tb-search"
                                        style={{ width: '100%' }}
                                        placeholder="예: 2024년 1월"
                                        value={formData.visitDate}
                                        onChange={e => setFormData({ ...formData, visitDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="metric-label" style={{ display: 'block', marginBottom: 6 }}>상품명</label>
                                    <input
                                        type="text"
                                        className="tb-search"
                                        style={{ width: '100%' }}
                                        placeholder="예: 고비사막 투어"
                                        value={formData.productName}
                                        onChange={e => setFormData({ ...formData, productName: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="metric-label" style={{ display: 'block', marginBottom: 6 }}>제목</label>
                                    <input
                                        type="text"
                                        className="tb-search"
                                        style={{ width: '100%' }}
                                        placeholder="예: 잊을 수 없는 최고의 여행!"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="metric-label" style={{ display: 'block', marginBottom: 6 }}>평점: {formData.rating}점</label>
                                    <div className="row" style={{ gap: 4 }}>
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <button type="button" key={star} className="rd-review-rating" aria-label={star + '점'} aria-pressed={formData.rating === star} style={{ color: star <= formData.rating ? 'var(--mrt-star)' : 'var(--mrt-gray-300)' }} onClick={() => setFormData({ ...formData, rating: star })}>★</button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="metric-label" style={{ display: 'block', marginBottom: 6 }}>내용</label>
                                    <div className="memo-box">
                                        <textarea
                                            style={{ height: 120 }}
                                            placeholder="내용을 입력하세요..."
                                            value={formData.content}
                                            onChange={e => setFormData({ ...formData, content: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="metric-label" style={{ display: 'block', marginBottom: 6 }}>사진 (최대 5장)</label>
                                    <label className="rd-review-upload"><Icon name="add_photo_alternate" />추가<input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleImageUpload}
                                        style={{ display: 'none' }}
                                    /></label>
                                    <div className="row" style={{ gap: 8, marginTop: 8, overflowX: 'auto' }}>
                                        {formData.images.map((img, idx) => (
                                            <div key={idx} style={{ position: 'relative', width: 64, height: 64, flex: 'none' }}>
                                                <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} alt="upload" />
                                                <button
                                                    onClick={() => removeImage(idx)}
                                                    title="삭제"
                                                    style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'var(--mrt-red)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-xs)' }}
                                                >
                                                    <Icon name="close" style={{ fontSize: 13 }} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="drawer-foot">
                            <div className="spacer" style={{ flex: 1 }} />
                            <button className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>취소</button>
                            <button className="btn btn-ink" onClick={handleSubmit}>등록하기</button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};
