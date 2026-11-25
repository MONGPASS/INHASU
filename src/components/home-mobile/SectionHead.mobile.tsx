import type { CSSProperties, ReactNode } from 'react';
import { SD, SIcon } from '../site-seed/seed';
import { linkTo, useGo } from './homeMobileData';

/** 옆으로 넘기는 줄(스크롤 막대 없음, 좌우 20px). `data-noscroll`과 함께 쓴다(index.css). */
export const HSCROLL: CSSProperties = { display: 'flex', overflowX: 'auto', padding: '0 20px', scrollPadding: '0 20px', scrollbarWidth: 'none' };

/**
 * 휴대폰 홈 구역 제목(디자인 ‘홈 · 휴대폰’ 2026-11-25 2차): 윗줄에 아이콘 + 제목(한 줄)과 오른쪽 ‘전체 ›’(또는 동그란 화살표),
 * 아랫줄에 설명(넘치면 말줄임). linkStyle="round"는 후기처럼 동그란 화살표 버튼.
 */
export function SectionHeadMobile({ icon, iconImage, title, sub, link, linkLabel, linkStyle = 'text' }: {
    icon: string; iconImage?: string; title: string; sub?: string; link?: string; linkLabel?: string; linkStyle?: 'text' | 'round';
}) {
    const go = useGo();
    const more: ReactNode = !link ? null : linkStyle === 'round'
        ? (
            <a {...linkTo(go, link)} aria-label={linkLabel || `${title} 전체 보기`}
                style={{ flex: 'none', width: 32, height: 32, boxSizing: 'border-box', borderRadius: 9999, border: `1px solid ${SD.gray300}`, color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                <SIcon name="chevronRight" size={16} stroke={1.8} />
            </a>
        ) : (
            <a {...linkTo(go, link)} aria-label={linkLabel} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, height: 32, lineHeight: 1, color: SD.gray600, fontSize: 13, textDecoration: 'none', flex: 'none', whiteSpace: 'nowrap' }}>
                전체<SIcon name="chevronRight" size={14} stroke={1.8} />
            </a>
        );
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 32 }}>
                <h2 style={{ margin: 0, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 18, fontWeight: 700, lineHeight: 1.35, letterSpacing: '-0.02em', whiteSpace: 'nowrap', color: SD.gray900 }}>
                    {iconImage ? <img src={iconImage} alt="" width={34} height={34} style={{ width: 34, height: 34, margin: '-4px 0', objectFit: 'contain', flex: 'none' }} /> : <SIcon name={icon} size={22} stroke={1.7} />}
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
                </h2>
                {more}
            </div>
            {sub && <p style={{ margin: 0, fontSize: 13, color: SD.gray700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</p>}
        </div>
    );
}

/** 알약 모양 고르기 칩(고른 칩은 검정 채움). 0개 탭은 눌리지 않는다. */
export function ChipRow({ label, items, value, onChange }: { label: string; items: Array<{ id: string; label: ReactNode; disabled?: boolean }>; value: string; onChange: (id: string) => void }) {
    return (
        <div role="tablist" aria-label={label} data-noscroll="" style={{ ...HSCROLL, gap: 8 }}>
            {items.map((item) => {
                const on = item.id === value;
                return (
                    <button key={item.id} type="button" role="tab" aria-selected={on} disabled={item.disabled} onClick={() => onChange(item.id)}
                        style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', height: 36, padding: '0 14px', border: 0, borderRadius: 9999, fontFamily: 'inherit', fontSize: 14, whiteSpace: 'nowrap',
                            cursor: item.disabled ? 'default' : 'pointer', fontWeight: on ? 700 : 400, background: on ? SD.gray900 : SD.white, color: on ? SD.white : item.disabled ? SD.gray500 : SD.gray700,
                            boxShadow: on ? 'none' : `inset 0 0 0 1px ${SD.gray200}` }}>
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}
