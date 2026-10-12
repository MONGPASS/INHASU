import { useState, type CSSProperties } from 'react';
import { MW } from '../desktop-primitives/mwTokens';
import { D } from '../mobile/mobileTheme';
import { Ico } from '../mobile/mobileUi';
import { BK_HAIR, BK_OFF, BK_PAGE_BG, BK_SAT, BK_WEEK, addDays, fmtLong, sameDay, startOfToday } from './bookingShared';

interface BookingCalendarProps {
    pc: boolean;
    /** Selected departure date, or null while nothing is picked. */
    value: Date | null;
    onChange: (d: Date) => void;
    /** Tour nights: the range runs from the departure day to departure + nights. */
    nights: number;
}

const navBtn: CSSProperties = { width: 44, height: 44, border: 0, borderRadius: '50%', background: BK_PAGE_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 };

/**
 * Month calendar for the departure date (Claude Design: "Booking Date").
 * Past days cannot be picked — the only availability rule the site has.
 */
export function BookingCalendar({ pc, value, onChange, nights }: BookingCalendarProps) {
    const today = startOfToday();
    const [ym, setYm] = useState(() => {
        const seed = value ?? today;
        return { y: seed.getFullYear(), m: seed.getMonth() };
    });
    const { y, m } = ym;

    const first = new Date(y, m, 1).getDay();
    const dim = new Date(y, m + 1, 0).getDate();
    const end = value ? addDays(value, nights) : null;
    const prevOff = y < today.getFullYear() || (y === today.getFullYear() && m <= today.getMonth());
    const move = (k: number) => {
        const nd = new Date(y, m + k, 1);
        setYm({ y: nd.getFullYear(), m: nd.getMonth() });
    };

    const cellH = pc ? 60 : 50;
    const dayH = pc ? 52 : 46;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <style>{'.bk-day:not(:disabled):hover{outline:1.5px solid #27AB8F}'}</style>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button type="button" onClick={() => { if (!prevOff) move(-1); }} disabled={prevOff} aria-label="이전 달" style={{ ...navBtn, opacity: prevOff ? 0.35 : 1, cursor: prevOff ? 'default' : 'pointer' }}>
                    <Ico d={D.back} size={18} width={2} />
                </button>
                <span aria-live="polite" style={{ fontSize: 18, fontWeight: 900 }}>{y}년 {m + 1}월</span>
                <button type="button" onClick={() => move(1)} aria-label="다음 달" style={{ ...navBtn, cursor: 'pointer' }}>
                    <Ico d={D.chevron} size={18} width={2} />
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', rowGap: 6, textAlign: 'center' }}>
                {BK_WEEK.map((w, i) => (
                    <span key={w} style={{ padding: '6px 0 10px', fontSize: 11, fontWeight: 700, color: i === 0 ? MW.red : i === 6 ? BK_SAT : MW.mute }}>{w}</span>
                ))}
                {Array.from({ length: first }, (_, i) => <span key={`blank-${i}`} style={{ height: cellH }} />)}
                {Array.from({ length: dim }, (_, i) => {
                    const date = new Date(y, m, i + 1);
                    const dow = date.getDay();
                    const off = date < today;
                    const isStart = sameDay(date, value);
                    const isEnd = nights > 0 && sameDay(date, end);
                    const inRange = !!value && !!end && date > value && date < end;
                    const banded = nights > 0 && (isStart || isEnd || inRange);
                    const tag = isStart ? '출발' : isEnd ? '종료' : '';
                    return (
                        <div
                            key={i}
                            style={{ height: cellH, background: banded ? MW.mintTint : 'transparent', borderRadius: isStart ? '18px 0 0 18px' : isEnd ? '0 18px 18px 0' : 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <button
                                type="button"
                                className="bk-day"
                                disabled={off}
                                aria-pressed={isStart}
                                aria-label={fmtLong(date)}
                                onClick={() => onChange(date)}
                                style={{
                                    width: pc ? 52 : '100%', maxWidth: pc ? undefined : 46, height: dayH, border: 0, borderRadius: pc ? 16 : 14, padding: 0,
                                    background: isStart ? MW.navy : isEnd ? MW.mint : 'transparent',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                                    fontFamily: 'inherit', cursor: off ? 'default' : 'pointer',
                                }}
                            >
                                <span style={{ fontSize: 15, fontWeight: isStart || isEnd ? 900 : 600, color: isStart ? '#FFFFFF' : isEnd ? MW.navy : off ? BK_OFF : dow === 0 ? MW.red : dow === 6 ? BK_SAT : MW.navy }}>{i + 1}</span>
                                {tag && <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1, color: isStart ? MW.mintLight : MW.navy }}>{tag}</span>}
                            </button>
                        </div>
                    );
                })}
            </div>

            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', paddingTop: 14, borderTop: `1px solid ${BK_HAIR}`, fontSize: 12, color: MW.mute }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: 5, background: MW.navy }} />출발일</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: 5, background: MW.mintTint }} />여행 기간</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontWeight: 600, color: BK_OFF }}>12</span>예약 불가</span>
            </div>
        </div>
    );
}
