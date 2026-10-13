import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface LocationInfo {
    name?: string;
    address?: string;
    phone?: string;
    website?: string;
    hours?: string;       // raw multiline text from admin
    mapEmbedUrl?: string; // already-sanitized Google Maps embed URL (server side)
    mapQuery?: string;    // address or "lat,lng" for directions URL
}

interface LocationCardProps {
    location: LocationInfo;
}

// — helpers —

const buildDirectionsUrl = (loc: LocationInfo): string => {
    const q = (loc.mapQuery || loc.address || loc.name || '').trim();
    if (!q) return 'https://www.google.com/maps';
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
};

const buildPlaceViewUrl = (loc: LocationInfo): string => {
    const q = (loc.mapQuery || loc.address || loc.name || '').trim();
    if (!q) return 'https://www.google.com/maps';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
};

// Extract iframe src from raw HTML, or pass through a URL.
const resolveEmbedSrc = (raw?: string): string | null => {
    if (!raw) return null;
    const v = raw.trim();
    if (!v) return null;
    const m = v.match(/src=["']([^"']+)["']/i);
    const url = m ? m[1] : v;
    if (!/^https?:\/\//i.test(url)) return null;
    return url;
};

// Parse multi-line "label: hours" text into structured rows.
const parseHours = (raw?: string): Array<{ label: string; value: string }> => {
    if (!raw) return [];
    return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const i = line.indexOf(':');
            if (i === -1) return { label: '', value: line };
            return { label: line.slice(0, i).trim(), value: line.slice(i + 1).trim() };
        });
};

const findTodayRow = (rows: Array<{ label: string; value: string }>): number => {
    if (rows.length === 0) return -1;
    const day = new Date().getDay();
    // 관리자가 입력한 요일 표기(일본어·영어·한국어)를 모두 인식한다.
    const labels: Record<number, string[]> = {
        0: ['日', 'Sun', '일'],
        1: ['月', 'Mon', '월'],
        2: ['火', 'Tue', '화'],
        3: ['水', 'Wed', '수'],
        4: ['木', 'Thu', '목'],
        5: ['金', 'Fri', '금'],
        6: ['土', 'Sat', '토'],
    };
    const cand = labels[day] || [];
    for (let i = 0; i < rows.length; i++) {
        const lbl = rows[i].label;
        if (!lbl) continue;
        if (cand.some((c) => lbl.startsWith(c))) return i;
    }
    return -1;
};

