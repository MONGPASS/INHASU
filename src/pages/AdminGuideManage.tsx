import React, { useState, useEffect } from 'react';
import {
    AdminBadge, AdminButton, AdminChip, AdminDialog, AdminEmpty, AdminField, AdminFileButton, AdminSearch, AdminSelect, AdminTextArea, AdminTextInput,
    IconCheck, IconPencil, IconPerson, IconPlus, IconTrash, IconUpload,
} from '../components/admin/ui';
import { AdminFilterBar, ListPage } from '../components/admin/ui/AdminPage';
import { api } from '../lib/api';
import { uploadImage } from '../utils/upload';
import { adminConfirm, adminNotify } from '../components/admin/ui/adminFeedback';
import { adminValidateRequired } from '../components/admin/ui/adminForm';
import './AdminGuideManage.css';

/**
 * 상품용 가이드(`/admin/guides`) — 상품 상세의 가이드 소개에 쓰는 가이드 목록(`/api/tour-guides`).
 * 견적·배정의 가이드 등록 정보(`/admin/quote-desk/resources`)와는 다른 자료다. 우리 관리자 부품(당근 Seed)으로 그린다.
 */
interface Guide {
    id: string;
    name: string;
    image: string;
    introduction: string;
    phone: string;
    languages: string[];
    specialties: string[];
    status: string;
    experienceYears: number;
    createdAt: string;
}

type GuideForm = Omit<Guide, 'id' | 'createdAt' | 'status'>;
const EMPTY_FORM: GuideForm = { name: '', image: '', introduction: '', phone: '', experienceYears: 0, languages: [], specialties: [] };

const AVAILABLE_LANGUAGES = ['한국어', '영어', '몽골어', '중국어', '일본어'];
const AVAILABLE_SPECIALTIES = ['고비사막', '홉스굴', '테를지', '승마', '문화체험', '사진촬영'];
const STATUS_OPTIONS = [{ value: 'all', label: '전체 상태' }, { value: 'active', label: '활동중' }, { value: 'pending', label: '승인대기' }];

/** 옛 표기('홉스골')로 저장된 전문 분야도 현재 선택지('홉스굴')로 인식한다. */
const normalizeSpecialties = (list: unknown): string[] =>
    Array.from(new Set((Array.isArray(list) ? list : []).map((s) => (s === '홉스골' ? '홉스굴' : String(s)))));

const toggle = (list: string[], value: string) => list.includes(value) ? list.filter(v => v !== value) : [...list, value];

