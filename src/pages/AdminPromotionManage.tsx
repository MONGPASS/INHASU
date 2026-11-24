import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AdminBadge, AdminButton, AdminChip, AdminFileButton, AdminDataTable, AdminDialog, AdminEmpty, AdminError, AdminField, AdminIconButton, AdminLoading, AdminMessage,
    AdminSearch, AdminSegmented, AdminSwitch, AdminTextArea, AdminTextButton, AdminTextInput,
    IconArrowDown, IconArrowUp, IconClose, IconExternal, IconPencil, IconPlus, IconTranslate, IconTrash, IconUpload,
    type AdminColumn, type AdminTone,
} from '../components/admin/ui';
import { ListPage } from '../components/admin/ui/AdminPage';
import { isUsableImage, won } from '../components/desktop-primitives/mwTokens';
import { PromoCard } from '../components/promotions/PromoCard';
import { promoItemOf, themeOf } from '../components/promotions/promotionsData';
import { PROMO_THEME_KEYS, type Promotion, type PromoThemeKey } from '../components/promotions/promotionTypes';
import { api } from '../lib/api';
import { uploadImage } from '../utils/upload';
import { adminConfirm, adminNotify } from '../components/admin/ui/adminFeedback';
import { adminValidateRequired } from '../components/admin/ui/adminForm';
import './AdminPromotionManage.css';

/**
 * 여행기획전(`/admin/promotions`) — 고객 화면 ‘여행 기획전’(/promotions)에 위에서부터 순서대로 나오는 기획전 목록과 편집 창.
 * 우리 관리자 부품(당근 Seed)으로 그린다. 테마 색 칸·견본만 고객 화면과 같은 색(promotionsData.themeOf)을 그대로 칠한다(디자인 문서 7절 예외).
 */
interface ProductLite {
    id: string;
    name: string;
    category: string;
    price: number;
    status: string;
    image: string;
}

type PromoForm = Pick<Promotion, 'title' | 'subtitle' | 'group_name' | 'badge' | 'art_text' | 'theme' | 'image' | 'product_ids' | 'is_active'>;

/** Card sizes of the public page: the PC tile and the two mobile grid cells. */
type PreviewVariant = React.ComponentProps<typeof PromoCard>['variant'];

const EMPTY_FORM: PromoForm = {
    title: '', subtitle: '', group_name: '', badge: '', art_text: '', theme: PROMO_THEME_KEYS[0], image: '', product_ids: [], is_active: true,
};

const GROUP_SUGGESTIONS = ['할인', '패키지', '시즌 한정', '패밀리'];

const THEME_LABELS: Record<PromoThemeKey, string> = {
    mint: '민트', navy: '네이비', jade: '그린', deep: '딥 그린', light: '연민트', paper: '화이트', night: '나이트', soft: '소프트 민트',
};

/** 고객 화면 카드 크기(PC 280 · 모바일 큰 카드 300 · 작은 카드 160) — 폭은 CSS(pm-preview-card.is-*) */
const PREVIEWS: { variant: PreviewVariant; label: string }[] = [
    { variant: 'desktop', label: 'PC' },
    { variant: 'wide', label: '모바일 · 큰 카드' },
    { variant: 'small', label: '모바일 · 작은 카드' },
];

const PRODUCT_STATUS: Record<string, { label: string; tone: AdminTone }> = {
    active: { label: '판매중', tone: 'success' },
    inactive: { label: '비활성', tone: 'neutral' },
    soldout: { label: '품절', tone: 'danger' },
};

const MIGRATION_TEXT = '기획전 테이블이 아직 없습니다. /api/migrate-db 를 한 번 열어 마이그레이션을 실행해 주세요.';

/** The public pages list only tours that are on sale. */
const isOnSale = (p: ProductLite) => p.status === 'active';

const byOrder = (rows: Promotion[]) => [...rows].sort((a, b) => a.sort_order - b.sort_order);

/** Same shape the server stores: trimmed lines, at most three. */
const cleanArt = (v: string) => v.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 3).join('\n');

/** The API names the fix in its "table missing" error. */
const isMigrationError = (e: unknown) => e instanceof Error && e.message.includes('migrate-db');

