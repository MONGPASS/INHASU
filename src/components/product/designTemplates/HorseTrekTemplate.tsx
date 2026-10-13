import { ResponsiveProductImage } from '../../common/ResponsiveProductImage';
import React from 'react';
import { toJaDestinationName } from './mapDestinations';
import type { DesignTemplateProps } from './types';
import type { DesignSectionInstance } from '../../../types/product';
import { horseTrekSectionDefs } from './horseTrekFields';
import { scopedKey, suffixOf } from './sections';

/**
 * 「몽골 승마 트레킹 상세페이지」 — Claude Design(몽골 승마 트레킹 상세페이지.dc.html)을
 * React로 이식한 860px 고정폭 롱폼 디자인.
 * 모든 문구/사진은 horseTrekFields.ts 매니페스트의 key로 편집 가능하다.
 * 화면 표시는 ScaledDesign이 컨테이너 폭에 맞춰 축소한다.
 */

const MINT = '#06C4A0';
const DEEP = '#00332E';
const TEAL = '#029F85';

/** 빈 값이면 매니페스트 default가 이미 병합돼 들어온다(v getter). */
function Slot({ k, src, label, editing, alt, contain }: { k?: string; src: string; label: string; editing?: boolean; alt: string; contain?: boolean }) {
    if (src) {
        return <ResponsiveProductImage data-df={k} src={src} alt={alt} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: contain ? 'contain' : 'cover' }} loading="lazy" decoding="async" />;
    }
    if (editing) {
        return (
            <div data-df={k} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(2,159,133,0.55)', borderRadius: 'inherit', color: TEAL, fontSize: 17, fontWeight: 700, textAlign: 'center', padding: 12, boxSizing: 'border-box', background: 'rgba(6,196,160,0.06)' }}>
                {label}
            </div>
        );
    }
    return null;
}

/** \n 줄바꿈을 그대로 표시하는 문단 */
function Lines({ k, text, style }: { k?: string; text: string; style?: React.CSSProperties }) {
    return <div data-df={k} style={{ whiteSpace: 'pre-line', ...style }}>{text}</div>;
}

/** 줄 단위 목록 — 각 줄을 개별 div로 (gap 적용) */
function LineList({ k, text, style, itemStyle }: { k?: string; text: string; style?: React.CSSProperties; itemStyle?: React.CSSProperties }) {
    const items = text.split('\n').map(s => s.trim()).filter(Boolean);
    return (
        <div data-df={k} style={style}>
            {items.map((t, i) => <div key={i} style={itemStyle}>{t}</div>)}
        </div>
    );
}

/** 슬라이더 하단 페이지 도트 (정적 표시 — 실제 스크롤은 마우스/트랙패드로) */
function Dots({ count, hint }: { count: number; hint?: string }) {
    return (
        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            {Array.from({ length: count }, (_, i) => (
                <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: i === 0 ? MINT : '#D5E7E1' }} />
            ))}
            {hint && <div style={{ marginLeft: 8, fontSize: 19, fontWeight: 700, color: '#8a8a8a', letterSpacing: '-0.03em' }}>{hint}</div>}
        </div>
    );
}

/**
 * 섹션 렌더러 팩토리 — 관리자가 정한 인스턴스 목록에 따라
 * 해당 섹션을 건너뛰거나(삭제) 여러 번(복제) 렌더링한다.
 * 복제본에는 접미사가 붙은 key를 읽는 v를 넘겨 값이 섞이지 않게 한다.
 * (컴포넌트가 아니라 함수 — 렌더마다 새 컴포넌트를 만들면 입력 포커스가 끊긴다)
 */
function makeS(v: (k: string) => string, instances: DesignSectionInstance[]) {
    return (id: string, render: (v: (k: string) => string, idx: number) => React.ReactNode) =>
        instances.filter(inst => inst.def === id).map((inst, idx) => {
            const sv = inst.id === inst.def ? v : (k: string) => v(scopedKey(k, inst.id));
            return <div key={inst.id} data-df-scope={suffixOf(inst.id)}>{render(sv, idx)}</div>;
        });
}

