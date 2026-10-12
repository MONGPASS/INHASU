import React from 'react';
import mongoliaHero from '../../assets/login_bg_3.jpg';
import { BRAND, COMPANY_INFO, DEPOSIT_ACCOUNT, DEPOSIT_PAYMENT_METHOD } from '../../constants/company';

/**
 * 고객 문서(견적서·일정표·안내) 공용 파츠 — Trip.com식 블루/네이비 디자인.
 * 견적(/estimate/:id)과 예약 확정 일정표(/documents/itinerary/:id)가 같은 렌더러를 쓴다.
 * 고객 노출 카피는 전부 한국어.
 */

export const DOC_BLUE = '#287DFA';
export const DOC_NAVY = '#0B1B45';

export const normalizeImages = (value: any): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && !!v);
    if (typeof value === 'string') {
        if (value.startsWith('[')) {
            try { const p = JSON.parse(value); return Array.isArray(p) ? p.filter((v): v is string => typeof v === 'string') : []; } catch { return []; }
        }
        return value.startsWith('http') ? [value] : [];
    }
    return [];
};

export const won = (n?: number | null) => (typeof n === 'number' && !Number.isNaN(n)) ? `${n.toLocaleString('ko-KR')}원` : '—';

export interface DocDay {
    day: number;
    title?: string;
    region?: string;
    summary?: string;
    activities: { time?: string; type?: string; title: string; description?: string; images?: string[] | string }[];
    meals?: { breakfast?: string; lunch?: string; dinner?: string };
    accommodation?: { name?: string; location?: string; images?: string[] | string; description?: string } | null;
}

// ─── 상단 브랜드 바 ───
export const DocTopBar: React.FC<{ docLabel: string; number: string; date: string }> = ({ docLabel, number, date }) => (
    <div className="flex items-center justify-between px-1 py-3">
        <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[26px]" style={{ color: DOC_BLUE }}>nights_stay</span>
            <div>
                <p className="text-[15px] font-black leading-none" style={{ color: DOC_NAVY }}>{BRAND.name}</p>
                <p className="text-[9px] font-bold tracking-[0.22em] text-slate-400">{BRAND.nameEn.toUpperCase()}</p>
            </div>
        </div>
        <div className="text-right text-[11px] font-bold text-slate-500">
            <p>{docLabel} 번호: <span className="font-black" style={{ color: DOC_NAVY }}>{number}</span></p>
            <p>발행일: {date}</p>
        </div>
    </div>
);

// ─── 밤하늘 히어로 ───
export const DocHero: React.FC<{ eyebrow: string; title: string; subtitle?: string; chips?: string[] }> = ({ eyebrow, title, subtitle, chips }) => (
    <div className="relative overflow-hidden rounded-3xl">
        <img src={mongoliaHero} alt="" className="h-[230px] w-full object-cover sm:h-[270px]" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(110deg, rgba(11,27,69,0.94) 0%, rgba(22,39,95,0.78) 45%, rgba(40,125,250,0.30) 100%)' }} />
        <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-9 text-white">
            <p className="text-[12px] font-bold tracking-wide text-sky-200">{eyebrow}</p>
            <h1 className="mt-2 max-w-xl text-[28px] font-black leading-tight sm:text-[34px]">{title}</h1>
            {subtitle && <p className="mt-2 max-w-xl text-[12.5px] font-semibold leading-relaxed text-white/85">{subtitle}</p>}
            {chips && chips.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {chips.map((c, i) => <span key={i} className="rounded-xl px-3 py-1.5 text-[12px] font-black text-white" style={{ background: DOC_BLUE }}>{c}</span>)}
                </div>
            )}
        </div>
    </div>
);

// ─── 카드 셸 + 섹션 타이틀 ───
export const DocCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <section className={`print-break rounded-2xl bg-white p-5 sm:p-6 shadow-[0_8px_24px_rgba(11,27,69,0.08)] ${className}`}>{children}</section>
);
export const DocSecTitle: React.FC<{ icon: string; children: React.ReactNode; tone?: 'blue' | 'red' }> = ({ icon, children, tone = 'blue' }) => (
    <h3 className="mb-4 flex items-center gap-2 text-[16px] font-black" style={{ color: tone === 'red' ? '#EF4444' : DOC_NAVY }}>
        <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: tone === 'red' ? '#EF4444' : DOC_BLUE }}>
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </span>
        {children}
    </h3>
);

