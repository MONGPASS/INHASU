import React, { useMemo, useState } from 'react';
import { AdminBadge, AdminButton, AdminChip, AdminChipGroup, AdminDialog, AdminPickCard, AdminSearch, AdminTextButton, IconSearch } from '../ui';
import type { RegisteredLodge } from '../../../utils/registeredAssignmentResources';
import {
    LODGE_GRADE_GROUPS, LODGE_ZONES, OTHER_LODGE_ZONE, lodgeGradeGroupOf, lodgeMatches, lodgeRegionOf, lodgeZoneOf, sameText,
    type LodgeGradeGroup,
} from './lodgeBoardModel';
import './LodgePicker.css';

/**
 * 숙소 고르기 — 배정 보드의 ‘숙소정보’ 칸(Claude Design ‘숙소 배정 · 현지 운영’ HotelPicker).
 * 칸을 누르면 넓은 창: 위 찾기(모든 지역에서) · 왼쪽 지역 메뉴(묶음별, 숙소 수) · 오른쪽 숙소 목록(등급 칩, 자주 쓴 숙소, 동그라미 줄).
 * 줄을 눌러 고른 뒤 ‘이 숙소로 배정’을 눌러야 칸에 들어간다. 저장은 부르는 쪽(onPick)과 배정 저장 버튼이 한다.
 */
const ALL = '__all__';
const PAGE = 30;
type Grade = LodgeGradeGroup | typeof ALL;
const GRADE_TONE: Record<LodgeGradeGroup, 'info' | 'neutral'> = { 호텔: 'neutral', 고급게르: 'info', 일반게르: 'neutral', 기타: 'neutral' };

export interface LodgePickerProps {
    id: string;
    lodges: RegisteredLodge[];
    /** 등록 정보의 숙소 지역 순서 */
    regions: string[];
    /** 이 숙박의 숙소지역 — 처음 열 때 그 지역을 고르고 ‘숙소지역’ 표시를 단다 */
    area: string;
    /** 창 제목 옆 숙박(예: 12.05 (토)) */
    nightLabel: string;
    /** 창 제목 아래 한 줄(예: 강톨가 #18 · 1박째 · 6명 · 숙소지역 UB) */
    context?: string;
    /** 숙소 이름(소문자) → 불러온 예약에서 배정된 숙박 수. ‘자주 쓴 숙소’에 쓴다 */
    usage?: Record<string, number>;
    /** 지금 고른 숙소(등록 숙소면 id) */
    currentId?: string;
    currentName?: string;
    /** 직접 입력한 숙소인지 */
    manual: boolean;
    disabled?: boolean;
    loading?: boolean;
    onPick: (lodge: RegisteredLodge) => void;
    onClear: () => void;
    onManual: () => void;
}

