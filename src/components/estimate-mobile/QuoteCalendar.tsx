import { useState, type CSSProperties } from 'react';
import { MW } from '../desktop-primitives/mwTokens';
import { WEEK, koDate, pad, plusDays, toKey } from '../estimate-desktop/quoteForm';
import type { CalKind } from './quoteMobile';

const SAT = '#2B63C6';
const navBtn: CSSProperties = { width: 44, height: 44, border: 0, borderRadius: '50%', background: '#F1F4F3', fontSize: 16, color: MW.navy, cursor: 'pointer', padding: 0 };

/**
 * Inline month calendar under the 몽골 입국일 / 귀국일 fields (Sunday red, Saturday blue, range tinted).
 * Mount it with `key={kind}` so the month re-anchors when switching between the two fields.
 * 입국일은 오늘부터, 귀국일은 입국일 다음 날부터 고를 수 있다(최소 1박).
 */
export function QuoteCalendar({ kind, start, end, onPick, onClear, onClose }: { kind: CalKind; start: string; end: string; onPick: (v: string) => void; onClear: () => void; onClose: () => void }) {
    const today = new Date();
    const todayKey = toKey(today);
    const [ym, setYm] = useState(() => {
        const seed = (kind === 'start' ? start : end || start) || todayKey;
        return { y: +seed.slice(0, 4), m: +seed.slice(5, 7) - 1 };
    });

    const { y, m } = ym;
    const first = new Date(y, m, 1).getDay();
    const dim = new Date(y, m + 1, 0).getDate();
    const min = kind === 'end' && start ? plusDays(start, 1) : todayKey;
    const prevDisabled = y < today.getFullYear() || (y === today.getFullYear() && m <= today.getMonth());
    const move = (d: number) => {
        const nd = new Date(y, m + d, 1);
        setYm({ y: nd.getFullYear(), m: nd.getMonth() });
    };

    return (
        <div style={{ background: '#fff', border: `1.5px solid ${MW.line2}`, borderRadius: 18, padding: 14, boxShadow: '0 12px 32px rgba(10,31,46,0.1)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <button type="button" onClick={() => move(-1)} disabled={prevDisabled} aria-label="이전 달" style={{ ...navBtn, opacity: prevDisabled ? 0.35 : 1, cursor: prevDisabled ? 'default' : 'pointer' }}>←</button>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: MW.mintDeep }}>{kind === 'start' ? '몽골 입국일' : '귀국일'} 선택</span>
                    <span aria-live="polite" style={{ fontSize: 16, fontWeight: 900 }}>{y}년 {m + 1}월</span>
                </div>
                <button type="button" onClick={() => move(1)} aria-label="다음 달" style={navBtn}>→</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 2, textAlign: 'center' }}>
                {WEEK.split('').map((w, i) => (
                    <span key={w} style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? MW.red : i === 6 ? SAT : MW.mute, padding: '4px 0' }}>{w}</span>
                ))}
                {Array.from({ length: first }, (_, i) => <span key={`b${i}`} />)}
                {Array.from({ length: dim }, (_, i) => {
                    const v = `${y}-${pad(m + 1)}-${pad(i + 1)}`;
                    const off = v < min;
                    const sel = v === start || v === end;
                    const inRange = !!start && !!end && v > start && v < end;
                    const dow = (first + i) % 7;
                    return (
                        <button
                            key={v}
                            type="button"
                            disabled={off}
                            aria-pressed={sel}
                            aria-label={koDate(v)}
                            onClick={() => onPick(v)}
                            style={{
                                height: 40, border: 0, borderRadius: 10, padding: 0, fontFamily: 'inherit', fontSize: 14, fontWeight: sel ? 900 : 500,
                                background: sel ? MW.mint : inRange ? MW.mintTint : 'transparent',
                                color: sel ? MW.navy : off ? '#C3CCCA' : dow === 0 ? MW.red : dow === 6 ? SAT : MW.navy,
                                cursor: off ? 'default' : 'pointer',
                            }}
                        >
                            {i + 1}
                        </button>
                    );
                })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" onClick={onClear} style={{ border: 0, background: 'transparent', color: MW.mute, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: '10px 0', fontFamily: 'inherit' }}>초기화</button>
                <button type="button" onClick={onClose} style={{ height: 40, padding: '0 18px', border: 0, borderRadius: 999, background: MW.navy, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>닫기</button>
            </div>
        </div>
    );
}
