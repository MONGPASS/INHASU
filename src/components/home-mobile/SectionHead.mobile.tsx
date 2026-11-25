import type { CSSProperties, ReactNode } from 'react';
import { SD, SIcon } from '../site-seed/seed';
import { linkTo, useGo } from './homeMobileData';

/** 옆으로 넘기는 줄(스크롤 막대 없음, 좌우 20px). `data-noscroll`과 함께 쓴다(index.css). */
export const HSCROLL: CSSProperties = { display: 'flex', overflowX: 'auto', padding: '0 20px', scrollPadding: '0 20px', scrollbarWidth: 'none' };

/** 휴대폰 홈 구역 제목: 22px 아이콘 + 제목 + 설명, 오른쪽 ‘전체 ›’. */
export function SectionHeadMobile({ icon, iconImage, title, sub, link }: { icon: string; iconImage?: string; title: string; sub?: string; link?: string }) {
    const go = useGo();
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, padding: '0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 20, fontWeight: 700, lineHeight: 1.35, color: SD.gray900, wordBreak: 'keep-all' }}>
                    {iconImage ? <img src={iconImage} alt="" width={26} height={26} style={{ width: 26, height: 26, objectFit: 'contain', flex: 'none' }} /> : <SIcon name={icon} size={22} stroke={1.7} />}
                    <span>{title}</span>
                </h2>
                {sub && <p style={{ margin: 0, fontSize: 13, color: SD.gray700 }}>{sub}</p>}
            </div>
            {link && (
                <a {...linkTo(go, link)} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: SD.gray600, fontSize: 13, textDecoration: 'none', flex: 'none' }}>
                    전체<SIcon name="chevronRight" size={14} stroke={1.8} />
                </a>
            )}
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
