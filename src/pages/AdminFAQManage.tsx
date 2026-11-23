import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { TourFAQEditor } from '../components/admin/TourFAQEditor';
import { api } from '../lib/api';
import {
    AdminBadge, AdminButton, AdminCard, AdminChipGroup, AdminDialog, AdminEmpty, AdminError, AdminField, AdminIconButton, AdminLoading,
    AdminMessage, AdminSearch, AdminSwitch, AdminTable, AdminTabs, AdminTbody, AdminTd, AdminTextArea, AdminTextInput, AdminTh, AdminThead,
    AdminTr, type AdminTagTone, IconArrowDown, IconArrowUp, IconChevronDown, IconChevronUp, IconPencil, IconPlus, IconTrash,
} from '../components/admin/ui';
import './AdminFAQManage.css';
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

const TAB_HINT: Record<Tab, string> = {
    faq: '고객센터 페이지(/faq)에 보이는 FAQ입니다.',
    category: '고객센터 FAQ의 카테고리입니다.',
    'tour-common': '모든 상품 상세 페이지 아래에 공통으로 보이는 FAQ입니다.',
};

/** 카테고리 배지 색 — 카테고리 순서대로 돌려 쓰고, 카테고리 표에 없는 옛 값은 회색 */
const CATEGORY_TONES: AdminTagTone[] = ['tag-blue', 'tag-violet', 'tag-orange', 'tag-cyan', 'tag-pink'];

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