const describeError = (e: unknown) => {
    if (isMigrationError(e)) return MIGRATION_TEXT;
    const message = e instanceof Error ? e.message : String(e);
    if (message === 'Unauthorized' || message === 'Forbidden') return '관리자 권한이 필요합니다. 다시 로그인해 주세요.';
    return message || '알 수 없는 오류가 발생했습니다.';
};

const toProductLite = (p: Record<string, unknown>): ProductLite => {
    const first = (v: unknown) => (Array.isArray(v) && typeof v[0] === 'string' ? v[0] : '');
    return {
        id: String(p.id ?? ''),
        name: String(p.name ?? ''),
        category: String(p.category ?? ''),
        price: Number(p.price) || 0,
        status: String(p.status || 'active'),
        image: first(p.mainImages) || (typeof p.thumbnail === 'string' ? p.thumbnail : '') || first(p.images),
    };
};

const toForm = (p: Promotion | null): PromoForm => (p
    ? { title: p.title, subtitle: p.subtitle, group_name: p.group_name, badge: p.badge, art_text: p.art_text, theme: p.theme, image: p.image, product_ids: [...p.product_ids], is_active: p.is_active }
    : { ...EMPTY_FORM });

/** The form as the public card, built by the same mapper the public pages use. */
const toPreviewItem = (form: PromoForm, tourCount: number) => promoItemOf({
    ...form,
    id: 'preview',
    title: form.title.trim() || '제목',
    group_name: form.group_name.trim(),
    badge: form.badge.trim(),
    art_text: cleanArt(form.art_text),
    sort_order: 0,
}, tourCount);

const openTab = (href: string) => window.open(href, '_blank', 'noopener,noreferrer');

/** Theme colour with the photo on top, as a small stand-in for the card. 색은 고객 화면 테마 값(7절 예외). */
const Swatch: React.FC<{ theme: PromoThemeKey; image?: string; large?: boolean }> = ({ theme, image, large }) => (
    <span className={`pm-swatch${large ? ' is-large' : ''}`} style={{ background: themeOf(theme).bg }}>
        {isUsableImage(image) && <img src={image} alt="" loading="lazy" />}
    </span>
);

const ProductStatus: React.FC<{ status: string }> = ({ status }) => {
    const s = PRODUCT_STATUS[status] ?? { label: status, tone: 'neutral' as AdminTone };
    return <AdminBadge tone={s.tone}>{s.label}</AdminBadge>;
};

const ProductThumb: React.FC<{ image?: string }> = ({ image }) => (
    <span className="pm-thumb">{isUsableImage(image) && <img src={image} alt="" loading="lazy" />}</span>
);

const MigrationNotice: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
    <AdminMessage tone="cautionary" role="alert" title={MIGRATION_TEXT}
        actions={<>
            <AdminButton size="sm" variant="primary" leading={<IconExternal />} onClick={() => openTab('/api/migrate-db')}>/api/migrate-db 열기</AdminButton>
            {onRetry && <AdminButton size="sm" variant="secondary" onClick={onRetry}>다시 확인</AdminButton>}
        </>}>
        열린 화면에 결과(JSON)가 나오면 완료입니다. 한 번만 하면 됩니다.
    </AdminMessage>
);

interface EditorProps {
    initial: Promotion | null;
    products: ProductLite[];
    groups: string[];
    onClose: () => void;
    onSaved: (message: string) => void;
    onMigrationNeeded: () => void;
}

