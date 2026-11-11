import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type { DetailContentBlock, PackageType, TourPricingOption } from '../../types/product';
import type { TouristSpot } from '../../types/touristSpot';
import type { Hotel } from '../../types/hotel';
import { TouristSpotPickerModal } from './TouristSpotPickerModal';
import { HotelPickerModal } from './HotelPickerModal';
import './CourseImportModal.css';
import {
    planCourse, planToBlocks, dayGaps, planPhotoCount, plainText, shortText, dayAliasKey, itemAliasKey, stayAliasKey,
    coursePricing, suspiciousPricing, stayForPackage,
    type Course, type CourseImportAliases, type PlanDay,
} from './courseImport';

/** 일정표와 함께 넘기는 것 — 고른 여행 타입과, 가져오기로 한 경우의 인원별 가격 */
export interface CourseImportExtra {
    packageType: PackageType | null;
    pricing: TourPricingOption[] | null;
}

interface CourseImportModalProps {
    open: boolean;
    /** 상품에 이미 정해 둔 여행 타입 */
    packageType?: PackageType | null;
    /** 만든 일정표 블록, 코스 이름, 여행 타입·가격 */
    onPick: (blocks: DetailContentBlock[], courseName: string, extra: CourseImportExtra) => void;
    onClose: () => void;
}

const PACKAGE_LABEL: Record<PackageType, string> = { full: '풀패키지', value: '실속형 패키지' };
const PACKAGE_STAYS: Record<PackageType, string> = { full: '4성급 호텔 + 고급 게르', value: '3성급 호텔 + 일반 게르' };
const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

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
        // 대문자 태그 이름: 아이콘 서브셋 검사(scripts/check-icon-subset.mjs)가 소문자 문자열을 아이콘 이름으로 읽기 때문
        const frame = document.createElement('IFRAME') as HTMLIFrameElement;
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
        ? <img src={src} alt="" loading="lazy" className="ci-thumb" />
        : <div className="ci-thumb is-empty"><span className="material-symbols-outlined">image</span></div>
);

const linkBtn = 'ci-link';
const mutedBtn = 'ci-link is-muted';

/**
 * 「코스에서 불러오기」 — 견적 관리의 코스를 골라 상품 일정표를 한 번에 만든다.
 * 사진·설명은 여행지 관리·등록 숙소에서 이름으로 찾아 채우고, 못 찾은 자리는 이 화면에서
 * 바로 골라 준다. 한 번 골라 준 짝은 기억해 두었다가 다음 불러오기에 자동으로 쓴다.
 */
export const CourseImportModal: React.FC<CourseImportModalProps> = ({ open, packageType, onPick, onClose }) => {
    if (!open) return null;
    return (
        <div className="ci-scrim" onClick={onClose}>
            <div className="ci-modal" role="dialog" aria-modal="true" aria-label="코스에서 불러오기" onClick={(e) => e.stopPropagation()}>
                {/* 열릴 때마다 새로 마운트되어 코스·여행지·숙소를 다시 읽는다 */}
                <CourseImporter packageType={packageType ?? null} onPick={onPick} onClose={onClose} />
            </div>
        </div>
    );
};

