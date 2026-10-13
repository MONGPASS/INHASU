import { useEffect } from 'react';
import { MW, MW_FONT } from '../desktop-primitives/mwTokens';
import { M_GRADIENT, M_HAIR } from '../mobile/mobileTheme';
import type { MateFilterGroup, MateFilterKey } from './useMatesList';

interface Props {
    groups: MateFilterGroup[];
    has: (k: MateFilterKey, v: string) => boolean;
    toggle: (k: MateFilterKey, v: string) => void;
    activeCount: number;
    /** Posts matching the current conditions (shown on the confirm button). */
    resultCount: number;
    onReset: () => void;
    onClose: () => void;
}

/** Bottom sheet with the five filter groups. Mounted only while open. */
export function MatesFilterSheet({ groups, has, toggle, activeCount, resultCount, onReset, onClose }: Props) {
    // Lock the page behind the sheet; Escape closes it.
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prev;
            document.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    const found = resultCount > 0;

    return (
        <div role="dialog" aria-modal="true" aria-label="필터" data-mw-overlay="" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', fontFamily: MW_FONT, color: MW.navy }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(10,31,46,0.45)' }} />
            <div style={{ position: 'relative', width: '100%', maxWidth: 480, maxHeight: '84vh', background: '#FFFFFF', borderRadius: '24px 24px 0 0', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
                    <span style={{ width: 40, height: 4, borderRadius: 999, background: MW.line2 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px 12px' }}>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 18, fontWeight: 900 }}>필터</span>
                        {activeCount > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: MW.mintDeep }}>조건 {activeCount}개</span>}
                    </span>
                    <button type="button" onClick={onClose} aria-label="닫기" style={{ width: 44, height: 44, border: 0, background: 'transparent', fontSize: 22, color: MW.navy, cursor: 'pointer', marginRight: -10, padding: 0 }}>×</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 16px 8px' }}>
                    {groups.map((g) => (
                        <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 0', borderTop: `1px solid ${M_HAIR}` }}>
                            <span style={{ fontSize: 14, fontWeight: 900 }}>{g.title}</span>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 6 }}>
                                {g.opts.map(([v, label]) => {
                                    const on = has(g.key, v);
                                    return (
                                        <button
                                            key={v}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() => toggle(g.key, v)}
                                            style={{ height: 40, padding: '0 6px', borderRadius: 12, border: `1.5px solid ${on ? MW.mint : MW.line}`, background: on ? MW.mintTint : '#FFFFFF', fontFamily: 'inherit', fontSize: 12, fontWeight: on ? 700 : 500, color: on ? MW.mintDeep : MW.ink3, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, padding: '12px 16px calc(14px + env(safe-area-inset-bottom))', borderTop: `1px solid ${M_HAIR}` }}>
                    <button type="button" onClick={onReset} style={{ height: 52, border: `1px solid ${MW.line}`, borderRadius: 999, background: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}>초기화</button>
                    <button type="button" onClick={onClose} style={{ height: 52, border: 0, borderRadius: 999, background: found ? M_GRADIENT : MW.chip, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: found ? MW.navy : MW.mute2, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {found ? `모집글 ${resultCount}건 보기` : '해당하는 모집글이 없습니다'}
                    </button>
                </div>
            </div>
        </div>
    );
}
