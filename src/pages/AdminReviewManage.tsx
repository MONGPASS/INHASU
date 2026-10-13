import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { uploadImage } from '../utils/upload';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';

export const AdminReviewManage: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [reviews, setReviews] = useState<any[]>([]);

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
        (review.author || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (review.content || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (review.product_name && review.product_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

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
            {/* Stat row */}
            <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 18 }}>
                <div className="metric" style={{ padding: '16px 18px' }}>
                    <div className="row" style={{ gap: 12 }}>
                        <span className="metric-ico tint-blue" style={{ width: 40, height: 40 }}><Icon name="rate_review" fill /></span>
                        <div>
                            <div className="metric-label">전체 후기</div>
                            <div className="metric-value" style={{ fontSize: 22 }}>{totalReviews}</div>
                        </div>
                    </div>
                </div>
                <div className="metric" style={{ padding: '16px 18px' }}>
                    <div className="row" style={{ gap: 12 }}>
                        <span className="metric-ico tint-amber" style={{ width: 40, height: 40 }}><Icon name="star" fill /></span>
                        <div>
                            <div className="metric-label">평균 평점</div>
                            <div className="metric-value" style={{ fontSize: 22 }}>{avgRating.toFixed(1)}</div>
                        </div>
                    </div>
                </div>
                <div className="metric" style={{ padding: '16px 18px' }}>
                    <div className="row" style={{ gap: 12 }}>
                        <span className="metric-ico tint-purple" style={{ width: 40, height: 40 }}><Icon name="photo_library" fill /></span>
                        <div>
                            <div className="metric-label">포토 후기</div>
                            <div className="metric-value" style={{ fontSize: 22 }}>{photoReviews}</div>
                        </div>
                    </div>
                </div>
                <div className="metric" style={{ padding: '16px 18px' }}>
                    <div className="row" style={{ gap: 12 }}>
                        <span className="metric-ico tint-green" style={{ width: 40, height: 40 }}><Icon name="grade" fill /></span>
                        <div>
                            <div className="metric-label">5점 후기</div>
                            <div className="metric-value" style={{ fontSize: 22 }}>{fiveStarReviews}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="toolbar">
                <label className="tb-search">
                    <Icon name="search" />
                    <input
                        placeholder="작성자, 내용, 상품명 검색"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </label>
            </div>

            {/* Review List Table */}
            <div className="card">
                <div className="tbl-wrap">
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th>작성자</th>
                                <th>상품</th>
                                <th>평점</th>
                                <th>내용</th>
                                <th className="c">사진</th>
                                <th>작성일</th>
                                <th>방문시기</th>
                                <th className="r">관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredReviews?.map((review) => (
                                <tr key={review.id}>
                                    <td>
                                        <div className="av-cell">
                                            <span className="avatar round tint-blue">{(review.author || '').slice(0, 2)}</span>
                                            <span className="cell-strong">{review.author}</span>
                                        </div>
                                    </td>
                                    <td className="cell-muted" style={{ maxWidth: 200 }}>
                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {review.product_name || '–'}
                                        </div>
                                    </td>
                                    <td>
                                        <span className="row" style={{ gap: 3 }}>
                                            <Icon name="star" fill style={{ fontSize: 16, color: 'var(--mrt-star)' }} />
                                            <b style={{ fontWeight: 800 }}>{Number(review.rating).toFixed(1)}</b>
                                        </span>
                                    </td>
                                    <td className="cell-muted" style={{ maxWidth: 320 }}>
                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {review.content}
                                        </div>
                                    </td>
                                    <td className="c">
                                        {review.images && review.images.length > 0
                                            ? <span className="badge b-purple"><Icon name="image" />{review.images.length}</span>
                                            : <span className="cell-muted">–</span>}
                                    </td>
                                    <td className="cell-muted">{review.date}</td>
                                    <td className="cell-muted">{review.visitDate || '–'}</td>
                                    <td className="r">
                                        <span className="row-actions">
                                            <button className="act-btn danger" title="삭제" onClick={() => handleDelete(review.id)}>
                                                <Icon name="delete" />
                                            </button>
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredReviews?.length === 0 && (
                    <div className="empty">
                        <Icon name="inbox" />
                        <p>검색 결과가 없습니다.</p>
                    </div>
                )}
            </div>

            {/* Manual Register Modal */}
            {isModalOpen && (
                <div className="picker-scrim" onClick={() => setIsModalOpen(false)}>
                    <div
                        className="picker"
                        style={{ width: 520, maxHeight: '90vh' }}
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
                                            <Icon
                                                key={star}
                                                name="star"
                                                fill={star <= formData.rating}
                                                style={{ fontSize: 26, cursor: 'pointer', color: star <= formData.rating ? 'var(--mrt-star)' : 'var(--mrt-gray-300)' }}
                                                onClick={() => setFormData({ ...formData, rating: star })}
                                            />
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
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleImageUpload}
                                        style={{ fontSize: 13, color: 'var(--text-tertiary)' }}
                                    />
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
