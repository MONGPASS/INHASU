import React, { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { api } from '../lib/api';
import { uploadImage } from '../utils/upload';
import type { SpotRegion, TouristSpot } from '../types/touristSpot';
import { SPOT_REGION_OPTIONS } from '../types/touristSpot';

const EMPTY_SPOT: TouristSpot = {
    id: '',
    name_kr: '',
    name_local: '',
    address: '',
    description: '',
    images: [],
    region: '',
    is_active: true,
};

type RegionFilter = 'all' | SpotRegion | 'uncat';

const REGION_FILTER_TABS: { value: RegionFilter; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'central', label: '중앙몽골' },
    { value: 'gobi', label: '고비사막' },
    { value: 'hovsgol', label: '홉스굴' },
    { value: 'ulaanbaatar', label: '울란바타르' },
    { value: 'experience', label: '체험' },
    { value: 'food', label: '음식' },
    { value: 'uncat', label: '미분류' },
];

const regionLabel = (r?: SpotRegion | null): string | null => {
    if (!r) return null;
    const found = SPOT_REGION_OPTIONS.find((o) => o.value === r);
    return found ? found.label : null;
};

/**
 * Admin page for the tourist spot master library.
 * Same shape as AdminHotelManage. Picking from a TIMELINE block's
 * "관광지에서 선택" button populates that block's title / description /
 * images automatically.
 */