const PromotionEditor: React.FC<EditorProps> = ({ initial, products, groups, onClose, onSaved, onMigrationNeeded }) => {
    const [form, setForm] = useState<PromoForm>(() => toForm(initial));
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [variant, setVariant] = useState<PreviewVariant>(PREVIEWS[0].variant);

    const patch = (changes: Partial<PromoForm>) => {
        setForm((f) => ({ ...f, ...changes }));
        setDirty(true);
    };

    const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
    const candidates = useMemo(() => {
        const q = query.trim().toLowerCase();
        return products.filter((p) => !form.product_ids.includes(p.id)
            && (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)));
    }, [products, form.product_ids, query]);

    const moveProduct = (index: number, delta: -1 | 1) => {
        const target = index + delta;
        if (target < 0 || target >= form.product_ids.length) return;
        const ids = [...form.product_ids];
        [ids[index], ids[target]] = [ids[target], ids[index]];
        patch({ product_ids: ids });
    };

    const pickImage = async (files: File[]) => {
        const file = files[0];
        if (!file) return;
        setUploading(true);
        setError('');
        try {
            patch({ image: await uploadImage(file, 'promotions') });
        } catch {
            setError('이미지 업로드 중 오류가 발생했습니다.');
        } finally {
            setUploading(false);
        }
    };

    const save = async () => {
        const title = form.title.trim();
        if (!title) { adminValidateRequired(); return; }
        setSaving(true);
        setError('');
        const payload: PromoForm = {
            title,
            subtitle: form.subtitle.trim(),
            group_name: form.group_name.trim(),
            badge: form.badge.trim(),
            art_text: cleanArt(form.art_text),
            theme: form.theme,
            image: form.image,
            product_ids: form.product_ids,
            is_active: form.is_active,
        };
        try {
            if (initial) await api.promotions.update(initial.id, payload);
            else await api.promotions.create(payload);
            onSaved(initial ? '기획전이 수정되었습니다.' : '기획전이 추가되었습니다.');
        } catch (e) {
            if (isMigrationError(e)) onMigrationNeeded();
            setError(describeError(e));
            setSaving(false);
        }
    };

    const onSaleCount = form.product_ids.filter((id) => { const p = productById.get(id); return !!p && isOnSale(p); }).length;

    return (
        <AdminDialog open onClose={onClose} title={initial ? '기획전 수정' : '기획전 추가'} size="lg" flush dirty={dirty}
            onSubmit={() => void save()} submitting={saving} submitDisabled={uploading}
            footStart={error ? <span className="pm-foot-error" role="alert">{error}
                {error === MIGRATION_TEXT && <AdminTextButton size="sm" onClick={() => openTab('/api/migrate-db')}>/api/migrate-db 열기</AdminTextButton>}</span> : undefined}>
            <div className="pm-split">
                <div className="pm-form">
                    <AdminMessage tone="info"><span className="pm-note"><IconTranslate aria-hidden="true" />제목 · 설명 · 분류 · 배지 문구는 고객에게 그대로 보입니다. 한국어로 입력해 주세요.</span></AdminMessage>

                    <AdminField label="제목" required>
                        {(id) => <AdminTextInput id={id} maxLength={120} value={form.title} onChange={(e) => patch({ title: e.target.value })} placeholder="예: 고비사막 별밤 캠프" />}
                    </AdminField>
                    <AdminField label="설명 (한 줄)">
                        {(id) => <AdminTextInput id={id} maxLength={200} value={form.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} placeholder="예: 쏟아지는 별 아래에서 보내는 특별한 3일" />}
                    </AdminField>

                    <div className="pm-two">
                        <AdminField label="분류" hint="고객 화면 상단의 탭으로 쓰입니다. 비워 두면 '특집'으로 표시됩니다.">
                            {(id, describedBy) => <>
                                <AdminTextInput id={id} aria-describedby={describedBy} maxLength={40} value={form.group_name} onChange={(e) => patch({ group_name: e.target.value })} placeholder="예: 시즌 한정" />
                                <span className="pm-chips" role="group" aria-label="분류 고르기">
                                    {groups.map((g) => <AdminChip key={g} active={form.group_name.trim() === g} onClick={() => patch({ group_name: g })}>{g}</AdminChip>)}
                                </span>
                            </>}
                        </AdminField>
                        <AdminField label="배지 문구 (선택)" hint="카드 가운데의 작은 알약 모양 라벨입니다.">
                            {(id, describedBy) => <AdminTextInput id={id} aria-describedby={describedBy} maxLength={40} value={form.badge} onChange={(e) => patch({ badge: e.target.value })} placeholder="예: 최대 20% OFF" />}
                        </AdminField>
                    </div>

                    <AdminField label="큰 영문 문구 (선택)" hint="카드 가운데에 크게 들어가는 영문 장식 글자입니다. Enter로 줄바꿈 (최대 3줄), 한 줄에 7자 이내가 보기 좋습니다.">
                        {(id, describedBy) => <AdminTextArea id={id} aria-describedby={describedBy} minRows={2} maxRows={3} maxLength={40} value={form.art_text} onChange={(e) => patch({ art_text: e.target.value })} placeholder={'GO\nNOW'} />}
                    </AdminField>

                    <AdminField label="색 테마">
                        <span className="pm-themes" role="group" aria-label="색 테마">
                            {PROMO_THEME_KEYS.map((key) => {
                                const t = themeOf(key);
                                return (
                                    <AdminChip key={key} active={form.theme === key} className="pm-theme" onClick={() => patch({ theme: key })}
                                        leading={<span className="pm-theme-dot" style={{ background: t.bg }} />}>{THEME_LABELS[key]}</AdminChip>
                                );
                            })}
                        </span>
                    </AdminField>

                    <AdminField label="이미지 (선택)" hint="카드 아래쪽에 사진이 깔립니다. 비워 두면 색 테마만으로 표시됩니다.">
                        <span className="pm-image">
                            <Swatch theme={form.theme} image={form.image} large />
                            <AdminFileButton size="sm" accept="image/*" leading={<IconUpload />} loading={uploading} onFiles={(files) => void pickImage(files)}>
                                {uploading ? '업로드 중…' : form.image ? '이미지 변경' : '이미지 업로드'}
                            </AdminFileButton>
                            {form.image && <AdminTextButton size="sm" tone="assistive" disabled={uploading} onClick={() => patch({ image: '' })}>이미지 제거</AdminTextButton>}
                        </span>
                    </AdminField>

                    <AdminField label="상품 선택" aside={`${form.product_ids.length}개 선택 · 위에서부터 순서대로 노출`}>
                        <span className="pm-picked">
                            {form.product_ids.map((id, index) => {
                                const p = productById.get(id);
                                return (
                                    <span key={id} className="pm-product">
                                        <span className="pm-move">
                                            <AdminIconButton size="sm" label="위로" disabled={index === 0} onClick={() => moveProduct(index, -1)}><IconArrowUp /></AdminIconButton>
                                            <AdminIconButton size="sm" label="아래로" disabled={index === form.product_ids.length - 1} onClick={() => moveProduct(index, 1)}><IconArrowDown /></AdminIconButton>
                                        </span>
                                        <AdminBadge>{index + 1}</AdminBadge>
                                        <ProductThumb image={p?.image} />
                                        <span className="pm-product-text">
                                            <b>{p ? p.name : '삭제된 상품'}</b>
                                            <small>{p ? `${p.category || '카테고리 없음'} · ${won(p.price)}` : id}</small>
                                        </span>
                                        {p ? <ProductStatus status={p.status} /> : <AdminBadge tone="danger">없음</AdminBadge>}
                                        <AdminIconButton size="sm" label="선택 해제" onClick={() => patch({ product_ids: form.product_ids.filter((x) => x !== id) })}><IconClose /></AdminIconButton>
                                    </span>
                                );
                            })}
                            {form.product_ids.length > onSaleCount && <small className="pm-muted">「판매중」 상품만 고객 화면에 나옵니다. 비활성 · 품절 · 삭제된 상품은 자동으로 숨겨집니다.</small>}
                            {form.product_ids.length === 0 && <small className="pm-muted">아직 선택한 상품이 없습니다. 아래 목록에서 추가하세요.</small>}
                        </span>
                        <span className="pm-candidates">
                            <AdminSearch value={query} onChange={setQuery} placeholder="상품명 · 카테고리로 검색" aria-label="상품 검색" wide />
                            <span className="pm-candidate-list">
                                {candidates.map((p) => (
                                    <span key={p.id} className="pm-product">
                                        <ProductThumb image={p.image} />
                                        <span className="pm-product-text"><b>{p.name}</b><small>{p.category || '카테고리 없음'} · {won(p.price)}</small></span>
                                        <ProductStatus status={p.status} />
                                        <AdminButton size="sm" variant="secondary" leading={<IconPlus />} aria-label={`${p.name} 추가`} onClick={() => patch({ product_ids: [...form.product_ids, p.id] })}>추가</AdminButton>
                                    </span>
                                ))}
                                {candidates.length === 0 && <small className="pm-muted pm-center">
                                    {products.length === 0 ? '등록된 상품이 없습니다.' : query.trim() ? '검색 결과가 없습니다.' : '모든 상품을 선택했습니다.'}
                                </small>}
                            </span>
                        </span>
                    </AdminField>

                    <AdminSwitch checked={form.is_active} onChange={(on) => patch({ is_active: on })} label="노출 여부"
                        description={form.is_active ? '고객 화면에 노출' : '숨김 (관리자만 확인 가능)'} />
                </div>

                {/* Live preview */}
                <div className="pm-preview">
                    <b className="pm-preview-title">고객 화면 미리보기</b>
                    <AdminSegmented label="미리보기 크기" value={variant} onChange={setVariant} items={PREVIEWS.map((p) => ({ value: p.variant, label: p.label }))} />
                    {/* The card is a link on the public page; here it is display only. */}
                    <div className={`pm-preview-card is-${variant}`} aria-hidden="true" inert>
                        <PromoCard item={toPreviewItem(form, onSaleCount)} variant={variant} />
                    </div>
                    <small className="pm-muted">모바일에서는 목록의 첫 번째 기획전이 큰 카드, 나머지는 작은 카드로 보입니다. 작은 카드는 제목 · 설명이 한 줄로 잘립니다.</small>
                </div>
            </div>
        </AdminDialog>
    );
};

