import { Fragment, useRef, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { KAKAO_CHANNEL_CHAT_URL } from '../../constants/company';
import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import {
    ABOUT_BAND_IMAGE,
    ABOUT_COPY,
    ABOUT_HERO_IMAGE,
    ABOUT_MARQUEE,
    ABOUT_POINTS,
    ABOUT_STARS,
    ABOUT_TEAM,
    type AboutPoint,
} from './aboutContent';
import { useAboutMotion } from './useAboutMotion';
import './about.css';

/**
 * Sections of 회사 소개 (/about), Claude Design "Milkyway Japan Home / Mobile" About screens.
 * The two designs share one structure and differ in sizes, so each section takes `m`
 * (true = phone sizes) and AboutDesktop / AboutMobile only compose them.
 * Motion: class names from about.css + useAboutMotion (see the notes there).
 */

interface SectionProps {
    /** Phone sizes (below 1024px). */
    m: boolean;
}

const WHITE = '#FFFFFF';
const COLUMN: CSSProperties = { maxWidth: 1200, margin: '0 auto' };
const TWO_COL = 'repeat(auto-fit,minmax(min(100%,380px),1fr))';

/** Reveal delay (seconds) and optional start offset, passed to about.css as custom properties. */
function fx(delay: number, style?: CSSProperties, offset?: { x?: number; y?: number }): CSSProperties {
    const vars: Record<string, string> = { '--mw-about-d': `${delay}s` };
    if (offset?.x !== undefined) vars['--mw-about-x'] = `${offset.x}px`;
    if (offset?.y !== undefined) vars['--mw-about-y'] = `${offset.y}px`;
    return { ...style, ...vars } as CSSProperties;
}

/**
 * One line of text rising out of its clipping box. `own` = the box triggers the line itself;
 * pass false when an ancestor `data-ab-trigger` should start it together with its neighbours.
 */
function Rise({ children, delay, own = true }: { children: ReactNode; delay: number; own?: boolean }) {
    return (
        <span className="mw-about-line" data-ab-trigger={own ? '' : undefined}>
            <span className="mw-about-fx mw-about-fx--rise" style={fx(delay)}>{children}</span>
        </span>
    );
}

/** Page wrapper: clips the oversized decorations, owns the motion hook and the reading bar. */
export function AboutRoot({ m, children }: SectionProps & { children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    useAboutMotion(ref);
    return (
        <div ref={ref} className={m ? 'mw-about mw-about--m' : 'mw-about'}>
            <span className="mw-about-progress" aria-hidden="true" />
            {children}
        </div>
    );
}

export function AboutHero({ m }: SectionProps) {
    return (
        <section style={{ position: 'relative', minHeight: m ? 'min(78vh,620px)' : 'clamp(520px,82vh,780px)', display: 'flex', alignItems: 'flex-end', overflow: 'hidden', background: MW.navy, color: WHITE }}>
            <div className="mw-about-ken" style={{ position: 'absolute', inset: 0, transformOrigin: '60% 40%' }}>
                <img
                    className="mw-about-cover"
                    src={ABOUT_HERO_IMAGE.src}
                    alt={ABOUT_HERO_IMAGE.alt}
                    width={ABOUT_HERO_IMAGE.width}
                    height={ABOUT_HERO_IMAGE.height}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                />
            </div>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg,rgba(10,31,46,0.35) 0%,rgba(10,31,46,0.55) 55%,rgba(10,31,46,0.92) 100%)' }} />
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {ABOUT_STARS.map((s, i) => (
                    <span
                        key={i}
                        className="mw-about-star"
                        style={{
                            left: `${s.left}%`,
                            top: `${s.top}%`,
                            width: s.size,
                            height: s.size,
                            boxShadow: `0 0 ${s.size * 3}px rgba(255,255,255,0.9)`,
                            '--mw-about-dur': `${s.duration}s`,
                            '--mw-about-delay': `${s.delay}s`,
                        } as CSSProperties}
                    />
                ))}
            </div>
            <div data-ab-trigger="" style={{ ...COLUMN, position: 'relative', width: '100%', padding: m ? '0 20px 44px' : '0 24px clamp(56px,8vw,96px)', display: 'flex', flexDirection: 'column', gap: m ? 18 : 24, pointerEvents: 'none' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span className="mw-about-fx mw-about-fx--bar" style={fx(0.1, { display: 'block', width: 48, height: 1.5, background: MW.mintLight, transformOrigin: '0 50%' })} />
                    <span className="mw-about-fx mw-about-fx--fade" style={fx(0.25, { fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', color: MW.mintLight }, { x: -12, y: 0 })}>
                        {ABOUT_COPY.heroEyebrow}
                    </span>
                </span>
                <h1 style={{ margin: 0, fontSize: m ? 'clamp(26px,8vw,34px)' : 'clamp(38px,6vw,76px)', fontWeight: 900, lineHeight: m ? 1.3 : 1.2, letterSpacing: '-0.02em', whiteSpace: m ? 'nowrap' : undefined }}>
                    <Rise delay={0.35} own={false}>{ABOUT_COPY.heroLines[0]}</Rise>
                    <Rise delay={0.5} own={false}><span className="mw-about-shine">{ABOUT_COPY.heroLines[1]}</span></Rise>
                </h1>
                <div aria-hidden="true" className="mw-about-fx mw-about-fx--fade" style={fx(0.9, { display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: '#C4D0D8' }, { y: 12 })}>
                    <span style={{ position: 'relative', width: 22, height: 36, border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: 12, boxSizing: 'border-box' }}>
                        <span className="mw-about-bob" style={{ position: 'absolute', left: '50%', top: 6, width: 3, height: 7, marginLeft: -1.5, borderRadius: 2, background: MW.mintLight }} />
                    </span>
                    {ABOUT_COPY.scrollHint}
                </div>
            </div>
        </section>
    );
}

function MarqueeGroup() {
    return (
        <span style={{ display: 'flex', alignItems: 'center', gap: 40, flexShrink: 0, paddingRight: 40 }}>
            {ABOUT_MARQUEE.map((word) => (
                <Fragment key={word}>
                    <span>{word}</span>
                    <span style={{ fontSize: '0.6em', color: MW.navy }}>✦</span>
                </Fragment>
            ))}
        </span>
    );
}

/** Flowing band of decorative English words — two identical groups, the track slides by one. */
export function AboutMarquee({ m }: SectionProps) {
    return (
        <div aria-hidden="true" style={{ overflow: 'hidden', background: 'linear-gradient(90deg,#27AB8F 0%,#3FC2A4 100%)', padding: m ? '12px 0' : '18px 0' }}>
            <div className="mw-about-marquee-track" style={{ fontFamily: MW_FONT_EN, fontSize: m ? 18 : 'clamp(20px,2.4vw,30px)', fontWeight: 600, letterSpacing: '0.02em', color: WHITE }}>
                <MarqueeGroup />
                <MarqueeGroup />
            </div>
        </div>
    );
}

/** Kicker + rising heading used by the philosophy and values sections. */
function SectionHeading({ m, title }: SectionProps & { title: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="mw-about-fx mw-about-fx--fade" style={fx(0, { fontSize: 14, fontWeight: 700, color: MW.mintDeep })}>{ABOUT_COPY.kicker}</span>
            <h2 style={{ margin: 0, fontSize: m ? 30 : 'clamp(34px,4.4vw,52px)', fontWeight: 900, lineHeight: m ? 1.25 : 1.2 }}>
                <Rise delay={0.1}>{title}</Rise>
            </h2>
        </div>
    );
}

export function AboutPhilosophy({ m }: SectionProps) {
    return (
        <section style={{ ...COLUMN, position: 'relative', padding: m ? '64px 20px' : 'clamp(80px,10vw,140px) 24px' }}>
            <span aria-hidden="true" data-ab-drift="-0.25" className="mw-about-ghost" style={{ position: 'absolute', left: 0, top: 'clamp(20px,4vw,48px)', fontFamily: MW_FONT_EN, fontSize: m ? 72 : 'clamp(80px,13vw,180px)', fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                {ABOUT_COPY.philosophyGhost}
            </span>
            <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: TWO_COL, gap: m ? 20 : 40, alignItems: 'flex-start' }}>
                <SectionHeading m={m} title={ABOUT_COPY.philosophyTitle} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: m ? 16 : 22, fontSize: m ? 15 : 18, lineHeight: m ? 1.9 : 1.95, color: MW.ink2, paddingTop: 8 }}>
                    {ABOUT_COPY.philosophyBody.map((text, i) => (
                        <p key={text} className="mw-about-fx mw-about-fx--blur" style={fx(0.2 + i * 0.15, { margin: 0 })}>{text}</p>
                    ))}
                </div>
            </div>
        </section>
    );
}

/** Full-width photo band with the centred statement; the photo drifts against the scroll. */
export function AboutBand({ m }: SectionProps) {
    return (
        <section style={{ position: 'relative', overflow: 'hidden', background: MW.navy, color: WHITE }}>
            <div data-ab-parallax="0.18" style={{ position: 'absolute', left: 0, right: 0, top: '-18%', bottom: '-18%' }}>
                <img className="mw-about-cover" src={ABOUT_BAND_IMAGE.src} alt={ABOUT_BAND_IMAGE.alt} width={ABOUT_BAND_IMAGE.width} height={ABOUT_BAND_IMAGE.height} loading="lazy" decoding="async" />
            </div>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 50%,rgba(10,31,46,0.35) 0%,rgba(10,31,46,0.75) 100%)' }} />
            <div style={{ position: 'relative', maxWidth: 920, margin: '0 auto', padding: m ? '80px 22px' : 'clamp(100px,13vw,180px) 24px', textAlign: 'center', pointerEvents: 'none' }}>
                <p className="mw-about-fx mw-about-fx--haze mw-about-balance" style={fx(0, { margin: 0, fontSize: m ? 18 : 'clamp(20px,2.4vw,30px)', fontWeight: 700, lineHeight: 1.85 })}>
                    {ABOUT_COPY.bandText}
                </p>
            </div>
        </section>
    );
}

/** Values statement + the team cards (PC: 3-column grid, phone: snap-scrolling row). */
export function AboutValues({ m }: SectionProps) {
    const radius = m ? 24 : 32;
    return (
        <section style={{ ...COLUMN, padding: m ? '64px 20px 0' : 'clamp(80px,10vw,140px) 24px 0', display: 'flex', flexDirection: 'column', gap: m ? 28 : 48 }}>
            <div style={{ display: 'grid', gridTemplateColumns: TWO_COL, gap: m ? 20 : 40, alignItems: 'flex-end' }}>
                <SectionHeading m={m} title={ABOUT_COPY.valuesTitle} />
                <p className="mw-about-fx mw-about-fx--blur" style={fx(0.25, { margin: 0, fontSize: m ? 15 : 18, lineHeight: m ? 1.9 : 1.95, color: MW.ink2 })}>{ABOUT_COPY.valuesBody}</p>
            </div>
            <div
                data-noscroll={m ? '' : undefined}
                style={m
                    ? { display: 'flex', gap: 12, overflowX: 'auto', overflowY: 'hidden', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', margin: '0 -20px', padding: '4px 20px 8px', scrollPadding: '0 20px' }
                    : { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', gap: 18 }}
            >
                {ABOUT_TEAM.map((member, i) => (
                    <div key={member.name} className="mw-about-fx mw-about-fx--card" style={fx(i * 0.12, m ? { flex: '0 0 72%', scrollSnapAlign: 'start' } : undefined)}>
                        <div className="mw-about-team" style={{ position: 'relative', aspectRatio: '3 / 4', borderRadius: radius, overflow: 'hidden', background: MW.navySoft, color: WHITE }}>
                            <div className="mw-about-team-img">
                                <img className="mw-about-cover" src={member.image.src} alt={member.image.alt} width={member.image.width} height={member.image.height} loading="lazy" decoding="async" />
                            </div>
                            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg,rgba(10,31,46,0) 45%,rgba(10,31,46,0.88) 100%)' }} />
                            <span aria-hidden="true" style={{ position: 'absolute', right: 22, top: 20, fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, color: WHITE, opacity: 0.8, pointerEvents: 'none' }}>{member.no}</span>
                            <div style={{ position: 'absolute', left: 24, right: 24, bottom: 24, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
                                <span style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 700, color: MW.navy, background: MW.mintLight, padding: '4px 12px', borderRadius: 999 }}>{member.role}</span>
                                <h3 style={{ margin: 0, fontFamily: MW_FONT_EN, fontSize: 30, fontWeight: 600, lineHeight: 1.1 }}>
                                    <Rise delay={0.3 + i * 0.12}>{member.name}</Rise>
                                </h3>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

/**
 * One promise: photo wiped in → heading lines rise → number fills from the bottom → body.
 * PC starts photo, number and heading together when the block enters (they sit side by side);
 * on phones they are stacked, so the photo and the number/heading group start on their own.
 * Body paragraphs always start when they themselves scroll in.
 */
function PromisePoint({ m, point }: SectionProps & { point: AboutPoint }) {
    const wipe = point.flip ? 'mw-about-fx--wipe-r' : 'mw-about-fx--wipe-l';
    const part = m ? '' : undefined;
    return (
        <div data-ab-trigger={m ? undefined : ''} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: m ? 22 : 'clamp(28px,5vw,72px)', alignItems: 'center', padding: m ? '44px 0' : 'clamp(56px,7vw,96px) 0' }}>
            <div data-ab-trigger={part} className={`mw-about-fx ${wipe}`} style={fx(0, { position: 'relative', aspectRatio: '4 / 3', borderRadius: m ? 24 : 32, overflow: 'hidden', background: MW.chip, order: !m && point.flip ? 2 : 0 })}>
                <div className="mw-about-fx mw-about-fx--zoom" style={fx(0.1, { position: 'absolute', inset: 0 })}>
                    <img className="mw-about-cover" src={point.image.src} alt={point.image.alt} width={point.image.width} height={point.image.height} loading="lazy" decoding="async" />
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
                <div data-ab-trigger={part} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                    <div style={{ position: 'relative', alignSelf: 'flex-start', fontFamily: MW_FONT_EN, fontSize: m ? 72 : 'clamp(88px,11vw,150px)', fontWeight: 600, lineHeight: 0.85, letterSpacing: '-0.04em' }}>
                        <span className="mw-about-num-line">{point.no}</span>
                        <span aria-hidden="true" className="mw-about-fx mw-about-fx--fill mw-about-num-fill" style={fx(0.35, { position: 'absolute', inset: 0 })}>{point.no}</span>
                    </div>
                    <h3 style={{ margin: 0, fontSize: m ? 21 : 'clamp(24px,2.8vw,34px)', fontWeight: 900, lineHeight: m ? 1.45 : 1.4 }}>
                        {point.title.map((line, i) => (
                            <Rise key={line} delay={0.15 + i * 0.1} own={false}>{line}</Rise>
                        ))}
                    </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: m ? 12 : 14, fontSize: m ? 14 : 15, lineHeight: m ? 1.9 : 1.95, color: MW.ink3 }}>
                    {point.body.map((text, i) => (
                        <p key={text} data-ab-trigger="" className="mw-about-fx mw-about-fx--fade" style={fx(0.4 + i * 0.12, { margin: 0 }, { y: 24 })}>{text}</p>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function AboutPromise({ m }: SectionProps) {
    return (
        <section style={{ ...COLUMN, padding: m ? '72px 20px 0' : 'clamp(96px,11vw,150px) 24px 0', display: 'flex', flexDirection: 'column' }}>
            <div data-ab-trigger="" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                <span className="mw-about-fx mw-about-fx--fade" style={fx(0, { fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', color: MW.mintDeep }, { y: 12 })}>{ABOUT_COPY.promiseEyebrow}</span>
                <h2 style={{ margin: 0, fontSize: m ? 24 : 'clamp(28px,3.2vw,40px)', fontWeight: 900 }}>
                    <Rise delay={0.1} own={false}>{ABOUT_COPY.promiseTitle}</Rise>
                </h2>
                <span aria-hidden="true" className="mw-about-fx mw-about-fx--bar" style={fx(0.3, { display: 'block', width: 64, height: 3, borderRadius: 2, background: MW.mint })} />
            </div>
            {ABOUT_POINTS.map((point) => (
                <PromisePoint key={point.no} m={m} point={point} />
            ))}
        </section>
    );
}

/**
 * Closing call to action. The design has the estimate and tour-list buttons; the KakaoTalk button is
 * an addition, so on phones the buttons stretch to fill their rows instead of wrapping raggedly.
 */
export function AboutCta({ m }: SectionProps) {
    const grow: CSSProperties | undefined = m ? { flex: '1 1 auto', padding: '0 16px' } : undefined;
    return (
        <section style={{ ...COLUMN, padding: m ? '24px 20px 40px' : 'clamp(48px,6vw,80px) 24px 104px' }}>
            <div className="mw-about-fx mw-about-fx--panel" style={fx(0, { position: 'relative', overflow: 'hidden', borderRadius: 32, background: 'linear-gradient(135deg,#0F2A3B 0%,#1C8571 100%)', padding: m ? '28px 22px' : '44px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, flexWrap: 'wrap', color: WHITE })}>
                <span aria-hidden="true" className="mw-about-orb" />
                <div style={{ position: 'relative', flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: MW.mintLight }}>{ABOUT_COPY.ctaEyebrow}</span>
                    <h2 style={{ margin: 0, fontSize: m ? 20 : 'clamp(22px,2.4vw,28px)', fontWeight: 900, lineHeight: m ? 1.45 : 1.4 }}>
                        {ABOUT_COPY.ctaTitle.map((phrase) => (
                            <span key={phrase} style={{ display: 'inline-block' }}>{phrase}</span>
                        ))}
                    </h2>
                </div>
                <div style={{ position: 'relative', display: 'flex', gap: 10, flexWrap: 'wrap', width: m ? '100%' : undefined }}>
                    <Link to="/custom-estimate" className="mw-about-btn mw-about-btn--solid" style={grow}>
                        {ABOUT_COPY.ctaQuote}
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={MW.navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    </Link>
                    <Link to="/products" className="mw-about-btn" style={grow}>{ABOUT_COPY.ctaTours}</Link>
                    <a href={KAKAO_CHANNEL_CHAT_URL} target="_blank" rel="noopener noreferrer" className="mw-about-btn" style={grow}>{ABOUT_COPY.ctaKakao}</a>
                </div>
            </div>
        </section>
    );
}