// ─── 여행 정보 그리드 ───
export const TripInfoGrid: React.FC<{ items: { icon: string; label: string; value: React.ReactNode }[] }> = ({ items }) => (
    <DocCard>
        <DocSecTitle icon="person">여행 정보</DocSecTitle>
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            {items.map((it, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-slate-100 pb-3 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
                    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full" style={{ background: '#EAF3FF', color: DOC_BLUE }}>
                        <span className="material-symbols-outlined text-[22px]">{it.icon}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-slate-400">{it.label}</p>
                        <p className="break-words text-[13px] font-black leading-snug" style={{ color: DOC_NAVY }}>{it.value}</p>
                    </div>
                </div>
            ))}
        </div>
    </DocCard>
);

// ─── 결제 정보 ───
export const PaymentSummary: React.FC<{ total: number; deposit: number; methodNote?: string }> = ({ total, deposit, methodNote }) => {
    const balance = Math.max(0, total - deposit);
    const rows: Array<[React.ReactNode, React.ReactNode]> = [
        ['총 여행 요금', <b key="t" style={{ color: DOC_BLUE }}>{won(total)}</b>],
        [<span key="dl">예약금 <small className="font-semibold text-slate-400">({DEPOSIT_PAYMENT_METHOD} · 입금 확인 후 예약 확정)</small></span>, <b key="d" style={{ color: DOC_BLUE }}>{won(deposit)}</b>],
        [<span key="bl">현지 결제 잔금 <small className="font-semibold text-slate-400">(현지에서 현금 결제)</small></span>, <b key="b" style={{ color: DOC_BLUE }}>{won(balance)}</b>],
        ['결제 방법', <span key="m" className="text-right text-[12px] font-bold text-slate-600">{methodNote || `${DEPOSIT_PAYMENT_METHOD} (잔금은 현지에서 현금 결제)`}</span>],
        ['입금 계좌', <span key="a" className="text-right text-[12px] font-bold text-slate-600">{DEPOSIT_ACCOUNT.bank} {DEPOSIT_ACCOUNT.number} (예금주 {DEPOSIT_ACCOUNT.holder})</span>],
    ];
    return (
        <DocCard>
            <DocSecTitle icon="payments">결제 정보</DocSecTitle>
            <div className="grid gap-4 sm:grid-cols-[300px_1fr]">
                <div className="relative overflow-hidden rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #2F86FF 0%, #1656D6 100%)' }}>
                    <span className="material-symbols-outlined absolute right-4 top-4 text-[34px] opacity-40">account_balance_wallet</span>
                    <p className="text-[12px] font-bold text-white/85">총 여행 요금</p>
                    <p className="mt-2 text-[32px] font-black tracking-tight">{won(total)}</p>
                    <p className="mt-1 text-[10.5px] font-bold text-white/70">(원화)</p>
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-100">
                    {rows.map(([l, v], i) => (
                        <div key={i} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-[13px] font-bold last:border-b-0" style={{ color: DOC_NAVY }}>
                            <span>{l}</span>{v}
                        </div>
                    ))}
                </div>
            </div>
        </DocCard>
    );
};

// ─── 포함 / 불포함 ───
export const IncludeExclude: React.FC<{ included: string[]; excluded: string[] }> = ({ included, excluded }) => (
    <div className="grid gap-4 sm:grid-cols-2">
        <DocCard className="!shadow-[0_8px_24px_rgba(40,125,250,0.10)]">
            <DocSecTitle icon="check">포함 사항</DocSecTitle>
            <ul className="space-y-2.5">
                {included.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] font-bold" style={{ color: DOC_NAVY }}>
                        <span className="material-symbols-outlined mt-px text-[18px]" style={{ color: DOC_BLUE, fontVariationSettings: "'FILL' 1" }}>check_circle</span>{t}
                    </li>
                ))}
                {included.length === 0 && <li className="text-[12px] font-semibold text-slate-400">—</li>}
            </ul>
        </DocCard>
        <DocCard className="!shadow-[0_8px_24px_rgba(239,68,68,0.08)]">
            <DocSecTitle icon="close" tone="red">불포함 사항</DocSecTitle>
            <ul className="space-y-2.5">
                {excluded.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] font-bold text-slate-600">
                        <span className="material-symbols-outlined mt-px text-[18px] text-red-400" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>{t}
                    </li>
                ))}
                {excluded.length === 0 && <li className="text-[12px] font-semibold text-slate-400">—</li>}
            </ul>
        </DocCard>
    </div>
);

