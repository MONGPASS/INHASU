// Migrated to API
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import { uploadImage } from '../utils/upload';
import { useAdminContentGuard, type AdminContentState } from '../hooks/useAdminContentGuard';
import { createAdminContentTask, moveAdminRow } from '../utils/adminContentWorkflow';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { DashboardIcon } from '../components/admin/dashboard/DashboardIcon';
import './AdminCategoryManage.css';
import { DEFAULT_CATEGORIES, DEFAULT_MAGAZINE_CATEGORIES, type Category } from '../types/category';

export const AdminCategoryManage: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const task = useRef(createAdminContentTask()), mounted = useRef(true), reading = useRef(false);
    const modalState = useRef<AdminContentState>({ busy: false, dirty: false });
    const [actionBusy, setActionBusy] = useState(false), [modalBusy, setModalBusy] = useState(false), [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState(''), [loadError, setLoadError] = useState('');
    const busy = actionBusy || modalBusy;
    useAdminContentGuard(() => ({ busy: task.current.busy() || modalState.current.busy, dirty: modalState.current.dirty }), setNotice);
    const handleEditorState = useCallback((state: AdminContentState) => { modalState.current = state; setModalBusy(state.busy); }, []);
    const closeModal = () => { setIsModalOpen(false); setSelectedCategory(null); modalState.current = { busy: false, dirty: false }; setModalBusy(false); };
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const [productCategories, setProductCategories] = useState<string[] | null>(null);
    useEffect(() => {
        let active = true;
        Promise.resolve(api.products?.list?.()).then(rows => { if (active && Array.isArray(rows)) setProductCategories(rows.map((row: any) => String(row?.category ?? ''))); }).catch(() => { /* counts stay hidden */ });
        return () => { active = false; };
    }, []);
    const productCount = (category: Category) => productCategories == null ? '—' : category.id === 'all' ? productCategories.length : productCategories.filter(name => name === category.name).length;

    // Fetch categories from API
    const fetchCategories = async () => {
        if (reading.current) return;
        reading.current = true; setLoading(true); setLoadError('');
        try {
            let data = await api.categories.list();
            if (!Array.isArray(data)) throw new Error('카테고리 응답을 확인해 주세요.');
            if (!data.length) { await seedDefaultCategories(); data = await api.categories.list(); }
            if (!mounted.current) return;

            if (Array.isArray(data) && data.length > 0) {
                const productCats = data.filter((c: any) => c.type === 'product' || !c.type);
                setCategories(productCats.map((c: any) => ({
                    id: c.id,
                    // Older categories can have no icon; rendering and the edit form need a string.
                    icon: typeof c.icon === 'string' && c.icon.trim() ? c.icon.trim() : 'category',
                    name: c.name,
                    description: c.description,
                    isActive: c.is_active,
                    order: c.order ?? c.sort_order ?? 0,
                    type: c.type || 'product',
                    landing_hero_image: c.landing_hero_image,
                    landing_hero_images: Array.isArray(c.landing_hero_images) ? c.landing_hero_images : [],
                    landing_hero_tagline: c.landing_hero_tagline,
                    landing_hero_title: c.landing_hero_title,
                    landing_hero_subtitle: c.landing_hero_subtitle,
                    landing_accent_color: c.landing_accent_color,
                    landing_highlights: Array.isArray(c.landing_highlights) ? c.landing_highlights : [],
                    landing_product_grid_title: c.landing_product_grid_title,
                })));
            } else setCategories([]);
        } catch (error) {
            if (mounted.current) setLoadError('카테고리를 불러오지 못했습니다. 다시 시도해 주세요.');
        } finally { reading.current = false; if (mounted.current) setLoading(false); }
    };

    const seedDefaultCategories = async () => {
        const inserts = DEFAULT_CATEGORIES.map((c, idx) => ({
            id: c.id,
            icon: c.icon,
            name: c.name,
            description: c.description,
            is_active: c.isActive,
            order: idx,
            type: 'product'
        }));
        for (const cat of inserts) {
            await api.categories.create(cat);
        }

        // Also seed magazine categories
        const magInserts = DEFAULT_MAGAZINE_CATEGORIES.map((c, idx) => ({
            id: c.id,
            icon: c.icon,
            name: c.name,
            description: c.description,
            is_active: c.isActive,
            order: idx,
            type: 'magazine'
        }));
        for (const cat of magInserts) {
            await api.categories.create(cat);
        }

    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

    const runAction = async (work: () => Promise<void>) => {
        if (loading || modalState.current.busy) return;
        const release = task.current.begin('list'); if (!release) return;
        setActionBusy(true); setNotice('');
        try { await work(); await fetchCategories(); }
        catch (error: any) { if (mounted.current) setNotice(error?.message || '변경 내용을 저장하지 못했습니다. 다시 시도해 주세요.'); }
        finally { release(); if (mounted.current) setActionBusy(false); }
    };
    const toggleActive = (id: string, currentStatus: boolean) => runAction(async () => {
        await api.categories.update(id, { is_active: !currentStatus });
    });
    const deleteCategory = (id: string) => {
        if (task.current.busy() || modalState.current.busy) return;
        if (id === 'all') { setNotice('전체 카테고리는 삭제할 수 없습니다.'); return; }
        if (confirm('정말 이 카테고리를 삭제하시겠습니까?')) return runAction(async () => { await api.categories.delete(id); });
    };
    const moveCategory = (index: number, direction: 'up' | 'down') => runAction(async () => {
        const next = moveAdminRow(sortedCategories, index, direction === 'up' ? -1 : 1);
        if (next === sortedCategories) return;
        await api.categories.reorder(next.map((category, order) => ({ id: category.id, sort_order: order })), 'product');
    });

    const handleSaveCategory = async (category: Category): Promise<boolean> => {
        const release = task.current.begin('save'); if (!release) return false;
        setActionBusy(true);
        try {
            const heroImages = Array.isArray(category.landing_hero_images)
                ? category.landing_hero_images.filter(Boolean)
                : [];
            // Keep legacy landing_hero_image in sync with the first slide for backward compat
            const primaryHero = heroImages[0] || category.landing_hero_image || null;
            const landingPayload = {
                landing_hero_image: primaryHero,
                landing_hero_images: heroImages,
                landing_hero_tagline: category.landing_hero_tagline || null,
                landing_hero_title: category.landing_hero_title || null,
                landing_hero_subtitle: category.landing_hero_subtitle || null,
                landing_accent_color: category.landing_accent_color || null,
                landing_highlights: category.landing_highlights || [],
                landing_product_grid_title: category.landing_product_grid_title || null,
            };
            if (selectedCategory) {
                // If the admin changed the URL slug (id), rename on the server first so the
                // subsequent update hits the new row.
                let effectiveId = category.id;
                if (selectedCategory.id !== category.id) {
                    const newId = (category.id || '').trim();
                    if (!newId || !/^[a-z0-9][a-z0-9-]*$/.test(newId)) {
                        alert('URL 슬러그는 영문 소문자/숫자/하이픈으로, 문자나 숫자로 시작해야 합니다.');
                        return false;
                    }
                    if (!confirm(`URL 슬러그를 "${selectedCategory.id}" → "${newId}" 로 변경하시겠습니까?\n기존 /category/${selectedCategory.id} 링크는 더이상 열리지 않습니다.`)) {
                        return false;
                    }
                    await api.categories.rename(selectedCategory.id, newId);
                    effectiveId = newId;
                    if (mounted.current) setSelectedCategory(previous => previous ? { ...previous, id: newId } : previous);
                }

                // Update
                await api.categories.update(effectiveId, {
                    icon: category.icon,
                    name: category.name,
                    description: category.description,
                    is_active: category.isActive,
                    ...landingPayload,
                });
            } else {
                // Add New
                const newCategory = {
                    id: `cat-${Date.now()}`,
                    icon: category.icon,
                    name: category.name,
                    description: category.description,
                    is_active: category.isActive ?? true,
                    order: sortedCategories.length,
                    type: 'product',
                    ...landingPayload,
                };
                await api.categories.create(newCategory);
            }
            await fetchCategories();
            return true;
        } catch (error: any) {
            throw new Error(error?.message || '저장하지 못했습니다. 입력한 내용은 유지됩니다. 다시 시도해 주세요.');
        } finally { release(); if (mounted.current) setActionBusy(false); }
    };

    return (
        <AdminLayout
            activePage="categories"
            title="상품 카테고리"
            description="화살표로 노출 순서를 바꾸고, 스위치로 사이트 노출을 켜고 꺼요."
            actions={
                <button
                    onClick={() => {
                        setSelectedCategory(null);
                        setIsModalOpen(true);
                    }}
                    className="btn btn-ink"
                    disabled={busy || loading || !!loadError || isModalOpen}
                >
                    <Icon name="add" />
                    카테고리 추가
                </button>
            }
        >
            {notice && <p role="alert" className="card card-pad">{notice}</p>}
            {loadError && <div role="alert" className="card card-pad">{loadError}<button type="button" className="btn btn-ghost" onClick={fetchCategories} disabled={busy || loading}>다시 불러오기</button></div>}
            {(loading || actionBusy) && <p role="status">{loading ? '카테고리를 불러오는 중…' : '카테고리 변경 내용을 저장하는 중…'}</p>}
            <fieldset disabled={busy || loading || !!loadError || isModalOpen} inert={busy || loading || !!loadError || isModalOpen} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <div className="route-anim cg-page">
                <div className="card cg-card">
                    <div className="tbl-wrap">
                        <table className="tbl cg-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 60 }}>순서</th>
                                    <th style={{ width: 80 }}>아이콘</th>
                                    <th>이름</th>
                                    <th>설명</th>
                                    <th className="r">상품</th>
                                    <th className="c">노출</th>
                                    <th className="r">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedCategories.length === 0 ? (
                                    <tr>
                                        <td colSpan={7}>
                                            <div className="empty">
                                                <Icon name="category" />
                                                <p>등록된 카테고리가 없습니다.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    sortedCategories.map((category, index) => (
                                        <tr key={category.id} className={category.isActive ? undefined : 'is-hidden'}>
                                            <td>
                                                <span className="row" style={{ gap: 6 }}>
                                                    <span className="edit-move">
                                                        <button
                                                            type="button"
                                                            onClick={() => moveCategory(index, 'up')}
                                                            disabled={index === 0}
                                                        >
                                                            <Icon name="arrow_upward" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => moveCategory(index, 'down')}
                                                            disabled={index === sortedCategories.length - 1}
                                                        >
                                                            <Icon name="arrow_downward" />
                                                        </button>
                                                    </span>
                                                    <b className="cell-mono">{index + 1}</b>
                                                </span>
                                            </td>
                                            <td>
                                                {category.icon.startsWith('data:') || category.icon.startsWith('http') || category.icon.startsWith('/') ? (
                                                    <img
                                                        src={category.icon}
                                                        alt={category.name}
                                                        className="thumb sq cg-icon"
                                                    />
                                                ) : (
                                                    <span className="thumb sq cg-icon">
                                                        <Icon name={category.icon} />
                                                    </span>
                                                )}
                                            </td>
                                            <td className="cell-strong">{category.name}</td>
                                            <td className="cell-muted">{category.description || '—'}</td>
                                            <td className="r cg-count">{productCount(category)}</td>
                                            <td className="c">
                                                <button
                                                    type="button"
                                                    className={`switch${category.isActive ? ' on' : ''}`}
                                                    aria-pressed={category.isActive}
                                                    aria-label={`${category.name} 사이트 노출`}
                                                    onClick={() => toggleActive(category.id, category.isActive)}
                                                >
                                                    <span className="knob" />
                                                </button>
                                            </td>
                                            <td className="r">
                                                <span className="row-actions">
                                                    <button
                                                        type="button"
                                                        className="act-btn"
                                                        title="수정"
                                                        aria-label={`${category.name} 수정`}
                                                        onClick={() => {
                                                            setSelectedCategory(category);
                                                            setIsModalOpen(true);
                                                        }}
                                                    >
                                                        <DashboardIcon name="lc-pencil" size={16} />
                                                    </button>
                                                    {category.id !== 'all' ? (
                                                        <button
                                                            type="button"
                                                            className="act-btn danger"
                                                            title="삭제"
                                                            aria-label={`${category.name} 삭제`}
                                                            onClick={() => deleteCategory(category.id)}
                                                        >
                                                            <DashboardIcon name="lc-trash" size={16} />
                                                        </button>
                                                    ) : <span className="cg-fixed" title="기본 카테고리는 삭제할 수 없어요">기본</span>}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            </fieldset>
            {/* Modal */}
            {isModalOpen && (
                <CategoryModal
                    category={selectedCategory}
                    type="product"
                    onClose={closeModal}
                    onEditorState={handleEditorState}
                    onSave={handleSaveCategory}
                />
            )}
        </AdminLayout>
    );
};

// Category Modal Component
interface CategoryModalProps {
    category: Category | null;
    type: 'product' | 'magazine';
    onClose: () => void;
    onSave: (category: Category) => Promise<boolean>;
    onEditorState?: (state: AdminContentState) => void;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({ category, type, onClose, onSave, onEditorState }) => {
    const [formData, setFormDataState] = useState<Partial<Category>>(
        category || {
            name: '',
            icon: 'category',
            description: '',
            isActive: true,
            order: 0,
            type: type
        }
    );

    const formRef = useRef(formData), baseline = useRef(JSON.stringify(formData)), saved = useRef(false), mounted = useRef(true);
    const task = useRef(createAdminContentTask());
    const [busy, setBusy] = useState<'upload' | 'save' | null>(null), [error, setError] = useState('');
    const report = useRef(onEditorState); report.current = onEditorState;
    const dirty = () => !saved.current && JSON.stringify(formRef.current) !== baseline.current;
    const setFormData: React.Dispatch<React.SetStateAction<Partial<Category>>> = change => {
        if (!mounted.current) return;
        const next = typeof change === 'function' ? change(formRef.current) : change;
        formRef.current = next; setFormDataState(next);
        report.current?.({ busy: task.current.busy(), dirty: dirty() });
    };
    useEffect(() => { mounted.current = true; report.current?.({ busy: false, dirty: dirty() }); return () => { mounted.current = false; report.current?.({ busy: false, dirty: false }); }; }, []);
    const close = () => {
        if (task.current.busy()) { setError('저장·이미지 업로드가 끝난 뒤 닫아 주세요.'); return; }
        if (dirty() && !window.confirm('저장하지 않은 카테고리 변경사항을 버리고 닫을까요?')) return;
        onClose();
    };
    const uploadImageTo = async (file: File, apply: (url: string) => void): Promise<boolean> => {
        const release = task.current.begin('upload'); if (!release) return false;
        setBusy('upload'); setError(''); report.current?.({ busy: true, dirty: dirty() });
        try { const url = await uploadImage(file, 'categories'); if (!mounted.current) return false; apply(url); return true; }
        catch (reason: any) { if (mounted.current) setError(reason?.message || '이미지 업로드에 실패했습니다. 기존 입력은 유지됩니다. 다시 선택해 주세요.'); return false; }
        finally { release(); if (mounted.current) { setBusy(null); report.current?.({ busy: false, dirty: dirty() }); } }
    };
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const release = task.current.begin('save'); if (!release) return;
        if (!formRef.current.name?.trim() || !formRef.current.icon) { release(); setError('카테고리 이름과 아이콘을 입력해 주세요.'); return; }
        setBusy('save'); setError(''); report.current?.({ busy: true, dirty: dirty() });
        try {
            const success = await onSave({ ...formRef.current, type } as Category);
            if (!success) return;
            saved.current = true; report.current?.({ busy: false, dirty: false }); onClose();
        } catch (reason: any) { if (mounted.current) setError(reason?.message || '저장에 실패했습니다. 입력을 확인한 뒤 다시 시도해 주세요.'); }
        finally { release(); if (mounted.current) { setBusy(null); report.current?.({ busy: false, dirty: dirty() }); } }
    };

    return (
        <div className="picker-scrim cg-drawer-scrim" onClick={close}>
            <div
                className="picker cg-drawer"
                role="dialog"
                aria-modal="true"
                aria-label={category ? '카테고리 수정' : '카테고리 추가'}
                onClick={(e) => e.stopPropagation()}
            >
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {error && <p role="alert" style={{ padding: '12px 20px', color: '#9f4d13' }}>{error}</p>}
                    {busy && <p role="status" style={{ padding: '12px 20px' }}>{busy === 'upload' ? '이미지 업로드 중…' : '카테고리 저장 중…'}</p>}
                    <fieldset disabled={!!busy} inert={!!busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: 'contents' }}>
                    {/* Header */}
                    <div className="card-head">
                        <h2>
                            {category ? '카테고리 수정' : `${type === 'product' ? '상품' : '매거진'} 카테고리 추가`}
                        </h2>
                        <div className="spacer" />
                        <button
                            type="button"
                            onClick={close}
                            className="act-btn"
                            title="닫기"
                            aria-label="닫기"
                        >
                            <DashboardIcon name="lc-x" size={18} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="cg-drawer-body">
                        {/* Name */}
                        <div className="field">
                            <label>카테고리 이름 *</label>
                            <input
                                type="text"
                                className="inp"
                                value={formData.name || ''}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder={type === 'product' ? "예: 서부몽골" : "예: 몽골 기본 정보"}
                            />
                        </div>

                        {/* URL Slug (editable only in edit mode, and not for the "all" category) */}
                        {category && category.id !== 'all' && (
                            <div className="field">
                                <label>URL 슬러그 (ID)</label>
                                <div className="row" style={{ gap: 8 }}>
                                    <span className="cell-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>/category/</span>
                                    <input
                                        type="text"
                                        className="inp"
                                        style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
                                        value={formData.id || ''}
                                        onChange={(e) => setFormData({ ...formData, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                                        placeholder="예: gobi"
                                    />
                                </div>
                                <p className="cell-muted" style={{ fontSize: 12, marginTop: 6 }}>
                                    영문 소문자/숫자/하이픈만 허용. 변경 시 기존 URL이 더이상 열리지 않으니 주의하세요.
                                </p>
                            </div>
                        )}

                        {/* Description */}
                        <div className="field">
                            <label>설명</label>
                            <input
                                type="text"
                                className="inp"
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder={type === 'product' ? "예: 알타이 산맥 트레킹" : "예: 환전, 유심, 날씨 등"}
                            />
                        </div>

                        {/* Icon */}
                        <div className="field">
                            <label>아이콘 이미지 * <span className="cg-hint">1:1 이미지 · 사용자 화면에선 원형으로 보여요</span></label>

                            {/* Image Preview */}
                            {formData.icon && (formData.icon.startsWith('data:') || formData.icon.startsWith('http') || formData.icon.startsWith('/')) && (
                                <div style={{ marginBottom: 12 }}>
                                    <img
                                        src={formData.icon}
                                        alt="Category icon"
                                        className="thumb sq"
                                        style={{ width: 80, height: 80 }}
                                    />
                                </div>
                            )}

                            {/* File Upload */}
                            <label className="cg-upload">
                                <DashboardIcon name="lc-image-plus" size={18} />
                                <span>{formData.icon && (formData.icon.startsWith('data:') || formData.icon.startsWith('http') || formData.icon.startsWith('/')) ? '이미지 바꾸기' : '이미지 올리기'}</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={e => {
                                        const input = e.target, file = input.files?.[0];
                                        if (file) void uploadImageTo(file, url => setFormData(previous => ({ ...previous, icon: url }))).finally(() => { input.value = ''; });
                                    }}
                                />
                            </label>
                        </div>

                        {/* Active Status */}
                        <div className="toggle-row cg-visible">
                            <button
                                type="button"
                                className={`switch${formData.isActive ? ' on' : ''}`}
                                aria-pressed={!!formData.isActive}
                                aria-label="사이트에 노출"
                                onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                            >
                                <span className="knob" />
                            </button>
                            <span><b>사이트에 노출</b><small>끄면 카테고리 메뉴와 랜딩 페이지가 숨겨져요</small></span>
                        </div>

                        {/* Landing page editor — only for product categories */}
                        {type === 'product' && (
                            <LandingPageEditor
                                formData={formData}
                                setFormData={setFormData}
                                uploadImageTo={uploadImageTo}
                            />
                        )}
                    </div>

                    {/* Footer */}
                    <div className="drawer-foot cg-drawer-foot">
                        <div className="spacer" style={{ flex: 1 }} />
                        <button
                            type="button"
                            onClick={close}
                            className="btn btn-ghost"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className="btn btn-ink"
                        >
                            {category ? '수정 완료' : '추가 완료'}
                        </button>
                    </div>
                    </fieldset>
                </form>
            </div>
        </div>
    );
};

// ─── Landing Page Editor ────────────────────────────────────────────
interface LandingEditorProps {
    formData: Partial<Category>;
    setFormData: React.Dispatch<React.SetStateAction<Partial<Category>>>;
    uploadImageTo: (file: File, apply: (url: string) => void) => Promise<boolean>;
}

const LandingPageEditor: React.FC<LandingEditorProps> = ({ formData, setFormData, uploadImageTo }) => {
    const [expanded, setExpanded] = useState(false);
    const highlights = formData.landing_highlights || [];

    const updateHighlights = (next: any[]) => setFormData({ ...formData, landing_highlights: next });

    const addSection = () => {
        updateHighlights([...highlights, { label: `하이라이트 ${highlights.length + 1}`, title: '', subtitle: '', cards: [] }]);
    };
    const updateSection = (idx: number, patch: any) => {
        const next = [...highlights];
        next[idx] = { ...next[idx], ...patch };
        updateHighlights(next);
    };
    const removeSection = (idx: number) => {
        updateHighlights(highlights.filter((_, i) => i !== idx));
    };
    const addCard = (sectionIdx: number) => {
        const next = [...highlights];
        next[sectionIdx] = { ...next[sectionIdx], cards: [...(next[sectionIdx].cards || []), { image: '', tags: [], title: '', description: '' }] };
        updateHighlights(next);
    };
    const updateCard = (sectionIdx: number, cardIdx: number, patch: any) => setFormData(previous => {
        const next = [...(previous.landing_highlights || [])];
        if (!next[sectionIdx]?.cards?.[cardIdx]) return previous;
        const cards = [...next[sectionIdx].cards]; cards[cardIdx] = { ...cards[cardIdx], ...patch };
        next[sectionIdx] = { ...next[sectionIdx], cards }; return { ...previous, landing_highlights: next };
    });
    const removeCard = (sectionIdx: number, cardIdx: number) => {
        const next = [...highlights];
        next[sectionIdx] = { ...next[sectionIdx], cards: next[sectionIdx].cards.filter((_: any, i: number) => i !== cardIdx) };
        updateHighlights(next);
    };

    return (
        <div className="edit-sec" style={{ padding: 0 }}>
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="edit-sec-head"
                style={{ width: '100%', padding: '14px 16px', margin: 0, border: 'none', background: 'none', cursor: 'pointer' }}
            >
                <DashboardIcon name="lc-panels-top-left" size={16} />
                <h4 style={{ fontSize: 14 }}>랜딩 페이지 <span className="cg-slug">/category/{formData.id || '…'}</span></h4>
                <span className="spacer" style={{ flex: 1 }} />
                <Icon name="expand_more" className={expanded ? 'rotate' : ''} style={expanded ? { transform: 'rotate(180deg)' } : undefined} />
            </button>

            {expanded && (
                <div style={{ padding: 16, borderTop: '1px solid var(--border-default)' }}>
                    {/* Hero */}
                    <div style={{ paddingBottom: 16, marginBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
                        <p className="sec-label">히어로 배너</p>

                        <HeroImagesEditor
                            images={(() => {
                                const imgs = Array.isArray(formData.landing_hero_images) ? formData.landing_hero_images : [];
                                // Migrate legacy single image into the array if array is empty
                                if (imgs.length === 0 && formData.landing_hero_image) return [formData.landing_hero_image];
                                return imgs;
                            })()}
                            onChange={(next) => setFormData(previous => ({
                                ...previous,
                                landing_hero_images: next,
                                landing_hero_image: next[0] || '',
                            }))}
                            uploadImageTo={uploadImageTo}
                        />

                        <div className="field-row" style={{ marginTop: 12 }}>
                            <div className="field" style={{ marginBottom: 0 }}>
                                <label>소제목 (tagline)</label>
                                <input
                                    type="text"
                                    className="inp"
                                    value={formData.landing_hero_tagline || ''}
                                    onChange={(e) => setFormData({ ...formData, landing_hero_tagline: e.target.value })}
                                    placeholder="예: 쏟아지는 별밤이 기다리고 있어요"
                                />
                            </div>
                            <div className="field" style={{ marginBottom: 0 }}>
                                <label>강조 색상 (accent)</label>
                                <input
                                    type="color"
                                    className="inp"
                                    style={{ padding: 4 }}
                                    value={formData.landing_accent_color || '#0f766e'}
                                    onChange={(e) => setFormData({ ...formData, landing_accent_color: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                            <label>메인 제목</label>
                            <input
                                type="text"
                                className="inp"
                                value={formData.landing_hero_title || ''}
                                onChange={(e) => setFormData({ ...formData, landing_hero_title: e.target.value })}
                                placeholder="예: 고비사막 투어"
                            />
                        </div>

                        <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                            <label>서브 제목 (설명)</label>
                            <textarea
                                className="inp"
                                value={formData.landing_hero_subtitle || ''}
                                onChange={(e) => setFormData({ ...formData, landing_hero_subtitle: e.target.value })}
                                rows={2}
                                placeholder="예: 은하수가 또렷이 보이는 하늘, 노을에 물드는 사구..."
                            />
                        </div>

                        <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
                            <label>상품 섹션 제목</label>
                            <input
                                type="text"
                                className="inp"
                                value={formData.landing_product_grid_title || ''}
                                onChange={(e) => setFormData({ ...formData, landing_product_grid_title: e.target.value })}
                                placeholder="예: 고비사막 인기 투어"
                            />
                        </div>
                    </div>

                    {/* Highlights */}
                    <div>
                        <div className="row" style={{ marginBottom: 12 }}>
                            <p className="sec-label" style={{ margin: 0 }}>하이라이트 섹션 ({highlights.length})</p>
                            <span className="spacer" style={{ flex: 1 }} />
                            <button type="button" onClick={addSection} className="btn btn-ghost btn-sm">
                                <Icon name="add" />섹션 추가
                            </button>
                        </div>

                        <div className="stack" style={{ gap: 12 }}>
                            {highlights.map((section: any, sIdx: number) => (
                                <div key={sIdx} className="edit-sec">
                                    <div className="row" style={{ marginBottom: 8 }}>
                                        <span className="cell-mono" style={{ fontSize: 11 }}>섹션 {sIdx + 1}</span>
                                        <span className="spacer" style={{ flex: 1 }} />
                                        <button type="button" onClick={() => removeSection(sIdx)} className="act-btn danger" title="삭제">
                                            <Icon name="delete" />
                                        </button>
                                    </div>
                                    <div className="field-row">
                                        <input
                                            type="text"
                                            className="inp"
                                            value={section.label || ''}
                                            onChange={(e) => updateSection(sIdx, { label: e.target.value })}
                                            placeholder="뱃지 라벨 (예: 하이라이트 1)"
                                        />
                                        <input
                                            type="text"
                                            className="inp"
                                            value={section.title || ''}
                                            onChange={(e) => updateSection(sIdx, { title: e.target.value })}
                                            placeholder="섹션 제목"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        className="inp"
                                        style={{ marginTop: 8 }}
                                        value={section.subtitle || ''}
                                        onChange={(e) => updateSection(sIdx, { subtitle: e.target.value })}
                                        placeholder="섹션 서브타이틀"
                                    />

                                    {/* Cards */}
                                    <div className="stack" style={{ gap: 8, marginTop: 12 }}>
                                        {(section.cards || []).map((card: any, cIdx: number) => (
                                            <div key={cIdx} className="card card-pad" style={{ padding: 10 }}>
                                                <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                                                    <div className="thumb sq" style={{ overflow: 'hidden', display: 'grid', placeItems: 'center', color: 'var(--mrt-gray-400)' }}>
                                                        {card.image ? (
                                                            <img src={card.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <Icon name="image" />
                                                        )}
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div className="row" style={{ gap: 6 }}>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                style={{ fontSize: 11, width: 112 }}
                                                                onChange={(e) => {
                                                                    const input = e.target, file = input.files?.[0];
                                                                    if (file) void uploadImageTo(file, url => updateCard(sIdx, cIdx, { image: url })).finally(() => { input.value = ''; });
                                                                }}
                                                            />
                                                            <input
                                                                type="text"
                                                                className="inp"
                                                                style={{ flex: 1, height: 34, fontSize: 12 }}
                                                                value={(card.tags || []).join(', ')}
                                                                onChange={(e) => updateCard(sIdx, cIdx, { tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                                                placeholder="태그 (콤마 구분)"
                                                            />
                                                            <button type="button" onClick={() => removeCard(sIdx, cIdx)} className="act-btn danger" title="삭제">
                                                                <Icon name="close" />
                                                            </button>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            className="inp"
                                                            style={{ marginTop: 6, height: 34, fontSize: 12 }}
                                                            value={card.title || ''}
                                                            onChange={(e) => updateCard(sIdx, cIdx, { title: e.target.value })}
                                                            placeholder="카드 제목"
                                                        />
                                                        <input
                                                            type="text"
                                                            className="inp"
                                                            style={{ marginTop: 6, height: 34, fontSize: 12 }}
                                                            value={card.description || ''}
                                                            onChange={(e) => updateCard(sIdx, cIdx, { description: e.target.value })}
                                                            placeholder="카드 설명"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => addCard(sIdx)} className="add-line">
                                            <Icon name="add" /> 카드 추가
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {highlights.length === 0 && (
                                <div className="empty" style={{ padding: '32px 20px' }}>
                                    <p>위 "섹션 추가" 버튼으로 하이라이트를 만드세요</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Hero Images (Slider) Editor ───────────────────────────────────
interface HeroImagesEditorProps {
    images: string[];
    onChange: (next: string[]) => void;
    uploadImageTo: (file: File, cb: (url: string) => void) => Promise<boolean>;
}

const HeroImagesEditor: React.FC<HeroImagesEditorProps> = ({ images, onChange, uploadImageTo }) => {
    const handleFiles = async (files: File[]) => {
        // Upload sequentially so we can keep a reliable running list
        let current = [...images];
        for (const file of files) {
            const ok = await uploadImageTo(file, url => { current = [...current, url]; onChange(current); });
            if (!ok) break;
        }
    };
    const removeImage = (idx: number) => onChange(images.filter((_, i) => i !== idx));
    const moveImage = (idx: number, dir: 'left' | 'right') => {
        const newIdx = dir === 'left' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= images.length) return;
        const next = [...images];
        [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
        onChange(next);
    };

    return (
        <div>
            <div className="row" style={{ marginBottom: 6 }}>
                <label className="cell-strong" style={{ fontSize: 12 }}>
                    배경 이미지 슬라이드 ({images.length})
                </label>
                <span className="spacer" style={{ flex: 1 }} />
                <span className="cell-muted" style={{ fontSize: 11 }}>첫 번째 이미지가 대표 이미지로 사용됩니다</span>
            </div>

            {images.length > 0 && (
                <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    {images.map((url, idx) => (
                        <div key={idx} style={{ position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
                            <img src={url} alt={`hero-${idx + 1}`} style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block' }} />
                            <div style={{ position: 'absolute', top: 4, left: 4, padding: '1px 6px', borderRadius: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, fontWeight: 700 }}>
                                {idx + 1}
                            </div>
                            <div className="row" style={{ position: 'absolute', top: 4, right: 4, gap: 4 }}>
                                <button
                                    type="button"
                                    onClick={() => moveImage(idx, 'left')}
                                    disabled={idx === 0}
                                    style={{ padding: 4, borderRadius: 6, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                                    aria-label="move left"
                                >
                                    <Icon name="chevron_left" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => moveImage(idx, 'right')}
                                    disabled={idx === images.length - 1}
                                    style={{ padding: 4, borderRadius: 6, border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                                    aria-label="move right"
                                >
                                    <Icon name="chevron_right" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => removeImage(idx)}
                                    style={{ padding: 4, borderRadius: 6, border: 'none', background: 'rgba(255,79,79,0.9)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                                    aria-label="delete"
                                >
                                    <Icon name="close" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <label className="add-line" style={{ cursor: 'pointer' }}>
                <Icon name="add_photo_alternate" />
                이미지 추가
                <input
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        handleFiles(files);
                        e.target.value = '';
                    }}
                />
            </label>
        </div>
    );
};
