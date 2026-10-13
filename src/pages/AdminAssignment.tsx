import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { GuideSelectionModal, AccommodationSelectionModal } from '../components/admin/SelectionModals';
import { api } from '../lib/api';

interface Reservation {
    id: string;
    productName: string;
    customerName: string;
    startDate: string;
    duration: string;
    assignedGuide?: {
        id: string;
        name: string;
        image: string;
        introduction: string;
        phone: string;
        kakaoId: string;
    };
    dailyAccommodations?: Array<{
        day: number;
        accommodation: {
            id: string;
            name: string;
            type: string;
            location: string;
            images: string[];
            description: string;
            facilities: string[];
        };
    }>;
}

export const AdminAssignment: React.FC = () => {
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [showAccommodationModal, setShowAccommodationModal] = useState(false);
    const [selectedDay, setSelectedDay] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadReservations();
    }, []);

    const loadReservations = async () => {
        setIsLoading(true);
        try {
            const data = await api.reservations.list();

            if (Array.isArray(data)) {
                const mapData = data.map((r: any) => ({
                    id: r.id,
                    productName: r.product_name,
                    customerName: r.customer_name,
                    startDate: r.start_date,
                    duration: r.duration,
                    assignedGuide: r.assigned_guide_data,
                    dailyAccommodations: r.daily_accommodations
                }));
                setReservations(mapData);
            }
        } catch (e) {
            console.error('Failed to load reservations', e);
            alert('예약 목록을 불러오는데 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const getTripDays = (duration: string): number => {
        if (!duration) return 1;
        const match = duration.match(/(\d+)박/);
        return match ? parseInt(match[1]) + 1 : 1;
    };

    const handleGuideAssign = async (guide: any) => {
        if (!selectedReservation) return;

        const updated: Reservation = {
            ...selectedReservation,
            assignedGuide: {
                id: guide.id,
                name: guide.name,
                image: guide.image,
                introduction: guide.introduction,
                phone: guide.phone,
                kakaoId: guide.kakaoId
            }
        };

        if (await updateReservation(updated)) {
            setSelectedReservation(updated);
        }
    };

    const handleAccommodationAssign = async (accommodation: any) => {
        if (!selectedReservation) return;

        const dailyAccommodations = selectedReservation.dailyAccommodations || [];
        const existingIndex = dailyAccommodations.findIndex(d => d.day === selectedDay);

        const newDaily = {
            day: selectedDay,
            accommodation: {
                id: accommodation.id,
                name: accommodation.name,
                type: accommodation.type,
                location: accommodation.location,
                images: accommodation.images,
                description: accommodation.description,
                facilities: accommodation.facilities
            }
        };

        let updatedDailies;
        if (existingIndex >= 0) {
            updatedDailies = [...dailyAccommodations];
            updatedDailies[existingIndex] = newDaily;
        } else {
            updatedDailies = [...dailyAccommodations, newDaily].sort((a, b) => a.day - b.day);
        }

        const updated: Reservation = {
            ...selectedReservation,
            dailyAccommodations: updatedDailies
        };

        if (await updateReservation(updated)) {
            setSelectedReservation(updated);
        }
    };

    const updateReservation = async (updated: Reservation) => {
        try {
            const updatePayload = {
                assigned_guide_id: updated.assignedGuide?.id || null,
                assigned_guide_data: updated.assignedGuide || null,
                daily_accommodations: updated.dailyAccommodations || []
            };

            await api.reservations.update(updated.id, updatePayload);

            setReservations(prev =>
                prev.map(res => res.id === updated.id ? updated : res)
            );
            return true;
        } catch (e) {
            console.error('Failed to update reservation', e);
            alert('할당 저장에 실패했습니다. DB 컬럼이 존재하는지 확인해주세요.');
            return false;
        }
    };

    return (
        <AdminLayout activePage="reservations" title="가이드/숙소 배정">
            {isLoading ? (
                <div className="empty">
                    <Icon name="progress_activity" />
                    <p>예약 목록을 불러오는 중입니다.</p>
                </div>
            ) : (
                <div className="grid-2 route-anim">
                    {/* 예약 목록 */}
                    <div className="card">
                        <div className="card-head">
                            <h2>예약 목록</h2>
                            <div className="spacer" />
                            <span className="badge b-gray">{reservations.length}건</span>
                        </div>
                        <div className="tbl-wrap">
                            <table className="tbl">
                                <thead>
                                    <tr>
                                        <th>상품 / 예약자</th>
                                        <th>일정</th>
                                        <th className="c">가이드</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reservations.map(reservation => (
                                        <tr
                                            key={reservation.id}
                                            onClick={() => setSelectedReservation(reservation)}
                                            style={selectedReservation?.id === reservation.id
                                                ? { background: 'var(--mrt-blue-50)' }
                                                : undefined}
                                        >
                                            <td>
                                                <div className="cell-strong">{reservation.productName}</div>
                                                <div className="cell-muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                                                    {reservation.customerName} · {reservation.id.slice(0, 8)}…
                                                </div>
                                            </td>
                                            <td className="cell-muted">
                                                <div>{reservation.duration}</div>
                                                <div style={{ fontSize: 12.5, marginTop: 2 }}>{reservation.startDate}</div>
                                            </td>
                                            <td className="c">
                                                {reservation.assignedGuide
                                                    ? <span className="badge b-purple">배정됨</span>
                                                    : <span className="badge b-gray">미배정</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {reservations.length === 0 && (
                                <div className="empty"><Icon name="inbox" /><p>예약이 없습니다.</p></div>
                            )}
                        </div>
                    </div>

                    {/* 할당 패널 */}
                    <div className="stack">
                        {selectedReservation ? (
                            <>
                                <div className="trip-hero">
                                    <div className="th-label">배정 중인 예약</div>
                                    <div className="th-date">{selectedReservation.productName}</div>
                                    <div className="th-meta">
                                        <span><Icon name="person" />{selectedReservation.customerName}</span>
                                        <span><Icon name="event" />{selectedReservation.startDate}</span>
                                        <span><Icon name="schedule" />{selectedReservation.duration}</span>
                                    </div>
                                </div>

                                {/* 가이드 할당 */}
                                <div className="card">
                                    <div className="card-head">
                                        <Icon name="badge" />
                                        <h2>담당 가이드</h2>
                                    </div>
                                    <div className="card-pad">
                                        {selectedReservation.assignedGuide ? (
                                            <div className="assign-row">
                                                <img
                                                    className="avatar round"
                                                    src={selectedReservation.assignedGuide.image}
                                                    alt={selectedReservation.assignedGuide.name}
                                                />
                                                <div>
                                                    <div className="cell-strong">{selectedReservation.assignedGuide.name}</div>
                                                    <div className="cell-muted" style={{ fontSize: 12.5 }}>{selectedReservation.assignedGuide.phone}</div>
                                                </div>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ marginLeft: 'auto' }}
                                                    onClick={() => setShowGuideModal(true)}
                                                >
                                                    <Icon name="swap_horiz" />변경
                                                </button>
                                            </div>
                                        ) : (
                                            <button className="assign-empty" onClick={() => setShowGuideModal(true)}>
                                                <Icon name="add" />가이드 배정
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* 숙소 할당 */}
                                <div className="card">
                                    <div className="card-head">
                                        <Icon name="hotel" />
                                        <h2>숙소 일정</h2>
                                    </div>
                                    <div className="card-pad">
                                        <div className="stack" style={{ gap: 10 }}>
                                            {Array.from({ length: getTripDays(selectedReservation.duration) }, (_, i) => i + 1).map(day => {
                                                const assigned = selectedReservation.dailyAccommodations?.find(d => d.day === day);
                                                const startDate = new Date(selectedReservation.startDate);
                                                const currentDate = new Date(startDate);
                                                currentDate.setDate(startDate.getDate() + day - 1);
                                                const dateStr = currentDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

                                                return (
                                                    <div key={day} className="accom-day">
                                                        <span className="th-day">{day}일차<br />{dateStr}</span>
                                                        {assigned ? (
                                                            <div className="assign-row" style={{ flex: 1, padding: 0 }}>
                                                                <div>
                                                                    <div className="cell-strong">{assigned.accommodation.name}</div>
                                                                    {assigned.accommodation.location && (
                                                                        <div className="cell-muted" style={{ fontSize: 12.5 }}>{assigned.accommodation.location}</div>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    className="btn btn-ghost btn-sm"
                                                                    style={{ marginLeft: 'auto' }}
                                                                    onClick={() => {
                                                                        setSelectedDay(day);
                                                                        setShowAccommodationModal(true);
                                                                    }}
                                                                >
                                                                    <Icon name="swap_horiz" />변경
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                className="accom-empty"
                                                                onClick={() => {
                                                                    setSelectedDay(day);
                                                                    setShowAccommodationModal(true);
                                                                }}
                                                            >
                                                                <Icon name="add" />숙소 선택
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="card">
                                <div className="empty">
                                    <Icon name="assignment" />
                                    <p>예약을 선택하여 가이드와 숙소를 배정하세요.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modals */}
            <GuideSelectionModal
                isOpen={showGuideModal}
                onClose={() => setShowGuideModal(false)}
                onSelect={handleGuideAssign}
                currentGuide={selectedReservation?.assignedGuide as any || null}
            />

            <AccommodationSelectionModal
                isOpen={showAccommodationModal}
                onClose={() => setShowAccommodationModal(false)}
                onSelect={handleAccommodationAssign}
                day={selectedDay}
                currentAccommodation={selectedReservation?.dailyAccommodations?.find(d => d.day === selectedDay)?.accommodation || null}
            />
        </AdminLayout>
    );
};