export default function HorseTrekTemplate({ v, editing, instances }: DesignTemplateProps) {
    const list = instances ?? horseTrekSectionDefs.map(s => ({ id: s.id, def: s.id }));
    const S = makeS(v, list);

    return (
        <div className="ht-design" style={{ width: 860, margin: '0 auto', background: '#fff', color: '#2b2b2b', overflow: 'hidden', fontFamily: '"Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", -apple-system, sans-serif', WebkitFontSmoothing: 'antialiased' }}>
            <style>{`
                .ht-design .ht-scroll::-webkit-scrollbar { display: none; }
                @keyframes htBgCycle {
                    0% { opacity:1; } 28% { opacity:1; } 38% { opacity:0; }
                    90% { opacity:0; } 100% { opacity:1; }
                }
                @keyframes htShoot {
                    0% { top:-180px; opacity:0; }
                    8% { opacity:1; }
                    34% { opacity:0.9; }
                    40% { top:100%; opacity:0; }
                    100% { top:100%; opacity:0; }
                }
                @keyframes htDayPulse {
                    0%,100% { box-shadow:0 0 0 4px rgba(255,255,255,0.45); }
                    50% { box-shadow:0 0 0 14px rgba(6,196,160,0.25); }
                }
                @keyframes htMealMarquee { from { transform:translateX(0); } to { transform:translateX(-50%); } }
                /* 일본어·한국어 줄바꿈 품질 — 금칙처리(line-break:strict)로 촉음·구두점이
                   줄 첫머리에 오지 않게 한다. 한국어 라벨처럼 띄어쓰기가 있는 곳만
                   개별적으로 keep-all을 준다(단어 중간이 끊기지 않도록).
                   text-wrap:pretty/balance는 마지막 줄에 한 글자만 남는 것을 막는다. */
                .ht-design {
                    word-break: keep-all;
                    overflow-wrap: break-word;
                    line-break: strict;
                }
                .ht-design * { text-wrap: pretty; }
                .ht-design h1, .ht-design h2, .ht-design h3 { text-wrap: balance; }
                .ht-design .ht-bubble { position:relative; }
                .ht-design .ht-bubble::after {
                    content:''; position:absolute; bottom:-14px; width:0; height:0;
                    border-top:18px solid #F1F1F1;
                }
                .ht-design .ht-bubble.tail-left::after { left:26px; border-right:22px solid transparent; }
                .ht-design .ht-bubble.tail-right::after { right:26px; border-left:22px solid transparent; }
            `}</style>

            {/* ── 01 오프닝 ─────────────────────────────────── */}
            {S('01 오프닝', (v) => {
                const opBgs = [1, 2, 3].map(n => ({ n, src: v(`op_bg${n}`) })).filter(o => o.src);
                return (
                <section style={{ position: 'relative', height: 1080, overflow: 'hidden', background: DEEP }}>
                    {opBgs.length > 0 ? opBgs.map((o, i) => (
                        <ResponsiveProductImage key={o.n} data-df={`op_bg${o.n}`} src={o.src} alt="" style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                            filter: 'brightness(0.42) saturate(0.85) hue-rotate(-6deg)',
                            opacity: i === 0 ? 1 : 0,
                            animation: opBgs.length > 1 ? `htBgCycle 21s ease-in-out ${-(21 / opBgs.length) * i}s infinite` : undefined,
                        }} loading="lazy" decoding="async" />
                    )) : (editing && (
                        <div data-df="op_bg1" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 20, fontWeight: 700 }}>
                            오프닝 배경 사진 1~3을 업로드하세요
                        </div>
                    ))}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,51,46,0.78) 0%, rgba(0,51,46,0.18) 45%, rgba(0,30,26,0.88) 100%)' }} />
                    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '150px 0 70px', boxSizing: 'border-box' }}>
                        <div style={{ fontSize: 34, fontWeight: 500, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.62)' }}><span data-df="op_line1">{v('op_line1')}</span></div>
                        <div style={{ position: 'relative', overflow: 'hidden', width: 1, flex: 1, margin: '26px 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.15))' }}>
                            <div style={{ position: 'absolute', left: -1, width: 3, height: 170, borderRadius: 2, background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 70%, #fff 100%)', boxShadow: '0 0 14px rgba(255,255,255,0.75)', animation: 'htShoot 3.4s cubic-bezier(.55,.06,.2,1) infinite' }} />
                        </div>
                        <div style={{ fontSize: 74, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff', textShadow: '0 4px 30px rgba(0,0,0,0.5)' }}><span data-df="op_line2">{v('op_line2')}</span></div>
                        <div style={{ marginTop: 'auto', paddingTop: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontStyle: 'italic', fontWeight: 800, lineHeight: 1.05, color: '#fff', letterSpacing: '0.02em' }}>
                            <div style={{ fontSize: 26 }}>MONGOLIA</div>
                            <div style={{ fontSize: 26 }}>MILKY WAY</div>
                            <div style={{ marginTop: 8, width: 120, height: 1, background: 'rgba(255,255,255,0.5)' }} />
                        </div>
                    </div>
                </section>
                );
            })}

            {/* ── 02 별하늘 히어로 ──────────────────────────── */}
            {S('02 별하늘 히어로', (v) => (
                <section style={{ position: 'relative', background: '#02100E', overflow: 'hidden' }}>
                    <div style={{ position: 'relative', height: 960, overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', inset: 0, background: '#02100E' }}>
                            <Slot k="hero_bg" src={v('hero_bg')} label="은하수 아래 게르 (야경 사진)" editing={editing} alt="은하수 아래 게르" />
                        </div>
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(2,16,14,0.86) 0%, rgba(2,16,14,0.5) 34%, rgba(2,16,14,0.12) 58%, rgba(2,16,14,0.4) 100%)' }} />
                        <div style={{ position: 'relative', padding: '96px 60px 0', textAlign: 'center' }}>
                            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.86)' }}><span data-df="hero_kicker">{v('hero_kicker')}</span></div>
                            <h2 style={{ margin: '40px 0 0', fontSize: 82, lineHeight: 1.14, fontWeight: 800, letterSpacing: '-0.04em', color: '#fff' }}><span data-df="hero_title">{v('hero_title')}</span></h2>
                            <Lines k="hero_body" text={v('hero_body')} style={{ margin: '44px 0 0', fontSize: 26, lineHeight: 1.75, fontWeight: 600, letterSpacing: '-0.015em', color: 'rgba(255,255,255,0.8)', textShadow: '0 2px 18px rgba(0,0,0,0.5)' }} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, background: '#02100E' }}>
                        <div style={{ position: 'relative', height: 290, overflow: 'hidden', background: '#061F1B' }}>
                            <Slot k="hero_img1" src={v('hero_img1')} label="밤 캠프 사진" editing={editing} alt="밤의 캠프" />
                        </div>
                        <div style={{ position: 'relative', height: 290, overflow: 'hidden', background: '#061F1B' }}>
                            <Slot k="hero_img2" src={v('hero_img2')} label="별 관측 사진" editing={editing} alt="별밤 감상" />
                            <div style={{ position: 'absolute', right: 26, bottom: 22, pointerEvents: 'none', fontStyle: 'italic', fontWeight: 800, lineHeight: 1.05, fontSize: 20, color: 'rgba(255,255,255,0.9)', textAlign: 'right', letterSpacing: '0.02em' }}>
                                <div>MONGOLIA</div>
                                <div>MILKY WAY</div>
                            </div>
                        </div>
                    </div>
                </section>
            ))}

            {/* ── 03 소개 배너 ──────────────────────────────── */}
            {S('03 소개 배너', (v) => (
                <section style={{ position: 'relative', height: 1000, overflow: 'hidden', background: DEEP }}>
                    <Slot k="intro_bg" src={v('intro_bg')} label="산맥 아래 초원 사진" editing={editing} alt="산맥 아래 초원" />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(100deg, rgba(0,51,46,0.78) 0%, rgba(0,51,46,0.46) 60%, rgba(0,51,46,0.24) 100%)' }} />
                    <div style={{ position: 'relative', padding: '120px 70px', color: '#fff' }}>
                        <h2 style={{ margin: 0, fontSize: 62, lineHeight: 1.05, fontWeight: 800, letterSpacing: '-0.045em', textShadow: '0 3px 20px rgba(0,0,0,0.3)' }}><span data-df="intro_title">{v('intro_title')}</span></h2>
                        <Lines k="intro_body" text={v('intro_body')} style={{ margin: '38px 0 0', fontSize: 29, lineHeight: 1.62, fontWeight: 600, letterSpacing: '-0.02em', textShadow: '0 2px 14px rgba(0,0,0,0.35)', textWrap: 'pretty' } as React.CSSProperties} />
                    </div>
                </section>
            ))}

            {/* ── 04 이용자 특전 ────────────────────────────── */}
            {S('04 이용자 특전', (v) => (
                <section style={{ background: '#fff', padding: '100px 40px 110px' }}>
                    <h2 style={{ margin: 0, textAlign: 'center', fontSize: 51, fontWeight: 800, letterSpacing: '-0.05em', color: DEEP }}><span data-df="perks_title">{v('perks_title')}</span></h2>
                    <div style={{ margin: '22px 0 0', textAlign: 'center', fontSize: 24, fontWeight: 600, color: '#5a5a5a', letterSpacing: '-0.02em' }}><span data-df="perks_sub">{v('perks_sub')}</span></div>
    
                    <div style={{ marginTop: 56, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
                        {[1, 2, 3, 4, 5, 6].map(n => (
                            <div key={n} style={{ position: 'relative', height: 250, borderRadius: 20, overflow: 'hidden', background: '#EFFEF9' }}>
                                <Slot k={`perk${n}_img`} src={v(`perk${n}_img`)} label={`특전 ${n} 사진`} editing={editing} alt={v(`perk${n}_title`)} />
                                <div style={{ position: 'absolute', inset: 'auto 0 0 0', pointerEvents: 'none', padding: '26px 16px 22px', background: 'linear-gradient(180deg, rgba(0,51,46,0) 0%, rgba(0,51,46,0.72) 100%)', textAlign: 'center', color: '#fff' }}>
                                    <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.03em' }}><span data-df={`perk${n}_title`}>{v(`perk${n}_title`)}</span></div>
                                    <div style={{ marginTop: 6, fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em' }}><span data-df={`perk${n}_sub`}>{v(`perk${n}_sub`)}</span></div>
                                </div>
                            </div>
                        ))}
                    </div>
    
                </section>
            ))}

            {/* ── 05 여행 고민 (말풍선) ─────────────────────── */}
            {S('05 여행 고민', (v) => (
                <section style={{ background: '#fff', padding: '110px 50px 120px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.04em', color: '#9a9a9a' }}><span data-df="worry_kicker">{v('worry_kicker')}</span></div>
                        <h2 style={{ margin: '14px 0 0', fontSize: 43, fontWeight: 800, letterSpacing: '-0.05em', color: '#2b2b2b' }}><span data-df="worry_title">{v('worry_title')}</span></h2>
                    </div>
                    <div style={{ marginTop: 70, display: 'flex', flexDirection: 'column', gap: 34 }}>
                        {([
                            { key: 'worry1', align: 'center', tail: 'tail-left', max: 620, size: 25 },
                            { key: 'worry2', align: 'flex-start', tail: 'tail-right', max: 660, size: 22 },
                            { key: 'worry3', align: 'flex-start', tail: 'tail-right', max: 640, size: 25 },
                            { key: 'worry4', align: 'flex-end', tail: 'tail-left', max: 680, size: 22 },
                            { key: 'worry5', align: 'center', tail: 'tail-left', max: 600, size: 25 },
                        ] as const).map(b => (
                            <div key={b.key} style={{ display: 'flex', justifyContent: b.align }}>
                                <div className={`ht-bubble ${b.tail}`} data-df={b.key} style={{ maxWidth: b.max, padding: '24px 34px', borderRadius: 22, background: '#F1F1F1', fontSize: b.size, lineHeight: 1.45, fontWeight: 600, letterSpacing: '-0.03em', color: '#3a3a3a', whiteSpace: 'pre-line' }}>
                                    {v(b.key)}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ))}

            {/* ── 06 숙소 ──────────────────────────────────── */}
            {S('06 숙소', (v) => (
                <section style={{ background: '#fff', padding: '100px 40px 96px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 23, fontWeight: 700, color: MINT, letterSpacing: '-0.02em' }}><span data-df="ger_kicker">{v('ger_kicker')}</span></div>
                        <div style={{ marginTop: 14, fontSize: 30, fontWeight: 600, color: '#5a5a5a', letterSpacing: '-0.03em' }}><span data-df="ger_sub">{v('ger_sub')}</span></div>
                        <h2 style={{ margin: '20px 0 0', fontSize: 52, lineHeight: 1.2, fontWeight: 800, letterSpacing: '-0.045em', color: DEEP }}>
                            <div style={{ fontSize: 49 }}><span data-df="ger_title1">{v('ger_title1')}</span></div>
                            <div style={{ color: TEAL }}><span data-df="ger_title2">{v('ger_title2')}</span></div>
                        </h2>
                    </div>
                    <div className="ht-scroll" style={{ marginTop: 52, display: 'flex', gap: 24, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
                        {/* 1페이지 — 고급 게르 */}
                        <div style={{ flex: '0 0 100%', scrollSnapAlign: 'start', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            {[1, 2, 3, 4].map(n => (
                                <div key={n} style={{ position: 'relative', height: 280, borderRadius: 16, overflow: 'hidden', background: '#EFFEF9' }}>
                                    <Slot k={`ger_img${n}`} src={v(`ger_img${n}`)} label={`숙소 사진 ${n}`} editing={editing} alt="고급 게르" />
                                </div>
                            ))}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <Dots count={2} hint={v('ger_hint1')} />
                            </div>
                            <div style={{ gridColumn: '1 / -1', marginTop: 18, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px 40px' }}>
                                {[1, 2, 3].map(n => v(`ger_check${n}`) && (
                                    <div key={n} data-df={`ger_check${n}`} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: DEEP }}>
                                        <div style={{ color: MINT }}>✓</div>
                                        <div>{v(`ger_check${n}`)}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ gridColumn: '1 / -1', marginTop: 20, textAlign: 'center', fontSize: 20, fontWeight: 600, color: '#5a5a5a', letterSpacing: '-0.02em' }}><span data-df="ger_note">{v('ger_note')}</span></div>
                        </div>

                        {/* 2페이지 — 일반 게르 */}
                        <div style={{ flex: '0 0 100%', scrollSnapAlign: 'start', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignContent: 'start' }}>
                            {[1, 2, 3, 4].map(n => (
                                <div key={n} style={{ position: 'relative', height: 280, borderRadius: 16, overflow: 'hidden', background: '#F2F2F2' }}>
                                    <Slot k={`ger_std_img${n}`} src={v(`ger_std_img${n}`)} label={`일반 게르 사진 ${n}`} editing={editing} alt="일반 게르" />
                                    <div style={{ position: 'absolute', left: 14, top: 14, pointerEvents: 'none', padding: '6px 16px', borderRadius: 8, background: 'rgba(43,43,43,0.78)', color: '#fff', fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em' }}>
                                        <span data-df="ger_std_badge">{v('ger_std_badge')}</span>
                                    </div>
                                </div>
                            ))}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <Dots count={2} hint={v('ger_hint2')} />
                            </div>
                            <div style={{ gridColumn: '1 / -1', marginTop: 18, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px 40px' }}>
                                {[1, 2, 3].map(n => v(`ger_std_check${n}`) && (
                                    <div key={n} data-df={`ger_std_check${n}`} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: '#8a8a8a' }}>
                                        <div style={{ color: '#B9B9B9' }}>✕</div>
                                        <div>{v(`ger_std_check${n}`)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            ))}


            {/* ── 14 전용차량 ───────────────────────────────── */}
            {S('14 전용차량', (v) => (
                <section style={{ background: '#fff', padding: '100px 40px 90px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#8a8a8a', letterSpacing: '-0.03em' }}><span data-df="veh_kicker">{v('veh_kicker')}</span></div>
                        <h2 style={{ margin: '18px 0 0', fontSize: 54, lineHeight: 1.22, fontWeight: 800, letterSpacing: '-0.045em', color: DEEP }}>
                            <div><span data-df="veh_title">{v('veh_title')}</span></div>
                            <div style={{ color: TEAL, fontSize: 36 }}><span data-df="veh_sub">{v('veh_sub')}</span></div>
                        </h2>
                        <Lines k="veh_body" text={v('veh_body')} style={{ margin: '30px 0 0', fontSize: 23, lineHeight: 1.7, fontWeight: 600, color: '#5a5a5a', letterSpacing: '-0.025em' }} />
                    </div>

                    <div className="ht-scroll" style={{ margin: '44px -40px 0 0', display: 'flex', alignItems: 'flex-start', gap: 20, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none', padding: '0 40px 14px 0' } as React.CSSProperties}>
                        {[1, 2, 3, 4, 5].map(n => (
                            <div key={n} style={{ flex: '0 0 380px', scrollSnapAlign: 'start', borderRadius: 18, overflow: 'hidden', background: '#EFFEF9' }}>
                                <div style={{ position: 'relative', height: 280, background: '#EFFEF9' }}>
                                    <Slot k={`veh${n}_img`} src={v(`veh${n}_img`)} label={`차량 ${n} 사진`} editing={editing} alt={v(`veh${n}_name`)} />
                                </div>
                                <div style={{ padding: '26px 24px 34px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.035em', color: TEAL }}><span data-df={`veh${n}_name`}>{v(`veh${n}_name`)}</span></div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Dots count={5} hint={v('veh_hint')} />
                    <Lines k="veh_note" text={v('veh_note')} style={{ margin: '44px 0 0', textAlign: 'center', fontSize: 20, lineHeight: 1.65, fontWeight: 600, color: '#5a5a5a', letterSpacing: '-0.02em' }} />
                </section>
            ))}

            {/* ── 15 식사 안내 ──────────────────────────────── */}
            {S('15 식사 안내', (v) => (
                <section style={{ position: 'relative', overflow: 'hidden', padding: '0 0 110px', background: '#fff' }}>
                    <div style={{ position: 'relative', paddingTop: 70, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', width: 'max-content', gap: 22, animation: 'htMealMarquee 26s linear infinite' }}>
                            {[0, 1].flatMap(rep => [1, 2, 3, 4, 5, 6].map(n => (
                                <div key={`${rep}-${n}`} style={{ position: 'relative', flex: '0 0 300px', height: 340, borderRadius: 22, overflow: 'hidden', background: '#123028' }}>
                                    <Slot k={rep === 0 ? `meal_img${n}` : undefined} src={v(`meal_img${n}`)} label={`식사 사진 ${n}`} editing={editing && rep === 0} alt="식사" />
                                </div>
                            )))}
                        </div>
                    </div>

                    <div style={{ position: 'relative', padding: '70px 40px 0', textAlign: 'center' }}>
                        <div style={{ fontSize: 26, fontWeight: 700, color: '#8a8a8a', letterSpacing: '-0.03em' }}><span data-df="meal_kicker">{v('meal_kicker')}</span></div>
                        <h2 style={{ margin: '14px 0 0', fontSize: 54, fontWeight: 800, letterSpacing: '-0.045em', color: DEEP }}>
                            <span data-df="meal_title1" style={{ whiteSpace: 'pre-wrap' }}>{v('meal_title1')}</span>
                            <span data-df="meal_title2" style={{ whiteSpace: 'pre-wrap', color: TEAL }}>{v('meal_title2')}</span>
                        </h2>
                    </div>

                    <div style={{ position: 'relative', padding: '0 40px' }}>
                        <LineList k="meal_points" text={v('meal_points')} style={{ marginTop: 26, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, fontSize: 24, fontWeight: 700, color: '#3a3a3a', letterSpacing: '-0.03em' }} />

                        <div style={{ marginTop: 44 }}>
                            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.04em', color: TEAL }}><span data-df="meal_local_title">{v('meal_local_title')}</span></div>
                            <Lines k="meal_local_body" text={v('meal_local_body')} style={{ marginTop: 16, fontSize: 21, lineHeight: 1.75, fontWeight: 600, color: '#4a4a4a', letterSpacing: '-0.025em' }} />
                        </div>
                        <div style={{ marginTop: 44 }}>
                            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.04em', color: TEAL }}><span data-df="meal_camp_title">{v('meal_camp_title')}</span></div>
                            <Lines k="meal_camp_body" text={v('meal_camp_body')} style={{ marginTop: 16, fontSize: 21, lineHeight: 1.75, fontWeight: 600, color: '#4a4a4a', letterSpacing: '-0.025em' }} />
                        </div>

                        <div className="ht-scroll" style={{ margin: '52px -40px 0 0', display: 'flex', alignItems: 'flex-start', gap: 24, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none', padding: '0 40px 14px 0' } as React.CSSProperties}>
                            {[1, 2].map(n => (
                                <div key={n} style={{ flex: '0 0 100%', scrollSnapAlign: 'start' }}>
                                    <div style={{ position: 'relative', height: 420, borderRadius: 24, overflow: 'hidden', background: '#EFFEF9' }}>
                                        <Slot k={`sp${n}_img`} src={v(`sp${n}_img`)} label={`특별식 ${n} 사진`} editing={editing} alt={v(`sp${n}_title`)} />
                                    </div>
                                    <Dots count={2} hint={v('meal_hint')} />
                                    <LineList k={`sp${n}_tags`} text={v(`sp${n}_tags`)} style={{ marginTop: 26, display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 22, fontWeight: 700, color: TEAL, letterSpacing: '-0.03em' }} />
                                    <div style={{ marginTop: 20 }}>
                                        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: TEAL }}><span data-df={`sp${n}_title`}>{v(`sp${n}_title`)}</span></div>
                                        <Lines k={`sp${n}_body`} text={v(`sp${n}_body`)} style={{ marginTop: 16, fontSize: 21, lineHeight: 1.75, fontWeight: 600, color: '#4a4a4a', letterSpacing: '-0.025em' }} />
                                        <div style={{ marginTop: 20, fontSize: 19, fontWeight: 800, color: TEAL, letterSpacing: '-0.03em' }}><span data-df={`sp${n}_note`}>{v(`sp${n}_note`)}</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            ))}

            {/* ── 07 루트 소개 + 지도 ───────────────────────── */}
            {S('07 루트/지도', (v) => {
                const mapStops = v('map_stops').split('\n').map(s => s.trim()).filter(Boolean).join(';');
                const mapUrl = `/designs/mongolia-map.html?stops=${encodeURIComponent(mapStops)}`;
                const spotCards = v('spot_cards').split('\n').map(s => s.trim()).filter(Boolean).map((line, i) => { const p = line.split('|').map(x => x.trim()); return { i, title: toJaDestinationName(p[0] || ''), img: p[1] || '', offset: i % 2 === 1 }; });
                return (
                <section style={{ position: 'relative', background: 'linear-gradient(180deg, #C8FFEF 0%, #EFFEF9 32%, #EFFEF9 100%)', paddingBottom: 90 }}>
                    <div style={{ padding: '110px 70px 60px', textAlign: 'center' }}>
                        <div style={{ fontSize: 34, color: MINT, letterSpacing: '0.2em' }}>✦</div>
                        <h2 style={{ margin: '18px 0 0', fontSize: 52, lineHeight: 1.32, fontWeight: 800, letterSpacing: '-0.04em', color: '#2b2b2b' }}><span data-df="route_intro_title">{v('route_intro_title')}</span></h2>
                        <Lines k="route_intro_p1" text={v('route_intro_p1')} style={{ margin: '46px 0 0', fontSize: 26, lineHeight: 1.75, fontWeight: 500, color: '#4a4a4a', letterSpacing: '-0.02em' }} />
                        <Lines k="route_intro_p2" text={v('route_intro_p2')} style={{ margin: '38px 0 0', fontSize: 26, lineHeight: 1.75, fontWeight: 500, color: '#4a4a4a', letterSpacing: '-0.02em' }} />
                    </div>
    
                    <div style={{ position: 'relative', height: 420, overflow: 'hidden', background: '#DFFFF4' }}>
                        <Slot k="route_wide_img" src={v('route_wide_img')} label="와이드 사진 (계곡에서 쉬는 일행)" editing={editing} alt="계곡에서 쉬는 일행" />
                    </div>
    
                    <div style={{ margin: '-60px 40px 0', position: 'relative', background: '#fff', borderRadius: 40, boxShadow: '0 24px 60px rgba(0,51,46,0.10)', padding: '70px 56px 76px' }}>
                        <h3 style={{ margin: 0, textAlign: 'center', fontSize: 61, lineHeight: 1.4, fontWeight: 800, letterSpacing: '-0.035em', color: '#2b2b2b' }}><span data-df="route_card_title">{v('route_card_title')}</span></h3>
    
                        <div style={{ margin: '56px 0 64px', display: 'flex', justifyContent: 'center' }}>
                            <iframe data-df="map_stops" src={mapUrl} title="몽골 지도 위 여정 지점" scrolling="no" style={{ width: '100%', maxWidth: 760, aspectRatio: '760/990', border: 0, display: 'block' }} loading="lazy" />
                        </div>
    
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 20 }}>
                            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.035em', color: DEEP }}><span data-df="spots_label">{v('spots_label')}</span></div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: TEAL, letterSpacing: '-0.02em' }}><span data-df="spots_hint">{v('spots_hint')}</span></div>
                        </div>
                        <div className="ht-scroll" style={{ margin: '20px -56px 0 0', display: 'flex', alignItems: 'flex-start', gap: 22, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none', padding: '4px 56px 16px 0' } as React.CSSProperties}>
                            {spotCards.map(c => (
                                <div key={c.i} style={{ flex: '0 0 340px', marginTop: c.offset ? 34 : 0, scrollSnapAlign: 'start', background: '#0B1F1B', borderRadius: 26, overflow: 'hidden' }}>
                                    <div style={{ position: 'relative', height: 420, background: '#123028' }}>
                                        <Slot k="spot_cards" src={c.img} label={`${c.title} 사진`} editing={editing} alt={c.title} />
                                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(11,31,27,0.45) 0%, rgba(11,31,27,0.1) 40%, rgba(11,31,27,0.88) 100%)' }} />
                                        <div style={{ position: 'absolute', left: 24, right: 24, bottom: 26, fontSize: 20, lineHeight: 1.35, fontWeight: 800, letterSpacing: '-0.04em', color: '#fff', textShadow: '0 4px 22px rgba(0,0,0,0.5)' }}><span data-df="spot_cards">{c.title}</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
                );
            })}

            {/* ── 09 고비 히어로 ────────────────────────────── */}
            {S('09 고비 히어로', (v) => (
                <section style={{ position: 'relative', height: 1180, overflow: 'hidden', background: '#0A6558' }}>
                    <div style={{ position: 'absolute', inset: 0, background: '#0E5349' }}>
                        <Slot k="gobi_hero_img" src={v('gobi_hero_img')} label="고비 히어로 배경 사진" editing={editing} alt="고비" />
                    </div>
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.06) 40%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.35) 100%)' }} />
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(6,196,160,0.16) 0%, rgba(0,51,46,0.05) 40%, rgba(6,196,160,0.34) 100%)', mixBlendMode: 'multiply' }} />
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 40, pointerEvents: 'none', padding: '0 46px', color: '#fff' }}>
                        <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
                            <div>MONGOLIA</div>
                            <div>Milky Way</div>
                        </div>
                    </div>
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 88, pointerEvents: 'none', padding: '0 46px', color: '#fff', textAlign: 'center' }}>
                        <div style={{ fontSize: 96, lineHeight: 0.96, fontWeight: 900, letterSpacing: '0.02em', textShadow: '0 6px 30px rgba(0,0,0,0.4)' }}><span data-df="gobi_title">{v('gobi_title')}</span></div>
                        <div style={{ marginTop: 10, fontSize: 52, lineHeight: 1.05, fontWeight: 900, letterSpacing: '0.16em', textShadow: '0 4px 22px rgba(0,0,0,0.4)' }}><span data-df="gobi_title2">{v('gobi_title2')}</span></div>
                        <div style={{ margin: '30px auto 0', maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 20, lineHeight: 1.6, fontWeight: 600, letterSpacing: '-0.01em', textShadow: '0 2px 12px rgba(0,0,0,0.55)' }}>
                            <div data-df="gobi_kicker">{v('gobi_kicker')}</div>
                            <Lines k="gobi_body" text={v('gobi_body')} />
                        </div>
                    </div>
                </section>
            ))}


            {/* ── 10 하이라이트 ─────────────────────────────── */}
            {S('10 하이라이트', (v) => {
                const points = [1, 2, 3, 4, 5].map(n => ({ img: v(`pt${n}_img`), caption: v(`pt${n}_caption`) }));
                return (
                <section style={{ background: '#fff', padding: '96px 60px 100px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                        <div style={{ flex: 1, height: 1, background: '#e6e6e6' }} />
                        <div style={{ flex: '0 0 10px', height: 10, borderRadius: '50%', background: MINT }} />
                        <div style={{ padding: '16px 44px', border: '1px solid #91FEE0', borderRadius: 999, fontSize: 37, fontWeight: 800, letterSpacing: '-0.035em', color: '#2b2b2b' }}><span data-df="hl_title">{v('hl_title')}</span></div>
                        <div style={{ flex: '0 0 10px', height: 10, borderRadius: '50%', background: MINT }} />
                        <div style={{ flex: 1, height: 1, background: '#e6e6e6' }} />
                    </div>
                    <div style={{ marginTop: 22, textAlign: 'right', fontSize: 15, fontWeight: 600, color: TEAL, letterSpacing: '-0.02em' }}><span data-df="hl_hint">{v('hl_hint')}</span></div>
                    <div className="ht-scroll" style={{ margin: '22px -60px 0 0', display: 'flex', alignItems: 'flex-start', gap: 24, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none', padding: '4px 60px 12px 0' } as React.CSSProperties}>
                        {points.map((p, i) => (
                            <div key={i} style={{ flex: '0 0 340px', scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                                <div style={{ position: 'relative', flex: '0 0 250px', height: 250, borderRadius: 28, overflow: 'hidden', background: '#C8FFEF' }}>
                                    <Slot k={`pt${i + 1}_img`} src={p.img} label={`포인트 ${i + 1} 사진`} editing={editing} alt={p.caption} />
                                    <div style={{ position: 'absolute', top: 16, left: 16, pointerEvents: 'none', width: 44, height: 44, borderRadius: '50%', background: MINT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800 }}>{i + 1}</div>
                                </div>
                                <div style={{ marginTop: 20, textAlign: 'center', fontSize: 24, lineHeight: 1.45, letterSpacing: '-0.025em', color: '#3a3a3a' }}><span data-df={`pt${i + 1}_caption`}>{p.caption}</span></div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 88, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                        <div style={{ fontSize: 34, fontWeight: 800, color: MINT, lineHeight: 1 }}>+</div>
                        <div style={{ fontSize: 99, fontWeight: 800, letterSpacing: '-0.04em', color: DEEP }}><span data-df="and_word">{v('and_word')}</span></div>
                        <div style={{ width: 1, height: 88, background: `linear-gradient(180deg, ${MINT}, rgba(6,196,160,0))` }} />
                    </div>
                </section>
                );
            })}

            {/* ── 11 은하수 ─────────────────────────────────── */}
            {S('11 은하수', (v) => (
                <section style={{ position: 'relative', background: '#02100E' }}>
                    <div style={{ position: 'relative', height: 640, overflow: 'hidden', background: '#02100E' }}>
                        <div style={{ position: 'absolute', inset: 0, background: '#0B1F1B' }}>
                            <Slot k="mw_img" src={v('mw_img')} label="은하수 사진" editing={editing} alt="은하수" />
                        </div>
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(2,16,14,0.3) 0%, rgba(2,16,14,0.05) 40%, rgba(2,16,14,0.9) 100%)' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 56, alignItems: 'start', padding: '0 50px 64px', marginTop: -150, position: 'relative' }}>
                        <Lines k="mw_caption" text={v('mw_caption')} style={{ fontSize: 46, lineHeight: 1.32, fontWeight: 800, letterSpacing: '-0.045em', color: '#fff', textShadow: '0 4px 26px rgba(0,0,0,0.5)' }} />
                        <div style={{ paddingTop: 14 }}>
                            <div style={{ width: 54, height: 3, background: '#fff' }} />
                            <LineList k="mw_body" text={v('mw_body')} style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 21, lineHeight: 1.7, fontWeight: 600, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.82)' }} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 6, background: '#02100E', padding: '0 0 6px' }}>
                        {[1, 2, 3, 4].map(n => (
                            <div key={n} style={{ position: 'relative', height: 300, overflow: 'hidden', background: '#0B1F1B' }}>
                                <Slot k={`milky_img${n}`} src={v(`milky_img${n}`)} label={`은하수 사진 ${n}`} editing={editing} alt="은하수" />
                            </div>
                        ))}
                    </div>
                </section>
            ))}


            {/* ── 12 공항 도착 ──────────────────────────────── */}
            {S('12 공항 도착', (v) => (
                <section style={{ background: '#fff', padding: '100px 0 0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.04em', color: '#c9c9c9' }}><span data-df="arr_from">{v('arr_from')}</span></div>
                        <div style={{ marginTop: 22, width: 3, height: 78, background: MINT }} />
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: MINT, boxShadow: '0 0 0 6px rgba(6,196,160,0.22)' }} />
                        <div style={{ marginTop: 34, fontSize: 60, fontWeight: 800, letterSpacing: '-0.05em', color: DEEP }}><span data-df="arr_to">{v('arr_to')}</span></div>
                    </div>
    
                    <div style={{ marginTop: 56, position: 'relative', height: 520, background: '#EFFEF9' }}>
                        <Slot k="arr_img" src={v('arr_img')} label="칭기스칸 공항 사진" editing={editing} alt="칭기스칸 국제공항" />
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.55) 18%, rgba(255,255,255,0) 42%, rgba(255,255,255,0) 62%, rgba(255,255,255,0.7) 88%, #fff 100%)' }} />
                    </div>
    
                    <div style={{ padding: '0 60px' }}>
                        <Lines k="arr_lead" text={v('arr_lead')} style={{ textAlign: 'center', fontSize: 35, fontWeight: 700, letterSpacing: '-0.03em', color: '#2b2b2b' }} />
                        <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
                            <Lines k="arr_body" text={v('arr_body')} style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.035em', color: '#2b2b2b', textAlign: 'center' }} />
                        </div>
                    </div>
    
                    <div style={{ marginTop: 56, padding: '44px 60px', background: '#C8FFEF', textAlign: 'center' }}>
                        <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.035em', color: DEEP }}><span data-df="arr_band1">{v('arr_band1')}</span></div>
                        <div style={{ marginTop: 12, fontSize: 21, fontWeight: 700, letterSpacing: '-0.035em', color: '#0A6558' }}><span data-df="arr_band2">{v('arr_band2')}</span></div>
                    </div>
    
                    <div style={{ padding: '70px 60px 100px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 20 }}>
                            <div style={{ position: 'relative', flex: '0 1 470px', minWidth: 0, height: 430, background: '#EFFEF9', borderRadius: 6, overflow: 'hidden' }}>
                                <Slot k="welcome_img" src={v('welcome_img')} label="픽업기사 웰컴카드 사진" editing={editing} alt="웰컴 보드" />
                            </div>
                            <div style={{ flex: '0 0 280px', paddingTop: 96, color: MINT }}>
                                <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}><span data-df="welcome_w1">{v('welcome_w1')}</span></div>
                                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ fontSize: 74, fontWeight: 900, letterSpacing: '-0.06em', lineHeight: 0.9, textTransform: 'uppercase' }}><span data-df="welcome_w2">{v('welcome_w2')}</span></div>
                                    <div style={{ flex: 1, height: 56, background: MINT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 8px' }}>
                                        {[1, 2, 3].map(n => (
                                            <div key={n} style={{ position: 'relative', flex: 1, height: 44 }}>
                                                <Slot k={`mn_icon${n}`} src={v(`mn_icon${n}`)} label="아이콘" editing={editing} alt="" contain />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ marginTop: 6, fontSize: 47, fontWeight: 900, letterSpacing: '-0.055em', lineHeight: 0.95, textTransform: 'uppercase' }}><span data-df="welcome_w3">{v('welcome_w3')}</span></div>
                                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ flex: 1, height: 44, background: MINT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 8px' }}>
                                        {[4, 5, 6].map(n => (
                                            <div key={n} style={{ position: 'relative', flex: 1, height: 34 }}>
                                                <Slot k={`mn_icon${n}`} src={v(`mn_icon${n}`)} label="아이콘" editing={editing} alt="" contain />
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: MINT }} />
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: 34, textAlign: 'center', fontSize: 27, lineHeight: 1.5, fontWeight: 700, letterSpacing: '-0.035em', color: '#2b2b2b' }}><span data-df="welcome_caption">{v('welcome_caption')}</span></div>
                    </div>
                </section>
            ))}

            
            {/* ── 16 여행의 순간들 ──────────────────────────── */}
            {S('16 여행의 순간들', (v) => (
                <section style={{ background: '#fff', padding: '100px 40px 110px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ position: 'relative', height: 520, borderRadius: 16, overflow: 'hidden', background: '#EFFEF9' }}>
                                <Slot k="moment_img1" src={v('moment_img1')} label="절벽 위 인생샷" editing={editing} alt="" />
                            </div>
                            <div style={{ position: 'relative', height: 330, borderRadius: 16, overflow: 'hidden', background: '#EFFEF9' }}>
                                <Slot k="moment_img2" src={v('moment_img2')} label="캠프파이어" editing={editing} alt="" />
                            </div>
                            <Lines k="moment_text1" text={v('moment_text1')} style={{ padding: '36px 4px 30px', fontSize: 38, lineHeight: 1.26, fontWeight: 900, letterSpacing: '-0.045em', color: '#CFE3DC' }} />
                            <div style={{ position: 'relative', height: 430, borderRadius: 16, overflow: 'hidden', background: '#EFFEF9' }}>
                                <Slot k="moment_img3" src={v('moment_img3')} label="샌드보딩" editing={editing} alt="" />
                            </div>
                            <div style={{ position: 'relative', height: 300, borderRadius: 16, overflow: 'hidden', background: '#EFFEF9' }}>
                                <Slot k="moment_img4" src={v('moment_img4')} label="허르헉 조리" editing={editing} alt="" />
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <Lines k="moment_text2" text={v('moment_text2')} style={{ padding: '44px 4px 34px', textAlign: 'right', fontSize: 56, lineHeight: 1.2, fontWeight: 900, letterSpacing: '-0.05em', color: '#CFE3DC' }} />
                            <div style={{ position: 'relative', height: 470, borderRadius: 16, overflow: 'hidden', background: '#EFFEF9' }}>
                                <Slot k="moment_img5" src={v('moment_img5')} label="낙타 트레킹" editing={editing} alt="" />
                            </div>
                            <div style={{ position: 'relative', height: 300, borderRadius: 16, overflow: 'hidden', background: '#EFFEF9' }}>
                                <Slot k="moment_img6" src={v('moment_img6')} label="양털 기념품" editing={editing} alt="" />
                            </div>
                            <div style={{ position: 'relative', height: 420, borderRadius: 16, overflow: 'hidden', background: '#EFFEF9' }}>
                                <Slot k="moment_img7" src={v('moment_img7')} label="단체 점프" editing={editing} alt="" />
                            </div>
                            <div style={{ position: 'relative', height: 340, borderRadius: 16, overflow: 'hidden', background: '#EFFEF9' }}>
                                <Slot k="moment_img8" src={v('moment_img8')} label="별 관측" editing={editing} alt="" />
                            </div>
                        </div>
                    </div>
                </section>
            ))}

            {/* ── 17 포함/불포함 ────────────────────────────── */}
            {S('17 포함/불포함', (v) => (
                <section style={{ position: 'relative', overflow: 'hidden', background: DEEP, padding: '0 0 80px' }}>
                    <div style={{ position: 'absolute', inset: 0, background: '#0A6558' }}>
                        <Slot k="notice_bg" src={v('notice_bg')} label="초원 배경 사진" editing={editing} alt="초원" />
                    </div>
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(0,51,46,0.62) 0%, rgba(0,51,46,0.42) 45%, rgba(0,51,46,0.7) 100%)' }} />
                    <div style={{ position: 'relative', padding: '86px 40px 0', textAlign: 'center' }}>
                        <h2 style={{ margin: 0, fontSize: 96, lineHeight: 1, fontWeight: 900, letterSpacing: '-0.04em', color: MINT, textShadow: '0 6px 30px rgba(0,0,0,0.35)' }}><span data-df="notice_title">{v('notice_title')}</span></h2>
                        <div style={{ marginTop: 18, fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.85)' }}><span data-df="notice_sub">{v('notice_sub')}</span></div>
                    </div>
                    <div style={{ position: 'relative', margin: '52px 50px 0', background: '#fff', padding: '48px 52px 52px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ flex: '0 0 34px', height: 34, borderRadius: '50%', background: MINT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800 }}>✓</div>
                            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.035em', color: '#2b2b2b' }}><span data-df="inc_title">{v('inc_title')}</span></div>
                        </div>
                        <LineList k="inc_items" text={v('inc_items')} style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 13, fontSize: 22, lineHeight: 1.45, fontWeight: 600, color: '#3a3a3a', letterSpacing: '-0.025em' }} />
                        <div style={{ margin: '38px 0', height: 1, background: '#e2e2e2' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ flex: '0 0 34px', height: 34, borderRadius: '50%', background: '#C2B8A3', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 800 }}>✕</div>
                            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.035em', color: '#2b2b2b' }}><span data-df="exc_title">{v('exc_title')}</span></div>
                        </div>
                        <LineList k="exc_items" text={v('exc_items')} style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 13, fontSize: 22, lineHeight: 1.45, fontWeight: 600, color: '#3a3a3a', letterSpacing: '-0.025em' }} />
                    </div>
                </section>
            ))}

            {/* ── 18 투어 가격 ──────────────────────────────── */}
            {S('18 투어 가격', (v) => {
                // 원화 금액(7자리, `2,000,000원`)이 잔금 칸에서 줄바꿈되지 않도록 인원 칸을 조금 줄이고 잔금 칸을 넓힌다
                const cols = 'minmax(0,0.9fr) minmax(0,1.1fr) minmax(0,1.1fr) minmax(0,1.9fr)';
                const head = v('price_head').split('|').map(x => x.trim());
                const rows = v('price_rows').split('\n').map(x => x.trim()).filter(Boolean).map(r => r.split('|').map(c => c.trim()));
                return (
                <section style={{ background: '#EFFEF9', padding: '70px 40px 110px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 26, fontWeight: 700, color: '#5a5a5a', letterSpacing: '-0.03em' }}><span data-df="price_kicker">{v('price_kicker')}</span></div>
                        <h2 style={{ margin: '14px 0 0', fontSize: 56, fontWeight: 800, letterSpacing: '-0.05em', color: DEEP }}><span data-df="price_title">{v('price_title')}</span></h2>
                    </div>
                    <div style={{ marginTop: 44, borderRadius: 20, overflow: 'hidden', background: '#fff' }}>
                        <div data-df="price_head" style={{ display: 'grid', gridTemplateColumns: cols, background: DEEP, color: '#fff', fontSize: 21, fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center' }}>
                            {head.map((h, i) => <div key={i} style={{ padding: '20px 8px' }}>{h}</div>)}
                        </div>
                        <div data-df="price_rows">
                            {rows.map((r, i) => (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'center', textAlign: 'center', padding: '22px 0', borderBottom: i === rows.length - 1 ? undefined : '1px solid #F0F0F0' }}>
                                    {r.map((c, j) => <div key={j} style={{ fontSize: 26, fontWeight: 800, color: j === r.length - 1 ? TEAL : '#2b2b2b' }}>{c}</div>)}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div style={{ marginTop: 36, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px 24px' }}>
                        {[1, 2].map(n => (
                            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ padding: '8px 20px', borderRadius: 999, background: DEEP, color: '#fff', fontSize: 19, fontWeight: 800, letterSpacing: '-0.03em' }}><span data-df={`price_tag${n}`}>{v(`price_tag${n}`)}</span></div>
                                <div style={{ fontSize: 20, fontWeight: 600, color: '#4a4a4a', letterSpacing: '-0.025em' }}><span data-df={`price_tag${n}_desc`}>{v(`price_tag${n}_desc`)}</span></div>
                            </div>
                        ))}
                    </div>
                    <div style={{ position: 'relative', marginTop: 56, height: 320, borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
                        <Slot k="price_img" src={v('price_img')} label="사막 낙타 사진" editing={editing} alt="낙타" />
                    </div>
                </section>
                );
            })}

            {/* ── 19 예약 전 확인사항 ───────────────────────── */}
            {S('19 예약 전 확인사항', (v) => {
                const gtCols = 'minmax(0,1fr) minmax(0,1.3fr) minmax(0,1.8fr)';
                const gtHead = v('gt_head').split('|').map(x => x.trim());
                return (
                <section style={{ background: '#fff', padding: '100px 50px 110px' }}>
                    <h2 style={{ margin: 0, textAlign: 'center', fontSize: 46, fontWeight: 800, letterSpacing: '-0.045em', color: '#2b2b2b' }}><span data-df="terms_title">{v('terms_title')}</span></h2>

                    <div style={{ marginTop: 58 }}>
                        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.035em', color: DEEP }}><span data-df="cancel_title">{v('cancel_title')}</span></div>
                        <LineList k="cancel_body" text={v('cancel_body')} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16, fontSize: 21, lineHeight: 1.6, fontWeight: 600, color: '#3a3a3a', letterSpacing: '-0.025em' }} />
                        <LineList k="cancel_box" text={v('cancel_box')} style={{ marginTop: 26, padding: '24px 30px', background: '#EFFEF9', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 21, fontWeight: 800, color: DEEP, letterSpacing: '-0.03em' }} />
                    </div>

                    <div style={{ marginTop: 56 }}>
                        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.035em', color: DEEP }}><span data-df="tour_title">{v('tour_title')}</span></div>
                        <LineList k="tour_body" text={v('tour_body')} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 18, fontSize: 18, lineHeight: 1.75, fontWeight: 600, color: '#3a3a3a', letterSpacing: '-0.025em' }} />
                        <div style={{ marginTop: 30, padding: '22px 0', background: '#111', textAlign: 'center', fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}><span data-df="tour_banner">{v('tour_banner')}</span></div>
                    </div>

                    <div style={{ marginTop: 56 }}>
                        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.035em', color: DEEP }}><span data-df="gerstay_title">{v('gerstay_title')}</span></div>
                        <div style={{ marginTop: 20, fontSize: 21, lineHeight: 1.6, fontWeight: 600, color: '#3a3a3a', letterSpacing: '-0.025em' }}>
                            <div>· <span data-df="gerstay_lead" style={{ color: TEAL, fontWeight: 800 }}>{v('gerstay_lead')}</span></div>
                            <Lines k="gerstay_body" text={v('gerstay_body')} style={{ paddingLeft: 16 }} />
                        </div>
                        <div style={{ marginTop: 40, border: '1px solid #E4EFEA', borderRadius: 14, overflow: 'hidden' }}>
                            <div data-df="gt_head" style={{ display: 'grid', gridTemplateColumns: gtCols, background: '#edf6f3', textAlign: 'center', fontSize: 21, fontWeight: 800, color: '#2b2b2b', letterSpacing: '-0.03em' }}>
                                {gtHead.map((h, i) => <div key={i} style={{ padding: '16px 10px' }}>{h}</div>)}
                            </div>
                            {[1, 2, 3, 4].map((n, i) => (
                                <div key={n} style={{ display: 'grid', gridTemplateColumns: gtCols, alignItems: 'center', borderBottom: i === 3 ? undefined : '1px solid #EFEFEF' }}>
                                    <Lines k={`gt${n}_name`} text={v(`gt${n}_name`)} style={{ padding: '20px 10px', textAlign: 'center', fontSize: 20, fontWeight: 800, color: '#2b2b2b', letterSpacing: '-0.03em' }} />
                                    <div style={{ padding: '14px 16px' }}>
                                        <div style={{ position: 'relative', height: 120, borderRadius: 8, overflow: 'hidden', background: '#EFFEF9' }}>
                                            <Slot k={`gt${n}_img`} src={v(`gt${n}_img`)} label="사진" editing={editing} alt="게르" />
                                        </div>
                                    </div>
                                    <Lines k={`gt${n}_spec`} text={v(`gt${n}_spec`)} style={{ padding: '18px 20px', fontSize: 19, lineHeight: 1.65, fontWeight: 600, color: '#3a3a3a', letterSpacing: '-0.025em' }} />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginTop: 56 }}>
                        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.035em', color: DEEP }}><span data-df="animal_title">{v('animal_title')}</span></div>
                        <LineList k="animal_body" text={v('animal_body')} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16, fontSize: 21, lineHeight: 1.6, fontWeight: 600, color: '#3a3a3a', letterSpacing: '-0.025em' }} />
                    </div>
                </section>
                );
            })}

            {/* ── 20 FAQ ────────────────────────────────────── */}
            {S('20 FAQ', (v) => (
                <section style={{ background: '#EFFEF9', padding: '90px 50px 110px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 64, fontWeight: 900, letterSpacing: '-0.04em', color: MINT }}><span data-df="faq_title">{v('faq_title')}</span></div>
                        <div style={{ marginTop: 4, fontSize: 34, fontWeight: 800, letterSpacing: '-0.04em', color: '#2b2b2b' }}><span data-df="faq_sub">{v('faq_sub')}</span></div>
                    </div>
                    <div style={{ marginTop: 44, border: '1px solid #CFEFE3', borderRadius: 26, background: '#fff', padding: '46px 46px 50px' }}>
                        {[1, 2, 3, 4, 5].map((n, i) => (
                            <React.Fragment key={n}>
                                {i > 0 && <div style={{ margin: '36px 0', height: 1, background: '#E8F3EE' }} />}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                                    <div style={{ flex: '0 0 40px', height: 40, borderRadius: 10, background: MINT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em' }}>Q.</div>
                                    <div style={{ fontSize: 23, lineHeight: 1.45, fontWeight: 800, letterSpacing: '-0.03em', color: TEAL, paddingTop: 6 }}><span data-df={`faq${n}_q`}>{v(`faq${n}_q`)}</span></div>
                                </div>
                                <Lines k={`faq${n}_a`} text={v(`faq${n}_a`)} style={{ margin: '18px 0 0 56px', fontSize: 20, lineHeight: 1.65, fontWeight: 600, color: '#5a5a5a', letterSpacing: '-0.025em' }} />
                            </React.Fragment>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