export const AdminPromotionManage: React.FC = () => {
    const [promos, setPromos] = useState<Promotion[]>([]);
    const [products, setProducts] = useState<ProductLite[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [needsMigration, setNeedsMigration] = useState(false);
    /** `null` = closed, `{ promotion: null }` = new. */
    const [editor, setEditor] = useState<{ promotion: Promotion | null } | null>(null);

    const load = useCallback(async () => {
        try {
            const [list, productRows] = await Promise.all([
                api.promotions.listAll(),
                api.products.list().catch(() => []),
            ]);
            const rows = Array.isArray(list) ? list : [];
            setPromos(byOrder(rows));
            setProducts(Array.isArray(productRows) ? productRows.map(toProductLite) : []);
            setLoadError('');
            // The API also answers with an empty list before the migration has run.
            // An empty reorder changes nothing but reports the missing table.
            let missing = false;
            if (rows.length === 0) {
                try {
                    await api.promotions.reorder([]);
                } catch (e) {
                    missing = isMigrationError(e);
                }
            }
            setNeedsMigration(missing);
        } catch (e) {
            setLoadError(describeError(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const fail = (e: unknown) => {
        if (isMigrationError(e)) setNeedsMigration(true);
        adminNotify(describeError(e));
    };

    const onSaleIds = useMemo(() => new Set(products.filter(isOnSale).map((p) => p.id)), [products]);
    const groups = useMemo(
        () => [...new Set([...promos.map((p) => p.group_name).filter(Boolean), ...GROUP_SUGGESTIONS])],
        [promos],
    );

    const move = async (index: number, delta: -1 | 1) => {
        const target = index + delta;
        if (target < 0 || target >= promos.length) return;
        const previous = promos;
        const next = [...promos];
        [next[index], next[target]] = [next[target], next[index]];
        const reordered = next.map((p, i) => ({ ...p, sort_order: i }));
        setPromos(reordered);
        try {
            await api.promotions.reorder(reordered.map(({ id, sort_order }) => ({ id, sort_order })));
        } catch (e) {
            setPromos(previous);
            fail(e);
        }
    };

    const toggleActive = async (promotion: Promotion) => {
        const is_active = !promotion.is_active;
        setPromos((rows) => rows.map((p) => (p.id === promotion.id ? { ...p, is_active } : p)));
        try {
            await api.promotions.update(promotion.id, { is_active });
        } catch (e) {
            setPromos((rows) => rows.map((p) => (p.id === promotion.id ? { ...p, is_active: promotion.is_active } : p)));
            fail(e);
        }
    };

    const remove = async (promotion: Promotion) => {
        if (!await adminConfirm(`「${promotion.title}」 기획전을 삭제하시겠습니까?\n삭제하면 되돌릴 수 없습니다. (상품 자체는 삭제되지 않습니다.)`)) return;
        try {
            await api.promotions.delete(promotion.id);
            setPromos((rows) => rows.filter((p) => p.id !== promotion.id));
            adminNotify('기획전이 삭제되었습니다.', 'success');
        } catch (e) {
            fail(e);
        }
    };

    const columns: AdminColumn<Promotion>[] = [
        { key: 'order', header: '순서', nowrap: true, render: (promotion, index) => (
            <span className="pm-move">
                <AdminIconButton size="sm" label="위로" disabled={index === 0} onClick={() => void move(index, -1)}><IconArrowUp /></AdminIconButton>
                <AdminIconButton size="sm" label="아래로" disabled={index === promos.length - 1} onClick={() => void move(index, 1)}><IconArrowDown /></AdminIconButton>
            </span>
        ) },
        { key: 'promo', header: '기획전', render: (promotion) => (
            <span className="pm-promo">
                <Swatch theme={promotion.theme} image={promotion.image} />
                <span className="pm-product-text"><b>{promotion.title}</b><small>{promotion.subtitle || `${THEME_LABELS[promotion.theme]} 테마`}</small></span>
            </span>
        ) },
        { key: 'group', header: '분류', nowrap: true, render: (promotion) => promotion.group_name ? <AdminBadge tone="info">{promotion.group_name}</AdminBadge> : <span className="pm-muted">특집 (기본)</span> },
        { key: 'count', header: '상품 수', align: 'center', nowrap: true, render: (promotion) => {
            const hidden = promotion.product_ids.filter((id) => !onSaleIds.has(id)).length;
            return <span className="pm-count">{promotion.product_ids.length}개
                {products.length > 0 && hidden > 0 && <AdminBadge tone="warn" title="판매중이 아니거나 삭제된 상품은 고객 화면에 나오지 않습니다.">미노출 {hidden}</AdminBadge>}</span>;
        } },
        { key: 'active', header: '노출', align: 'center', render: (promotion) => (
            <AdminSwitch checked={promotion.is_active} onChange={() => void toggleActive(promotion)} aria-label={`${promotion.title} ${promotion.is_active ? '노출 중' : '숨김'}`} />
        ) },
        { key: 'manage', header: '관리', align: 'right', nowrap: true, render: (promotion) => (
            <span className="pm-actions">
                <AdminIconButton size="sm" label={promotion.is_active ? '고객 화면에서 보기 (새 탭)' : '고객 화면에서 보기 (숨김 상태 — 관리자만 보입니다)'}
                    onClick={() => openTab(`/promotions/${encodeURIComponent(promotion.id)}`)}><IconExternal /></AdminIconButton>
                <AdminIconButton size="sm" label="수정" onClick={() => setEditor({ promotion })}><IconPencil /></AdminIconButton>
                <AdminIconButton size="sm" label="삭제" onClick={() => void remove(promotion)}><IconTrash /></AdminIconButton>
            </span>
        ) },
    ];

    return (
        <ListPage
            activePage="promotions"
            title="여행기획전 관리"
            description="고객 화면 ‘여행 기획전’(/promotions)에 위에서부터 순서대로 노출됩니다."
            showSearch={false}
            notice={needsMigration ? <MigrationNotice onRetry={() => void load()} /> : undefined}
            actions={<>
                <AdminButton variant="secondary" leading={<IconExternal />} onClick={() => openTab('/promotions')}>고객 화면 보기</AdminButton>
                <AdminButton variant="primary" leading={<IconPlus />} onClick={() => setEditor({ promotion: null })}>기획전 추가</AdminButton>
            </>}
            filters={promos.length > 0 ? <span className="pm-total">전체 {promos.length}개 · 노출 {promos.filter((p) => p.is_active).length}개</span> : undefined}
        >
            {loading ? <AdminLoading />
                : loadError ? <AdminError reason={`목록을 불러오지 못했습니다: ${loadError}`} onRetry={() => { setLoading(true); void load(); }} />
                : <AdminDataTable label="기획전 목록" columns={columns} rows={promos} rowKey={(p) => p.id} onRowClick={(promotion) => setEditor({ promotion })}
                    empty={<AdminEmpty title="등록된 기획전이 없습니다"
                        action={!needsMigration ? <AdminButton size="sm" variant="primary" leading={<IconPlus />} onClick={() => setEditor({ promotion: null })}>첫 기획전 만들기</AdminButton> : undefined} />} />}

            {editor && (
                <PromotionEditor
                    key={editor.promotion?.id ?? 'new'}
                    initial={editor.promotion}
                    products={products}
                    groups={groups}
                    onClose={() => setEditor(null)}
                    onMigrationNeeded={() => setNeedsMigration(true)}
                    onSaved={(message) => {
                        setEditor(null);
                        adminNotify(message, 'success');
                        void load();
                    }}
                />
            )}
        </ListPage>
    );
};
