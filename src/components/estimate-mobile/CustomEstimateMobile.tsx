import { useState, type CSSProperties, type FocusEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpotImages } from '../../hooks/useSpotImages';
import { MW, isUsableImage } from '../desktop-primitives/mwTokens';
import {
    CITY_STAYS, DEST_CATEGORIES, DEST_UNSURE, EMAIL_RE, FLIGHT_NO, FLIGHT_OPTIONS, GER_STAYS, MAX_PAX, PHONE_RE, TRAVEL_STYLES, TRIP_TYPES, VEHICLES,
    flightYes, koDate, phoneDigits, quotePeople, quoteTripLength, routeAdvice, totalPax, vehicleAdvice, vehicleCapacity,
    type DestCategory,
} from '../estimate-desktop/quoteForm';
import {
    KakaoConsultButton, QuoteAdvice, QuoteAgreeRow, QuoteFieldNote, QuoteFileField, QuoteGroupLabel, QuoteHelp, QuoteHoneypot, RecentQuoteBar,
} from '../estimate-desktop/quoteParts';
import { useQuoteForm } from '../estimate-desktop/useQuoteForm';
import { MobileShell } from '../mobile/MobileShell';
import { MPhoto } from '../mobile/mobileUi';
import { QuoteActionBar } from './QuoteActionBar';
import { QuoteCalendar } from './QuoteCalendar';
import { QuoteHeroMobile } from './QuoteHeroMobile';
import { QuoteStep } from './QuoteStep';
import { TravelPassMobile } from './TravelPassMobile';
import { koDateShort, stepStates, type CalKind } from './quoteMobile';

/**
 * Mobile 견적 page (Claude Design: "Milkyway Japan Mobile" — M Quote Hero / Form / Travel Pass).
 * Same eight steps, options and payload as the PC form (estimate-desktop/quoteForm.ts · useQuoteForm.ts);
 * the submit button lives in the sticky bar that replaces the tab bar.
 */
