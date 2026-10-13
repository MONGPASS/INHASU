import { MW } from '../desktop-primitives/mwTokens';

export function HeroBannerStatus({ error, onRetry }: { error: boolean; onRetry: () => void }) {
    return (
        <div
            role={error ? 'alert' : 'status'}
            aria-busy={!error}
            aria-label={error ? undefined : '추천 여행 불러오는 중'}
            style={{ width: '100%', height: '100%', background: MW.chip, color: MW.ink3, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24, boxSizing: 'border-box', textAlign: 'center' }}
        >
            {error && (
                <>
                    <p style={{ margin: 0, fontSize: 14 }}>추천 여행을 불러오지 못했습니다.</p>
                    <button type="button" onClick={onRetry} style={{ border: `1px solid ${MW.line}`, background: '#FFFFFF', borderRadius: 999, padding: '10px 20px', color: MW.navy, fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer' }}>
                        다시 시도
                    </button>
                </>
            )}
        </div>
    );
}
