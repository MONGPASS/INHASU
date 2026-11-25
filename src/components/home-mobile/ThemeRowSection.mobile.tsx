import type { HomeProduct } from '../home-desktop/homeDesktopData';
import { MPhoto } from '../mobile/mobileUi';
import { SD } from '../site-seed/seed';
import { linkTo, useGo } from './homeMobileData';
import { HSCROLL } from './SectionHead.mobile';
import { TourCardMobile } from './TourCard.mobile';

interface Props {
    title: string;
    subtitle: string;
    products: HomeProduct[];
    image: string;
    imageAlt: string;
    link: string;
}

/** 테마 줄: 가로 사진 띠(왼쪽 어두운 덮개 + 제목) 아래에 옆으로 넘기는 상품 카드. 상품이 없으면 맞춤 견적 안내 한 줄. */
export function ThemeRowSectionMobile({ title, subtitle, products, image, imageAlt, link }: Props) {
    const go = useGo();
    const list = products.slice(0, 8);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <a {...linkTo(go, link)} style={{ position: 'relative', display: 'block', margin: '0 20px', height: 150, borderRadius: 14, overflow: 'hidden', textDecoration: 'none', background: SD.gray100 }}>
                <MPhoto src={image} alt={imageAlt} sizes="(max-width: 480px) 90vw, 440px" />
                <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 75%)' }} />
                <span style={{ position: 'absolute', left: 18, right: 18, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, color: SD.white }}>
                    <span style={{ fontSize: 18, fontWeight: 700, wordBreak: 'keep-all' }}>{title}</span>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>{subtitle}</span>
                </span>
            </a>
            {list.length === 0 ? (
                <a {...linkTo(go, '/custom-estimate')} style={{ margin: '0 20px', padding: '14px 16px', borderRadius: 10, background: SD.gray50, color: SD.gray700, fontSize: 13, textDecoration: 'none' }}>
                    이 테마의 상품을 준비하고 있어요. <strong style={{ color: SD.mint700 }}>맞춤 견적으로 먼저 상담하기 →</strong>
                </a>
            ) : (
                <div data-noscroll="" style={{ ...HSCROLL, gap: 12 }}>
                    {list.map((p) => <TourCardMobile key={p.id} p={p} width={140} />)}
                </div>
            )}
        </div>
    );
}
