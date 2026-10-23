import { useState, type CSSProperties } from 'react';
import { MatIcon } from './MatIcon';
import { TagChip, type TagTone } from './TagChip';
import { StartingPrice } from '../product/StartingPrice';
import type { PublicProductPriceFields } from '../../utils/publicProductPrice';

export interface PCardData extends PublicProductPriceFields {
    id: string;
    name: string;
    category?: string;
    duration?: string;
    price: number;
    originalPrice?: number;
    mainImages?: string[];
    tags?: string[];
    rating?: number;
    reviewCount?: number;
    isPopular?: boolean;
}

interface PCardProps {
    p: PCardData;
    onClick: () => void;
    /** "flex" (default, 280px wide for horizontal scrollers) or "block" (100% width, for grids) */
    layout?: 'flex' | 'block';
}

function tagTone(tag?: string): TagTone {
    if (!tag) return 'premium';
    const lower = tag.toLowerCase();
    if (lower.includes('hot') || lower.includes('人気') || lower.includes('인기')) return 'hot';
    if (lower.includes('new') || lower.includes('新') || lower.includes('신규') || lower.includes('신상')) return 'new';
    return 'premium';
}

export function PCard({ p, onClick, layout = 'flex' }: PCardProps) {
    const [fav, setFav] = useState(false);
    const firstImg = p.mainImages?.[0];
    // Use a brand-color gradient when no image is set (e.g., admin hasn't uploaded
    // photos yet) rather than rendering a broken `/og-image.jpg` URL.
    const hasImage = !!firstImg && (firstImg.startsWith('http') || firstImg.startsWith('/')) && firstImg !== '/og-image.jpg';
    const imageBackground = hasImage
        ? `url(${firstImg})`
        : 'linear-gradient(135deg, #134e4a 0%, #115e59 50%, #0f766e 100%)';
    const firstTag = p.tags?.[0];

    const style: CSSProperties = layout === 'flex'
        ? {
            flex: '0 0 280px',
            background: '#fff',
            border: '1px solid var(--border-subtle)',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: 'var(--shadow-toss)',
            cursor: 'pointer',
            transition: 'all 200ms var(--ease-out)',
            scrollSnapAlign: 'start',
        }
        : {
            width: '100%',
            background: '#fff',
            border: '1px solid var(--border-subtle)',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: 'var(--shadow-toss)',
            cursor: 'pointer',
            transition: 'all 200ms var(--ease-out)',
        };

    return (
        <div
            onClick={onClick}
            role="button"
            style={style}
            onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 14px 30px -6px rgba(0,0,0,0.12)';
                e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'var(--shadow-toss)';
                e.currentTarget.style.transform = '';
            }}
        >
            <div
                style={{
                    aspectRatio: '4/3',
                    backgroundImage: imageBackground,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent 50%)',
                    }}
                />
                {firstTag && (
                    <div style={{ position: 'absolute', top: 12, left: 12 }}>
                        <TagChip tone={tagTone(firstTag)}>{firstTag}</TagChip>
                    </div>
                )}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setFav(!fav);
                    }}
                    aria-label="favorite"
                    style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        width: 34,
                        height: 34,
                        borderRadius: 999,
                        background: 'rgba(0,0,0,0.3)',
                        backdropFilter: 'blur(6px)',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <MatIcon name="favorite" size={18} filled={fav} color={fav ? '#f87171' : '#fff'} />
                </button>
                {p.duration && (
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 12,
                            left: 12,
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                        }}
                    >
                        {p.duration}
                    </div>
                )}
            </div>
            <div style={{ padding: '16px 18px 18px' }}>
                <div style={{ fontSize: 12, color: 'var(--fg-5)', marginBottom: 6 }}>{p.category}</div>
                <div
                    style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: 'var(--fg-1)',
                        lineHeight: 1.4,
                        marginBottom: 12,
                        minHeight: 42,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                    }}
                >
                    {p.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#0f766e' }}>
                            <StartingPrice product={p} />
                        </div>
                    </div>
                    {(p.rating || p.reviewCount) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: 'var(--fg-3)' }}>
                            <MatIcon name="star" size={14} filled color="#facc15" />
                            {p.rating && <span style={{ fontWeight: 700 }}>{p.rating.toFixed(1)}</span>}
                            {p.reviewCount ? <span style={{ color: 'var(--fg-5)' }}>({p.reviewCount})</span> : null}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
