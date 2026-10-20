import React from 'react';
import { Icon } from './console/Icon';
import { calendarDateKey } from '../../utils/adminTourCalendar';
import { lodgingMonthCounts, lodgingSummary, isCancelledLodgingBooking } from '../../utils/lodgingOperations';
import type { DailyAcc, Reservation } from '../../pages/AdminAccommodationOps';

const statuses = [['Илгээгээгүй','요청 준비'],['Имэйл илгээсэн','업체 회신 대기'],['Хариу ирсэн','회신 완료'],['Баталгаажсан','업체 확정']] as const;
const occupancies = ['', '1 хүн/өрөө', '2 хүн/өрөө', '3 хүн/өрөө', '4 хүн/өрөө', '5 хүн/өрөө', '6 хүн/өрөө'];
const grades = ['', '고급 게르', '일반 게르', '5성급 호텔', '4성급호텔', '목조하우스'];
const dateLabel = (value?: string) => calendarDateKey(value)?.replaceAll('-', '.') || '—';
const statusValue = (value?: string) => ({confirmed:'Баталгаажсан',sent:'Имэйл илгээсэн',replied:'Хариу ирсэн'}[value || ''] || value || 'Илгээгээгүй');
const occupancyLabel = (value: string) => value.replace(/^(\d+) хүн\/өрөө$/, '$1인실') || '미정';
const genderLabel = (value?: string) => /^(남|남성|male|m|男性)$/i.test(value || '') ? '남성' : /^(여|여성|female|f|女性)$/i.test(value || '') ? '여성' : value || '—';
const regionOf = (r: Reservation) => r.contractData?.region || r.contractData?.category || '지역 미정';
const flightLabel = (value?: {date?:string;time?:string;flight?:string}) => [value?.date,value?.time,value?.flight].filter(Boolean).join(' · ') || '미입력';
const nightDate = (r: Reservation, row: DailyAcc) => {
    if (row.date) return calendarDateKey(row.date);
    const start = calendarDateKey(r.startDate);
    return start && Number.isInteger(row.day) && row.day > 0 ? new Date(Date.parse(start + 'T00:00:00Z') + (row.day - 1) * 86400000).toISOString().slice(0,10) : '';
};
type Choice = { id:string;key:string;name:string;location?:string };
interface Props {
    items: Reservation[]; monthItems: Reservation[]; allItems: Reservation[];
    q:string; month:string; year:number; region:string; scope:'confirmed'|'all'|'check'; state:'all'|'pending'|'done'|'missing';
    regions:string[]; includePast:boolean; checkCount:number; loading:boolean;
    notice:string; warnings:string[]; catalogWarning:string; pending:Record<string,{conflict:boolean}>;
    expanded:Set<string>; dirty:Set<string>; selectedKey:string; savingId:string|null; choices:Choice[]; manual:Set<string>;
    onQ:(v:string)=>void; onMonth:(v:string)=>void; onYear:(v:number)=>void; onRegion:(v:string)=>void;
    onScope:(v:Props['scope'])=>void; onState:(v:Props['state'])=>void; onPast:(v:boolean)=>void; onReset:()=>void;
    onToggle:(r:Reservation)=>void; onOpen:(r:Reservation)=>void; customerHref:(r:Reservation)=>string;
    onSave:(r:Reservation)=>void; onResolve:(r:Reservation,restore:boolean)=>void;
    onPatch:(id:string,index:number,patch:Partial<DailyAcc['accommodation']>)=>void;
    onMeta:(id:string,index:number,patch:{day?:number;date?:string})=>void;
    onChoose:(r:Reservation,index:number,key:string)=>void; onRemove:(id:string,index:number)=>void;
    onAdd:(r:Reservation)=>void; onPopulate:(r:Reservation)=>void; onSort:(id:string)=>void;
    onGuide:(id:string,patch:{name?:string;phone?:string})=>void; onVehicle:(id:string,patch:{type?:string;phone?:string})=>void;
    requestChanged:(r:Reservation,d:DailyAcc)=>boolean;
}

