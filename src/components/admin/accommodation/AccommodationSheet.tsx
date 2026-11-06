import React from 'react';
import type { AssignmentAccommodation, AssignmentSource } from '../../../utils/reservationAssignment';
import type { RegisteredLodge } from '../../../utils/registeredAssignmentResources';
import { selectResourceLodge } from '../../../utils/accommodationResourceSelection';
import { LODGE_BOOKING_STATUSES, LODGE_BOOKING_UNSENT, lodgeBookingLabel } from '../../../utils/lodgeBookingStatus';
import { ASSIGN_TYPE_OPTIONS, LODGE_AREA_OPTIONS, LODGE_GRADE_OPTIONS, ROOM_PLAN_OPTIONS, roomPlanLabel, tourMonthLabel, tripLengthLabel } from '../../../utils/accommodationSheet';
import { CATEGORY_OPTIONS } from '../../../utils/reservationWorkspace';
import { productCustomerHref, quoteCustomerHref } from '../../../utils/customerWorkspaceRoutes';

/** 시트에 필요한 예약 정보만 받는다(보드의 Reservation과 호환). */
export interface SheetTour {
    id: string; bookingId: string; source: AssignmentSource; customerName?: string; startDate?: string; endDate?: string;
    travelers?: number; assignmentCategory?: string;
}
type Patch = Partial<AssignmentAccommodation['accommodation']>;

/** 목록에 없는 기존 값도 지우지 않고 선택지로 보여 준다. */
const withCurrent = (options: string[], current?: string) => current && !options.includes(current) ? [current, ...options] : options;
const fmt = (key?: string) => key && /^\d{4}-\d{2}-\d{2}/.test(key) ? key.slice(0, 10) : '-';
const same = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * 숙소 배정 시트 — 현지 운영팀의 숙소 배정 스프레드시트(A~S열)와 같은 순서로 한 숙박일을 한 줄에 보여 준다.
 * A~F·H·I·L열은 예약·고객 일정에서 자동으로 채우고, G·M~S열은 관리자가 고른다.
 * 저장은 예약(투어) 단위로 기존 배정 API(버전 확인)를 그대로 쓴다.
 */
