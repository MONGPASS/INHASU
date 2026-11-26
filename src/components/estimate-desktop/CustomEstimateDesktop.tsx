import { useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpotImages } from '../../hooks/useSpotImages';
import { HOME_IMG } from '../home/homeContent';
import { SD, SD_CONTAINER, SIcon } from '../site-seed/seed';
import { boxButton } from '../mypage-desktop/myBookingView';
import {
    CITY_STAYS, EMAIL_RE, FLIGHT_NO, FLIGHT_OPTIONS, GER_STAYS, MAX_PAX, PHONE_RE, TRAVEL_STYLES, TRIP_TYPES, VEHICLES,
    flightYes, phoneDigits, scrollToQuoteStep, totalPax, vehicleAdvice,
} from './quoteForm';
import { myQuotePath, quoteLinkDate } from './quoteLinks';
import { Q_INPUT } from './quoteSeed';
import {
    QChips, QCheckRow, QuoteHoneypot, QDates, QDestinations, QError, QField, QFile, QHint, QKakaoLink, QLabel, QPeople, QProgress, QReceipt, QSection, QStatusCard, QVehicles,
} from './QuoteSeedParts';
import { useQuoteForm } from './useQuoteForm';

const STEPS = [
    { title: '요청서 작성', sub: '3분이면 충분해요' },
    { title: '맞춤 견적서', sub: '24시간 안에 알림톡으로' },
    { title: '상담 후 확정', sub: '일정·가격 조율' },
];

/**
 * PC 맞춤 견적 요청(Claude Design ‘맞춤 견적 (PC)’): 흰 소개 띠(경로 · 100% 프라이빗 투어 · 진행 3단계 · 사진) →
 * 회색 바탕에 8개 입력 카드(가고 싶은 곳 → … → 요청 사항·동의) + 붙는 요약(입력 중: 요청할 여행·진행 막대 /
 * 모두 입력: 요청서 영수증 + 무료로 견적 요청하기). 선택지·검증·제출은 quoteForm.ts / useQuoteForm.ts(휴대폰과 공용).
 */
