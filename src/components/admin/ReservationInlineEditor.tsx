import { useEffect, useRef, useState } from 'react';
import type { ReservationDocContent } from './ReservationDocumentEditor';
import type { Activity, DocumentSettings, TemplateDay } from '../../pages/AdminTemplateManage';
import { createInlineDocument, applyQuoteSnippet, groupQuoteLibrary, quoteDayFields, updateQuoteDay, fillQuoteDayDates } from '../../utils/reservationInline';
import { uploadImage } from '../../utils/upload';
import { QuoteDayEditor } from './QuoteDayEditor';

interface Props {
    reservationId: string;
    initialContent: ReservationDocContent;
    mode: 'itinerary' | 'contract';
    onModeChange?: (mode: 'itinerary' | 'contract') => void;
    startDate: string;
    endDate: string;
    dailyAccommodations?: Array<{ day: number; accommodation: { name: string } }>;
    onSave: (content: ReservationDocContent, dates: { startDate: string; endDate: string }, kind: 'itinerary' | 'contract') => Promise<void>;
    onDirtyChange: (dirty: boolean) => void;
    onBusyChange?: (busy: boolean) => void;
    onClose: () => void;
    disabled?: boolean;
}

interface Libraries {
    snippets: Record<string, any>;
    snippet_cats: string[];
    spots: Record<string, any>;
    spot_cats: string[];
}

const emptyLibraries = (): Libraries => ({ snippets: {}, snippet_cats: [], spots: {}, spot_cats: [] });
const textValue = (value: unknown) => typeof value === 'string' ? value : '';
const photoList = (value: unknown): string[] => Array.isArray(value) ? value.filter(item => typeof item === 'string' && item) : [];
const cloneContent = (content: ReservationDocContent) => createInlineDocument(content, null, content.name);
const renumber = (days: TemplateDay[]) => days.map((day, index) => ({ ...day, day: index + 1 }));

