import { useEffect } from 'react';
import { MW, MW_FONT, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import type { HomeProduct } from '../home-desktop/homeDesktopData';
import { M_GRADIENT, M_HAIR } from '../mobile/mobileTheme';
import { Ico } from '../mobile/mobileUi';
import { EMPTY_FILTERS, PERKS, PRICE_BANDS, activeCount, countWith, splitDuration, toggleFilter, type Perk, type TourFilters } from './tourListFilters';

interface Props {
    /** Tours matching the page-level conditions (여행지 / 여행 타입 / 검색), before the sheet's own filters. */
    base: HomeProduct[];
    /** Tours left with every condition applied. */
    count: number;
    filters: TourFilters;
    /** Durations that exist in the published tours. */
    dayOptions: string[];
    /** 혜택 toggles that at least one published tour carries. */
    perks: Perk[];
    onChange: (next: TourFilters) => void;
    onClose: () => void;
}

/** 필터 bottom sheet of the mobile tour list (Claude Design: "M Filter Sheet"). */
export function TourFilterSheet({ base, count, filters, dayOptions, perks, onChange, onClose }: Props) {
    const active = activeCount(filters);
    const empty = count === 0;

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    const chips = [
        ...filters.days.map((d) => ({ label: d, onClick: () => onChange(toggleFilter(filters, 'days', d)) })),
        ...PRICE_BANDS.filter((b) => filters.prices.includes(b.key)).map((b) => ({ label: b.label, onClick: () => onChange(toggleFilter(filters, 'prices', b.key)) })),
        ...PERKS.filter((k) => filters.perks.includes(k.key)).map((k) => ({ label: k.chip, onClick: () => onChange(toggleFilter(filters, 'perks', k.key)) })),
    ];

    return (
        <div role="dialog" aria-modal="true" aria-label="필터" data-mw-overlay="" style={{ position: 'fixed', inset: 0, zIndex: 45, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', fontFamily: MW_FONT, color: MW.navy }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(10,31,46,0.45)' }} />
            <div style={{ position: 'relative', width: '100%', maxWidth: 480, maxHeight: '82vh', background: '#FFFFFF', borderRadius: '24px 24px 0 0', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
                    <span style={{ width: 40, height: 4, borderRadius: 999, background: MW.line2 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px 12px' }}>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 18, fontWeight: 900 }}>필터</span>
                        {active > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: MW.mintDeep }}>조건 {active}개</span>}
                    </span>
                    <button type="button" onClick={onClose} aria-label="닫기" style={{ width: 44, height: 44, border: 0, background: 'transparent', fontSize: 22, color: MW.navy, cursor: 'pointer', marginRight: -10, padding: 0 }}>×</button>
                </div>

                {chips.length > 0 && (
                    <div data-noscroll="" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 16px 12px' }}>
                        {chips.map((c) => (
                            <button key={c.label} type="button" onClick={c.onClick} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px 0 12px', border: 0, borderRadius: 999, background: MW.navy, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: '#FFFFFF', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                {c.label}
                                <span style={{ fontSize: 13, color: MW.mintLight }}>×</span>
                            </button>
                        ))}
                    </div>
                )}

                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {dayOptions.length > 0 && (
                        <div style={group}>
                            <div style={groupHead}>
                                <span style={groupTitle}>일정</span>
                                <span style={groupNote}>복수 선택 가능</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 6 }}>
                                {dayOptions.map((d) => {
                                    const on = filters.days.includes(d);
                                    const n = countWith(base, filters, 'days', d);
                                    const off = !n && !on;
                                    const [big, small] = splitDuration(d);
                                    return (
                                        <button
                                            key={d}
                                            type="button"
                                            aria-pressed={on}
                                            aria-label={`${d} (${n}건)`}
                                            onClick={() => onChange(toggleFilter(filters, 'days', d))}
                                            disabled={off}
                                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, height: 68, minWidth: 0, padding: 0, overflow: 'hidden', borderRadius: 14, border: `1.5px solid ${on ? MW.mint : MW.line}`, background: on ? MW.mintTint : '#FFFFFF', fontFamily: 'inherit', color: on ? MW.mintDeep : MW.navy, cursor: off ? 'default' : 'pointer', opacity: off ? 0.4 : 1 }}
                                        >
                                            <span style={{ fontSize: small ? 16 : 13, fontWeight: 900, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{big}</span>
                                            {small && <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{small}</span>}
                                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 9, fontWeight: 600, color: on ? MW.mintDeep : MW.mute2, marginTop: 2 }}>{n}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div style={group}>
                        <div style={groupHead}>
                            <span style={groupTitle}>요금</span>
                            <span style={groupNote}>1인 기준·원화</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {PRICE_BANDS.map((b) => {
                                const on = filters.prices.includes(b.key);
                                const n = countWith(base, filters, 'prices', b.key);
                                const off = !n && !on;
                                return (
                                    <button
                                        key={b.key}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => onChange(toggleFilter(filters, 'prices', b.key))}
                                        disabled={off}
                                        style={{ display: 'flex', alignItems: 'center', gap: 12, height: 56, padding: '0 16px', borderRadius: 14, border: `1.5px solid ${on ? MW.mint : MW.line}`, background: on ? MW.mintBg : '#FFFFFF', fontFamily: 'inherit', textAlign: 'left', cursor: off ? 'default' : 'pointer', opacity: off ? 0.4 : 1 }}
                                    >
                                        <span style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${on ? MW.mint : '#C9D0CD'}`, background: on ? MW.mint : '#FFFFFF', boxSizing: 'border-box', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: MW.navy }}>
                                            {on ? '✓' : ''}
                                        </span>
                                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                            <span style={{ fontSize: 14, fontWeight: 700, color: MW.navy }}>{b.label}</span>
                                            <span style={{ fontSize: 11, color: MW.mute }}>{b.hint}</span>
                                        </span>
                                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, color: on ? MW.mintDeep : MW.mute2 }}>{n}건</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {perks.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '16px 0 12px', borderTop: `1px solid ${M_HAIR}` }}>
                            <span style={{ ...groupTitle, marginBottom: 6 }}>혜택</span>
                            {perks.map((k) => {
                                const on = filters.perks.includes(k.key);
                                return (
                                    <button
                                        key={k.key}
                                        type="button"
                                                                                aria-pressed={on}
                                        onClick={() => onChange(toggleFilter(filters, 'perks', k.key))}
                                        style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, padding: '8px 0', border: 0, background: 'transparent', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}
                                    >
                                        <span style={{ flexShrink: 0, minWidth: 64, height: 24, padding: '0 8px', boxSizing: 'border-box', borderRadius: 6, background: k.tagBg, border: `1px solid ${k.tagBd}`, color: k.tagFg, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k.tag}</span>
                                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <span style={{ fontSize: 14, fontWeight: 700, color: MW.navy }}>{k.label}</span>
                                            <span style={{ fontSize: 11, color: MW.mute }}>{k.hint}</span>
                                        </span>
                                        <span style={{ flexShrink: 0, width: 46, height: 28, borderRadius: 999, background: on ? MW.mint : MW.line2, position: 'relative', transition: 'background .2s' }}>
                                            <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(10,31,46,0.25)', transition: 'left .2s' }} />
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, padding: '12px 16px calc(14px + env(safe-area-inset-bottom))', borderTop: `1px solid ${M_HAIR}` }}>
                    <button type="button" onClick={() => onChange(EMPTY_FILTERS)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 52, border: `1px solid ${MW.line}`, borderRadius: 999, background: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: active ? MW.navy : MW.mute2, cursor: 'pointer' }}>
                        <Ico d="M4 12a8 8 0 102.3-5.7M4 4v4h4" size={15} width={2} color="currentColor" />
                        초기화
                    </button>
                    <button type="button" onClick={onClose} disabled={empty} style={{ height: 52, border: 0, borderRadius: 999, background: empty ? MW.chip : M_GRADIENT, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: empty ? MW.mute2 : MW.navy, cursor: empty ? 'default' : 'pointer' }}>
                        {empty ? '조건에 맞는 투어가 없습니다' : `투어 ${count}건 보기`}
                    </button>
                </div>
            </div>
        </div>
    );
}

const group = { display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 0 20px', borderTop: `1px solid ${M_HAIR}` } as const;
const groupHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } as const;
const groupTitle = { fontSize: 15, fontWeight: 900 } as const;
const groupNote = { fontSize: 12, color: MW.mute2 } as const;
