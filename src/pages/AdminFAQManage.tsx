import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { DashboardIcon } from '../components/admin/dashboard/DashboardIcon';
import { TourFAQEditor } from '../components/admin/TourFAQEditor';
import { api } from '../lib/api';
import './AdminContentManage.css';
import { adminConfirm, adminNotify } from '../components/admin/ui/adminFeedback';
import { adminValidateRequired } from '../components/admin/ui/adminForm';

interface FAQ {
    id: string;
    category: string;
    question: string;
    answer: string;
    isActive: boolean;
    /** faqs 표에는 조회수 칸이 없다. API가 값을 줄 때만 표시한다. */
    viewCount: number | null;
    order: number;
}

interface FAQCategory {
    id: string;
    name: string;
    isActive: boolean;
    order: number;
}

type Tab = 'faq' | 'category' | 'tour-common';

const TABS: Array<{ key: Tab; label: string; title: string }> = [
    { key: 'faq', label: 'FAQ 목록', title: '고객센터 페이지(/faq)의 FAQ' },
    { key: 'category', label: '카테고리 관리', title: '고객센터 FAQ 의 카테고리' },
    { key: 'tour-common', label: '투어 공통 FAQ', title: '모든 상품 상세 페이지 하단에 공통으로 표시되는 FAQ' },
];

/** 카테고리 배지 색 — 카테고리 순서대로 돌려 쓴다. */
const CATEGORY_TONES = 5;

const ChevronUp: React.FC<{ size?: number }> = ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flex: 'none', display: 'block' }}>
        <path d="m18 15-6-6-6 6" />
    </svg>
);

const InboxIcon: React.FC = () => (
    <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flex: 'none', display: 'block' }}>
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
);

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

const VisibilitySwitch: React.FC<{ on: boolean; onToggle: () => void; onLabel?: string; offLabel?: string; disabled?: boolean }> = ({ on, onToggle, onLabel = '노출', offLabel = '숨김', disabled }) => (
    <button type="button" className="cm-switch" aria-pressed={on} title={on ? onLabel : offLabel} onClick={onToggle} disabled={disabled}>
        <span className="cm-switch-track"><span className="cm-switch-knob" /></span>{on ? onLabel : offLabel}
    </button>
);

const OrderArrows: React.FC<{ onUp: () => void; onDown: () => void; upDisabled: boolean; downDisabled: boolean }> = ({ onUp, onDown, upDisabled, downDisabled }) => (
    <span className="cm-order">
        <button type="button" onClick={onUp} disabled={upDisabled} title="위로" aria-label="위로 옮기기"><ChevronUp /></button>
        <button type="button" onClick={onDown} disabled={downDisabled} title="아래로" aria-label="아래로 옮기기"><DashboardIcon name="lc-chevron-down" size={14} /></button>
    </span>
);

