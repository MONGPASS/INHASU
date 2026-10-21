import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type { TouristSpot } from '../../types/touristSpot';
import { touristSpotRegionGroups, touristSpotRegionLabel } from '../../types/touristSpot';

interface TouristSpotPickerModalProps {
    open: boolean;
    onPick: (spot: TouristSpot) => void;
    onClose: () => void;
    title?: string;
}

/**
 * Reusable tourist spot picker. Same shape as HotelPickerModal but for the
 * tourist_spots master. Caller decides what to do with the returned spot —
 * typically push name_kr/description/images onto a timeline block.
 */
export const TouristSpotPickerModal: React.FC<TouristSpotPickerModalProps> = ({
    open,
    onPick,
    onClose,
    title = '여행지 관리에서 선택',
}) => {
    const [spots, setSpots] = useState<TouristSpot[]>([]);
    const [loading, setLoading] = useState(false);
    const [q, setQ] = useState('');
    const [region, setRegion] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        const controller = new AbortController();
        const load = async () => {
            setLoading(true);
            try {
                const data = await api.touristSpots.list({ active: true }, { signal: controller.signal, cache: 'no-store' });
                if (!cancelled) setSpots(Array.isArray(data) ? data : []);
            } catch (e) {
                if (cancelled) return;
                console.error('Tourist spot picker load failed:', e);
                if (!cancelled) setSpots([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        setQ('');
        setRegion(null);
        return () => { cancelled = true; controller.abort(); };
    }, [open]);

    const filtered = useMemo(() => {
        return spots.filter((s) => {
            if (region !== null && touristSpotRegionLabel(s.region) !== region) return false;
            if (q) {
                const needle = q.toLowerCase();
                const hay = `${s.name_kr} ${s.name_local || ''}`.toLowerCase();
                if (!hay.includes(needle)) return false;
            }
            return true;
        });
    }, [spots, q, region]);

    const regionTabs = useMemo(() => touristSpotRegionGroups(spots), [spots]);
    const regionLabel = touristSpotRegionLabel;

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[230] bg-black/50 flex items-center justify-center p-6"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            검색 후 행을 클릭하면 일정의 제목·설명·사진이 자동으로 채워집니다.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
                    >
                        <span className="material-symbols-outlined text-slate-500">close</span>
                    </button>
                </div>

                {/* Region tabs — same filter as the master page so admin
                    can quickly switch between 중앙몽골 / 고비사막 / 홉스굴 */}
                <div className="px-6 pt-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto">
                    {regionTabs.map((tab) => {
                        const count = tab.count;
                        const on = region === tab.value;
                        return (
                            <button
                                key={tab.value ?? '__all'}
                                type="button"
                                onClick={() => setRegion(tab.value)}
                                className={`shrink-0 px-3 pb-2.5 -mb-px text-sm font-medium border-b-2 transition-colors ${
                                    on
                                        ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                                {tab.label}
                                <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                    on ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <input
                        type="text"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="여행지명으로 검색"
                        autoFocus
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                </div>

                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="py-20 text-center text-slate-500">불러오는 중...</div>
                    ) : filtered.length === 0 ? (
                        <div className="py-20 text-center text-sm text-slate-500 dark:text-slate-400">
                            {spots.length === 0
                                ? '아직 등록된 여행지가 없습니다. 견적 관리 → "여행지 관리"에서 먼저 등록해주세요.'
                                : '조건에 맞는 여행지가 없습니다.'}
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                                <tr className="text-xs text-slate-500 dark:text-slate-400">
                                    <th className="text-left px-4 py-2.5 font-medium w-16">대표</th>
                                    <th className="text-left px-4 py-2.5 font-medium">여행지명</th>
                                    <th className="text-left px-4 py-2.5 font-medium">주소</th>
                                    <th className="text-center px-4 py-2.5 font-medium w-16">사진</th>
                                    <th className="text-right px-4 py-2.5 font-medium w-24">선택</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((s) => {
                                    const thumb = (s.images || []).find((url) => !!url);
                                    return (
                                        <tr
                                            key={s.id}
                                            onClick={() => onPick(s)}
                                            className="border-t border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-teal-50/40 dark:hover:bg-teal-900/20 transition-colors"
                                        >
                                            <td className="px-4 py-2">
                                                <div className="w-12 h-12 rounded overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                                                    {thumb ? (
                                                        <img src={thumb} alt={s.name_kr} loading="lazy" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="material-symbols-outlined text-slate-400 text-sm">image</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                                {regionLabel(s.region) && (
                                                    <span className="inline-block mr-2 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 align-middle">
                                                        {regionLabel(s.region)}
                                                    </span>
                                                )}
                                                {s.name_kr}
                                                {s.name_local && (
                                                    <span className="ml-2 text-xs font-normal text-slate-500">{s.name_local}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                                                {s.address || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center text-xs text-slate-500">
                                                {(s.images || []).length}장
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="inline-block px-3 py-1 rounded bg-teal-500 text-white text-xs font-bold">
                                                    선택
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
