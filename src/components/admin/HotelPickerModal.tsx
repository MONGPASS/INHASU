import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { loadRegisteredAssignmentResources, registeredLodgeAsHotel } from '../../utils/registeredAssignmentResources';
import type { Hotel } from '../../types/hotel';

interface HotelPickerModalProps {
    open: boolean;
    /** Existing document fields retain a snapshot; no historical hotel lookup is required here. */
    onPick: (hotel: Hotel) => void;
    onClose: () => void;
    title?: string;
}

/** Products, itinerary documents and local operations all select the same saved lodging library. */
export const HotelPickerModal: React.FC<HotelPickerModalProps> = ({ open, onPick, onClose, title = '등록 숙소에서 선택' }) => {
    const { user } = useUser();
    const accountId = user?.role === 'admin' ? user.id : '';
    const [library, setLibrary] = useState<{ accountId: string; items: Hotel[] }>({ accountId: '', items: [] });
    const [loading, setLoading] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0), [q, setQ] = useState('');
    const panel = useRef<HTMLDivElement>(null), search = useRef<HTMLInputElement>(null);
    const hotels = library.accountId === accountId ? library.items : [];

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        setLibrary({ accountId, items: [] }); setError(''); setLoading(Boolean(accountId));
        if (!accountId) { setError('관리자 계정으로 로그인한 뒤 숙소를 선택해 주세요.'); return () => controller.abort(); }
        loadRegisteredAssignmentResources({ accountId, kinds: ['lodges'], signal: controller.signal, isCurrent: () => !controller.signal.aborted })
            .then(result => {
                if (controller.signal.aborted) return;
                setLibrary({ accountId, items: result.lodges.map(registeredLodgeAsHotel) });
                setError(result.warnings.join(' '));
            })
            .catch(cause => { if (!controller.signal.aborted && cause?.name !== 'AbortError') setError('등록 숙소를 불러오지 못했습니다. 다시 시도해 주세요.'); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [open, accountId, retry]);
    useEffect(() => { if (open) setQ(''); }, [open]);
    useEffect(() => {
        if (!open) return;
        const previous = document.activeElement as HTMLElement | null;
        search.current?.focus();
        return () => { if (previous?.isConnected) previous.focus(); };
    }, [open]);
    const filtered = useMemo(() => {
        const needle = q.trim().toLocaleLowerCase('ko-KR');
        return hotels.filter(hotel => !needle || [hotel.name_kr, hotel.region, hotel.address, hotel.grade, ...(hotel.amenities || [])].join(' ').toLocaleLowerCase('ko-KR').includes(needle))
            .sort((a, b) => a.name_kr.localeCompare(b.name_kr, 'ko-KR'));
    }, [hotels, q]);
    if (!open) return null;
    const closeOrTrap = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return; }
        if (event.key !== 'Tab') return;
        const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),[tabindex="0"]') || []);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    return <div className="fixed inset-0 z-[230] bg-slate-900/40 flex items-center justify-center p-6" onClick={onClose} onKeyDown={closeOrTrap}>
        <div ref={panel} role="dialog" aria-modal="true" aria-label={title} className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden" onClick={event => event.stopPropagation()}>
            <header className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200">
                <div><h2 className="text-lg font-bold text-slate-900">{title}</h2><p className="mt-1 text-xs text-slate-500">상품 일정과 숙소 수배에서 함께 쓰는 등록 숙소입니다. 선택한 정보는 일정에 복사됩니다.</p></div>
                <button type="button" aria-label="숙소 선택 닫기" onClick={onClose} className="w-8 h-8 shrink-0 rounded-lg hover:bg-slate-100 flex items-center justify-center"><span className="material-symbols-outlined text-slate-500">close</span></button>
            </header>
            <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-200">
                <input ref={search} type="search" aria-label="등록 숙소 검색" value={q} onChange={event => setQ(event.target.value)} placeholder="숙소명·지역·편의시설 검색" className="flex-1 min-w-40 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                <a href="/admin/quote-desk/resources?resourceType=lodges" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline">숙소 등록·수정<span className="material-symbols-outlined text-sm">open_in_new</span></a>
            </div>
            {error && <div role="alert" className="m-4 mb-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"><p>{error}</p><button type="button" disabled={loading || !accountId} onClick={() => setRetry(value => value + 1)} className="mt-2 rounded border border-amber-300 bg-white px-3 py-1.5 font-semibold disabled:opacity-50">다시 불러오기</button></div>}
            <div className="flex-1 overflow-auto" aria-busy={loading}>
                {loading ? <div role="status" className="py-20 text-center text-sm text-slate-500">등록 숙소를 불러오는 중입니다…</div>
                    : !filtered.length ? !error && <div className="px-6 py-20 text-center text-sm text-slate-500"><p>{hotels.length ? '검색 조건에 맞는 숙소가 없습니다.' : '등록된 숙소가 없습니다. 숙소 등록·수정에서 먼저 추가해 주세요.'}</p>{q && <button type="button" onClick={() => setQ('')} className="mt-3 rounded border border-slate-200 px-3 py-1.5 text-xs">검색 초기화</button>}</div>
                    : <table className="w-full text-sm"><thead className="bg-slate-50 sticky top-0"><tr className="text-xs text-slate-500"><th className="text-left px-4 py-3 font-medium w-20">사진</th><th className="text-left px-4 py-3 font-medium">숙소·지역</th><th className="text-left px-4 py-3 font-medium">등급·편의시설</th><th className="text-right px-4 py-3 font-medium w-24">선택</th></tr></thead>
                        <tbody>{filtered.map(hotel => <tr key={hotel.id} className="border-t border-slate-100 hover:bg-teal-50/40">
                            <td className="px-4 py-3"><div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">{hotel.images?.[0] ? <img src={hotel.images[0]} alt={hotel.name_kr} loading="lazy" className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-slate-400">hotel</span>}</div></td>
                            <td className="px-4 py-3"><strong className="block font-semibold text-slate-900">{hotel.name_kr}</strong><span className="block mt-1 text-xs text-slate-500">{[hotel.region, hotel.address].filter(Boolean).join(' · ') || '지역·주소 미등록'}</span><small className="block mt-1 text-slate-400">선택 사진 {hotel.images?.length || 0}장</small></td>
                            <td className="px-4 py-3"><span className="text-xs font-medium text-teal-700">{hotel.grade || '등급 미등록'}</span><p className="mt-1 text-xs text-slate-500">{hotel.amenities?.join(' · ') || '편의시설 미등록'}</p></td>
                            <td className="px-4 py-3 text-right"><button type="button" disabled={!accountId || loading} onClick={() => onPick(hotel)} aria-label={`${hotel.name_kr} 선택`} className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">선택</button></td>
                        </tr>)}</tbody></table>}
            </div>
        </div>
    </div>;
};
