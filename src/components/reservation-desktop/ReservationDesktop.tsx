import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MW_STICKY_TOP, won } from '../desktop-primitives/mwTokens';
import { SD, SIcon } from '../site-seed/seed';
import { addDays, durationLabel, findOption, priceLines, sortTiers, type ReservationStepProps } from '../reservation-shared/bookingShared';
import { BookingSummaryAside, OptionList, StepSection, TierGrid, TierPopover, TripCalendar } from './BookingPartsDesktop';
import { fmtMd, rangeText } from './bookingDesktopText';
import { ReservationShell } from './ReservationShell';

/**
 * PC 예약 1단계(디자인 ‘예약하기 — 1단계 (PC)’): ① 여행 시작일(달력) ② 인원(관리자 인원 단계 칸 + 인원별 요금 말풍선)
 * ③④ 숙박·차량 옵션(관리자가 등록한 상품만) + 오른쪽 붙는 예약 요약. 상태는 pages/Reservation.tsx가 갖고(휴대폰과 같은 흐름), 여기는 그리기만 한다.
 */
export function ReservationDesktop({
    product, parsedDuration, selectedStartDate, setSelectedStartDate, totalPeople, setTotalPeople,
    selectedAccomId, setSelectedAccomId, selectedVehicleId, setSelectedVehicleId, baseOption, priceBreakdown, onNext,
}: ReservationStepProps) {
    const navigate = useNavigate();
    const [tipOpen, setTipOpen] = useState(false);
    const tiers = useMemo(() => sortTiers(product.pricingOptions), [product.pricingOptions]);
    const accommodations = product.accommodationOptions ?? [];
    const vehicles = product.vehicleOptions ?? [];
    const nights = Math.max(0, parsedDuration.nights);
    const days = parsedDuration.days;
    const durationText = durationLabel(nights, days, product.duration);
    const endDate = selectedStartDate ? addDays(selectedStartDate, nights) : null;
    const ready = !!selectedStartDate;
    const accom = findOption(accommodations, selectedAccomId);
    const vehicle = findOption(vehicles, selectedVehicleId);
    const typeLabel = product.packageType === 'full' ? '풀패키지' : product.packageType === 'value' ? '실속형' : '';
    const maxTier = tiers[tiers.length - 1]?.people;
    const minTier = tiers[0]?.people;
    const groupSaves = tiers.length > 1 && tiers[tiers.length - 1].pricePerPerson < tiers[0].pricePerPerson;
    let sectionNo = 2;

    const money = {
        total: priceBreakdown.total,
        deposit: priceBreakdown.deposit,
        balance: Math.max(0, priceBreakdown.total - priceBreakdown.deposit),
        lines: priceLines(baseOption, totalPeople, accom, vehicle),
    };

    return (
        <ReservationShell step={1} productName={product.name} productId={product.id}
            back={{ label: '상품으로', onClick: () => (product.id ? navigate(`/products/${product.id}`) : navigate(-1)) }}>
            <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <StepSection no={1} title="여행 시작일 선택"
                        sub={nights > 0 ? `${durationText} 여행이에요. 시작일을 고르면 종료일은 자동으로 정해져요.` : '여행 시작일을 골라 주세요.'}>
                        <TripCalendar value={selectedStartDate} onChange={setSelectedStartDate} nights={nights} />
                        {selectedStartDate && endDate && (
                            <div style={{ marginTop: 16, padding: '16px 20px', border: `1px solid ${SD.mint200}`, borderRadius: 14, background: SD.white, display: 'flex', alignItems: 'center', gap: 16 }}>
                                <span style={{ flex: 'none', width: 40, height: 40, borderRadius: 12, background: SD.mint50, color: SD.mint700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <SIcon name="calendarCheck" size={20} stroke={1.7} />
                                </span>
                                <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <span style={{ fontSize: 11, color: SD.gray600 }}>출발</span>
                                        <span style={{ fontSize: 16, fontWeight: 700, color: SD.gray900 }}>{fmtMd(selectedStartDate)}</span>
                                    </span>
                                    {nights > 0 && (
                                        <>
                                            <span style={{ color: SD.gray600, display: 'flex' }}><SIcon name="arrowRight" size={18} stroke={1.8} /></span>
                                            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                <span style={{ fontSize: 11, color: SD.gray600 }}>도착</span>
                                                <span style={{ fontSize: 16, fontWeight: 700, color: SD.gray900 }}>{fmtMd(endDate)}</span>
                                            </span>
                                        </>
                                    )}
                                    {durationText && <span style={{ height: 26, padding: '0 10px', borderRadius: 9999, background: SD.mint50, color: SD.mint700, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>{durationText}</span>}
                                </div>
                                <button type="button" onClick={() => setSelectedStartDate(null)}
                                    style={{ flex: 'none', height: 34, padding: '0 12px', border: `1px solid ${SD.gray200}`, borderRadius: 9999, background: SD.white, fontFamily: 'inherit', fontSize: 13, color: SD.gray700, cursor: 'pointer' }}>
                                    다시 선택
                                </button>
                            </div>
                        )}
                    </StepSection>

                    <section style={{ background: SD.white, border: `1px solid ${SD.gray200}`, borderRadius: 16, padding: '28px 32px' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 }} onMouseLeave={() => setTipOpen(false)}>
                            <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 30 }}>
                                    <span style={{ flex: 'none', width: 26, height: 26, borderRadius: 9999, background: SD.gray900, color: SD.white, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
                                    <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: SD.gray900, lineHeight: '30px' }}>인원 선택</h2>
                                    {tiers.length > 1 && (
                                        <span style={{ marginLeft: 'auto', flex: 'none', display: 'flex', alignItems: 'center' }}>
                                            <button type="button" aria-label="인원별 요금 보기" aria-expanded={tipOpen} onClick={() => setTipOpen(!tipOpen)} onMouseEnter={() => setTipOpen(true)}
                                                style={{ height: 30, padding: '0 12px', border: 'none', borderRadius: 9999, background: SD.gray100, color: SD.gray700, fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                                                    display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                                                <SIcon name="info" size={14} stroke={2} />인원별 요금
                                            </button>
                                        </span>
                                    )}
                                </div>
                                <span style={{ paddingLeft: 38, fontSize: 13, color: SD.gray600 }}>
                                    {tiers.length > 0
                                        ? [groupSaves ? '함께 가는 인원이 많을수록 1인 요금이 저렴해요' : '', minTier ? `최소 ${minTier}명부터 예약할 수 있어요` : ''].filter(Boolean).join(' · ')
                                        : '이 상품은 인원별 요금이 아직 정해지지 않았어요. 카카오톡으로 문의해 주세요.'}
                                </span>
                            </div>
                            {tipOpen && tiers.length > 1 && (
                                <TierPopover tiers={tiers} people={totalPeople} depositPer={baseOption?.depositPerPerson ?? 0}
                                    onPick={(n) => setTotalPeople(n)} onClose={() => setTipOpen(false)} />
                            )}
                        </div>
                        {tiers.length > 0 && <TierGrid tiers={tiers} people={totalPeople} onPick={setTotalPeople} />}
                        {maxTier && (
                            <p style={{ margin: '14px 0 0', fontSize: 12, color: SD.gray600 }}>
                                {maxTier + 1}명 이상 단체는{' '}
                                <a href="/custom-estimate" onClick={(e) => { e.preventDefault(); navigate('/custom-estimate'); }} style={{ color: SD.gray900, fontWeight: 700 }}>맞춤 견적</a>으로 문의해 주세요.
                            </p>
                        )}
                    </section>

                    {accommodations.length > 0 && (
                        <StepSection no={++sectionNo} title="숙박 옵션" sub="원하시는 숙박 유형을 골라 주세요.">
                            <OptionList options={accommodations} selectedId={selectedAccomId} onSelect={setSelectedAccomId} />
                        </StepSection>
                    )}
                    {vehicles.length > 0 && (
                        <StepSection no={++sectionNo} title="차량 옵션" sub="참가 인원에 맞춰 알맞은 차량을 배정해 드려요.">
                            <OptionList options={vehicles} selectedId={selectedVehicleId} onSelect={setSelectedVehicleId} />
                        </StepSection>
                    )}
                </div>

                <BookingSummaryAside
                    product={product}
                    typeLabel={typeLabel}
                    durationText={durationText}
                    range={selectedStartDate && endDate ? rangeText(selectedStartDate, endDate) : null}
                    people={totalPeople}
                    perText={baseOption ? won(baseOption.pricePerPerson) : undefined}
                    money={money}
                    stickyTop={MW_STICKY_TOP + 24}
                    cta={{ label: ready ? '다음 단계 · 예약자 정보 입력' : '여행 시작일을 선택해 주세요', onClick: onNext, disabled: !ready }}
                    note="예약금은 숙박 시설 선결제에 쓰여 취소 시에도 환불되지 않아요."
                />
            </div>
        </ReservationShell>
    );
}
