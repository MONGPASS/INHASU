import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveProductImage } from '../common/ResponsiveProductImage';
import { isUsableImage } from '../desktop-primitives/mwTokens';
import { SD, SRoundButton } from '../site-seed/seed';
import type { HomeProduct } from './homeDesktopData';
import { TourCardDesktop } from './TourCard.desktop';

interface Props {
    title: string;
    subtitle: string;
    products: HomeProduct[];
    image: string;
    imageAlt: string;
    link: string;
    /** 큰 사진을 오른쪽에 둔다(기본 왼쪽). */
    reverse?: boolean;
}

const VISIBLE = 3;

/** 테마 줄: 정사각 큰 사진 + 제목 + 상품 3개(이전·다음으로 한 개씩 넘긴다). 상품이 없으면 맞춤 견적 안내. */
export function ThemeRowSectionDesktop({ title, subtitle, products, image, imageAlt, link, reverse = false }: Props) {
    const navigate = useNavigate();
    const [offset, setOffset] = useState(0);
    const n = products.length;
    const canMove = n > VISIBLE;
    const shown = canMove ? Array.from({ length: VISIBLE }, (_, k) => products[(offset + k) % n]) : products;
    const move = (d: 1 | -1) => setOffset((o) => (o + d + n) % n);

    const photo = (
        <a href={link} onClick={(e) => { e.preventDefault(); navigate(link); }} aria-label={`${title} 전체 보기`}
            style={{ flex: '0 1 340px', minWidth: 260, aspectRatio: '1 / 1', borderRadius: 20, overflow: 'hidden', display: 'block', background: SD.gray100 }}>
            {isUsableImage(image) && (
                <ResponsiveProductImage src={image} alt={imageAlt} sizes="340px" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
        </a>
    );
    const body = (
        <div style={{ flex: '1 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.35, color: SD.gray900 }}>{title}</h3>
                    <p style={{ margin: 0, fontSize: 14, color: SD.gray600 }}>{subtitle}</p>
                </div>
                {canMove && (
                    <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                        <SRoundButton label={`${title} 이전`} icon="chevronLeft" onClick={() => move(-1)} />
                        <SRoundButton label={`${title} 다음`} icon="chevronRight" onClick={() => move(1)} />
                    </div>
                )}
            </div>
            {n === 0 ? (
                <a href="/custom-estimate" onClick={(e) => { e.preventDefault(); navigate('/custom-estimate'); }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '32px 24px', borderRadius: 12, background: SD.gray50, color: SD.gray900, textDecoration: 'none' }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>이 테마의 상품을 준비하고 있어요</span>
                    <span style={{ fontSize: 14, color: SD.gray700 }}>원하는 일정을 알려 주시면 맞춤 견적으로 안내해 드려요 →</span>
                </a>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 }}>
                    {shown.map((p) => <TourCardDesktop key={p.id} p={p} ratio="16 / 10" sizes="240px" />)}
                </div>
            )}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '32px 40px' }}>
            {reverse ? <>{body}{photo}</> : <>{photo}{body}</>}
        </div>
    );
}