export function CustomEstimateDesktop() {
    const navigate = useNavigate();
    const { pick } = useSpotImages();
    const q = useQuoteForm();
    const { form, set, steps } = q;
    const [touched, setTouched] = useState({ phone: false, email: false });
    const pax = totalPax(form);
    const vehicle = vehicleAdvice(form);
    const phoneBad = touched.phone && !!form.phone && !PHONE_RE.test(form.phone);
    const emailBad = touched.email && !!form.email.trim() && !EMAIL_RE.test(form.email.trim());
    const doneCount = steps.filter(Boolean).length;
    const jump = (step: number) => scrollToQuoteStep(step - 1);
    const go = (to: string) => (e: MouseEvent) => { e.preventDefault(); navigate(to); window.scrollTo(0, 0); };

    return (
        <main style={{ background: SD.gray50, color: SD.gray900 }}>
            <section style={{ background: SD.white, borderBottom: `1px solid ${SD.gray200}` }}>
                <div style={{ ...SD_CONTAINER, paddingTop: 20, paddingBottom: 32 }}>
                    <nav aria-label="현재 위치" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: SD.gray600 }}>
                        <a href="/" onClick={go('/')} style={{ color: SD.gray600, textDecoration: 'none' }}>홈</a><span aria-hidden="true">›</span>
                        <span style={{ color: SD.gray900, fontWeight: 700 }}>맞춤 견적</span>
                    </nav>
                    <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 48 }}>
                        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 10px', borderRadius: 9999, border: `1px solid ${SD.gray200}`, fontSize: 12, fontWeight: 700, color: SD.gray700 }}>100% 프라이빗 투어</span>
                            <h1 style={{ margin: '14px 0 10px', fontSize: 36, fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.5px' }}>원하는 대로,<br />우리만의 몽골 여행</h1>
                            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: SD.gray600 }}>인원·일정·가고 싶은 곳을 알려 주세요. 한국어 스태프가 24시간 안에<br />맞춤 견적서를 준비해 카카오 알림톡으로 알려 드려요.</p>
                            <ol aria-label="진행 순서" style={{ margin: '24px 0 0', padding: '18px 0 0', borderTop: `1px solid ${SD.gray200}`, listStyle: 'none', display: 'flex', gap: 12 }}>
                                {STEPS.map((s, i) => (
                                    <li key={s.title} style={{ flex: '1 1 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                                        {i > 0 && <span aria-hidden="true" style={{ flex: 'none', color: SD.gray400, display: 'flex', marginRight: 2 }}><SIcon name="chevronRight" size={16} stroke={2} /></span>}
                                        <span style={{ flex: 'none', width: 26, height: 26, boxSizing: 'border-box', borderRadius: 9999, background: i === 0 ? SD.gray900 : SD.white, border: i === 0 ? 'none' : `1.5px solid ${SD.gray200}`,
                                            color: i === 0 ? SD.white : SD.gray700, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                                        <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                            <span style={{ fontSize: 14, fontWeight: 700 }}>{s.title}</span>
                                            <span style={{ fontSize: 12, color: SD.gray600 }}>{s.sub}</span>
                                        </span>
                                    </li>
                                ))}
                            </ol>
                            {q.recent && (
                                <a href={myQuotePath(q.recent.token)} style={{ marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: SD.gray700, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                                    이전에 요청한 견적 보기{quoteLinkDate(q.recent.createdAt) ? ` (${quoteLinkDate(q.recent.createdAt)} 요청)` : ''}
                                </a>
                            )}
                        </div>
                        <div aria-hidden="true" style={{ flex: '0 0 420px', height: 300, position: 'relative' }}>
                            <img src={HOME_IMG.steppeGallop} alt="" style={{ position: 'absolute', left: 0, top: 0, width: 280, height: 300, borderRadius: 20, objectFit: 'cover', display: 'block' }} />
                            <img src={HOME_IMG.miniDesert} alt="" style={{ position: 'absolute', right: 0, bottom: 0, width: 180, height: 200, boxSizing: 'border-box', borderRadius: 18, objectFit: 'cover', display: 'block', border: `6px solid ${SD.white}`, boxShadow: '0 12px 30px rgba(0,0,0,0.15)' }} />
                            <span style={{ position: 'absolute', right: 20, top: 24, padding: '10px 14px', borderRadius: 14, background: SD.white, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: 11, color: SD.gray600 }}>견적서 도착까지</span>
                                <strong style={{ fontSize: 18, color: SD.mint600 }}>24시간 이내</strong>
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            <div style={{ ...SD_CONTAINER, paddingTop: 32, paddingBottom: 96, display: 'flex', gap: 28, alignItems: 'flex-start' }}>
                <div style={{ position: 'relative', flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <QSection n={1} title="가고 싶은 곳" sub="투어 1개 선택" done={steps[0]}>
                        <QDestinations form={form} pick={pick} onPick={q.pickDestination} onToggleSpot={(name) => q.toggleIn('destSpots', name)} />
                    </QSection>

                    <QSection n={2} title="여행 기간" sub="몽골 입국일과 귀국일" done={steps[1]}>
                        <QDates form={form} onDepart={q.pickDepart} onReturn={(v) => set({ return_: v })} />
                    </QSection>

                    <QSection n={3} title="참가 인원" sub="성인 1명 이상" done={steps[2]}>
                        <QPeople form={form} set={set} max={MAX_PAX} />
                    </QSection>

                    <QSection n={4} title="여행 스타일" sub="동행 형태와 여행 취향" done={steps[3]}>
                        <QLabel required>누구와 떠나시나요?</QLabel>
                        <QChips label="동행 형태" options={TRIP_TYPES} isOn={(v) => form.tripType === v} onPick={(v) => set({ tripType: v })} />
                        <QLabel top note="선택 · 여러 개 가능">어떤 경험을 원하시나요?</QLabel>
                        <QChips label="여행 취향" options={TRAVEL_STYLES} isOn={(v) => form.travelStyles.includes(v)} onPick={(v) => q.toggleIn('travelStyles', v)} />
                    </QSection>

                    <QSection n={5} title="숙소·차량" sub="시내 숙소 · 게르 등급 · 차량" done={steps[4]}>
                        <QLabel required>시내(울란바토르) 숙소</QLabel>
                        <QChips label="시내 숙소" options={CITY_STAYS} isOn={(v) => form.cityStay === v} onPick={(v) => set({ cityStay: v })} />
                        <QHint>호텔 등급은 객실 상태와 조식·부대시설 수준을 기준으로 선택해 주세요.</QHint>
                        <QLabel top required note="시내 외 지역은 게르만 가능해요">투어 지역 게르 등급</QLabel>
                        <QChips label="게르 등급" options={GER_STAYS} isOn={(v) => form.gerStay === v} onPick={(v) => set({ gerStay: v })} />
                        <QHint>고급 게르는 전용 또는 개선된 편의시설을 우선 배정하며, 지역별 실제 시설은 견적서에서 확인할 수 있어요.</QHint>
                        <QLabel top required>차량</QLabel>
                        <QVehicles options={VEHICLES} value={form.vehicle} pax={pax} onPick={(v) => set({ vehicle: v })} />
                        <QHint warn={vehicle.warn}>{vehicle.text}</QHint>
                    </QSection>

                    <QSection n={6} title="항공권" sub="발행 여부" done={steps[5]}>
                        <p style={{ margin: '-8px 0 14px', fontSize: 13, color: SD.gray600 }}>이미 발권하셨다면 도착·출발 일시를 알려 주세요. 견적서와 픽업·드랍 안내에 반영돼요.</p>
                        <QChips label="항공권 발행 여부" options={FLIGHT_OPTIONS} isOn={(v) => form.flightIssued === v} onPick={(v) => set({ flightIssued: v })} />
                        {flightYes(form) && (
                            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                <QField label="몽골 도착 일시 (IN)" required><input type="datetime-local" value={form.flightIn} onChange={(e) => set({ flightIn: e.target.value })} style={Q_INPUT} /></QField>
                                <QField label="몽골 출발 일시 (OUT)" required><input type="datetime-local" value={form.flightOut} onChange={(e) => set({ flightOut: e.target.value })} style={Q_INPUT} /></QField>
                            </div>
                        )}
                        {form.flightIssued === FLIGHT_NO && <QHint>괜찮아요! 견적서에는 미정으로 표시되고, 발권 후 알려 주시면 일정에 반영해 드려요.</QHint>}
                    </QSection>

                    <QSection n={7} title="연락처" sub="견적서를 받으실 곳" done={steps[6]}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 14px' }}>
                            <QField label="신청자 이름" required>
                                <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="이름" autoComplete="name" maxLength={40} style={Q_INPUT} />
                            </QField>
                            <QField label="휴대폰 번호" required error={phoneBad ? '휴대폰 번호는 숫자 9~11자리로 입력해 주세요.' : undefined}>
                                <input type="tel" inputMode="numeric" value={form.phone} onChange={(e) => set({ phone: phoneDigits(e.target.value) })} onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                                    placeholder="01012345678 (숫자만)" autoComplete="tel" maxLength={20} style={Q_INPUT} />
                            </QField>
                            <QField label="이메일" required wide error={emailBad ? '이메일 주소 형식을 확인해 주세요.' : undefined}>
                                <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                                    placeholder="example@email.com" autoComplete="email" maxLength={120} style={Q_INPUT} />
                            </QField>
                            <QField label="카카오톡 ID" note="선택" wide>
                                <input value={form.kakaoId} onChange={(e) => set({ kakaoId: e.target.value })} placeholder="카카오톡 상담을 원하시면 입력해 주세요" autoComplete="off" maxLength={80} style={Q_INPUT} />
                            </QField>
                        </div>
                    </QSection>

                    <QSection n={8} title="요청 사항·동의" sub="확인 후 요청하기" done={steps[7]}>
                        <QField label="요청 사항" note="선택">
                            <textarea value={form.request} onChange={(e) => set({ request: e.target.value })} maxLength={2000}
                                placeholder={'예) 승마 체험과 별 관측을 꼭 넣고 싶어요.\n아이와 함께라 이동 시간이 짧았으면 해요.'}
                                style={{ ...Q_INPUT, height: 120, padding: '14px 16px', lineHeight: 1.6, resize: 'vertical' }} />
                        </QField>
                        <QFile fileName={form.fileName} state={q.fileState} note={q.fileNote} onPick={q.pickFile} onRemove={q.removeFile} />
                        <div style={{ marginTop: 16 }}>
                            <QCheckRow on={form.agree} onToggle={() => set({ agree: !form.agree })} gray
                                title={<>개인정보 수집 및 이용에 동의합니다. <span style={{ color: SD.mint500 }}>*</span></>} sub="이름·연락처·이메일은 견적 상담 목적으로만 사용돼요." />
                        </div>
                    </QSection>

                    <QuoteHoneypot value={form.website} onChange={(v) => set({ website: v })} />
                </div>

                <aside aria-label="견적 요약" style={{ flex: '0 0 340px', position: 'sticky', top: 24 + 58, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {q.canSubmit ? (
                        <>
                            <QReceipt form={form} />
                            {q.error && <div style={{ marginTop: 12 }}><QError message={q.error} /></div>}
                            <button type="button" onClick={q.submit} disabled={q.submitting} style={{ ...boxButton('primary', 'large', true), marginTop: 22, opacity: q.submitting ? 0.6 : 1 }}>
                                {q.submitting ? '요청 보내는 중…' : '무료로 견적 요청하기'}
                            </button>
                            <button type="button" onClick={() => jump(1)} style={{ alignSelf: 'center', marginTop: 4, padding: 6, border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12, color: SD.gray600, cursor: 'pointer' }}>내용 수정하기</button>
                        </>
                    ) : (
                        <>
                            <QStatusCard form={form} onJump={jump} footer={(
                                <>
                                    <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: SD.gray600 }}>
                                        <span>입력 진행</span><span><strong style={{ color: SD.gray900 }}>{doneCount}</strong> / {steps.length}</span>
                                    </div>
                                    <div style={{ marginTop: 8 }}><QProgress steps={steps} onJump={jump} /></div>
                                    <div style={{ padding: '20px 0 22px' }}>
                                        <button type="button" onClick={q.submit} style={{ ...boxButton('primary', 'large', true), background: SD.gray200, color: SD.gray500 }}>견적 요청하기</button>
                                        <p style={{ margin: '8px 0 0', textAlign: 'center', fontSize: 12, color: SD.gray600 }}>{q.missingText}</p>
                                    </div>
                                </>
                            )} />
                            <div style={{ padding: '16px 18px', border: `1px solid ${SD.gray200}`, borderRadius: 16, background: SD.white, display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700 }}>무료 · 부담 없음</span>
                                    <span style={{ fontSize: 12, color: SD.gray600 }}>24시간 안에 한국어 스태프가 답변해요</span>
                                </span>
                                <QKakaoLink label="카카오톡" style={{ flex: 'none', height: 36, padding: '0 12px 0 8px', border: `1px solid ${SD.gray200}`, borderRadius: 9999, fontSize: 12 }} />
                            </div>
                        </>
                    )}
                </aside>
            </div>
        </main>
    );
}
