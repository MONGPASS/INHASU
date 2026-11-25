import { useNavigate } from 'react-router-dom';
import { SD, SIcon } from '../site-seed/seed';
import { CONTACT_CARDS, HOME_IMG, PARTNERS, SOCIAL_CHANNELS } from './homeContent';

/**
 * 협력 업체 로고 · 문의 카드 2장 · 몽골리아 은하수의 SNS 순서(디자인 ‘소셜·문의·협력 업체’ 2차에서 업체와 SNS 자리를 맞바꿈, 2026-11-25). PC·휴대폰 홈이 함께 쓴다.
 * compact(휴대폰): SNS 아이콘을 한 줄에, 문의 카드 두 장을 나란히 작게.
 * 주소가 없는 소셜 채널은 ‘준비 중’으로 보이고 눌리지 않는다(homeContent.ts의 SOCIAL_CHANNELS).
 */
export function ConnectSection({ compact = false }: { compact?: boolean }) {
    const navigate = useNavigate();
    const { kakao, estimate } = CONTACT_CARDS;
    const cover = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' } as const;
    const card = compact
        ? { position: 'relative', flex: '1 1 0', minWidth: 0, height: 176, borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' } as const
        : { position: 'relative', flex: '1 1 320px', minHeight: 210, borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' } as const;
    const inner = { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 6 : 10, padding: compact ? '14px 10px' : '32px 24px', color: SD.white } as const;
    const title = { margin: 0, fontSize: compact ? 15 : 22, fontWeight: 700, letterSpacing: compact ? 0 : '0.02em', color: SD.white, whiteSpace: 'nowrap' } as const;
    const text = { margin: 0, fontSize: compact ? 11 : 14, lineHeight: compact ? 1.5 : 1.6, color: 'rgba(255,255,255,0.92)', whiteSpace: 'pre-line' } as const;
    const outline = { marginTop: compact ? 6 : 8, display: 'inline-flex', alignItems: 'center', gap: compact ? 5 : 10, height: compact ? 32 : 44, padding: compact ? '0 10px' : '0 16px',
        border: '1px solid rgba(255,255,255,0.85)', borderRadius: compact ? 6 : 8, color: SD.white, fontSize: compact ? 12 : 15, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' } as const;
    const shade = <span style={{ position: 'absolute', inset: 0, background: compact ? 'rgba(23,23,26,0.48)' : 'rgba(23,23,26,0.45)' }} />;
    const icon = compact ? 40 : 48;

    return (
        <section aria-label="협력 업체 · 문의 · 소셜 채널" style={{ width: '100%', boxSizing: 'border-box', background: SD.white, color: SD.gray900, padding: compact ? '36px 0 40px' : '64px 0 72px' }}>
            <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 20px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: compact ? 28 : 40 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, paddingBottom: compact ? 10 : 14, borderBottom: `1px solid ${SD.gray200}`, fontSize: compact ? 17 : 22, fontWeight: 700, color: SD.gray900 }}>
                        <img src={HOME_IMG.partnersHands} alt="" width={compact ? 54 : 66} height={compact ? 26 : 32} style={{ width: compact ? 54 : 66, height: compact ? 26 : 32, objectFit: 'contain', flex: 'none' }} />은하수와 함께한 업체
                    </h2>
                    {/* 로고 띠는 같은 로고 묶음 두 벌을 이어 붙여 끊김 없이 흐른다(올리면 멈춤, 움직임 줄이기 설정이면 멈춤 — index.css).
                        로고마다 크기가 달라 같은 높이 · 최대 너비 칸에 맞춘다. 두 번째 묶음은 화면 읽기 프로그램에서 숨긴다. */}
                    <div className="home-partner-wrap" role="region" aria-label="협력 업체 로고" style={{ overflow: 'hidden' }}>
                        <div className="home-partner-track" style={{ display: 'flex', width: 'max-content' }}>
                            {[0, 1].map((copy) => (
                                <ul key={copy} aria-hidden={copy === 1 || undefined} style={{ display: 'flex', alignItems: 'center', gap: compact ? 28 : 56, margin: 0, padding: `0 ${compact ? 28 : 56}px 0 0`, listStyle: 'none' }}>
                                    {PARTNERS.map((partner) => (
                                        <li key={partner.name} style={{ flex: 'none', display: 'flex', alignItems: 'center' }}>
                                            <img src={partner.image} alt={copy === 0 ? partner.name : ''} loading="lazy" decoding="async"
                                                style={{ height: compact ? 40 : 52, width: 'auto', maxWidth: compact ? 150 : 200, objectFit: 'contain', display: 'block' }} />
                                        </li>
                                    ))}
                                </ul>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexWrap: compact ? 'nowrap' : 'wrap', gap: compact ? 10 : 16 }}>
                    <div style={card}>
                        <img src={kakao.image} alt={kakao.alt} loading="lazy" decoding="async" style={cover} />
                        {shade}
                        <div style={inner}>
                            <h3 style={title}>{kakao.title}</h3>
                            <p style={text}>{compact ? kakao.textShort : kakao.text}</p>
                            <a href={kakao.url} target="_blank" rel="noopener noreferrer" aria-label={`카카오톡 채널 ${kakao.button} 열기`} style={{ ...outline, fontSize: compact ? 12 : 16 }}>
                                <SIcon name="kakao" size={compact ? 14 : 20} stroke={compact ? 2 : 1.8} />{kakao.button}
                                {!compact && <SIcon name="search" size={18} stroke={2} />}
                            </a>
                        </div>
                    </div>
                    <div style={card}>
                        <img src={estimate.image} alt={estimate.alt} loading="lazy" decoding="async" style={cover} />
                        {shade}
                        <div style={inner}>
                            <h3 style={title}>{estimate.title}</h3>
                            <p style={text}>{compact ? estimate.textShort : estimate.text}</p>
                            <a href={estimate.path} onClick={(e) => { e.preventDefault(); navigate(estimate.path); }} style={{ ...outline, gap: compact ? 4 : 8, padding: compact ? '0 10px' : '0 18px' }}>
                                {compact ? estimate.buttonShort : estimate.button}<SIcon name="arrowRight" size={compact ? 12 : 16} stroke={compact ? 2.2 : 2} />
                            </a>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
                    <h2 style={{ margin: 0, fontSize: compact ? 17 : 20, fontWeight: 700, color: SD.gray900, textAlign: 'center' }}>몽골리아 은하수의 SNS</h2>
                    <nav aria-label="소셜 채널" style={{ display: 'flex', flexWrap: 'nowrap', justifyContent: 'space-between', gap: 4, width: '100%', maxWidth: 480, margin: '0 auto' }}>
                        {SOCIAL_CHANNELS.map((channel) => {
                            const body = (
                                <>
                                    <img src={channel.image} alt="" width={icon} height={icon} loading="lazy" decoding="async" style={{ width: icon, height: icon, objectFit: 'contain', display: 'block' }} />
                                    {channel.label}
                                    {!channel.url && <span style={{ fontSize: 11, color: SD.gray600 }}>준비 중</span>}
                                </>
                            );
                            const style = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 6 : 8, flex: '1 1 0', minWidth: 0, color: SD.gray700, fontSize: compact ? 11 : 12,
                                whiteSpace: 'nowrap', textDecoration: 'none' } as const;
                            return channel.url
                                ? <a key={channel.id} href={channel.url} target="_blank" rel="noopener noreferrer" style={style}>{body}</a>
                                : <span key={channel.id} aria-disabled="true" style={{ ...style, opacity: 0.6 }}>{body}</span>;
                        })}
                    </nav>
                </div>
            </div>
        </section>
    );
}
