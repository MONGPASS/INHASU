import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useHomeData } from '../../hooks/useHomeData';
import { toTourDateKey } from '../../utils/formatDate';
import { parseImage, type Accommodation, type ReservationDetail } from '../../utils/reservationDetail';
import { isUsableImage, won } from '../desktop-primitives/mwTokens';
import { AccommodationDetailModal, GuideDetailModal } from '../common/DetailModals';
import { ContactButtons, DocTile, GuideFace, PayRow, Pending, ProgressBar, Timeline } from '../mypage-desktop/BookingDetailDesktop';
import { DepositReportPanel } from '../mypage-desktop/DepositReportPanel';
import { TripThumb } from '../mypage-desktop/MyPageHome.desktop';
import { DDAY_COLOR, bookingDetailView, boxButton, darkTagStyle } from '../mypage-desktop/myBookingView';
import { MobileShell } from '../mobile/MobileShell';
import { MLoading } from '../mobile/mobileUi';
import { SD, SIcon } from '../site-seed/seed';

/**
 * 휴대폰 예약 상세(Claude Design ‘예약 상세 (예약 확정 후) — 모바일’): ‘← 예약 상세 공유’ 줄 → 예약 번호·상태 · 사진 · 이름 · 날짜 ·
 * 기간/출발까지/인원 → 결제 현황(입금 전엔 계좌와 ‘입금 완료’ 알리기) → 숙소 → 여행 서류 → 담당 가이드 → 타임라인 → 문의.
 * PC 예약 상세와 같은 조회·계산(bookingDetailView)과 부품을 쓴다.
 */