export function CustomEstimateMobile() {
    const navigate = useNavigate();
    const { pick } = useSpotImages();
    const q = useQuoteForm();
    const { form, set, steps } = q;
    const [cal, setCal] = useState<CalKind | null>(null);
    // 마지막으로 누른 관심 지역(설명 표시용 — 저장하지 않는다)
    const [spotFocus, setSpotFocus] = useState('');
    const [touched, setTouched] = useState({ phone: false, email: false });

    const st = stepStates(steps);
    const category = DEST_CATEGORIES.find((c) => c.name === form.destination);
    const unsure = form.destination === DEST_UNSURE;
    const route = routeAdvice(form);
    const vehicle = vehicleAdvice(form);
    const pax = totalPax(form);
    const tripLength = quoteTripLength(form);
    const phoneBad = touched.phone && !!form.phone && !PHONE_RE.test(form.phone);
    const emailBad = touched.email && !!form.email.trim() && !EMAIL_RE.test(form.email.trim());

    const goHome = () => {
        navigate('/');
        window.scrollTo(0, 0);
    };
    const chooseDestination = (name: string) => {
        q.pickDestination(name);
        setSpotFocus('');
    };

    return (
        <MobileShell
            title="견적"
            bottomBar={(
                <QuoteActionBar
                    done={steps.filter(Boolean).length}
                    total={steps.length}
                    canSubmit={q.canSubmit}
                    missingText={q.missingText}
                    submitting={q.submitting}
                    error={q.error}
                    onSubmit={q.submit}
                />
            )}
        >
            <QuoteHeroMobile onHome={goHome} />

            <section style={{ position: 'relative', padding: '28px 16px 0', display: 'flex', flexDirection: 'column' }}>
                {q.recent && (
                    <div style={{ marginBottom: 28 }}>
                        <RecentQuoteBar link={q.recent} compact />
                    </div>
                )}

                <QuoteStep n={1} state={st[0]} title="가고 싶은 곳" hint="투어 1개 선택">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
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
                                        position: 'relative', aspectRatio: '4/3', padding: 0, borderRadius: 14, overflow: 'hidden', border: 0,
                                        outline: `3px solid ${on ? MW.mint : MW.line2}`, outlineOffset: -3, cursor: 'pointer', color: '#fff', textAlign: 'left', fontFamily: 'inherit',
                                        background: '#DDE2DF',
                                    }}
                                >
                                    <MPhoto src={isUsableImage(spotImg) ? spotImg : d.img} />
                                    <span style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(0,0,0,0.65) 100%)' }} />
                                    {d.badge && (
                                        <span style={{ position: 'absolute', left: 8, top: 8, padding: '3px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.92)', color: MW.mintDeep, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{d.badge}</span>
                                    )}
                                    <span style={{ position: 'absolute', right: 8, top: 8, width: 24, height: 24, borderRadius: '50%', boxSizing: 'border-box', border: '2px solid #fff', background: on ? MW.mint : 'transparent', color: MW.navy, fontSize: 12, lineHeight: '20px', textAlign: 'center' }}>
                                        {on ? '✓' : ''}
                                    </span>
                                    <span style={{ position: 'absolute', left: 10, right: 10, bottom: 9, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
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
                        style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, padding: '10px 16px', borderRadius: 14, border: `1.5px ${unsure ? 'solid' : 'dashed'} ${unsure ? MW.mint : '#B8C4C1'}`, background: unsure ? MW.mintTint : '#FAFBFA', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', color: MW.navy }}
                    >
                        <Ring on={unsure} size={20} />
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 14, fontWeight: 700 }}>{unsure ? '여행사 추천으로 선택됨' : '지역 선택을 여행사에 맡기기'}</span>
                            <span style={{ fontSize: 12, color: MW.mute }}>상담 후 일정과 취향에 맞는 지역을 제안해 드려요.</span>
                        </span>
                    </button>

                    {route && <QuoteAdvice text={route.text} warn={route.warn} compact />}
                </QuoteStep>

                <QuoteStep n={2} state={st[1]} title="여행 기간" hint="몽골 입국일과 귀국일">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
                        <DateField label="몽골 입국일" value={form.depart} active={cal === 'start'} onClick={() => setCal(cal === 'start' ? null : 'start')} />
                        <DateField label="귀국일" value={form.return_} active={cal === 'end'} onClick={() => setCal(cal === 'end' ? null : 'end')} />
                    </div>
                    {cal && (
                        <QuoteCalendar
                            key={cal}
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
                    {tripLength && <span aria-live="polite" style={{ fontSize: 14, fontWeight: 700, color: MW.mintDeep }}>총 {tripLength}</span>}
                </QuoteStep>

                <QuoteStep n={3} state={st[2]} title="참가 인원" hint="성인 1명 이상">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <Stepper label="성인" sub="만 12세 이상" value={form.adult} min={1} onChange={(v) => set({ adult: v })} />
                        <Stepper label="아동" sub="만 2~11세" value={form.child} min={0} onChange={(v) => set({ child: v })} />
                        <Stepper label="유아" sub="만 2세 미만" value={form.infant} min={0} onChange={(v) => set({ infant: v })} />
                    </div>
                </QuoteStep>

                <QuoteStep n={4} state={st[3]} title="여행 스타일" hint="동행 형태와 취향">
                    <Group>
                        <QuoteGroupLabel compact>누구와 떠나시나요? <Required /></QuoteGroupLabel>
                        <Pills options={TRIP_TYPES} isOn={(v) => form.tripType === v} onPick={(v) => set({ tripType: v })} />
                    </Group>
                    <Group>
                        <QuoteGroupLabel compact note="선택 사항 · 복수 선택 가능">어떤 경험을 원하시나요?</QuoteGroupLabel>
                        <Pills options={TRAVEL_STYLES} isOn={(v) => form.travelStyles.includes(v)} onPick={(v) => q.toggleIn('travelStyles', v)} />
                    </Group>
                </QuoteStep>

                <QuoteStep n={5} state={st[4]} title="숙소·차량" hint="숙소 등급과 차량">
                    <Group>
                        <QuoteGroupLabel compact>시내(울란바토르) 숙소 <Required /></QuoteGroupLabel>
                        <Pills options={CITY_STAYS} isOn={(v) => form.cityStay === v} onPick={(v) => set({ cityStay: v })} />
                        <QuoteHelp compact>호텔 등급은 객실 상태와 조식·부대시설 수준을 기준으로 선택해 주세요.</QuoteHelp>
                    </Group>
                    <Group>
                        <QuoteGroupLabel compact note="시내 외 지역은 게르만 가능해요">투어 지역 게르 등급 <Required /></QuoteGroupLabel>
                        <Pills options={GER_STAYS} isOn={(v) => form.gerStay === v} onPick={(v) => set({ gerStay: v })} />
                        <QuoteHelp compact>고급 게르는 전용 또는 개선된 편의시설을 우선 배정하며, 지역별 실제 시설은 견적서에서 확인할 수 있어요.</QuoteHelp>
                    </Group>
                    <Group>
                        <QuoteGroupLabel compact>차량 <Required /></QuoteGroupLabel>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                                        style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, padding: '10px 16px', borderRadius: 14, border: `1.5px solid ${on ? (over ? MW.red : MW.mint) : MW.line2}`, background: on ? (over ? '#FDF0EE' : MW.mintTint) : '#FFFFFF', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', color: MW.navy }}
                                    >
                                        <Ring on={on} size={20} />
                                        <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                                            <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>{v}</span>
                                            <span style={{ fontSize: 12, color: over ? MW.redDeep : MW.mute }}>
                                                {cap === Infinity ? '담당자가 인원에 맞춰 배정' : over ? `정원 ${cap}명 · 현재 ${pax}명` : `정원 ${cap}명`}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <QuoteAdvice text={vehicle.text} warn={vehicle.warn} compact />
                    </Group>
                </QuoteStep>

                <QuoteStep n={6} state={st[5]} title="항공권" hint="발행 여부">
                    <QuoteHelp compact>이미 발권하셨다면 도착·출발 일시를 알려 주세요. 견적서와 픽업·드랍 안내에 반영됩니다.</QuoteHelp>
                    <Pills options={FLIGHT_OPTIONS} isOn={(v) => form.flightIssued === v} onPick={(v) => set({ flightIssued: v })} />
                    {flightYes(form) && (
                        <>
                            <Field label="몽골 도착 일시 (IN)" required type="datetime-local" value={form.flightIn} onChange={(e) => set({ flightIn: e.target.value })} />
                            <Field label="몽골 출발 일시 (OUT)" required type="datetime-local" value={form.flightOut} onChange={(e) => set({ flightOut: e.target.value })} />
                        </>
                    )}
                    {form.flightIssued === FLIGHT_NO && (
                        <QuoteHelp compact>괜찮아요! 견적서에는 <strong style={{ color: MW.navy }}>미정</strong>으로 표시되고, 발권 후 알려 주시면 일정에 반영해 드려요.</QuoteHelp>
                    )}
                </QuoteStep>

                <QuoteStep n={7} state={st[6]} title="연락처" hint="견적서를 받으실 곳">
                    <Field label="신청자 이름" required value={form.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" placeholder="홍길동" maxLength={40} />
                    <Field
                        label="휴대폰 번호"
                        required
                        type="tel"
                        inputMode="numeric"
                        value={form.phone}
                        onChange={(e) => set({ phone: phoneDigits(e.target.value) })}
                        onLeave={() => setTouched((t) => ({ ...t, phone: true }))}
                        autoComplete="tel"
                        placeholder="01012345678 ('-' 없이 숫자만)"
                        maxLength={20}
                        error={phoneBad ? '휴대폰 번호는 숫자 9~11자리로 입력해 주세요.' : ''}
                    />
                    <Field
                        label="이메일"
                        required
                        type="email"
                        value={form.email}
                        onChange={(e) => set({ email: e.target.value })}
                        onLeave={() => setTouched((t) => ({ ...t, email: true }))}
                        autoComplete="email"
                        placeholder="견적서를 받으실 이메일 주소"
                        maxLength={120}
                        error={emailBad ? '이메일 주소 형식을 확인해 주세요.' : ''}
                    />
                    <Field label="카카오톡 ID" note="선택" value={form.kakaoId} onChange={(e) => set({ kakaoId: e.target.value })} autoComplete="off" placeholder="카카오톡 상담을 원하시면 입력해 주세요" maxLength={80} />
                </QuoteStep>

                <QuoteStep n={8} state={st[7]} title="요청 사항·동의" hint="확인 후 요청하기" last>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={fieldLabel}>요청 사항 <span style={{ fontWeight: 500, color: MW.mute2 }}>(선택)</span></span>
                        <textarea
                            rows={5}
                            value={form.request}
                            onChange={(e) => set({ request: e.target.value })}
                            maxLength={2000}
                            placeholder={'예) 승마 체험과 별 관측을 꼭 넣고 싶어요.\n아이와 함께라 이동 시간이 짧았으면 합니다.'}
                            style={{ ...field, height: 'auto', padding: '14px 16px', lineHeight: 1.7, resize: 'vertical' }}
                            {...focusBorder}
                        />
                    </label>
                    <QuoteFileField fileName={form.fileName} state={q.fileState} note={q.fileNote} onPick={q.pickFile} onRemove={q.removeFile} compact />
                    <QuoteAgreeRow on={form.agree} onToggle={() => set({ agree: !form.agree })} compact />
                </QuoteStep>

                <TravelPassMobile
                    passenger={form.name.trim() ? `${form.name.trim()} 님` : '여행자 님'}
                    people={quotePeople(form)}
                    depart={form.depart ? koDate(form.depart).replace(/\(.\)$/, '') : '원하시는 날'}
                    nights={tripLength || '미정'}
                    places={unsure ? '여행사 추천' : [form.destination, ...form.destSpots].filter(Boolean).join(' · ') || '미선택'}
                    styles={[form.tripType, ...form.travelStyles].filter(Boolean).join(' · ') || '미선택'}
                />
                <KakaoConsultButton label="카카오톡 채널로 빠른 상담" height={48} style={{ marginTop: 16, borderRadius: 999, fontSize: 14 }} />

                <QuoteHoneypot value={form.website} onChange={(v) => set({ website: v })} />
            </section>
        </MobileShell>
    );
}

/** 스텝 안의 한 묶음(제목 + 선택지 + 도움말). */
function Group({ children }: { children: ReactNode }) {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>;
}

function Required() {
    return <span style={{ color: MW.red }}>*</span>;
}

/** Radio/checkbox ring used by the pills and the vehicle rows. */
function Ring({ on, size }: { on: boolean; size: number }) {
    return (
        <span
            aria-hidden="true"
            style={{ flexShrink: 0, width: size, height: size, borderRadius: '50%', boxSizing: 'border-box', border: `1.5px solid ${on ? MW.mint : '#B8C4C1'}`, background: on ? MW.mint : 'transparent', color: MW.navy, fontSize: size > 16 ? 11 : 10, lineHeight: `${size - 3}px`, textAlign: 'center' }}
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
            style={{ display: 'flex', alignItems: 'center', gap: 7, height: 42, padding: '0 14px 0 12px', borderRadius: 999, border: `1.5px solid ${on ? MW.mint : MW.line2}`, background: on ? MW.mintTint : '#FFFFFF', fontFamily: 'inherit', color: MW.navy, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
            <Ring on={on} size={16} />
            {children}
        </button>
    );
}

function Pills({ options, isOn, onPick }: { options: string[]; isOn: (v: string) => boolean; onPick: (v: string) => void }) {
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
        <div style={{ background: MW.mintBg, border: `1px solid ${MW.mintTint}`, borderRadius: 16, padding: '14px 12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <QuoteGroupLabel compact note="선택 사항 · 복수 선택 가능">가 보고 싶은 곳</QuoteGroupLabel>
                <span style={{ fontSize: 11.5, lineHeight: 1.5, color: MW.mute }}>{category.name} — {category.tagline}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: '14px 4px' }}>
                {category.regions.map((r) => {
                    const on = selected.includes(r.name);
                    return (
                        <button
                            key={r.name}
                            type="button"
                            aria-pressed={on}
                            onClick={() => onToggle(r.name)}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 0, border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', minWidth: 0 }}
                        >
                            <span style={{ position: 'relative', width: 60, height: 60 }}>
                                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden', boxSizing: 'border-box', border: `3px solid ${on ? MW.mint : '#FFFFFF'}`, boxShadow: '0 2px 8px rgba(10,31,46,0.12)', background: MW.chip }}>
                                    <MPhoto src={r.img} sizes="60px" />
                                </span>
                                {on && (
                                    <span aria-hidden="true" style={{ position: 'absolute', right: -3, bottom: -3, width: 20, height: 20, borderRadius: '50%', boxSizing: 'border-box', background: MW.mint, border: '2px solid #FFFFFF', color: MW.navy, fontSize: 10, lineHeight: '16px', textAlign: 'center' }}>✓</span>
                                )}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.02em', color: on ? MW.mintDeep : MW.ink3, textAlign: 'center', wordBreak: 'keep-all' }}>{r.name}</span>
                        </button>
                    );
                })}
            </div>
            {shown && (
                <p style={{ margin: 0, paddingTop: 10, borderTop: `1px solid ${MW.mintTint}`, fontSize: 12, lineHeight: 1.65, color: MW.mute }}>
                    <strong style={{ color: MW.navy }}>{shown.name}</strong> — {shown.desc}
                </p>
            )}
            {selected.length > 0 && (
                <p aria-live="polite" style={{ margin: 0, padding: '9px 12px', borderRadius: 10, background: '#FFFFFF', border: `1px solid ${MW.mintTint}`, fontSize: 12, fontWeight: 700, lineHeight: 1.5, color: MW.mintDeep }}>
                    선택 {selected.length}곳 · {selected.join(' · ')}
                </p>
            )}
        </div>
    );
}

function Stepper({ label, sub, value, min, onChange }: { label: string; sub: string; value: number; min: number; onChange: (v: number) => void }) {
    const btn = (primary: boolean, off: boolean): CSSProperties => ({ width: 44, height: 44, border: 0, borderRadius: '50%', background: primary ? MW.mint : '#F1F4F3', fontSize: 18, color: MW.navy, cursor: off ? 'default' : 'pointer', opacity: off ? 0.4 : 1, padding: 0, fontFamily: 'inherit' });
    const step = (d: number) => onChange(Math.min(MAX_PAX, Math.max(min, value + d)));
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, height: 60, boxSizing: 'border-box', border: `1.5px solid ${MW.line2}`, borderRadius: 14, padding: '0 8px 0 18px', background: '#fff' }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: MW.mute }}>{label}</span>
                <span style={{ fontSize: 11, color: MW.mute, whiteSpace: 'nowrap' }}>{sub}</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" onClick={() => step(-1)} disabled={value <= min} aria-label={`${label} 1명 줄이기`} style={btn(false, value <= min)}>−</button>
                <span aria-live="polite" style={{ minWidth: 44, textAlign: 'center', fontSize: 18, fontWeight: 900 }}>
                    {value}<span style={{ fontSize: 12, fontWeight: 700 }}>명</span>
                </span>
                <button type="button" onClick={() => step(1)} disabled={value >= MAX_PAX} aria-label={`${label} 1명 늘리기`} style={btn(true, value >= MAX_PAX)}>+</button>
            </div>
        </div>
    );
}

