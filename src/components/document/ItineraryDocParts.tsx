import React, { useEffect, useState } from 'react';
import { BRAND } from '../../constants/company';
import { normalizeImages } from './TripDocParts';

const BRAND_EN = BRAND.nameEn.toUpperCase();

/**
 * 확정 일정표 디자인 시스템의 공용 렌더러.
 * DocumentItinerary(확정 일정표)와 EstimateDetail(맞춤 견적)이 함께 사용해
 * 고객이 견적 → 확정 문서를 같은 구조·디자인으로 경험하게 한다.
 * 여기 스타일을 바꾸면 두 문서 모두 바뀐다.
 */

// ─── 디자인 토큰 ───
export const INK = '#1A1B1E';
export const SUB = '#5F636B';
export const MUTE = '#8A8F99';
export const FAINT = '#B4B8C0';
export const BLUE = '#1A8CFF';
export const BLUE_DK = '#0B6FE0';
export const BLUE_BG = '#E8F2FF';
export const BLUE_TX = '#24405E';
export const GREEN = '#18A957';
export const GREEN_BG = '#E4F7EC';
export const RED = '#FF4F4F';
export const RED_BG = '#FFECEC';
export const WARN_BG = '#FFF6F0';
export const WARN_TITLE = '#B5451B';
export const WARN_SUB = '#C0693A';
export const WARN_BULLET = '#E0701F';
export const BODY = '#4A4E55';
export const BORDER = '#E6E8EC';
export const HAIRLINE = '#F1F2F4';
export const SECTION = '#F7F8FA';
export const PAGE_BG = '#e7e5df';

// ─── 타입 ───
export interface Activity { time?: string; type?: string; title: string; description?: string; images?: string[] | string; }
export interface DayData {
    day: number; date?: string; title: string; region?: string; summary?: string;
    activities: Activity[];
    meals?: { breakfast?: string; lunch?: string; dinner?: string };
    accommodation: { id?: string; name: string; type?: string; location?: string; images?: string[] | string; description?: string; facilities?: string[] | string } | null;
}