export function AccommodationSheet({ tours, rowsOf, regionOf, serials, lodges, lodgeRegions, resourcesLoading, dirty, pending, savingId, onPatch, onCategory, onSave, onResolveDraft }: {
    tours: SheetTour[];
    rowsOf: (tour: SheetTour) => AssignmentAccommodation[];
    regionOf: (tour: SheetTour) => string;
    serials: Map<string, number>;
    lodges: RegisteredLodge[];
    lodgeRegions: string[];
    resourcesLoading: boolean;
    dirty: Set<string>;
    pending: Record<string, unknown>;
    savingId: string | null;
    onPatch: (tourId: string, index: number, patch: Patch) => void;
    onCategory: (tourId: string, category: string) => void;
    onSave: (tourId: string) => void;
    onResolveDraft: (tourId: string, restore: boolean) => void;
}) {
    const areaOptions = [...new Set([...LODGE_AREA_OPTIONS, ...lodgeRegions])];
    return (
        // 옆으로 밀면 고정 열(일련번호·고객명) 가장자리에 그림자를 띄워, 아래로 지나가는 칸이 잘린 게 아니라 가려진 것임을 보여 준다.
        <div className="lo-sheet-wrap" role="region" aria-label="숙소 배정 시트" tabIndex={0}
            onScroll={e => e.currentTarget.classList.toggle('is-scrolled', e.currentTarget.scrollLeft > 0)}>
            <table className="lo-sheet">
                <thead>
                    <tr>
                        <th className="is-sticky-1">일련번호</th><th className="is-sticky-2">고객명</th><th>도착일자</th><th>출발일자</th><th>인원 수</th><th>일정</th>
                        <th className="is-edit">분류</th><th>지역</th><th>투어 월</th><th>숙소배정번호</th><th>숙소예약일자</th><th>인원 수</th>
                        <th className="is-edit">숙소지역</th><th className="is-edit">등급</th><th className="is-edit">방수</th><th className="is-edit">배정 구분</th>
                        <th className="is-edit">숙소정보</th><th className="is-edit">예약상태</th><th className="is-edit">예약메모</th>
                    </tr>
                </thead>
                <tbody>
                    {tours.map(tour => {
                        const rows = rowsOf(tour), serial = serials.get(tour.id) ?? 0, span = Math.max(1, rows.length);
                        const locked = !!pending[tour.id] || savingId === tour.id, isDirty = dirty.has(tour.id);
                        const href = tour.source === 'quote_booking' ? quoteCustomerHref(tour.bookingId, '/admin/accommodation-ops') : productCustomerHref(tour.bookingId, '/admin/accommodation-ops');
                        const tourCells = (
                            <>
                                <td rowSpan={span} className="is-sticky-1 lo-sheet-serial">{serial || '-'}</td>
                                <td rowSpan={span} className="is-sticky-2 lo-sheet-customer">
                                    <a href={href} title="고객 통합 작업 화면에서 열기"><b>{tour.customerName || '-'}</b></a>
                                    <small>{tour.source === 'quote_booking' ? '견적 예약' : '상품 예약'}</small>
                                    {pending[tour.id] ? (
                                        <span className="lo-sheet-actions">
                                            <em className="lo-kind" data-kind="draft">초안</em>
                                            <button type="button" className="lo-btn" onClick={() => onResolveDraft(tour.id, true)}>복원</button>
                                            <button type="button" className="lo-btn" onClick={() => onResolveDraft(tour.id, false)}>버리기</button>
                                        </span>
                                    ) : isDirty ? (
                                        <span className="lo-sheet-actions">
                                            <em className="lo-kind" data-kind="dirty">변경됨</em>
                                            <button type="button" className="lo-save is-small" disabled={!!savingId} onClick={() => onSave(tour.id)}>{savingId === tour.id ? '저장 중…' : '저장'}</button>
                                        </span>
                                    ) : null}
                                </td>
                                <td rowSpan={span}>{fmt(tour.startDate)}</td>
                                <td rowSpan={span}>{fmt(tour.endDate)}</td>
                                <td rowSpan={span} className="is-num">{tour.travelers || '-'}</td>
                                <td rowSpan={span}>{tripLengthLabel(tour.startDate, tour.endDate)}</td>
                                <td rowSpan={span}>
                                    <select className="lo-sheet-input" aria-label={`${tour.customerName || ''} 분류`} disabled={locked} value={tour.assignmentCategory || ''} onChange={e => onCategory(tour.id, e.target.value)}>
                                        <option value="">미정</option>
                                        {withCurrent(CATEGORY_OPTIONS, tour.assignmentCategory).map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                </td>
                                <td rowSpan={span}>{regionOf(tour)}</td>
                                <td rowSpan={span}>{tourMonthLabel(tour.startDate)}</td>
                            </>
                        );
                        if (!rows.length) return (
                            <tr key={tour.id} className={`lo-sheet-tour${isDirty ? ' is-dirty' : ''}`}>
                                {tourCells}
                                <td colSpan={10} className="lo-sheet-empty">{tripLengthLabel(tour.startDate, tour.endDate) === '당일' ? '숙박 없음' : '숙박일 확인 필요 · 카드 보기에서 일정을 확인해 주세요'}</td>
                            </tr>
                        );
                        return rows.map((night, index) => {
                            const acc = night.accommodation || {};
                            const area = (typeof acc.region === 'string' && acc.region) || acc.location || '';
                            const hasLodge = !!acc.name?.trim();
                            const label = `${tour.customerName || ''} ${night.day}박`;
                            const regional = lodges.filter(l => same(l.region || l.location, area)), others = lodges.filter(l => !regional.includes(l));
                            const registered = acc.id ? lodges.find(l => l.id === acc.id) : undefined;
                            const status = hasLodge ? acc.bookingStatus || LODGE_BOOKING_UNSENT : LODGE_BOOKING_UNSENT;
                            return (
                                <tr key={`${tour.id}:${index}`} className={`${index === 0 ? 'lo-sheet-tour' : ''}${isDirty ? ' is-dirty' : ''}`}>
                                    {index === 0 && tourCells}
                                    <td className="is-num">{serial ? `${serial}-${index + 1}` : index + 1}</td>
                                    <td>{fmt(night.date)}</td>
                                    <td className="is-num">{tour.travelers || '-'}</td>
                                    <td>
                                        <select className="lo-sheet-input" aria-label={`${label} 숙소지역`} disabled={locked} value={area} onChange={e => onPatch(tour.id, index, { location: e.target.value, region: e.target.value })}>
                                            <option value="">미정</option>
                                            {withCurrent(areaOptions, area).map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <select className="lo-sheet-input" aria-label={`${label} 등급`} disabled={locked} value={acc.type || ''} onChange={e => onPatch(tour.id, index, { type: e.target.value || undefined })}>
                                            <option value="">미정</option>
                                            {withCurrent(LODGE_GRADE_OPTIONS, acc.type).map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <select className="lo-sheet-input" aria-label={`${label} 방수`} disabled={locked} value={acc.occupancy || ''} onChange={e => onPatch(tour.id, index, { occupancy: e.target.value || undefined })}>
                                            <option value="">미정</option>
                                            {acc.occupancy && !ROOM_PLAN_OPTIONS.some(o => o.value === acc.occupancy) && <option value={acc.occupancy}>{roomPlanLabel(acc.occupancy)}</option>}
                                            {ROOM_PLAN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <select className="lo-sheet-input" aria-label={`${label} 배정 구분`} disabled={locked} value={acc.assignType || ''} onChange={e => onPatch(tour.id, index, { assignType: e.target.value })}>
                                            <option value="">미정</option>
                                            {withCurrent(ASSIGN_TYPE_OPTIONS, acc.assignType).map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <select className="lo-sheet-input is-wide" aria-label={`${label} 숙소정보`} disabled={locked || resourcesLoading} value={registered ? registered.id : hasLodge ? '__current__' : ''}
                                            onChange={e => {
                                                const v = e.target.value;
                                                if (v === '') return onPatch(tour.id, index, { id: undefined, name: '', images: [], description: '', facilities: [], address: '', roomAmenities: [], sharedFacilities: [], bookingStatus: LODGE_BOOKING_UNSENT });
                                                if (v === '__manual__') {
                                                    const name = window.prompt('목록에 없는 숙소명을 입력해 주세요.', acc.name || '')?.trim();
                                                    if (name && name !== acc.name) onPatch(tour.id, index, { id: undefined, name, images: [], description: '', facilities: [], address: '', roomAmenities: [], sharedFacilities: [], bookingStatus: LODGE_BOOKING_UNSENT });
                                                    return;
                                                }
                                                const lodge = lodges.find(l => l.id === v);
                                                if (lodge) onPatch(tour.id, index, { ...selectResourceLodge(night, lodge).accommodation, ...(area ? { location: area, region: area } : {}) });
                                            }}>
                                            <option value="">{resourcesLoading ? '숙소 불러오는 중…' : '미배정'}</option>
                                            {!registered && hasLodge && <option value="__current__">{acc.name}</option>}
                                            {area && regional.length > 0 && <optgroup label={`숙소지역: ${area}`}>{regional.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</optgroup>}
                                            <optgroup label={area && regional.length ? '다른 지역' : '등록 숙소'}>{(area && regional.length ? others : lodges).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</optgroup>
                                            <option value="__manual__">직접 입력…</option>
                                        </select>
                                    </td>
                                    <td>
                                        <select className="lo-sheet-input" data-status={status} aria-label={`${label} 예약상태`} disabled={locked || !hasLodge} title={hasLodge ? undefined : '숙소를 먼저 골라 주세요'} value={status}
                                            onChange={e => onPatch(tour.id, index, { bookingStatus: e.target.value })}>
                                            {!LODGE_BOOKING_STATUSES.some(s => s.value === status) && <option value={status}>{lodgeBookingLabel(status)}</option>}
                                            {LODGE_BOOKING_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <input className="lo-sheet-input is-memo" aria-label={`${label} 예약메모`} disabled={locked} maxLength={2000} value={acc.adminMemo || ''} placeholder="메모"
                                            onChange={e => onPatch(tour.id, index, { adminMemo: e.target.value })} />
                                    </td>
                                </tr>
                            );
                        });
                    })}
                </tbody>
            </table>
        </div>
    );
}
