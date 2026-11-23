import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type { Hotel } from '../../types/hotel';
// 부품 묶음(./ui)이 아니라 파일을 하나씩 가져온다 — 테스트의 가짜 React로도 묶이는 것만(아래 창 틀 주석)
import { AdminTable, AdminTbody, AdminTd, AdminTh, AdminThead, AdminTr } from './ui/AdminTable';
import { IconClose, IconHome, IconSearch } from './ui/AdminIcons';
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

    // 창 틀은 AdminDialog와 같은 클래스(adm-ui-dialog-*)를 직접 쓴다 — 이 파일은 tests/shared-travel-pickers.test.mjs가
    // 가짜 React로 묶어 돌리는데, AdminDialog·AdminSearch는 그 가짜 React에 없는 기능을 써서 가져올 수 없다.
    // 같은 이유로 줄(<tr onClick>)과 검색 칸은 생 요소에 부품과 같은 클래스를 단다.
    return (
        <div
            className="adm-ui-dialog-layer cim-picker-layer"
            onClick={onClose}
        >
            <div
                className="adm-ui-dialog is-lg cim-picker" role="dialog" aria-modal="true" aria-label={title}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="adm-ui-dialog-head">
                    <div className="adm-ui-dialog-titles">
                        <h2 className="adm-ui-dialog-title">{title}</h2>
                        <p className="adm-ui-dialog-desc">
                            가이드·숙소·차량에 등록한 숙소를 일정에 함께 사용합니다.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="adm-ui-icon-btn is-normal is-md"
                        aria-label="닫기"
                        title="닫기"
                    >
                        <IconClose />
                    </button>
                </header>

                <div className="adm-ui-dialog-body is-flush">
                    {/* Filter bar */}
                    <div className="cim-search">
                        <div className="adm-ui-search is-md is-wide">
                            <span className="adm-ui-search-icon" aria-hidden="true"><IconSearch /></span>
                            <input
                                type="text"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="숙소명으로 검색"
                                aria-label="숙소명으로 검색"
                                autoFocus
                                className="adm-ui-search-el"
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="cim-list">
                        {loading ? (
                            <div className="cim-empty" role="status">불러오는 중...</div>
                        ) : filtered.length === 0 ? (
                            <div className="cim-empty">
                                {hotels.length === 0
                                    ? '아직 등록된 숙소가 없습니다. 배정·자원 → "가이드·견적·숙소·차량"에서 숙소를 등록해주세요.'
                                    : '조건에 맞는 숙소가 없습니다.'}
                            </div>
                        ) : (
                            // 줄 전체를 눌러 고르는 표라 휴대폰에서도 카드로 바꾸지 않고 칸만 줄인다(CourseImportModal.css)
                            <AdminTable label={title} cardOff className="cim-table">
                                <AdminThead>
                                    <AdminTr>
                                        <AdminTh className="cim-col-thumb">대표</AdminTh>
                                        <AdminTh>숙소명</AdminTh>
                                        <AdminTh>주소</AdminTh>
                                        <AdminTh align="center" className="cim-col-num">사진</AdminTh>
                                        <AdminTh align="right" className="cim-col-act">선택</AdminTh>
                                    </AdminTr>
                                </AdminThead>
                                <AdminTbody>
                                    {filtered.map((h) => {
                                        const thumb = (h.images || []).find((url) => !!url);
                                        return (
                                            <tr
                                                key={h.id}
                                                onClick={() => onPick(h)}
                                                className="adm-ui-tr is-clickable cim-pickrow"
                                            >
                                                <AdminTd className="cim-col-thumb">
                                                    <div className="cim-thumb cim-thumb-box">
                                                        {thumb ? (
                                                            <img src={thumb} alt={h.name_kr} loading="lazy" />
                                                        ) : (
                                                            <IconHome />
                                                        )}
                                                    </div>
                                                </AdminTd>
                                                <AdminTd className="cim-col-name">
                                                    {h.name_kr}
                                                    {h.name_local && (
                                                        <span className="cim-note">{h.name_local}</span>
                                                    )}
                                                </AdminTd>
                                                <AdminTd className="cim-col-sub">
                                                    {h.address || '-'}
                                                </AdminTd>
                                                <AdminTd align="center" className="cim-col-num">
                                                    {(h.images || []).length}장
                                                </AdminTd>
                                                <AdminTd align="right" className="cim-col-act">
                                                    <span className="cim-pick">
                                                        선택
                                                    </span>
                                                </AdminTd>
                                            </tr>
                                        );
                                    })}
                                </AdminTbody>
                            </AdminTable>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
