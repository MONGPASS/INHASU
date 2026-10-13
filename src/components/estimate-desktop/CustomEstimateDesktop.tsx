import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuoteHero } from './QuoteHero';
import { useSpotImages } from '../../hooks/useSpotImages';
import { MW, MW_FONT_EN, MW_GRADIENT, MW_STICKY_TOP, isUsableImage } from '../desktop-primitives/mwTokens';
import {
    CITY_STAYS, DEST_CATEGORIES, DEST_UNSURE, EMAIL_RE, FLIGHT_NO, FLIGHT_OPTIONS, GER_STAYS, MAX_PAX, PHONE_RE, TRAVEL_STYLES, TRIP_TYPES, VEHICLES, WEEK,
    flightYes, koDate, pad, phoneDigits, plusDays, quotePeople, quoteStepId, quoteTripLength, routeAdvice, toKey, totalPax, vehicleAdvice, vehicleCapacity,
    type DestCategory,
} from './quoteForm';
import {
    KakaoConsultButton, QuoteAdvice, QuoteAgreeRow, QuoteErrorBox, QuoteFieldNote, QuoteFileField, QuoteGroupLabel, QuoteHelp, QuoteHoneypot, RecentQuoteBar,
} from './quoteParts';
import { useQuoteForm } from './useQuoteForm';

type CalKind = 'start' | 'end';

/**
 * PC 맞춤 견적 요청: 히어로 + 8개 스텝 폼 + 트래블 패스(요약·제출) 카드.
 * 선택지·검증·제출은 quoteForm.ts / useQuoteForm.ts(모바일 폼과 공용)에 있고,
 * 접수된 요청은 견적 시스템(`POST /api/requests`)으로 들어간다.
 */
