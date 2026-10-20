import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useUser } from '../../contexts/UserContext';
import type { TouristSpot } from '../../types/touristSpot';
import { touristSpotRegionGroups, touristSpotRegionLabel } from '../../types/touristSpot';

interface TouristSpotPickerModalProps {
    open: boolean;
    onPick: (spot: TouristSpot) => void;
    onClose: () => void;
    title?: string;
}

interface LibraryState {
    accountId: string;
    items: TouristSpot[];
    loading: boolean;
    error: string;
}

/** Products, templates and customer itineraries select the same saved travel destinations. */
export const TouristSpotPickerModal: React.FC<TouristSpotPickerModalProps> = ({
    open, onPick, onClose, title = '여행지에서 선택',
}) => {
    const { user } = useUser();
    const accountId = user?.role === 'admin' ? user.id : '';
    const [library, setLibrary] = useState<LibraryState>({ accountId: '', items: [], loading: false, error: '' });
    const [retry, setRetry] = useState(0), [q, setQ] = useState('');
    const [region, setRegion] = useState<string | null>(null);
    const panel = useRef<HTMLDivElement>(null), search = useRef<HTMLInputElement>(null);
    const current = library.accountId === accountId ? library : { items: [], loading: Boolean(accountId), error: '' };
    const spots = current.items;

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        setLibrary({ accountId, items: [], loading: Boolean(accountId), error: '' });
        if (!accountId) {
            setLibrary({ accountId, items: [], loading: false, error: '관리자 계정으로 로그인한 뒤 여행지를 선택해 주세요.' });
            return () => controller.abort();
        }
        api.touristSpots.list({ active: true }, { signal: controller.signal, cache: 'no-store' })
            .then(data => {
                if (controller.signal.aborted) return;
                if (!Array.isArray(data) || data.some(item => !item || typeof item.id !== 'string' || typeof item.name_kr !== 'string')) {
                    throw new Error('Invalid travel destination library');
                }
                setLibrary({ accountId, items: data, loading: false, error: '' });
            })
            .catch(cause => {
                if (!controller.signal.aborted && cause?.name !== 'AbortError') {
                    setLibrary({ accountId, items: [], loading: false, error: '여행지를 불러오지 못했습니다. 다시 시도해 주세요.' });
                }
            });
        return () => controller.abort();
    }, [open, accountId, retry]);
    useEffect(() => { if (open) { setQ(''); setRegion(null); } }, [open, accountId]);
    useEffect(() => {
        if (!open) return;
        const previous = document.activeElement as HTMLElement | null;
        search.current?.focus();
        return () => { if (previous?.isConnected) previous.focus(); };
    }, [open]);

    const groups = useMemo(() => touristSpotRegionGroups(spots), [spots]);
    const filtered = useMemo(() => {
        const needle = q.trim().toLocaleLowerCase('ko-KR');
        return spots.filter(spot => (region === null || touristSpotRegionLabel(spot.region) === region)
            && (!needle || [spot.name_kr, spot.name_local, spot.address, touristSpotRegionLabel(spot.region)]
                .filter(Boolean).join(' ').toLocaleLowerCase('ko-KR').includes(needle)));
    }, [spots, q, region]);

    if (!open) return null;
    const closeOrTrap = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return; }
        if (event.key !== 'Tab') return;
        const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),[tabindex="0"]') || []);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };

    return <div className="fixed inset-0 z-[230] bg-black/50 flex items-center justify-center p-6" onClick={onClose} onKeyDown={closeOrTrap}>
        <div ref={panel} role="dialog" aria-modal="true" aria-label={title} className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden" onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">상품 일정표와 견적에서 함께 쓰는 여행지입니다. 선택하면 제목·설명·사진이 일정에 복사됩니다.</p>
                </div>
                <button type="button" onClick={onClose} aria-label="여행지 선택 닫기" className="w-9 h-9 shrink-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"><span className="material-symbols-outlined text-slate-500">close</span></button>
            </div>
            <div aria-label="여행지 지역·분류" className="px-6 pt-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto">
                {groups.map(group => <button key={group.value === null ? 'all-categories' : `category:${group.value}`} type="button" onClick={() => setRegion(group.value)} aria-pressed={region === group.value}
                    className={`shrink-0 px-3 pb-2.5 -mb-px text-sm font-medium border-b-2 transition-colors ${region === group.value ? 'border-teal-500 text-teal-600 dark:text-teal-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                    {group.label}<span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${region === group.value ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{group.count}</span>
                </button>)}
            </div>
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
                <input ref={search} type="search" value={q} onChange={event => setQ(event.target.value)} placeholder="여행지명·지역·주소 검색" aria-label="여행지 검색" className="flex-1 min-w-40 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                <a href="/admin/quote-desk/spots" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline">여행지 등록·수정<span className="material-symbols-outlined text-sm">open_in_new</span></a>
            </div>
            {current.error && <div role="alert" className="m-4 mb-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"><p>{current.error}</p><button type="button" disabled={current.loading || !accountId} onClick={() => setRetry(value => value + 1)} className="mt-2 rounded border border-amber-300 bg-white px-3 py-1.5 font-semibold disabled:opacity-50">다시 불러오기</button></div>}
            <div className="flex-1 overflow-auto" aria-busy={current.loading}>
                {current.loading ? <div role="status" className="py-20 text-center text-sm text-slate-500">여행지를 불러오는 중입니다…</div>
                    : filtered.length === 0 ? !current.error && <div className="py-20 px-6 text-center text-sm text-slate-500 dark:text-slate-400"><p>{spots.length ? '조건에 맞는 여행지가 없습니다.' : '등록된 여행지가 없습니다. 여행지 등록·수정에서 먼저 추가해 주세요.'}</p>{(q || region !== null) && <button type="button" onClick={() => { setQ(''); setRegion(null); }} className="mt-3 rounded border border-slate-200 px-3 py-1.5 text-xs">검색·분류 초기화</button>}</div>
                        : <table className="w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0"><tr className="text-xs text-slate-500 dark:text-slate-400">
                            <th className="text-left px-4 py-2.5 font-medium w-16">대표</th><th className="text-left px-4 py-2.5 font-medium">여행지명</th><th className="text-left px-4 py-2.5 font-medium">주소</th><th className="text-center px-4 py-2.5 font-medium w-16">사진</th><th className="text-right px-4 py-2.5 font-medium w-24">선택</th>
                        </tr></thead><tbody>{filtered.map(spot => {
                            const thumb = spot.images?.find(Boolean), category = touristSpotRegionLabel(spot.region);
                            return <tr key={spot.id} onClick={() => { if (accountId && !current.loading) onPick(spot); }} className="border-t border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-teal-50/40 dark:hover:bg-teal-900/20 transition-colors">
                                <td className="px-4 py-2"><div className="w-12 h-12 rounded overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">{thumb ? <img src={thumb} alt={spot.name_kr} loading="lazy" className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-slate-400 text-sm">image</span>}</div></td>
                                <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{category && <span className="inline-block mr-2 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 align-middle">{category}</span>}{spot.name_kr}{spot.name_local && <span className="ml-2 text-xs font-normal text-slate-500">{spot.name_local}</span>}</td>
                                <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{spot.address || '-'}</td><td className="px-4 py-3 text-center text-xs text-slate-500">{spot.images?.length || 0}장</td>
                                <td className="px-4 py-3 text-right"><button type="button" disabled={!accountId || current.loading} onClick={event => { event.stopPropagation(); onPick(spot); }} aria-label={`${spot.name_kr} 선택`} className="inline-block px-3 py-1 rounded bg-teal-500 text-white text-xs font-bold disabled:opacity-50">선택</button></td>
                            </tr>;
                        })}</tbody></table>}
            </div>
        </div>
    </div>;
};
