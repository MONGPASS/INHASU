import { isUsableImage, won } from '../desktop-primitives/mwTokens';
import { discountPct, type HomeProduct } from '../home-desktop/homeDesktopData';
import { HeartButton, packageLabel } from '../home-desktop/TourCard.desktop';
import { MPhoto } from '../mobile/mobileUi';
import { SD } from '../site-seed/seed';
import { linkTo, useGo } from './homeMobileData';

/** 휴대폰 홈의 상품 카드: 정사각 사진(꼬리표·찜) · 기간 · 이름 두 줄 · 가격. 옆으로 넘기는 줄에 놓는다. */
export function TourCardMobile({ p, width = 160 }: { p: HomeProduct; width?: number }) {
    const go = useGo();
    const img = p.mainImages[0];
    const off = discountPct(p);
    const badge = packageLabel(p.packageType);
    return (
        <a {...linkTo(go, `/products/${p.id}`)} style={{ position: 'relative', flex: `0 0 ${width}px`, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8, color: SD.gray900, textDecoration: 'none' }}>
            <div style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden', background: SD.gray100 }}>
                <MPhoto src={isUsableImage(img) ? img : undefined} alt={`${p.name} | ${p.category}`} sizes={`${width}px`} />
                {badge && (
                    <span style={{ position: 'absolute', left: 8, top: 8, height: 22, padding: '0 6px', display: 'inline-flex', alignItems: 'center', borderRadius: 5, background: SD.white, color: SD.gray900,
                        fontSize: 11, fontWeight: 700, pointerEvents: 'none' }}>{badge}</span>
                )}
                <HeartButton product={p} inset={8} small />
            </div>
            {p.duration && <p style={{ margin: 0, fontSize: 12, color: SD.gray600 }}>{p.duration}</p>}
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'keep-all' }}>{p.name}</h3>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {off > 0 && <span style={{ marginRight: 5, color: SD.red }}>{off}%</span>}
                {won(p.price)}<span style={{ fontSize: 13, fontWeight: 400, color: SD.gray600 }}> ~</span>
            </p>
        </a>
    );
}
