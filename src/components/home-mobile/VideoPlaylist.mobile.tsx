import { safeVideoLink, videoThumb, youtubeId, type HomeVideo } from '../home/homeSettings';
import { SD, SIcon } from '../site-seed/seed';

/**
 * 몽골리아 은하수 PLAY LIST(휴대폰): 민트에서 흰색으로 내려가는 바탕 + 옆으로 넘기는 영상 카드.
 * 영상은 관리자 ‘홈 화면 관리 → 영상 PLAY LIST’에서 정한다. 링크가 없으면 ‘준비 중’ 꼬리표로 보이고 눌리지 않는다.
 */
export function VideoPlaylistMobile({ videos }: { videos: HomeVideo[] }) {
    if (videos.length === 0) return null;
    return (
        <section aria-label="몽골리아 은하수 플레이리스트"
            style={{ marginTop: 48, padding: '40px 0 44px', background: `linear-gradient(180deg, ${SD.mint400} 0%, ${SD.mint200} 38%, ${SD.mint50} 72%, ${SD.white} 100%)`, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '0 20px', textAlign: 'center' }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: SD.mint950 }}>몽골리아 은하수 PLAY LIST</h2>
                <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: SD.mint900 }}><SIcon name="tv" size={16} />영상으로 먼저 떠나 보는 몽골 여행</p>
            </div>
            <div data-noscroll="" style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '4px 24px', scrollbarWidth: 'none' }}>
                {videos.map((v, index) => {
                    const href = safeVideoLink(v.url);
                    const ready = !!href;
                    const body = (
                        <>
                            <span style={{ position: 'relative', display: 'block', aspectRatio: '16 / 9', borderRadius: 8, overflow: 'hidden', background: SD.gray900, boxShadow: `0 0 0 4px ${SD.white}` }}>
                                <img src={videoThumb(v, index)} alt={`${v.title} 영상`} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                <span style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
                                <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 44, height: 44, borderRadius: 9999, border: `2px solid ${SD.white}`, color: SD.white,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}><SIcon name="play" size={20} stroke={1.6} /></span>
                                <span style={{ position: 'absolute', left: 10, top: 8, height: 22, padding: '0 8px', display: 'inline-flex', alignItems: 'center', borderRadius: 5, background: SD.white, color: SD.gray900, fontSize: 11, fontWeight: 700 }}>
                                    {!ready ? '준비 중' : youtubeId(v.url) ? 'YouTube' : '영상'}
                                </span>
                            </span>
                            <span style={{ marginTop: 8, fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.title}</span>
                            {v.tags && <span style={{ fontSize: 12, color: SD.gray600 }}>{v.tags}</span>}
                        </>
                    );
                    const style = { flex: '0 0 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8, color: SD.gray900, textDecoration: 'none' } as const;
                    return ready
                        ? <a key={v.id} href={href} target="_blank" rel="noopener noreferrer" style={style}>{body}</a>
                        : <div key={v.id} style={style}>{body}</div>;
                })}
            </div>
        </section>
    );
}
