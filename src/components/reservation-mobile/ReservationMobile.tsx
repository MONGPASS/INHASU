import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { won } from '../desktop-primitives/mwTokens';
import { MobileShell } from '../mobile/MobileShell';
import { SD, SIcon } from '../site-seed/seed';
import { addDays, bareName, durationLabel, fmtShort, findOption, priceLines, sortTiers, type ReservationStepProps } from '../reservation-shared/bookingShared';
import { OptionList } from '../reservation-desktop/BookingPartsDesktop';
import { CloseButton, InfoNote, MSection, MoneyBoxMobile, PayBar, PeopleStepper, ProductLine, RateTable, StepBars, TierChips, TripCalendarMobile } from './BookingPartsMobile';

/**
 * 휴대폰 예약 1단계(디자인 ‘예약하기 1단계 — 모바일’): 상품 한 줄 · 3단계 막대 → ① 여행 시작일 ② 인원(−/+ · 인원 칸 · 요금표)
 * · 숙박/차량 옵션(관리자가 등록한 상품만) · 결제 금액 → 아래 결제 줄(예약금 · 다음). 상태는 pages/Reservation.tsx(PC와 같은 흐름).
 */
export function ReservationMobile({
    product, parsedDuration, selectedStartDate, setSelectedStartDate, totalPeople, setTotalPeople,
    selectedAccomId, setSelectedAccomId, selectedVehicleId, setSelectedVehicleId, baseOption, priceBreakdown, onNext,
}: ReservationStepProps) {
    const navigate = useNavigate();
    const tiers = useMemo(() => sortTiers(product.pricingOptions), [product.pricingOptions]);
    const accommodations = product.accommodationOptions ?? [];
    const vehicles = product.vehicleOptions ?? [];
    const nights = Math.max(0, parsedDuration.nights);
    const durationText = durationLabel(nights, parsedDuration.days, product.duration);
    const endDate = selectedStartDate ? addDays(selectedStartDate, nights) : null;
    const ready = !!selectedStartDate;
    const typeLabel = product.packageType === 'full' ? '풀패키지' : product.packageType === 'value' ? '실속형' : '';
    const idx = tiers.findIndex((t) => t.people === totalPeople);
    const groupSaves = tiers.length > 1 && tiers[tiers.length - 1].pricePerPerson < tiers[0].pricePerPerson;
    const lines = priceLines(baseOption, totalPeople, findOption(accommodations, selectedAccomId), findOption(vehicles, selectedVehicleId));
    const balance = Math.max(0, priceBreakdown.total - priceBreakdown.deposit);
    let no = 2;

    // 상품 화면에서 왔으면 그리로, 예약 주소를 바로 열었으면 상품 화면으로.
    const back = () => {
        if (window.history.length > 1) navigate(-1);
        else navigate(product.id ? `/products/${product.id}` : '/products');
    };
    const close = () => navigate(product.id ? `/products/${product.id}` : '/products');

    return (
        <MobileShell title="예약하기" onBack={back} brandHeader={false} footer={false}
            titleAction={<CloseButton onClick={close} />}
            bottomBar={(
                <PayBar
                    caption={priceBreakdown.deposit > 0 ? <><strong style={{ color: SD.gray900 }}>지금 결제</strong> · 성인 {totalPeople}명 예약금</> : `합계 · 성인 ${totalPeople}명`}
                    amount={won(priceBreakdown.deposit > 0 ? priceBreakdown.deposit : priceBreakdown.total)}
                    label={ready ? '다음' : '날짜 선택'}
                    disabled={!ready}
                    onAction={onNext}
                />
            )}>
            <div style={{ background: SD.white, color: SD.gray900 }}>
                <ProductLine image={product.mainImages?.[0]} meta={[typeLabel, product.category, durationText].filter(Boolean).join(' · ')} name={bareName(product.name)} />
                <StepBars step={1} divider={false} />

                <MSection no={1} title="여행 시작일" sub={nights > 0 ? '시작일을 고르면 도착일은 자동으로 정해져요' : '여행 시작일을 골라 주세요'}>
                    <TripCalendarMobile value={selectedStartDate} onChange={setSelectedStartDate} nights={nights} />
                    {selectedStartDate && endDate && (
                        <div style={{ marginTop: 12, padding: '12px 14px', border: `1px solid ${SD.gray200}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ flex: 'none', width: 32, height: 32, borderRadius: 9, background: SD.gray50, color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <SIcon name="calendarCheck" size={16} stroke={1.8} />
                            </span>
                            <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: SD.gray900, whiteSpace: 'nowrap' }}>
                                {fmtShort(selectedStartDate)}
                                {nights > 0 && <><span style={{ color: SD.gray600, display: 'flex' }}><SIcon name="arrowRight" size={14} stroke={2} /></span>{fmtShort(endDate)}</>}
                            </span>
                            <button type="button" onClick={() => setSelectedStartDate(null)}
                                style={{ flex: 'none', height: 32, padding: '0 10px', border: `1px solid ${SD.gray200}`, borderRadius: 9999, background: SD.white, fontFamily: 'inherit', fontSize: 12, color: SD.gray700, cursor: 'pointer' }}>
                                다시 선택
                            </button>
                        </div>
                    )}
                </MSection>

                <MSection no={2} title="인원"
                    sub={tiers.length > 1
                        ? `${tiers[0].people}~${tiers[tiers.length - 1].people}명${groupSaves ? ' · 많을수록 1인 요금 할인' : ''}`
                        : tiers.length === 1 ? `${tiers[0].people}명 기준 요금이에요` : '인원별 요금이 아직 정해지지 않았어요'}
                    right={tiers.length > 0 && (
                        <PeopleStepper people={totalPeople} canDec={idx > 0} canInc={idx >= 0 && idx < tiers.length - 1}
                            onDec={() => { if (idx > 0) setTotalPeople(tiers[idx - 1].people); }}
                            onInc={() => { if (idx >= 0 && idx < tiers.length - 1) setTotalPeople(tiers[idx + 1].people); }} />
                    )}>
                    {tiers.length > 1 && <TierChips tiers={tiers} people={totalPeople} onPick={setTotalPeople} />}
                    {baseOption && <RateTable tiers={tiers} people={totalPeople} unit={baseOption.pricePerPerson} />}
                    {tiers.length > 0 && (
                        <p style={{ margin: '10px 0 0', fontSize: 12, color: SD.gray600 }}>
                            {tiers[tiers.length - 1].people + 1}명 이상 단체는{' '}
                            <a href="/custom-estimate" onClick={(e) => { e.preventDefault(); navigate('/custom-estimate'); }} style={{ color: SD.gray900, fontWeight: 700 }}>맞춤 견적</a>으로 문의해 주세요.
                        </p>
                    )}
                </MSection>

                {accommodations.length > 0 && (
                    <MSection no={++no} title="숙박 옵션" sub="원하시는 숙박 유형을 골라 주세요">
                        <OptionList options={accommodations} selectedId={selectedAccomId} onSelect={setSelectedAccomId} />
                    </MSection>
                )}
                {vehicles.length > 0 && (
                    <MSection no={++no} title="차량 옵션" sub="참가 인원에 맞춰 알맞은 차량을 배정해 드려요">
                        <OptionList options={vehicles} selectedId={selectedVehicleId} onSelect={setSelectedVehicleId} />
                    </MSection>
                )}

                <MSection no={++no} title="결제 금액" sub={priceBreakdown.deposit > 0 ? '예약금만 지금 결제하고, 잔금은 현지에서 내요' : undefined} last>
                    <MoneyBoxMobile total={priceBreakdown.total} deposit={priceBreakdown.deposit} balance={balance} lineLabel={lines.length === 1 ? lines[0].k : lines.map((l) => `${l.k} ${l.v}`).join(' · ')} />
                    <InfoNote>예약금은 숙박 시설 선결제에 쓰여 취소 시에도 환불되지 않아요.</InfoNote>
                </MSection>
            </div>
        </MobileShell>
    );
}
