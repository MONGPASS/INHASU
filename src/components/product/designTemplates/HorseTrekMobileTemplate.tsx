import { ResponsiveProductImage } from '../../common/ResponsiveProductImage';
import React from 'react';
import { toJaDestinationName } from './mapDestinations';
import type { DesignTemplateProps } from './types';
import type { DesignSectionInstance } from '../../../types/product';
import { horseTrekSectionDefs } from './horseTrekFields';
import { scopedKey, suffixOf } from './sections';

/**
 * 「몽골 승마 트레킹 상세페이지 (모바일 v3)」 — Claude Design
 * (몽골 승마 트레킹 상세페이지 (모바일 v3).dc.html)을 React로 이식한 430px 고정폭 디자인.
 * 데스크톱(HorseTrekTemplate)과 같은 필드 매니페스트를 공유하고,
 * 폰트 크기·간격은 디자인 원본 수치를 그대로 사용한다.
 *
 * v3에서 추가된 섹션: 전용차량 / 식사 안내 / 여행의 순간들 / 포함·불포함 /
 * 투어 가격 / 예약 전 확인사항 / FAQ. 숙소는 고급·일반 2페이지 슬라이더가 됐다.
 */

const MINT = '#06C4A0';
const DEEP = '#00332E';
const TEAL = '#029F85';

