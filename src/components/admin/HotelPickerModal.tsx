import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type { Hotel } from '../../types/hotel';
import './CourseImportModal.css';

interface HotelPickerModalProps {
    /** Whether the modal is open. */
    open: boolean;
    /** Called with the selected hotel; consumer decides what to store. */
    onPick: (hotel: Hotel) => void;
    /** Close without picking. */
    onClose: () => void;
    /** Optional title override (default: "등록 숙소에서 선택"). */
    title?: string;
}

/**
 * Reusable hotel picker. Opens over the admin product editor (or anywhere
 * else that wants to attach a hotel) and lets the admin search the master
 * library. Returns the full Hotel object so callers can snapshot whatever
 * fields they want.
 */
export const HotelPickerModal: React.FC<HotelPickerModalProps> = ({
    open,
    onPick,
    onClose,
    title = '등록 숙소에서 선택',
}) => {
    const [hotels, setHotels] = useState<Hotel[]>([]);
    const [loading, setLoading] = useState(false);
    const [q, setQ] = useState('');

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        const controller = new AbortController();
        const load = async () => {
            setLoading(true);
            try {
                const data = await api.hotels.list({ source: 'resources', active: true }, { signal: controller.signal, cache: 'no-store' });
                if (!cancelled) setHotels(Array.isArray(data) ? data : []);
            } catch (e) {
                if (cancelled) return;
                console.error('Hotel picker load failed:', e);
                if (!cancelled) setHotels([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        setQ('');
        return () => { cancelled = true; controller.abort(); };
    }, [open]);

    const filtered = useMemo(() => {
        return hotels.filter((h) => {
            if (q) {
                const needle = q.toLowerCase();
                const hay = `${h.name_kr} ${h.name_local || ''}`.toLowerCase();
                if (!hay.includes(needle)) return false;
            }
            return true;
        });
    }, [hotels, q]);

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
                {/* Header */}
                <div className="ci-head">
                    <div className="ci-head-text">
                        <h2>{title}</h2>
                        <p>
                            가이드·숙소·차량에 등록한 숙소를 일정에 함께 사용합니다.
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

                {/* Filter bar */}
                <div className="ci-search">
                    <input
                        type="text"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="숙소명으로 검색"
                        autoFocus
                        className="ci-input"
                    />
                </div>

                {/* List */}
                <div className="ci-list">
                    {loading ? (
                        <div className="ci-empty" role="status">불러오는 중...</div>
                    ) : filtered.length === 0 ? (
                        <div className="ci-empty">
                            {hotels.length === 0
                                ? '아직 등록된 숙소가 없습니다. 배정·자원 → "가이드·견적·숙소·차량"에서 숙소를 등록해주세요.'
                                : '조건에 맞는 숙소가 없습니다.'}
                        </div>
                    ) : (
                        <table className="ci-table">
                            <thead>
                                <tr>
                                    <th className="ci-col-thumb">대표</th>
                                    <th>숙소명</th>
                                    <th>주소</th>
                                    <th className="ci-col-num">사진</th>
                                    <th className="ci-col-act">선택</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((h) => {
                                    const thumb = (h.images || []).find((url) => !!url);
                                    return (
                                        <tr
                                            key={h.id}
                                            onClick={() => onPick(h)}
                                            className="ci-pickrow"
                                        >
                                            <td className="ci-col-thumb">
                                                <div className="ci-thumb ci-thumb-box">
                                                    {thumb ? (
                                                        <img src={thumb} alt={h.name_kr} loading="lazy" />
                                                    ) : (
                                                        <span className="material-symbols-outlined">hotel</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="ci-col-name">
                                                {h.name_kr}
                                                {h.name_local && (
                                                    <span className="ci-note">{h.name_local}</span>
                                                )}
                                            </td>
                                            <td className="ci-col-sub">
                                                {h.address || '-'}
                                            </td>
                                            <td className="ci-col-num">
                                                {(h.images || []).length}장
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
