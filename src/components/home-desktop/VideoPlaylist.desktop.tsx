import { useState } from 'react';
import { SD, SIcon } from '../site-seed/seed';
import { safeVideoLink, videoThumb, youtubeId, type HomeVideo } from '../home/homeSettings';

const VISIBLE = 3;

/**
 * 몽골리아 은하수 영상 PLAY LIST: 민트에서 흰색으로 내려가는 바탕 + 영상 카드 3장.
 * 영상은 관리자 ‘홈 화면 관리 → 영상 PLAY LIST’에서 정한다. 링크가 없으면 ‘준비 중’ 꼬리표로 보이고 눌리지 않는다.
 * 썸네일은 직접 올린 사진 → 유튜브 썸네일 → 기본 사진 순서(homeSettings.ts의 videoThumb).
 */
export function VideoPlaylistDesktop({ videos }: { videos: HomeVideo[] }) {
    const [start, setStart] = useState(0);
    const n = videos.length;
    if (n === 0) return null;
    const shown = Array.from({ length: Math.min(VISIBLE, n) }, (_, k) => (start + k) % n);
    const square = { width: 32, height: 32, border: `1px solid ${SD.gray200}`, borderRadius: 4, background: SD.white, color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 } as const;

    return (
        <section aria-roledescription="carousel" aria-label="몽골리아 은하수 플레이리스트"
            style={{ background: `linear-gradient(180deg, ${SD.mint400} 0%, ${SD.mint200} 38%, ${SD.mint50} 72%, ${SD.white} 100%)`, padding: '72px 0 96px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '0 32px', textAlign: 'center' }}>
                <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, lineHeight: 1.3, color: SD.mint950 }}>몽골리아 은하수 영상 PLAY LIST</h2>
                <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, color: SD.mint900 }}><SIcon name="tv" size={18} />영상으로 먼저 떠나 보는 몽골 여행</p>
            </div>
            <div style={{ marginTop: 48, padding: '0 32px' }}>
                <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '32px 24px' }}>
                    {shown.map((index, k) => {
                        const v = videos[index];
                        const href = safeVideoLink(v.url);
                        const ready = !!href;
                        const body = (
                            <>
                                <span style={{ position: 'relative', display: 'block', aspectRatio: '16 / 9', borderRadius: 8, overflow: 'hidden', background: SD.gray900, boxShadow: `0 0 0 6px ${SD.white}` }}>
                                    <img src={videoThumb(v, index)} alt={`${v.title} 영상`} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                    <span style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
                                    <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 56, height: 56, borderRadius: 9999, border: `2px solid ${SD.white}`, color: SD.white,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}><SIcon name="play" size={28} stroke={1.6} /></span>
                                    <span style={{ position: 'absolute', left: 14, top: 12, height: 26, padding: '0 10px', display: 'inline-flex', alignItems: 'center', borderRadius: 6, background: SD.white, color: SD.gray900, fontSize: 12, fontWeight: 700 }}>
                                        {!ready ? '준비 중' : youtubeId(v.url) ? 'YouTube' : '영상'}
                                    </span>
                                </span>
                                <span style={{ marginTop: 14, fontSize: 17, fontWeight: 700, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.title}</span>
                                {v.tags && <span style={{ fontSize: 14, color: SD.gray600 }}>{v.tags}</span>}
                            </>
                        );
                        const style = { flex: '0 1 340px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 10, textDecoration: 'none', color: SD.gray900 } as const;
                        return ready
                            ? <a key={`${start}-${k}`} href={href} target="_blank" rel="noopener noreferrer" style={style}>{body}</a>
                            : <div key={`${start}-${k}`} style={style}>{body}</div>;
                    })}
                </div>
            </div>
            {n > VISIBLE && (
                <div style={{ maxWidth: 1120, margin: '28px auto 0', padding: '0 32px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, color: SD.gray600, marginRight: 8, fontVariantNumeric: 'tabular-nums' }}>{start + 1} / {n}</span>
                    <button type="button" aria-label="이전 영상" onClick={() => setStart((start - 1 + n) % n)} style={square}><SIcon name="chevronLeft" size={16} stroke={2} /></button>
                    <button type="button" aria-label="다음 영상" onClick={() => setStart((start + 1) % n)} style={square}><SIcon name="chevronRight" size={16} stroke={2} /></button>
                </div>
            )}
        </section>
    );
}
