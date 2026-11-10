import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type { DetailContentBlock } from '../../types/product';
import type { TouristSpot } from '../../types/touristSpot';
import type { Hotel } from '../../types/hotel';
import { TouristSpotPickerModal } from './TouristSpotPickerModal';
import { HotelPickerModal } from './HotelPickerModal';
import {
    planCourse, planToBlocks, dayGaps, planPhotoCount, plainText, shortText, dayAliasKey, itemAliasKey, stayAliasKey,
    type Course, type CourseImportAliases, type PlanDay,
} from './courseImport';

interface CourseImportModalProps {
    open: boolean;
    /** 만든 일정표 블록과 코스 이름 */
    onPick: (blocks: DetailContentBlock[], courseName: string) => void;
    onClose: () => void;
}

/** 관리자가 직접 골라 준 짝을 이 브라우저에 기억해 두는 자리 */
const ALIAS_KEY = 'mw_course_import_aliases';

function readAliases(): CourseImportAliases {
    try {
        const saved = JSON.parse(window.localStorage.getItem(ALIAS_KEY) || 'null');
        return { spots: { ...(saved?.spots || {}) }, lodges: { ...(saved?.lodges || {}) } };
    } catch { return { spots: {}, lodges: {} }; }
}

function writeAliases(aliases: CourseImportAliases) {
    try { window.localStorage.setItem(ALIAS_KEY, JSON.stringify(aliases)); } catch { /* 저장소를 못 쓰면 이번 불러오기에만 적용 */ }
}

const isCourseMap = (value: unknown): value is Record<string, Course> =>
    !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;

/** 코스 관리가 처음 보여 주는 기본 코스 (public/presets.js) — 서버에 저장한 코스가 아직 없을 때만 읽는다 */
let presetCourses: Promise<Record<string, Course>> | null = null;
function loadPresetCourses(): Promise<Record<string, Course>> {
    // presets.js는 전역 함수와 서버 동기화를 함께 정의한다 — 관리자 창을 건드리지 않게 숨은 frame 안에서 읽고 바로 닫는다
    presetCourses ??= new Promise(resolve => {
        const frame = document.createElement('iframe');
        frame.style.display = 'none';
        frame.setAttribute('aria-hidden', 'true');
        const finish = (value: Record<string, Course>) => { frame.remove(); resolve(value); };
        document.body.appendChild(frame);
        const doc = frame.contentDocument;
        if (!doc) { finish({}); return; }
        const script = doc.createElement('script');
        script.src = '/presets.js';
        script.onload = () => {
            const courses = (frame.contentWindow as unknown as { PRESETS?: { courses?: Record<string, Course> } } | null)?.PRESETS?.courses;
            finish(isCourseMap(courses) ? JSON.parse(JSON.stringify(courses)) : {});
        };
        script.onerror = () => finish({});
        doc.head.appendChild(script);
    });
    return presetCourses;
}

/** 코스 관리와 같은 순서로 읽는다: 서버 저장분 → 이 브라우저 저장분 → 기본 코스 */
async function loadCourses(signal: AbortSignal): Promise<Record<string, Course>> {
    try {
        const res = await fetch('/api/data/courses', { cache: 'no-store', signal });
        const body = await res.json();
        if (isCourseMap(body?.data)) return body.data;
    } catch { /* 아래 저장분으로 넘어간다 */ }
    try {
        const local = JSON.parse(window.localStorage.getItem('leaders_courses') || 'null');
        if (isCourseMap(local)) return local;
    } catch { /* ignore */ }
    return loadPresetCourses();
}

type PickTarget = { kind: 'day'; day: number } | { kind: 'item'; day: number; item: number } | { kind: 'lodge'; day: number };

const Thumb = ({ src }: { src?: string }) => (
    src
        ? <img src={src} alt="" loading="lazy" className="w-10 h-10 rounded-lg object-cover bg-slate-100 flex-none" />
        : <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center flex-none"><span className="material-symbols-outlined text-base">image_not_supported</span></div>
);

const linkBtn = 'px-2 py-1 rounded-md text-[11px] font-bold text-teal-700 hover:bg-teal-50 whitespace-nowrap';
const mutedBtn = 'px-2 py-1 rounded-md text-[11px] font-semibold text-slate-400 hover:bg-slate-100 whitespace-nowrap';

/**
 * 「코스에서 불러오기」 — 견적 관리의 코스를 골라 상품 일정표를 한 번에 만든다.
 * 사진·설명은 여행지 관리·등록 숙소에서 이름으로 찾아 채우고, 못 찾은 자리는 이 화면에서
 * 바로 골라 준다. 한 번 골라 준 짝은 기억해 두었다가 다음 불러오기에 자동으로 쓴다.
 */