function CourseImporter({ packageType, onPick, onClose }: { packageType: PackageType | null; onPick: CourseImportModalProps['onPick']; onClose: () => void }) {
    const [courses, setCourses] = useState<Record<string, Course>>({});
    const [spots, setSpots] = useState<TouristSpot[]>([]);
    const [hotels, setHotels] = useState<Hotel[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [courseName, setCourseName] = useState<string | null>(null);
    const [plan, setPlan] = useState<PlanDay[]>([]);
    const [includeMove, setIncludeMove] = useState(true);
    // 여행 타입에 따라 숙소 등급과 요금 열이 정해진다 — 상품에 정해 둔 값으로 시작한다
    const [pkg, setPkg] = useState<PackageType | null>(packageType);
    const [withPrice, setWithPrice] = useState(true);
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
    const course = courseName ? courses[courseName] : undefined;
    const hasPrice = !!course && (coursePricing(course, 'full').length > 0 || coursePricing(course, 'value').length > 0);
    const pricing = useMemo(() => (course && pkg ? coursePricing(course, pkg) : []), [course, pkg]);
    const suspect = useMemo(() => suspiciousPricing(pricing), [pricing]);
    const needsPackage = hasPrice && withPrice && !pkg;
    const emptyPhotoDays = gaps.filter(g => g.photo).length;
    const emptyLodgings = gaps.filter(g => g.lodging).length;

    const header = (title: string, lead: string) => (
        <div className="ci-head">
            <div className="ci-head-text">
                <h2>{title}</h2>
                <p>{lead}</p>
            </div>
            <button type="button" onClick={onClose} className="ci-close" aria-label="닫기">
                <span className="material-symbols-outlined">close</span>
            </button>
        </div>
    );

    // ── 1단계: 코스 고르기 ──
    if (courseName === null) {
        return (
            <>
                {header('코스에서 불러오기', '견적 관리 → 코스 관리의 코스를 고르면 일차·일정·식사·숙소가 한 번에 만들어지고, 사진과 설명은 여행지 관리·등록 숙소에서 자동으로 채워집니다.')}
                <div className="ci-search">
                    <input type="text" value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="코스명·여행지 검색 (예: 고비, 테를지, 4박5일)"
                        className="ci-input" />
                </div>
                <div className="ci-list">
                    {loading ? (
                        <div className="ci-empty" role="status">불러오는 중...</div>
                    ) : entries.length === 0 ? (
                        <div className="ci-empty">{q ? '검색 결과가 없습니다.' : '등록된 코스가 없습니다. 견적 관리 → 코스 관리에서 먼저 만들어 주세요.'}</div>
                    ) : entries.map(([name, c]) => (
                        <button key={name} type="button" data-course={name} onClick={() => choose(name)}
                            className="ci-course">
                            <div className="ci-course-text">
                                <b>{name}</b>
                                <div>{(c.days || []).map(d => plainText(d.dest)).filter(Boolean).join(' → ')}</div>
                            </div>
                            <span className="ci-nights">{c.nights || `${c.days?.length}일`}</span>
                            <span className="material-symbols-outlined ci-chev">chevron_right</span>
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
            <div className="ci-body">
                {/* 여행 타입 — 숙소 등급과 가져올 요금을 정한다 */}
                <div data-course-package className={`ci-card ci-pkg${needsPackage ? ' is-warn' : ''}`}>
                    <div className="ci-pkg-row">
                        <b>여행 타입</b>
                        <div className="ci-seg" role="radiogroup" aria-label="여행 타입">
                            {(['full', 'value'] as const).map(type => (
                                <button key={type} type="button" role="radio" aria-checked={pkg === type} data-package={type} onClick={() => setPkg(type)}
                                    className={pkg === type ? 'is-on' : undefined}>{PACKAGE_LABEL[type]}</button>
                            ))}
                        </div>
                        <span className="ci-hint">{pkg ? PACKAGE_STAYS[pkg] : '풀패키지는 4성급 호텔 + 고급 게르, 실속형은 3성급 호텔 + 일반 게르'}</span>
                    </div>
                    {hasPrice && (
                        <div className="ci-price">
                            <label className="ci-check">
                                <input type="checkbox" checked={withPrice} onChange={(e) => setWithPrice(e.target.checked)} />
                                코스 요금을 가격/옵션에 함께 가져오기
                            </label>
                            {withPrice && (pkg ? (
                                <div data-course-pricing className="ci-price-list">
                                    {pricing.map(o => (
                                        <span key={o.people} className={suspect.includes(o.people) ? 'is-warn' : undefined}>{o.people}인 {won(o.pricePerPerson)}</span>
                                    ))}
                                    <div className="ci-hint">1인 가격 = 예약금 {won(pricing[0]?.depositPerPerson || 0)} + 현지 지불 잔금 · 판매가는 가장 낮은 1인 가격으로 맞춥니다</div>
                                    {suspect.length > 0 && <div className="ci-warn-text">{suspect.join('인, ')}인 금액이 다른 인원과 크게 다릅니다. 코스 관리의 입력값을 확인하세요.</div>}
                                </div>
                            ) : <div className="ci-warn-text">여행 타입을 고르면 그 타입의 요금을 가져옵니다.</div>)}
                        </div>
                    )}
                </div>
                {plan.map((day, i) => {
                    const gap = gaps[i];
                    const lodgeThumb = day.lodge ? (day.lodge.images || []).find(Boolean) : day.stayImages[0];
                    return (
                        <div key={day.index} data-plan-day={i} className={`ci-card ci-day${gap.photo ? ' is-warn' : ''}`}>
                            <div className="ci-day-head">
                                <Thumb src={day.spot ? (day.spot.images || []).find(Boolean) : day.dayImages[0]} />
                                <div className="ci-day-text">
                                    <div className="ci-day-title">
                                        <span>{i + 1}일차</span>{day.title || '(목적지 없음)'}
                                    </div>
                                    {day.spot ? (
                                        <div className="ci-day-sub">
                                            여행지 「{day.spot.name_kr}」 사진 {(day.spot.images || []).filter(Boolean).length}장{day.repeat ? ' · 앞 일차와 같은 곳이라 배경 사진만 넣습니다' : ''}
                                        </div>
                                    ) : (
                                        <div className="ci-day-sub is-warn">{gap.photo ? '이 날에 넣을 사진을 찾지 못했습니다' : '대표 여행지 없음'}</div>
                                    )}
                                </div>
                                <span className="ci-count">사진 {planPhotoCount(day, plan)}</span>
                                <button type="button" data-pick-day={i} onClick={() => setTarget({ kind: 'day', day: i })} className={day.spot ? linkBtn : 'ci-need'}>
                                    {day.spot ? '변경' : '여행지 선택'}
                                </button>
                                {day.spot && <button type="button" onClick={() => setDaySpot(i, null)} className={mutedBtn}>빼기</button>}
                            </div>

                            <ul className="ci-items">
                                {day.items.map((item, j) => (
                                    <li key={j}>
                                        <div className="ci-item">
                                        <span className="ci-dot" />
                                        <span className="ci-item-title">
                                            {item.time && <b className="ci-time">{item.time}</b>}{item.title}
                                            {item.note && <span className="ci-note">{item.note}</span>}
                                        </span>
                                        {item.spot ? (
                                            <>
                                                <span className="ci-chip">
                                                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>image</span>{item.spot.name_kr}
                                                </span>
                                                <button type="button" onClick={() => setItemSpot(i, j, null)} className={mutedBtn} aria-label="이 항목의 사진 빼기">빼기</button>
                                            </>
                                        ) : (
                                            <button type="button" data-pick-item={`${i}:${j}`} onClick={() => setTarget({ kind: 'item', day: i, item: j })} className={mutedBtn}>+ 사진</button>
                                        )}
                                        </div>
                                        {item.spot && (
                                            <div className="ci-item-edit">
                                                {(item.spot.images || []).filter(Boolean).slice(0, 2).map((src, k) => (
                                                    <img key={k} src={src} alt="" loading="lazy" className="ci-mini" />
                                                ))}
                                                <input type="text" value={item.description} data-item-description={`${i}:${j}`} onChange={(e) => setItemDescription(i, j, e.target.value)}
                                                    placeholder="항목 아래에 들어갈 한 줄 설명 (비워 두면 사진만)"
                                                    className="ci-input is-sm" />
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>

                            {(day.stayName || day.meals.breakfast || day.meals.lunch || day.meals.dinner) && (
                                <div className="ci-day-foot">
                                    {(day.meals.breakfast || day.meals.lunch || day.meals.dinner) && (
                                        <div className="ci-meta"><b>식사</b>{[day.meals.breakfast && `아침 ${day.meals.breakfast}`, day.meals.lunch && `점심 ${day.meals.lunch}`, day.meals.dinner && `저녁 ${day.meals.dinner}`].filter(Boolean).join(' · ')}</div>
                                    )}
                                    {day.stayName && (
                                        <div className="ci-meta">
                                            <b>숙소</b>
                                            <span className="ci-meta-text">
                                                {day.lodge ? day.lodge.name_kr : stayForPackage(day.stayName, pkg)}
                                                {day.lodge && day.lodge.name_kr !== day.stayName && <span className="ci-note">(코스: {day.stayName})</span>}
                                            </span>
                                            {lodgeThumb
                                                ? <span className="ci-count is-ok">사진 {(day.lodge ? day.lodge.images || [] : day.stayImages).filter(Boolean).length}장</span>
                                                : <span className="ci-count is-warn">사진 없음</span>}
                                            <button type="button" data-pick-lodge={i} onClick={() => setTarget({ kind: 'lodge', day: i })} className={lodgeThumb ? linkBtn : 'ci-need'}>
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

            <div className="ci-foot">
                <div className="ci-foot-text">
                    <div data-plan-summary className={emptyPhotoDays || emptyLodgings ? 'ci-summary is-warn' : 'ci-summary'}>
                        {emptyPhotoDays || emptyLodgings
                            ? [emptyPhotoDays && `사진이 없는 일차 ${emptyPhotoDays}개`, emptyLodgings && `사진 없는 숙소 ${emptyLodgings}개`].filter(Boolean).join(' · ')
                            : '모든 일차에 사진이 들어갑니다'}
                    </div>
                    <label className="ci-check">
                        <input type="checkbox" checked={includeMove} onChange={(e) => setIncludeMove(e.target.checked)} />
                        이동 시간·거리를 일차 소개에 넣기
                    </label>
                </div>
                <div className="ci-foot-acts">
                    <button type="button" onClick={() => setCourseName(null)} className="adm-btn">다른 코스</button>
                    <button type="button" data-course-submit disabled={needsPackage} title={needsPackage ? '여행 타입을 먼저 고르세요' : undefined}
                        onClick={() => onPick(planToBlocks(plan, { includeMove, packageType: pkg }), courseName, { packageType: pkg, pricing: hasPrice && withPrice && pricing.length ? pricing : null })}
                        className="adm-btn is-primary">
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
