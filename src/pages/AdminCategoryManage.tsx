// Migrated to API
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import { uploadImage } from '../utils/upload';
import { useAdminContentGuard, type AdminContentState } from '../hooks/useAdminContentGuard';
import { createAdminContentTask, moveAdminRow } from '../utils/adminContentWorkflow';
import { AdminLayout } from '../components/admin/AdminLayout';
import { MaterialIcon } from '../components/admin/console/Icon';
import {
    AdminBadge, AdminButton, AdminCard, AdminDialog, AdminEmpty, AdminError, AdminField, AdminFileButton, AdminIconButton, AdminLoading,
    AdminMessage, AdminSwitch, AdminTable, AdminTbody, AdminTd, AdminTextArea, AdminTextButton, AdminTextInput, AdminTh, AdminThead, AdminTr,
    cx, IconArrowDown, IconArrowUp, IconChevronDown, IconChevronLeft, IconChevronRight, IconChevronUp, IconClose, IconImage, IconPencil,
    IconPlus, IconTrash, IconUpload,
} from '../components/admin/ui';
import './AdminCategoryManage.css';
import { DEFAULT_CATEGORIES, DEFAULT_MAGAZINE_CATEGORIES, LEGACY_LANDING_ACCENT, type Category } from '../types/category';
import { adminConfirm, adminNotify } from '../components/admin/ui/adminFeedback';