export const AdminGuideManage: React.FC = () => {
    const [guides, setGuides] = useState<Guide[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGuide, setEditingGuide] = useState<Guide | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [formData, setFormData] = useState<GuideForm>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    const loadGuides = async () => {
        try {
            const data = await api.tourGuides.list();
            if (Array.isArray(data)) {
                setGuides(data.map((g: any) => ({
                    id: g.id,
                    name: g.name,
                    image: g.image || '',
                    introduction: g.bio || g.introduction || '',
                    phone: g.phone || '',
                    experienceYears: g.experience_years || 0,
                    languages: typeof g.languages === 'string' ? JSON.parse(g.languages || '[]') : (g.languages || []),
                    specialties: normalizeSpecialties(typeof g.specialties === 'string' ? JSON.parse(g.specialties || '[]') : (g.specialties || [])),
                    status: g.status || 'active',
                    createdAt: g.created_at || g.createdAt
                })));
            }
        } catch (error) {
            console.error('Error fetching guides:', error);
        }
    };

    useEffect(() => { loadGuides(); }, []);

    const handleImageUpload = async (files: File[]) => {
        const file = files[0];
        if (!file) return;
        setUploading(true);
        try {
            const url = await uploadImage(file, 'guides');
            setFormData(f => ({ ...f, image: url }));
        } catch (error) {
            console.error('Guide image upload failed:', error);
            adminNotify('이미지 업로드 실패');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async () => {
        if (!adminValidateRequired() || !formData.name || !formData.phone) return;
        setSaving(true);
        try {
            const payload = {
                name: formData.name,
                bio: formData.introduction,
                phone: formData.phone,
                image: formData.image,
                experience_years: formData.experienceYears,
                languages: formData.languages,
                specialties: formData.specialties,
            };
            if (editingGuide) await api.tourGuides.update(editingGuide.id, payload);
            else await api.tourGuides.create({ ...payload, status: 'active' });
            await loadGuides();
            closeModal();
        } catch (error: any) {
            console.error('Guide save error:', error);
            adminNotify('저장 실패: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleApprove = async (guide: Guide) => {
        try {
            await api.tourGuides.update(guide.id, {
                name: guide.name,
                bio: guide.introduction,
                phone: guide.phone,
                image: guide.image,
                experience_years: guide.experienceYears,
                languages: guide.languages,
                specialties: guide.specialties,
                status: 'active',
            });
            await loadGuides();
        } catch (error: any) {
            adminNotify('승인 실패: ' + error.message);
        }
    };

    const openNew = () => { setEditingGuide(null); setFormData(EMPTY_FORM); setIsModalOpen(true); };
    const handleEdit = (guide: Guide) => {
        setEditingGuide(guide);
        setFormData({ name: guide.name, image: guide.image, introduction: guide.introduction, phone: guide.phone, experienceYears: guide.experienceYears, languages: guide.languages, specialties: guide.specialties });
        setIsModalOpen(true);
    };
    const closeModal = () => { setIsModalOpen(false); setEditingGuide(null); setFormData(EMPTY_FORM); };

    const handleDelete = async (id: string) => {
        if (await adminConfirm('정말 삭제하시겠습니까?')) {
            try {
                await api.tourGuides.delete(id);
                await loadGuides();
            } catch (error: any) {
                adminNotify('삭제 실패: ' + error.message);
            }
        }
    };

    const filteredGuides = guides.filter(g =>
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (statusFilter === 'all' || g.status === statusFilter)
    );
    const pendingCount = guides.filter(g => g.status === 'pending').length;

    return (
        <ListPage
            activePage="guides"
            title="가이드 관리"
            description={pendingCount > 0 ? `승인대기 ${pendingCount}건` : undefined}
            actions={<AdminButton variant="primary" leading={<IconPlus />} onClick={openNew}>가이드 등록</AdminButton>}
            filters={<AdminFilterBar
                search={<AdminSearch value={searchTerm} onChange={setSearchTerm} placeholder="가이드 이름 검색" aria-label="가이드 검색" />}
                end={<AdminSelect aria-label="상태" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />}
            />}
        >
            {filteredGuides.length > 0 ? (
                <div className="ag-grid">
                    {filteredGuides.map(guide => {
                        const isActive = guide.status === 'active';
                        const langLabel = guide.languages.length > 0 ? (guide.languages.length > 1 ? `${guide.languages[0]} 외` : guide.languages[0]) : '–';
                        return (
                            <article className="ag-card" key={guide.id}>
                                <span className="ag-photo">{guide.image ? <img src={guide.image} alt={guide.name} loading="lazy" /> : <IconPerson aria-hidden="true" />}</span>
                                <b className="ag-name">{guide.name}</b>
                                <span className="ag-phone">{guide.phone || '연락처 미등록'}</span>
                                <AdminBadge tone={isActive ? 'success' : 'warn'}>{guide.status === 'pending' ? '승인대기' : '활동중'}</AdminBadge>
                                <dl className="ag-stats">
                                    <div><dt>경력</dt><dd>{guide.experienceYears > 0 ? `${guide.experienceYears}년` : '–'}</dd></div>
                                    <div><dt>전문</dt><dd>{guide.specialties.length}</dd></div>
                                    <div><dt>언어</dt><dd>{langLabel}</dd></div>
                                </dl>
                                <span className="ag-actions">
                                    {guide.status === 'pending' && <AdminButton size="sm" variant="primary" leading={<IconCheck />} onClick={() => void handleApprove(guide)}>승인</AdminButton>}
                                    <AdminButton size="sm" variant="secondary" leading={<IconPencil />} onClick={() => handleEdit(guide)}>수정</AdminButton>
                                    <AdminButton size="sm" variant="weak" leading={<IconTrash />} onClick={() => void handleDelete(guide.id)}>삭제</AdminButton>
                                </span>
                            </article>
                        );
                    })}
                </div>
            ) : <AdminEmpty title="등록된 가이드가 없습니다" />}

            <AdminDialog open={isModalOpen} onClose={closeModal} title={editingGuide ? '가이드 수정' : '가이드 등록'}
                onSubmit={() => void handleSubmit()} submitLabel={editingGuide ? '수정' : '등록'} submitting={saving} submitDisabled={uploading}>
                <AdminField label="프로필 사진">
                    <span className="ag-upload">
                        <span className="ag-photo is-large">{formData.image ? <img src={formData.image} alt="미리보기" /> : <IconPerson aria-hidden="true" />}</span>
                        <AdminFileButton size="sm" accept="image/*" leading={<IconUpload />} loading={uploading} onFiles={(files) => void handleImageUpload(files)}>
                            {formData.image ? '사진 바꾸기' : '사진 올리기'}
                        </AdminFileButton>
                    </span>
                </AdminField>
                <div className="ag-two">
                    <AdminField label="이름" required>
                        {(id) => <AdminTextInput id={id} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="가이드 이름" />}
                    </AdminField>
                    <AdminField label="연락처" required>
                        {(id) => <AdminTextInput id={id} type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="010-0000-0000" />}
                    </AdminField>
                </div>
                <AdminField label="소개글">
                    {(id) => <AdminTextArea id={id} minRows={4} value={formData.introduction} onChange={(e) => setFormData({ ...formData, introduction: e.target.value })} placeholder="가이드 경력, 전문 분야 등을 입력하세요" />}
                </AdminField>
                <AdminField label="경력 연수">
                    {(id) => <AdminTextInput id={id} className="ag-years" type="number" min={0} max={50} trailing="년" value={String(formData.experienceYears)}
                        onChange={(e) => setFormData({ ...formData, experienceYears: Number(e.target.value) })} />}
                </AdminField>
                <AdminField label="언어">
                    <span className="ag-chips" role="group" aria-label="언어">
                        {AVAILABLE_LANGUAGES.map(lang => <AdminChip key={lang} active={formData.languages.includes(lang)} onClick={() => setFormData({ ...formData, languages: toggle(formData.languages, lang) })}>{lang}</AdminChip>)}
                    </span>
                </AdminField>
                <AdminField label="전문 분야">
                    <span className="ag-chips" role="group" aria-label="전문 분야">
                        {AVAILABLE_SPECIALTIES.map(s => <AdminChip key={s} active={formData.specialties.includes(s)} onClick={() => setFormData({ ...formData, specialties: toggle(formData.specialties, s) })}>{s}</AdminChip>)}
                    </span>
                </AdminField>
            </AdminDialog>
        </ListPage>
    );
};