function DateField({ label, value, active, onClick }: { label: string; value: string; active: boolean; onClick: () => void }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span style={fieldLabel}>{label}</span>
            <button
                type="button"
                onClick={onClick}
                aria-label={value ? `${label} ${koDate(value)}` : label}
                aria-expanded={active}
                style={{ boxSizing: 'border-box', width: '100%', height: 52, border: `1.5px solid ${active ? MW.mint : MW.line2}`, borderRadius: 14, padding: '0 12px', fontSize: 13, color: MW.navy, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
            >
                <span style={{ color: value ? MW.navy : MW.mute2, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{koDateShort(value) || '날짜 선택'}</span>
                <span aria-hidden="true" style={{ flexShrink: 0, fontSize: 10, color: MW.mintDeep }}>▼</span>
            </button>
        </div>
    );
}

function Field({ label, required = false, note, error, onLeave, ...input }: {
    label: string;
    required?: boolean;
    note?: string;
    error?: string;
    /** 입력칸을 벗어날 때(형식 안내를 그때부터 보여 준다). */
    onLeave?: () => void;
} & InputHTMLAttributes<HTMLInputElement>) {
    return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span style={fieldLabel}>
                {label} {required && <span style={{ color: MW.red }}>*</span>}
                {note && <span style={{ fontWeight: 500, color: MW.mute2 }}>({note})</span>}
            </span>
            <input
                {...input}
                aria-required={required || undefined}
                aria-invalid={!!error || undefined}
                style={field}
                onFocus={focusBorder.onFocus}
                onBlur={(e) => {
                    focusBorder.onBlur(e);
                    onLeave?.();
                }}
            />
            {error && <QuoteFieldNote>{error}</QuoteFieldNote>}
        </label>
    );
}

const fieldLabel: CSSProperties = { fontSize: 12, fontWeight: 700, color: MW.mute };

// 16px text keeps iOS from zooming the page when a field gets focus.
// appearance/minWidth keep iOS date-time inputs inside the column instead of sizing to their content.
const field: CSSProperties = {
    boxSizing: 'border-box',
    display: 'block',
    width: '100%',
    minWidth: 0,
    height: 52,
    border: `1.5px solid ${MW.line2}`,
    borderRadius: 14,
    padding: '0 16px',
    fontFamily: 'inherit',
    fontSize: 16,
    color: MW.navy,
    background: '#fff',
    outline: 'none',
    textAlign: 'left',
    WebkitAppearance: 'none',
    appearance: 'none',
};

/** The fields drop the browser outline, so focus shows on the border instead. */
const focusBorder = {
    onFocus: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = MW.mint; },
    onBlur: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = MW.line2; },
};