export function LodgePicker({ id, lodges, regions, area, nightLabel, context, usage = {}, currentId, currentName, manual, disabled, loading, onPick, onClear, onManual }: LodgePickerProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [region, setRegion] = useState<string>(ALL);
    const [grade, setGrade] = useState<Grade>(ALL);
    const [picked, setPicked] = useState('');
    const [limit, setLimit] = useState(PAGE);
    const current = lodges.find(l => (currentId ? l.id === currentId : sameText(l.name, currentName)));
    const hasLodge = !!currentName?.trim();

    /** 지역 메뉴: 묶음 순서 → 등록 정보 순서 → 이름 */
    const zones = useMemo(() => {
        const counts = new Map<string, number>();
        lodges.forEach(l => { const r = lodgeRegionOf(l); counts.set(r, (counts.get(r) || 0) + 1); });
        const known = (r: string) => { const i = regions.findIndex(x => sameText(x, r)); return i < 0 ? Number.MAX_SAFE_INTEGER : i; };
        const names = [...counts.keys()].sort((a, b) => known(a) - known(b) || a.localeCompare(b, 'ko-KR'));
        return [...LODGE_ZONES.map(z => z.title), OTHER_LODGE_ZONE]
            .map(title => ({ title, regions: names.filter(r => lodgeZoneOf(r) === title).map(r => ({ name: r, count: counts.get(r) || 0 })) }))
            .filter(z => z.regions.length);
    }, [lodges, regions]);
    const areaRegion = zones.flatMap(z => z.regions).find(r => sameText(r.name, area))?.name;

    const show = () => {
        if (disabled || loading) return;
        setQuery(''); setGrade(ALL); setLimit(PAGE);
        setRegion(areaRegion || ALL);
        setPicked(current?.id || '');
        setOpen(true);
    };
    const close = () => setOpen(false);

    const searching = query.trim().length > 0;
    const byPlace = searching ? lodges.filter(l => lodgeMatches(l, query)) : lodges.filter(l => region === ALL || lodgeRegionOf(l) === region);
    const regionOrder = zones.flatMap(z => z.regions.map(r => r.name));
    const list = byPlace
        .filter(l => grade === ALL || lodgeGradeGroupOf(l.type) === grade)
        .sort((a, b) => regionOrder.indexOf(lodgeRegionOf(a)) - regionOrder.indexOf(lodgeRegionOf(b)) || a.name.localeCompare(b.name, 'ko-KR'));
    const shown = list.slice(0, limit);
    const showRegion = searching || region === ALL;
    const frequent = searching ? [] : byPlace
        .map(l => ({ l, n: usage[l.name.trim().toLowerCase()] || 0 }))
        .filter(x => x.n > 0)
        .sort((a, b) => b.n - a.n || a.l.name.localeCompare(b.l.name, 'ko-KR'))
        .slice(0, 3);
    const pickedLodge = lodges.find(l => l.id === picked);

    const confirm = () => { if (pickedLodge) { onPick(pickedLodge); close(); } };
    const changeRegion = (next: string) => { setRegion(next); setLimit(PAGE); };
    const changeGrade = (next: Grade) => { setGrade(next); setLimit(PAGE); };

    const title = loading ? '등록 숙소를 불러오는 중…' : hasLodge ? (manual ? `직접 입력: ${currentName}` : currentName) : '숙소를 선택해 주세요';
    const sub = hasLodge && current ? [lodgeRegionOf(current), current.type].filter(Boolean).join(' · ') : hasLodge && manual ? '등록 숙소에 없는 숙소' : `등록 숙소 ${lodges.length}곳 · 눌러서 찾기`;

    return (
        <>
            <AdminPickCard className="lp-trigger" disabled={disabled || loading} onClick={show} aria-label={`숙소정보: ${hasLodge ? currentName : '미배정'} — 숙소 고르기`}>
                <span className="lp-trigger-main">
                    <b className={hasLodge ? '' : 'is-empty'}>{title}</b>
                    <span className="lp-sub">{sub}</span>
                </span>
                <IconSearch className="lp-trigger-icon" aria-hidden="true" />
            </AdminPickCard>

            <AdminDialog open={open} onClose={close} size="lg" flush className="lp-dialog"
                title={`숙소 고르기 · ${nightLabel}`} description={context}
                footStart={<>
                    <AdminTextButton size="sm" tone="primary" onClick={() => { onManual(); close(); }}>목록에 없는 숙소 직접 입력</AdminTextButton>
                    {hasLodge && <AdminTextButton size="sm" tone="assistive" onClick={() => { onClear(); close(); }}>선택 해제(미배정)</AdminTextButton>}
                </>}
                footNote={pickedLodge ? <b className="lp-picked">선택: {[pickedLodge.name, lodgeRegionOf(pickedLodge), pickedLodge.type].filter(Boolean).join(' · ')}</b> : '아직 고른 숙소가 없습니다'}
                onSubmit={confirm} submitLabel={pickedLodge ? '이 숙소로 배정' : '숙소를 골라 주세요'} submitDisabled={!pickedLodge} cancelLabel="닫기">
                <div className="lp-search">
                    <AdminSearch id={`${id}-q`} wide size="lg" autoFocus value={query} onChange={value => { setQuery(value); setLimit(PAGE); }}
                        placeholder="숙소 이름이나 주소로 찾기 · 모든 지역에서 찾습니다" aria-label="숙소 찾기"
                        onKeyDown={e => { if (e.key === 'Enter' && list[0]) { e.preventDefault(); setPicked(list[0].id); } }} />
                </div>

                <div className="lp-body">
                    <nav className="lp-nav" aria-label="지역">
                        <AdminPickCard variant="nav" selected={!searching && region === ALL} onClick={() => { setQuery(''); changeRegion(ALL); }}>
                            <span className="lp-nav-label">전체</span><span className="lp-nav-count">{lodges.length}</span>
                        </AdminPickCard>
                        {zones.map(z => (
                            <div key={z.title} className="lp-zone" role="group" aria-label={z.title}>
                                <span className="lp-zone-title">{z.title}</span>
                                {z.regions.map(r => (
                                    <AdminPickCard key={r.name} variant="nav" selected={!searching && region === r.name} onClick={() => { setQuery(''); changeRegion(r.name); }}>
                                        <span className="lp-nav-label">
                                            <span className="lp-nav-name">{r.name}</span>
                                            {r.name === areaRegion && <AdminBadge tone="info">숙소지역</AdminBadge>}
                                        </span>
                                        <span className="lp-nav-count">{r.count}</span>
                                    </AdminPickCard>
                                ))}
                            </div>
                        ))}
                    </nav>

                    <section className="lp-main" aria-label="숙소 목록">
                        <div className="lp-main-head">
                            <h3>{searching ? '검색 결과' : region === ALL ? '전체' : region} <span className="lp-count">{list.length}곳</span></h3>
                            <AdminChipGroup label="숙소 등급" value={grade} onChange={changeGrade}
                                items={[{ value: ALL as Grade, label: '전체 등급' }, ...LODGE_GRADE_GROUPS.map(g => ({ value: g.value as Grade, label: g.label }))]} />
                        </div>

                        {frequent.length > 0 && <div className="lp-frequent" role="group" aria-label="자주 쓴 숙소">
                            <span className="lp-frequent-title">{region === ALL ? '자주 쓴 숙소' : '이 지역에서 자주 쓴 숙소'}</span>
                            {frequent.map(({ l }) => <AdminChip key={l.id} active={picked === l.id} onClick={() => setPicked(l.id)}>{l.name}</AdminChip>)}
                        </div>}

                        <div className="lp-scroll">
                            {!list.length
                                ? <div className="lp-empty">
                                    <b>조건에 맞는 숙소가 없습니다</b>
                                    <span className="lp-sub">{lodges.length ? '등급을 전체로 바꾸거나, 목록에 없는 숙소를 직접 입력해 주세요.' : '가이드·숙소·차량의 등록 정보에서 숙소를 추가할 수 있어요.'}</span>
                                </div>
                                : <ul className="lp-list">
                                    {shown.map(l => {
                                        const group = lodgeGradeGroupOf(l.type);
                                        return (
                                            <li key={l.id}>
                                                <AdminPickCard variant="row" selected={picked === l.id} onClick={() => setPicked(l.id)}>
                                                    <span className="lp-item-main">
                                                        <b>{l.name}</b>
                                                        <span className="lp-sub">{l.address || lodgeRegionOf(l)}</span>
                                                    </span>
                                                    {showRegion && <span className="lp-item-region">{lodgeRegionOf(l)}</span>}
                                                    <AdminBadge tone={GRADE_TONE[group]}>{l.type || '등급 미정'}</AdminBadge>
                                                </AdminPickCard>
                                            </li>
                                        );
                                    })}
                                </ul>}
                            {list.length > shown.length && <AdminButton variant="weak" size="sm" className="lp-more" onClick={() => setLimit(n => n + PAGE)}>{list.length - shown.length}곳 더 보기</AdminButton>}
                        </div>
                    </section>
                </div>
            </AdminDialog>
        </>
    );
}