export const AdminTouristSpotManage: React.FC = () => {
    const [spots, setSpots] = useState<TouristSpot[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [q, setQ] = useState('');
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
    const [filterRegion, setFilterRegion] = useState<RegionFilter>('all');

    const [editing, setEditing] = useState<TouristSpot | null>(null);
    const [isNew, setIsNew] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const data = await api.touristSpots.list({ active: false });
            setSpots(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('Tourist spot list load failed:', e);
            setSpots([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        return spots.filter((s) => {
            if (filterActive === 'active' && !s.is_active) return false;
            if (filterActive === 'inactive' && s.is_active) return false;
            if (filterRegion !== 'all') {
                const rowRegion = (s.region || '') as SpotRegion;
                if (filterRegion === 'uncat') {
                    if (rowRegion) return false;        // has a region → not "미분류"
                } else if (rowRegion !== filterRegion) {
                    return false;
                }
            }
            if (q) {
                const needle = q.toLowerCase();
                const hay = `${s.name_kr} ${s.name_local || ''}`.toLowerCase();
                if (!hay.includes(needle)) return false;
            }
            return true;
        });
    }, [spots, q, filterActive, filterRegion]);

    const startNew = () => {
        setEditing({ ...EMPTY_SPOT });
        setIsNew(true);
    };

    const startEdit = (s: TouristSpot) => {
        setEditing({ ...s });
        setIsNew(false);
    };

    const handleSave = async () => {
        if (!editing) return;
        if (!editing.name_kr.trim()) {
            alert('대제목은 필수입니다.');
            return;
        }
        setSaving(true);
        try {
            if (isNew) {
                await api.touristSpots.create(editing);
            } else {
                await api.touristSpots.update(editing.id, editing);
            }
            await load();
            setEditing(null);
            setIsNew(false);
        } catch (e: any) {
            alert('저장 실패: ' + (e?.message || '알 수 없는 오류'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!editing || isNew) return;
        if (!confirm(`"${editing.name_kr}" 관광지를 삭제하시겠습니까?\n\n이 관광지를 사용 중인 상품의 일정에는 영향이 없습니다(스냅샷으로 저장되어 있음).`)) return;
        try {
            await api.touristSpots.delete(editing.id);
            await load();
            setEditing(null);
        } catch (e: any) {
            alert('삭제 실패: ' + (e?.message || '알 수 없는 오류'));
        }
    };

    const handleAddImages = async (files: FileList | null) => {
        if (!files || !editing) return;
        try {
            const urls = await Promise.all(
                Array.from(files)
                    .filter((f) => f.type.startsWith('image/'))
                    .map((f) => uploadImage(f, 'tourist-spots'))
            );
            setEditing({ ...editing, images: [...(editing.images || []), ...urls] });
        } catch (e) {
            console.error(e);
            alert('이미지 업로드 실패');
        }
    };

    const removeImage = (idx: number) => {
        if (!editing) return;
        const next = (editing.images || []).filter((_, i) => i !== idx);
        setEditing({ ...editing, images: next });
    };

    const closeEditor = () => { setEditing(null); setIsNew(false); };

    return (
        <AdminLayout
            activePage="tourist-spots"
            title="관광지 마스터"
            actions={
                <button type="button" onClick={startNew} className="btn btn-ink">
                    <Icon name="add" />
                    관광지 추가
                </button>
            }
        >
            <div className="route-anim">
                {/* Toolbar: search + region select + 사용여부 select + add button */}
                <div className="toolbar">
                    <label className="tb-search">
                        <Icon name="search" />
                        <input
                            placeholder="관광지명, 지역 검색"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </label>
                    <select
                        className="select"
                        value={filterRegion}
                        onChange={(e) => setFilterRegion(e.target.value as RegionFilter)}
                    >
                        {REGION_FILTER_TABS.map((tab) => {
                            const count = tab.value === 'all'
                                ? spots.length
                                : tab.value === 'uncat'
                                    ? spots.filter((s) => !s.region).length
                                    : spots.filter((s) => s.region === tab.value).length;
                            return (
                                <option key={tab.value} value={tab.value}>
                                    {tab.label} ({count})
                                </option>
                            );
                        })}
                    </select>
                    <select
                        className="select"
                        value={filterActive}
                        onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
                    >
                        <option value="all">전체 상태</option>
                        <option value="active">사용중</option>
                        <option value="inactive">미사용</option>
                    </select>
                    <div className="cell-muted" style={{ fontSize: 13, fontWeight: 600 }}>
                        전체 {spots.length}개 중 <b className="cell-strong">{filtered.length}</b>개
                    </div>
                    <div className="spacer" />
                    <button type="button" onClick={startNew} className="btn btn-ink">
                        <Icon name="add" />
                        관광지 추가
                    </button>
                </div>

                {/* Card + table */}
                <div className="card">
                    <div className="tbl-wrap">
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th style={{ width: 80 }}>대표</th>
                                    <th>관광지명</th>
                                    <th>지역</th>
                                    <th>주소</th>
                                    <th className="c">사진</th>
                                    <th className="c">사용</th>
                                    <th className="r">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={7}>
                                            <div className="empty">
                                                <Icon name="hourglass_empty" />
                                                <p>불러오는 중...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={7}>
                                            <div className="empty">
                                                <Icon name="location_on" />
                                                <p>
                                                    {spots.length === 0
                                                        ? '아직 등록된 관광지가 없습니다. 우상단 "관광지 추가" 버튼으로 시작하세요.'
                                                        : '조건에 맞는 관광지가 없습니다.'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((s) => {
                                        const thumb = (s.images || []).find((url) => !!url);
                                        const photoCount = (s.images || []).length;
                                        return (
                                            <tr key={s.id} onClick={() => startEdit(s)}>
                                                <td>
                                                    {thumb ? (
                                                        <img
                                                            className="thumb sq"
                                                            src={thumb}
                                                            alt={s.name_kr}
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <span
                                                            className="thumb sq"
                                                            style={{ display: 'grid', placeItems: 'center', color: 'var(--mrt-gray-400)' }}
                                                        >
                                                            <Icon name="image" style={{ fontSize: 20 }} />
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className="cell-strong">{s.name_kr}</span>
                                                    {s.name_local && (
                                                        <span className="cell-muted" style={{ marginLeft: 8, fontSize: 12.5 }}>
                                                            {s.name_local}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    {regionLabel(s.region) ? (
                                                        <span className="badge b-blue">{regionLabel(s.region)}</span>
                                                    ) : (
                                                        <span className="cell-muted">미분류</span>
                                                    )}
                                                </td>
                                                <td className="cell-muted">{s.address || '-'}</td>
                                                <td className="c">
                                                    <span className="badge b-gray">
                                                        <Icon name="photo_library" />
                                                        {photoCount}
                                                    </span>
                                                </td>
                                                <td className="c">
                                                    <span className={`badge ${s.is_active ? 'b-green' : 'b-gray'}`}>
                                                        {s.is_active ? '사용중' : '미사용'}
                                                    </span>
                                                </td>
                                                <td className="r" onClick={(e) => e.stopPropagation()}>
                                                    <span className="row-actions">
                                                        <button
                                                            type="button"
                                                            className="act-btn"
                                                            title="수정"
                                                            onClick={() => startEdit(s)}
                                                        >
                                                            <Icon name="edit" />
                                                        </button>
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Editor modal */}
            {editing && (
                <div className="picker-scrim" onClick={closeEditor}>
                    <div
                        className="picker"
                        style={{ width: 560, maxHeight: '90vh' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="card-head">
                            <h2>{isNew ? '새 관광지 등록' : '관광지 정보 수정'}</h2>
                            <div className="spacer" />
                            <button type="button" onClick={closeEditor} className="act-btn" title="닫기">
                                <Icon name="close" />
                            </button>
                        </div>

                        <div className="picker-list" style={{ padding: '20px 22px' }}>
                            {/* 지역 분류 */}
                            <div className="field">
                                <label>지역 분류</label>
                                <div className="chip-row">
                                    {[{ v: '' as SpotRegion, l: '미분류' }, ...SPOT_REGION_OPTIONS.map((o) => ({ v: o.value, l: o.label }))].map((opt) => (
                                        <button
                                            key={opt.v || 'none'}
                                            type="button"
                                            onClick={() => setEditing({ ...editing, region: opt.v })}
                                            className={`chip${(editing.region || '') === opt.v ? ' active' : ''}`}
                                        >
                                            {opt.l}
                                        </button>
                                    ))}
                                </div>
                                <p className="cell-muted" style={{ fontSize: 12, marginTop: 7 }}>
                                    필터에서 이 분류로 빠르게 찾을 수 있습니다. (선택)
                                </p>
                            </div>

                            {/* 대제목 */}
                            <div className="field">
                                <label>대제목 *</label>
                                <input
                                    type="text"
                                    className="inp"
                                    value={editing.name_kr}
                                    onChange={(e) => setEditing({ ...editing, name_kr: e.target.value })}
                                    placeholder="차강소브라"
                                />
                                <p className="cell-muted" style={{ fontSize: 12, marginTop: 7 }}>
                                    일정 카드의 큰 제목으로 표시됩니다. (예: 차강소브라)
                                </p>
                            </div>

                            {/* 소제목 */}
                            <div className="field">
                                <label>소제목</label>
                                <input
                                    type="text"
                                    className="inp"
                                    value={editing.name_local || ''}
                                    onChange={(e) => setEditing({ ...editing, name_local: e.target.value })}
                                    placeholder="몽골의 그랜드캐년, 차강소브라"
                                />
                                <p className="cell-muted" style={{ fontSize: 12, marginTop: 7 }}>
                                    대제목 아래 작은 한 줄 설명. (예: 몽골의 그랜드캐년, 차강소브라)
                                </p>
                            </div>

                            {/* 주소 */}
                            <div className="field">
                                <label>주소</label>
                                <input
                                    type="text"
                                    className="inp"
                                    value={editing.address || ''}
                                    onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                                    placeholder="울란바토르 동북쪽 70km (선택)"
                                />
                            </div>

                            {/* 상세 설명 */}
                            <div className="field">
                                <label>상세 설명</label>
                                <textarea
                                    className="inp"
                                    value={editing.description || ''}
                                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                                    rows={5}
                                    placeholder="관광지 소개, 볼거리, 추천 사항 등..."
                                    style={{ minHeight: 120 }}
                                />
                                <p className="cell-muted" style={{ fontSize: 12, marginTop: 7 }}>
                                    이 내용이 일정 항목의 설명으로 자동 입력됩니다.
                                </p>
                            </div>

                            {/* 이미지 */}
                            <div className="field">
                                <label>이미지</label>
                                <div className="grid-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                    {(editing.images || []).map((src, i) => (
                                        <div
                                            key={i}
                                            style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--border-default)' }}
                                        >
                                            <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(i)}
                                                title="삭제"
                                                style={{ position: 'absolute', top: 4, right: 4, width: 26, height: 26, borderRadius: 8, border: 'none', background: 'rgba(255,79,79,0.92)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                                            >
                                                <Icon name="close" style={{ fontSize: 16 }} />
                                            </button>
                                            {i === 0 && (
                                                <span
                                                    className="badge b-ink"
                                                    style={{ position: 'absolute', bottom: 4, left: 4 }}
                                                >
                                                    대표
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                    <label
                                        className="block-img-empty"
                                        style={{ aspectRatio: '1 / 1', height: 'auto', cursor: 'pointer' }}
                                    >
                                        <Icon name="add_photo_alternate" />
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            style={{ display: 'none' }}
                                            onChange={(e) => {
                                                handleAddImages(e.target.files);
                                                e.target.value = '';
                                            }}
                                        />
                                    </label>
                                </div>
                                <p className="cell-muted" style={{ fontSize: 12, marginTop: 7 }}>
                                    이 사진들이 일정 항목의 사진으로 자동 첨부됩니다.
                                </p>
                            </div>

                            {/* 사용 여부 */}
                            <div className="toggle-row" style={{ marginBottom: 0 }}>
                                <button
                                    type="button"
                                    className={`switch${editing.is_active ? ' on' : ''}`}
                                    onClick={() => setEditing({ ...editing, is_active: !editing.is_active })}
                                >
                                    <span className="knob" />
                                </button>
                                <span className="cell-strong" style={{ fontSize: 13.5 }}>
                                    {editing.is_active ? '사용 (목록에 노출)' : '미사용 (숨김)'}
                                </span>
                            </div>
                        </div>

                        <div className="drawer-foot">
                            {!isNew && (
                                <button type="button" onClick={handleDelete} className="btn btn-danger">
                                    <Icon name="delete" />
                                    삭제
                                </button>
                            )}
                            <div className="spacer" style={{ flex: 1 }} />
                            <button type="button" onClick={closeEditor} className="btn btn-ghost">
                                닫기
                            </button>
                            <button type="button" onClick={handleSave} disabled={saving} className="btn btn-ink">
                                {saving ? '저장 중...' : '저장'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};