export function CustomEstimateDesktop() {
    const navigate = useNavigate();
    const { pick } = useSpotImages();
    const q = useQuoteForm();
    const { form, set, steps } = q;
    const [cal, setCal] = useState<CalKind | null>(null);
    // 마지막으로 누른 관심 지역(설명 표시용 — 저장하지 않는다)
    const [spotFocus, setSpotFocus] = useState('');
    const [touched, setTouched] = useState({ phone: false, email: false });

    const category = DEST_CATEGORIES.find((c) => c.name === form.destination);
    const unsure = form.destination === DEST_UNSURE;
    const route = routeAdvice(form);
    const vehicle = vehicleAdvice(form);
    const pax = totalPax(form);
    const tripLength = quoteTripLength(form);
    const phoneBad = touched.phone && !!form.phone && !PHONE_RE.test(form.phone);
    const emailBad = touched.email && !!form.email.trim() && !EMAIL_RE.test(form.email.trim());

    const chooseDestination = (name: string) => {
        q.pickDestination(name);
        setSpotFocus('');
    };

    return (
        <div style={{ background: '#fff' }}>
            <QuoteHero onHome={() => navigate('/')} />

            <section style={{ background: '#FFFFFF' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px 104px', display: 'flex', gap: 56, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: '1 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        {q.recent && (
                            <div style={{ marginBottom: 40 }}>
                                <RecentQuoteBar link={q.recent} />
                            </div>
                        )}

                        <Step n={1} done={steps[0]} title="가고 싶은 곳" hint="투어 1개 선택 · 관심 지역은 복수 선택">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
                                {DEST_CATEGORIES.map((d) => {
                                    const on = form.destination === d.name;
                                    const spotImg = pick(d.spot);
                                    return (
                                        <button
                                            key={d.name}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() => chooseDestination(d.name)}
                                            style={{
                                                position: 'relative',
                                                aspectRatio: '16/9',
                                                padding: 0,
                                                borderRadius: 16,
                                                overflow: 'hidden',
                                                border: 0,
                                                outline: `3px solid ${on ? MW.mint : MW.line2}`,
                                                outlineOffset: -3,
                                                background: '#DDE2DF',
                                                cursor: 'pointer',
                                                color: '#fff',
                                                textAlign: 'left',
                                                fontFamily: 'inherit',
                                            }}
                                        >
                                            <img src={isUsableImage(spotImg) ? spotImg : d.img} alt="" loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <span style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg,rgba(0,0,0,0.08) 25%,rgba(0,0,0,0.72) 100%)' }} />
                                            {d.badge && (
                                                <span style={{ position: 'absolute', left: 12, top: 12, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.92)', color: MW.mintDeep, fontSize: 11, fontWeight: 700 }}>{d.badge}</span>
                                            )}
                                            <span style={{ position: 'absolute', right: 10, top: 10, width: 26, height: 26, borderRadius: '50%', boxSizing: 'border-box', border: '2px solid #fff', background: on ? MW.mint : 'transparent', color: MW.navy, fontSize: 13, lineHeight: '22px', textAlign: 'center' }}>
                                                {on ? '✓' : ''}
                                            </span>
                                            <span style={{ position: 'absolute', left: 14, right: 14, bottom: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                <span style={{ fontSize: 16, fontWeight: 900 }}>{d.name}</span>
                                                <span style={{ fontSize: 12, lineHeight: 1.5, color: '#E6ECEA' }}>{d.tagline}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {category && (
                                <RegionPanel
                                    category={category}
                                    selected={form.destSpots}
                                    focus={spotFocus}
                                    onToggle={(name) => {
                                        q.toggleIn('destSpots', name);
                                        setSpotFocus(name);
                                    }}
                                />
                            )}

                            <button
                                type="button"
                                aria-pressed={unsure}
                                onClick={() => chooseDestination(DEST_UNSURE)}
                                style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 68, padding: '12px 18px', borderRadius: 14, border: `1.5px ${unsure ? 'solid' : 'dashed'} ${unsure ? MW.mint : '#B8C4C1'}`, background: unsure ? MW.mintTint : '#FAFBFA', cursor: 'pointer', textAlign: 'left', color: MW.navy, transition: 'all .15s', fontFamily: 'inherit' }}
                            >
                                <Check on={unsure} size={20} />
                                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ fontSize: 15, fontWeight: 700 }}>{unsure ? '여행사 추천으로 선택됨' : '지역 선택을 여행사에 맡기기'}</span>
                                    <span style={{ fontSize: 12, color: MW.mute }}>상담 후 일정과 취향에 맞는 지역을 제안해 드려요.</span>
                                </span>
                            </button>

                            {route && <QuoteAdvice text={route.text} warn={route.warn} />}
                        </Step>

                        <Step n={2} done={steps[1]} title="여행 기간" hint="몽골 입국일과 귀국일 선택">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                                <DateField label="몽골 입국일" value={form.depart} active={cal === 'start'} onClick={() => setCal(cal === 'start' ? null : 'start')} />
                                <DateField label="귀국일" value={form.return_} active={cal === 'end'} onClick={() => setCal(cal === 'end' ? null : 'end')} />
                                {cal && (
                                    <Calendar
                                        kind={cal}
                                        start={form.depart}
                                        end={form.return_}
                                        onPick={(v) => {
                                            if (cal === 'start') {
                                                q.pickDepart(v);
                                                setCal('end');
                                            } else {
                                                set({ return_: v });
                                                setCal(null);
                                            }
                                        }}
                                        onClear={() => {
                                            if (cal === 'start') q.pickDepart('');
                                            else set({ return_: '' });
                                        }}
                                        onClose={() => setCal(null)}
                                    />
                                )}
                            </div>
                            {tripLength && <span aria-live="polite" style={{ fontSize: 15, fontWeight: 700, color: MW.mintDeep }}>총 {tripLength}</span>}
                        </Step>

                        <Step n={3} done={steps[2]} title="참가 인원" hint="성인 1명 이상">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
                                <Counter label="성인" sub="만 12세 이상" value={form.adult} min={1} onChange={(v) => set({ adult: v })} />
                                <Counter label="아동" sub="만 2~11세" value={form.child} min={0} onChange={(v) => set({ child: v })} />
                                <Counter label="유아" sub="만 2세 미만" value={form.infant} min={0} onChange={(v) => set({ infant: v })} />
                            </div>
                        </Step>

                        <Step n={4} done={steps[3]} title="여행 스타일" hint="동행 형태와 여행 취향">
                            <Group>
                                <QuoteGroupLabel>누구와 떠나시나요? <Required /></QuoteGroupLabel>
                                <Pills options={TRIP_TYPES} isOn={(v) => form.tripType === v} onPick={(v) => set({ tripType: v })} />
                            </Group>
                            <Group>
                                <QuoteGroupLabel note="선택 사항 · 복수 선택 가능">어떤 경험을 원하시나요?</QuoteGroupLabel>
                                <Pills options={TRAVEL_STYLES} isOn={(v) => form.travelStyles.includes(v)} onPick={(v) => q.toggleIn('travelStyles', v)} />
                            </Group>
                        </Step>

                        <Step n={5} done={steps[4]} title="숙소·차량" hint="시내 숙소 · 게르 등급 · 차량">
                            <Group>
                                <QuoteGroupLabel>시내(울란바토르) 숙소 <Required /></QuoteGroupLabel>
                                <Pills options={CITY_STAYS} isOn={(v) => form.cityStay === v} onPick={(v) => set({ cityStay: v })} />
                                <QuoteHelp>호텔 등급은 객실 상태와 조식·부대시설 수준을 기준으로 선택해 주세요.</QuoteHelp>
                            </Group>
                            <Group>
                                <QuoteGroupLabel note="시내 외 지역은 게르만 가능해요">투어 지역 게르 등급 <Required /></QuoteGroupLabel>
                                <Pills options={GER_STAYS} isOn={(v) => form.gerStay === v} onPick={(v) => set({ gerStay: v })} />
                                <QuoteHelp>고급 게르는 전용 또는 개선된 편의시설을 우선 배정하며, 지역별 실제 시설은 견적서에서 확인할 수 있어요.</QuoteHelp>
                            </Group>
                            <Group>
                                <QuoteGroupLabel>차량 <Required /></QuoteGroupLabel>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
                                    {VEHICLES.map((v) => {
                                        const on = form.vehicle === v;
                                        const cap = vehicleCapacity(v);
                                        const over = cap < pax;
                                        return (
                                            <button
                                                key={v}
                                                type="button"
                                                aria-pressed={on}
                                                onClick={() => set({ vehicle: v })}
                                                style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 72, padding: '14px 18px', borderRadius: 14, border: `1.5px solid ${on ? (over ? MW.red : MW.mint) : MW.line2}`, background: on ? (over ? '#FDF0EE' : MW.mintTint) : '#FFFFFF', cursor: 'pointer', textAlign: 'left', color: MW.navy, transition: 'all .15s', fontFamily: 'inherit' }}
                                            >
                                                <Check on={on} size={20} />
                                                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    <span style={{ fontSize: 15, fontWeight: 700 }}>{v}</span>
                                                    <span style={{ fontSize: 12, color: over ? MW.redDeep : MW.mute }}>
                                                        {cap === Infinity ? '담당자가 인원에 맞춰 배정' : over ? `정원 ${cap}명 · 현재 ${pax}명` : `정원 ${cap}명`}
                                                    </span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <QuoteAdvice text={vehicle.text} warn={vehicle.warn} />
                            </Group>
                        </Step>

                        <Step n={6} done={steps[5]} title="항공권" hint="발행 여부">
                            <QuoteHelp>이미 발권하셨다면 도착·출발 일시를 알려 주세요. 견적서와 픽업·드랍 안내에 반영됩니다.</QuoteHelp>
                            <Pills options={FLIGHT_OPTIONS} isOn={(v) => form.flightIssued === v} onPick={(v) => set({ flightIssued: v })} />
                            {flightYes(form) && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                                    <Labeled label="몽골 도착 일시 (IN)" required>
                                        <input type="datetime-local" value={form.flightIn} onChange={(e) => set({ flightIn: e.target.value })} style={field} />
                                    </Labeled>
                                    <Labeled label="몽골 출발 일시 (OUT)" required>
                                        <input type="datetime-local" value={form.flightOut} onChange={(e) => set({ flightOut: e.target.value })} style={field} />
                                    </Labeled>
                                </div>
                            )}
                            {form.flightIssued === FLIGHT_NO && (
                                <QuoteHelp>괜찮아요! 견적서에는 <strong style={{ color: MW.navy }}>미정</strong>으로 표시되고, 발권 후 알려 주시면 일정에 반영해 드려요.</QuoteHelp>
                            )}
                        </Step>

                        <Step n={7} done={steps[6]} title="연락처" hint="견적서를 받으실 곳">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
                                <Labeled label="신청자 이름" required>
                                    <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="홍길동" autoComplete="name" maxLength={40} style={field} />
                                </Labeled>
                                <Labeled label="휴대폰 번호" required>
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        value={form.phone}
                                        onChange={(e) => set({ phone: phoneDigits(e.target.value) })}
                                        onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                                        placeholder="01012345678 ('-' 없이 숫자만)"
                                        autoComplete="tel"
                                        maxLength={20}
                                        style={field}
                                    />
                                    {phoneBad && <QuoteFieldNote>휴대폰 번호는 숫자 9~11자리로 입력해 주세요.</QuoteFieldNote>}
                                </Labeled>
                            </div>
                            <Labeled label="이메일" required>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => set({ email: e.target.value })}
                                    onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                                    placeholder="견적서를 받으실 이메일 주소"
                                    autoComplete="email"
                                    maxLength={120}
                                    style={field}
                                />
                                {emailBad && <QuoteFieldNote>이메일 주소 형식을 확인해 주세요.</QuoteFieldNote>}
                            </Labeled>
                            <Labeled label="카카오톡 ID" note="선택 — 카카오톡 상담을 원하시면">
                                <input value={form.kakaoId} onChange={(e) => set({ kakaoId: e.target.value })} placeholder="카카오톡 ID" autoComplete="off" maxLength={80} style={field} />
                            </Labeled>
                        </Step>

                        <Step n={8} done={steps[7]} title="요청 사항·동의" hint="확인 후 요청하기" last>
                            <Labeled label="요청 사항" note="선택">
                                <textarea
                                    rows={5}
                                    value={form.request}
                                    onChange={(e) => set({ request: e.target.value })}
                                    maxLength={2000}
                                    placeholder={'예) 승마 체험과 별 관측을 꼭 넣고 싶어요.\n아이와 함께라 이동 시간이 짧았으면 합니다.'}
                                    style={{ ...field, height: 'auto', padding: '16px 18px', lineHeight: 1.7, resize: 'vertical' }}
                                />
                            </Labeled>
                            <QuoteFileField fileName={form.fileName} state={q.fileState} note={q.fileNote} onPick={q.pickFile} onRemove={q.removeFile} />
                            <QuoteAgreeRow on={form.agree} onToggle={() => set({ agree: !form.agree })} />
                        </Step>

                        <QuoteHoneypot value={form.website} onChange={(v) => set({ website: v })} />
                    </div>

                    <TravelPass
                        passenger={form.name.trim() ? `${form.name.trim()} 님` : '여행자 님'}
                        people={quotePeople(form)}
                        depart={form.depart ? koDate(form.depart).replace(/\(.\)$/, '') : '원하시는 날'}
                        nights={tripLength || '미정'}
                        places={unsure ? '여행사 추천' : [form.destination, ...form.destSpots].filter(Boolean).join(' · ') || '미선택'}
                        styles={[form.tripType, ...form.travelStyles].filter(Boolean).join(' · ') || '미선택'}
                        progress={steps.filter(Boolean).length}
                        total={steps.length}
                        canSubmit={q.canSubmit}
                        missingText={q.missingText}
                        submitting={q.submitting}
                        error={q.error}
                        onSubmit={q.submit}
                    />
                </div>
            </section>
        </div>
    );
}

function Step({ n, done, title, hint, last = false, children }: { n: number; done: boolean; title: string; hint?: string; last?: boolean; children: ReactNode }) {
    return (
        <div id={quoteStepId(n)} style={{ display: 'grid', gridTemplateColumns: '40px minmax(0,1fr)', columnGap: 20, scrollMarginTop: MW_STICKY_TOP + 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        boxSizing: 'border-box',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: MW_FONT_EN,
                        fontSize: 14,
                        fontWeight: 600,
                        background: done ? MW_GRADIENT : '#FFFFFF',
                        color: done ? MW.navy : MW.mintDeep,
                        border: `1.5px solid ${done ? MW.mint : '#B8C4C1'}`,
                        transition: 'all .2s',
                    }}
                >
                    {done ? '✓' : pad(n)}
                </span>
                {!last && <span style={{ flex: 1, width: 2, margin: '8px 0', background: done ? 'linear-gradient(180deg,#27AB8F,#3FC2A4)' : '#DDE2DF', transition: 'background .2s' }} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: `4px 0 ${last ? 0 : 52}px`, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, lineHeight: 1.3 }}>{title}</h2>
                    {hint && <span style={{ fontSize: 13, color: MW.mute }}>{hint}</span>}
                </div>
                {children}
            </div>
        </div>
    );
}

/** 스텝 안의 한 묶음(제목 + 선택지 + 도움말). */
function Group({ children }: { children: ReactNode }) {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>;
}

function Required() {
    return <span style={{ color: MW.red }}>*</span>;
}

function Check({ on, size }: { on: boolean; size: number }) {
    return (
        <span
            aria-hidden="true"
            style={{ flexShrink: 0, width: size, height: size, borderRadius: '50%', boxSizing: 'border-box', border: `1.5px solid ${on ? MW.mint : '#B8C4C1'}`, background: on ? MW.mint : 'transparent', color: MW.navy, fontSize: 11, lineHeight: `${size - 3}px`, textAlign: 'center' }}
        >
            {on ? '✓' : ''}
        </span>
    );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
    return (
        <button
            type="button"
            aria-pressed={on}
            onClick={onClick}
            style={{ display: 'flex', alignItems: 'center', gap: 8, height: 48, padding: '0 20px 0 16px', borderRadius: 999, border: `1.5px solid ${on ? MW.mint : MW.line2}`, background: on ? MW.mintTint : '#FFFFFF', color: MW.navy, fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'all .15s', fontFamily: 'inherit' }}
        >
            <Check on={on} size={18} />
            {children}
        </button>
    );
}

function Pills({ options, isOn, onPick }: { options: string[]; isOn: (v: string) => boolean; onPick: (v: string) => void }) {
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {options.map((v) => (
                <Pill key={v} on={isOn(v)} onClick={() => onPick(v)}>{v}</Pill>
            ))}
        </div>
    );
}

/** 고른 투어의 관심 지역(복수 선택). 마지막으로 누른 지역의 설명을 아래에 보여 준다. */
function RegionPanel({ category, selected, focus, onToggle }: { category: DestCategory; selected: string[]; focus: string; onToggle: (name: string) => void }) {
    const shown = category.regions.find((r) => r.name === focus) || category.regions[0];
    return (
        <div style={{ background: MW.mintBg, border: `1px solid ${MW.mintTint}`, borderRadius: 16, padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <QuoteGroupLabel note="선택 사항 · 복수 선택 가능">{category.name}에서 가 보고 싶은 곳</QuoteGroupLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(92px,1fr))', gap: '16px 8px' }}>
                {category.regions.map((r) => {
                    const on = selected.includes(r.name);
                    return (
                        <button
                            key={r.name}
                            type="button"
                            aria-pressed={on}
                            onClick={() => onToggle(r.name)}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 0, border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                            <span style={{ position: 'relative', width: 72, height: 72 }}>
                                <img src={r.img} alt="" loading="lazy" decoding="async" style={{ display: 'block', width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', boxSizing: 'border-box', border: `3px solid ${on ? MW.mint : '#FFFFFF'}`, boxShadow: '0 2px 8px rgba(10,31,46,0.12)' }} />
                                {on && (
                                    <span aria-hidden="true" style={{ position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: '50%', boxSizing: 'border-box', background: MW.mint, border: '2px solid #FFFFFF', color: MW.navy, fontSize: 11, lineHeight: '18px', textAlign: 'center' }}>✓</span>
                                )}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3, color: on ? MW.mintDeep : MW.ink3, textAlign: 'center' }}>{r.name}</span>
                        </button>
                    );
                })}
            </div>
            {shown && (
                <p style={{ margin: 0, paddingTop: 12, borderTop: `1px solid ${MW.mintTint}`, fontSize: 13, lineHeight: 1.65, color: MW.mute }}>
                    <strong style={{ color: MW.navy }}>{shown.name}</strong> — {shown.desc}
                </p>
            )}
            {selected.length > 0 && (
                <p aria-live="polite" style={{ margin: 0, padding: '10px 13px', borderRadius: 10, background: '#FFFFFF', border: `1px solid ${MW.mintTint}`, fontSize: 12.5, fontWeight: 700, lineHeight: 1.5, color: MW.mintDeep }}>
                    선택 {selected.length}곳 · {selected.join(' · ')}
                </p>
            )}
        </div>
    );
}

function Counter({ label, sub, value, min, onChange }: { label: string; sub: string; value: number; min: number; onChange: (v: number) => void }) {
    const btn = (primary: boolean, off: boolean): CSSProperties => ({ width: 44, height: 44, border: 0, borderRadius: '50%', background: primary ? MW.mint : '#F1F4F3', fontSize: 18, color: MW.navy, cursor: off ? 'default' : 'pointer', opacity: off ? 0.4 : 1 });
    const step = (d: number) => onChange(Math.min(MAX_PAX, Math.max(min, value + d)));
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, height: 72, boxSizing: 'border-box', border: `1.5px solid ${MW.line2}`, borderRadius: 14, padding: '0 10px 0 20px', background: '#fff' }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{label}</span>
                <span style={{ fontSize: 12, color: MW.mute }}>{sub}</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button type="button" onClick={() => step(-1)} disabled={value <= min} aria-label={`${label} 1명 줄이기`} style={btn(false, value <= min)}>−</button>
                <span aria-live="polite" style={{ minWidth: 44, textAlign: 'center', fontSize: 18, fontWeight: 900 }}>
                    {value}<span style={{ fontSize: 13, fontWeight: 700 }}>명</span>
                </span>
                <button type="button" onClick={() => step(1)} disabled={value >= MAX_PAX} aria-label={`${label} 1명 늘리기`} style={btn(true, value >= MAX_PAX)}>+</button>
            </div>
        </div>
    );
}

