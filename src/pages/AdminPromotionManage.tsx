import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { MW_FONT, isUsableImage } from '../components/desktop-primitives/mwTokens';
import { PromoCard } from '../components/promotions/PromoCard';
import { promoItemOf, themeOf } from '../components/promotions/promotionsData';
import { PROMO_THEME_KEYS, type Promotion, type PromoThemeKey } from '../components/promotions/promotionTypes';
import { api } from '../lib/api';
import { uploadImage } from '../utils/upload';
import { productPriceLabel, productPriceBasis, withPublicProductPrice, type PublicProductPriceFields } from '../utils/publicProductPrice';

interface ProductLite extends PublicProductPriceFields {
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

const PREVIEWS: { variant: PreviewVariant; label: string; width: number }[] = [
    { variant: 'desktop', label: 'PC', width: 280 },
    { variant: 'wide', label: '모바일 · 큰 카드', width: 300 },
    { variant: 'small', label: '모바일 · 작은 카드', width: 160 },
];

const PRODUCT_STATUS: Record<string, { label: string; tone: string }> = {
    active: { label: '판매중', tone: 'b-green' },
    inactive: { label: '비활성', tone: 'b-gray' },
    soldout: { label: '품절', tone: 'b-red' },
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
        ...withPublicProductPrice(p),
        id: String(p.id ?? ''),
        name: String(p.name ?? ''),
        category: String(p.category ?? ''),
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

const hintStyle: React.CSSProperties = { fontSize: 12, marginTop: 6, lineHeight: 1.5 };

const Toggle: React.FC<{ on: boolean; onToggle: () => void; title?: string; disabled?: boolean }> = ({ on, onToggle, title, disabled }) => (
    <button type="button" className={`switch${on ? ' on' : ''}`} onClick={onToggle} title={title} aria-pressed={on} disabled={disabled}>
        <span className="knob" />
    </button>
);

/** Theme colour with the photo on top, as a small stand-in for the card. */
const Swatch: React.FC<{ theme: PromoThemeKey; image?: string; size?: [number, number] }> = ({ theme, image, size = [56, 42] }) => (
    <span
        style={{
            display: 'block', width: size[0], height: size[1], borderRadius: 8, flex: 'none', overflow: 'hidden',
            background: themeOf(theme).bg, border: '1px solid var(--border-default)',
        }}
    >
        {isUsableImage(image) && <img src={image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
    </span>
);

const ProductStatus: React.FC<{ status: string }> = ({ status }) => {
    const s = PRODUCT_STATUS[status] ?? { label: status, tone: 'b-gray' };
    return <span className={`badge ${s.tone}`}>{s.label}</span>;
};

const MigrationNotice: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
    <div
        style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 16px', marginBottom: 16,
            background: '#FFF3DC', border: '1px solid #F3DDAE', borderRadius: 'var(--r-md)', color: '#8A5A12', fontSize: 13.5, fontWeight: 600, lineHeight: 1.55,
        }}
    >
        <Icon name="warning" style={{ fontSize: 20, flex: 'none' }} />
        <div style={{ flex: 1, minWidth: 240 }}>
            {MIGRATION_TEXT}
            <div style={{ fontWeight: 500 }}>열린 화면에 결과(JSON)가 나오면 완료입니다. 한 번만 하면 됩니다.</div>
        </div>
        <a className="btn btn-ink btn-sm" href="/api/migrate-db" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <Icon name="open_in_new" />/api/migrate-db 열기
        </a>
        {onRetry && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
                <Icon name="refresh" />다시 확인
            </button>
        )}
    </div>
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
    const fileRef = useRef<HTMLInputElement>(null);

    const patch = (changes: Partial<PromoForm>) => {
        setForm((f) => ({ ...f, ...changes }));
        setDirty(true);
    };

