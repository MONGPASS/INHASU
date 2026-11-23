import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { AdminBadge, AdminDialog, AdminEmpty, AdminSearch, IconHome, IconLocation, IconPerson } from './ui';
import './CourseImportModal.css';

interface Guide {
    id: string;
    name: string;
    image: string;
    introduction: string;
    phone: string;
    kakaoId: string;
    languages: string[];
    specialties: string[];
}

interface Accommodation {
    id: string;
    name: string;
    images: string[];
    description: string;
    type: string;
    location: string;
    facilities: string[];
}

interface GuideSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (guide: Guide) => void;
    currentGuide?: Guide | null;
}

export const GuideSelectionModal: React.FC<GuideSelectionModalProps> = ({ isOpen, onClose, onSelect, currentGuide }) => {
    const [guides, setGuides] = useState<Guide[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            const fetchGuides = async () => {
                try {
                    const data = await api.guides.list();
                    if (Array.isArray(data)) {
                        setGuides(data.map((g: any) => ({
                            id: g.id,
                            name: g.name,
                            image: g.image,
                            introduction: g.introduction,
                            phone: g.phone,
                            kakaoId: g.kakao_id || g.kakaoId,
                            languages: g.languages || [],
                            specialties: g.specialties || []
                        })));
                    }
                } catch (error) {
                    console.error('Error fetching guides:', error);
                }
            };
            fetchGuides();
        }
    }, [isOpen]);

    const filteredGuides = guides.filter(g =>
        g.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AdminDialog open={isOpen} onClose={onClose} title="가이드 선택" size="lg" flush footer={null}>
            <div className="cim-search">
                <AdminSearch wide value={searchTerm} onChange={setSearchTerm} placeholder="가이드 이름 검색..." />
            </div>

            <div className="cim-list">
                {filteredGuides.length === 0 ? (
                    <AdminEmpty icon={<IconPerson />} title="등록된 가이드가 없습니다" />
                ) : (
                    <div className="cim-grid">
                        {filteredGuides.map(guide => (
                            <div
                                key={guide.id}
                                onClick={() => {
                                    onSelect(guide);
                                    onClose();
                                }}
                                className={`cim-select-card${currentGuide?.id === guide.id ? ' is-selected' : ''}`}
                            >
                                <div className="cim-select-row">
                                    {guide.image ? (
                                        <img src={guide.image} alt={guide.name} className="cim-avatar" />
                                    ) : (
                                        <div className="cim-avatar" aria-hidden="true">
                                            <IconPerson />
                                        </div>
                                    )}
                                    <div className="cim-select-text">
                                        <p className="cim-select-name">{guide.name}</p>
                                        {guide.introduction && (
                                            <p className="cim-select-desc">{guide.introduction}</p>
                                        )}
                                        {guide.languages.length > 0 && (
                                            <div className="cim-select-tags">
                                                {guide.languages.map(lang => (
                                                    <AdminBadge key={lang} tone="info">
                                                        {lang}
                                                    </AdminBadge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AdminDialog>
    );
};

interface AccommodationSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (accommodation: Accommodation) => void;
    day: number;
    currentAccommodation?: Accommodation | null;
}

export const AccommodationSelectionModal: React.FC<AccommodationSelectionModalProps> = ({
    isOpen,
    onClose,
    onSelect,
    day,
    currentAccommodation
}) => {
    const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            const fetchAccommodations = async () => {
                try {
                    const data = await api.accommodations.list();
                    if (Array.isArray(data)) {
                        setAccommodations(data.map((a: any) => ({
                            id: a.id,
                            name: a.name,
                            images: a.images || [],
                            description: a.description,
                            type: a.type,
                            location: a.location,
                            facilities: a.facilities || []
                        })));
                    }
                } catch (error) {
                    console.error('Error fetching accommodations:', error);
                }
            };
            fetchAccommodations();
        }
    }, [isOpen]);

    const filteredAccommodations = accommodations.filter(a =>
        a.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AdminDialog open={isOpen} onClose={onClose} title={`${day}일차 숙소 선택`} size="lg" flush footer={null}>
            <div className="cim-search">
                <AdminSearch wide value={searchTerm} onChange={setSearchTerm} placeholder="숙소 이름 검색..." />
            </div>

            <div className="cim-list">
                {filteredAccommodations.length === 0 ? (
                    <AdminEmpty icon={<IconHome />} title="등록된 숙소가 없습니다" />
                ) : (
                    <div className="cim-grid">
                        {filteredAccommodations.map(accommodation => (
                            <div
                                key={accommodation.id}
                                onClick={() => {
                                    onSelect(accommodation);
                                    onClose();
                                }}
                                className={`cim-select-card${currentAccommodation?.id === accommodation.id ? ' is-selected' : ''}`}
                            >
                                {accommodation.images.length > 0 ? (
                                    <img src={accommodation.images[0]} alt={accommodation.name} className="cim-select-cover" />
                                ) : (
                                    <div className="cim-select-cover" aria-hidden="true">
                                        <IconHome />
                                    </div>
                                )}
                                <div className="cim-select-pad">
                                    <div className="cim-select-head">
                                        <p className="cim-select-name">{accommodation.name}</p>
                                        <AdminBadge tone="success">
                                            {accommodation.type}
                                        </AdminBadge>
                                    </div>
                                    <div className="cim-select-place">
                                        <IconLocation />
                                        <span>{accommodation.location}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AdminDialog>
    );
};
