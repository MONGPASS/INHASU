import React, { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { api } from '../lib/api';
import { uploadImage } from '../utils/upload';
import type { Hotel } from '../types/hotel';

const EMPTY_HOTEL: Hotel = {
    id: '',
    code: '',
    name_kr: '',
    name_local: '',
    country: '',
    city: '',
    region: '',
    star_rating: 0,
    address: '',
    latitude: null,
    longitude: null,
    description: '',
    website: '',
    images: [],
    amenities: [],
    is_active: true,
};

/**
 * Admin page for the hotel master library.
 * Toolbar + master table (대표 / 호텔명 / 주소 / 사진 / 사용 / 관리).
 * The editor (add/edit) opens in a modal. The "가져오기" button in the
 * itinerary editor opens a similar list as a modal elsewhere.
 */
export const AdminHotelManage: React.FC = () => {
    const [hotels, setHotels] = useState<Hotel[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Filters
    const [q, setQ] = useState('');
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

    // Editor (modal)
    const [editing, setEditing] = useState<Hotel | null>(null);
    const [isNew, setIsNew] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const data = await api.hotels.list({ active: false }); // include inactive in admin
            setHotels(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('Hotel list load failed:', e);
            setHotels([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const filtered = useMemo(() => {
        return hotels.filter((h) => {
            if (filterActive === 'active' && !h.is_active) return false;
            if (filterActive === 'inactive' && h.is_active) return false;
            if (q) {
                const needle = q.toLowerCase();
                const hay = `${h.name_kr} ${h.name_local || ''} ${h.address || ''}`.toLowerCase();
                if (!hay.includes(needle)) return false;
            }
            return true;
        });
    }, [hotels, q, filterActive]);

    const startNew = () => {
        setEditing({ ...EMPTY_HOTEL });
        setIsNew(true);
    };

    const startEdit = (h: Hotel) => {
        setEditing({ ...h });
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
                await api.hotels.create(editing);
            } else {
                await api.hotels.update(editing.id, editing);
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
        if (!confirm(`"${editing.name_kr}" 호텔을 삭제하시겠습니까?\n\n이 호텔을 사용 중인 상품의 일정에는 영향이 없습니다(스냅샷으로 저장되어 있음).`)) return;
        try {
            await api.hotels.delete(editing.id);
            await load();
            setEditing(null);
        } catch (e: any) {
            alert('삭제 실패: ' + (e?.message || '알 수 없는 오류'));
        }
    };

    // Delete directly from the table row.
    const deleteRow = async (h: Hotel) => {
        if (!confirm(`"${h.name_kr}" 호텔을 삭제하시겠습니까?\n\n이 호텔을 사용 중인 상품의 일정에는 영향이 없습니다(스냅샷으로 저장되어 있음).`)) return;
        try {
            await api.hotels.delete(h.id);
            await load();
        } catch (e: any) {
            alert('삭제 실패: ' + (e?.message || '알 수 없는 오류'));
        }
    };

    // Inline toggle of the 사용 (active) flag from the table.
    const toggleActive = async (h: Hotel) => {
        try {
            await api.hotels.update(h.id, { ...h, is_active: !h.is_active });
            await load();
        } catch (e: any) {
            alert('업데이트 실패: ' + (e?.message || '알 수 없는 오류'));
        }
    };

    const handleAddImages = async (files: FileList | null) => {
        if (!files || !editing) return;
        try {
            const urls = await Promise.all(
                Array.from(files)
                    .filter((f) => f.type.startsWith('image/'))
                    .map((f) => uploadImage(f, 'hotels'))
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

    return (
        <AdminLayout
            activePage="hotels"
            title="호텔 마스터"
            actions={
                <button type="button" onClick={startNew} className="btn btn-ink">
                    <Icon name="add" />
                    호텔 추가
                </button>
            }
        >
            <div className="route-anim">
                <div className="toolbar">
                    <label className="tb-search">
                        <Icon name="search" />
                        <input
                            placeholder="호텔명, 주소 검색"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </label>
                    <select
                        className="select"
                        value={filterActive}
                        onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
                    >
                        <option value="all">전체 사용여부</option>
                        <option value="active">사용중</option>
                        <option value="inactive">미사용</option>
                    </select>
                    <div className="spacer" />
                    <span className="cell-muted" style={{ fontSize: 13 }}>
                        전체 {hotels.length}개 중 <b style={{ color: 'var(--text-strong)' }}>{filtered.length}</b>개 표시
                    </span>
                    <button type="button" onClick={startNew} className="btn btn-ink">
                        <Icon name="add" />
                        호텔 추가
                    </button>
                </div>

                <div className="card">
                    <div className="tbl-wrap">
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th style={{ width: 80 }}>대표</th>
                                    <th>호텔명</th>
                                    <th>주소</th>
                                    <th className="c">사진</th>
                                    <th className="c">사용</th>
                                    <th className="r">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6}>
                                            <div className="empty">
                                                <Icon name="hotel" />
                                                <p>불러오는 중...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={6}>
                                            <div className="empty">
                                                <Icon name="hotel" />
                                                <p>
                                                    {hotels.length === 0
                                                        ? '아직 등록된 호텔이 없습니다. 우상단 "호텔 추가" 버튼으로 시작하세요.'
                                                        : '조건에 맞는 호텔이 없습니다.'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((h) => {
                                        const thumb = (h.images || []).find((url) => !!url);
                                        return (
                                            <tr key={h.id} onClick={() => startEdit(h)}>
                                                <td>
                                                    {thumb ? (
                                                        <img className="thumb sq" src={thumb} alt={h.name_kr} loading="lazy" />
                                                    ) : (
                                                        <span
                                                            className="thumb sq"
                                                            style={{ display: 'grid', placeItems: 'center', color: 'var(--mrt-gray-400)' }}
                                                        >
                                                            <Icon name="image" style={{ fontSize: 20 }} />
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="cell-strong">
                                                    {h.name_kr}
                                                    {h.name_local && (
                                                        <span className="cell-muted" style={{ marginLeft: 8, fontWeight: 400 }}>
                                                            {h.name_local}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="cell-muted">{h.address || '-'}</td>
                                                <td className="c">
                                                    <span className="badge b-gray">
                                                        <Icon name="photo_library" />
                                                        {(h.images || []).length}
                                                    </span>
                                                </td>
                                                <td className="c">
                                                    <button
                                                        type="button"
                                                        className={`switch${h.is_active ? ' on' : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleActive(h);
                                                        }}
                                                    >
                                                        <span className="knob" />
                                                    </button>
                                                </td>
                                                <td className="r">
                                                    <span className="row-actions">
                                                        <button
                                                            type="button"
                                                            className="act-btn"
                                                            title="수정"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                startEdit(h);
                                                            }}
                                                        >
                                                            <Icon name="edit" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="act-btn danger"
                                                            title="삭제"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteRow(h);
                                                            }}
                                                        >
                                                            <Icon name="delete" />
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

            {/* ─── Add / Edit modal ─── */}
            {editing && (
                <div
                    className="picker-scrim"
                    onClick={() => {
                        setEditing(null);
                        setIsNew(false);
                    }}
                >
                    <div
                        className="picker"
                        style={{ width: 560, maxHeight: '90vh' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="card-head">
                            <h2>{isNew ? '새 호텔 등록' : '호텔 정보 수정'}</h2>
                            <div className="spacer" />
                            <button
                                type="button"
                                onClick={() => {
                                    setEditing(null);
                                    setIsNew(false);
                                }}
                                className="act-btn"
                                title="닫기"
                            >
                                <Icon name="close" />
                            </button>
                        </div>

                        <div style={{ overflowY: 'auto', padding: '20px 22px' }}>
                            <Field label="대제목" required hint="일정 카드의 큰 제목으로 표시됩니다. (예: 마리나베이샌즈호텔)">
                                <input
                                    type="text"
                                    className="inp"
                                    value={editing.name_kr}
                                    onChange={(e) => setEditing({ ...editing, name_kr: e.target.value })}
                                    placeholder="마리나베이샌즈호텔"
                                />
                            </Field>

                            <Field label="소제목" hint="대제목 아래 작은 한 줄 설명. (예: 5성급, 시내 중심·뷰 추천)">
                                <input
                                    type="text"
                                    className="inp"
                                    value={editing.name_local || ''}
                                    onChange={(e) => setEditing({ ...editing, name_local: e.target.value })}
                                    placeholder="5성급, 시내 중심·뷰 추천"
                                />
                            </Field>

                            <Field label="주소">
                                <input
                                    type="text"
                                    className="inp"
                                    value={editing.address || ''}
                                    onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                                    placeholder="10 Bayfront Ave, Singapore 018956"
                                />
                            </Field>

                            <Field label="상세 설명">
                                <textarea
                                    className="inp"
                                    value={editing.description || ''}
                                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                                    rows={4}
                                    placeholder="호텔 소개, 특징, 위치적 장점 등..."
                                    style={{ minHeight: 100 }}
                                />
                            </Field>

                            <Field label="편의시설 (쉼표로 구분)">
                                <input
                                    type="text"
                                    className="inp"
                                    value={(editing.amenities || []).join(', ')}
                                    onChange={(e) =>
                                        setEditing({
                                            ...editing,
                                            amenities: e.target.value
                                                .split(',')
                                                .map((s) => s.trim())
                                                .filter(Boolean),
                                        })
                                    }
                                    placeholder="수영장, 사우나, 무료 Wi-Fi, 조식 포함"
                                />
                            </Field>

                            <Field label="이미지" hint="첫 번째 이미지가 일정 화면에 표시되는 대표 이미지입니다.">
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                    {(editing.images || []).map((src, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                position: 'relative',
                                                aspectRatio: '1 / 1',
                                                borderRadius: 'var(--r-md)',
                                                overflow: 'hidden',
                                                border: '1px solid var(--border-default)',
                                            }}
                                        >
                                            <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(i)}
                                                title="삭제"
                                                style={{
                                                    position: 'absolute',
                                                    top: 4,
                                                    right: 4,
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: '50%',
                                                    border: 'none',
                                                    background: 'rgba(255,79,79,0.9)',
                                                    color: '#fff',
                                                    cursor: 'pointer',
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                }}
                                            >
                                                <Icon name="close" style={{ fontSize: 16 }} />
                                            </button>
                                            {i === 0 && (
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        bottom: 4,
                                                        left: 4,
                                                        padding: '1px 7px',
                                                        borderRadius: 6,
                                                        background: 'var(--mrt-ink)',
                                                        color: '#fff',
                                                        fontSize: 10,
                                                        fontWeight: 800,
                                                    }}
                                                >
                                                    대표
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    <label
                                        style={{
                                            aspectRatio: '1 / 1',
                                            border: '1.5px dashed var(--border-strong)',
                                            borderRadius: 'var(--r-md)',
                                            display: 'grid',
                                            placeItems: 'center',
                                            cursor: 'pointer',
                                            color: 'var(--mrt-gray-400)',
                                        }}
                                    >
                                        <Icon name="add_photo_alternate" />
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={(e) => {
                                                handleAddImages(e.target.files);
                                                e.target.value = '';
                                            }}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                </div>
                            </Field>

                            <Field label="사용 여부">
                                <div className="toggle-row">
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
                            </Field>
                        </div>

                        <div className="drawer-foot">
                            {!isNew && (
                                <button type="button" onClick={handleDelete} className="btn btn-danger">
                                    <Icon name="delete" />
                                    삭제
                                </button>
                            )}
                            <div className="spacer" style={{ flex: 1 }} />
                            <button
                                type="button"
                                onClick={() => {
                                    setEditing(null);
                                    setIsNew(false);
                                }}
                                className="btn btn-ghost"
                            >
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

const Field: React.FC<{ label: string; required?: boolean; hint?: string; children: React.ReactNode }> = ({
    label,
    required,
    hint,
    children,
}) => (
    <div className="field">
        <label>
            {label} {required && <span style={{ color: 'var(--mrt-red)' }}>*</span>}
        </label>
        {children}
        {hint && (
            <p className="cell-muted" style={{ fontSize: 12, marginTop: 6 }}>
                {hint}
            </p>
        )}
    </div>
);
