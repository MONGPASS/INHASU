import React, { useState, useEffect } from 'react';
import {
    AdminBadge, AdminButton, AdminChip, AdminDataTable, AdminDialog, AdminEmpty, AdminField, AdminFileButton, AdminIconButton, AdminSearch, AdminTextArea, AdminTextInput,
    IconClose, IconHotel, IconImages, IconPencil, IconPlus, IconTrash, IconUpload, type AdminColumn,
} from '../components/admin/ui';
import { AdminFilterBar, ListPage } from '../components/admin/ui/AdminPage';
import { api } from '../lib/api';
import { uploadImage } from '../utils/upload';
import { adminConfirm, adminNotify } from '../components/admin/ui/adminFeedback';
import { adminValidateRequired } from '../components/admin/ui/adminForm';
import './AdminGuideManage.css';

/**
 * 상품용 숙소(`/admin/accommodations`) — 상품 상세의 숙소 소개에 쓰는 숙소 목록(`/api/accommodations`, 목록 전체를 한 번에 저장).
 * 견적·배정의 숙소 등록 정보(`/admin/quote-desk/resources`)와는 다른 자료다. 우리 관리자 부품(당근 Seed)으로 그린다.
 */
interface Accommodation {
    id: string;
    name: string;
    images: string[];
    description: string;
    type: string;
    location: string;
    facilities: string[];
    createdAt: string;
}

type AccommodationForm = Omit<Accommodation, 'id' | 'createdAt'>;
const EMPTY_FORM: AccommodationForm = { name: '', images: [], description: '', type: '3성급 호텔', location: '', facilities: [] };
const AVAILABLE_FACILITIES = ['Wi-Fi', '조식 포함', '주차장', '에어컨', '난방', '온수', '세탁 서비스', '픽업 서비스'];
const ACCOMMODATION_TYPES: Record<string, string[]> = {
    '호텔': ['2성급 호텔', '3성급 호텔', '4성급 호텔', '5성급 호텔'],
    '게르': ['일반 게르', '고급 게르', '럭셔리 게르'],
    '게스트하우스': ['게스트하우스'],
};

