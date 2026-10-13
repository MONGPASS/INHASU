import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { linkTo, useGo } from './homeMobileData';

interface Props {
    eyebrow: string;
    title: string;
    link: string;
    linkLabel?: string;
}

/** Eyebrow + heading + "전체 →" link above each home section. */
export function SectionHeadMobile({ eyebrow, title, link, linkLabel = '전체 →' }: Props) {
    const go = useGo();
    return (
        <div style={{ padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>{eyebrow}</span>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, lineHeight: 1.35 }}>{title}</h2>
            </div>
            <a {...linkTo(go, link)} style={{ fontSize: 13, fontWeight: 700, color: MW.navy, padding: '8px 0', whiteSpace: 'nowrap', textDecoration: 'none' }}>
                {linkLabel}
            </a>
        </div>
    );
}
