import { useNavigate } from 'react-router-dom';
import { SD, SIcon } from '../site-seed/seed';
import { CONTACT_CARDS, HOME_IMG, PARTNERS_ALT, SOCIAL_CHANNELS } from './homeContent';

/**
 * 소셜 채널 · 문의 카드 2장 · 협력 업체 로고(디자인 ‘소셜·문의·협력 업체’, 2026-11-25). PC·휴대폰 홈이 함께 쓴다.
 * 주소가 없는 소셜 채널은 ‘준비 중’으로 보이고 눌리지 않는다(homeContent.ts의 SOCIAL_CHANNELS).
 */
export function ConnectSection({ compact = false }: { compact?: boolean }) {
    const navigate = useNavigate();
    const pad = compact ? 16 : 20;
    const card = { position: 'relative', flex: '1 1 320px', minHeight: 210, borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' } as const;
    const cover = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' } as const;
    const inner = { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 24px', color: SD.white } as const;
    const outline = { marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 18px', border: '1px solid rgba(255,255,255,0.85)', borderRadius: 8, color: SD.white,
        fontSize: 15, fontWeight: 700, textDecoration: 'none' } as const;
    const { kakao, estimate } = CONTACT_CARDS;

    return (
        <section aria-label="소셜 채널과 문의" style={{ width: '100%', boxSizing: 'border-box', background: SD.white, color: SD.gray900, padding: compact ? '48px 0 56px' : '64px 0 72px' }}>
            <div style={{ maxWidth: 1120, margin: '0 auto', padding: `0 ${pad}px`, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: compact ? 32 : 40 }}>
                <nav aria-label="소셜 채널" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: compact ? '16px 6px' : '16px 32px' }}>
                    {SOCIAL_CHANNELS.map((channel) => {
                        const body = (
                            <>
                                <img src={channel.image} alt="" width={48} height={48} loading="lazy" decoding="async" style={{ width: 48, height: 48, objectFit: 'contain', display: 'block' }} />
                                {channel.label}
                                {!channel.url && <span style={{ fontSize: 11, color: SD.gray600 }}>준비 중</span>}
                            </>
                        );
                        const style = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: compact ? 56 : 64, color: SD.gray700, fontSize: 12, whiteSpace: 'nowrap', textDecoration: 'none' } as const;
                        return channel.url
                            ? <a key={channel.id} href={channel.url} target="_blank" rel="noopener noreferrer" style={style}>{body}</a>
                            : <span key={channel.id} aria-disabled="true" style={{ ...style, opacity: 0.6 }}>{body}</span>;
                    })}
                </nav>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                    <div style={card}>
                        <img src={kakao.image} alt={kakao.alt} loading="lazy" decoding="async" style={cover} />
                        <span style={{ position: 'absolute', inset: 0, background: 'rgba(23,23,26,0.45)' }} />
                        <div style={inner}>
                            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '0.02em', color: SD.white }}>{kakao.title}</h3>
                            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.92)', whiteSpace: 'pre-line' }}>{kakao.text}</p>
                            <a href={kakao.url} target="_blank" rel="noopener noreferrer" style={outline}><SIcon name="kakao" size={20} />{kakao.button}</a>
                        </div>
                    </div>
                    <div style={card}>
                        <img src={estimate.image} alt={estimate.alt} loading="lazy" decoding="async" style={cover} />
                        <span style={{ position: 'absolute', inset: 0, background: 'rgba(23,23,26,0.45)' }} />
                        <div style={inner}>
                            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '0.02em', color: SD.white }}>{estimate.title}</h3>
                            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.92)', whiteSpace: 'pre-line' }}>{estimate.text}</p>
                            <a href={estimate.path} onClick={(e) => { e.preventDefault(); navigate(estimate.path); }} style={outline}>{estimate.button}<SIcon name="arrowRight" size={16} stroke={2} /></a>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 14, borderBottom: `1px solid ${SD.gray200}`, fontSize: compact ? 18 : 22, fontWeight: 700, color: SD.gray900 }}>
                        은하수와 함께한 업체<SIcon name="flag" size={22} style={{ color: SD.mint600 }} />
                    </h2>
                    {/* 로고 띠는 같은 그림 두 장을 이어 붙여 끊김 없이 흐른다(올리면 멈춤, 움직임 줄이기 설정이면 멈춤 — index.css) */}
                    <div className="home-partner-wrap" role="region" aria-label="협력 업체 로고" style={{ overflow: 'hidden' }}>
                        <div className="home-partner-track" style={{ display: 'flex', width: 'max-content' }}>
                            <img src={HOME_IMG.partners} alt={PARTNERS_ALT} loading="lazy" decoding="async" style={{ height: compact ? 48 : 64, width: 'auto', display: 'block', paddingRight: 48 }} />
                            <img src={HOME_IMG.partners} alt="" aria-hidden="true" loading="lazy" decoding="async" style={{ height: compact ? 48 : 64, width: 'auto', display: 'block', paddingRight: 48 }} />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