export function BookingDetailMobile() {
    const navigate = useNavigate();
    const { id = '' } = useParams();
    const [showAllHistory, setShowAllHistory] = useState(false);
    const [guideOpen, setGuideOpen] = useState(false);
    const [accModal, setAccModal] = useState<{ accommodation: Accommodation; day: number; date: string } | null>(null);
    const [shared, setShared] = useState(false);
    const [today] = useState(() => toTourDateKey(new Date()));
    const { data: home } = useHomeData();

    const { data: reservation, isPending, error } = useQuery<ReservationDetail>({
        queryKey: ['myPage', 'reservation', id],
        enabled: !!id,
        retry: false,
        queryFn: () => api.reservations.get(id),
    });
    const v = useMemo(() => (reservation ? bookingDetailView(reservation, today) : null), [reservation, today]);
    const backToList = () => {
        navigate('/mypage/reservations');
        window.scrollTo(0, 0);
    };
    const share = async () => {
        const url = window.location.href;
        try {
            if (navigator.share) {
                await navigator.share({ title: reservation?.productName || '예약 상세', url });
                return;
            }
            await navigator.clipboard?.writeText(url);
            setShared(true);
            window.setTimeout(() => setShared(false), 2000);
        } catch {
            // 공유를 취소했거나 막혀 있으면 아무것도 하지 않는다.
        }
    };
    const shareBtn = (
        <button type="button" aria-label={shared ? '주소를 복사했어요' : '공유'} onClick={share}
            style={{ width: 44, height: 44, border: 'none', background: 'transparent', color: shared ? SD.mint600 : SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <SIcon name={shared ? 'checkMark' : 'share'} size={22} stroke={1.7} />
        </button>
    );
    const shell = (children: ReactNode) => (
        <MobileShell title="예약 상세" onBack={backToList} brandHeader={false} titleAction={reservation ? shareBtn : undefined} footer={false}>{children}</MobileShell>
    );

    if (isPending) return shell(<MLoading pad={120} />);
    if (error || !reservation || !v) {
        return shell(
            <section style={{ padding: '72px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', background: SD.white }}>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: SD.gray900 }}>예약을 찾을 수 없어요</h1>
                <p style={{ margin: 0, fontSize: 14, color: SD.gray600 }}>예약 내역에서 다시 골라 주세요.</p>
                <button type="button" onClick={backToList} style={{ ...boxButton('primary', 'medium'), marginTop: 8 }}>예약 내역으로</button>
            </section>,
        );
    }

    const product = home.products.find((p) => p.id === reservation.productId);
    const image = product?.mainImages.find(isUsableImage) || '';
    const { pb, stage } = v;
    const visibleHistory = showAllHistory ? v.history : v.history.slice(0, 3);
    const stayDate = (day: number) => {
        if (!v.start) return '';
        const d = new Date(`${v.start}T00:00:00`);
        d.setDate(d.getDate() + day - 1);
        return `${d.getMonth() + 1}월 ${d.getDate()}일(${'일월화수목금토'[d.getDay()]})`;
    };

    return shell(
        <div style={{ background: SD.white, color: SD.gray900 }}>
            <section style={sec('16px 20px 20px')}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, color: SD.gray600 }}>예약 번호 {v.number}</span>
                    <span style={{ flex: 'none', height: 26, padding: '0 10px', borderRadius: 9999, border: `1px solid ${SD.gray200}`, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 9999, background: v.dot }} />{stage.label}
                    </span>
                </div>
                {image
                    ? <img src={image} alt={reservation.productName} style={{ marginTop: 12, width: '100%', height: 180, borderRadius: 14, objectFit: 'cover', display: 'block' }} />
                    : <span aria-hidden="true" style={{ marginTop: 12, height: 180, borderRadius: 14, background: SD.gray100, color: SD.gray400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><SIcon name="mapFold" size={40} stroke={1.4} /></span>}
                <h1 style={{ margin: '14px 0 6px', fontSize: 19, fontWeight: 700, lineHeight: 1.4, wordBreak: 'keep-all' }}>{reservation.productName}</h1>
                <p style={{ margin: 0, fontSize: 13, color: SD.gray600 }}>{[v.dates, v.people > 0 ? `성인 ${v.people}명` : ''].filter(Boolean).join(' · ')}</p>
                <div style={{ marginTop: 14, padding: '12px 0', borderRadius: 12, background: SD.gray50, display: 'flex' }}>
                    <Fact label="기간" value={v.length || '—'} />
                    <span style={{ width: 1, background: SD.gray200 }} />
                    <Fact label={v.dd === '여행 중' ? '지금' : '출발까지'} value={v.dd || stage.label} color={v.dd ? DDAY_COLOR : SD.gray500} />
                    <span style={{ width: 1, background: SD.gray200 }} />
                    <Fact label="인원" value={v.people > 0 ? `${v.people}명` : '—'} />
                </div>
            </section>

            {pb && (
                <section style={sec('20px 20px 24px')}>
                    <Head title="결제 현황" />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 13, color: SD.gray600 }}>결제 완료</span>
                        <span style={{ fontSize: 20, fontWeight: 700 }}>{won(v.paid)} <span style={{ fontSize: 12, fontWeight: 500, color: SD.gray500 }}>/ {won(pb.total)}</span></span>
                    </div>
                    <ProgressBar percent={v.percent} height={6} />
                    <PayRow compact label="예약금" sub={v.depositPaid ? '무통장입금 · 입금 확인 완료' : v.depositReported ? '무통장입금 · 입금 확인 중' : '무통장입금 · 입금 확인 후 예약 확정'}
                        amount={pb.deposit} tag={v.depositPaid ? '결제 완료' : v.depositReported ? '입금 확인 중' : '미결제'} done={v.depositPaid} />
                    <PayRow compact label="현지 결제" sub="몽골 도착 후 가이드에게 현금 전달" amount={pb.local}
                        tag={v.balancePaid ? '결제 완료' : v.depositPaid ? '현지 결제 예정' : '미결제'} done={v.balancePaid} />
                    {v.depositPaid ? (
                        <p style={{ margin: '12px 0 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: SD.gray700 }}>
                            <span style={{ color: SD.mint500, display: 'flex' }}><SIcon name="checkRound" size={16} stroke={1.8} /></span>
                            {v.balancePaid ? '모든 결제가 끝났어요.' : '예약금 입금이 확인되어 예약이 확정됐어요.'}
                        </p>
                    ) : <DepositReportPanel reservation={reservation} pc={false} />}
                </section>
            )}

            <section style={sec('20px 20px 24px')}>
                <Head title={v.stays.length > 0 ? `숙소 · ${v.stays.length}박` : '숙소'} />
                {v.stays.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {v.stays.map((s) => {
                            const acc = s.accommodation;
                            const img = parseImage(acc?.images);
                            return (
                                <button key={s.day} type="button" disabled={!acc} onClick={() => acc && setAccModal({ accommodation: acc, day: s.day, date: stayDate(s.day) })} style={{ ...tile, padding: 12, cursor: acc ? 'pointer' : 'default' }}>
                                    <TripThumb src={isUsableImage(img) ? img : ''} alt="" size={56} icon="bedStay" />
                                    <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={darkTagStyle}>{s.day}일차</span>
                                            {acc?.type && <span style={{ fontSize: 12, color: SD.gray600 }}>{acc.type}</span>}
                                        </span>
                                        <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{acc?.name || '숙소 준비 중'}</span>
                                    </span>
                                    {acc && <span style={{ flex: 'none', color: SD.gray400, display: 'flex' }}><SIcon name="chevronRight" size={16} stroke={2} /></span>}
                                </button>
                            );
                        })}
                    </div>
                ) : <Pending icon="bedStay" title="숙소를 준비 중이에요" sub="일정이 확정되면 날짜별 숙소를 알려 드려요" />}
            </section>

            <section style={sec('20px 20px 24px')}>
                <Head title="여행 서류" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <DocTile compact icon="mapFold" title="확정 일정표" ready="일정과 숙소를 확인해 보세요" pending="담당자가 작성하면 여기에 표시돼요" href={v.itineraryUrl} />
                    <DocTile compact icon="quoteDoc" title="해외여행 계약서" ready="계약 내용과 유의 사항을 확인해 보세요" pending="발행되면 메일로도 알려 드려요" href={v.contractUrl} />
                </div>
            </section>

            <section style={sec('20px 20px 24px')}>
                <Head title="담당 가이드" />
                {v.guide ? (
                    <button type="button" onClick={() => setGuideOpen(true)} style={{ ...tile, padding: 14 }}>
                        <GuideFace src={v.guide.image} size={48} />
                        <span style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 15, fontWeight: 700 }}>{v.guide.name}</span>
                            <span style={{ fontSize: 12, color: SD.gray600 }}>가이드 소개 보기</span>
                        </span>
                        <span style={{ flex: 'none', color: SD.gray400, display: 'flex' }}><SIcon name="chevronRight" size={16} stroke={2} /></span>
                    </button>
                ) : <Pending icon="user" title="담당 가이드를 배정 중이에요" sub="출발 2주 전까지 확정되면 알림으로 알려 드려요" />}
            </section>

            {v.history.length > 0 && (
                <section style={sec('20px 20px 24px')}>
                    <Head title="타임라인" />
                    <Timeline items={visibleHistory} compact />
                    {v.history.length > 3 && (
                        <button type="button" onClick={() => setShowAllHistory((x) => !x)}
                            style={{ marginTop: 14, width: '100%', padding: 6, border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: SD.gray700, cursor: 'pointer' }}>
                            {showAllHistory ? '접기' : `전체 보기 (${v.history.length}건)`}
                        </button>
                    )}
                </section>
            )}

            <section style={{ padding: 20 }}>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: SD.gray600 }}>궁금한 점은 한국어 담당 직원이 24시간 안에 답변해 드려요.</p>
                <ContactButtons />
            </section>

            <GuideDetailModal guide={v.guide} open={guideOpen} onClose={() => setGuideOpen(false)} />
            <AccommodationDetailModal accommodation={accModal?.accommodation || null} day={accModal?.day} date={accModal?.date} open={!!accModal} onClose={() => setAccModal(null)} />
        </div>,
    );
}

const sec = (padding: string): CSSProperties => ({ padding, borderBottom: `8px solid ${SD.gray50}` });
const tile: CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${SD.gray200}`, borderRadius: 12, background: SD.white,
    fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box', color: SD.gray900,
};

function Head({ title }: { title: string }) {
    return <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 700 }}>{title}</h2>;
}

function Fact({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 11, color: SD.gray600 }}>{label}</span>
            <strong style={{ fontSize: 15, color: color || SD.gray900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</strong>
        </div>
    );
}