function DateField({ label, value, active, onClick }: { label: string; value: string; active: boolean; onClick: () => void }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: MW.mute }}>{label}</span>
            <button
                type="button"
                onClick={onClick}
                aria-label={value ? `${label} ${koDate(value)}` : label}
                aria-expanded={active}
                style={{ ...field, border: `1.5px solid ${active ? MW.mint : MW.line2}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
            >
                <span style={{ color: value ? MW.navy : MW.mute2, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{koDate(value) || '연 / 월 / 일 선택'}</span>
                <span aria-hidden="true" style={{ flexShrink: 0, fontSize: 12, lineHeight: 1, color: MW.mintDeep }}>▼</span>
            </button>
        </div>
    );
}

function Calendar({ kind, start, end, onPick, onClear, onClose }: { kind: CalKind; start: string; end: string; onPick: (v: string) => void; onClear: () => void; onClose: () => void }) {
    const today = new Date();
    const todayKey = toKey(today);
    const seed = (kind === 'start' ? start : end || start) || todayKey;
    const [ym, setYm] = useState(() => ({ y: +seed.slice(0, 4), m: +seed.slice(5, 7) - 1 }));

    // Re-anchor the month when switching between 입국일 / 귀국일.
    useEffect(() => {
        const v = (kind === 'start' ? start : end || start) || toKey(new Date());
        setYm({ y: +v.slice(0, 4), m: +v.slice(5, 7) - 1 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind]);

    const { y, m } = ym;
    const first = new Date(y, m, 1).getDay();
    const dim = new Date(y, m + 1, 0).getDate();
    // 입국일은 오늘부터, 귀국일은 입국일 다음 날부터(최소 1박).
    const min = kind === 'end' && start ? plusDays(start, 1) : todayKey;
    const prevDisabled = y < today.getFullYear() || (y === today.getFullYear() && m <= today.getMonth());
    const move = (d: number) => {
        const nd = new Date(y, m + d, 1);
        setYm({ y: nd.getFullYear(), m: nd.getMonth() });
    };
    const navBtn: CSSProperties = { width: 44, height: 44, border: 0, borderRadius: '50%', background: '#F1F4F3', fontSize: 16, color: MW.navy, cursor: 'pointer' };

    return (
        <div style={{ gridColumn: '1/-1', background: '#fff', border: `1.5px solid ${MW.line2}`, borderRadius: 18, padding: 20, boxShadow: '0 12px 32px rgba(10,31,46,0.1)', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 420, boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <button type="button" onClick={() => !prevDisabled && move(-1)} disabled={prevDisabled} aria-label="이전 달" style={{ ...navBtn, opacity: prevDisabled ? 0.35 : 1, cursor: prevDisabled ? 'default' : 'pointer' }}>←</button>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: MW.mintDeep }}>{kind === 'start' ? '몽골 입국일' : '귀국일'} 선택</span>
                    <span style={{ fontSize: 17, fontWeight: 900 }}>{y}년 {m + 1}월</span>
                </div>
                <button type="button" onClick={() => move(1)} aria-label="다음 달" style={navBtn}>→</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 4, textAlign: 'center' }}>
                {WEEK.split('').map((w, i) => (
                    <span key={w} style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? MW.red : i === 6 ? '#2B63C6' : MW.mute, padding: '4px 0' }}>{w}</span>
                ))}
                {Array.from({ length: first }, (_, i) => <span key={`b${i}`} />)}
                {Array.from({ length: dim }, (_, i) => {
                    const d = i + 1;
                    const v = `${y}-${pad(m + 1)}-${pad(d)}`;
                    const off = v < min;
                    const sel = v === start || v === end;
                    const inRange = !!start && !!end && v > start && v < end;
                    const dow = (first + i) % 7;
                    return (
                        <button
                            key={v}
                            type="button"
                            disabled={off}
                            aria-pressed={sel}
                            aria-label={koDate(v)}
                            onClick={() => onPick(v)}
                            style={{
                                height: 44,
                                border: 0,
                                borderRadius: 12,
                                background: sel ? MW.mint : inRange ? MW.mintTint : 'transparent',
                                color: sel ? MW.navy : off ? '#C3CCCA' : dow === 0 ? MW.red : dow === 6 ? '#2B63C6' : MW.navy,
                                fontSize: 14,
                                fontWeight: sel ? 900 : 500,
                                cursor: off ? 'default' : 'pointer',
                                fontFamily: 'inherit',
                            }}
                        >
                            {d}
                        </button>
                    );
                })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <button type="button" onClick={onClear} style={{ border: 0, background: 'transparent', color: MW.mute, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: '10px 0', fontFamily: 'inherit' }}>초기화</button>
                <button type="button" onClick={onClose} style={{ height: 40, padding: '0 18px', border: 0, borderRadius: 999, background: MW.navy, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>닫기</button>
            </div>
        </div>
    );
}

function Labeled({ label, required = false, note, children }: { label: string; required?: boolean; note?: string; children: ReactNode }) {
    return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: MW.mute }}>
                {label} {required && <span style={{ color: MW.red }}>*</span>}
                {note && <span style={{ fontWeight: 500, color: MW.mute2 }}>({note})</span>}
            </span>
            {children}
        </label>
    );
}

function TravelPass(props: {
    passenger: string;
    people: string;
    depart: string;
    nights: string;
    places: string;
    styles: string;
    progress: number;
    total: number;
    canSubmit: boolean;
    missingText: string;
    submitting: boolean;
    error: string;
    onSubmit: () => void;
}) {
    const { canSubmit, submitting, progress, total } = props;
    const ready = canSubmit && !submitting;
    const anim = '3.2s cubic-bezier(.45,.05,.35,1) infinite';

    // 카드가 화면보다 길면(낮은 노트북 화면) 위쪽 대신 아래쪽을 화면에 맞춰 고정한다 — 요청 버튼이 항상 보이도록.
    const card = useRef<HTMLElement>(null);
    const [stickyTop, setStickyTop] = useState(MW_STICKY_TOP + 24);
    useLayoutEffect(() => {
        const el = card.current;
        if (!el) return;
        const measure = () => setStickyTop(Math.min(MW_STICKY_TOP + 24, window.innerHeight - el.offsetHeight - 16));
        measure();
        window.addEventListener('resize', measure);
        const observer = window.ResizeObserver ? new ResizeObserver(measure) : null;
        observer?.observe(el);
        return () => {
            window.removeEventListener('resize', measure);
            observer?.disconnect();
        };
    }, []);

    return (
        <aside ref={card} aria-label="견적 내용" style={{ flex: '0 1 360px', minWidth: 300, position: 'sticky', top: stickyTop, display: 'flex', flexDirection: 'column', filter: 'drop-shadow(0 16px 36px rgba(10,31,46,0.12))' }}>
            <div style={{ background: '#fff', borderRadius: '22px 22px 0 0', padding: '24px 26px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                    <span style={{ color: MW.mute2 }}>TRAVEL PASS · NO.{new Date().getFullYear()}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: MW.mintDeep }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: MW.mint, boxShadow: '0 0 0 4px rgba(39,171,143,0.18)' }} />
                        NOW BOARDING
                    </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', alignItems: 'center', gap: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 34, fontWeight: 600, lineHeight: 1.1 }}>ICN</span>
                        <span style={{ fontSize: 12, color: MW.mute }}>서울(인천)</span>
                    </div>
                    <div aria-hidden="true" style={{ position: 'relative', height: 28, color: MW.mintDeep }}>
                        <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', borderTop: '2px dashed #D0D6D3' }} />
                        <span className="mw-trail" style={{ position: 'absolute', left: 0, top: '50%', marginTop: -1, height: 2, background: MW.mint, animation: `mwTrail ${anim}` }} />
                        <span className="mw-plane" style={{ position: 'absolute', top: '50%', fontSize: 24, lineHeight: 1, transform: 'translate(-50%,-52%)', background: '#fff', padding: '0 4px', animation: `mwPlane ${anim}` }}>✈</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 34, fontWeight: 600, lineHeight: 1.1 }}>UBN</span>
                        <span style={{ fontSize: 12, color: MW.mute }}>울란바토르</span>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '16px 20px' }}>
                    <PassField label="PASSENGER" value={props.passenger} />
                    <PassField label="PEOPLE" value={props.people} />
                    <PassField label="DEPART" value={props.depart} />
                    <PassField label="NIGHTS" value={props.nights} />
                </div>
            </div>
            <div style={{ position: 'relative', height: 20, background: '#fff' }}>
                <span style={{ position: 'absolute', left: -10, top: 0, width: 20, height: 20, borderRadius: '50%', background: '#FFFFFF' }} />
                <span style={{ position: 'absolute', right: -10, top: 0, width: 20, height: 20, borderRadius: '50%', background: '#FFFFFF' }} />
                <span style={{ position: 'absolute', left: 18, right: 18, top: 9, borderTop: '2px dashed #DDE2DF' }} />
            </div>
            <div style={{ background: '#fff', borderRadius: '0 0 22px 22px', padding: '18px 26px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <PassField label="DESTINATION" value={props.places} />
                <PassField label="STYLE" value={props.styles} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: MW.mute }}>
                        <span>입력 현황</span>
                        <span style={{ color: MW.mintDeep }}>{progress} / {total}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: MW.line3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.round((progress / total) * 100)}%`, background: 'linear-gradient(90deg,#27AB8F,#3FC2A4)', borderRadius: 3, transition: 'width .3s' }} />
                    </div>
                </div>
                {props.error && <QuoteErrorBox message={props.error} />}
                {/* 아직 못 채운 항목이 있으면 누를 때 그 스텝으로 이동한다. */}
                <button
                    type="button"
                    onClick={props.onSubmit}
                    disabled={submitting}
                    aria-disabled={!ready}
                    style={{ height: 56, border: 0, borderRadius: 14, fontSize: 16, fontWeight: 700, background: ready ? MW_GRADIENT : '#EEF0EC', color: ready ? MW.navy : MW.mute2, cursor: submitting ? 'progress' : 'pointer', fontFamily: 'inherit' }}
                >
                    {submitting ? '접수 중…' : '견적 요청하기'}
                </button>
                {!canSubmit && <span aria-live="polite" style={{ fontSize: 12, color: MW.mute, textAlign: 'center', marginTop: -6 }}>{props.missingText}</span>}
                <span style={{ fontSize: 12, lineHeight: 1.7, color: MW.mute, textAlign: 'center' }}>무료·부담 없음 | 24시간 이내 한국어 스태프가 답변</span>
                <KakaoConsultButton label="카카오톡 채널로 빠른 상담" height={44} style={{ fontSize: 13 }} />
            </div>
        </aside>
    );
}

function PassField({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: MW.mute2 }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{value}</span>
        </div>
    );
}

const field: CSSProperties = {
    boxSizing: 'border-box',
    width: '100%',
    height: 56,
    border: `1.5px solid ${MW.line2}`,
    borderRadius: 14,
    padding: '0 18px',
    fontSize: 15,
    color: MW.navy,
    background: '#fff',
    outline: 'none',
    fontFamily: 'inherit',
};