// ─── 예약 흐름 3단계 ───
export const BookingSteps: React.FC = () => {
    const steps = [
        { icon: 'edit_calendar', t: '예약 신청' },
        { icon: 'account_balance', t: '예약금 계좌이체', s: '(입금 확인 후 예약 확정)' },
        { icon: 'account_balance_wallet', t: '현지에서 잔금 결제', s: '(현금)' },
    ];
    return (
        <DocCard>
            <DocSecTitle icon="description">예약 안내</DocSecTitle>
            <div className="grid gap-3 sm:grid-cols-[1.2fr_auto_1.2fr_auto_1.2fr] sm:items-center">
                {steps.map((st, i) => (
                    <React.Fragment key={st.t}>
                        {i > 0 && <span className="material-symbols-outlined hidden text-slate-300 sm:block">chevron_right</span>}
                        <div className="rounded-2xl bg-[#F4F8FF] px-3 py-4 text-center">
                            <span className="material-symbols-outlined text-[30px]" style={{ color: DOC_BLUE }}>{st.icon}</span>
                            <p className="mt-1 text-[11.5px] font-black leading-tight" style={{ color: DOC_NAVY }}>{st.t}</p>
                            {st.s && <p className="text-[10.5px] font-bold text-slate-400">{st.s}</p>}
                        </div>
                    </React.Fragment>
                ))}
            </div>
            <p className="mt-4 text-[11.5px] font-bold leading-relaxed text-slate-500">
                안내해 드리는 계좌로 예약금을 입금하고 '입금 완료'를 알려 주시면, 담당자가 확인한 뒤 예약이 확정됩니다. 잔금은 현지에서 현금으로 결제합니다.
            </p>
        </DocCard>
    );
};

// ─── DAY 카드 (상세 일정표) ───
const MEAL_DEFS: Array<{ key: 'breakfast' | 'lunch' | 'dinner'; label: string; icon: string; color: string }> = [
    { key: 'breakfast', label: '조식', icon: 'egg_alt', color: '#F59E0B' },
    { key: 'lunch', label: '중식', icon: 'ramen_dining', color: '#10B981' },
    { key: 'dinner', label: '석식', icon: 'restaurant', color: '#F97316' },
];