// ─── 헬퍼 ───
export const formatRange = (start?: string, end?: string) => {
    const f = (iso?: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso || '';
        const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
        return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}(${wd})`;
    };
    const s = f(start), e = f(end);
    return (!s && !e) ? '—' : `${s}~${e}`;
};
export const dayDate = (start: string | undefined, dayNum: number) => {
    if (!start) return '';
    const d = new Date(start);
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + dayNum - 1);
    const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    return `${d.getMonth() + 1}.${d.getDate()} ${wd}`;
};
export const displayDayDate = (explicitDate: string | undefined, start: string | undefined, dayNum: number) => {
    const value = explicitDate?.trim();
    if (!value) return dayDate(start, dayNum);
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!iso) return value;
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    return `${d.getMonth() + 1}.${d.getDate()} ${wd}`;
};
export const computeDuration = (start?: string, end?: string) => {
    if (!start || !end) return null;
    const s = new Date(start), e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
    const nights = Math.round((e.getTime() - s.getTime()) / 86400000);
    return nights >= 0 ? { nights, days: nights + 1 } : null;
};
export const splitItems = (t?: string) => (t || '').split(/\r?\n|、|,/).map(x => x.trim()).filter(Boolean);
export const splitTitleDesc = (s: string): { title: string; desc: string } => {
    const idx = s.search(/[：:｜]/);
    if (idx > 0) return { title: s.slice(0, idx).trim(), desc: s.slice(idx + 1).trim() };
    return { title: s.trim(), desc: '' };
};
export const asArray = (v: any): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && !!x.trim());
    if (typeof v === 'string') {
        if (v.startsWith('[')) { try { const p = JSON.parse(v); return Array.isArray(p) ? p.filter((x: any) => typeof x === 'string' && x.trim()) : []; } catch { /* noop */ } }
        return v.split(/\r?\n|、|,/).map(x => x.trim()).filter(Boolean);
    }
    return [];
};

export const useIsMobile = () => {
    const [m, setM] = useState<boolean>(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false));
    useEffect(() => {
        const onResize = () => setM(window.innerWidth <= 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return m;
};

// ─── 공용 소형 컴포넌트 ───
export const Bullet: React.FC<{ n?: React.ReactNode; color?: string; children: React.ReactNode }> = ({ n = '·', color = BLUE, children }) => (
    <div style={{ display: 'flex', gap: 9, fontSize: 12.5, color: BODY, lineHeight: 1.7 }}>
        <span style={{ color, fontWeight: 700, flex: 'none' }}>{n}</span>
        <span style={{ flex: 1 }}>{children}</span>
    </div>
);
export const IncludeItem: React.FC<{ ok: boolean; text: string }> = ({ ok, text }) => {
    const { title, desc } = splitTitleDesc(text);
    return (
        <div style={{ display: 'flex', gap: 11 }}>
            <span style={{ width: 22, height: 22, flex: 'none', borderRadius: '50%', background: ok ? GREEN_BG : RED_BG, color: ok ? GREEN : RED, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: ok ? 13 : 12, fontWeight: 800 }}>{ok ? '✓' : '✕'}</span>
            <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{title}</div>
                {desc && <div style={{ fontSize: 12.5, color: SUB, lineHeight: 1.7, marginTop: 3 }}>{desc}</div>}
            </div>
        </div>
    );
};

// 한 DAY의 스팟별 이미지·내용을 전부 렌더 (상품관리 콘텐츠 풀 노출)
export const DayBody: React.FC<{ day: DayData; m: boolean }> = ({ day, m }) => {
    const acts = day.activities || [];
    const accImgs = normalizeImages(day.accommodation?.images);
    const facilities = asArray(day.accommodation?.facilities);
    const meals: Array<{ k: 'breakfast' | 'lunch' | 'dinner'; l: string }> = [{ k: 'breakfast', l: '조식' }, { k: 'lunch', l: '중식' }, { k: 'dinner', l: '석식' }];
    const imgH = m ? undefined : 200;
    return (
        <>
            {day.summary && <div style={{ fontSize: m ? 12.5 : 13.5, color: SUB, lineHeight: 1.7, marginTop: 10 }}>{day.summary}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: m ? 14 : 16, marginTop: 14 }}>
                {acts.length === 0 && <div style={{ fontSize: 12.5, color: FAINT }}>조율 중</div>}
                {acts.map((a, k) => {
                    const imgs = normalizeImages(a.images);
                    return (
                        <div key={k}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                                {a.time && <span style={{ fontSize: m ? 11 : 13, fontWeight: 800, color: BLUE, flex: 'none' }}>{a.time}</span>}
                                <span style={{ fontSize: m ? 13.5 : 15, fontWeight: 700, color: INK }}>{a.title}</span>
                            </div>
                            {imgs.length > 0 && (
                                <div style={{ display: 'grid', gridTemplateColumns: imgs.length === 1 ? '1fr' : '1fr 1fr', gap: m ? 8 : 12, marginTop: 10 }}>
                                    {imgs.map((src, j) => (
                                        <img key={j} src={src} alt={a.title || ''} loading="lazy" decoding="async"
                                            style={{ width: '100%', height: imgH, aspectRatio: m ? '4 / 3' : undefined, objectFit: 'cover', borderRadius: m ? 12 : 14, display: 'block' }} />
                                    ))}
                                </div>
                            )}
                            {a.description && <div style={{ fontSize: m ? 12.5 : 13.5, color: SUB, lineHeight: 1.7, marginTop: imgs.length ? 8 : 3, paddingLeft: a.time && !imgs.length ? (m ? 30 : 48) : 0 }}>{a.description}</div>}
                        </div>
                    );
                })}
            </div>

            {/* 숙소 + 식사 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: m ? 10 : 12, marginTop: 16, alignItems: 'start' }}>
                {day.accommodation?.name ? (
                    <div style={{ background: SECTION, borderRadius: 13, padding: m ? 12 : '13px 15px' }}>
                        <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
                            {accImgs[0]
                                ? <img src={accImgs[0]} alt={day.accommodation.name} loading="lazy" style={{ width: 46, height: 46, flex: 'none', borderRadius: 11, objectFit: 'cover' }} />
                                : <div style={{ width: 46, height: 46, flex: 'none', borderRadius: 11, background: 'linear-gradient(150deg,#b9c4d2,#7d8a99)' }} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: MUTE }}>🛏 숙박</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: INK, marginTop: 2 }}>
                                    {day.accommodation.name}
                                    {day.accommodation.location && <span style={{ fontSize: 11, fontWeight: 600, color: FAINT, marginLeft: 6 }}>({day.accommodation.location})</span>}
                                </div>
                                {facilities.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                        {facilities.map((f, j) => <span key={j} style={{ fontSize: 11.5, color: BODY, background: '#fff', border: `1px solid ${BORDER}`, padding: '3px 9px', borderRadius: 999 }}>{f}</span>)}
                                    </div>
                                )}
                                {day.accommodation.description && <div style={{ fontSize: 12, color: SUB, lineHeight: 1.6, marginTop: 6 }}>{day.accommodation.description}</div>}
                            </div>
                        </div>
                    </div>
                ) : <div />}
                <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                    {meals.map(mm => {
                        const v = (day.meals as any)?.[mm.k];
                        return (
                            <span key={mm.k} style={{ textAlign: 'center', padding: m ? '7px 0' : '8px 0', background: v ? BLUE_BG : SECTION, borderRadius: 10, fontSize: m ? 11.5 : 12.5, color: v ? BLUE_DK : FAINT, fontWeight: v ? 700 : 400 }}>
                                {mm.l} {v || '—'}
                            </span>
                        );
                    })}
                </div>
            </div>
        </>
    );
};

// ─── 섹션 스타일 헬퍼 ───
export const eyebrowStyle = (color: string, m: boolean): React.CSSProperties => ({ fontSize: m ? 11 : 12, fontWeight: 700, letterSpacing: '0.16em', color });
export const h2Style = (m: boolean): React.CSSProperties => ({ fontSize: m ? 18 : 26, fontWeight: 800, color: INK, marginTop: 5 });

// 가이드 대면 안내 (확정·견적 공용 — 공항 미팅 안내)
const GUIDE_MEETING = [
    '몽골 국제공항에 도착하신 후 입국 절차를 마치고 도착 로비로 나와 주세요.',
    '고객님의 성함이 적힌 보드를 든 가이드가 기다리고 있습니다.',
    '가이드와 만나신 뒤 본격적인 몽골 여행이 시작됩니다.',
];

// ─── DAY 타임라인 블록 (헤딩 + 가이드 대면 + 세로 타임라인) ───
export const DayTimelineBlock: React.FC<{
    days: DayData[]; m: boolean;
    startDate?: string;          // 없으면 일자별 날짜 표기 생략(견적의 일정 미확정 단계)
    heading?: string;
    showGuideMeeting?: boolean;
}> = ({ days, m, startDate, heading = '여행 일정표', showGuideMeeting = true }) => (
    <div>
        <div style={eyebrowStyle(BLUE, m)}>TOUR ITINERARY</div>
        <h2 style={h2Style(m)}>{heading}</h2>
        {showGuideMeeting && (
            <div style={{ marginTop: 16, background: BLUE_BG, borderRadius: 16, padding: m ? 16 : '22px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: m ? 16 : 19 }}>🤝</span><span style={{ fontSize: m ? 14 : 16, fontWeight: 800, color: BLUE_DK }}>가이드 미팅 안내</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr 1fr', gap: m ? 8 : 16, marginTop: m ? 10 : 14 }}>
                    {GUIDE_MEETING.map((tx, i) => <div key={i} style={{ fontSize: m ? 11.5 : 13.5, color: BLUE_TX, lineHeight: 1.7 }}>{tx}</div>)}
                </div>
            </div>
        )}
        <div style={{ position: 'relative', marginTop: m ? 18 : 28, paddingLeft: m ? 26 : 34 }}>
            {/* 타임라인 세로 라인 — border는 인쇄 시 배경 그래픽 옵션과 무관하게 항상 찍힌다 */}
            <div style={{ position: 'absolute', left: m ? 5 : 7, top: 8, bottom: 8, width: 0, borderLeft: `2px solid ${BORDER}` }} />
            {days.length === 0 ? (
                <div style={{ padding: '8px 0', fontSize: 13, color: MUTE }}>일정은 현재 준비 중입니다.</div>
            ) : days.map((day, i) => {
                const dayNum = day.day || i + 1;
                const dstr = displayDayDate(day.date, startDate, dayNum);
                return (
                    <div key={dayNum} style={{ position: 'relative', marginBottom: i === days.length - 1 ? 0 : (m ? 18 : 28) }} className="print-break">
                        <div style={{ position: 'absolute', left: m ? -26 : -34, top: 4, width: m ? 12 : 16, height: m ? 12 : 16, borderRadius: '50%', background: BLUE, boxShadow: `0 0 0 ${m ? 3 : 4}px ${BLUE_BG}` }} />
                        <div style={{ background: '#fff', border: `1px solid #EDEFF2`, borderRadius: m ? 14 : 18, boxShadow: '0 2px 12px rgba(26,27,30,.05)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: m ? 10 : 14, padding: m ? '16px 16px 0' : '22px 26px 0' }}>
                                <span style={{ fontSize: m ? 30 : 48, fontWeight: 900, color: BLUE, lineHeight: 0.9, letterSpacing: '-0.03em' }}>{String(dayNum).padStart(2, '0')}</span>
                                <div style={{ paddingBottom: 4 }}>
                                    <div style={{ fontSize: m ? 11 : 12, fontWeight: 700, letterSpacing: '0.08em', color: MUTE }}>DAY {dayNum}{dstr ? ` · ${dstr}` : ''}{day.region ? ` · ${day.region}` : ''}</div>
                                    <div style={{ fontSize: m ? 17 : 22, fontWeight: 800, color: INK, marginTop: 2 }}>{day.title || `${dayNum}일차`}</div>
                                </div>
                            </div>
                            <div style={{ padding: m ? '14px 16px 18px' : '20px 26px 26px' }}>
                                <DayBody day={day} m={m} />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
);