const EMPTY_FAQ_FORM = { category: '', question: '', answer: '', isActive: true };
const EMPTY_CATEGORY_FORM = { name: '', isActive: true };

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
    const [loadFailed, setLoadFailed] = useState(false);
    const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
    const [newCategoryName, setNewCategoryName] = useState('');
    const [busy, setBusy] = useState(false);
    const [saving, setSaving] = useState(false);

    // FAQ Form (처음 값과 비교해 고친 내용이 있으면 닫을 때 묻는다)
    const [faqForm, setFaqForm] = useState(EMPTY_FAQ_FORM);
    const [faqFormStart, setFaqFormStart] = useState(EMPTY_FAQ_FORM);

    // Category Form
    const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY_FORM);
    const [categoryFormStart, setCategoryFormStart] = useState(EMPTY_CATEGORY_FORM);

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
            } catch (e) { console.error('Failed to fetch FAQ data', e); setLoadFailed(true); }
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

    const categoryTone = (name: string): AdminTagTone | 'neutral' => {
        const index = sortedCategories.findIndex(c => c.name === name);
        return index < 0 ? 'neutral' : CATEGORY_TONES[index % CATEGORY_TONES.length];
    };
    // 카테고리 표에 없는 옛 값도 칩으로 걸러 볼 수 있게 한다.
    const chipCategories = [...sortedCategories.map(c => c.name), ...[...new Set(faqs.map(f => f.category))].filter(name => name && !categories.some(c => c.name === name))];

    const openFaqEditor = (faq: FAQ | null) => {
        const form = faq
            ? { category: faq.category, question: faq.question, answer: faq.answer, isActive: faq.isActive }
            : { ...EMPTY_FAQ_FORM, category: filterCategory !== 'all' ? filterCategory : sortedCategories[0]?.name || '' };
        setSelectedFAQ(faq);
        setFaqForm(form);
        setFaqFormStart(form);
        setIsModalOpen(true);
    };
    const closeFaqEditor = () => { setIsModalOpen(false); setSelectedFAQ(null); };
    const openCategoryEditor = (cat: FAQCategory) => {
        const form = { name: cat.name, isActive: cat.isActive };
        setSelectedCategoryEdit(cat);
        setCategoryForm(form);
        setCategoryFormStart(form);
        setIsCategoryModalOpen(true);
    };
    const closeCategoryEditor = () => { setIsCategoryModalOpen(false); setSelectedCategoryEdit(null); };

    // Add/Edit FAQ
    const handleSaveFAQ = async () => {
        if (saving) return;
        // 빈 필수 칸은 그 칸 아래에 안내한다. 카테고리는 고르는 칸이라 알림으로 알린다.
        const filled = adminValidateRequired();
        if (!filled || !faqForm.question || !faqForm.answer || !faqForm.category) {
            if (filled && !faqForm.category) adminNotify('카테고리를 선택해 주세요.', 'error');
            return;
        }

        const now = new Date().toISOString();

        setSaving(true);
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

                setFaqs(list => list.map(f => f.id === selectedFAQ.id ? { ...f, ...faqForm } : f));
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

                setFaqs(list => [...list, { id: newFaq.id, category: newFaq.category, question: newFaq.question, answer: newFaq.answer, order: newFaq.order, isActive: newFaq.is_active, viewCount: null }]);
            }
        } catch (e) {
            adminNotify(`FAQ 저장 실패: ${errorMessage(e)}`);
            return;
        } finally {
            setSaving(false);
        }

        closeFaqEditor();
        setFaqForm(EMPTY_FAQ_FORM);
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

    // Edit Category (추가는 카테고리 탭의 빠른 추가 줄에서 한다)
    const handleSaveCategory = async () => {
        if (saving) return;
        const name = categoryForm.name.trim();
        if (!name) { adminValidateRequired(); return; }
        if (categories.some(c => c.name === name && c.id !== selectedCategory?.id)) {
            adminNotify('이미 같은 이름의 카테고리가 있습니다.');
            return;
        }

        setSaving(true);
        try {
            if (selectedCategory) {
                await api.faqCategories.update(selectedCategory.id, {
                    name,
                    is_active: categoryForm.isActive
                });

                // The server moves the FAQ rows that carried the old name in the same request.
                if (selectedCategory.name !== name) {
                    setFaqs(list => list.map(f => f.category === selectedCategory.name ? { ...f, category: name } : f));
                    if (filterCategory === selectedCategory.name) setFilterCategory(name);
                }

                setCategories(list => list.map(c => c.id === selectedCategory.id ? { ...c, name, isActive: categoryForm.isActive } : c));
            } else {
                await createCategory(name, categoryForm.isActive);
            }
        } catch (e) {
            alertCategoryError(selectedCategory ? '카테고리 수정' : '카테고리 추가', e);
            return;
        } finally {
            setSaving(false);
        }

        closeCategoryEditor();
        setCategoryForm(EMPTY_CATEGORY_FORM);
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
        <AdminButton variant="primary" leading={<IconPlus />} onClick={() => openFaqEditor(null)}>FAQ 추가</AdminButton>
    );

    const faqDirty = JSON.stringify(faqForm) !== JSON.stringify(faqFormStart);
    const categoryDirty = JSON.stringify(categoryForm) !== JSON.stringify(categoryFormStart);

    const faqList = !loaded ? <AdminLoading label="FAQ를 불러오는 중…" />
        : loadFailed && !faqs.length ? <AdminError reason="목록을 불러오지 못했습니다. 새로고침해 주세요." />
        : filteredFaqs.length === 0 ? <AdminEmpty title={faqs.length ? '조건에 맞는 FAQ가 없어요.' : '등록된 FAQ가 없어요.'} description={faqs.length ? '검색어나 카테고리를 바꿔 보세요.' : '‘FAQ 추가’로 첫 질문을 만들어 주세요.'} />
        : (
            <AdminTable label="FAQ 목록" className="fq-table">
                <AdminThead>
                    <AdminTr>
                        <AdminTh className="fq-c-order">순서</AdminTh>
                        <AdminTh className="fq-c-cat">카테고리</AdminTh>
                        <AdminTh>질문</AdminTh>
                        <AdminTh align="right" className="fq-c-views">조회</AdminTh>
                        <AdminTh align="center" className="fq-c-active">노출</AdminTh>
                        <AdminTh align="right" className="fq-c-actions">관리</AdminTh>
                    </AdminTr>
                </AdminThead>
                <AdminTbody>
                    {filteredFaqs.map((faq, index) => {
                        const open = !!openIds[faq.id];
                        return (
                            <React.Fragment key={faq.id}>
                                <AdminTr className={faq.isActive ? undefined : 'is-hidden'}>
                                    <AdminTd className="fq-c-order">
                                        <span className="fq-order">
                                            <AdminIconButton size="sm" label={`${index + 1}번 FAQ 위로`} onClick={() => void moveFAQOrder(faq, 'up')} disabled={busy || index === 0}><IconArrowUp /></AdminIconButton>
                                            <AdminIconButton size="sm" label={`${index + 1}번 FAQ 아래로`} onClick={() => void moveFAQOrder(faq, 'down')} disabled={busy || index === filteredFaqs.length - 1}><IconArrowDown /></AdminIconButton>
                                            <b className="fq-order-no">{index + 1}</b>
                                        </span>
                                    </AdminTd>
                                    <AdminTd className="fq-c-cat"><AdminBadge tone={categoryTone(faq.category)}>{faq.category || '없음'}</AdminBadge></AdminTd>
                                    <AdminTd className="fq-question">
                                        <span className="fq-question-row">
                                            <span className="fq-q-mark" aria-hidden="true">Q</span>
                                            <span className="fq-q-text">{faq.question}</span>
                                            <AdminIconButton size="sm" label={open ? '답변 접기' : '답변 보기'} aria-expanded={open}
                                                onClick={() => setOpenIds(ids => ({ ...ids, [faq.id]: !ids[faq.id] }))}>
                                                {open ? <IconChevronUp /> : <IconChevronDown />}
                                            </AdminIconButton>
                                        </span>
                                    </AdminTd>
                                    <AdminTd align="right" className="fq-c-views">{faq.viewCount !== null ? faq.viewCount.toLocaleString('ko-KR') : '—'}</AdminTd>
                                    <AdminTd align="center" className="fq-c-active">
                                        <AdminSwitch size="sm" aria-label={`${index + 1}번 FAQ 노출`} checked={faq.isActive} onChange={() => void toggleFAQActive(faq)} />
                                    </AdminTd>
                                    <AdminTd align="right" className="fq-c-actions">
                                        <span className="fq-actions">
                                            <AdminIconButton label="FAQ 수정" onClick={() => openFaqEditor(faq)}><IconPencil /></AdminIconButton>
                                            <AdminIconButton label="FAQ 삭제" className="fq-danger" onClick={() => void handleDeleteFAQ(faq.id)}><IconTrash /></AdminIconButton>
                                        </span>
                                    </AdminTd>
                                </AdminTr>
                                {open && (
                                    <AdminTr className="fq-answer-row">
                                        <AdminTd colSpan={6}>
                                            <div className="fq-answer">
                                                <span className="fq-a-mark" aria-hidden="true">A</span>
                                                <p className="fq-a-text">{faq.answer}</p>
                                            </div>
                                        </AdminTd>
                                    </AdminTr>
                                )}
                            </React.Fragment>
                        );
                    })}
                </AdminTbody>
            </AdminTable>
        );

    const categoryList = !loaded ? <AdminLoading label="카테고리를 불러오는 중…" />
        : categories.length === 0 ? <AdminEmpty title="등록된 카테고리가 없어요." description="위 칸에 이름을 적고 ‘추가’를 눌러 주세요." />
        : (
            <AdminTable label="FAQ 카테고리" className="fq-table">
                <AdminThead>
                    <AdminTr>
                        <AdminTh className="fq-c-order">순서</AdminTh>
                        <AdminTh>이름</AdminTh>
                        <AdminTh align="right" className="fq-c-count">FAQ</AdminTh>
                        <AdminTh align="center" className="fq-c-active">노출</AdminTh>
                        <AdminTh align="right" className="fq-c-actions">관리</AdminTh>
                    </AdminTr>
                </AdminThead>
                <AdminTbody>
                    {sortedCategories.map((cat, index) => {
                        const count = faqs.filter(f => f.category === cat.name).length;
                        return (
                            <AdminTr key={cat.id} className={cat.isActive ? undefined : 'is-hidden'}>
                                <AdminTd className="fq-c-order">
                                    <span className="fq-order">
                                        <AdminIconButton size="sm" label={`${cat.name} 위로`} onClick={() => void moveCategoryOrder(cat, 'up')} disabled={busy || index === 0}><IconArrowUp /></AdminIconButton>
                                        <AdminIconButton size="sm" label={`${cat.name} 아래로`} onClick={() => void moveCategoryOrder(cat, 'down')} disabled={busy || index === sortedCategories.length - 1}><IconArrowDown /></AdminIconButton>
                                        <b className="fq-order-no">{index + 1}</b>
                                    </span>
                                </AdminTd>
                                <AdminTd className="fq-cat-name"><AdminBadge tone={CATEGORY_TONES[index % CATEGORY_TONES.length]}>{cat.name}</AdminBadge></AdminTd>
                                <AdminTd align="right" className="fq-c-count">{count}개</AdminTd>
                                <AdminTd align="center" className="fq-c-active">
                                    <AdminSwitch size="sm" aria-label={`${cat.name} 노출`} checked={cat.isActive} onChange={() => void toggleCategoryActive(cat)} />
                                </AdminTd>
                                <AdminTd align="right" className="fq-c-actions">
                                    <span className="fq-actions">
                                        <AdminIconButton label={`${cat.name} 이름·노출 수정`} onClick={() => openCategoryEditor(cat)}><IconPencil /></AdminIconButton>
                                        <AdminIconButton label={count ? `${cat.name}: FAQ가 있어 지울 수 없어요` : `${cat.name} 삭제`} className="fq-danger" disabled={count > 0} onClick={() => void handleDeleteCategory(cat.id)}><IconTrash /></AdminIconButton>
                                    </span>
                                </AdminTd>
                            </AdminTr>
                        );
                    })}
                </AdminTbody>
            </AdminTable>
        );

    return (
        <AdminLayout activePage="faq" title="FAQ 관리" description={TAB_HINT[activeTab]} actions={headerActions}>
            <div className="fq-page">
                <AdminCard flush className="fq-card">
                    <div className="fq-tabs">
                        <AdminTabs
                            label="FAQ 관리 화면"
                            value={activeTab}
                            onChange={setActiveTab}
                            items={[
                                { value: 'faq', label: 'FAQ 목록', count: loaded ? faqs.length : null },
                                { value: 'category', label: '카테고리 관리', count: loaded ? categories.length : null },
                                { value: 'tour-common', label: '투어 공통 FAQ' },
                            ]}
                        />
                    </div>

                    {activeTab === 'tour-common' ? (
                        <div className="fq-pad"><TourFAQEditor /></div>
                    ) : activeTab === 'faq' ? (
                        <>
                            <div className="fq-filters">
                                <AdminSearch value={searchQuery} onChange={setSearchQuery} placeholder="질문 · 답변 검색" aria-label="FAQ 검색" />
                                <AdminChipGroup
                                    label="카테고리"
                                    value={filterCategory}
                                    onChange={setFilterCategory}
                                    items={[
                                        { value: 'all', label: '전체', count: faqs.length },
                                        ...chipCategories.map(name => ({ value: name, label: name, count: faqs.filter(f => f.category === name).length })),
                                    ]}
                                />
                            </div>
                            {faqList}
                        </>
                    ) : (
                        <>
                            <form className="fq-filters fq-cat-add" onSubmit={(e) => { e.preventDefault(); void handleQuickAddCategory(); }}>
                                <AdminTextInput
                                    className="fq-cat-input"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    placeholder="새 카테고리 이름 (예: 비자·여권)"
                                    aria-label="새 카테고리 이름"
                                />
                                <AdminButton type="submit" leading={<IconPlus />} disabled={busy || !newCategoryName.trim()}>추가</AdminButton>
                            </form>
                            {categoryList}
                            <p className="fq-note">FAQ가 들어 있는 카테고리는 지울 수 없어요. 먼저 FAQ를 다른 카테고리로 옮겨 주세요. 이름을 바꾸면 그 카테고리의 FAQ도 함께 옮겨집니다.</p>
                        </>
                    )}
                </AdminCard>
            </div>

            {/* FAQ 추가·수정 창 */}
            <AdminDialog
                open={isModalOpen}
                onClose={closeFaqEditor}
                title={selectedFAQ ? 'FAQ 수정' : 'FAQ 추가'}
                dirty={faqDirty}
                onSubmit={() => void handleSaveFAQ()}
                submitting={saving}
                submitDisabled={!faqForm.category || !faqForm.question.trim() || !faqForm.answer.trim()}
            >
                <AdminField id="fq-category" label="카테고리" required>
                    {sortedCategories.length > 0 ? (
                        <AdminChipGroup
                            label="카테고리"
                            value={faqForm.category}
                            onChange={(category) => setFaqForm({ ...faqForm, category })}
                            items={sortedCategories.map(cat => ({ value: cat.name, label: cat.name }))}
                        />
                    ) : (
                        <AdminMessage tone="cautionary">먼저 ‘카테고리 관리’ 탭에서 카테고리를 추가해 주세요.</AdminMessage>
                    )}
                </AdminField>
                <AdminField id="fq-question" label="질문" required>
                    <AdminTextInput
                        id="fq-question"
                        value={faqForm.question}
                        onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                        placeholder="질문을 입력하세요"
                    />
                </AdminField>
                <AdminField id="fq-answer" label="답변" required>
                    <AdminTextArea
                        id="fq-answer"
                        minRows={5}
                        value={faqForm.answer}
                        onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                        placeholder="답변을 입력하세요"
                    />
                </AdminField>
                <AdminSwitch
                    checked={faqForm.isActive}
                    onChange={(isActive) => setFaqForm({ ...faqForm, isActive })}
                    label="고객센터에 노출"
                    description="끄면 /faq 페이지에서 숨겨져요"
                />
            </AdminDialog>

            {/* 카테고리 이름·노출 수정 창 */}
            <AdminDialog
                open={isCategoryModalOpen}
                onClose={closeCategoryEditor}
                size="sm"
                title={selectedCategory ? '카테고리 수정' : '카테고리 추가'}
                dirty={categoryDirty}
                onSubmit={() => void handleSaveCategory()}
                submitting={saving}
            >
                <AdminField id="fq-cat-name" label="카테고리명" required hint="이름을 바꾸면 이 카테고리의 FAQ도 새 이름으로 옮겨집니다.">
                    <AdminTextInput
                        id="fq-cat-name"
                        aria-describedby="fq-cat-name-hint"
                        value={categoryForm.name}
                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                        placeholder="예: 여행 준비"
                    />
                </AdminField>
                <AdminSwitch
                    checked={categoryForm.isActive}
                    onChange={(isActive) => setCategoryForm({ ...categoryForm, isActive })}
                    label="고객센터에 노출"
                />
            </AdminDialog>
        </AdminLayout>
    );
};