/** 저장된 아이콘이 이미지 주소인지(아니면 Material Symbols 이름) */
const isImageIcon = (icon?: string) => !!icon && (icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('/'));

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
    const deleteCategory = async (id: string) => {
        if (task.current.busy() || modalState.current.busy) return;
        if (id === 'all') { setNotice('전체 카테고리는 삭제할 수 없습니다.'); return; }
        if (await adminConfirm('정말 이 카테고리를 삭제하시겠습니까?')) return runAction(async () => { await api.categories.delete(id); });
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
                        adminNotify('URL 슬러그는 영문 소문자/숫자/하이픈으로, 문자나 숫자로 시작해야 합니다.');
                        return false;
                    }
                    if (!await adminConfirm(`URL 슬러그를 "${selectedCategory.id}" → "${newId}" 로 변경하시겠습니까?\n기존 /category/${selectedCategory.id} 링크는 더이상 열리지 않습니다.`)) {
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

    const locked = busy || loading || !!loadError || isModalOpen;
    const openEditor = (category: Category | null) => { setSelectedCategory(category); setIsModalOpen(true); };

    return (
        <AdminLayout
            activePage="categories"
            title="상품 카테고리"
            description="화살표로 노출 순서를 바꾸고, 스위치로 사이트 노출을 켜고 꺼요."
            actions={
                <AdminButton variant="primary" leading={<IconPlus />} onClick={() => openEditor(null)} disabled={locked}>
                    카테고리 추가
                </AdminButton>
            }
        >
            <div className="cg-page">
                {notice && <AdminMessage tone="cautionary" role="alert">{notice}</AdminMessage>}
                {loadError ? (
                    <AdminCard>
                        <AdminError reason={loadError} onRetry={fetchCategories} retrying={loading} />
                    </AdminCard>
                ) : (
                    <fieldset className="cg-lock" disabled={locked} inert={locked}>
                        <AdminCard
                            flush
                            title={`카테고리 ${sortedCategories.length}개`}
                            actions={actionBusy ? <span className="cg-status" role="status">변경 내용을 저장하는 중…</span> : undefined}
                        >
                            {loading && sortedCategories.length === 0 ? (
                                <AdminLoading label="카테고리를 불러오는 중…" />
                            ) : sortedCategories.length === 0 ? (
                                <AdminEmpty title="등록된 카테고리가 없습니다." description="‘카테고리 추가’로 첫 카테고리를 만들어 주세요." />
                            ) : (
                                <AdminTable label="상품 카테고리" className="cg-table">
                                    <AdminThead>
                                        <AdminTr>
                                            <AdminTh className="cg-c-order">순서</AdminTh>
                                            <AdminTh className="cg-c-icon">아이콘</AdminTh>
                                            <AdminTh className="cg-c-name">이름</AdminTh>
                                            <AdminTh>설명</AdminTh>
                                            <AdminTh align="right" className="cg-c-count">상품</AdminTh>
                                            <AdminTh align="center" className="cg-c-active">노출</AdminTh>
                                            <AdminTh align="right" className="cg-c-actions">관리</AdminTh>
                                        </AdminTr>
                                    </AdminThead>
                                    <AdminTbody>
                                        {sortedCategories.map((category, index) => (
                                            <AdminTr key={category.id} className={category.isActive ? undefined : 'is-hidden'}>
                                                <AdminTd className="cg-c-order">
                                                    <span className="cg-order">
                                                        <AdminIconButton size="sm" label={`${category.name} 위로`} onClick={() => moveCategory(index, 'up')} disabled={index === 0}>
                                                            <IconArrowUp />
                                                        </AdminIconButton>
                                                        <AdminIconButton size="sm" label={`${category.name} 아래로`} onClick={() => moveCategory(index, 'down')} disabled={index === sortedCategories.length - 1}>
                                                            <IconArrowDown />
                                                        </AdminIconButton>
                                                        <b className="cg-order-no">{index + 1}</b>
                                                    </span>
                                                </AdminTd>
                                                <AdminTd className="cg-c-icon">
                                                    {isImageIcon(category.icon)
                                                        ? <img src={category.icon} alt={category.name} className="cg-icon" />
                                                        : <span className="cg-icon" aria-hidden="true"><MaterialIcon name={category.icon} /></span>}
                                                </AdminTd>
                                                <AdminTd className="cg-name" nowrap>{category.name}</AdminTd>
                                                <AdminTd className="cg-desc">{category.description || '—'}</AdminTd>
                                                <AdminTd align="right" className="cg-count">{productCount(category)}</AdminTd>
                                                <AdminTd align="center" className="cg-c-active">
                                                    <AdminSwitch size="sm" aria-label={`${category.name} 사이트 노출`} checked={!!category.isActive} onChange={() => toggleActive(category.id, category.isActive)} />
                                                </AdminTd>
                                                <AdminTd align="right" className="cg-c-actions">
                                                    <span className="cg-actions">
                                                        <AdminIconButton label={`${category.name} 수정`} onClick={() => openEditor(category)}><IconPencil /></AdminIconButton>
                                                        {category.id !== 'all'
                                                            ? <AdminIconButton label={`${category.name} 삭제`} className="cg-danger" onClick={() => deleteCategory(category.id)}><IconTrash /></AdminIconButton>
                                                            : <AdminBadge tone="neutral">기본</AdminBadge>}
                                                    </span>
                                                </AdminTd>
                                            </AdminTr>
                                        ))}
                                    </AdminTbody>
                                </AdminTable>
                            )}
                        </AdminCard>
                    </fieldset>
                )}
            </div>
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
    // 고친 내용이 있으면 AdminDialog가 닫기 전에 묻는다(dirty). 저장·업로드 중에는 닫지 않는다.
    const close = () => {
        if (task.current.busy()) { setError('저장·이미지 업로드가 끝난 뒤 닫아 주세요.'); return; }
        onClose();
    };
    const uploadImageTo = async (file: File, apply: (url: string) => void): Promise<boolean> => {
        const release = task.current.begin('upload'); if (!release) return false;
        setBusy('upload'); setError(''); report.current?.({ busy: true, dirty: dirty() });
        try { const url = await uploadImage(file, 'categories'); if (!mounted.current) return false; apply(url); return true; }
        catch (reason: any) { if (mounted.current) setError(reason?.message || '이미지 업로드에 실패했습니다. 기존 입력은 유지됩니다. 다시 선택해 주세요.'); return false; }
        finally { release(); if (mounted.current) { setBusy(null); report.current?.({ busy: false, dirty: dirty() }); } }
    };
    const handleSubmit = async () => {
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
    const hasImageIcon = isImageIcon(formData.icon);

    return (
        <AdminDialog
            open
            size="md"
            className="cg-dialog"
            title={category ? '카테고리 수정' : `${type === 'product' ? '상품' : '매거진'} 카테고리 추가`}
            onClose={close}
            // 업로드 중에는 확인 대신 close()가 ‘끝난 뒤 닫아 주세요’를 보인다
            dirty={!busy && dirty()}
            onSubmit={handleSubmit}
            submitLabel={category ? '수정 완료' : '추가 완료'}
            submitting={busy === 'save'}
            submitDisabled={busy === 'upload'}
        >
            {error && <AdminMessage tone="negative" role="alert">{error}</AdminMessage>}
            {busy === 'upload' && <AdminMessage tone="info">이미지 업로드 중…</AdminMessage>}
            <fieldset className="cg-lock cg-form" disabled={!!busy} inert={!!busy}>
                <AdminField id="cg-name" label="카테고리 이름" required>
                    <AdminTextInput
                        id="cg-name"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder={type === 'product' ? '예: 서부몽골' : '예: 몽골 기본 정보'}
                    />
                </AdminField>

                {/* URL 슬러그: 수정할 때만, ‘전체’ 카테고리는 바꾸지 않는다 */}
                {category && category.id !== 'all' && (
                    <AdminField id="cg-slug" label="URL 슬러그 (ID)" hint="영문 소문자·숫자·하이픈만 쓸 수 있어요. 바꾸면 기존 주소는 더 이상 열리지 않아요.">
                        <AdminTextInput
                            id="cg-slug"
                            aria-describedby="cg-slug-hint"
                            className="cg-mono"
                            leading={<span className="cg-prefix">/category/</span>}
                            value={formData.id || ''}
                            onChange={(e) => setFormData({ ...formData, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                            placeholder="예: gobi"
                        />
                    </AdminField>
                )}

                <AdminField id="cg-desc" label="설명">
                    <AdminTextInput
                        id="cg-desc"
                        value={formData.description || ''}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder={type === 'product' ? '예: 알타이 산맥 트레킹' : '예: 환전, 유심, 날씨 등'}
                    />
                </AdminField>

                <AdminField id="cg-icon" label="아이콘 이미지" required aside="1:1 이미지 · 사용자 화면에선 원형으로 보여요">
                    <div className="cg-icon-row">
                        {hasImageIcon
                            ? <img src={formData.icon} alt="카테고리 아이콘" className="cg-icon is-lg" />
                            : <span className="cg-icon is-lg" aria-hidden="true"><IconImage /></span>}
                        <AdminFileButton
                            id="cg-icon"
                            size="sm"
                            accept="image/*"
                            leading={<IconUpload />}
                            onFiles={(files) => uploadImageTo(files[0], url => setFormData(previous => ({ ...previous, icon: url })))}
                        >
                            {hasImageIcon ? '이미지 바꾸기' : '이미지 올리기'}
                        </AdminFileButton>
                    </div>
                </AdminField>

                <AdminSwitch
                    className="cg-visible"
                    checked={!!formData.isActive}
                    onChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    label="사이트에 노출"
                    description="끄면 카테고리 메뉴와 랜딩 페이지가 숨겨져요"
                />

                {/* 랜딩 페이지 편집 — 상품 카테고리만 */}
                {type === 'product' && (
                    <LandingPageEditor
                        formData={formData}
                        setFormData={setFormData}
                        uploadImageTo={uploadImageTo}
                    />
                )}
            </fieldset>
        </AdminDialog>
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
        <section className="cg-landing" aria-label="랜딩 페이지">
            <div className="cg-landing-head">
                <div className="cg-landing-titles">
                    <p className="cg-landing-title">랜딩 페이지</p>
                    <p className="cg-landing-slug">/category/{formData.id || '…'}</p>
                </div>
                <AdminTextButton
                    tone="assistive"
                    aria-expanded={expanded}
                    trailing={expanded ? <IconChevronUp /> : <IconChevronDown />}
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? '접기' : '펼치기'}
                </AdminTextButton>
            </div>

            {expanded && (
                <div className="cg-landing-body">
                    {/* 히어로 */}
                    <div className="cg-block">
                        <p className="cg-sub">히어로 배너</p>

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

                        <div className="cg-grid-2">
                            <AdminField id="cg-tagline" label="소제목 (tagline)">
                                <AdminTextInput
                                    id="cg-tagline"
                                    value={formData.landing_hero_tagline || ''}
                                    onChange={(e) => setFormData({ ...formData, landing_hero_tagline: e.target.value })}
                                    placeholder="예: 쏟아지는 별밤이 기다리고 있어요"
                                />
                            </AdminField>
                            <AdminField id="cg-accent" label="강조 색상 (accent)">
                                <AdminTextInput
                                    id="cg-accent"
                                    type="color"
                                    className="cg-color"
                                    value={formData.landing_accent_color || LEGACY_LANDING_ACCENT}
                                    onChange={(e) => setFormData({ ...formData, landing_accent_color: e.target.value })}
                                />
                            </AdminField>
                        </div>

                        <AdminField id="cg-hero-title" label="메인 제목">
                            <AdminTextInput
                                id="cg-hero-title"
                                value={formData.landing_hero_title || ''}
                                onChange={(e) => setFormData({ ...formData, landing_hero_title: e.target.value })}
                                placeholder="예: 고비사막 투어"
                            />
                        </AdminField>

                        <AdminField id="cg-hero-subtitle" label="서브 제목 (설명)">
                            <AdminTextArea
                                id="cg-hero-subtitle"
                                minRows={2}
                                value={formData.landing_hero_subtitle || ''}
                                onChange={(e) => setFormData({ ...formData, landing_hero_subtitle: e.target.value })}
                                placeholder="예: 은하수가 또렷이 보이는 하늘, 노을에 물드는 사구..."
                            />
                        </AdminField>

                        <AdminField id="cg-grid-title" label="상품 섹션 제목">
                            <AdminTextInput
                                id="cg-grid-title"
                                value={formData.landing_product_grid_title || ''}
                                onChange={(e) => setFormData({ ...formData, landing_product_grid_title: e.target.value })}
                                placeholder="예: 고비사막 인기 투어"
                            />
                        </AdminField>
                    </div>

                    {/* 하이라이트 */}
                    <div className="cg-block">
                        <div className="cg-block-head">
                            <p className="cg-sub">하이라이트 섹션 ({highlights.length})</p>
                            <AdminButton size="sm" leading={<IconPlus />} onClick={addSection}>섹션 추가</AdminButton>
                        </div>

                        {highlights.length === 0 && <p className="cg-note">‘섹션 추가’로 하이라이트를 만드세요.</p>}
                        {highlights.map((section: any, sIdx: number) => (
                            <div key={sIdx} className="cg-section">
                                <div className="cg-block-head">
                                    <span className="cg-section-no">섹션 {sIdx + 1}</span>
                                    <AdminIconButton size="sm" label={`섹션 ${sIdx + 1} 삭제`} className="cg-danger" onClick={() => removeSection(sIdx)}><IconTrash /></AdminIconButton>
                                </div>
                                <div className="cg-grid-2">
                                    <AdminTextInput
                                        aria-label={`섹션 ${sIdx + 1} 뱃지 라벨`}
                                        value={section.label || ''}
                                        onChange={(e) => updateSection(sIdx, { label: e.target.value })}
                                        placeholder="뱃지 라벨 (예: 하이라이트 1)"
                                    />
                                    <AdminTextInput
                                        aria-label={`섹션 ${sIdx + 1} 제목`}
                                        value={section.title || ''}
                                        onChange={(e) => updateSection(sIdx, { title: e.target.value })}
                                        placeholder="섹션 제목"
                                    />
                                </div>
                                <AdminTextInput
                                    aria-label={`섹션 ${sIdx + 1} 서브타이틀`}
                                    value={section.subtitle || ''}
                                    onChange={(e) => updateSection(sIdx, { subtitle: e.target.value })}
                                    placeholder="섹션 서브타이틀"
                                />

                                {(section.cards || []).map((card: any, cIdx: number) => (
                                    <div key={cIdx} className="cg-hl-card">
                                        <div className="cg-hl-thumb">
                                            {card.image ? <img src={card.image} alt="" /> : <IconImage aria-hidden="true" />}
                                        </div>
                                        <div className="cg-hl-fields">
                                            <div className="cg-hl-row">
                                                <AdminFileButton
                                                    size="sm"
                                                    accept="image/*"
                                                    leading={<IconUpload />}
                                                    onFiles={(files) => uploadImageTo(files[0], url => updateCard(sIdx, cIdx, { image: url }))}
                                                >
                                                    {card.image ? '사진 바꾸기' : '사진 올리기'}
                                                </AdminFileButton>
                                                <AdminTextInput
                                                    aria-label={`카드 ${cIdx + 1} 태그`}
                                                    className="cg-grow"
                                                    value={(card.tags || []).join(', ')}
                                                    onChange={(e) => updateCard(sIdx, cIdx, { tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                                    placeholder="태그 (콤마 구분)"
                                                />
                                                <AdminIconButton size="sm" label={`카드 ${cIdx + 1} 삭제`} className="cg-danger" onClick={() => removeCard(sIdx, cIdx)}><IconClose /></AdminIconButton>
                                            </div>
                                            <AdminTextInput
                                                aria-label={`카드 ${cIdx + 1} 제목`}
                                                value={card.title || ''}
                                                onChange={(e) => updateCard(sIdx, cIdx, { title: e.target.value })}
                                                placeholder="카드 제목"
                                            />
                                            <AdminTextInput
                                                aria-label={`카드 ${cIdx + 1} 설명`}
                                                value={card.description || ''}
                                                onChange={(e) => updateCard(sIdx, cIdx, { description: e.target.value })}
                                                placeholder="카드 설명"
                                            />
                                        </div>
                                    </div>
                                ))}
                                <AdminButton size="sm" variant="weak" leading={<IconPlus />} onClick={() => addCard(sIdx)} className="cg-add">카드 추가</AdminButton>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
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
        <div className="cg-hero">
            <div className="cg-block-head">
                <span className="cg-hero-title">배경 이미지 슬라이드 ({images.length})</span>
                <span className="cg-note">첫 번째 이미지가 대표 이미지로 사용됩니다</span>
            </div>

            {images.length > 0 && (
                <ol className="cg-hero-grid">
                    {images.map((url, idx) => (
                        <li key={idx} className={cx('cg-hero-item', idx === 0 && 'is-first')}>
                            <img src={url} alt={`배경 이미지 ${idx + 1}`} />
                            <div className="cg-hero-bar">
                                <span className="cg-hero-no">{idx === 0 ? '1 · 대표' : idx + 1}</span>
                                <AdminIconButton size="sm" label={`배경 이미지 ${idx + 1} 앞으로`} onClick={() => moveImage(idx, 'left')} disabled={idx === 0}><IconChevronLeft /></AdminIconButton>
                                <AdminIconButton size="sm" label={`배경 이미지 ${idx + 1} 뒤로`} onClick={() => moveImage(idx, 'right')} disabled={idx === images.length - 1}><IconChevronRight /></AdminIconButton>
                                <AdminIconButton size="sm" label={`배경 이미지 ${idx + 1} 삭제`} className="cg-danger" onClick={() => removeImage(idx)}><IconTrash /></AdminIconButton>
                            </div>
                        </li>
                    ))}
                </ol>
            )}

            <AdminFileButton size="sm" accept="image/*" multiple leading={<IconPlus />} onFiles={handleFiles}>이미지 추가</AdminFileButton>
        </div>
    );
};