// ─── 포함/불포함 리스트 블록 ───
export const IncludedListsBlock: React.FC<{ included: string[]; excluded: string[]; m: boolean; children?: React.ReactNode }> = ({ included, excluded, m, children }) => (
    <div style={{ padding: m ? '20px 18px' : '38px 56px', borderTop: m ? `8px solid ${SECTION}` : `1px solid #EDEFF2` }} className="print-break">
        <div style={eyebrowStyle(GREEN, m)}>WHAT'S INCLUDED</div>
        <h2 style={h2Style(m)}>요금 포함 사항</h2>
        <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: m ? 13 : '20px 48px', marginTop: m ? 14 : 24 }}>
            {included.map((t, i) => <IncludeItem key={i} ok text={t} />)}
        </div>
        <h2 style={{ ...h2Style(m), fontSize: m ? 16 : 20, marginTop: m ? 22 : 36 }}>불포함 사항</h2>
        <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: m ? 13 : '16px 48px', marginTop: m ? 14 : 16 }}>
            {excluded.map((t, i) => <IncludeItem key={i} ok={false} text={t} />)}
        </div>
        {children}
    </div>
);

// ─── HERO (배지 파라미터화 — 확정: 예약 확정 / 견적: 견적 등) ───
export interface HeroBadge { text: string; dot?: string; bg?: string; fg?: string; }
export const HeroMobile: React.FC<{ badge: HeroBadge; title: string; subtitle: string; chips: string[] }> = ({ badge, title, subtitle, chips }) => (
    <div style={{ padding: '28px 22px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: MUTE }}>
            <span style={{ width: 18, height: 18, borderRadius: 5, background: INK, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11 }}>✦</span>
            {BRAND_EN}
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 18, padding: '5px 11px', background: badge.bg || BLUE_BG, color: badge.fg || BLUE_DK, borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: badge.dot || BLUE }} />{badge.text}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: INK, letterSpacing: '-0.02em', lineHeight: 1.3, marginTop: 12 }}>{title}</div>
        <div style={{ fontSize: 13, color: SUB, lineHeight: 1.6, marginTop: 10 }}>{subtitle}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {chips.map((c, i) => (
                <span key={i} style={{ padding: '6px 12px', border: `1px solid ${BORDER}`, borderRadius: 999, fontSize: 12, fontWeight: 600, color: '#24262B' }}>{c}</span>
            ))}
        </div>
    </div>
);
export const HeroPC: React.FC<{ badge: HeroBadge; title: string; subtitle: string; chips: string[] }> = ({ badge, title, subtitle, chips }) => (
    <div style={{ position: 'relative', padding: '48px 56px', background: 'linear-gradient(150deg,#1c2742,#0c1322)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 82% 18%, rgba(120,150,220,.28), transparent 42%)' }} />
        <div style={{ position: 'relative', maxWidth: 640 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'rgba(255,255,255,.7)', fontSize: 12, fontWeight: 700, letterSpacing: '0.16em' }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,.16)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✦</span>{BRAND_EN}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 20, padding: '6px 13px', background: 'rgba(255,255,255,.14)', color: '#fff', borderRadius: 999, fontSize: 13, fontWeight: 700 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: badge.dot || '#4ade80' }} />{badge.text}
            </div>
            <h1 style={{ margin: '18px 0 0', fontSize: 42, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.25 }}>{title}</h1>
            <div style={{ fontSize: 16, color: 'rgba(255,255,255,.78)', lineHeight: 1.7, marginTop: 14 }}>{subtitle}</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
                {chips.map((c, i) => (
                    <span key={i} style={{ padding: '8px 15px', background: 'rgba(255,255,255,.12)', color: '#fff', borderRadius: 999, fontSize: 13, fontWeight: 600 }}>{c}</span>
                ))}
            </div>
        </div>
    </div>
);

