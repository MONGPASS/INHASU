import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type { TouristSpot } from '../../types/touristSpot';
import { touristSpotRegionGroups, touristSpotRegionLabel } from '../../types/touristSpot';
// 부품 묶음(./ui)이 아니라 파일을 하나씩 가져온다 — 테스트의 가짜 React로도 묶이는 것만(HotelPickerModal 창 틀 주석)
import { AdminTable, AdminTbody, AdminTd, AdminTh, AdminThead, AdminTr } from './ui/AdminTable';
import { IconClose, IconImage } from './ui/AdminIcons';
import { AdminSearch } from './ui/AdminFields';
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

    // 창 틀·지역 탭·줄은 생 요소에 부품과 같은 클래스(adm-ui-*)를 단다 — tests/shared-travel-pickers.test.mjs가
    // 가짜 React로 이 파일을 묶어 지역 탭 버튼과 onClick 달린 표 줄을 찾는다(HotelPickerModal 창 틀 주석). 검색 칸은 AdminSearch.
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
                            검색 후 행을 클릭하면 일정의 제목·설명·사진이 자동으로 채워집니다.
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
                    {/* Region tabs — same filter as the master page so admin
                        can quickly switch between 중앙몽골 / 고비사막 / 홉스굴 */}
                    <div className="adm-ui-tabs is-md cim-tabs">
                        <div className="adm-ui-tablist" role="tablist" aria-label="지역">
                            {regionTabs.map((tab) => {
                                const count = tab.count;
                                const on = region === tab.value;
                                return (
                                    <button
                                        key={tab.value ?? '__all'}
                                        type="button"
                                        className={on ? 'adm-ui-tab is-selected' : 'adm-ui-tab'}
                                        onClick={() => setRegion(tab.value)}
                                    >
                                        {tab.label}
                                        <span className="adm-ui-tab-count">
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="cim-search">
                        <AdminSearch wide value={q} onChange={setQ} placeholder="여행지명으로 검색" aria-label="여행지명으로 검색" autoFocus />
                    </div>

                    <div className="cim-list">
                        {loading ? (
                            <div className="cim-empty" role="status">불러오는 중...</div>
                        ) : filtered.length === 0 ? (
                            <div className="cim-empty">
                                {spots.length === 0
                                    ? '아직 등록된 여행지가 없습니다. 견적 관리 → "여행지 관리"에서 먼저 등록해주세요.'
                                    : '조건에 맞는 여행지가 없습니다.'}
                            </div>
                        ) : (
                            // 줄 전체를 눌러 고르는 표라 휴대폰에서도 카드로 바꾸지 않고 칸만 줄인다(CourseImportModal.css)
                            <AdminTable label={title} cardOff className="cim-table">
                                <AdminThead>
                                    <AdminTr>
                                        <AdminTh className="cim-col-thumb">대표</AdminTh>
                                        <AdminTh>여행지명</AdminTh>
                                        <AdminTh>주소</AdminTh>
                                        <AdminTh align="center" className="cim-col-num">사진</AdminTh>
                                        <AdminTh align="right" className="cim-col-act">선택</AdminTh>
                                    </AdminTr>
                                </AdminThead>
                                <AdminTbody>
                                    {filtered.map((s) => {
                                        const thumb = (s.images || []).find((url) => !!url);
                                        return (
                                            <tr
                                                key={s.id}
                                                onClick={() => onPick(s)}
                                                className="adm-ui-tr is-clickable cim-pickrow"
                                            >
                                                <AdminTd className="cim-col-thumb">
                                                    <div className="cim-thumb cim-thumb-box">
                                                        {thumb ? (
                                                            <img src={thumb} alt={s.name_kr} loading="lazy" />
                                                        ) : (
                                                            <IconImage />
                                                        )}
                                                    </div>
                                                </AdminTd>
                                                <AdminTd className="cim-col-name">
                                                    {regionLabel(s.region) && (
                                                        <span className="cim-tag">
                                                            {regionLabel(s.region)}
                                                        </span>
                                                    )}
                                                    {s.name_kr}
                                                    {s.name_local && (
                                                        <span className="cim-note">{s.name_local}</span>
                                                    )}
                                                </AdminTd>
                                                <AdminTd className="cim-col-sub">
                                                    {s.address || '-'}
                                                </AdminTd>
                                                <AdminTd align="center" className="cim-col-num">
                                                    {(s.images || []).length}장
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
