import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type { TouristSpot } from '../../types/touristSpot';
import { touristSpotRegionGroups, touristSpotRegionLabel } from '../../types/touristSpot';
import './CourseImportModal.css';

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
            className="ci-scrim is-top"
            onClick={onClose}
        >
            <div
                className="ci-modal is-wide" role="dialog" aria-modal="true" aria-label={title}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="ci-head">
                    <div className="ci-head-text">
                        <h2>{title}</h2>
                        <p>
                            검색 후 행을 클릭하면 일정의 제목·설명·사진이 자동으로 채워집니다.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="ci-close"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Region tabs — same filter as the master page so admin
                    can quickly switch between 중앙몽골 / 고비사막 / 홉스굴 */}
                <div className="ci-tabs" role="tablist" aria-label="지역">
                    {regionTabs.map((tab) => {
                        const count = tab.count;
                        const on = region === tab.value;
                        return (
                            <button
                                key={tab.value ?? '__all'}
                                type="button"
                                onClick={() => setRegion(tab.value)}
                                className={on ? 'is-on' : undefined}
                            >
                                {tab.label}
                                <span>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="ci-search">
                    <input
                        type="text"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="여행지명으로 검색"
                        autoFocus
                        className="ci-input"
                    />
                </div>

                <div className="ci-list">
                    {loading ? (
                        <div className="ci-empty" role="status">불러오는 중...</div>
                    ) : filtered.length === 0 ? (
                        <div className="ci-empty">
                            {spots.length === 0
                                ? '아직 등록된 여행지가 없습니다. 견적 관리 → "여행지 관리"에서 먼저 등록해주세요.'
                                : '조건에 맞는 여행지가 없습니다.'}
                        </div>
                    ) : (
                        <table className="ci-table">
                            <thead>
                                <tr>
                                    <th className="ci-col-thumb">대표</th>
                                    <th>여행지명</th>
                                    <th>주소</th>
                                    <th className="ci-col-num">사진</th>
                                    <th className="ci-col-act">선택</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((s) => {
                                    const thumb = (s.images || []).find((url) => !!url);
                                    return (
                                        <tr
                                            key={s.id}
                                            onClick={() => onPick(s)}
                                            className="ci-pickrow"
                                        >
                                            <td className="ci-col-thumb">
                                                <div className="ci-thumb ci-thumb-box">
                                                    {thumb ? (
                                                        <img src={thumb} alt={s.name_kr} loading="lazy" />
                                                    ) : (
                                                        <span className="material-symbols-outlined">image</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="ci-col-name">
                                                {regionLabel(s.region) && (
                                                    <span className="ci-tag">
                                                        {regionLabel(s.region)}
                                                    </span>
                                                )}
                                                {s.name_kr}
                                                {s.name_local && (
                                                    <span className="ci-note">{s.name_local}</span>
                                                )}
                                            </td>
                                            <td className="ci-col-sub">
                                                {s.address || '-'}
                                            </td>
                                            <td className="ci-col-num">
                                                {(s.images || []).length}장
                                            </td>
                                            <td className="ci-col-act">
                                                <span className="ci-pick">
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