// ─── 여행 정보 그리드 ───
export const InfoBlock: React.FC<{ items: Array<{ label: string; value: string }>; m: boolean }> = ({ items, m }) => m ? (
    <div style={{ padding: '20px 18px', borderTop: `8px solid ${SECTION}` }} className="print-break">
        <div style={{ fontSize: 14, fontWeight: 800, color: INK, marginBottom: 12 }}>여행 정보</div>
        {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '9px 0', borderBottom: i === items.length - 1 ? 'none' : `1px solid ${HAIRLINE}`, gap: 16 }}>
                <span style={{ fontSize: 13, color: MUTE, flex: 'none' }}>{it.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: INK, textAlign: 'right' }}>{it.value}</span>
            </div>
        ))}
    </div>
) : (
    <div style={{ padding: '0 56px', marginTop: -16 }}>
        <div style={{ background: '#fff', border: '1px solid #EDEFF2', borderRadius: 16, padding: '22px 28px', boxShadow: '0 2px 12px rgba(26,27,30,.05)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: INK, marginBottom: 16 }}>여행 정보</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.7fr 0.7fr 1.1fr 0.8fr' }}>
                {items.map((it, i) => (
                    <div key={i} style={{ padding: i === 0 ? '0 24px 0 0' : i === items.length - 1 ? '0 0 0 24px' : '0 24px', borderLeft: i === 0 ? 'none' : `1px solid ${HAIRLINE}` }}>
                        <div style={{ fontSize: 11, color: MUTE, marginBottom: 6 }}>{it.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: INK }}>{it.value}</div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);