    const close = () => {
        if (dirty && !confirm('저장하지 않은 내용이 있습니다. 닫으시겠습니까?')) return;
        onClose();
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

    const pickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
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
        if (!title) {
            setError('제목을 입력해 주세요.');
            return;
        }
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

    const preview = PREVIEWS.find((p) => p.variant === variant) ?? PREVIEWS[0];
    const onSaleCount = form.product_ids.filter((id) => { const p = productById.get(id); return !!p && isOnSale(p); }).length;

    return (
        <div className="picker-scrim">
            <div className="picker" style={{ width: 1060, maxWidth: '96vw', maxHeight: '92vh' }}>
                <div className="card-head">
                    <h2>{initial ? '기획전 수정' : '기획전 추가'}</h2>
                    <div className="spacer" />
                    <button type="button" className="act-btn" title="닫기" onClick={close}>
                        <Icon name="close" />
                    </button>
                </div>

                <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
                    {/* Form */}
                    <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px 22px' }}>
                        <div className="card-muted-note" style={{ marginBottom: 18 }}>
                            <Icon name="translate" />
                            <span>제목 · 설명 · 분류 · 배지 문구는 고객에게 그대로 보입니다. 한국어로 입력해 주세요.</span>
                        </div>

                        <div className="field">
                            <label>제목 *</label>
                            <input
                                className="inp"
                                type="text"
                                maxLength={120}
                                value={form.title}
                                onChange={(e) => patch({ title: e.target.value })}
                                placeholder="예: 고비사막 별밤 캠프"
                            />
                        </div>
                        <div className="field">
                            <label>설명 (한 줄)</label>
                            <input
                                className="inp"
                                type="text"
                                maxLength={200}
                                value={form.subtitle}
                                onChange={(e) => patch({ subtitle: e.target.value })}
                                placeholder="예: 쏟아지는 별 아래에서 보내는 특별한 3일"
                            />
                        </div>

                        <div className="field-row">
                            <div className="field">
                                <label>분류</label>
                                <input
                                    className="inp"
                                    type="text"
                                    maxLength={40}
                                    value={form.group_name}
                                    onChange={(e) => patch({ group_name: e.target.value })}
                                    placeholder="예: 시즌 한정"
                                />
                                <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                                    {groups.map((g) => (
                                        <button
                                            key={g}
                                            type="button"
                                            className={`badge ${form.group_name.trim() === g ? 'b-ink' : 'b-gray'}`}
                                            style={{ border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 700 }}
                                            onClick={() => patch({ group_name: g })}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                                <div className="cell-muted" style={hintStyle}>고객 화면 상단의 탭으로 쓰입니다. 비워 두면 '특집'으로 표시됩니다.</div>
                            </div>
                            <div className="field">
                                <label>배지 문구 (선택)</label>
                                <input
                                    className="inp"
                                    type="text"
                                    maxLength={40}
                                    value={form.badge}
                                    onChange={(e) => patch({ badge: e.target.value })}
                                    placeholder="예: 최대 20% OFF"
                                />
                                <div className="cell-muted" style={hintStyle}>카드 가운데의 작은 알약 모양 라벨입니다.</div>
                            </div>
                        </div>

                        <div className="field">
                            <label>큰 영문 문구 (선택)</label>
                            <textarea
                                className="inp"
                                rows={2}
                                maxLength={40}
                                value={form.art_text}
                                onChange={(e) => patch({ art_text: e.target.value })}
                                placeholder={'GO\nNOW'}
                            />
                            <div className="cell-muted" style={hintStyle}>카드 가운데에 크게 들어가는 영문 장식 글자입니다. Enter로 줄바꿈 (최대 3줄), 한 줄에 7자 이내가 보기 좋습니다.</div>
                        </div>

                        <div className="field">
                            <label>색 테마</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                                {PROMO_THEME_KEYS.map((key) => {
                                    const t = themeOf(key);
                                    const picked = form.theme === key;
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => patch({ theme: key })}
                                            aria-pressed={picked}
                                            style={{
                                                display: 'flex', alignItems: 'flex-end', height: 54, padding: '7px 10px', borderRadius: 12, cursor: 'pointer',
                                                background: t.bg, color: t.fg, font: 'inherit', fontSize: 12, fontWeight: 800, textAlign: 'left',
                                                border: '1px solid var(--border-default)',
                                                boxShadow: picked ? '0 0 0 2px #fff, 0 0 0 4px var(--mrt-blue)' : 'none',
                                            }}
                                        >
                                            {THEME_LABELS[key]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="field">
                            <label>이미지 (선택)</label>
                            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickImage} />
                            <div className="row" style={{ gap: 12 }}>
                                <Swatch theme={form.theme} image={form.image} size={[96, 64]} />
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                                    <Icon name="upload" />{uploading ? '업로드 중…' : form.image ? '이미지 변경' : '이미지 업로드'}
                                </button>
                                {form.image && (
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch({ image: '' })} disabled={uploading}>
                                        이미지 제거
                                    </button>
                                )}
                            </div>
                            <div className="cell-muted" style={hintStyle}>카드 아래쪽에 사진이 깔립니다. 비워 두면 색 테마만으로 표시됩니다.</div>
                        </div>

                        <div className="field">
                            <label>상품 선택 <span className="cell-muted" style={{ fontWeight: 600 }}>· {form.product_ids.length}개 선택 · 위에서부터 순서대로 노출</span></label>
                            <div className="stack" style={{ gap: 6 }}>
                                {form.product_ids.map((id, index) => {
                                    const p = productById.get(id);
                                    return (
                                        <div key={id} className="edit-row" style={{ alignItems: 'center', padding: '8px 10px' }}>
                                            <span className="edit-move">
                                                <button type="button" onClick={() => moveProduct(index, -1)} disabled={index === 0} title="위로">
                                                    <Icon name="arrow_upward" />
                                                </button>
                                                <button type="button" onClick={() => moveProduct(index, 1)} disabled={index === form.product_ids.length - 1} title="아래로">
                                                    <Icon name="arrow_downward" />
                                                </button>
                                            </span>
                                            <span className="badge b-gray">{index + 1}</span>
                                            {p && isUsableImage(p.image)
                                                ? <img className="thumb" src={p.image} alt="" loading="lazy" />
                                                : <span className="thumb" />}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div className="cell-strong" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p ? p.name : '삭제된 상품'}</div>
                                                <div className="cell-muted" style={{ fontSize: 12 }}>{p ? [p.category || '카테고리 없음', productPriceLabel(p), productPriceBasis(p)].filter(Boolean).join(' · ') : id}</div>
                                            </div>
                                            {p ? <ProductStatus status={p.status} /> : <span className="badge b-red">없음</span>}
                                            <button
                                                type="button"
                                                className="act-btn danger"
                                                title="선택 해제"
                                                style={{ margin: 0 }}
                                                onClick={() => patch({ product_ids: form.product_ids.filter((x) => x !== id) })}
                                            >
                                                <Icon name="close" />
                                            </button>
                                        </div>
                                    );
                                })}
                                {form.product_ids.length > onSaleCount && (
                                    <div className="cell-muted" style={{ fontSize: 12 }}>「판매중」 상품만 고객 화면에 나옵니다. 비활성 · 품절 · 삭제된 상품은 자동으로 숨겨집니다.</div>
                                )}
                                {form.product_ids.length === 0 && (
                                    <div className="cell-muted" style={{ fontSize: 13, padding: '10px 2px' }}>아직 선택한 상품이 없습니다. 아래 목록에서 눌러 추가하세요.</div>
                                )}
                            </div>

                            <div style={{ marginTop: 12, border: '1px solid var(--border-default)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                                <div className="tb-search" style={{ border: 'none', borderBottom: '1px solid var(--border-subtle)', borderRadius: 0, boxShadow: 'none' }}>
                                    <Icon name="search" />
                                    <input type="text" placeholder="상품명 · 카테고리로 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
                                </div>
                                <div className="picker-list" style={{ maxHeight: 232 }}>
                                    {candidates.map((p) => (
                                        <button key={p.id} type="button" className="picker-item" onClick={() => patch({ product_ids: [...form.product_ids, p.id] })}>
                                            {isUsableImage(p.image)
                                                ? <img className="thumb" src={p.image} alt="" loading="lazy" />
                                                : <span className="thumb" />}
                                            <div style={{ flex: 1 }}>
                                                <div className="cell-strong" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                                <div className="cell-muted" style={{ fontSize: 12 }}>{[p.category || '카테고리 없음', productPriceLabel(p), productPriceBasis(p)].filter(Boolean).join(' · ')}</div>
                                            </div>
                                            <ProductStatus status={p.status} />
                                            <Icon name="add" style={{ fontSize: 18, color: 'var(--mrt-blue-strong)', flex: 'none' }} />
                                        </button>
                                    ))}
                                    {candidates.length === 0 && (
                                        <div className="cell-muted" style={{ fontSize: 13, padding: '14px 12px', textAlign: 'center' }}>
                                            {products.length === 0 ? '등록된 상품이 없습니다.' : query.trim() ? '검색 결과가 없습니다.' : '모든 상품을 선택했습니다.'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="field" style={{ marginBottom: 0 }}>
                            <label>노출 여부</label>
                            <div className="row" style={{ gap: 10 }}>
                                <Toggle on={form.is_active} onToggle={() => patch({ is_active: !form.is_active })} />
                                <span className="cell-muted">{form.is_active ? '고객 화면에 노출' : '숨김 (관리자만 확인 가능)'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Live preview */}
                    <div style={{ width: 348, flex: 'none', overflowY: 'auto', padding: '20px 22px', background: 'var(--mrt-gray-50)', borderLeft: '1px solid var(--border-subtle)' }}>
                        <div className="cell-strong" style={{ fontSize: 13, marginBottom: 10 }}>고객 화면 미리보기</div>
                        <div className="seg" style={{ marginBottom: 16 }}>
                            {PREVIEWS.map((p) => (
                                <button key={p.variant} type="button" className={p.variant === variant ? 'active' : ''} style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setVariant(p.variant)}>
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        {/* The card is a link on the public page; here it is display only. */}
                        <div style={{ width: preview.width, maxWidth: '100%', margin: '0 auto', display: 'grid', fontFamily: MW_FONT, pointerEvents: 'none' }} aria-hidden="true" inert>
                            <PromoCard item={toPreviewItem(form, onSaleCount)} variant={variant} />
                        </div>
                        <div className="cell-muted" style={{ ...hintStyle, marginTop: 14 }}>
                            모바일에서는 목록의 첫 번째 기획전이 큰 카드, 나머지는 작은 카드로 보입니다. 작은 카드는 제목 · 설명이 한 줄로 잘립니다.
                        </div>
                    </div>
                </div>

                <div className="drawer-foot">
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--mrt-red)' }}>
                        {error}
                        {error === MIGRATION_TEXT && (
                            <a href="/api/migrate-db" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8, color: 'var(--mrt-blue-strong)' }}>/api/migrate-db 열기</a>
                        )}
                    </div>
                    <button type="button" className="btn btn-ghost" onClick={close} disabled={saving}>취소</button>
                    <button type="button" className="btn btn-ink" onClick={save} disabled={saving || uploading}>{saving ? '저장 중…' : '저장'}</button>
                </div>
            </div>
        </div>
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
    const [toast, setToast] = useState('');
    const toastTimer = useRef<number | undefined>(undefined);

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

    useEffect(() => () => window.clearTimeout(toastTimer.current), []);

    const showToast = (message: string) => {
        setToast(message);
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(''), 2600);
    };

    const fail = (e: unknown) => {
        if (isMigrationError(e)) setNeedsMigration(true);
        alert(describeError(e));
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
        if (!confirm(`「${promotion.title}」 기획전을 삭제하시겠습니까?\n삭제하면 되돌릴 수 없습니다. (상품 자체는 삭제되지 않습니다.)`)) return;
        try {
            await api.promotions.delete(promotion.id);
            setPromos((rows) => rows.filter((p) => p.id !== promotion.id));
            showToast('기획전이 삭제되었습니다.');
        } catch (e) {
            fail(e);
        }
    };

    const stop = (e: React.MouseEvent) => e.stopPropagation();

    const headerActions = (
        <>
            <a className="btn btn-ghost" href="/promotions" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <Icon name="open_in_new" />고객 화면 보기
            </a>
            <button type="button" className="btn btn-ink" onClick={() => setEditor({ promotion: null })}>
                <Icon name="add" />기획전 추가
            </button>
        </>
    );

    return (
        <AdminLayout activePage="promotions" title="여행기획전 관리" eyebrow="사이트 설정" showSearch={false} actions={headerActions}>
            <div className="route-anim">
                {needsMigration && <MigrationNotice onRetry={() => void load()} />}

                <div className="sec-head">
                    <div>
                        <h3>기획전 목록</h3>
                        <div className="cell-muted" style={{ fontSize: 13 }}>고객 화면 '여행 기획전'(/promotions)에 위에서부터 순서대로 노출됩니다.</div>
                    </div>
                    <div className="spacer" />
                    <span className="cell-muted" style={{ fontSize: 13 }}>전체 {promos.length}개 · 노출 {promos.filter((p) => p.is_active).length}개</span>
                </div>

                <div className="card">
                    {promos.length > 0 && (
                        <div className="tbl-wrap">
                            <table className="tbl">
                                <thead>
                                    <tr>
                                        <th style={{ width: 70 }}>순서</th>
                                        <th>기획전</th>
                                        <th>분류</th>
                                        <th className="c">상품 수</th>
                                        <th className="c">노출</th>
                                        <th className="r">관리</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {promos.map((promotion, index) => {
                                        const hidden = promotion.product_ids.filter((id) => !onSaleIds.has(id)).length;
                                        return (
                                            <tr key={promotion.id} onClick={() => setEditor({ promotion })}>
                                                <td onClick={stop}>
                                                    <span className="edit-move">
                                                        <button type="button" onClick={() => void move(index, -1)} disabled={index === 0} title="위로">
                                                            <Icon name="arrow_upward" />
                                                        </button>
                                                        <button type="button" onClick={() => void move(index, 1)} disabled={index === promos.length - 1} title="아래로">
                                                            <Icon name="arrow_downward" />
                                                        </button>
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="row" style={{ gap: 12 }}>
                                                        <Swatch theme={promotion.theme} image={promotion.image} />
                                                        <div style={{ minWidth: 0, maxWidth: 420 }}>
                                                            <div className="cell-strong" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{promotion.title}</div>
                                                            <div className="cell-muted" style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {promotion.subtitle || `${THEME_LABELS[promotion.theme]} 테마`}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    {promotion.group_name
                                                        ? <span className="badge b-blue">{promotion.group_name}</span>
                                                        : <span className="cell-muted">특집 (기본)</span>}
                                                </td>
                                                <td className="c">
                                                    <span className="cell-mono">{promotion.product_ids.length}개</span>
                                                    {products.length > 0 && hidden > 0 && (
                                                        <span className="badge b-amber" style={{ marginLeft: 6 }} title="판매중이 아니거나 삭제된 상품은 고객 화면에 나오지 않습니다.">미노출 {hidden}</span>
                                                    )}
                                                </td>
                                                <td className="c" onClick={stop}>
                                                    <Toggle on={promotion.is_active} onToggle={() => void toggleActive(promotion)} title={promotion.is_active ? '노출 중' : '숨김'} />
                                                </td>
                                                <td className="r" onClick={stop}>
                                                    <span className="row-actions">
                                                        <a
                                                            className="act-btn"
                                                            href={`/promotions/${encodeURIComponent(promotion.id)}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title={promotion.is_active ? '고객 화면에서 보기 (새 탭)' : '고객 화면에서 보기 (숨김 상태 — 관리자만 보입니다)'}
                                                        >
                                                            <Icon name="open_in_new" />
                                                        </a>
                                                        <button type="button" className="act-btn" title="수정" onClick={() => setEditor({ promotion })}>
                                                            <Icon name="edit" />
                                                        </button>
                                                        <button type="button" className="act-btn danger" title="삭제" onClick={() => void remove(promotion)}>
                                                            <Icon name="delete" />
                                                        </button>
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {promos.length === 0 && (
                        <div className="empty">
                            <Icon name={loadError ? 'error' : 'campaign'} />
                            <p>{loading ? '불러오는 중…' : loadError ? `목록을 불러오지 못했습니다: ${loadError}` : '등록된 기획전이 없습니다.'}</p>
                            {!loading && !loadError && !needsMigration && (
                                <button type="button" className="btn btn-ink btn-sm" style={{ marginTop: 14 }} onClick={() => setEditor({ promotion: null })}>
                                    <Icon name="add" style={{ fontSize: 17, color: 'inherit' }} />첫 기획전 만들기
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

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
                        showToast(message);
                        void load();
                    }}
                />
            )}

            {toast && (
                <div className="page-toast">
                    <Icon name="check_circle" />
                    <span>{toast}</span>
                </div>
            )}
        </AdminLayout>
    );
};
