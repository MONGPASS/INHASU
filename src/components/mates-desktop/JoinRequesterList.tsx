import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { timeAgo } from './matesData';
import type { JoinRequester } from './joinRequest';

/** Who asked to join — a block inside the dark "THIS TRIP" panel, shown to the host (and admins). */
export function JoinRequesterList({ count, requesters }: { count: number; requesters: JoinRequester[] }) {
    return (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.1)' }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>
                참가 요청
                <span style={{ color: MW.mintLight, whiteSpace: 'nowrap' }}>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 14, fontWeight: 600 }}>{count}</span>건
                </span>
            </span>
            {requesters.length > 0 ? (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {requesters.map((r) => (
                        <li key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: '50%', background: MW.mintTint, color: MW.navy, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {r.name.charAt(0).toUpperCase()}
                            </span>
                            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                            <span style={{ flexShrink: 0, fontSize: 11, color: MW.mintTint }}>{timeAgo(r.at)}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <span style={{ fontSize: 12, lineHeight: 1.6, color: MW.mintTint }}>아직 참가 요청이 없습니다.</span>
            )}
        </div>
    );
}
