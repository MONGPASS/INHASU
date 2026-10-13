import type { CSSProperties } from 'react';
import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { M_HAIR } from '../mobile/mobileTheme';

const code: CSSProperties = { fontFamily: MW_FONT_EN, fontSize: 26, fontWeight: 600, lineHeight: 1.1 };
const city: CSSProperties = { fontSize: 10, color: MW.mute, whiteSpace: 'nowrap' };
const notch: CSSProperties = { position: 'absolute', top: 0, width: 18, height: 18, borderRadius: '50%', background: '#FFFFFF' };

/** Boarding-pass summary of the request, shown under the form (Claude Design: M Travel Pass). */
export function TravelPassMobile({ passenger, people, depart, nights, places, styles }: { passenger: string; people: string; depart: string; nights: string; places: string; styles: string }) {
    return (
        <aside aria-label="견적 내용" style={{ marginTop: 36, display: 'flex', flexDirection: 'column', filter: 'drop-shadow(0 12px 28px rgba(10,31,46,0.12))' }}>
            <div style={{ background: '#fff', border: `1px solid ${M_HAIR}`, borderBottom: 0, borderRadius: '20px 20px 0 0', padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontFamily: MW_FONT_EN, fontSize: 9, fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                    <span style={{ color: MW.mute2 }}>TRAVEL PASS · NO.{new Date().getFullYear()}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: MW.mintDeep }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: MW.mint, boxShadow: '0 0 0 3px rgba(39,171,143,0.18)' }} />
                        NOW BOARDING
                    </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={code}>ICN</span>
                        <span style={city}>서울(인천)</span>
                    </div>
                    <div aria-hidden="true" style={{ position: 'relative', height: 24 }}>
                        <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', borderTop: `2px dashed ${MW.dot}` }} />
                        <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-52%)', background: '#fff', padding: '0 4px', fontSize: 18, lineHeight: 1, color: MW.mintDeep }}>✈</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={code}>UBN</span>
                        <span style={city}>울란바토르</span>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '12px 16px' }}>
                    <PassField label="PASSENGER" value={passenger} />
                    <PassField label="PEOPLE" value={people} />
                    <PassField label="DEPART" value={depart} />
                    <PassField label="NIGHTS" value={nights} />
                </div>
            </div>
            <div style={{ position: 'relative', height: 18, background: '#fff' }}>
                <span style={{ ...notch, left: -9 }} />
                <span style={{ ...notch, right: -9 }} />
                <span style={{ position: 'absolute', left: 16, right: 16, top: 8, borderTop: '2px dashed #DDE2DF' }} />
            </div>
            <div style={{ background: '#fff', border: `1px solid ${M_HAIR}`, borderTop: 0, borderRadius: '0 0 20px 20px', padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <PassField label="DESTINATION" value={places} />
                <PassField label="STYLE" value={styles} />
                <span style={{ fontSize: 11, lineHeight: 1.7, color: MW.mute, textAlign: 'center' }}>무료·부담 없음 | 24시간 이내 한국어 스태프가 답변</span>
            </div>
        </aside>
    );
}

function PassField({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontFamily: MW_FONT_EN, fontSize: 9, fontWeight: 600, letterSpacing: '0.04em', color: MW.mute2 }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
        </div>
    );
}
