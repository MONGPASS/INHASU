import React, { useEffect, useState } from 'react';

const parseArr = (v: any): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') {
        try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
    }
    return [];
};

const parseImages = (v: any): string[] => {
    const arr = parseArr(v);
    if (arr.length > 0) return arr;
    if (typeof v === 'string' && v.startsWith('http')) return [v];
    return [];
};

// Lock body scroll while a modal is open
const useLockBodyScroll = (open: boolean) => {
    useEffect(() => {
        if (!open) return;
        const original = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = original; };
    }, [open]);
};

interface ModalShellProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

const ModalShell: React.FC<ModalShellProps> = ({ open, onClose, children }) => {
    useLockBodyScroll(open);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full sm:max-w-md max-h-[92vh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95 fade-in duration-200">
                {children}
            </div>
        </div>
    );
};

// ─── Guide ────────────────────────────────────────────────
interface Guide {
    id?: string;
    name?: string;
    image?: string;
    introduction?: string;
    bio?: string;
    phone?: string;
    kakaoId?: string;
    languages?: any;
    specialties?: any;
    experienceYears?: number;
}

interface GuideDetailModalProps {
    guide: Guide | null;
    open: boolean;
    onClose: () => void;
}

export const GuideDetailModal: React.FC<GuideDetailModalProps> = ({ guide, open, onClose }) => {
    if (!guide) return null;
    const languages = parseArr(guide.languages);
    const specialties = parseArr(guide.specialties);
    const intro = guide.introduction || guide.bio || '';

    return (
        <ModalShell open={open} onClose={onClose}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                <p className="text-xs font-bold tracking-widest uppercase text-slate-400">담당 가이드</p>
                <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" aria-label="close">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
                <div className="flex flex-col items-center text-center mb-5">
                    {guide.image ? (
                        <img src={guide.image} alt={guide.name} className="w-28 h-28 rounded-full object-cover ring-4 ring-white shadow-lg shadow-teal-500/20 mb-3" loading="lazy" decoding="async" />
                    ) : (
                        <div className="w-28 h-28 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-3"
                            style={{ background: 'linear-gradient(135deg, #0f766e, #14b8a6)' }}>
                            {guide.name?.[0] || '?'}
                        </div>
                    )}
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{guide.name}</h2>
                    {guide.experienceYears != null && guide.experienceYears > 0 && (
                        <p className="text-xs text-slate-500 mt-1 inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-amber-500">workspace_premium</span>
                            가이드 경력 {guide.experienceYears}년
                        </p>
                    )}
                </div>

                {(languages.length > 0 || specialties.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 justify-center mb-5">
                        {languages.map((l, i) => (
                            <span key={`l-${i}`} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-100 text-teal-700">{l}</span>
                        ))}
                        {specialties.map((s, i) => (
                            <span key={`s-${i}`} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{s}</span>
                        ))}
                    </div>
                )}

                {intro && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 mb-5">
                        <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-2">소개</p>
                        <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">{intro}</p>
                    </div>
                )}
            </div>

            {/* Actions */}
            {(guide.phone || guide.kakaoId) && (
                <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-2 flex-shrink-0">
                    {guide.phone && (
                        <a href={`tel:${guide.phone}`} className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm font-bold transition-colors">
                            <span className="material-symbols-outlined text-base">call</span>
                            전화하기
                        </a>
                    )}
                    {guide.kakaoId && (
                        <button className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 rounded-xl text-sm font-bold transition-colors">
                            <span className="material-symbols-outlined text-base">chat</span>
                            {guide.kakaoId}
                        </button>
                    )}
                </div>
            )}
        </ModalShell>
    );
};

// ─── Accommodation ────────────────────────────────────────
interface Accommodation {
    id?: string;
    name?: string;
    type?: string;
    location?: string;
    images?: any;
    description?: string;
    facilities?: any;
    rating?: number;
}

interface AccommodationDetailModalProps {
    accommodation: Accommodation | null;
    day?: number;
    open: boolean;
    onClose: () => void;
}

export const AccommodationDetailModal: React.FC<AccommodationDetailModalProps> = ({ accommodation, day, open, onClose }) => {
    const [imageIdx, setImageIdx] = useState(0);

    useEffect(() => {
        if (open) setImageIdx(0);
    }, [open, accommodation?.id]);

    if (!accommodation) return null;
    const images = parseImages(accommodation.images);
    const facilities = parseArr(accommodation.facilities);
    const mapsUrl = accommodation.location
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(accommodation.location)}`
        : null;

    const next = () => setImageIdx(i => (i + 1) % Math.max(images.length, 1));
    const prev = () => setImageIdx(i => (i - 1 + Math.max(images.length, 1)) % Math.max(images.length, 1));

    return (
        <ModalShell open={open} onClose={onClose}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
                <p className="text-xs font-bold tracking-widest uppercase text-slate-400">
                    {day ? `${day}일차 숙박` : '숙소'}
                </p>
                <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" aria-label="close">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
                {/* Image carousel */}
                {images.length > 0 ? (
                    <div className="relative aspect-video bg-slate-100 dark:bg-slate-800">
                        <img src={images[imageIdx]} alt={accommodation.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                        {images.length > 1 && (
                            <>
                                <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md text-slate-700">
                                    <span className="material-symbols-outlined">chevron_left</span>
                                </button>
                                <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md text-slate-700">
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </button>
                                <div className="absolute bottom-3 right-3 bg-slate-900/70 text-white text-xs font-mono px-2 py-1 rounded-full">
                                    {imageIdx + 1} / {images.length}
                                </div>
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                                    {images.map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setImageIdx(i)}
                                            className={`w-1.5 h-1.5 rounded-full transition-all ${i === imageIdx ? 'bg-white w-4' : 'bg-white/50'}`}
                                            aria-label={`Image ${i + 1}`}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="aspect-video bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <span className="material-symbols-outlined text-5xl text-slate-300">hotel</span>
                    </div>
                )}

                <div className="p-5">
                    {/* Name + type */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{accommodation.name}</h2>
                            {accommodation.type && (
                                <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">{accommodation.type}</span>
                            )}
                        </div>
                        {accommodation.rating != null && accommodation.rating > 0 && (
                            <div className="inline-flex items-center gap-0.5 text-amber-500 flex-shrink-0">
                                <span className="material-symbols-outlined text-base">star</span>
                                <span className="text-sm font-bold">{accommodation.rating.toFixed(1)}</span>
                            </div>
                        )}
                    </div>

                    {/* Location */}
                    {accommodation.location && (
                        <a
                            href={mapsUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-2 mb-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed hover:text-teal-600"
                        >
                            <span className="material-symbols-outlined text-base text-slate-400 mt-0.5 flex-shrink-0">location_on</span>
                            <span className="flex-1">{accommodation.location}</span>
                            <span className="material-symbols-outlined text-sm text-slate-400">open_in_new</span>
                        </a>
                    )}

                    {/* Facilities */}
                    {facilities.length > 0 && (
                        <div className="mb-4">
                            <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-2">시설</p>
                            <div className="flex flex-wrap gap-1.5">
                                {facilities.map((f, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                        <span className="material-symbols-outlined text-sm text-teal-600">check</span>
                                        {f}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    {accommodation.description && (
                        <div>
                            <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-2">안내</p>
                            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">{accommodation.description}</p>
                        </div>
                    )}
                </div>
            </div>
        </ModalShell>
    );
};