export const LocationCard: React.FC<LocationCardProps> = ({ location }) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const [hoursOpen, setHoursOpen] = useState(false);

    const embedSrc = useMemo(() => resolveEmbedSrc(location.mapEmbedUrl), [location.mapEmbedUrl]);
    const directionsUrl = useMemo(() => buildDirectionsUrl(location), [location]);
    const placeViewUrl = useMemo(() => buildPlaceViewUrl(location), [location]);
    const hoursRows = useMemo(() => parseHours(location.hours), [location.hours]);
    const todayIdx = useMemo(() => findTodayRow(hoursRows), [hoursRows]);
    const todayRow = todayIdx >= 0 ? hoursRows[todayIdx] : null;

    const hasAny = !!(
        location.name ||
        location.address ||
        location.phone ||
        location.website ||
        embedSrc ||
        location.hours
    );
    if (!hasAny) return null;

    const handleCopyAddress = async () => {
        const text = location.address || location.name || '';
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            // Silently fail
        }
    };

    return (
        <section className="not-prose my-7">
            {/* Section header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                    <span
                        className="material-symbols-outlined text-primary text-[20px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                        place
                    </span>
                    <h3 className="text-[18px] font-bold text-slate-900 dark:text-white tracking-tight">
                        {location.name || t('magazine.location.title', { defaultValue: '위치' })}
                    </h3>
                </div>
            </div>

            {/* Map */}
            {embedSrc && (
                <div
                    className="relative w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm"
                    style={{ aspectRatio: '16 / 11' }}
                >
                    <iframe
                        src={embedSrc}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        allowFullScreen
                        className="absolute inset-0 w-full h-full border-0"
                        title={location.name || 'map'}
                    />
                </div>
            )}

            {/* Info card (gray bg, label/value rows) */}
            {(location.address || location.phone || location.website) && (
                <div className="mt-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 p-4 space-y-3">
                    {location.address && (
                        <div className="grid grid-cols-[44px_1fr] items-start gap-2">
                            <span className="text-[12.5px] font-bold text-slate-500 dark:text-slate-400 pt-0.5">
                                {t('magazine.location.address', { defaultValue: '주소' })}
                            </span>
                            <span className="text-[13.5px] text-slate-800 dark:text-slate-200 leading-relaxed break-words">
                                {location.address}
                            </span>
                        </div>
                    )}
                    {location.phone && (
                        <div className="grid grid-cols-[44px_1fr] items-center gap-2">
                            <span className="text-[12.5px] font-bold text-slate-500 dark:text-slate-400">
                                {t('magazine.location.phone', { defaultValue: '전화' })}
                            </span>
                            <a
                                href={`tel:${location.phone.replace(/\s/g, '')}`}
                                className="text-[13.5px] font-medium text-slate-800 dark:text-slate-200 hover:text-primary tabular-nums break-all"
                            >
                                {location.phone}
                            </a>
                        </div>
                    )}
                    {location.website && (
                        <div className="grid grid-cols-[44px_1fr] items-center gap-2">
                            <span className="text-[12.5px] font-bold text-slate-500 dark:text-slate-400">
                                {t('magazine.location.website', { defaultValue: '사이트' })}
                            </span>
                            <a
                                href={location.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[13.5px] font-medium text-primary hover:underline truncate"
                            >
                                {location.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                            </a>
                        </div>
                    )}
                </div>
            )}

            {/* Action buttons */}
            <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={handleCopyAddress}
                    disabled={!location.address && !location.name}
                    className="inline-flex items-center justify-center gap-1.5 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold text-[14px] hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                    <span className="material-symbols-outlined text-[18px]">
                        {copied ? 'check' : 'content_copy'}
                    </span>
                    {copied
                        ? t('magazine.location.copied', { defaultValue: '복사됨' })
                        : t('magazine.location.copy_address', { defaultValue: '주소 복사' })}
                </button>
                <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 h-12 rounded-xl bg-primary text-white font-bold text-[14px] shadow-md shadow-primary/25 hover:bg-primary-dark active:scale-[0.98] transition-all"
                >
                    <span
                        className="material-symbols-outlined text-[18px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                        directions
                    </span>
                    {t('magazine.location.directions', { defaultValue: '길찾기' })}
                </a>
            </div>

            {/* Hours (collapsible, today's hours always visible as preview) */}
            {hoursRows.length > 0 && (
                <div className="mt-5 border-t border-slate-200 dark:border-slate-700 pt-4">
                    <button
                        type="button"
                        onClick={() => setHoursOpen(!hoursOpen)}
                        className="w-full flex items-center justify-between text-left"
                        aria-expanded={hoursOpen}
                    >
                        <h4 className="text-[15px] font-bold text-slate-900 dark:text-white">
                            {t('magazine.location.hours_title', { defaultValue: '영업시간 · 휴무일' })}
                        </h4>
                        <span
                            className={`material-symbols-outlined text-[22px] text-slate-500 transition-transform duration-200 ${
                                hoursOpen ? 'rotate-180' : ''
                            }`}
                        >
                            expand_more
                        </span>
                    </button>

                    {/* Today's hours preview (always visible) */}
                    {todayRow && (
                        <div className="mt-2.5 flex items-center gap-2 text-[14px]">
                            <span className="text-primary font-bold">
                                {t('magazine.location.today', { defaultValue: '오늘' })}
                            </span>
                            <span className="text-slate-700 dark:text-slate-300 tabular-nums font-medium">
                                {todayRow.value}
                            </span>
                        </div>
                    )}

                    {/* Full week list when expanded */}
                    {hoursOpen && (
                        <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[13.5px]">
                            {hoursRows.map((row, i) => {
                                const isToday = i === todayIdx;
                                return (
                                    <React.Fragment key={i}>
                                        <div
                                            className={`tabular-nums ${
                                                isToday
                                                    ? 'text-primary font-bold'
                                                    : 'text-slate-500 dark:text-slate-400'
                                            }`}
                                        >
                                            {row.label}
                                        </div>
                                        <div
                                            className={`tabular-nums ${
                                                isToday
                                                    ? 'text-slate-900 dark:text-white font-bold'
                                                    : 'text-slate-700 dark:text-slate-300'
                                            }`}
                                        >
                                            {row.value}
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Optional: open in Maps app */}
            {!embedSrc && (location.address || location.name) && (
                <a
                    href={placeViewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:underline"
                >
                    {t('magazine.location.open_in_maps', { defaultValue: 'Google 지도에서 열기' })}
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                </a>
            )}
        </section>
    );
};
