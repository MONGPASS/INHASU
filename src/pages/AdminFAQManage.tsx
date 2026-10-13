import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { TourFAQEditor } from '../components/admin/TourFAQEditor';
import { api } from '../lib/api';

interface FAQ {
    id: string;
    category: string;
    question: string;
    answer: string;
    isActive: boolean;
    viewCount: number;
    order: number;
}

interface FAQCategory {
    id: string;
    name: string;
    isActive: boolean;
    order: number;
}

export const AdminFAQManage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'faq' | 'category' | 'tour-common'>('faq');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [selectedFAQ, setSelectedFAQ] = useState<FAQ | null>(null);
    const [selectedCategory, setSelectedCategoryEdit] = useState<FAQCategory | null>(null);
    const [filterCategory, setFilterCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [categories, setCategories] = useState<FAQCategory[]>([]);

    // FAQ Form
    const [faqForm, setFaqForm] = useState({
        category: '',
        question: '',
        answer: '',
        isActive: true
    });

    // Category Form
    const [categoryForm, setCategoryForm] = useState({
        name: '',
        isActive: true
    });

    // Fetch data from API
    useEffect(() => {
        const fetchData = async () => {
            try {
                const faqData = await api.faqs.list();
                const catData = await api.faqCategories.list();
                if (Array.isArray(faqData)) setFaqs(faqData.map((f: any) => ({ ...f, isActive: f.is_active, viewCount: f.view_count || 0 })));
                if (Array.isArray(catData)) setCategories(catData.map((c: any) => ({ ...c, isActive: c.is_active })));
            } catch (e) { console.error('Failed to fetch FAQ data', e); }
        };
        fetchData();
    }, []);

    // Filter FAQs
    const filteredFaqs = faqs.filter(faq => {
        const matchesCategory = filterCategory === 'all' || faq.category === filterCategory;
        const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    // Add/Edit FAQ
    const handleSaveFAQ = async () => {
        if (!faqForm.question || !faqForm.answer || !faqForm.category) {
            alert('모든 필드를 입력해주세요.');
            return;
        }

        const now = new Date().toISOString();

        if (selectedFAQ) {
            const result = await api.faqs.update(selectedFAQ.id, {
                category: faqForm.category,
                question: faqForm.question,
                answer: faqForm.answer,
                is_active: faqForm.isActive,
                updated_at: now
            }) as any;

            if (result?.error) {
                alert('FAQ 수정 실패: ' + (result.error.message || result.error));
                return;
            }

            setFaqs(faqs.map(f => f.id === selectedFAQ.id ? { ...f, ...faqForm, updatedAt: now } : f));
        } else {
            const maxOrder = faqs.length > 0 ? Math.max(...faqs.map(f => f.order)) : 0;
            const newFaq = {
                id: `faq-${Date.now()}`,
                category: faqForm.category,
                question: faqForm.question,
                answer: faqForm.answer,
                is_active: faqForm.isActive,
                view_count: 0,
                order: maxOrder + 1,
                created_at: now,
                updated_at: now
            };
            const result = await api.faqs.create(newFaq) as any;

            if (result?.error) {
                alert('FAQ 저장 실패: ' + (result.error.message || result.error));
                return;
            }

            setFaqs([...faqs, { ...newFaq, isActive: newFaq.is_active, viewCount: 0 }]);
        }

        setIsModalOpen(false);
        setSelectedFAQ(null);
        setFaqForm({ category: '', question: '', answer: '', isActive: true });
    };

    // Delete FAQ
    const handleDeleteFAQ = async (id: string) => {
        if (confirm('이 FAQ를 삭제하시겠습니까?')) {
            await api.faqs.delete(id);
            setFaqs(faqs.filter(f => f.id !== id));
        }
    };

    // Toggle FAQ Active
    const toggleFAQActive = async (faq: FAQ) => {
        await api.faqs.update(faq.id, { is_active: !faq.isActive });
        setFaqs(faqs.map(f => f.id === faq.id ? { ...f, isActive: !f.isActive } : f));
    };

    // Move FAQ Order
    const moveFAQOrder = async (faq: FAQ, direction: 'up' | 'down') => {
        const sorted = [...faqs].sort((a, b) => a.order - b.order);
        const index = sorted.findIndex(f => f.id === faq.id);

        if (direction === 'up' && index > 0) {
            const prev = sorted[index - 1];
            await api.faqs.update(faq.id, { order: prev.order });
            await api.faqs.update(prev.id, { order: faq.order });
            setFaqs(faqs.map(f => f.id === faq.id ? { ...f, order: prev.order } : f.id === prev.id ? { ...f, order: faq.order } : f));
        } else if (direction === 'down' && index < sorted.length - 1) {
            const next = sorted[index + 1];
            await api.faqs.update(faq.id, { order: next.order });
            await api.faqs.update(next.id, { order: faq.order });
            setFaqs(faqs.map(f => f.id === faq.id ? { ...f, order: next.order } : f.id === next.id ? { ...f, order: faq.order } : f));
        }
    };

    // The category table is created by /api/migrate-db; until then every write is refused.
    const alertCategoryError = (action: string, e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        if (message.includes('migrate-db')) {
            alert('FAQ 카테고리 테이블이 아직 없습니다.\n관리자로 로그인한 상태에서 /api/migrate-db 를 한 번 열어 주세요. (배포 후 1회)');
        } else {
            alert(`${action} 실패: ${message}`);
        }
    };

    // The table follows the saved order, so moving a row is visible right away.
    const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

    // Add/Edit Category
    const handleSaveCategory = async () => {
        const name = categoryForm.name.trim();
        if (!name) {
            alert('카테고리명을 입력해주세요.');
            return;
        }
        if (categories.some(c => c.name === name && c.id !== selectedCategory?.id)) {
            alert('이미 같은 이름의 카테고리가 있습니다.');
            return;
        }

        try {
            if (selectedCategory) {
                await api.faqCategories.update(selectedCategory.id, {
                    name,
                    is_active: categoryForm.isActive
                });

                // The server moves the FAQ rows that carried the old name in the same request.
                if (selectedCategory.name !== name) {
                    setFaqs(faqs.map(f => f.category === selectedCategory.name ? { ...f, category: name } : f));
                }

                setCategories(categories.map(c => c.id === selectedCategory.id ? { ...c, name, isActive: categoryForm.isActive } : c));
            } else {
                const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.order)) : 0;
                const newCat = {
                    id: `faq-cat-${Date.now()}`,
                    name,
                    is_active: categoryForm.isActive,
                    order: maxOrder + 1
                };
                await api.faqCategories.create(newCat);

                setCategories([...categories, { ...newCat, isActive: newCat.is_active }]);
            }
        } catch (e) {
            alertCategoryError(selectedCategory ? '카테고리 수정' : '카테고리 추가', e);
            return;
        }

        setIsCategoryModalOpen(false);
        setSelectedCategoryEdit(null);
        setCategoryForm({ name: '', isActive: true });
    };

    // Delete Category
    const handleDeleteCategory = async (id: string) => {
        const faqsInCategory = faqs.filter(f => f.category === categories.find(c => c.id === id)?.name);
        if (faqsInCategory.length > 0) {
            alert('이 카테고리에 FAQ가 있어 삭제할 수 없습니다.');
            return;
        }
        if (confirm('이 카테고리를 삭제하시겠습니까?')) {
            try {
                await api.faqCategories.delete(id);
                setCategories(categories.filter(c => c.id !== id));
            } catch (e) {
                alertCategoryError('카테고리 삭제', e);
            }
        }
    };

    // Toggle Category Active
    const toggleCategoryActive = async (cat: FAQCategory) => {
        try {
            await api.faqCategories.update(cat.id, { is_active: !cat.isActive });
            setCategories(categories.map(c => c.id === cat.id ? { ...c, isActive: !c.isActive } : c));
        } catch (e) {
            alertCategoryError('노출 상태 변경', e);
        }
    };

    // Move Category Order
    const moveCategoryOrder = async (cat: FAQCategory, direction: 'up' | 'down') => {
        const index = sortedCategories.findIndex(c => c.id === cat.id);
        const other = sortedCategories[direction === 'up' ? index - 1 : index + 1];
        if (!other) return;

        try {
            await api.faqCategories.update(cat.id, { order: other.order });
            await api.faqCategories.update(other.id, { order: cat.order });
            setCategories(categories.map(c => c.id === cat.id ? { ...c, order: other.order } : c.id === other.id ? { ...c, order: cat.order } : c));
        } catch (e) {
            alertCategoryError('순서 변경', e);
        }
    };

    const headerActions = (
        <>
            {activeTab === 'category' && (
                <button
                    className="btn btn-ink"
                    onClick={() => {
                        setSelectedCategoryEdit(null);
                        setCategoryForm({ name: '', isActive: true });
                        setIsCategoryModalOpen(true);
                    }}
                >
                    <Icon name="add" />
                    카테고리 추가
                </button>
            )}
            {activeTab === 'faq' && (
                <button
                    className="btn btn-ink"
                    onClick={() => {
                        setSelectedFAQ(null);
                        setFaqForm({ category: categories[0]?.name || '', question: '', answer: '', isActive: true });
                        setIsModalOpen(true);
                    }}
                >
                    <Icon name="add" />
                    FAQ 추가
                </button>
            )}
        </>
    );

    return (
        <AdminLayout activePage="faq" title="FAQ 관리" actions={headerActions}>
            <div className="route-anim">
                {/* Tabs */}
                <div className="toolbar">
                    <div className="seg">
                        <button
                            className={activeTab === 'faq' ? 'active' : ''}
                            onClick={() => setActiveTab('faq')}
                            title="고객센터 페이지(/faq)의 FAQ"
                        >
                            FAQ 목록
                        </button>
                        <button
                            className={activeTab === 'category' ? 'active' : ''}
                            onClick={() => setActiveTab('category')}
                            title="고객센터 FAQ 의 카테고리"
                        >
                            카테고리 관리
                        </button>
                        <button
                            className={activeTab === 'tour-common' ? 'active' : ''}
                            onClick={() => setActiveTab('tour-common')}
                            title="모든 상품 상세 페이지 하단에 공통으로 표시되는 FAQ"
                        >
                            투어 공통 FAQ
                        </button>
                    </div>
                </div>

                {activeTab === 'tour-common' ? (
                    <TourFAQEditor />
                ) : activeTab === 'faq' ? (
                    <>
                        {/* Filters */}
                        <div className="toolbar">
                            <div className="tb-search">
                                <Icon name="search" />
                                <input
                                    type="text"
                                    placeholder="질문 검색..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <select
                                className="select"
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                            >
                                <option value="all">전체 카테고리</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* FAQ Table */}
                        <div className="card">
                            <div className="tbl-wrap">
                                <table className="tbl">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 90 }}>순서</th>
                                            <th>카테고리</th>
                                            <th>질문</th>
                                            <th className="c">조회</th>
                                            <th className="c">노출</th>
                                            <th className="r">관리</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredFaqs.map((faq, index) => (
                                            <tr key={faq.id}>
                                                <td>
                                                    <span className="row" style={{ gap: 6 }}>
                                                        <Icon name="drag_indicator" className="drag-handle" />
                                                        <span className="edit-move">
                                                            <button onClick={() => moveFAQOrder(faq, 'up')} disabled={index === 0} title="위로">
                                                                <Icon name="arrow_upward" />
                                                            </button>
                                                            <button onClick={() => moveFAQOrder(faq, 'down')} disabled={index === filteredFaqs.length - 1} title="아래로">
                                                                <Icon name="arrow_downward" />
                                                            </button>
                                                        </span>
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="badge b-blue">{faq.category}</span>
                                                </td>
                                                <td className="cell-strong" style={{ maxWidth: 420 }}>
                                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{faq.question}</div>
                                                </td>
                                                <td className="c cell-mono">{faq.viewCount}</td>
                                                <td className="c">
                                                    <button
                                                        className={`switch${faq.isActive ? ' on' : ''}`}
                                                        onClick={() => toggleFAQActive(faq)}
                                                        title={faq.isActive ? '활성' : '비활성'}
                                                    >
                                                        <span className="knob" />
                                                    </button>
                                                </td>
                                                <td className="r">
                                                    <span className="row-actions">
                                                        <button
                                                            className="act-btn"
                                                            title="수정"
                                                            onClick={() => {
                                                                setSelectedFAQ(faq);
                                                                setFaqForm({ category: faq.category, question: faq.question, answer: faq.answer, isActive: faq.isActive });
                                                                setIsModalOpen(true);
                                                            }}
                                                        >
                                                            <Icon name="edit" />
                                                        </button>
                                                        <button className="act-btn danger" title="삭제" onClick={() => handleDeleteFAQ(faq.id)}>
                                                            <Icon name="delete" />
                                                        </button>
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {filteredFaqs.length === 0 && (
                                <div className="empty">
                                    <Icon name="inbox" />
                                    <p>등록된 FAQ가 없습니다.</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* Category Management */
                    <div className="card">
                        <div className="tbl-wrap">
                            <table className="tbl">
                                <thead>
                                    <tr>
                                        <th style={{ width: 90 }}>순서</th>
                                        <th>카테고리명</th>
                                        <th className="c">FAQ 수</th>
                                        <th className="c">노출</th>
                                        <th className="r">관리</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedCategories.map((cat, index) => (
                                        <tr key={cat.id}>
                                            <td>
                                                <span className="row" style={{ gap: 6 }}>
                                                    <Icon name="drag_indicator" className="drag-handle" />
                                                    <span className="edit-move">
                                                        <button onClick={() => moveCategoryOrder(cat, 'up')} disabled={index === 0} title="위로">
                                                            <Icon name="arrow_upward" />
                                                        </button>
                                                        <button onClick={() => moveCategoryOrder(cat, 'down')} disabled={index === sortedCategories.length - 1} title="아래로">
                                                            <Icon name="arrow_downward" />
                                                        </button>
                                                    </span>
                                                </span>
                                            </td>
                                            <td className="cell-strong">{cat.name}</td>
                                            <td className="c cell-mono">{faqs.filter(f => f.category === cat.name).length}개</td>
                                            <td className="c">
                                                <button
                                                    className={`switch${cat.isActive ? ' on' : ''}`}
                                                    title={cat.isActive ? '활성' : '비활성'}
                                                    onClick={() => toggleCategoryActive(cat)}
                                                >
                                                    <span className="knob" />
                                                </button>
                                            </td>
                                            <td className="r">
                                                <span className="row-actions">
                                                    <button
                                                        className="act-btn"
                                                        title="수정"
                                                        onClick={() => {
                                                            setSelectedCategoryEdit(cat);
                                                            setCategoryForm({ name: cat.name, isActive: cat.isActive });
                                                            setIsCategoryModalOpen(true);
                                                        }}
                                                    >
                                                        <Icon name="edit" />
                                                    </button>
                                                    <button className="act-btn danger" title="삭제" onClick={() => handleDeleteCategory(cat.id)}>
                                                        <Icon name="delete" />
                                                    </button>
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {categories.length === 0 && (
                            <div className="empty">
                                <Icon name="inbox" />
                                <p>등록된 카테고리가 없습니다.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* FAQ Modal */}
            {isModalOpen && (
                <div className="picker-scrim" onClick={() => setIsModalOpen(false)}>
                    <div className="picker" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
                        <div className="card-head">
                            <h2>{selectedFAQ ? 'FAQ 수정' : 'FAQ 추가'}</h2>
                            <div className="spacer" />
                            <button className="act-btn" title="닫기" onClick={() => setIsModalOpen(false)}>
                                <Icon name="close" />
                            </button>
                        </div>
                        <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
                            <div className="field">
                                <label>카테고리</label>
                                <select
                                    className="inp"
                                    value={faqForm.category}
                                    onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })}
                                >
                                    <option value="">선택하세요</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="field">
                                <label>질문</label>
                                <input
                                    className="inp"
                                    type="text"
                                    value={faqForm.question}
                                    onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                                    placeholder="질문을 입력하세요"
                                />
                            </div>
                            <div className="field">
                                <label>답변</label>
                                <textarea
                                    className="inp"
                                    value={faqForm.answer}
                                    onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                                    placeholder="답변을 입력하세요"
                                    rows={5}
                                />
                            </div>
                            <div className="field" style={{ marginBottom: 0 }}>
                                <label>노출 상태</label>
                                <div className="row" style={{ gap: 10 }}>
                                    <button
                                        type="button"
                                        className={`switch${faqForm.isActive ? ' on' : ''}`}
                                        onClick={() => setFaqForm({ ...faqForm, isActive: !faqForm.isActive })}
                                    >
                                        <span className="knob" />
                                    </button>
                                    <span className="cell-muted">{faqForm.isActive ? '활성화' : '비활성화'}</span>
                                </div>
                            </div>
                        </div>
                        <div className="drawer-foot">
                            <div className="spacer" style={{ flex: 1 }} />
                            <button className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>취소</button>
                            <button className="btn btn-ink" onClick={handleSaveFAQ}>저장</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Modal */}
            {isCategoryModalOpen && (
                <div className="picker-scrim" onClick={() => setIsCategoryModalOpen(false)}>
                    <div className="picker" onClick={(e) => e.stopPropagation()}>
                        <div className="card-head">
                            <h2>{selectedCategory ? '카테고리 수정' : '카테고리 추가'}</h2>
                            <div className="spacer" />
                            <button className="act-btn" title="닫기" onClick={() => setIsCategoryModalOpen(false)}>
                                <Icon name="close" />
                            </button>
                        </div>
                        <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
                            <div className="field">
                                <label>카테고리명</label>
                                <input
                                    className="inp"
                                    type="text"
                                    value={categoryForm.name}
                                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                    placeholder="예: 여행 준비"
                                />
                            </div>
                            <div className="field" style={{ marginBottom: 0 }}>
                                <label>노출 상태</label>
                                <div className="row" style={{ gap: 10 }}>
                                    <button
                                        type="button"
                                        className={`switch${categoryForm.isActive ? ' on' : ''}`}
                                        onClick={() => setCategoryForm({ ...categoryForm, isActive: !categoryForm.isActive })}
                                    >
                                        <span className="knob" />
                                    </button>
                                    <span className="cell-muted">{categoryForm.isActive ? '활성화' : '비활성화'}</span>
                                </div>
                            </div>
                        </div>
                        <div className="drawer-foot">
                            <div className="spacer" style={{ flex: 1 }} />
                            <button className="btn btn-ghost" onClick={() => setIsCategoryModalOpen(false)}>취소</button>
                            <button className="btn btn-ink" onClick={handleSaveCategory}>저장</button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};
