import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { api } from '../lib/api';
import { uploadImage } from '../utils/upload';

interface Accommodation {
    id: string;
    name: string;
    images: string[];
    description: string;
    type: string; // Changed from union to string to support subtypes
    location: string;
    facilities: string[];
    createdAt: string;
}

export const AdminAccommodationManage: React.FC = () => {
    const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccommodation, setEditingAccommodation] = useState<Accommodation | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState<Omit<Accommodation, 'id' | 'createdAt'>>({
        name: '',
        images: [],
        description: '',
        type: '3성급 호텔',
        location: '',
        facilities: []
    });

    // Load accommodations from API
    useEffect(() => {
        const fetchAccommodations = async () => {
            try {
                const data = await api.accommodations.list();
                if (Array.isArray(data)) {
                    setAccommodations(data.map((a: any) => ({
                        id: a.id,
                        name: a.name,
                        images: typeof a.images === 'string' ? JSON.parse(a.images || '[]') : (a.images || []),
                        description: a.description,
                        type: a.type,
                        location: a.location,
                        facilities: typeof a.facilities === 'string' ? JSON.parse(a.facilities || '[]') : (a.facilities || []),
                        createdAt: a.created_at || a.createdAt
                    })));
                }
            } catch (error) {
                console.error('Error fetching accommodations:', error);
            }
        };
        fetchAccommodations();
    }, []);

    // Save accommodations via API
    const saveAccommodations = async (updated: Accommodation[]) => {
        try {
            const inserts = updated.map(a => ({
                id: a.id,
                name: a.name,
                images: a.images,
                description: a.description,
                type: a.type,
                location: a.location,
                facilities: a.facilities,
                created_at: a.createdAt
            }));
            await api.accommodations.save(inserts);
            setAccommodations(updated);
            return true;
        } catch (e) {
            console.error('Failed to save accommodations', e);
            alert('저장에 실패했습니다.');
            return false;
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            try {
                const uploadPromises = Array.from(files).map(file => uploadImage(file, 'accommodations'));
                const urls = await Promise.all(uploadPromises);
                setFormData({ ...formData, images: [...formData.images, ...urls] });
            } catch (error) {
                console.error('Accommodation image upload failed:', error);
                alert('이미지 업로드 실패');
            }
        }
    };

    const removeImage = (index: number) => {
        setFormData({
            ...formData,
            images: formData.images.filter((_, i) => i !== index)
        });
    };

    const handleFacilityToggle = (facility: string) => {
        const updated = formData.facilities.includes(facility)
            ? formData.facilities.filter(f => f !== facility)
            : [...formData.facilities, facility];
        setFormData({ ...formData, facilities: updated });
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.location) {
            alert('숙소명과 위치는 필수 입력 항목입니다.');
            return;
        }

        if (editingAccommodation) {
            // Update existing accommodation
            const updated = accommodations.map(a =>
                a.id === editingAccommodation.id ? { ...formData, id: a.id, createdAt: a.createdAt } : a
            );
            if (await saveAccommodations(updated)) {
                setIsModalOpen(false);
                resetForm();
            }
        } else {
            // Create new accommodation
            const newAccommodation: Accommodation = {
                ...formData,
                id: `ACCOM-${Date.now()}`,
                createdAt: new Date().toISOString()
            };
            if (await saveAccommodations([...accommodations, newAccommodation])) {
                setIsModalOpen(false);
                resetForm();
            }
        }
    };

    const handleEdit = (accommodation: Accommodation) => {
        setEditingAccommodation(accommodation);
        setFormData({
            name: accommodation.name,
            images: accommodation.images,
            description: accommodation.description,
            type: accommodation.type,
            location: accommodation.location,
            facilities: accommodation.facilities
        });
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            saveAccommodations(accommodations.filter(a => a.id !== id));
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            images: [],
            description: '',
            type: '3성급 호텔',
            location: '',
            facilities: []
        });
        setEditingAccommodation(null);
    };

    const filteredAccommodations = accommodations.filter(a =>
        a.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const availableFacilities = ['Wi-Fi', '조식 포함', '주차장', '에어컨', '난방', '온수', '세탁 서비스', '픽업 서비스'];

    const accommodationTypes = {
        '호텔': ['2성급 호텔', '3성급 호텔', '4성급 호텔', '5성급 호텔'],
        '게르': ['일반 게르', '고급 게르', '럭셔리 게르'],
        '게스트하우스': ['게스트하우스']
    };

    return (
        <AdminLayout
            activePage="hotels"
            title="숙소 관리"
            actions={
                <button
                    className="btn btn-ink"
                    onClick={() => {
                        resetForm();
                        setIsModalOpen(true);
                    }}
                >
                    <Icon name="add" />숙소 추가
                </button>
            }
        >
            <div className="route-anim">
                {/* Toolbar */}
                <div className="toolbar">
                    <label className="tb-search">
                        <Icon name="search" />
                        <input
                            placeholder="숙소명 검색"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </label>
                    <div className="spacer" />
                    <button
                        className="btn btn-ink"
                        onClick={() => {
                            resetForm();
                            setIsModalOpen(true);
                        }}
                    >
                        <Icon name="add" />숙소 추가
                    </button>
                </div>

                {/* Accommodation table */}
                <div className="card">
                    <div className="tbl-wrap">
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th style={{ width: 80 }}>대표</th>
                                    <th>숙소명</th>
                                    <th>타입</th>
                                    <th>위치</th>
                                    <th className="c">사진</th>
                                    <th className="r">관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAccommodations.map(accommodation => (
                                    <tr key={accommodation.id}>
                                        <td>
                                            {accommodation.images.length > 0 ? (
                                                <img
                                                    className="thumb sq"
                                                    src={accommodation.images[0]}
                                                    alt={accommodation.name}
                                                />
                                            ) : (
                                                <span
                                                    className="thumb sq"
                                                    style={{ display: 'grid', placeItems: 'center', color: 'var(--mrt-gray-400)' }}
                                                >
                                                    <Icon name="hotel" style={{ fontSize: 20 }} />
                                                </span>
                                            )}
                                        </td>
                                        <td className="cell-strong">{accommodation.name}</td>
                                        <td><span className="badge b-blue">{accommodation.type}</span></td>
                                        <td className="cell-muted">{accommodation.location}</td>
                                        <td className="c">
                                            <span className="badge b-gray">
                                                <Icon name="photo_library" />{accommodation.images.length}
                                            </span>
                                        </td>
                                        <td className="r">
                                            <span className="row-actions">
                                                <button
                                                    className="act-btn"
                                                    title="수정"
                                                    onClick={() => handleEdit(accommodation)}
                                                >
                                                    <Icon name="edit" />
                                                </button>
                                                <button
                                                    className="act-btn danger"
                                                    title="삭제"
                                                    onClick={() => handleDelete(accommodation.id)}
                                                >
                                                    <Icon name="delete" />
                                                </button>
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredAccommodations.length === 0 && (
                        <div className="empty">
                            <Icon name="hotel" />
                            <p>등록된 숙소가 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add / Edit modal */}
            {isModalOpen && (
                <div className="picker-scrim" onClick={() => { setIsModalOpen(false); resetForm(); }}>
                    <div
                        className="picker"
                        style={{ width: 640, maxHeight: '90vh' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="card-head">
                            <h2>{editingAccommodation ? '숙소 수정' : '숙소 등록'}</h2>
                            <div className="spacer" />
                            <button
                                className="act-btn"
                                title="닫기"
                                onClick={() => { setIsModalOpen(false); resetForm(); }}
                            >
                                <Icon name="close" />
                            </button>
                        </div>

                        <div className="card-pad" style={{ overflowY: 'auto' }}>
                            {/* Images Upload */}
                            <div className="field">
                                <label>숙소 이미지</label>
                                {formData.images.length > 0 && (
                                    <div className="grid-3" style={{ marginBottom: 12 }}>
                                        {formData.images.map((img, idx) => (
                                            <div key={idx} style={{ position: 'relative' }}>
                                                <img
                                                    src={img}
                                                    alt={`Preview ${idx + 1}`}
                                                    style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 'var(--r-md)' }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(idx)}
                                                    className="act-btn danger"
                                                    title="삭제"
                                                    style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, background: '#fff' }}
                                                >
                                                    <Icon name="close" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageUpload}
                                    style={{ fontSize: 13, color: 'var(--text-tertiary)' }}
                                />
                            </div>

                            {/* Name + Location */}
                            <div className="field-row">
                                <div className="field" style={{ marginBottom: 0 }}>
                                    <label>숙소명 *</label>
                                    <input
                                        type="text"
                                        className="inp"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="숙소 이름"
                                    />
                                </div>
                                <div className="field" style={{ marginBottom: 0 }}>
                                    <label>위치 *</label>
                                    <input
                                        type="text"
                                        className="inp"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        placeholder="예: 울란바토르 시내, 테를지 국립공원"
                                    />
                                </div>
                            </div>

                            {/* Type */}
                            <div className="field" style={{ marginTop: 18 }}>
                                <label>숙소 타입</label>
                                <div className="stack" style={{ gap: 12 }}>
                                    {Object.entries(accommodationTypes).map(([category, subtypes]) => (
                                        <div key={category}>
                                            <p className="cell-muted" style={{ fontSize: 12, fontWeight: 700, margin: '0 0 6px' }}>{category}</p>
                                            <div className="chip-row">
                                                {subtypes.map(subtype => (
                                                    <button
                                                        key={subtype}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, type: subtype })}
                                                        className={`chip ${formData.type === subtype ? 'active' : ''}`}
                                                    >
                                                        {subtype}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Facilities */}
                            <div className="field">
                                <label>편의시설</label>
                                <div className="chip-row">
                                    {availableFacilities.map(facility => (
                                        <button
                                            key={facility}
                                            type="button"
                                            onClick={() => handleFacilityToggle(facility)}
                                            className={`chip ${formData.facilities.includes(facility) ? 'active' : ''}`}
                                        >
                                            {facility}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Description */}
                            <div className="field" style={{ marginBottom: 0 }}>
                                <label>숙소 설명</label>
                                <textarea
                                    className="inp"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={4}
                                    placeholder="숙소에 대한 설명을 입력하세요"
                                />
                            </div>
                        </div>

                        <div className="drawer-foot">
                            <div className="spacer" style={{ flex: 1 }} />
                            <button
                                className="btn btn-ghost"
                                onClick={() => { setIsModalOpen(false); resetForm(); }}
                            >
                                취소
                            </button>
                            <button className="btn btn-ink" onClick={handleSubmit}>
                                {editingAccommodation ? '수정' : '등록'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};