/** 일정과 계약 조건을 현재 예약 상세 본문 안에서 편집한다. */
export function ReservationInlineEditor(p: Props) {
    const [draft, setDraft] = useState(() => cloneContent(p.initialContent));
    const [dates, setDates] = useState({ startDate: p.startDate, endDate: p.endDate });
    const [activeMode, setActiveMode] = useState(p.mode);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [notice, setNotice] = useState('');
    const [noticeFailed, setNoticeFailed] = useState(false);
    const [libraries, setLibraries] = useState<Libraries>(emptyLibraries);
    const [libraryLoading, setLibraryLoading] = useState(true);
    const [libraryError, setLibraryError] = useState('');
    const [libraryAttempt, setLibraryAttempt] = useState(0);
    const fingerprint = `${p.reservationId}:${JSON.stringify(p.initialContent)}:${p.startDate}:${p.endDate}`;
    const appliedFingerprint = useRef(fingerprint);
    const locked = !!p.disabled || saving || uploading;

    useEffect(() => { setActiveMode(p.mode); }, [p.mode]);
    useEffect(() => {
        if (dirty || saving || uploading || appliedFingerprint.current === fingerprint) return;
        appliedFingerprint.current = fingerprint;
        const next = cloneContent(p.initialContent);
        const sourceChanged = JSON.stringify(next) !== JSON.stringify(draft) || p.startDate !== dates.startDate || p.endDate !== dates.endDate;
        setDraft(next);
        setDates({ startDate: p.startDate, endDate: p.endDate });
        if (sourceChanged) setNotice('');
        // Refreshing assignments or switching between document modes must keep an open draft.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fingerprint, dirty, saving, uploading]);
    useEffect(() => { p.onDirtyChange(dirty); }, [dirty, p.onDirtyChange]);
    useEffect(() => () => p.onDirtyChange(false), [p.onDirtyChange]);
    useEffect(() => { p.onBusyChange?.(saving || uploading); }, [saving, uploading, p.onBusyChange]);
    useEffect(() => () => p.onBusyChange?.(false), [p.onBusyChange]);

    useEffect(() => {
        const controller = new AbortController();
        setLibraryLoading(true);
        setLibraryError('');
        const read = async (key: keyof Libraries) => {
            const response = await fetch(`/api/data/${key}`, { cache: 'no-store', signal: controller.signal });
            const payload = await response.json();
            if (!response.ok || payload?.ok !== true) throw new Error('일정·명소 자료를 불러오지 못했습니다.');
            if (key.endsWith('_cats')) {
                if (payload.data == null) return [];
                if (!Array.isArray(payload.data) || payload.data.some((item: unknown) => typeof item !== 'string')) throw new Error('자료의 지역 목록을 확인할 수 없습니다.');
                return payload.data;
            }
            if (payload.data == null) return {};
            if (typeof payload.data !== 'object' || Array.isArray(payload.data)) throw new Error('일정·명소 자료 형식을 확인할 수 없습니다.');
            return payload.data;
        };
        Promise.all([read('snippets'), read('snippet_cats'), read('spots'), read('spot_cats')])
            .then(([snippets, snippet_cats, spots, spot_cats]) => { if (!controller.signal.aborted) setLibraries({ snippets, snippet_cats, spots, spot_cats }); })
            .catch(error => { if (!controller.signal.aborted) setLibraryError(error?.message || '자료를 불러오지 못했습니다. 다시 시도해 주세요.'); })
            .finally(() => { if (!controller.signal.aborted) setLibraryLoading(false); });
        return () => controller.abort();
    }, [libraryAttempt]);

    const touch = () => { setDirty(true); setNotice(''); setNoticeFailed(false); };
    const changeMode = (mode: 'itinerary' | 'contract') => {
        if (locked) return;
        setActiveMode(mode); p.onModeChange?.(mode);
    };
    const edit = (change: (current: ReservationDocContent) => ReservationDocContent) => { if (locked) return; touch(); setDraft(change); };
    const editDay = (index: number, change: (day: TemplateDay) => TemplateDay) => edit(current => ({ ...current, days: current.days.map((day, i) => i === index ? change(day) : day) }));
    const editActivity = (dayIndex: number, index: number, change: (activity: Activity) => Activity) => editDay(dayIndex, day => ({ ...day, activities: day.activities.map((activity, i) => i === index ? change(activity) : activity) }));
    const editContract = <K extends keyof DocumentSettings['contract'],>(key: K, value: DocumentSettings['contract'][K]) => edit(current => ({ ...current, documentSettings: { ...current.documentSettings, contract: { ...current.documentSettings.contract, [key]: value } } }));
    const setDate = (key: keyof typeof dates, value: string) => { if (locked) return; touch(); setDates(current => ({ ...current, [key]: value })); };
    const moveDay = (index: number, target: number) => edit(current => {
        const days = [...current.days];
        if (target < 0 || target >= days.length) return current;
        const [moved] = days.splice(index, 1);
        days.splice(target, 0, moved);
        return { ...current, days: renumber(days) };
    });
    const removeDay = (index: number) => {
        if (locked) return;
        if (draft.days.length <= 1) { setNotice('최소 1일은 필요합니다.'); setNoticeFailed(true); return; }
        edit(current => ({ ...current, days: renumber(current.days.filter((_, i) => i !== index)) }));
    };
    const fillDates = () => {
        if (locked) return;
        if (!dates.startDate) { setNotice('여행 시작일을 먼저 입력하세요.'); setNoticeFailed(true); return; }
        edit(current => ({ ...current, days: fillQuoteDayDates(current.days, dates.startDate) }));
        setNotice('출발일 기준으로 여행일자를 채웠어요 — 각 칸에서 자유롭게 수정할 수 있어요.');
    };
    const loadSnippet = (index: number, name: string) => {
        if (locked || !name || !libraries.snippets[name]) return;
        editDay(index, day => applyQuoteSnippet(day, libraries.snippets[name]));
    };
    const toggleSpot = (name: string, value: any) => edit(current => {
        const selected = current.highlights || [];
        if (selected.some(spot => spot.name === name)) return { ...current, highlights: selected.filter(spot => spot.name !== name) };
        return { ...current, highlights: [...selected, {
            name, nameMn: textValue(value.nameMn), desc: textValue(value.desc), img: textValue(value.img), subImgs: [...photoList(value.subImgs)],
        }] };
    });
    const addPhotos = async (dayIndex: number, activityIndex: number | null, files: FileList | null) => {
        if (locked || !files?.length) return;
        touch(); setUploading(true);
        try {
            const urls = await Promise.all(Array.from(files).map(file => uploadImage(file, 'reservation-docs')));
            setDraft(current => ({ ...current, days: current.days.map((day, index) => index !== dayIndex ? day : activityIndex == null
                ? { ...day, images: [...photoList(day.images), ...urls] }
                : { ...day, activities: day.activities.map((activity, i) => i === activityIndex ? { ...activity, images: [...photoList(activity.images), ...urls] } : activity) }) }));
        } catch (error: any) { setNotice(error?.message || '사진을 업로드하지 못했습니다. 다시 시도하세요.'); setNoticeFailed(true); }
        finally { setUploading(false); }
    };
    const save = async () => {
        if (locked) return;
        if (!!dates.startDate !== !!dates.endDate) { setNotice('여행 시작일과 종료일을 함께 입력하세요.'); setNoticeFailed(true); return; }
        if (dates.endDate && dates.endDate < dates.startDate) { setNotice('여행 종료일은 시작일보다 빠를 수 없습니다.'); setNoticeFailed(true); return; }
        if (activeMode === 'itinerary' && !draft.days.length) { setNotice('일차를 추가하고 일정을 작성해 주세요.'); setNoticeFailed(true); return; }
        setSaving(true); setNotice(''); setNoticeFailed(false);
        try {
            const content = cloneContent({ ...draft, days: renumber(draft.days) });
            await p.onSave(content, dates, activeMode);
            setDraft(content); setDirty(false);
            setNotice('저장했습니다. 고객 공개와 전달은 문서 영역에서 진행하세요.');
        } catch (error: any) { setNotice(error?.message || '저장하지 못했습니다. 입력한 내용은 남아 있습니다. 다시 시도하세요.'); setNoticeFailed(true); }
        finally { setSaving(false); }
    };
    const close = () => {
        if (saving || uploading) return;
        if (dirty && !window.confirm('저장하지 않은 문서 변경사항을 버리고 편집을 닫을까요?')) return;
        p.onClose();
    };
    const spotGroups = groupQuoteLibrary(libraries.spots, libraries.spot_cats);
    const contract = draft.documentSettings.contract;
    const expectedDays = dates.startDate && dates.endDate ? Math.round((Date.parse(dates.endDate) - Date.parse(dates.startDate)) / 86400000) + 1 : null;
    const photos = (urls: string[], remove: (index: number) => void) => urls.length > 0 && <div className="ri-photos">{urls.map((url, i) => <figure key={`${url}-${i}`}><img src={url} alt={`일정 사진 ${i + 1}`} loading="lazy" /><button type="button" disabled={locked} onClick={() => remove(i)} aria-label={`사진 ${i + 1} 삭제`}>×</button></figure>)}</div>;

    return <section id="sec-inline-doc" className="card ri-editor" aria-label="예약 문서 본문 편집" aria-busy={saving || uploading}>
        <div className="ri-heading"><div><span className="ri-kicker">예약 문서 작성</span><h2>예약 상세에서 바로 편집하세요</h2><p>저장한 일정과 계약 조건을 미리보기에서 확인할 수 있습니다.</p></div><button type="button" className="btn btn-ghost" onClick={close} disabled={saving || uploading}>편집 닫기</button></div>
        <div className="ri-modes" aria-label="문서 편집 종류"><button type="button" className={activeMode === 'itinerary' ? 'is-selected' : ''} aria-pressed={activeMode === 'itinerary'} disabled={locked} onClick={() => changeMode('itinerary')}>확정 일정표</button><button type="button" className={activeMode === 'contract' ? 'is-selected' : ''} aria-pressed={activeMode === 'contract'} disabled={locked} onClick={() => changeMode('contract')}>여행 계약서</button><span>{dirty ? '저장하지 않은 변경사항' : '저장된 문서 기준'}</span></div>
        <form id={`reservation-inline-${p.reservationId}`} noValidate onSubmit={event => { event.preventDefault(); void save(); }}>
        <fieldset className="ri-form" disabled={locked} inert={locked}>
            <div className="ri-basics"><label className="ri-field ri-wide"><span>여행명</span><input value={draft.name} onChange={e => edit(current => ({ ...current, name: e.target.value }))} /></label><label className="ri-field"><span>여행 시작일</span><input type="date" value={dates.startDate} onChange={e => setDate('startDate', e.target.value)} /></label><label className="ri-field"><span>여행 종료일</span><input type="date" value={dates.endDate} min={dates.startDate || undefined} onChange={e => setDate('endDate', e.target.value)} /></label></div>
            {activeMode === 'itinerary' ? <>
                <div className="ri-quote-section quote-day-editor">
                    <div className="ri-quote-head"><h3>일자별 일정</h3><p>일차별 일정을 구성하고 프리셋으로 빠르게 채웁니다.</p></div>
                    <p className="ri-quote-hint">목적지·이동·세부 일정을 자유롭게 수정하세요. (한 줄에 하나씩. "*"로 시작하면 강조, "("로 시작하면 회색)</p>
                    {expectedDays != null && expectedDays > 0 && <p className={expectedDays === draft.days.length ? 'ri-day-count is-matched' : 'ri-day-count is-mismatched'}>{expectedDays === draft.days.length ? '✓ 여행 기간과 일정 칸 수가 맞습니다.' : '여행 기간에 맞춰 일자를 추가·삭제하세요.'} {expectedDays}일 여행 · 일정 {draft.days.length}일</p>}
                    <button type="button" className="ri-fill-dates" onClick={fillDates}>📅 출발일 기준 여행일자 자동 입력 (선택)</button>
                    {libraryLoading && <p className="ri-library-note" role="status">저장된 일정과 명소를 불러오고 있습니다.</p>}
                    {libraryError && <div className="ri-library-error" role="alert">{libraryError}<button type="button" onClick={() => setLibraryAttempt(current => current + 1)}>다시 시도</button></div>}
                    <QuoteDayEditor syncKey={appliedFingerprint.current} days={draft.days.map((day, index) => ({ ...quoteDayFields(day), d: index + 1 }))}
                        startDate={dates.startDate} endDate={dates.endDate} snippets={libraries.snippets} snippetCats={libraries.snippet_cats} disabled={locked}
                        onField={(index, field, value) => editDay(index, day => updateQuoteDay(day, field === 'move' ? value : { [field]: value }))}
                        onSnippet={loadSnippet} onDelete={removeDay} onReorder={moveDay}
                        onAdd={() => edit(current => ({ ...current, days: [...current.days, { day: current.days.length + 1, date: '', dateMode: 'manual', title: '', items: [], activities: [], meals: {}, accommodation: null }] }))}
                        onNotice={message => { setNotice(message); setNoticeFailed(false); }}
                        renderDetails={dayIndex => {
                            const day = draft.days[dayIndex];
                            if (!day) return null;
                            const assigned = p.dailyAccommodations?.find(stay => stay.day === dayIndex + 1)?.accommodation.name;
                            return <>
                                {assigned && <p className="ri-assigned-stay"><b>실제 배정 숙소 · {assigned}</b><span>고객 일정표에는 배정 숙소가 우선 표시됩니다.</span></p>}
                                <details className="ri-rich-details"><summary>사진·상세 설명</summary><div className="ri-rich-body">
                                    <label className="ri-field"><span>지역</span><input value={day.region || ''} onChange={e => editDay(dayIndex, current => ({ ...current, region: e.target.value }))} /></label>
                                    {day.retainedSummary && <p className="ri-library-note">기존 상품 안내 · {day.retainedSummary}</p>}
                                    {photos(photoList(day.images), index => editDay(dayIndex, current => ({ ...current, images: photoList(current.images).filter((_, i) => i !== index) })))}
                                    <label className="ri-upload">＋ 일차 사진 추가<input type="file" accept="image/*" multiple onChange={e => { void addPhotos(dayIndex, null, e.target.files); e.target.value = ''; }} /></label>
                                    {day.activities.map((activity, activityIndex) => <div className="ri-activity" key={activityIndex}>
                                        <strong className="ri-rich-title">{[activity.time, activity.title].filter(Boolean).join(' ') || '사진 일정'}</strong>
                                        <label className="ri-field"><span>상세 설명</span><textarea rows={2} value={activity.description || ''} onChange={e => editActivity(dayIndex, activityIndex, current => ({ ...current, description: e.target.value }))} /></label>
                                        {photos(photoList(activity.images), index => editActivity(dayIndex, activityIndex, current => ({ ...current, images: photoList(current.images).filter((_, i) => i !== index) })))}
                                        <label className="ri-upload">＋ 항목 사진 추가<input type="file" accept="image/*" multiple onChange={e => { void addPhotos(dayIndex, activityIndex, e.target.files); e.target.value = ''; }} /></label>
                                    </div>)}
                                    <label className="ri-field"><span>숙소 태그</span><input value={day.accommodation?.tags || ''} onChange={e => editDay(dayIndex, current => ({ ...current, accommodation: { ...(current.accommodation || { name: '' }), tags: e.target.value } }))} /></label>
                                </div></details>
                            </>;
                        }} />
                </div>
                <div className="ri-spots"><div className="ri-section-title"><div><h3>대표 명소</h3><p>선택한 순서대로 고객 일정표에 표시합니다.</p></div></div>{(draft.highlights || []).length > 0 && <div className="ri-selected-spots">{draft.highlights!.map((spot, index) => <button type="button" key={`${spot.name}-${index}`} onClick={() => edit(current => ({ ...current, highlights: current.highlights?.filter((_, i) => i !== index) }))}>{index + 1}. {spot.name} ×</button>)}</div>}{spotGroups.map(group => <div className="ri-spot-group" key={group.name}><h4>{group.name}</h4><div>{group.items.map(({ name, value }) => { const position = (draft.highlights || []).findIndex(spot => spot.name === name); return <button type="button" key={name} aria-pressed={position >= 0} className={position >= 0 ? 'is-selected' : ''} onClick={() => toggleSpot(name, value)}><span className="ri-spot-indicator">{position >= 0 ? position + 1 : '＋'}</span><span><b>{name}</b><small>{textValue(value.short)}</small></span></button>; })}</div></div>)}{!libraryLoading && !libraryError && !spotGroups.length && <p className="ri-library-note">등록된 명소가 없습니다. 명소 관리에서 추가할 수 있습니다.</p>}</div>
            </> : <div className="ri-contract"><h3>여행 계약 조건</h3><p className="ri-library-note">현재 문서의 원문을 확인하고 필요한 내용을 수정하세요.</p><label className="ri-field"><span>계약서 서문</span><textarea rows={4} value={contract.intro} onChange={e => editContract('intro', e.target.value)} /></label><div className="ri-contract-fields"><label className="ri-field"><span>지급 방법</span><input value={contract.paymentMethod} onChange={e => editContract('paymentMethod', e.target.value)} /></label><label className="ri-field"><span>지급 기한</span><input value={contract.paymentDeadline} onChange={e => editContract('paymentDeadline', e.target.value)} /></label><label className="ri-field"><span>포함 사항</span><textarea rows={4} value={contract.includedText} onChange={e => editContract('includedText', e.target.value)} /></label><label className="ri-field"><span>불포함 사항</span><textarea rows={4} value={contract.excludedText} onChange={e => editContract('excludedText', e.target.value)} /></label></div><div className="ri-small-heading"><h4>취소 규정</h4><button type="button" onClick={() => editContract('cancellationRows', [...contract.cancellationRows, { period: '', fee: '' }])}>＋ 규정 행 추가</button></div>{contract.cancellationRows.map((row, index) => <div className="ri-cancellation-row" key={index}><label className="ri-field"><span>취소 시점</span><input value={row.period} onChange={e => editContract('cancellationRows', contract.cancellationRows.map((item, i) => i === index ? { ...item, period: e.target.value } : item))} /></label><label className="ri-field"><span>취소 요금</span><input value={row.fee} onChange={e => editContract('cancellationRows', contract.cancellationRows.map((item, i) => i === index ? { ...item, fee: e.target.value } : item))} /></label><button type="button" className="ri-remove" onClick={() => editContract('cancellationRows', contract.cancellationRows.filter((_, i) => i !== index))}>삭제</button></div>)}<label className="ri-field"><span>동의 문구</span><textarea rows={3} value={contract.signatureNote} onChange={e => editContract('signatureNote', e.target.value)} /></label></div>}
        </fieldset>
        <div className="ri-savebar"><span className={noticeFailed ? 'ri-save-error' : ''} role={noticeFailed ? 'alert' : 'status'}>{uploading ? '사진 업로드 중입니다…' : saving ? '문서를 저장하고 있습니다…' : notice || (dirty ? '변경사항을 저장하세요.' : '현재 예약의 문서를 편집합니다.')}</span><button type="submit" className="btn btn-ink" disabled={locked}>{saving ? '저장 중…' : activeMode === 'contract' ? '계약 조건 저장' : '일정 저장'}</button></div>
        </form>
    </section>;
}