function Slot({ k, src, label, editing, alt, contain }: { k?: string; src: string; label: string; editing?: boolean; alt: string; contain?: boolean }) {
    if (src) {
        return <ResponsiveProductImage data-df={k} src={src} alt={alt} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: contain ? 'contain' : 'cover' }} loading="lazy" decoding="async" />;
    }
    if (editing) {
        return (
            <div data-df={k} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(2,159,133,0.55)', borderRadius: 'inherit', color: TEAL, fontSize: 11, fontWeight: 700, textAlign: 'center', padding: 6, boxSizing: 'border-box', background: 'rgba(6,196,160,0.06)' }}>
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

/** 슬라이더 하단 페이지 도트 (정적 표시 — 실제 스크롤은 손가락으로) */
function Dots({ count, hint }: { count: number; hint?: string }) {
    return (
        <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {Array.from({ length: count }, (_, i) => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? MINT : '#D5E7E1' }} />
            ))}
            {hint && <div style={{ marginLeft: 4, fontSize: 13, fontWeight: 700, color: '#8a8a8a', letterSpacing: '-0.03em' }}>{hint}</div>}
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

export default function HorseTrekMobileTemplate({ v, editing, instances }: DesignTemplateProps) {
    const list = instances ?? horseTrekSectionDefs.map(s => ({ id: s.id, def: s.id }));
    const S = makeS(v, list);

    return (
        <div className="htm-design" style={{ width: 430, margin: '0 auto', background: '#fff', color: '#2b2b2b', overflow: 'hidden', fontFamily: '"Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", -apple-system, sans-serif', WebkitFontSmoothing: 'antialiased' }}>
            <style>{`
                .htm-design .htm-scroll::-webkit-scrollbar { display: none; }
                @keyframes htmBgCycle {
                    0% { opacity:1; } 30% { opacity:1; } 33.33% { opacity:0; }
                    96.67% { opacity:0; } 100% { opacity:1; }
                }
                @keyframes htmDayPulse {
                    0%,100% { box-shadow:0 0 0 2px rgba(255,255,255,0.45); }
                    50% { box-shadow:0 0 0 7px rgba(6,196,160,0.25); }
                }
                @keyframes htmMealMarquee { from { transform:translateX(0); } to { transform:translateX(-50%); } }
                @keyframes htmShoot {
                    0% { top:-180px; opacity:0; }
                    6% { opacity:1; }
                    82% { opacity:1; }
                    90% { top:100%; opacity:0.9; }
                    100% { top:100%; opacity:0; }
                }
                /* 일본어·한국어 줄바꿈 품질 — 금칙처리(line-break:strict)로 촉음·구두점이
                   줄 첫머리에 오지 않게 한다. 한국어 라벨처럼 띄어쓰기가 있는 곳만
                   개별적으로 keep-all을 준다(단어 중간이 끊기지 않도록).
                   text-wrap:pretty/balance는 마지막 줄에 한 글자만 남는 것을 막는다. */
                .htm-design {
                    word-break: keep-all;
                    overflow-wrap: break-word;
                    line-break: strict;
                }
                .htm-design * { text-wrap: pretty; }
                .htm-design h1, .htm-design h2, .htm-design h3 { text-wrap: balance; }
                .htm-design .htm-bubble { position:relative; }
                .htm-design .htm-bubble::after {
                    content:''; position:absolute; bottom:-7px; width:0; height:0;
                    border-top:9px solid #F1F1F1;
                }
                .htm-design .htm-bubble.tail-left::after { left:13px; border-right:11px solid transparent; }
                .htm-design .htm-bubble.tail-right::after { right:13px; border-left:11px solid transparent; }
            `}</style>

            {/* ── 01 오프닝 ─────────────────────────────────── */}
            {S('01 오프닝', (v) => {
                const opBgs = [1, 2, 3].map(n => ({ n, src: v(`op_bg${n}`) })).filter(o => o.src);
                return (
                <section style={{ position: 'relative', height: 540, overflow: 'hidden', background: DEEP }}>
                    {opBgs.length > 0 ? opBgs.map((o, i) => (
                        <ResponsiveProductImage key={o.n} data-df={`op_bg${o.n}`} src={o.src} alt="" style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                            filter: 'brightness(0.42) saturate(0.85) hue-rotate(-6deg)',
                            opacity: i === 0 ? 1 : 0,
                            animation: opBgs.length > 1 ? `htmBgCycle 21s ease-in-out ${-(21 / opBgs.length) * i}s infinite` : undefined,
                        }} loading="lazy" decoding="async" />
                    )) : (editing && (
                        <div data-df="op_bg1" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 700 }}>
                            오프닝 배경 사진 1~3을 업로드하세요
                        </div>
                    ))}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,51,46,0.78) 0%, rgba(0,51,46,0.18) 45%, rgba(0,30,26,0.88) 100%)' }} />
                    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '75px 0 35px', boxSizing: 'border-box' }}>
                        <div style={{ fontSize: 19, fontWeight: 500, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.62)' }}><span data-df="op_line1">{v('op_line1')}</span></div>
                        <div style={{ position: 'relative', overflow: 'hidden', width: 1, flex: 1, margin: '13px 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.15))' }}>
                            <div style={{ position: 'absolute', left: -1, width: 2, height: 85, borderRadius: 2, background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 70%, #fff 100%)', boxShadow: '0 0 7px rgba(255,255,255,0.75)', animation: 'htmShoot 7s linear infinite' }} />
                        </div>
                        <div style={{ fontSize: 41, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff', textShadow: '0 2px 15px rgba(0,0,0,0.5)' }}><span data-df="op_line2">{v('op_line2')}</span></div>
                        <div style={{ marginTop: 'auto', paddingTop: 55, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontStyle: 'italic', fontWeight: 800, lineHeight: 1.05, color: '#fff', letterSpacing: '0.02em' }}>
                            <div style={{ fontSize: 14 }}>MONGOLIA</div>
                            <div style={{ fontSize: 14 }}>MILKY WAY</div>
                            <div style={{ marginTop: 4, width: 60, height: 1, background: 'rgba(255,255,255,0.5)' }} />
                        </div>
                    </div>
                </section>
                );
            })}

            {/* ── 02 별하늘 히어로 ──────────────────────────── */}
            {S('02 별하늘 히어로', (v) => (
                <section style={{ position: 'relative', background: '#02100E', overflow: 'hidden' }}>
                    <div style={{ position: 'relative', height: 480, overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', inset: 0, background: '#02100E' }}>
                            <Slot k="hero_bg" src={v('hero_bg')} label="은하수 아래 게르 (야경 사진)" editing={editing} alt="은하수 아래 게르" />
                        </div>
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(2,16,14,0.86) 0%, rgba(2,16,14,0.5) 34%, rgba(2,16,14,0.12) 58%, rgba(2,16,14,0.4) 100%)' }} />
                        <div style={{ position: 'relative', padding: '48px 30px 0', textAlign: 'center' }}>
                            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.86)' }}><span data-df="hero_kicker">{v('hero_kicker')}</span></div>
                            <h2 style={{ margin: '20px 0 0', fontSize: 45, lineHeight: 1.14, fontWeight: 800, letterSpacing: '-0.04em', color: '#fff' }}><span data-df="hero_title">{v('hero_title')}</span></h2>
                            <Lines k="hero_body" text={v('hero_body')} style={{ margin: '22px 0 0', fontSize: 14, lineHeight: 1.75, fontWeight: 600, letterSpacing: '-0.015em', color: 'rgba(255,255,255,0.8)', textShadow: '0 2px 9px rgba(0,0,0,0.5)' }} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, background: '#02100E' }}>
                        <div style={{ position: 'relative', height: 145, overflow: 'hidden', background: '#061F1B' }}>
                            <Slot k="hero_img1" src={v('hero_img1')} label="밤 캠프 사진" editing={editing} alt="밤의 캠프" />
                        </div>
                        <div style={{ position: 'relative', height: 145, overflow: 'hidden', background: '#061F1B' }}>
                            <Slot k="hero_img2" src={v('hero_img2')} label="별 관측 사진" editing={editing} alt="별밤 감상" />
                            <div style={{ position: 'absolute', right: 13, bottom: 11, pointerEvents: 'none', fontStyle: 'italic', fontWeight: 800, lineHeight: 1.05, fontSize: 13, color: 'rgba(255,255,255,0.9)', textAlign: 'right', letterSpacing: '0.02em' }}>
                                <div>MONGOLIA</div>
                                <div>MILKY WAY</div>
                            </div>
                        </div>
                    </div>
                </section>
            ))}

            {/* ── 03 소개 배너 ──────────────────────────────── */}
            {S('03 소개 배너', (v) => (
                <section style={{ position: 'relative', height: 500, overflow: 'hidden', background: DEEP }}>
                    <Slot k="intro_bg" src={v('intro_bg')} label="산맥 아래 초원 사진" editing={editing} alt="산맥 아래 초원" />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(100deg, rgba(0,51,46,0.78) 0%, rgba(0,51,46,0.46) 60%, rgba(0,51,46,0.24) 100%)' }} />
                    <div style={{ position: 'relative', padding: '60px 35px', color: '#fff' }}>
                        <h2 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, fontWeight: 800, letterSpacing: '-0.045em', textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}><span data-df="intro_title">{v('intro_title')}</span></h2>
                        <Lines k="intro_body" text={v('intro_body')} style={{ margin: '19px 0 0', fontSize: 16, lineHeight: 1.62, fontWeight: 600, letterSpacing: '-0.02em', textShadow: '0 2px 7px rgba(0,0,0,0.35)', textWrap: 'pretty' } as React.CSSProperties} />
                    </div>
                </section>
            ))}

            {/* ── 04 이용자 특전 ────────────────────────────── */}
            {S('04 이용자 특전', (v) => (
                <section style={{ background: '#fff', padding: '50px 20px 55px' }}>
                    <h2 style={{ margin: 0, textAlign: 'center', fontSize: 28, fontWeight: 800, letterSpacing: '-0.05em', color: DEEP }}><span data-df="perks_title">{v('perks_title')}</span></h2>
                    <div style={{ margin: '11px 0 0', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#5a5a5a', letterSpacing: '-0.02em' }}><span data-df="perks_sub">{v('perks_sub')}</span></div>
                    <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                        {[1, 2, 3, 4, 5, 6].map(n => (
                            <div key={n} style={{ position: 'relative', height: 160, borderRadius: 10, overflow: 'hidden', background: '#EFFEF9' }}>
                                <Slot k={`perk${n}_img`} src={v(`perk${n}_img`)} label={`특전 ${n} 사진`} editing={editing} alt={v(`perk${n}_title`)} />
                                <div style={{ position: 'absolute', inset: 'auto 0 0 0', pointerEvents: 'none', padding: '13px 8px 11px', background: 'linear-gradient(180deg, rgba(0,51,46,0) 0%, rgba(0,51,46,0.72) 100%)', textAlign: 'center', color: '#fff' }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.03em' }}><span data-df={`perk${n}_title`}>{v(`perk${n}_title`)}</span></div>
                                    <div style={{ marginTop: 3, fontSize: 13, fontWeight: 600, letterSpacing: '-0.02em' }}><span data-df={`perk${n}_sub`}>{v(`perk${n}_sub`)}</span></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ))}

            {/* ── 05 여행 고민 (말풍선) ─────────────────────── */}
            {S('05 여행 고민', (v) => (
                <section style={{ background: '#fff', padding: '55px 25px 60px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.04em', color: '#9a9a9a' }}><span data-df="worry_kicker">{v('worry_kicker')}</span></div>
                        <h2 style={{ margin: '7px 0 0', fontSize: 24, fontWeight: 800, letterSpacing: '-0.05em', color: '#2b2b2b' }}><span data-df="worry_title">{v('worry_title')}</span></h2>
                    </div>
                    <div style={{ marginTop: 35, display: 'flex', flexDirection: 'column', gap: 17 }}>
                        {([
                            { key: 'worry1', align: 'center', tail: 'tail-left', max: 310, size: 14 },
                            { key: 'worry2', align: 'flex-start', tail: 'tail-right', max: 330, size: 13 },
                            { key: 'worry3', align: 'flex-start', tail: 'tail-right', max: 320, size: 14 },
                            { key: 'worry4', align: 'flex-end', tail: 'tail-left', max: 340, size: 13 },
                            { key: 'worry5', align: 'center', tail: 'tail-left', max: 300, size: 14 },
                        ] as const).map(b => (
                            <div key={b.key} style={{ display: 'flex', justifyContent: b.align }}>
                                <div className={`htm-bubble ${b.tail}`} data-df={b.key} style={{ maxWidth: b.max, padding: '12px 17px', borderRadius: 11, background: '#F1F1F1', fontSize: b.size, lineHeight: 1.45, fontWeight: 600, letterSpacing: '-0.03em', color: '#3a3a3a', whiteSpace: 'pre-line' }}>
                                    {v(b.key)}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ))}

            {/* ── 06 숙소 (고급 / 일반 2페이지) ──────────────── */}
            {S('06 숙소', (v) => (
                <section style={{ background: '#fff', padding: '50px 20px 48px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: MINT, letterSpacing: '-0.02em' }}><span data-df="ger_kicker">{v('ger_kicker')}</span></div>
                        <div style={{ marginTop: 7, fontSize: 17, fontWeight: 600, color: '#5a5a5a', letterSpacing: '-0.03em' }}><span data-df="ger_sub">{v('ger_sub')}</span></div>
                        <h2 style={{ margin: '10px 0 0', fontSize: 29, lineHeight: 1.2, fontWeight: 800, letterSpacing: '-0.045em', color: DEEP }}>
                            <div style={{ fontSize: 27 }}><span data-df="ger_title1">{v('ger_title1')}</span></div>
                            <div style={{ color: TEAL }}><span data-df="ger_title2">{v('ger_title2')}</span></div>
                        </h2>
                    </div>

                    <div className="htm-scroll" style={{ marginTop: 26, display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
                        {/* 1페이지 — 고급 게르 */}
                        <div style={{ flex: '0 0 100%', scrollSnapAlign: 'start', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {[1, 2, 3, 4].map(n => (
                                <div key={n} style={{ position: 'relative', height: 140, borderRadius: 8, overflow: 'hidden', background: '#EFFEF9' }}>
                                    <Slot k={`ger_img${n}`} src={v(`ger_img${n}`)} label={`숙소 사진 ${n}`} editing={editing} alt="고급 게르" />
                                </div>
                            ))}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <Dots count={2} hint={v('ger_hint1')} />
                            </div>
                            <div style={{ gridColumn: '1 / -1', marginTop: 9, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 20px' }}>
                                {[1, 2, 3].map(n => v(`ger_check${n}`) && (
                                    <div key={n} data-df={`ger_check${n}`} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 800, letterSpacing: '-0.03em', color: DEEP }}>
                                        <div style={{ color: MINT }}>✓</div>
                                        <div>{v(`ger_check${n}`)}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ gridColumn: '1 / -1', marginTop: 10, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#5a5a5a', letterSpacing: '-0.02em' }}><span data-df="ger_note">{v('ger_note')}</span></div>
                        </div>

                        {/* 2페이지 — 일반 게르 */}
                        <div style={{ flex: '0 0 100%', scrollSnapAlign: 'start', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignContent: 'start' }}>
                            {[1, 2, 3, 4].map(n => (
                                <div key={n} style={{ position: 'relative', height: 140, borderRadius: 8, overflow: 'hidden', background: '#F2F2F2' }}>
                                    <Slot k={`ger_std_img${n}`} src={v(`ger_std_img${n}`)} label={`일반 게르 사진 ${n}`} editing={editing} alt="일반 게르" />
                                    <div style={{ position: 'absolute', left: 7, top: 7, pointerEvents: 'none', padding: '3px 8px', borderRadius: 4, background: 'rgba(43,43,43,0.78)', color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '-0.03em' }}>
                                        <span data-df="ger_std_badge">{v('ger_std_badge')}</span>
                                    </div>
                                </div>
                            ))}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <Dots count={2} hint={v('ger_hint2')} />
                            </div>
                            <div style={{ gridColumn: '1 / -1', marginTop: 9, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 20px' }}>
                                {[1, 2, 3].map(n => v(`ger_std_check${n}`) && (
                                    <div key={n} data-df={`ger_std_check${n}`} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 800, letterSpacing: '-0.03em', color: '#8a8a8a' }}>
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
                <section style={{ background: '#fff', padding: '50px 20px 45px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#8a8a8a', letterSpacing: '-0.03em' }}><span data-df="veh_kicker">{v('veh_kicker')}</span></div>
                        <h2 style={{ margin: '9px 0 0', fontSize: 30, lineHeight: 1.22, fontWeight: 800, letterSpacing: '-0.045em', color: DEEP }}>
                            <div><span data-df="veh_title">{v('veh_title')}</span></div>
                            <div style={{ color: TEAL, fontSize: 20 }}><span data-df="veh_sub">{v('veh_sub')}</span></div>
                        </h2>
                        <Lines k="veh_body" text={v('veh_body')} style={{ margin: '15px 0 0', fontSize: 13, lineHeight: 1.7, fontWeight: 600, color: '#5a5a5a', letterSpacing: '-0.025em' }} />
                    </div>

                    <div className="htm-scroll" style={{ margin: '22px -20px 0 0', display: 'flex', alignItems: 'flex-start', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none', padding: '0 20px 7px 0' } as React.CSSProperties}>
                        {[1, 2, 3, 4, 5].map(n => (
                            <div key={n} style={{ flex: '0 0 190px', scrollSnapAlign: 'start', borderRadius: 9, overflow: 'hidden', background: '#EFFEF9' }}>
                                <div style={{ position: 'relative', height: 140, background: '#EFFEF9' }}>
                                    <Slot k={`veh${n}_img`} src={v(`veh${n}_img`)} label={`차량 ${n} 사진`} editing={editing} alt={v(`veh${n}_name`)} />
                                </div>
                                <div style={{ padding: '13px 12px 17px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.035em', color: TEAL }}><span data-df={`veh${n}_name`}>{v(`veh${n}_name`)}</span></div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Dots count={5} hint={v('veh_hint')} />
                    <Lines k="veh_note" text={v('veh_note')} style={{ margin: '22px 0 0', textAlign: 'center', fontSize: 13, lineHeight: 1.65, fontWeight: 600, color: '#5a5a5a', letterSpacing: '-0.02em' }} />
                </section>
            ))}

            {/* ── 15 식사 안내 ──────────────────────────────── */}
            {S('15 식사 안내', (v) => {
                const mealImgs = [1, 2, 3, 4, 5, 6];
                return (
                <section style={{ position: 'relative', overflow: 'hidden', padding: '0 0 55px', background: '#fff' }}>
                    {/* 상단 흐르는 사진 띠 — 6장을 두 번 이어 붙여 무한 스크롤 */}
                    <div style={{ position: 'relative', paddingTop: 35, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', width: 'max-content', gap: 11, animation: 'htmMealMarquee 26s linear infinite' }}>
                            {[0, 1].flatMap(rep => mealImgs.map(n => (
                                <div key={`${rep}-${n}`} style={{ position: 'relative', flex: '0 0 150px', height: 170, borderRadius: 11, overflow: 'hidden', background: '#123028' }}>
                                    <Slot k={rep === 0 ? `meal_img${n}` : undefined} src={v(`meal_img${n}`)} label={`식사 사진 ${n}`} editing={editing && rep === 0} alt="식사" />
                                </div>
                            )))}
                        </div>
                    </div>

                    <div style={{ position: 'relative', padding: '35px 20px 0', textAlign: 'center' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#8a8a8a', letterSpacing: '-0.03em' }}><span data-df="meal_kicker">{v('meal_kicker')}</span></div>
                        <h2 style={{ margin: '7px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: '-0.045em', color: DEEP }}>
                            <span data-df="meal_title1" style={{ whiteSpace: 'pre-wrap' }}>{v('meal_title1')}</span>
                            <span data-df="meal_title2" style={{ whiteSpace: 'pre-wrap', color: TEAL }}>{v('meal_title2')}</span>
                        </h2>
                    </div>

                    <div style={{ position: 'relative', padding: '0 20px' }}>
                        <LineList k="meal_points" text={v('meal_points')} style={{ marginTop: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: '#3a3a3a', letterSpacing: '-0.03em' }} />

                        <div style={{ marginTop: 22 }}>
                            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.04em', color: TEAL }}><span data-df="meal_local_title">{v('meal_local_title')}</span></div>
                            <Lines k="meal_local_body" text={v('meal_local_body')} style={{ marginTop: 8, fontSize: 13, lineHeight: 1.75, fontWeight: 600, color: '#4a4a4a', letterSpacing: '-0.025em' }} />
                        </div>
                        <div style={{ marginTop: 22 }}>
                            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.04em', color: TEAL }}><span data-df="meal_camp_title">{v('meal_camp_title')}</span></div>
                            <Lines k="meal_camp_body" text={v('meal_camp_body')} style={{ marginTop: 8, fontSize: 13, lineHeight: 1.75, fontWeight: 600, color: '#4a4a4a', letterSpacing: '-0.025em' }} />
                        </div>

                        {/* 특별식 2페이지 슬라이더 */}
                        <div className="htm-scroll" style={{ margin: '26px -20px 0 0', display: 'flex', alignItems: 'flex-start', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none', padding: '0 20px 7px 0' } as React.CSSProperties}>
                            {[1, 2].map(n => (
                                <div key={n} style={{ flex: '0 0 100%', scrollSnapAlign: 'start' }}>
                                    <div style={{ position: 'relative', height: 210, borderRadius: 12, overflow: 'hidden', background: '#EFFEF9' }}>
                                        <Slot k={`sp${n}_img`} src={v(`sp${n}_img`)} label={`특별식 ${n} 사진`} editing={editing} alt={v(`sp${n}_title`)} />
                                    </div>
                                    <Dots count={2} hint={v('meal_hint')} />
                                    <LineList k={`sp${n}_tags`} text={v(`sp${n}_tags`)} style={{ marginTop: 13, display: 'flex', flexWrap: 'wrap', gap: 9, fontSize: 13, fontWeight: 700, color: TEAL, letterSpacing: '-0.03em' }} />
                                    <div style={{ marginTop: 10 }}>
                                        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.04em', color: TEAL }}><span data-df={`sp${n}_title`}>{v(`sp${n}_title`)}</span></div>
                                        <Lines k={`sp${n}_body`} text={v(`sp${n}_body`)} style={{ marginTop: 8, fontSize: 13, lineHeight: 1.75, fontWeight: 600, color: '#4a4a4a', letterSpacing: '-0.025em' }} />
                                        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 800, color: TEAL, letterSpacing: '-0.03em' }}><span data-df={`sp${n}_note`}>{v(`sp${n}_note`)}</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
                );
            })}

            {/* ── 07 루트 소개 + 지도 ───────────────────────── */}
            {S('07 루트/지도', (v) => {
                const mapStops = v('map_stops').split('\n').map(s => s.trim()).filter(Boolean).join(';');
                const mapUrl = `/designs/mongolia-map.html?stops=${encodeURIComponent(mapStops)}`;
                const spotCards = v('spot_cards').split('\n').map(s => s.trim()).filter(Boolean).map((line, i) => { const p = line.split('|').map(x => x.trim()); return { i, title: toJaDestinationName(p[0] || ''), img: p[1] || '', offset: i % 2 === 1 }; });
                return (
                <section style={{ position: 'relative', background: 'linear-gradient(180deg, #C8FFEF 0%, #EFFEF9 32%, #EFFEF9 100%)', paddingBottom: 45 }}>
                    <div style={{ padding: '55px 35px 30px', textAlign: 'center' }}>
                        <div style={{ fontSize: 19, color: MINT, letterSpacing: '0.2em' }}>✦</div>
                        <h2 style={{ margin: '9px 0 0', fontSize: 29, lineHeight: 1.32, fontWeight: 800, letterSpacing: '-0.04em', color: '#2b2b2b' }}><span data-df="route_intro_title">{v('route_intro_title')}</span></h2>
                        <Lines k="route_intro_p1" text={v('route_intro_p1')} style={{ margin: '23px 0 0', fontSize: 14, lineHeight: 1.75, fontWeight: 500, color: '#4a4a4a', letterSpacing: '-0.02em' }} />
                        <Lines k="route_intro_p2" text={v('route_intro_p2')} style={{ margin: '19px 0 0', fontSize: 14, lineHeight: 1.75, fontWeight: 500, color: '#4a4a4a', letterSpacing: '-0.02em' }} />
                    </div>

                    <div style={{ position: 'relative', height: 210, overflow: 'hidden', background: '#DFFFF4' }}>
                        <Slot k="route_wide_img" src={v('route_wide_img')} label="와이드 사진 (계곡에서 쉬는 일행)" editing={editing} alt="계곡에서 쉬는 일행" />
                    </div>

                    <div style={{ margin: '-30px 20px 0', position: 'relative', background: '#fff', borderRadius: 20, boxShadow: '0 12px 30px rgba(0,51,46,0.10)', padding: '35px 28px 38px' }}>
                        <h3 style={{ margin: 0, textAlign: 'center', fontSize: 34, lineHeight: 1.4, fontWeight: 800, letterSpacing: '-0.035em', color: '#2b2b2b' }}><span data-df="route_card_title">{v('route_card_title')}</span></h3>

                        <div style={{ margin: '28px 0 32px', display: 'flex', justifyContent: 'center' }}>
                            <iframe data-df="map_stops" src={mapUrl} title="몽골 지도 위 여정 지점" scrolling="no" style={{ width: '100%', maxWidth: 380, aspectRatio: '760/990', border: 0, display: 'block' }} loading="lazy" />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.035em', color: DEEP }}><span data-df="spots_label">{v('spots_label')}</span></div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: TEAL, letterSpacing: '-0.02em' }}><span data-df="spots_hint">{v('spots_hint')}</span></div>
                        </div>
                        <div className="htm-scroll" style={{ margin: '10px -28px 0 0', display: 'flex', alignItems: 'flex-start', gap: 11, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none', padding: '2px 28px 8px 0' } as React.CSSProperties}>
                            {spotCards.map(c => (
                                <div key={c.i} style={{ flex: '0 0 170px', marginTop: c.offset ? 17 : 0, scrollSnapAlign: 'start', background: '#0B1F1B', borderRadius: 13, overflow: 'hidden' }}>
                                    <div style={{ position: 'relative', height: 210, background: '#123028' }}>
                                        <Slot k="spot_cards" src={c.img} label={`${c.title} 사진`} editing={editing} alt={c.title} />
                                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(11,31,27,0.45) 0%, rgba(11,31,27,0.1) 40%, rgba(11,31,27,0.88) 100%)' }} />
                                        <div style={{ position: 'absolute', left: 12, right: 12, bottom: 13, fontSize: 13, lineHeight: 1.35, fontWeight: 800, letterSpacing: '-0.04em', color: '#fff', textShadow: '0 2px 11px rgba(0,0,0,0.5)' }}><span data-df="spot_cards">{c.title}</span></div>
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
                <section style={{ position: 'relative', height: 590, overflow: 'hidden', background: '#0A6558' }}>
                    <div style={{ position: 'absolute', inset: 0, background: '#0E5349' }}>
                        <Slot k="gobi_hero_img" src={v('gobi_hero_img')} label="고비 히어로 배경 사진" editing={editing} alt="고비" />
                    </div>
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.06) 40%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.35) 100%)' }} />
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(6,196,160,0.16) 0%, rgba(0,51,46,0.05) 40%, rgba(6,196,160,0.34) 100%)', mixBlendMode: 'multiply' }} />
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 20, pointerEvents: 'none', padding: '0 23px', color: '#fff' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
                            <div>MONGOLIA</div>
                            <div>Milky Way</div>
                        </div>
                    </div>
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 44, pointerEvents: 'none', padding: '0 23px', color: '#fff', textAlign: 'center' }}>
                        <div style={{ fontSize: 53, lineHeight: 0.96, fontWeight: 900, letterSpacing: '0.02em', textShadow: '0 3px 15px rgba(0,0,0,0.4)' }}><span data-df="gobi_title">{v('gobi_title')}</span></div>
                        <div style={{ marginTop: 5, fontSize: 29, lineHeight: 1.05, fontWeight: 900, letterSpacing: '0.16em', textShadow: '0 2px 11px rgba(0,0,0,0.4)' }}><span data-df="gobi_title2">{v('gobi_title2')}</span></div>
                        <div style={{ margin: '15px auto 0', maxWidth: 310, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13, lineHeight: 1.6, fontWeight: 600, letterSpacing: '-0.01em', textShadow: '0 2px 6px rgba(0,0,0,0.55)' }}>
                            <div data-df="gobi_kicker">{v('gobi_kicker')}</div>
                            <Lines k="gobi_body" text={v('gobi_body')} />
                        </div>
                    </div>
                </section>
            ))}

            {/* ── 10 하이라이트 ─────────────────────────────── */}
            {S('10 하이라이트', (v) => {
                const points = [1, 2, 3, 4, 5].map(n => ({ n, img: v(`pt${n}_img`), caption: v(`pt${n}_caption`) }));
                return (
                <section style={{ background: '#fff', padding: '48px 30px 50px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <div style={{ flex: 1, height: 1, background: '#e6e6e6' }} />
                        <div style={{ flex: '0 0 5px', height: 5, borderRadius: '50%', background: MINT }} />
                        <div style={{ padding: '8px 22px', border: '1px solid #91FEE0', borderRadius: 500, fontSize: 20, fontWeight: 800, letterSpacing: '-0.035em', color: '#2b2b2b' }}><span data-df="hl_title">{v('hl_title')}</span></div>
                        <div style={{ flex: '0 0 5px', height: 5, borderRadius: '50%', background: MINT }} />
                        <div style={{ flex: 1, height: 1, background: '#e6e6e6' }} />
                    </div>
                    <div style={{ marginTop: 11, textAlign: 'right', fontSize: 13, fontWeight: 600, color: TEAL, letterSpacing: '-0.02em' }}><span data-df="hl_hint">{v('hl_hint')}</span></div>
                    <div className="htm-scroll" style={{ margin: '11px -30px 0 0', display: 'flex', alignItems: 'flex-start', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none', padding: '2px 30px 6px 0' } as React.CSSProperties}>
                        {points.map(p => (
                            <div key={p.n} style={{ flex: '0 0 170px', scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                                <div style={{ position: 'relative', flex: '0 0 125px', height: 125, borderRadius: 14, overflow: 'hidden', background: '#C8FFEF' }}>
                                    <Slot k={`pt${p.n}_img`} src={p.img} label={`포인트 ${p.n} 사진`} editing={editing} alt={p.caption} />
                                    <div style={{ position: 'absolute', top: 8, left: 8, pointerEvents: 'none', width: 22, height: 22, borderRadius: '50%', background: MINT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>{p.n}</div>
                                </div>
                                <div style={{ marginTop: 10, textAlign: 'center', fontSize: 13, lineHeight: 1.45, letterSpacing: '-0.025em', color: '#3a3a3a' }}><span data-df={`pt${p.n}_caption`}>{p.caption}</span></div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 19, fontWeight: 800, color: MINT, lineHeight: 1 }}>+</div>
                        <div style={{ fontSize: 54, fontWeight: 800, letterSpacing: '-0.04em', color: DEEP }}><span data-df="and_word">{v('and_word')}</span></div>
                        <div style={{ width: 1, height: 44, background: `linear-gradient(180deg, ${MINT}, rgba(6,196,160,0))` }} />
                    </div>
                </section>
                );
            })}

            {/* ── 11 은하수 ─────────────────────────────────── */}
            {S('11 은하수', (v) => (
                <section style={{ position: 'relative', background: '#02100E' }}>
                    <div style={{ position: 'relative', height: 320, overflow: 'hidden', background: '#02100E' }}>
                        <div style={{ position: 'absolute', inset: 0, background: '#0B1F1B' }}>
                            <Slot k="mw_img" src={v('mw_img')} label="은하수 사진" editing={editing} alt="은하수" />
                        </div>
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(2,16,14,0.3) 0%, rgba(2,16,14,0.05) 40%, rgba(2,16,14,0.9) 100%)' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 28, alignItems: 'start', padding: '0 25px 32px', marginTop: -75, position: 'relative' }}>
                        <Lines k="mw_caption" text={v('mw_caption')} style={{ fontSize: 25, lineHeight: 1.32, fontWeight: 800, letterSpacing: '-0.045em', color: '#fff', textShadow: '0 2px 13px rgba(0,0,0,0.5)' }} />
                        <div style={{ paddingTop: 7 }}>
                            <div style={{ width: 27, height: 2, background: '#fff' }} />
                            <LineList k="mw_body" text={v('mw_body')} style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, lineHeight: 1.7, fontWeight: 600, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.82)' }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 3, background: '#02100E', padding: '0 0 3px' }}>
                        {[1, 2, 3, 4].map(n => (
                            <div key={n} style={{ position: 'relative', height: 150, overflow: 'hidden', background: '#0B1F1B' }}>
                                <Slot k={`milky_img${n}`} src={v(`milky_img${n}`)} label={`은하수 사진 ${n}`} editing={editing} alt="은하수" />
                            </div>
                        ))}
                    </div>
                </section>
            ))}

            {/* ── 12 공항 도착 ──────────────────────────────── */}
            {S('12 공항 도착', (v) => (
                <section style={{ background: '#fff', padding: '50px 0 0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.04em', color: '#c9c9c9' }}><span data-df="arr_from">{v('arr_from')}</span></div>
                        <div style={{ marginTop: 11, width: 2, height: 39, background: MINT }} />
                        <div style={{ width: 11, height: 11, borderRadius: '50%', background: MINT, boxShadow: '0 0 0 3px rgba(6,196,160,0.22)' }} />
                        <div style={{ marginTop: 17, fontSize: 33, fontWeight: 800, letterSpacing: '-0.05em', color: DEEP }}><span data-df="arr_to">{v('arr_to')}</span></div>
                    </div>

                    <div style={{ marginTop: 28, position: 'relative', height: 260, background: '#EFFEF9' }}>
                        <Slot k="arr_img" src={v('arr_img')} label="칭기스칸 공항 사진" editing={editing} alt="칭기스칸 국제공항" />
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.55) 18%, rgba(255,255,255,0) 42%, rgba(255,255,255,0) 62%, rgba(255,255,255,0.7) 88%, #fff 100%)' }} />
                    </div>

                    <div style={{ padding: '0 30px' }}>
                        <Lines k="arr_lead" text={v('arr_lead')} style={{ textAlign: 'center', fontSize: 19, fontWeight: 700, letterSpacing: '-0.03em', color: '#2b2b2b' }} />
                        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                            <Lines k="arr_body" text={v('arr_body')} style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.035em', color: '#2b2b2b', textAlign: 'center' }} />
                        </div>
                    </div>

                    <div style={{ marginTop: 28, padding: '22px 30px', background: '#C8FFEF', textAlign: 'center' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.035em', color: DEEP }}><span data-df="arr_band1">{v('arr_band1')}</span></div>
                        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, letterSpacing: '-0.035em', color: '#0A6558' }}><span data-df="arr_band2">{v('arr_band2')}</span></div>
                    </div>

                    <div style={{ padding: '35px 30px 50px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 10 }}>
                            <div style={{ position: 'relative', flex: '0 0 200px', height: 215, background: '#EFFEF9', borderRadius: 3, overflow: 'hidden' }}>
                                <Slot k="welcome_img" src={v('welcome_img')} label="픽업기사 웰컴카드 사진" editing={editing} alt="웰컴 보드" />
                            </div>
                            <div style={{ flex: '0 0 160px', paddingTop: 48, color: MINT, wordBreak: 'keep-all', overflowWrap: 'normal' }}>
                                <div style={{ whiteSpace: 'nowrap', fontSize: 14, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}><span data-df="welcome_w1">{v('welcome_w1')}</span></div>
                                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <div style={{ flex: '0 0 auto', whiteSpace: 'nowrap', fontSize: 41, fontWeight: 900, letterSpacing: '-0.06em', lineHeight: 0.9, textTransform: 'uppercase' }}><span data-df="welcome_w2">{v('welcome_w2')}</span></div>
                                    <div style={{ flex: 1, height: 28, background: MINT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '0 4px' }}>
                                        {[1, 2, 3].map(n => (
                                            <div key={n} style={{ position: 'relative', flex: 1, height: 22 }}>
                                                <Slot k={`mn_icon${n}`} src={v(`mn_icon${n}`)} label="아이콘" editing={editing} alt="" contain />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ marginTop: 3, whiteSpace: 'nowrap', fontSize: 26, fontWeight: 900, letterSpacing: '-0.055em', lineHeight: 0.95, textTransform: 'uppercase' }}><span data-df="welcome_w3">{v('welcome_w3')}</span></div>
                                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <div style={{ flex: 1, height: 22, background: MINT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '0 4px' }}>
                                        {[4, 5, 6].map(n => (
                                            <div key={n} style={{ position: 'relative', flex: 1, height: 17 }}>
                                                <Slot k={`mn_icon${n}`} src={v(`mn_icon${n}`)} label="아이콘" editing={editing} alt="" contain />
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: MINT }} />
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: 17, textAlign: 'center', fontSize: 15, lineHeight: 1.5, fontWeight: 700, letterSpacing: '-0.035em', color: '#2b2b2b' }}><span data-df="welcome_caption">{v('welcome_caption')}</span></div>
                    </div>
                </section>
            ))}

            
            {/* ── 16 여행의 순간들 ──────────────────────────── */}
            {S('16 여행의 순간들', (v) => (
                <section style={{ background: '#fff', padding: '50px 20px 55px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,1fr)', gap: 8, alignItems: 'start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ position: 'relative', height: 260, borderRadius: 8, overflow: 'hidden', background: '#EFFEF9' }}>
                                <Slot k="moment_img1" src={v('moment_img1')} label="절벽 위 인생샷" editing={editing} alt="" />
                            </div>
                            <div style={{ position: 'relative', height: 165, borderRadius: 8, overflow: 'hidden', background: '#EFFEF9' }}>
                                <Slot k="moment_img2" src={v('moment_img2')} label="캠프파이어" editing={editing} alt="" />
                            </div>
                            <Lines k="moment_text1" text={v('moment_text1')} style={{ padding: '18px 2px 15px', fontSize: 18, lineHeight: 1.3, fontWeight: 900, letterSpacing: '-0.045em', color: '#CFE3DC', wordBreak: 'keep-all', overflowWrap: 'normal' }} />
                            <div style={{ position: 'relative', height: 215, borderRadius: 8, overflow: 'hidden', background: '#EFFEF9' }}>
                                <Slot k="moment_img3" src={v('moment_img3')} label="샌드보딩" editing={editing} alt="" />
                            </div>
                            <div style={{ position: 'relative', height: 150, borderRadius: 8, overflow: 'hidden', background: '#EFFEF9' }}>
                                <Slot k="moment_img4" src={v('moment_img4')} label="허르헉 조리" editing={editing} alt="" />
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <Lines k="moment_text2" text={v('moment_text2')} style={{ padding: '22px 2px 17px', textAlign: 'right', fontSize: 24, lineHeight: 1.22, fontWeight: 900, letterSpacing: '-0.05em', color: '#CFE3DC', wordBreak: 'keep-all', overflowWrap: 'normal' }} />
                            <div style={{ position: 'relative', height: 235, borderRadius: 8, overflow: 'hidden', background: '#EFFEF9' }}>
                                <Slot k="moment_img5" src={v('moment_img5')} label="낙타 트레킹" editing={editing} alt="" />
                            </div>
                            <div style={{ position: 'relative', height: 150, borderRadius: 8, overflow: 'hidden', background: '#EFFEF9' }}>
                                <Slot k="moment_img6" src={v('moment_img6')} label="양털 기념품" editing={editing} alt="" />
                            </div>
                            <div style={{ position: 'relative', height: 210, borderRadius: 8, overflow: 'hidden', background: '#EFFEF9' }}>
                                <Slot k="moment_img7" src={v('moment_img7')} label="단체 점프" editing={editing} alt="" />
                            </div>
                            <div style={{ position: 'relative', height: 170, borderRadius: 8, overflow: 'hidden', background: '#EFFEF9' }}>
                                <Slot k="moment_img8" src={v('moment_img8')} label="별 관측" editing={editing} alt="" />
                            </div>
                        </div>
                    </div>
                </section>
            ))}

            {/* ── 17 포함/불포함 ────────────────────────────── */}
            {S('17 포함/불포함', (v) => (
                <section style={{ position: 'relative', overflow: 'hidden', background: DEEP, padding: '0 0 40px' }}>
                    <div style={{ position: 'absolute', inset: 0, background: '#0A6558' }}>
                        <Slot k="notice_bg" src={v('notice_bg')} label="초원 배경 사진" editing={editing} alt="초원" />
                    </div>
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(0,51,46,0.62) 0%, rgba(0,51,46,0.42) 45%, rgba(0,51,46,0.7) 100%)' }} />

                    <div style={{ position: 'relative', padding: '43px 20px 0', textAlign: 'center' }}>
                        <h2 style={{ margin: 0, fontSize: 53, lineHeight: 1, fontWeight: 900, letterSpacing: '-0.04em', color: MINT, textShadow: '0 3px 15px rgba(0,0,0,0.35)' }}><span data-df="notice_title">{v('notice_title')}</span></h2>
                        <div style={{ marginTop: 9, fontSize: 13, fontWeight: 700, letterSpacing: '-0.03em', color: 'rgba(255,255,255,0.85)' }}><span data-df="notice_sub">{v('notice_sub')}</span></div>
                    </div>

                    <div style={{ position: 'relative', margin: '26px 25px 0', background: '#fff', padding: '24px 26px 26px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ flex: '0 0 17px', height: 17, borderRadius: '50%', background: MINT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>✓</div>
                            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.035em', color: '#2b2b2b' }}><span data-df="inc_title">{v('inc_title')}</span></div>
                        </div>
                        <LineList k="inc_items" text={v('inc_items')} style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13, lineHeight: 1.45, fontWeight: 600, color: '#3a3a3a', letterSpacing: '-0.025em' }} />

                        <div style={{ margin: '19px 0', height: 1, background: '#e2e2e2' }} />

                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ flex: '0 0 17px', height: 17, borderRadius: '50%', background: '#C2B8A3', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>✕</div>
                            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.035em', color: '#2b2b2b' }}><span data-df="exc_title">{v('exc_title')}</span></div>
                        </div>
                        <LineList k="exc_items" text={v('exc_items')} style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13, lineHeight: 1.45, fontWeight: 600, color: '#3a3a3a', letterSpacing: '-0.025em' }} />
                    </div>
                </section>
            ))}

            {/* ── 18 투어 가격 ──────────────────────────────── */}
            {S('18 투어 가격', (v) => {
                // 원화 금액(7자리, `2,000,000원`)이 잔금 칸에서 줄바꿈되지 않도록 인원 칸을 조금 줄이고 잔금 칸을 넓힌다
                const cols = 'minmax(0,0.9fr) minmax(0,1.1fr) minmax(0,1.1fr) minmax(0,1.9fr)';
                const head = v('price_head').split('|').map(s => s.trim());
                const rows = v('price_rows').split('\n').map(s => s.trim()).filter(Boolean).map(r => r.split('|').map(c => c.trim()));
                return (
                <section style={{ background: '#EFFEF9', padding: '35px 20px 55px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#5a5a5a', letterSpacing: '-0.03em' }}><span data-df="price_kicker">{v('price_kicker')}</span></div>
                        <h2 style={{ margin: '7px 0 0', fontSize: 31, fontWeight: 800, letterSpacing: '-0.05em', color: DEEP }}><span data-df="price_title">{v('price_title')}</span></h2>
                    </div>

                    <div style={{ marginTop: 22, borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                        <div data-df="price_head" style={{ display: 'grid', gridTemplateColumns: cols, background: DEEP, color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '-0.03em', textAlign: 'center' }}>
                            {head.map((h, i) => <div key={i} style={{ padding: '10px 4px' }}>{h}</div>)}
                        </div>
                        <div data-df="price_rows">
                            {rows.map((r, i) => (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'center', textAlign: 'center', padding: '11px 0', borderBottom: i === rows.length - 1 ? undefined : '1px solid #F0F0F0' }}>
                                    {r.map((c, j) => (
                                        <div key={j} style={{ fontSize: 14, fontWeight: 800, color: j === r.length - 1 ? TEAL : '#2b2b2b' }}>{c}</div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '7px 12px' }}>
                        {[1, 2].map(n => (
                            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ padding: '4px 10px', borderRadius: 500, background: DEEP, color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '-0.03em' }}><span data-df={`price_tag${n}`}>{v(`price_tag${n}`)}</span></div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#4a4a4a', letterSpacing: '-0.025em' }}><span data-df={`price_tag${n}_desc`}>{v(`price_tag${n}_desc`)}</span></div>
                            </div>
                        ))}
                    </div>

                    <div style={{ position: 'relative', marginTop: 28, height: 160, borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                        <Slot k="price_img" src={v('price_img')} label="사막 낙타 사진" editing={editing} alt="낙타" />
                    </div>
                </section>
                );
            })}

            {/* ── 19 예약 전 확인사항 ───────────────────────── */}
            {S('19 예약 전 확인사항', (v) => {
                const gtCols = 'minmax(0,1.25fr) minmax(0,1.05fr) minmax(0,1.7fr)';
                const gtHead = v('gt_head').split('|').map(s => s.trim());
                return (
                <section style={{ background: '#fff', padding: '50px 25px 55px' }}>
                    <h2 style={{ margin: 0, textAlign: 'center', fontSize: 25, fontWeight: 800, letterSpacing: '-0.045em', color: '#2b2b2b' }}><span data-df="terms_title">{v('terms_title')}</span></h2>

                    <div style={{ marginTop: 29 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.035em', color: DEEP }}><span data-df="cancel_title">{v('cancel_title')}</span></div>
                        <LineList k="cancel_body" text={v('cancel_body')} style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, lineHeight: 1.6, fontWeight: 600, color: '#3a3a3a', letterSpacing: '-0.025em' }} />
                        <LineList k="cancel_box" text={v('cancel_box')} style={{ marginTop: 13, padding: '12px 15px', background: '#EFFEF9', display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, fontWeight: 800, color: DEEP, letterSpacing: '-0.03em' }} />
                    </div>

                    <div style={{ marginTop: 28 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.035em', color: DEEP }}><span data-df="tour_title">{v('tour_title')}</span></div>
                        <LineList k="tour_body" text={v('tour_body')} style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13, lineHeight: 1.75, fontWeight: 600, color: '#3a3a3a', letterSpacing: '-0.025em' }} />
                        <div style={{ marginTop: 15, padding: '11px 0', background: '#111', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}><span data-df="tour_banner">{v('tour_banner')}</span></div>
                    </div>

                    <div style={{ marginTop: 28 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.035em', color: DEEP }}><span data-df="gerstay_title">{v('gerstay_title')}</span></div>
                        <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6, fontWeight: 600, color: '#3a3a3a', letterSpacing: '-0.025em' }}>
                            <div>· <span data-df="gerstay_lead" style={{ color: TEAL, fontWeight: 800 }}>{v('gerstay_lead')}</span></div>
                            <Lines k="gerstay_body" text={v('gerstay_body')} style={{ paddingLeft: 8 }} />
                        </div>

                        <div style={{ marginTop: 20, border: '1px solid #E4EFEA', borderRadius: 7, overflow: 'hidden' }}>
                            <div data-df="gt_head" style={{ display: 'grid', gridTemplateColumns: gtCols, background: '#edf6f3', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#2b2b2b', letterSpacing: '-0.03em' }}>
                                {gtHead.map((h, i) => <div key={i} style={{ padding: '8px 5px' }}>{h}</div>)}
                            </div>
                            {[1, 2, 3, 4].map((n, i) => (
                                <div key={n} style={{ display: 'grid', gridTemplateColumns: gtCols, alignItems: 'center', borderBottom: i === 3 ? undefined : '1px solid #EFEFEF' }}>
                                    <Lines k={`gt${n}_name`} text={v(`gt${n}_name`)} style={{ padding: '10px 3px', textAlign: 'center', fontSize: 12.5, fontWeight: 800, color: '#2b2b2b', letterSpacing: '-0.04em' }} />
                                    <div style={{ padding: '7px 8px' }}>
                                        <div style={{ position: 'relative', height: 60, borderRadius: 4, overflow: 'hidden', background: '#EFFEF9' }}>
                                            <Slot k={`gt${n}_img`} src={v(`gt${n}_img`)} label="사진" editing={editing} alt="게르" />
                                        </div>
                                    </div>
                                    <Lines k={`gt${n}_spec`} text={v(`gt${n}_spec`)} style={{ padding: '9px 8px', fontSize: 12.5, lineHeight: 1.7, fontWeight: 600, color: '#3a3a3a', letterSpacing: '-0.03em' }} />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginTop: 28 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.035em', color: DEEP }}><span data-df="animal_title">{v('animal_title')}</span></div>
                        <LineList k="animal_body" text={v('animal_body')} style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, lineHeight: 1.6, fontWeight: 600, color: '#3a3a3a', letterSpacing: '-0.025em' }} />
                    </div>
                </section>
                );
            })}

            {/* ── 20 FAQ ────────────────────────────────────── */}
            {S('20 FAQ', (v) => (
                <section style={{ background: '#EFFEF9', padding: '45px 25px 55px' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 35, fontWeight: 900, letterSpacing: '-0.04em', color: MINT }}><span data-df="faq_title">{v('faq_title')}</span></div>
                        <div style={{ marginTop: 2, fontSize: 19, fontWeight: 800, letterSpacing: '-0.04em', color: '#2b2b2b' }}><span data-df="faq_sub">{v('faq_sub')}</span></div>
                    </div>

                    <div style={{ marginTop: 22, border: '1px solid #CFEFE3', borderRadius: 13, background: '#fff', padding: '23px 23px 25px' }}>
                        {[1, 2, 3, 4, 5].map((n, i) => (
                            <React.Fragment key={n}>
                                {i > 0 && <div style={{ margin: '18px 0', height: 1, background: '#E8F3EE' }} />}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                    <div style={{ flex: '0 0 20px', height: 20, borderRadius: 5, background: MINT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, letterSpacing: '-0.03em' }}>Q.</div>
                                    <div style={{ fontSize: 13, lineHeight: 1.45, fontWeight: 800, letterSpacing: '-0.03em', color: TEAL, paddingTop: 3 }}><span data-df={`faq${n}_q`}>{v(`faq${n}_q`)}</span></div>
                                </div>
                                <Lines k={`faq${n}_a`} text={v(`faq${n}_a`)} style={{ margin: '9px 0 0 28px', fontSize: 13, lineHeight: 1.65, fontWeight: 600, color: '#5a5a5a', letterSpacing: '-0.025em' }} />
                            </React.Fragment>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
