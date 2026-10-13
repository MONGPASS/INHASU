import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[230] p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">가이드 선택</h2>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="가이드 이름 검색..."
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {filteredGuides.length === 0 ? (
                        <div className="text-center py-12">
                            <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">person_off</span>
                            <p className="text-slate-500 dark:text-slate-400">등록된 가이드가 없습니다</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredGuides.map(guide => (
                                <div
                                    key={guide.id}
                                    onClick={() => {
                                        onSelect(guide);
                                        onClose();
                                    }}
                                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-md ${currentGuide?.id === guide.id
                                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-teal-300'
                                        }`}
                                >
                                    <div className="flex gap-3">
                                        {guide.image ? (
                                            <img src={guide.image} alt={guide.name} className="w-16 h-16 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-3xl text-slate-400">person</span>
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">{guide.name}</p>
                                            {guide.introduction && (
                                                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 line-clamp-2">{guide.introduction}</p>
                                            )}
                                            {guide.languages.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {guide.languages.map(lang => (
                                                        <span key={lang} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded">
                                                            {lang}
                                                        </span>
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
            </div>
        </div>
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[230] p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{day}일차 숙소 선택</h2>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="숙소 이름 검색..."
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {filteredAccommodations.length === 0 ? (
                        <div className="text-center py-12">
                            <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">hotel</span>
                            <p className="text-slate-500 dark:text-slate-400">등록된 숙소가 없습니다</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredAccommodations.map(accommodation => (
                                <div
                                    key={accommodation.id}
                                    onClick={() => {
                                        onSelect(accommodation);
                                        onClose();
                                    }}
                                    className={`border-2 rounded-xl cursor-pointer transition-all hover:shadow-md overflow-hidden ${currentAccommodation?.id === accommodation.id
                                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-teal-300'
                                        }`}
                                >
                                    {accommodation.images.length > 0 ? (
                                        <img src={accommodation.images[0]} alt={accommodation.name} className="w-full h-32 object-cover" />
                                    ) : (
                                        <div className="w-full h-32 bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-5xl text-slate-400">hotel</span>
                                        </div>
                                    )}
                                    <div className="p-3">
                                        <div className="flex items-start justify-between mb-2">
                                            <p className="text-sm font-bold text-slate-800 dark:text-white flex-1">{accommodation.name}</p>
                                            <span className="px-2 py-0.5 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-xs rounded ml-2">
                                                {accommodation.type}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                                            <span className="material-symbols-outlined text-sm">location_on</span>
                                            <span className="truncate">{accommodation.location}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
