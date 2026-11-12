import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { BK_HEAD, BK_STEPS, type BookingStepNo } from '../reservation-shared/bookingShared';

const DOT = 24;

/**
 * 예약 단계 머리: 한 줄로 이어진 3단계 표시(지난 단계 ✓ · 지금 단계 · 남은 단계) 아래에 단계 제목과 설명.
 * 단계 번호는 점 안에만 적는다("STEP n / 3" 문구를 따로 두지 않는다).
 */
export function BookingHeaderMobile({ step }: { step: BookingStepNo }) {
    const { title, sub } = BK_HEAD[step];
    return (
        <div style={{ background: '#FFFFFF', borderBottom: `1px solid ${MW.line}` }}>
            <div style={{ padding: '18px 16px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <ol aria-label={`예약 진행 상황 (${step} / ${BK_STEPS.length}단계)`} style={{ display: 'grid', gridTemplateColumns: `repeat(${BK_STEPS.length},minmax(0,1fr))`, margin: 0, padding: 0, listStyle: 'none' }}>
                    {BK_STEPS.map((s, i) => {
                        const n = i + 1;
                        const past = n < step;
                        const on = n === step;
                        const done = past || on;
                        return (
                            <li key={s.short} aria-current={on || undefined} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                {/* 앞 단계와 잇는 선: 지금 단계까지는 민트, 그 뒤는 회색 */}
                                {i > 0 && <span aria-hidden="true" style={{ position: 'absolute', top: DOT / 2 - 1, right: '50%', width: '100%', height: 2, background: done ? MW.mint : MW.line }} />}
                                <span style={{ position: 'relative', zIndex: 1, width: DOT, height: DOT, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 700, background: done ? MW.mint : '#FFFFFF', color: done ? '#FFFFFF' : MW.mute2, border: `1.5px solid ${done ? MW.mint : MW.line2}`, boxShadow: on ? '0 0 0 4px rgba(39,171,143,0.16)' : undefined }}>
                                    {past ? (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                                    ) : n}
                                </span>
                                <span style={{ maxWidth: '100%', fontSize: 12, fontWeight: on ? 800 : 600, color: on ? MW.navy : past ? MW.ink3 : MW.mute2, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.short}</span>
                            </li>
                        );
                    })}
                </ol>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, lineHeight: 1.35, letterSpacing: '-0.02em' }}>{title}</h1>
                    <span style={{ fontSize: 13, lineHeight: 1.55, color: MW.mute }}>{sub}</span>
                </div>
            </div>
        </div>
    );
}
