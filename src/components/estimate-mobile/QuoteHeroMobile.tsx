import type { CSSProperties } from 'react';
import { MW } from '../desktop-primitives/mwTokens';
import { QUOTE_MEDIA, QUOTE_SCENES } from '../estimate-desktop/quoteScenes';
import { useJourneyVideo } from './useJourneyVideo';

const media: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '65% center' };
const oneLine: CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

/**
 * Quote hero (Claude Design: M Quote Hero). The design's rotating scene photos are the
 * real 3D journey film the PC hero plays; the caption and dots follow its scenes.
 */
export function QuoteHeroMobile({ onHome }: { onHome: () => void }) {
    const { root, video, active, playing, failed, motion, togglePlayback, selectScene, videoEvents } = useJourneyVideo();
    const scene = QUOTE_SCENES[active];
    const at = scene.title.indexOf(scene.accent);

    return (
        <section ref={root} aria-label="몽골 여행 소개" style={{ position: 'relative', background: MW.navySoft, color: '#fff', overflow: 'hidden' }}>
            <img src={`${QUOTE_MEDIA}/poster.webp`} alt="" fetchPriority="high" style={media} />
            {!failed && (
                <video
                    ref={video}
                    src={motion ? `${QUOTE_MEDIA}/journey.mp4` : undefined}
                    poster={`${QUOTE_MEDIA}/poster.webp`}
                    muted
                    loop={true}
                    playsInline
                    preload="none"
                    aria-hidden="true"
                    style={media}
                    {...videoEvents}
                />
            )}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg,rgba(10,31,46,0.75) 0%,rgba(10,31,46,0.35) 50%,rgba(10,31,46,0.8) 100%)' }} />
            <div style={{ position: 'relative', padding: '16px 16px 20px', minHeight: 360, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 28 }}>
                <nav aria-label="현재 위치" style={{ display: 'flex', gap: 6, fontSize: 12, color: '#C4D0D8' }}>
                    <a href="/" onClick={(e) => { e.preventDefault(); onHome(); }} style={{ color: '#C4D0D8', textDecoration: 'none' }}>홈</a>
                    <span aria-hidden="true">›</span>
                    <span style={{ color: '#fff', fontWeight: 700 }}>견적</span>
                </nav>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, lineHeight: 1.25, whiteSpace: 'nowrap' }}>맞춤 견적</h1>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.75, color: '#D8E1E7', textWrap: 'pretty' }}>
                        인원·일정·가고 싶은 곳을 알려 주세요. 한국어 스태프가 24시간 이내에 맞춤 견적서를 준비해 카카오 알림톡으로 알려 드립니다.
                    </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 12, borderLeft: '3px solid #3FC2A4', minWidth: 0 }}>
                        <span style={{ fontSize: 16, fontWeight: 900, ...oneLine }}>
                            {scene.title.slice(0, at)}
                            <span style={{ color: MW.mintLight }}>{scene.accent}</span>
                            {scene.title.slice(at + scene.accent.length)}
                        </span>
                        <span style={{ fontSize: 12, color: '#C4D0D8', ...oneLine }}>{scene.subtitle}</span>
                    </div>
                    {!failed && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, height: 6 }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                                {motion && QUOTE_SCENES.map((s, i) => {
                                    const on = i === active;
                                    return (
                                        // 6px bar inside a taller tap target
                                        <button
                                            key={s.title}
                                            type="button"
                                            aria-label={s.title}
                                            aria-current={on || undefined}
                                            onClick={() => selectScene(i)}
                                            style={{ height: 32, border: 0, padding: 0, background: 'transparent', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                                        >
                                            <span style={{ width: on ? 22 : 6, height: 6, borderRadius: 3, background: on ? '#FFFFFF' : 'rgba(255,255,255,0.5)', transition: 'width .3s' }} />
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                type="button"
                                onClick={togglePlayback}
                                aria-label={playing ? '동영상 일시정지' : '동영상 재생'}
                                style={{ flexShrink: 0, height: 32, padding: '0 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(8,35,44,0.5)', color: '#fff', fontFamily: 'inherit', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                                {playing ? '일시정지' : '재생'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