export const AdminFAQManage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('faq');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [selectedFAQ, setSelectedFAQ] = useState<FAQ | null>(null);
    const [selectedCategory, setSelectedCategoryEdit] = useState<FAQCategory | null>(null);
    const [filterCategory, setFilterCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [categories, setCategories] = useState<FAQCategory[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
    const [newCategoryName, setNewCategoryName] = useState('');
    const [busy, setBusy] = useState(false);

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
                if (Array.isArray(faqData)) setFaqs(faqData.map((f: any) => ({
                    ...f,
                    isActive: !!f.is_active,
                    viewCount: typeof f.view_count === 'number' ? f.view_count : null,
                    order: Number(f.order ?? f.sort_order) || 0,
                })));
                if (Array.isArray(catData)) setCategories(catData.map((c: any) => ({ ...c, isActive: !!c.is_active, order: Number(c.order ?? c.sort_order) || 0 })));
            } catch (e) { console.error('Failed to fetch FAQ data', e); }
            finally { setLoaded(true); }
        };
        fetchData();
    }, []);

    // The list follows the saved order, so moving a row is visible right away.
    const sortedFaqs = [...faqs].sort((a, b) => a.order - b.order);
    const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

    // Filter FAQs
    const q = searchQuery.trim().toLowerCase();
    const filteredFaqs = sortedFaqs.filter(faq => {
        const matchesCategory = filterCategory === 'all' || faq.category === filterCategory;
        const matchesSearch = !q || faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q);
        return matchesCategory && matchesSearch;
    });

    const categoryTone = (name: string) => {
        const index = sortedCategories.findIndex(c => c.name === name);
        return index < 0 ? CATEGORY_TONES - 1 : index % CATEGORY_TONES;
    };
    // 카테고리 표에 없는 옛 값도 칩으로 걸러 볼 수 있게 한다.
    const chipCategories = [...sortedCategories.map(c => c.name), ...[...new Set(faqs.map(f => f.category))].filter(name => name && !categories.some(c => c.name === name))];

    const openNewFAQ = () => {
        setSelectedFAQ(null);
        setFaqForm({ category: filterCategory !== 'all' ? filterCategory : sortedCategories[0]?.name || '', question: '', answer: '', isActive: true });
        setIsModalOpen(true);
    };

    // Add/Edit FAQ
    const handleSaveFAQ = async () => {
        // 빈 필수 칸은 그 칸 아래에 안내한다. 카테고리는 고르는 칸이라 알림으로 알린다.
        const filled = adminValidateRequired();
        if (!filled || !faqForm.question || !faqForm.answer || !faqForm.category) {
            if (filled && !faqForm.category) adminNotify('카테고리를 선택해 주세요.', 'error');
            return;
        }

        const now = new Date().toISOString();

        try {
            if (selectedFAQ) {
                const result = await api.faqs.update(selectedFAQ.id, {
                    category: faqForm.category,
                    question: faqForm.question,
                    answer: faqForm.answer,
                    is_active: faqForm.isActive,
                    updated_at: now
                }) as any;

                if (result?.error) {
                    adminNotify('FAQ 수정 실패: ' + (result.error.message || result.error));
                    return;
                }

                setFaqs(faqs.map(f => f.id === selectedFAQ.id ? { ...f, ...faqForm } : f));
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
                    adminNotify('FAQ 저장 실패: ' + (result.error.message || result.error));
                    return;
                }

                setFaqs([...faqs, { id: newFaq.id, category: newFaq.category, question: newFaq.question, answer: newFaq.answer, order: newFaq.order, isActive: newFaq.is_active, viewCount: null }]);
            }
        } catch (e) {
            adminNotify(`FAQ 저장 실패: ${errorMessage(e)}`);
            return;
        }

        setIsModalOpen(false);
        setSelectedFAQ(null);
        setFaqForm({ category: '', question: '', answer: '', isActive: true });
    };

    // Delete FAQ
    const handleDeleteFAQ = async (id: string) => {
        if (await adminConfirm('이 FAQ를 삭제하시겠습니까?')) {
            try {
                await api.faqs.delete(id);
                setFaqs(list => list.filter(f => f.id !== id));
            } catch (e) {
                adminNotify(`FAQ 삭제 실패: ${errorMessage(e)}`);
            }
        }
    };

    // Toggle FAQ Active
    const toggleFAQActive = async (faq: FAQ) => {
        try {
            await api.faqs.update(faq.id, { is_active: !faq.isActive });
            setFaqs(list => list.map(f => f.id === faq.id ? { ...f, isActive: !faq.isActive } : f));
        } catch (e) {
            adminNotify(`노출 상태 변경 실패: ${errorMessage(e)}`);
        }
    };

    // Move FAQ Order — swaps with the neighbour the admin can see in the current list.
    const moveFAQOrder = async (faq: FAQ, direction: 'up' | 'down') => {
        const index = filteredFaqs.findIndex(f => f.id === faq.id);
        const other = filteredFaqs[direction === 'up' ? index - 1 : index + 1];
        if (!other || busy) return;
        setBusy(true);
        try {
            await api.faqs.update(faq.id, { order: other.order });
            await api.faqs.update(other.id, { order: faq.order });
            setFaqs(list => list.map(f => f.id === faq.id ? { ...f, order: other.order } : f.id === other.id ? { ...f, order: faq.order } : f));
        } catch (e) {
            adminNotify(`순서 변경 실패: ${errorMessage(e)}`);
        } finally {
            setBusy(false);
        }
    };

    // The category table is created by /api/migrate-db; until then every write is refused.
    const alertCategoryError = (action: string, e: unknown) => {
        const message = errorMessage(e);
        if (message.includes('migrate-db')) {
            adminNotify('FAQ 카테고리 테이블이 아직 없습니다.\n관리자로 로그인한 상태에서 /api/migrate-db 를 한 번 열어 주세요. (배포 후 1회)');
        } else {
            adminNotify(`${action} 실패: ${message}`);
        }
    };

    const createCategory = async (name: string, isActive: boolean) => {
        const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.order)) : 0;
        const newCat = {
            id: `faq-cat-${Date.now()}`,
            name,
            is_active: isActive,
            order: maxOrder + 1
        };
        await api.faqCategories.create(newCat);
        setCategories(list => [...list, { id: newCat.id, name: newCat.name, order: newCat.order, isActive: newCat.is_active }]);
    };

    // Add/Edit Category
    const handleSaveCategory = async () => {
        const name = categoryForm.name.trim();
        if (!name) { adminValidateRequired(); return; }
        if (categories.some(c => c.name === name && c.id !== selectedCategory?.id)) {
            adminNotify('이미 같은 이름의 카테고리가 있습니다.');
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
                    if (filterCategory === selectedCategory.name) setFilterCategory(name);
                }

                setCategories(categories.map(c => c.id === selectedCategory.id ? { ...c, name, isActive: categoryForm.isActive } : c));
            } else {
                await createCategory(name, categoryForm.isActive);
            }
        } catch (e) {
            alertCategoryError(selectedCategory ? '카테고리 수정' : '카테고리 추가', e);
            return;
        }

        setIsCategoryModalOpen(false);
        setSelectedCategoryEdit(null);
        setCategoryForm({ name: '', isActive: true });
    };

    // Quick add from the category tab (same rules as the modal; new categories start visible).
    const handleQuickAddCategory = async () => {
        const name = newCategoryName.trim();
        if (!name || busy) return;
        if (categories.some(c => c.name === name)) {
            adminNotify('이미 같은 이름의 카테고리가 있습니다.');
            return;
        }
        setBusy(true);
        try {
            await createCategory(name, true);
            setNewCategoryName('');
        } catch (e) {
            alertCategoryError('카테고리 추가', e);
        } finally {
            setBusy(false);
        }
    };

    // Delete Category
    const handleDeleteCategory = async (id: string) => {
        const faqsInCategory = faqs.filter(f => f.category === categories.find(c => c.id === id)?.name);
        if (faqsInCategory.length > 0) {
            adminNotify('이 카테고리에 FAQ가 있어 삭제할 수 없습니다.');
            return;
        }
        if (await adminConfirm('이 카테고리를 삭제하시겠습니까?')) {
            try {
                await api.faqCategories.delete(id);
                setCategories(list => list.filter(c => c.id !== id));
            } catch (e) {
                alertCategoryError('카테고리 삭제', e);
            }
        }
    };

    // Toggle Category Active
    const toggleCategoryActive = async (cat: FAQCategory) => {
        try {
            await api.faqCategories.update(cat.id, { is_active: !cat.isActive });
            setCategories(list => list.map(c => c.id === cat.id ? { ...c, isActive: !cat.isActive } : c));
        } catch (e) {
            alertCategoryError('노출 상태 변경', e);
        }
    };

    // Move Category Order
    const moveCategoryOrder = async (cat: FAQCategory, direction: 'up' | 'down') => {
        const index = sortedCategories.findIndex(c => c.id === cat.id);
        const other = sortedCategories[direction === 'up' ? index - 1 : index + 1];
        if (!other || busy) return;

        setBusy(true);
        try {
            await api.faqCategories.update(cat.id, { order: other.order });
            await api.faqCategories.update(other.id, { order: cat.order });
            setCategories(list => list.map(c => c.id === cat.id ? { ...c, order: other.order } : c.id === other.id ? { ...c, order: cat.order } : c));
        } catch (e) {
            alertCategoryError('순서 변경', e);
        } finally {
            setBusy(false);
        }
    };

    const headerActions = activeTab === 'tour-common' ? null : (
        <button type="button" className="btn btn-ink" onClick={openNewFAQ}>
            <DashboardIcon name="lc-plus" />
            FAQ 추가
        </button>
    );

    const emptyFaqText = !loaded ? '불러오는 중…' : faqs.length ? '조건에 맞는 FAQ가 없어요.' : '등록된 FAQ가 없어요.';

    return (
        <AdminLayout activePage="faq" title="FAQ 관리" actions={headerActions}>
            <div className="cm-page fq-page route-anim">
                {/* Tabs */}
                <div className="cm-tabs" role="tablist" aria-label="FAQ 관리 화면">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.key}
                            className="cm-tab"
                            onClick={() => setActiveTab(tab.key)}
                            title={tab.title}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'tour-common' ? (
                    <TourFAQEditor />
                ) : activeTab === 'faq' ? (
                    <>
                        {/* Filters */}
                        <div className="cm-toolbar">
                            <label className="cm-search">
                                <DashboardIcon name="lc-search" color="var(--text-tertiary)" />
                                <input
                                    type="text"
                                    placeholder="질문 · 답변 검색"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    aria-label="FAQ 검색"
                                />
                            </label>
                            <div className="cm-chips" aria-label="카테고리">
                                <button type="button" className="cm-chip" aria-pressed={filterCategory === 'all'} onClick={() => setFilterCategory('all')}>
                                    전체<span className="cm-chip-n">{faqs.length}</span>
                                </button>
                                {chipCategories.map(name => (
                                    <button key={name} type="button" className="cm-chip" aria-pressed={filterCategory === name} onClick={() => setFilterCategory(name)}>
                                        {name}<span className="cm-chip-n">{faqs.filter(f => f.category === name).length}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* FAQ List */}
                        <section className="cm-card" aria-label="FAQ 목록">
                            {filteredFaqs.map((faq, index) => {
                                const open = !!openIds[faq.id];
                                return (
                                    <div key={faq.id} className="fq-item" data-hidden={!faq.isActive || undefined}>
                                        <div className="fq-row">
                                            <OrderArrows
                                                onUp={() => void moveFAQOrder(faq, 'up')}
                                                onDown={() => void moveFAQOrder(faq, 'down')}
                                                upDisabled={busy || index === 0}
                                                downDisabled={busy || index === filteredFaqs.length - 1}
                                            />
                                            <span className="fq-num">{index + 1}</span>
                                            <span className="cm-cat" data-tone={categoryTone(faq.category)}>{faq.category}</span>
                                            <button
                                                type="button"
                                                className="fq-q"
                                                aria-expanded={open}
                                                onClick={() => setOpenIds(ids => ({ ...ids, [faq.id]: !ids[faq.id] }))}
                                            >
                                                <span className="fq-q-mark">Q</span>
                                                <span className="fq-q-text">{faq.question}</span>
                                                <span className="fq-chev"><DashboardIcon name="lc-chevron-down" /></span>
                                            </button>
                                            {faq.viewCount !== null && <span className="fq-views">조회 {faq.viewCount.toLocaleString('ko-KR')}</span>}
                                            <VisibilitySwitch on={faq.isActive} onToggle={() => void toggleFAQActive(faq)} />
                                            <button
                                                type="button"
                                                className="cm-icon-btn"
                                                title="수정"
                                                aria-label="FAQ 수정"
                                                onClick={() => {
                                                    setSelectedFAQ(faq);
                                                    setFaqForm({ category: faq.category, question: faq.question, answer: faq.answer, isActive: faq.isActive });
                                                    setIsModalOpen(true);
                                                }}
                                            >
                                                <DashboardIcon name="lc-pencil" />
                                            </button>
                                            <button type="button" className="cm-icon-btn is-danger" title="삭제" aria-label="FAQ 삭제" onClick={() => void handleDeleteFAQ(faq.id)}>
                                                <DashboardIcon name="lc-trash" />
                                            </button>
                                        </div>
                                        {open && (
                                            <div className="fq-answer">
                                                <span className="fq-a-mark">A</span>
                                                <span className="fq-a-text">{faq.answer}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {filteredFaqs.length === 0 && (
                                <div className="cm-empty">
                                    <InboxIcon />
                                    <span>{emptyFaqText}</span>
                                </div>
                            )}
                        </section>
                    </>
                ) : (
                    /* Category Management */
                    <section className="cm-card fq-cats" aria-label="FAQ 카테고리">
                        <form
                            className="fq-cat-add"
                            onSubmit={(e) => { e.preventDefault(); void handleQuickAddCategory(); }}
                        >
                            <input
                                className="cm-input"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="새 카테고리 이름 (예: 비자·여권)"
                                aria-label="새 카테고리 이름"
                            />
                            <button type="submit" className="cm-btn is-primary is-tall" disabled={busy || !newCategoryName.trim()}>추가</button>
                        </form>
                        {sortedCategories.map((cat, index) => {
                            const count = faqs.filter(f => f.category === cat.name).length;
                            return (
                                <div key={cat.id} className="fq-cat-row" data-hidden={!cat.isActive || undefined}>
                                    <OrderArrows
                                        onUp={() => void moveCategoryOrder(cat, 'up')}
                                        onDown={() => void moveCategoryOrder(cat, 'down')}
                                        upDisabled={busy || index === 0}
                                        downDisabled={busy || index === sortedCategories.length - 1}
                                    />
                                    <span className="fq-cat-dot" data-tone={index % CATEGORY_TONES} />
                                    <span className="fq-cat-name">{cat.name}</span>
                                    <span className="fq-cat-count">FAQ {count}개</span>
                                    <VisibilitySwitch on={cat.isActive} onToggle={() => void toggleCategoryActive(cat)} />
                                    <button
                                        type="button"
                                        className="cm-icon-btn"
                                        title="이름·노출 수정"
                                        aria-label="카테고리 수정"
                                        onClick={() => {
                                            setSelectedCategoryEdit(cat);
                                            setCategoryForm({ name: cat.name, isActive: cat.isActive });
                                            setIsCategoryModalOpen(true);
                                        }}
                                    >
                                        <DashboardIcon name="lc-pencil" />
                                    </button>
                                    <button
                                        type="button"
                                        className="cm-icon-btn is-danger"
                                        title={count ? 'FAQ가 있어 지울 수 없어요' : '삭제'}
                                        aria-label="카테고리 삭제"
                                        disabled={count > 0}
                                        onClick={() => void handleDeleteCategory(cat.id)}
                                    >
                                        <DashboardIcon name="lc-trash" />
                                    </button>
                                </div>
                            );
                        })}
                        {categories.length === 0 && (
                            <div className="cm-empty">
                                <InboxIcon />
                                <span>{loaded ? '등록된 카테고리가 없어요.' : '불러오는 중…'}</span>
                            </div>
                        )}
                        <p className="fq-cat-note">FAQ가 들어 있는 카테고리는 지울 수 없어요. 먼저 FAQ를 다른 카테고리로 옮겨 주세요. 이름을 바꾸면 그 카테고리의 FAQ도 함께 옮겨집니다.</p>
                    </section>
                )}
            </div>

            {/* FAQ Modal */}
            {isModalOpen && (
                <div className="cm-scrim" onClick={() => setIsModalOpen(false)}>
                    <div className="cm-modal" role="dialog" aria-modal="true" aria-labelledby="fq-modal-title" onClick={(e) => e.stopPropagation()}>
                        <div className="cm-modal-head">
                            <h2 id="fq-modal-title">{selectedFAQ ? 'FAQ 수정' : 'FAQ 추가'}</h2>
                            <button type="button" className="cm-icon-btn" title="닫기" aria-label="닫기" onClick={() => setIsModalOpen(false)}>
                                <DashboardIcon name="lc-x" />
                            </button>
                        </div>
                        <div className="cm-modal-body">
                            <div className="cm-field">
                                <span className="cm-label">카테고리</span>
                                {sortedCategories.length > 0 ? (
                                    <div className="cm-picks">
                                        {sortedCategories.map(cat => (
                                            <button key={cat.id} type="button" className="cm-pick" aria-pressed={faqForm.category === cat.name}
                                                onClick={() => setFaqForm({ ...faqForm, category: cat.name })}>
                                                {cat.name}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="cm-hint">먼저 「카테고리 관리」에서 카테고리를 추가해 주세요.</span>
                                )}
                            </div>
                            <label className="cm-field">
                                <span className="cm-label adm-req">질문</span>
                                <input
                                    className="cm-input"
                                    type="text"
                                    value={faqForm.question}
                                    onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                                    placeholder="질문을 입력하세요"
                                />
                            </label>
                            <label className="cm-field">
                                <span className="cm-label adm-req">답변</span>
                                <textarea
                                    className="cm-textarea"
                                    value={faqForm.answer}
                                    onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                                    placeholder="답변을 입력하세요"
                                />
                            </label>
                            <div className="cm-field">
                                <span className="cm-label">노출 상태</span>
                                <VisibilitySwitch on={faqForm.isActive} onLabel="활성화" offLabel="숨김" onToggle={() => setFaqForm({ ...faqForm, isActive: !faqForm.isActive })} />
                            </div>
                        </div>
                        <div className="cm-modal-foot">
                            <button type="button" className="cm-btn" onClick={() => setIsModalOpen(false)}>취소</button>
                            <button type="button" className="cm-btn is-primary"
                                disabled={!faqForm.category || !faqForm.question.trim() || !faqForm.answer.trim()}
                                onClick={() => void handleSaveFAQ()}>저장</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Modal */}
            {isCategoryModalOpen && (
                <div className="cm-scrim" onClick={() => setIsCategoryModalOpen(false)}>
                    <div className="cm-modal is-narrow" role="dialog" aria-modal="true" aria-labelledby="fq-cat-modal-title" onClick={(e) => e.stopPropagation()}>
                        <div className="cm-modal-head">
                            <h2 id="fq-cat-modal-title">{selectedCategory ? '카테고리 수정' : '카테고리 추가'}</h2>
                            <button type="button" className="cm-icon-btn" title="닫기" aria-label="닫기" onClick={() => setIsCategoryModalOpen(false)}>
                                <DashboardIcon name="lc-x" />
                            </button>
                        </div>
                        <div className="cm-modal-body">
                            <label className="cm-field">
                                <span className="cm-label adm-req">카테고리명</span>
                                <input
                                    className="cm-input"
                                    type="text"
                                    value={categoryForm.name}
                                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                    placeholder="예: 여행 준비"
                                />
                            </label>
                            <div className="cm-field">
                                <span className="cm-label">노출 상태</span>
                                <VisibilitySwitch on={categoryForm.isActive} onLabel="활성화" offLabel="숨김" onToggle={() => setCategoryForm({ ...categoryForm, isActive: !categoryForm.isActive })} />
                            </div>
                        </div>
                        <div className="cm-modal-foot">
                            <button type="button" className="cm-btn" onClick={() => setIsCategoryModalOpen(false)}>취소</button>
                            <button type="button" className="cm-btn is-primary" onClick={() => void handleSaveCategory()}>저장</button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};