export const CourseImportModal: React.FC<CourseImportModalProps> = ({ open, onPick, onClose }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[225] bg-black/50 flex items-center justify-center p-6" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* 열릴 때마다 새로 마운트되어 코스·여행지·숙소를 다시 읽는다 */}
                <CourseImporter onPick={onPick} onClose={onClose} />
            </div>
        </div>
    );
};

function CourseImporter({ onPick, onClose }: { onPick: (blocks: DetailContentBlock[], courseName: string) => void; onClose: () => void }) {
    const [courses, setCourses] = useState<Record<string, Course>>({});
    const [spots, setSpots] = useState<TouristSpot[]>([]);
    const [hotels, setHotels] = useState<Hotel[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [courseName, setCourseName] = useState<string | null>(null);
    const [plan, setPlan] = useState<PlanDay[]>([]);
    const [includeMove, setIncludeMove] = useState(true);
    const [target, setTarget] = useState<PickTarget | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const list = <T,>(load: Promise<unknown>) => load.then(data => (Array.isArray(data) ? data as T[] : [])).catch(() => [] as T[]);
        Promise.all([
            loadCourses(controller.signal),
            list<TouristSpot>(api.touristSpots.list({ active: true }, { signal: controller.signal, cache: 'no-store' })),
            list<Hotel>(api.hotels.list({ source: 'resources', active: true }, { signal: controller.signal, cache: 'no-store' })),
        ]).then(([c, s, h]) => {
            if (controller.signal.aborted) return;
            setCourses(c); setSpots(s); setHotels(h); setLoading(false);
        });
        return () => controller.abort();
    }, []);

    const entries = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return Object.entries(courses)
            .filter(([, c]) => Array.isArray(c?.days) && c.days.length > 0)
            .filter(([name, c]) => !needle || [name, c.destination, c.nights, ...(c.highlights || []), ...(c.days || []).map(d => plainText(d.dest))].join(' ').toLowerCase().includes(needle))
            .sort(([, a], [, b]) => (a.days?.length || 0) - (b.days?.length || 0));
    }, [courses, q]);

    const choose = (name: string) => {
        setPlan(planCourse(courses[name], spots, hotels, readAliases()));
        setCourseName(name);
    };

    /** 고친 짝을 계획에 넣고, 다음 불러오기에도 쓰도록 기억한다 */
    const remember = (kind: 'spots' | 'lodges', key: string, id: string) => {
        if (!key) return;
        const aliases = readAliases();
        aliases[kind][key] = id;
        writeAliases(aliases);
    };
    const setDaySpot = (dayIndex: number, spot: TouristSpot | null) => {
        setPlan(prev => prev.map(d => (d.index === dayIndex ? { ...d, spot, repeat: false } : d)));
        const day = plan[dayIndex];
        if (day) remember('spots', dayAliasKey(day), spot?.id || '');
    };
    const setItemSpot = (dayIndex: number, itemIndex: number, spot: TouristSpot | null) => {
        setPlan(prev => prev.map(d => (d.index === dayIndex ? { ...d, items: d.items.map((it, j) => (j === itemIndex ? { ...it, spot, description: shortText(spot) } : it)) } : d)));
        const item = plan[dayIndex]?.items[itemIndex];
        if (item) remember('spots', itemAliasKey(item), spot?.id || '');
    };
    const setItemDescription = (dayIndex: number, itemIndex: number, description: string) => {
        setPlan(prev => prev.map(d => (d.index === dayIndex ? { ...d, items: d.items.map((it, j) => (j === itemIndex ? { ...it, description } : it)) } : d)));
    };
    const setLodge = (dayIndex: number, lodge: Hotel | null) => {
        setPlan(prev => prev.map(d => (d.index === dayIndex ? { ...d, lodge } : d)));
        const day = plan[dayIndex];
        if (day) remember('lodges', stayAliasKey(day), lodge?.id || '');
    };

    const gaps = useMemo(() => plan.map(d => dayGaps(d, plan)), [plan]);
    const emptyPhotoDays = gaps.filter(g => g.photo).length;
    const emptyLodgings = gaps.filter(g => g.lodging).length;

    const header = (title: string, lead: string) => (
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">{title}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{lead}</p>
            </div>
            <button type="button" onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center flex-none" aria-label="닫기">
                <span className="material-symbols-outlined text-slate-500">close</span>
            </button>
        </div>
    );

    // ── 1단계: 코스 고르기 ──
    if (courseName === null) {
        return (
            <>
                {header('코스에서 불러오기', '견적 관리 → 코스 관리의 코스를 고르면 일차·일정·식사·숙소가 한 번에 만들어지고, 사진과 설명은 여행지 관리·등록 숙소에서 자동으로 채워집니다.')}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <input type="text" value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="코스명·여행지 검색 (예: 고비, 테를지, 4박5일)"
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
                <div className="flex-1 overflow-auto">
                    {loading ? (
                        <div className="py-20 text-center text-slate-500">불러오는 중...</div>
                    ) : entries.length === 0 ? (
                        <div className="py-20 text-center text-sm text-slate-500 dark:text-slate-400">{q ? '검색 결과가 없습니다.' : '등록된 코스가 없습니다. 견적 관리 → 코스 관리에서 먼저 만들어 주세요.'}</div>
                    ) : entries.map(([name, c]) => (
                        <button key={name} type="button" data-course={name} onClick={() => choose(name)}
                            className="w-full text-left px-6 py-3 border-b border-slate-100 dark:border-slate-800 hover:bg-teal-50/60 dark:hover:bg-teal-900/20 flex items-center gap-4">
                            <div className="min-w-0 flex-1">
                                <div className="font-bold text-slate-900 dark:text-white truncate">{name}</div>
                                <div className="text-xs text-slate-500 mt-0.5 truncate">{(c.days || []).map(d => plainText(d.dest)).filter(Boolean).join(' → ')}</div>
                            </div>
                            <div className="text-xs font-semibold text-slate-500 whitespace-nowrap">{c.nights || `${c.days?.length}일`}</div>
                            <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                        </button>
                    ))}
                </div>
            </>
        );
    }

    // ── 2단계: 자동으로 채운 결과 확인, 빈 자리 채우기 ──
    return (
        <>
            {header(courseName, '자동으로 찾은 사진과 한 줄 설명을 확인하세요. 주황색으로 표시된 자리만 골라 주면 됩니다. 한 번 골라 준 짝은 다음 불러오기부터 자동으로 들어갑니다.')}
            <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-4 space-y-3">
                {plan.map((day, i) => {
                    const gap = gaps[i];
                    const lodgeThumb = day.lodge ? (day.lodge.images || []).find(Boolean) : day.stayImages[0];
                    return (
                        <div key={day.index} data-plan-day={i} className={`rounded-xl border bg-white dark:bg-slate-900 ${gap.photo ? 'border-amber-300' : 'border-slate-200 dark:border-slate-800'}`}>
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                                <Thumb src={day.spot ? (day.spot.images || []).find(Boolean) : day.dayImages[0]} />
                                <div className="min-w-0 flex-1">
                                    <div className="font-bold text-slate-900 dark:text-white truncate">
                                        <span className="text-[11px] font-bold text-slate-400 mr-1.5">{i + 1}일차</span>{day.title || '(목적지 없음)'}
                                    </div>
                                    {day.spot ? (
                                        <div className="text-[11.5px] text-teal-700 dark:text-teal-300 font-semibold truncate">
                                            여행지 「{day.spot.name_kr}」 사진 {(day.spot.images || []).filter(Boolean).length}장{day.repeat ? ' · 앞 일차와 같은 곳이라 배경 사진만 넣습니다' : ''}
                                        </div>
                                    ) : (
                                        <div className="text-[11.5px] text-amber-700 font-semibold">{gap.photo ? '이 날에 넣을 사진을 찾지 못했습니다' : '대표 여행지 없음'}</div>
                                    )}
                                </div>
                                <span className="text-[11px] text-slate-400 whitespace-nowrap">사진 {planPhotoCount(day, plan)}</span>
                                <button type="button" data-pick-day={i} onClick={() => setTarget({ kind: 'day', day: i })} className={day.spot ? linkBtn : 'px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500 text-white hover:bg-amber-600 whitespace-nowrap'}>
                                    {day.spot ? '변경' : '여행지 선택'}
                                </button>
                                {day.spot && <button type="button" onClick={() => setDaySpot(i, null)} className={mutedBtn}>빼기</button>}
                            </div>

                            <ul className="px-4 py-2">
                                {day.items.map((item, j) => (
                                    <li key={j} className="py-1 text-[13px] text-slate-700 dark:text-slate-200">
                                        <div className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-none" />
                                        <span className="min-w-0 flex-1 truncate">
                                            {item.time && <b className="mr-1.5">{item.time}</b>}{item.title}
                                            {item.note && <span className="ml-1.5 text-slate-400">{item.note}</span>}
                                        </span>
                                        {item.spot ? (
                                            <>
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[11px] font-bold whitespace-nowrap">
                                                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>image</span>{item.spot.name_kr}
                                                </span>
                                                <button type="button" onClick={() => setItemSpot(i, j, null)} className={mutedBtn} aria-label="이 항목의 사진 빼기">빼기</button>
                                            </>
                                        ) : (
                                            <button type="button" data-pick-item={`${i}:${j}`} onClick={() => setTarget({ kind: 'item', day: i, item: j })} className={mutedBtn}>+ 사진</button>
                                        )}
                                        </div>
                                        {item.spot && (
                                            <div className="flex items-center gap-2 mt-1 ml-3.5">
                                                {(item.spot.images || []).filter(Boolean).slice(0, 2).map((src, k) => (
                                                    <img key={k} src={src} alt="" loading="lazy" className="w-9 h-7 rounded object-cover bg-slate-100 flex-none" />
                                                ))}
                                                <input type="text" value={item.description} data-item-description={`${i}:${j}`} onChange={(e) => setItemDescription(i, j, e.target.value)}
                                                    placeholder="항목 아래에 들어갈 한 줄 설명 (비워 두면 사진만)"
                                                    className="min-w-0 flex-1 px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-[12px] text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-teal-500 outline-none" />
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>

                            {(day.stayName || day.meals.breakfast || day.meals.lunch || day.meals.dinner) && (
                                <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 text-[12px] text-slate-600 dark:text-slate-300 space-y-1.5">
                                    {(day.meals.breakfast || day.meals.lunch || day.meals.dinner) && (
                                        <div><b className="text-slate-400 mr-2">식사</b>{[day.meals.breakfast && `아침 ${day.meals.breakfast}`, day.meals.lunch && `점심 ${day.meals.lunch}`, day.meals.dinner && `저녁 ${day.meals.dinner}`].filter(Boolean).join(' · ')}</div>
                                    )}
                                    {day.stayName && (
                                        <div className="flex items-center gap-2">
                                            <b className="text-slate-400">숙소</b>
                                            <span className="min-w-0 flex-1 truncate">
                                                {day.lodge ? day.lodge.name_kr : day.stayName}
                                                {day.lodge && day.lodge.name_kr !== day.stayName && <span className="ml-1.5 text-slate-400">(코스: {day.stayName})</span>}
                                            </span>
                                            {lodgeThumb
                                                ? <span className="text-[11px] font-bold text-teal-700 whitespace-nowrap">사진 {(day.lodge ? day.lodge.images || [] : day.stayImages).filter(Boolean).length}장</span>
                                                : <span className="text-[11px] font-bold text-amber-700 whitespace-nowrap">사진 없음</span>}
                                            <button type="button" data-pick-lodge={i} onClick={() => setTarget({ kind: 'lodge', day: i })} className={lodgeThumb ? linkBtn : 'px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500 text-white hover:bg-amber-600 whitespace-nowrap'}>
                                                {day.lodge ? '변경' : '등록 숙소 선택'}
                                            </button>
                                            {day.lodge && <button type="button" onClick={() => setLodge(i, null)} className={mutedBtn}>빼기</button>}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="min-w-0 text-[12px]">
                    <div data-plan-summary className={emptyPhotoDays || emptyLodgings ? 'font-bold text-amber-700' : 'font-bold text-teal-700'}>
                        {emptyPhotoDays || emptyLodgings
                            ? [emptyPhotoDays && `사진이 없는 일차 ${emptyPhotoDays}개`, emptyLodgings && `사진 없는 숙소 ${emptyLodgings}개`].filter(Boolean).join(' · ')
                            : '모든 일차에 사진이 들어갑니다'}
                    </div>
                    <label className="flex items-center gap-1.5 mt-1 text-slate-500 cursor-pointer">
                        <input type="checkbox" checked={includeMove} onChange={(e) => setIncludeMove(e.target.checked)} className="w-3.5 h-3.5 accent-teal-600" />
                        이동 시간·거리를 일차 소개에 넣기
                    </label>
                </div>
                <div className="flex items-center gap-2 flex-none">
                    <button type="button" onClick={() => setCourseName(null)} className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">다른 코스</button>
                    <button type="button" data-course-submit onClick={() => onPick(planToBlocks(plan, { includeMove }), courseName)} className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700">
                        이 코스로 일정표 만들기
                    </button>
                </div>
            </div>

            <TouristSpotPickerModal
                open={target?.kind === 'day' || target?.kind === 'item'}
                title={target?.kind === 'item' ? `「${plan[target.day]?.items[target.item]?.title || ''}」에 넣을 여행지` : `${(target?.day ?? 0) + 1}일차 대표 여행지`}
                onPick={(spot) => {
                    if (target?.kind === 'day') setDaySpot(target.day, spot);
                    else if (target?.kind === 'item') setItemSpot(target.day, target.item, spot);
                    setTarget(null);
                }}
                onClose={() => setTarget(null)}
            />
            <HotelPickerModal
                open={target?.kind === 'lodge'}
                title={`${(target?.day ?? 0) + 1}일차 숙소`}
                onPick={(hotel) => { if (target?.kind === 'lodge') setLodge(target.day, hotel); setTarget(null); }}
                onClose={() => setTarget(null)}
            />
        </>
    );
}