export const DayCard: React.FC<{ day: DocDay }> = ({ day }) => {
    const photo = day.activities.map(a => normalizeImages(a.images)[0]).find(Boolean);
    const accImgs = normalizeImages(day.accommodation?.images);
    const meals = day.meals || {};
    return (
        <DocCard className="!p-0 overflow-hidden print:break-inside-avoid">
            <div className="flex flex-wrap items-center gap-3 px-5 pt-5 sm:px-6">
                <span className="rounded-full px-4 py-1.5 text-[13px] font-black text-white" style={{ background: DOC_BLUE }}>DAY {day.day}</span>
                <h4 className="min-w-0 flex-1 truncate text-[16px] font-black" style={{ color: DOC_NAVY }}>{day.title || `${day.day}일차`}</h4>
                {day.region && (
                    <span className="inline-flex items-center gap-1 text-[12px] font-black" style={{ color: DOC_BLUE }}>
                        <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>{day.region}
                    </span>
                )}
            </div>
            {day.summary && <p className="px-5 pt-2 text-[12px] font-semibold leading-relaxed text-slate-500 sm:px-6">{day.summary}</p>}

            <div className={`grid gap-4 px-5 py-4 sm:px-6 ${photo ? 'lg:grid-cols-[300px_1fr_150px]' : 'lg:grid-cols-[1fr_150px]'}`}>
                {photo && <img src={photo} alt={day.title || ''} loading="lazy" className="h-[180px] w-full rounded-xl object-cover lg:h-full lg:max-h-[230px]" />}
                <div>
                    <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-black" style={{ color: DOC_BLUE }}>
                        <span className="material-symbols-outlined text-[17px]">event_note</span>일정
                    </p>
                    <ul className="space-y-2">
                        {day.activities.map((a, i) => (
                            <li key={i} className="flex items-start gap-2 text-[12.5px] font-bold" style={{ color: DOC_NAVY }}>
                                <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full" style={{ background: DOC_BLUE }} />
                                <span>{a.time ? `${a.time} ` : ''}{a.title}</span>
                            </li>
                        ))}
                        {day.activities.length === 0 && <li className="text-[12px] font-semibold text-slate-400">조율 중</li>}
                    </ul>
                </div>
                <div className="flex gap-2 lg:flex-col lg:justify-start lg:border-l lg:border-slate-100 lg:pl-4">
                    {MEAL_DEFS.map(m => (
                        <div key={m.key} className="flex flex-1 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 lg:flex-none">
                            <span className="material-symbols-outlined text-[20px]" style={{ color: m.color }}>{m.icon}</span>
                            <div className="leading-tight">
                                <p className="text-[10px] font-black" style={{ color: m.color }}>{m.label}</p>
                                <p className="text-[11.5px] font-bold text-slate-600">{(meals as any)[m.key] || '—'}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {day.accommodation?.name && (
                <div className="flex items-center gap-3 border-t border-slate-100 bg-[#F4F8FF] px-5 py-3.5 sm:px-6">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-white" style={{ background: DOC_BLUE }}>
                        <span className="material-symbols-outlined text-[20px]">apartment</span>
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10.5px] font-black" style={{ color: DOC_BLUE }}>숙박 정보</p>
                        <p className="truncate text-[13.5px] font-black" style={{ color: DOC_NAVY }}>
                            {day.accommodation.name}
                            {day.accommodation.location && <span className="ml-2 text-[11px] font-bold text-slate-400">({day.accommodation.location})</span>}
                        </p>
                        {day.accommodation.description && <p className="truncate text-[11px] font-semibold text-slate-500">{day.accommodation.description}</p>}
                    </div>
                    {accImgs[0] && <img src={accImgs[0]} alt={day.accommodation.name} loading="lazy" className="h-14 w-24 flex-none rounded-lg object-cover" />}
                </div>
            )}
        </DocCard>
    );
};

// 상품 페이지(MobileItineraryTimeline)와 동일한 "사진 타임라인" 디자인을 문서용으로 재현.
// DocCard 한 칸 안에서 day의 activities[](제목·시각·설명·사진)를 스팟별 카드로, 숙소·식사는 스파인 행으로 노출.
// 색상은 문서 톤(파랑)으로 통일, 인쇄 친화(no 라이트박스/스티키).
export const DayTimeline: React.FC<{ day: DocDay }> = ({ day }) => {
    const meals = day.meals || {};
    const accImgs = normalizeImages(day.accommodation?.images);
    const hasMeals = !!(meals.breakfast || meals.lunch || meals.dinner);

    return (
        <DocCard className="!p-0 overflow-hidden print:break-inside-avoid">
            {/* Day header */}
            <div className="flex flex-wrap items-center gap-3 px-5 pt-5 sm:px-6">
                <span className="rounded-full px-4 py-1.5 text-[13px] font-black text-white" style={{ background: DOC_BLUE }}>DAY {day.day}</span>
                <h4 className="min-w-0 flex-1 truncate text-[16px] font-black" style={{ color: DOC_NAVY }}>{day.title || `${day.day}일차`}</h4>
                {day.region && (
                    <span className="inline-flex items-center gap-1 text-[12px] font-black" style={{ color: DOC_BLUE }}>
                        <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>{day.region}
                    </span>
                )}
            </div>
            {day.summary && <p className="px-5 pt-2 text-[12px] font-semibold leading-relaxed text-slate-500 sm:px-6">{day.summary}</p>}

            {/* Spine timeline */}
            <div className="px-5 py-4 sm:px-6">
                <div className="relative">
                    <div className="absolute left-[15px] top-1 bottom-1 w-0.5" style={{ background: '#D7E6FF' }} aria-hidden />

                    {day.activities.length === 0 && (
                        <p className="pl-11 text-[12px] font-semibold text-slate-400">조율 중</p>
                    )}

                    {day.activities.map((a, i) => {
                        const imgs = normalizeImages(a.images);
                        // 사진 없는 항목 = 위치/소제목 행 (카드 없이 점+텍스트)
                        if (imgs.length === 0) {
                            return (
                                <div key={i} className="grid grid-cols-[32px_1fr] gap-3 mb-5 last:mb-0">
                                    <div className="flex items-start justify-center pt-1.5 relative z-10">
                                        <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: DOC_BLUE }} />
                                    </div>
                                    <div className="pt-0.5 min-w-0">
                                        {(a.title || a.time) && (
                                            <div className="text-[14px] font-black leading-snug" style={{ color: DOC_NAVY }}>
                                                {a.time ? <span className="text-[12px] font-bold text-slate-400">{a.time}{' '}</span> : ''}{a.title}
                                            </div>
                                        )}
                                        {a.description && <div className="mt-1 text-[12.5px] font-semibold leading-relaxed text-slate-600 whitespace-pre-wrap">{a.description}</div>}
                                    </div>
                                </div>
                            );
                        }
                        // 사진 있는 항목 = 스팟 카드 (사진 그리드 + 제목 + 설명)
                        const visible = imgs.slice(0, 3);
                        const gridCols = visible.length === 1 ? 'grid-cols-1' : visible.length === 2 ? 'grid-cols-2' : 'grid-cols-3';
                        return (
                            <div key={i} className="grid grid-cols-[32px_1fr] gap-3 mb-5 last:mb-0">
                                <div className="flex justify-center pt-1.5 relative z-10">
                                    <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: DOC_BLUE }} />
                                </div>
                                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 print:break-inside-avoid">
                                    {a.title && <h5 className="text-[14px] font-black leading-snug" style={{ color: DOC_NAVY }}>{a.title}</h5>}
                                    {a.time && <div className="mt-0.5 text-[11.5px] font-bold text-slate-400">{a.time}</div>}
                                    <div className={`mt-2.5 grid gap-1.5 ${gridCols}`}>
                                        {visible.map((src, k) => (
                                            <img key={k} src={src} alt={a.title || ''} loading="lazy" decoding="async" className={`w-full ${visible.length === 1 ? 'aspect-[16/9]' : 'aspect-[4/3]'} rounded-lg object-cover`} />
                                        ))}
                                    </div>
                                    {a.description && <p className="mt-2.5 text-[12.5px] font-semibold leading-relaxed text-slate-700 whitespace-pre-wrap">{a.description}</p>}
                                </div>
                            </div>
                        );
                    })}

                    {/* 숙소 */}
                    {day.accommodation?.name && (
                        <div className="grid grid-cols-[32px_1fr] gap-3 mb-5 last:mb-0">
                            <div className="flex justify-center pt-1 relative z-10">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full border bg-white" style={{ borderColor: DOC_BLUE }}>
                                    <span className="material-symbols-outlined text-[14px]" style={{ color: DOC_BLUE }}>apartment</span>
                                </span>
                            </div>
                            <div className="min-w-0 rounded-xl border bg-[#F4F8FF] p-3.5" style={{ borderColor: '#D7E6FF' }}>
                                <p className="text-[10.5px] font-black" style={{ color: DOC_BLUE }}>숙박 정보</p>
                                <p className="text-[14px] font-black" style={{ color: DOC_NAVY }}>
                                    {day.accommodation.name}
                                    {day.accommodation.location && <span className="ml-2 text-[11px] font-bold text-slate-400">({day.accommodation.location})</span>}
                                </p>
                                {accImgs.length > 0 && (
                                    <div className={`mt-2 grid gap-1.5 ${accImgs.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                        {accImgs.slice(0, 2).map((src, k) => (
                                            <img key={k} src={src} alt={day.accommodation?.name || ''} loading="lazy" decoding="async" className={`w-full ${accImgs.length === 1 ? 'aspect-[16/9]' : 'aspect-[4/3]'} rounded-lg object-cover`} />
                                        ))}
                                    </div>
                                )}
                                {day.accommodation.description && <p className="mt-2 text-[12px] font-semibold leading-relaxed text-slate-600 whitespace-pre-wrap">{day.accommodation.description}</p>}
                            </div>
                        </div>
                    )}

                    {/* 식사 */}
                    {hasMeals && (
                        <div className="grid grid-cols-[32px_1fr] gap-3">
                            <div className="flex justify-center pt-1 relative z-10">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white">
                                    <span className="material-symbols-outlined text-[14px] text-slate-500">restaurant_menu</span>
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2 pt-1">
                                {MEAL_DEFS.map(m => (meals as any)[m.key] ? (
                                    <span key={m.key} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11.5px]">
                                        <span className="material-symbols-outlined text-[16px]" style={{ color: m.color }}>{m.icon}</span>
                                        <span className="font-black" style={{ color: m.color }}>{m.label}</span>
                                        <span className="font-bold text-slate-600">{(meals as any)[m.key]}</span>
                                    </span>
                                ) : null)}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DocCard>
    );
};

// ─── 안내 & 팁 (공통 안내 페이지) ───
export const GuideTips: React.FC<{
    notices: { title: string; body: string }[];
    emergencyPhone?: string;
    emergencyEmail?: string;
    closingMessage?: string;
}> = ({ notices, emergencyPhone, emergencyEmail, closingMessage }) => {
    const dos = ['유목민 가정에서는 인사를 소중히', '자연을 지키고 쓰레기는 되가져가기', '촬영 전에 먼저 양해 구하기', '가이드·현지 분들께 예의와 매너를'];
    const donts = ['초원이나 자연에 쓰레기 버리지 않기', '가축이나 야생동물 놀라게 하지 않기', '허가 없는 드론 촬영 금지', '문화 유적·종교 시설에서 소란 피우지 않기'];
    return (
        <>
            <DocCard>
                <DocSecTitle icon="info">안내·유의 사항</DocSecTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                    {notices.map((n, i) => (
                        <div key={i} className="flex gap-2.5 rounded-xl bg-slate-50 p-3.5">
                            <span className="material-symbols-outlined mt-px text-[19px]" style={{ color: DOC_BLUE }}>info</span>
                            <div>
                                <p className="text-[12.5px] font-black" style={{ color: DOC_NAVY }}>{n.title}</p>
                                <p className="mt-1 whitespace-pre-wrap text-[11.5px] font-semibold leading-relaxed text-slate-500">{n.body}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </DocCard>

            <DocCard>
                <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                        <DocSecTitle icon="partly_cloudy_day">몽골의 기후</DocSecTitle>
                        <div className="overflow-hidden rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-2 bg-[#FFF7E6] px-4 py-2.5">
                                <span className="material-symbols-outlined text-[18px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>sunny</span>
                                <p className="text-[12.5px] font-black text-amber-700">여름(6~8월) 평균 기온</p>
                            </div>
                            {[
                                { icon: 'light_mode', label: '낮', v: '20 ~ 30℃', c: '#F59E0B' },
                                { icon: 'dark_mode', label: '밤', v: '5 ~ 15℃', c: '#6366F1' },
                            ].map((r, i) => (
                                <div key={i} className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
                                    <span className="flex items-center gap-2 text-[12px] font-bold text-slate-500">
                                        <span className="material-symbols-outlined text-[17px]" style={{ color: r.c }}>{r.icon}</span>{r.label}
                                    </span>
                                    <b className="text-[13px]" style={{ color: DOC_NAVY }}>{r.v}</b>
                                </div>
                            ))}
                        </div>
                        <ul className="mt-3 space-y-1.5 text-[11.5px] font-bold text-slate-500">
                            <li>· 건조하고 낮과 밤의 일교차가 큽니다.</li>
                            <li>· 아침저녁으로 쌀쌀하니 겉옷을 준비해 주세요.</li>
                        </ul>
                    </div>
                    <div>
                        <DocSecTitle icon="checkroom">추천 복장·준비물</DocSecTitle>
                        <ul className="space-y-2">
                            {['바람막이 / 방수 재킷', '얇은 플리스·긴소매 상하의', '선글라스·모자', '자외선 차단제·립밤', '걷기 편한 운동화 / 트레킹화'].map((t, i) => (
                                <li key={i} className="flex items-start gap-2 rounded-lg bg-[#F4F8FF] px-3 py-2 text-[12px] font-bold" style={{ color: DOC_NAVY }}>
                                    <span className="material-symbols-outlined mt-px text-[16px]" style={{ color: DOC_BLUE, fontVariationSettings: "'FILL' 1" }}>check_box</span>{t}
                                </li>
                            ))}
                        </ul>
                        <div className="mt-3 rounded-xl bg-[#EAF3FF] p-3">
                            <p className="text-[11px] font-black" style={{ color: '#1656D6' }}>TIP</p>
                            <p className="mt-0.5 text-[11.5px] font-bold leading-relaxed text-slate-600">자외선이 강하므로 자외선 차단제와 선글라스는 필수입니다!</p>
                        </div>
                    </div>
                </div>
            </DocCard>

            <DocCard>
                <DocSecTitle icon="luggage">준비물 체크리스트</DocSecTitle>
                <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
                    {['여권 (잔여 유효기간 6개월 이상)', '상비약 (소화제·감기약 등)', '보조 배터리 / 충전기', '변환 플러그 (220V·C타입)', '세면도구 / 물티슈', '텀블러 / 물통', '카메라 / 삼각대', '긴소매 옷 / 여벌 옷', '우비 또는 접이식 우산'].map((t, i) => (
                        <div key={i} className="flex items-start gap-2 border-b border-slate-50 py-1.5 text-[12px] font-bold" style={{ color: DOC_NAVY }}>
                            <span className="material-symbols-outlined mt-px text-[16px]" style={{ color: DOC_BLUE, fontVariationSettings: "'FILL' 1" }}>check_box</span>{t}
                        </div>
                    ))}
                </div>
            </DocCard>

            <DocCard>
                <DocSecTitle icon="tips_and_updates">초원 여행 팁</DocSecTitle>
                <div className="grid gap-3 sm:grid-cols-3">
                    {[
                        { icon: 'bedroom_baby', t: '승마 체험', tips: ['긴바지 착용을 추천합니다', '운동화나 부츠가 안전합니다', '가이드의 안내에 따라 주세요'] },
                        { icon: 'nights_stay', t: '별밤·은하수 관측', tips: ['밤 10시 이후가 가장 선명합니다', '스마트폰 조명은 삼가 주세요', '삼각대와 따뜻한 겉옷이 있으면 좋습니다'] },
                        { icon: 'cabin', t: '게르 숙박', tips: ['밤에는 기온이 내려갈 수 있습니다', '따뜻한 잠옷을 준비해 주세요', '전기·샤워 시설도 이용 가능'] },
                    ].map((c, i) => (
                        <div key={i} className="rounded-2xl border border-slate-100 p-4">
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: '#EAF3FF', color: DOC_BLUE }}>
                                <span className="material-symbols-outlined text-[24px]">{c.icon}</span>
                            </span>
                            <p className="mt-2.5 text-[13px] font-black" style={{ color: DOC_NAVY }}>{c.t}</p>
                            <ul className="mt-1.5 space-y-1 text-[11px] font-bold leading-relaxed text-slate-500">
                                {c.tips.map((t, j) => <li key={j}>· {t}</li>)}
                            </ul>
                        </div>
                    ))}
                </div>
            </DocCard>

            <DocCard>
                <DocSecTitle icon="handshake">현지 매너</DocSecTitle>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                        <p className="mb-2.5 flex items-center gap-1.5 text-[13px] font-black text-emerald-600"><span className="material-symbols-outlined text-[18px]">thumb_up</span>지켜 주세요</p>
                        <ul className="space-y-2">{dos.map((t, i) => <li key={i} className="flex items-start gap-2 text-[12px] font-bold text-emerald-800"><span className="material-symbols-outlined mt-px text-[16px] text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>{t}</li>)}</ul>
                    </div>
                    <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
                        <p className="mb-2.5 flex items-center gap-1.5 text-[13px] font-black text-red-500"><span className="material-symbols-outlined text-[18px]">block</span>삼가 주세요</p>
                        <ul className="space-y-2">{donts.map((t, i) => <li key={i} className="flex items-start gap-2 text-[12px] font-bold text-red-700"><span className="material-symbols-outlined mt-px text-[16px] text-red-400" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>{t}</li>)}</ul>
                    </div>
                </div>
            </DocCard>

            <DocCard>
                <DocSecTitle icon="call">긴급 연락처</DocSecTitle>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                        { icon: 'support_agent', t: '당사 (현지·한국어)', v: emergencyPhone || COMPANY_INFO.phoneKR, s: '24시간 응대' },
                        { icon: 'mail', t: '이메일', v: emergencyEmail || COMPANY_INFO.email, s: '상시 접수' },
                        { icon: 'emergency', t: '구급', v: '103', s: '(현지)' },
                        { icon: 'local_police', t: '경찰', v: '102', s: '(현지)' },
                    ].map((c, i) => (
                        <div key={i} className="rounded-2xl border border-slate-100 p-3.5 text-center">
                            <span className="material-symbols-outlined text-[26px]" style={{ color: DOC_BLUE }}>{c.icon}</span>
                            <p className="mt-1 text-[10.5px] font-black text-slate-400">{c.t}</p>
                            <p className="break-words text-[11px] font-black leading-snug" style={{ color: DOC_NAVY }}>{c.v}</p>
                            <p className="text-[10px] font-bold text-slate-400">{c.s}</p>
                        </div>
                    ))}
                </div>
            </DocCard>

            {closingMessage && (
                <div className="relative overflow-hidden rounded-2xl">
                    <img src={mongoliaHero} alt="" className="h-[110px] w-full object-cover" />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(11,27,69,0.92) 0%, rgba(40,125,250,0.45) 100%)' }} />
                    <p className="absolute inset-0 flex items-center px-6 text-[15px] font-black text-white">{closingMessage}</p>
                </div>
            )}
        </>
    );
};

// ─── 푸터 (브랜드 + 신뢰 배지) ───
export const DocFooter: React.FC = () => (
    <div className="rounded-2xl bg-white px-5 py-5 shadow-[0_8px_24px_rgba(11,27,69,0.08)] sm:px-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full text-white" style={{ background: DOC_NAVY }}>
                    <span className="material-symbols-outlined text-[24px]">nights_stay</span>
                </span>
                <div>
                    <p className="text-[15px] font-black" style={{ color: DOC_NAVY }}>{BRAND.name}</p>
                    <p className="text-[10px] font-bold tracking-[0.18em] text-slate-400">{BRAND.nameEn.toUpperCase()} | PRIVATE TOUR SPECIALIST</p>
                </div>
            </div>
            <div className="flex gap-4">
                {[
                    { icon: 'verified_user', t: '안심 여행', s: '현지 전문 가이드 동행' },
                    { icon: 'diamond', t: '맞춤 여행', s: '고객님만을 위한 1:1 플랜' },
                    { icon: 'favorite', t: '최고의 경험', s: '잊지 못할 추억을' },
                ].map((b, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[20px]" style={{ color: DOC_BLUE }}>{b.icon}</span>
                        <div className="leading-tight">
                            <p className="text-[11px] font-black" style={{ color: DOC_NAVY }}>{b.t}</p>
                            <p className="text-[9.5px] font-bold text-slate-400">{b.s}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
        <p className="mt-4 border-t border-slate-100 pt-3 text-[10.5px] font-bold text-slate-400">
            ※ 본 일정은 현지 사정(날씨·교통 상황 등)에 따라 변경될 수 있습니다.
        </p>
    </div>
);