export const AdminAccommodationManage: React.FC = () => {
    const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccommodation, setEditingAccommodation] = useState<Accommodation | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState<AccommodationForm>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

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

    // 목록 전체를 한 번에 저장한다(옛 화면과 같은 API)
    const saveAccommodations = async (updated: Accommodation[]) => {
        try {
            await api.accommodations.save(updated.map(a => ({
                id: a.id, name: a.name, images: a.images, description: a.description, type: a.type, location: a.location, facilities: a.facilities, created_at: a.createdAt,
            })));
            setAccommodations(updated);
            return true;
        } catch (e) {
            console.error('Failed to save accommodations', e);
            adminNotify('저장에 실패했습니다.');
            return false;
        }
    };

    const handleImageUpload = async (files: File[]) => {
        if (!files.length) return;
        setUploading(true);
        try {
            const urls = await Promise.all(files.map(file => uploadImage(file, 'accommodations')));
            setFormData(f => ({ ...f, images: [...f.images, ...urls] }));
        } catch (error) {
            console.error('Accommodation image upload failed:', error);
            adminNotify('이미지 업로드 실패');
        } finally {
            setUploading(false);
        }
    };

    const toggleFacility = (facility: string) => setFormData(f => ({
        ...f, facilities: f.facilities.includes(facility) ? f.facilities.filter(x => x !== facility) : [...f.facilities, facility],
    }));

    const handleSubmit = async () => {
        if (!adminValidateRequired() || !formData.name || !formData.location) return;
        setSaving(true);
        try {
            const updated = editingAccommodation
                ? accommodations.map(a => a.id === editingAccommodation.id ? { ...formData, id: a.id, createdAt: a.createdAt } : a)
                : [...accommodations, { ...formData, id: `ACCOM-${Date.now()}`, createdAt: new Date().toISOString() }];
            if (await saveAccommodations(updated)) closeModal();
        } finally {
            setSaving(false);
        }
    };

    const openNew = () => { setEditingAccommodation(null); setFormData(EMPTY_FORM); setIsModalOpen(true); };
    const handleEdit = (accommodation: Accommodation) => {
        setEditingAccommodation(accommodation);
        setFormData({ name: accommodation.name, images: accommodation.images, description: accommodation.description, type: accommodation.type, location: accommodation.location, facilities: accommodation.facilities });
        setIsModalOpen(true);
    };
    const closeModal = () => { setIsModalOpen(false); setEditingAccommodation(null); setFormData(EMPTY_FORM); };

    const handleDelete = async (id: string) => {
        if (await adminConfirm('정말 삭제하시겠습니까?')) void saveAccommodations(accommodations.filter(a => a.id !== id));
    };

    const filteredAccommodations = accommodations.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const columns: AdminColumn<Accommodation>[] = [
        { key: 'photo', header: '대표', render: a => <span className="ag-thumb">{a.images.length > 0 ? <img src={a.images[0]} alt={a.name} /> : <IconHotel aria-hidden="true" />}</span> },
        { key: 'name', header: '숙소명', render: a => <b className="ag-strong">{a.name}</b> },
        { key: 'type', header: '타입', nowrap: true, render: a => <AdminBadge tone="info">{a.type}</AdminBadge> },
        { key: 'location', header: '위치', render: a => <span className="ag-muted">{a.location}</span> },
        { key: 'count', header: '사진', align: 'center', nowrap: true, render: a => <AdminBadge icon={<IconImages />}>{a.images.length}</AdminBadge> },
        { key: 'manage', header: '관리', align: 'right', nowrap: true, render: a => (
            <span className="ag-row-actions">
                <AdminIconButton size="sm" label="수정" onClick={() => handleEdit(a)}><IconPencil /></AdminIconButton>
                <AdminIconButton size="sm" label="삭제" onClick={() => void handleDelete(a.id)}><IconTrash /></AdminIconButton>
            </span>
        ) },
    ];

    return (
        <ListPage
            activePage="hotels"
            title="숙소 관리"
            actions={<AdminButton variant="primary" leading={<IconPlus />} onClick={openNew}>숙소 추가</AdminButton>}
            filters={<AdminFilterBar search={<AdminSearch value={searchTerm} onChange={setSearchTerm} placeholder="숙소명 검색" aria-label="숙소 검색" />} />}
        >
            <AdminDataTable label="숙소 목록" columns={columns} rows={filteredAccommodations} rowKey={a => a.id}
                empty={<AdminEmpty title="등록된 숙소가 없습니다" />} />

            <AdminDialog open={isModalOpen} onClose={closeModal} title={editingAccommodation ? '숙소 수정' : '숙소 등록'}
                onSubmit={() => void handleSubmit()} submitLabel={editingAccommodation ? '수정' : '등록'} submitting={saving} submitDisabled={uploading}>
                <AdminField label="숙소 이미지">
                    <span className="ag-images">
                        {formData.images.map((img, idx) => (
                            <span key={idx} className="ag-image">
                                <img src={img} alt={`사진 ${idx + 1}`} />
                                <AdminIconButton size="sm" variant="background" className="ag-image-off" label={`사진 ${idx + 1} 빼기`}
                                    onClick={() => setFormData(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))}><IconClose /></AdminIconButton>
                            </span>
                        ))}
                    </span>
                    <AdminFileButton size="sm" accept="image/*" multiple leading={<IconUpload />} loading={uploading} onFiles={(files) => void handleImageUpload(files)}>사진 올리기</AdminFileButton>
                </AdminField>
                <div className="ag-two">
                    <AdminField label="숙소명" required>
                        {(id) => <AdminTextInput id={id} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="숙소 이름" />}
                    </AdminField>
                    <AdminField label="위치" required>
                        {(id) => <AdminTextInput id={id} value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="예: 울란바토르 시내, 테를지 국립공원" />}
                    </AdminField>
                </div>
                <AdminField label="숙소 타입">
                    <span className="ag-type-groups">
                        {Object.entries(ACCOMMODATION_TYPES).map(([category, subtypes]) => (
                            <span key={category} className="ag-type-group">
                                <small className="ag-muted">{category}</small>
                                <span className="ag-chips" role="group" aria-label={category}>
                                    {subtypes.map(subtype => <AdminChip key={subtype} active={formData.type === subtype} onClick={() => setFormData({ ...formData, type: subtype })}>{subtype}</AdminChip>)}
                                </span>
                            </span>
                        ))}
                    </span>
                </AdminField>
                <AdminField label="편의시설">
                    <span className="ag-chips" role="group" aria-label="편의시설">
                        {AVAILABLE_FACILITIES.map(facility => <AdminChip key={facility} active={formData.facilities.includes(facility)} onClick={() => toggleFacility(facility)}>{facility}</AdminChip>)}
                    </span>
                </AdminField>
                <AdminField label="숙소 설명">
                    {(id) => <AdminTextArea id={id} minRows={4} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="숙소에 대한 설명을 입력하세요" />}
                </AdminField>
            </AdminDialog>
        </ListPage>
    );
};