export function AccommodationClassicView(p: Props) {
    const perMonth = lodgingMonthCounts(p.monthItems,p.year);
    const done = p.items.filter(r => {const s=lodgingSummary(r);return s.allConfirmed || s.notRequired;}).length;
    return <div className="lodging-ops lo-classic">
        {p.notice && <div className="lo-notice" role="status">{p.notice}</div>}
        {p.warnings.map((warning,i)=><div key={i} className="lo-notice is-warning" role="alert">{warning}</div>)}
        {p.catalogWarning && <div className="lo-notice is-warning" role="alert">{p.catalogWarning}</div>}
        {Object.keys(p.pending).length > 0 && <div className="lo-notice is-warning">보관된 배정 초안 {Object.keys(p.pending).length}건{p.allItems.filter(r=>p.pending[r.id]).map(r=><button key={r.id} className="lo-text-button" onClick={()=>p.onOpen(r)}>{r.customerName} 초안 확인<Icon name="chevron_right" /></button>)}</div>}
        <div className="lo-filter-bar">
            <label className="lo-query"><Icon name="search" /><input aria-label="고객·상품·예약번호 검색" placeholder="고객·상품·예약번호 검색" maxLength={120} value={p.q} onChange={e=>p.onQ(e.target.value)} /></label>
            <select className="lo-filter-select" aria-label="예약 범위" value={p.scope} onChange={e=>p.onScope(e.target.value as Props['scope'])}><option value="confirmed">확정 예약만</option><option value="all">전체 진행 예약</option><option value="check">정보 확인 필요 {p.checkCount}건</option></select>
            <select className="lo-filter-select" aria-label="지역 필터" value={p.region} onChange={e=>p.onRegion(e.target.value)}><option value="all">전체 지역</option>{p.regions.map(region=><option key={region}>{region}</option>)}</select>
            <select className="lo-filter-select" aria-label="숙소 배정 상태" value={p.state} onChange={e=>p.onState(e.target.value as Props['state'])}><option value="all">전체 상태</option><option value="missing">미배정 숙소 있음</option><option value="pending">미확정</option><option value="done">확정</option></select>
            <div className="lo-list-counts">조회 <b>{p.items.length}</b>건 · <span className="is-pending">미확정 <b>{p.items.length-done}</b></span> · <strong className="is-done">확정 {done}</strong></div>
        </div>
        <div className="lo-month-bar">
            <span><Icon name="calendar_month" />여행 월</span>
            <button className={`lo-all-months${p.month==='all'?' is-active':''}`} aria-pressed={p.month==='all'} onClick={()=>p.onMonth('all')}>전체 {p.monthItems.length}</button>
            <div className="lo-year-control"><button aria-label="이전 연도" disabled={p.year<=1900} onClick={()=>p.onYear(p.year-1)}><Icon name="chevron_left" /></button><strong>{p.year}년</strong><button aria-label="다음 연도" disabled={p.year>=2100} onClick={()=>p.onYear(p.year+1)}><Icon name="chevron_right" /></button></div>
            <div className="lo-months">{perMonth.map((count,index)=>{const key=`${p.year}-${String(index+1).padStart(2,'0')}`;return <button key={key} aria-label={`${p.year}년 ${index+1}월 ${count}팀`} aria-pressed={p.month===key} className={`lo-month${p.month===key?' is-active':''}${!count?' is-empty':''}`} onClick={()=>p.onMonth(key)}><strong>{index+1}월</strong><small>{count || '—'}</small></button>;})}</div>
        </div>
        <div className="lo-section-toolbar"><label><input type="checkbox" checked={p.includePast} onChange={e=>p.onPast(e.target.checked)} />지난 여행 포함</label><button className="lo-text-button" onClick={p.onReset}>필터 초기화</button><a className="lo-text-button" href="/admin/quote-desk/resources?resourceType=lodges">등록 숙소 관리<Icon name="chevron_right" /></a></div>
        <div className="lo-table-wrap"><table className="lo-table"><thead><tr><th aria-label="펼치기" /><th>상태</th><th>고객</th><th>도착 ~ 출발</th><th>박수</th><th>지역</th><th>예약일</th><th>인원</th><th>진행</th></tr></thead><tbody>
            {p.loading && !p.items.length && <tr><td colSpan={9} className="lo-empty">예약을 불러오는 중입니다…</td></tr>}
            {!p.loading && !p.items.length && <tr><td colSpan={9} className="lo-empty">조건에 맞는 예약이 없습니다.</td></tr>}
            {p.items.map(r=>{
                const sum=lodgingSummary(r), open=p.expanded.has(r.id), dirty=p.dirty.has(r.id), cancelled=isCancelledLodgingBooking(r);
                const readonly=!!p.savingId || !!p.pending[r.id] || !sum.valid || cancelled;
                const rows=r.dailyAccommodations || [], guests=r.contractData?.travelers || [], missing=sum.slots.some(slot=>slot.rowIndex===null);
                const completed=sum.allConfirmed || sum.notRequired;
                return <React.Fragment key={r.id}>
                    <tr id={`acc-row-${r.id}`} className={`lo-summary-row${open?' is-open':''}${p.selectedKey===r.id?' is-selected':''}`} onClick={()=>p.onToggle(r)}>
                        <td><button className="lo-toggle" aria-label={`${r.customerName} 숙소 배정 ${open?'접기':'펼치기'}`} aria-expanded={open} onClick={e=>{e.stopPropagation();p.onToggle(r);}}><Icon name={open?'expand_more':'chevron_right'} /></button></td>
                        <td><span className={`lo-status ${completed?'is-done':sum.assigned?'is-pending':'is-empty'}`}>{cancelled?'취소':!sum.valid?'날짜 확인':sum.notRequired?'숙박 없음':sum.allConfirmed?'확정':sum.assigned?'진행 중':'미배정'}</span></td>
                        <td><button className="lo-customer-name" title={`${r.productName || ''} · ${r.reservationNumber || r.bookingId}`} onClick={e=>{e.stopPropagation();p.onToggle(r);}}>{r.customerName || '이름 미입력'}</button><span className="lo-source">{r.source==='quote_booking'?'견적 예약':'상품 예약'}</span>{dirty&&<span className="lo-dirty">미저장</span>}</td>
                        <td>{dateLabel(r.startDate)} ~ {dateLabel(r.endDate)}</td><td>{sum.valid?`${sum.expected}박 ${sum.expected+1}일`:'—'}</td><td>{regionOf(r)}</td><td>{dateLabel(r.createdAt)}</td><td>{r.travelers==null?'—':`${r.travelers}명`}</td>
                        <td><span className={`lo-progress${completed?' is-confirmed':''}`}>{sum.valid?`${sum.confirmed}/${sum.expected} 확정`:'날짜 확인 필요'}</span>{sum.issues.length>0&&<small className="lo-warning">중복·숙박일 확인</small>}</td>
                    </tr>
                    {open&&<tr className="lo-details-row"><td colSpan={9}><section className="lo-details" aria-label={`${r.customerName} 숙소 편집`}>
                        {p.pending[r.id]&&<div className="lo-notice is-warning"><span>{p.pending[r.id].conflict?'초안 보관 후 서버 정보가 변경되었습니다. 확인 후 복원하세요.':'보관된 배정 초안이 있습니다.'}</span><button className="lo-text-button" disabled={!!p.savingId} onClick={()=>p.onResolve(r,true)}>초안 복원</button><button className="lo-text-button" disabled={!!p.savingId} onClick={()=>p.onResolve(r,false)}>초안 버리기</button></div>}
                        <div className="lo-travel-card"><strong>여행 정보</strong><div className="lo-flights"><div className="lo-flight"><span>도착 항공편 · 몽골 입국</span><strong>{flightLabel(r.contractData?.arrival)}</strong></div><div className="lo-flight"><span>출발 항공편 · 몽골 출국</span><strong>{flightLabel(r.contractData?.departure)}</strong></div></div>
                            <div className="lo-travelers-wrap"><table className="lo-travelers-table"><thead><tr><th>여행자</th><th>여권 영문 이름</th><th>이름</th><th>생년월일</th><th>성별</th><th>연락처</th></tr></thead><tbody>{guests.map((guest,index)=><tr key={index}><td>{index+1}</td><td><strong>{guest.passportName || '—'}</strong></td><td>{guest.name || '—'}</td><td>{guest.birthdate || '—'}</td><td>{genderLabel(guest.gender)}</td><td>{guest.phone || '—'}</td></tr>)}{!guests.length&&<tr><td colSpan={6} className="lo-empty">등록된 여행자 정보가 없습니다.</td></tr>}</tbody></table></div>
                        </div>
                        <div className="lo-section-toolbar"><div><strong>일자별 숙소 배정</strong><a className="lo-text-button" href={p.customerHref(r)}><Icon name="assignment" />예약 상세보기</a></div><div><button className="lo-text-button" disabled={readonly || rows.length<2} onClick={()=>p.onSort(r.id)}><Icon name="sort" />날짜순 정렬</button>{dirty&&<span className="lo-dirty">변경됨</span>}<button className="lo-save" disabled={!dirty || readonly || sum.issues.length>0} onClick={()=>p.onSave(r)}><Icon name="save" />{p.savingId===r.id?'저장 중…':'저장'}</button></div></div>
                        {(!sum.valid||cancelled)&&<div className="lo-notice is-warning">{cancelled?'취소된 예약은 배정 정보를 변경할 수 없습니다.':'예약 상세에서 여행 날짜를 먼저 확인해 주세요.'}</div>}
                        {sum.issues.length>0&&<div className="lo-notice is-warning">중복된 숙박일이나 여행 기간을 벗어난 행이 있습니다. 날짜·박 번호를 수정하거나 불필요한 행을 삭제하세요.</div>}
                        <fieldset disabled={readonly} style={{border:0,margin:0,padding:0,minWidth:0}}>
                            <div className="lo-lodging-table-wrap"><table className="lo-lodging-table"><thead><tr><th>박 · 숙박일</th><th>지역 / 위치</th><th>숙소 이름</th><th>등급</th><th>객실</th><th>인실</th><th>업체 확인 상태</th><th aria-label="삭제" /></tr></thead><tbody>{rows.map((d,index)=>{
                                const acc=d.accommodation || {}, option=p.choices.find(choice=>choice.id===acc.id), mKey=`${r.id}:${index}`, manual=p.manual.has(mKey), status=statusValue(acc.bookingStatus), requestChanged=p.requestChanged(r,d);
                                return <tr key={index} id={`lodging-night-${encodeURIComponent(r.id)}-${d.day}`}>
                                    <td><div className="lo-date-field"><label>박<input type="number" min={1} max={100} value={d.day} aria-label={`${r.customerName} ${index+1}행 박 번호`} onChange={e=>p.onMeta(r.id,index,{day:Number(e.target.value)||1})} /></label><input type="date" title={d.date || ''} aria-label={`${r.customerName} ${d.day}박 숙박일`} value={nightDate(r,d)} onChange={e=>p.onMeta(r.id,index,{date:e.target.value})} /><small>{nightDate(r,d)?['일','월','화','수','목','금','토'][new Date(nightDate(r,d)+'T12:00:00Z').getUTCDay()]:''}</small></div></td>
                                    <td><input aria-label={`${r.customerName} ${d.day}박 지역`} value={acc.location || ''} placeholder="지역 입력" onChange={e=>p.onPatch(r.id,index,{location:e.target.value})} /></td>
                                    <td><select aria-label={`${r.customerName} ${d.day}박 숙소`} value={manual?'__manual__':option?.key || (acc.name?'__saved__':'')} onChange={e=>p.onChoose(r,index,e.target.value)}><option value="">숙소 선택…</option>{acc.name&&!option&&<option value="__saved__">{acc.name} · 저장된 숙소</option>}<optgroup label="공통 등록 숙소">{p.choices.map(choice=><option key={choice.key} value={choice.key}>{choice.name}</option>)}</optgroup><option value="__manual__">직접 입력</option></select>{manual&&<div className="lo-manual-field"><input aria-label={`${r.customerName} ${d.day}박 숙소 이름`} value={acc.name || ''} placeholder="숙소 이름" onChange={e=>p.onPatch(r.id,index,{name:e.target.value,id:'',address:'',images:[],description:'',facilities:[]})} /></div>}</td>
                                    <td><select aria-label={`${r.customerName} ${d.day}박 등급`} value={acc.type || ''} onChange={e=>p.onPatch(r.id,index,{type:e.target.value})}>{acc.type&&!grades.includes(acc.type)&&<option value={acc.type}>{acc.type}</option>}{grades.map(value=><option key={value} value={value}>{value || '미정'}</option>)}</select></td>
                                    <td><input type="number" min={0} max={10000} aria-label={`${r.customerName} ${d.day}박 객실 수`} value={acc.roomCount??''} placeholder="미정" onChange={e=>p.onPatch(r.id,index,{roomCount:e.target.value===''?null:Math.max(0,Number.parseInt(e.target.value)||0)})} /></td>
                                    <td><select aria-label={`${r.customerName} ${d.day}박 인실`} value={acc.occupancy || ''} onChange={e=>p.onPatch(r.id,index,{occupancy:e.target.value})}>{acc.occupancy&&!occupancies.includes(acc.occupancy)&&<option value={acc.occupancy}>{occupancyLabel(acc.occupancy)}</option>}{occupancies.map(value=><option key={value} value={value}>{occupancyLabel(value)}</option>)}</select></td>
                                    <td><select aria-label={`${r.customerName} ${d.day}박 수배 상태`} title={requestChanged?'숙소·객실·날짜 변경을 먼저 저장해 주세요.':''} disabled={!acc.name || requestChanged} value={status} onChange={e=>p.onPatch(r.id,index,{bookingStatus:e.target.value})}>{!statuses.some(([value])=>value===status)&&<option value={status}>{status}</option>}{statuses.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></td>
                                    <td><button className="lo-row-remove" aria-label={`${r.customerName} ${index+1}행 숙박 삭제`} onClick={()=>p.onRemove(r.id,index)}><Icon name="delete" /></button></td>
                                </tr>;
                            })}{!rows.length&&<tr><td colSpan={8} className="lo-empty">숙박 행이 없습니다. 숙박 추가 또는 박수에 맞춰 생성을 선택하세요.</td></tr>}</tbody></table></div>
                            <div className="lo-add-actions"><button className="lo-text-button" disabled={!missing} onClick={()=>p.onAdd(r)}><Icon name="add" />숙박 추가</button><button className="lo-text-button" disabled={!missing} onClick={()=>p.onPopulate(r)}><Icon name="add" />박수에 맞춰 생성</button></div>
                            <div className="lo-assignment-card"><strong>담당 가이드·차량</strong><div className="lo-assignment-fields"><label>가이드 이름<input value={r.assignedGuide?.name || ''} placeholder="가이드 이름" onChange={e=>p.onGuide(r.id,{name:e.target.value})} /></label><label>가이드 연락처<input value={r.assignedGuide?.phone || ''} placeholder="가이드 연락처" onChange={e=>p.onGuide(r.id,{phone:e.target.value})} /></label><label>차량 종류<input value={r.contractData?.vehicle?.type || ''} placeholder="예: 하이스" onChange={e=>p.onVehicle(r.id,{type:e.target.value})} /></label><label>기사 연락처<input value={r.contractData?.vehicle?.phone || ''} placeholder="기사 연락처" onChange={e=>p.onVehicle(r.id,{phone:e.target.value})} /></label></div></div>
                        </fieldset>
                    </section></td></tr>}
                </React.Fragment>;
            })}
        </tbody></table></div>
    </div>;
}
