import React, { useMemo, useState } from 'react';
import { IconCheck, IconSearch } from '@montage-ui/icon';
import { AdminBadge, AdminChipGroup, AdminDialog, AdminEmpty, AdminPickCard, AdminSearch, AdminTextButton } from '../ui';
import type { RegisteredLodge } from '../../../utils/registeredAssignmentResources';
import { NO_LODGE_REGION as NO_REGION, lodgeMatches, lodgeRegionOf, sameText } from './lodgeBoardModel';
import './LodgePicker.css';

/**
 * 숙소 고르기 — 배정 보드의 ‘숙소정보’ 칸.
 * 칸을 누르면 창이 열리고, 이름·지역·등급으로 찾거나 지역·등급 칩으로 좁혀서 고른다. 목록은 지역별로 묶는다.
 * 고른 숙소의 저장은 부르는 쪽(onPick)이 한다.
 */
const ALL = '__all__';

export interface LodgePickerProps {
    id: string;
    lodges: RegisteredLodge[];
    /** 등록 정보의 숙소 지역 순서 */
    regions: string[];
    /** 이 숙박의 숙소지역 — 처음 열 때 그 지역 칩을 고른다 */
    area: string;
    /** 창 제목 옆에 보일 숙박(예: 12.05 (토)) */
    nightLabel: string;
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

export function LodgePicker({ id, lodges, regions, area, nightLabel, currentId, currentName, manual, disabled, loading, onPick, onClear, onManual }: LodgePickerProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [region, setRegion] = useState(ALL);
    const [grade, setGrade] = useState(ALL);
    const current = lodges.find(l => (currentId ? l.id === currentId : sameText(l.name, currentName)));
    const hasLodge = !!currentName?.trim();

    const regionOrder = useMemo(() => {
        const found = [...new Set(lodges.map(lodgeRegionOf))];
        const known = regions.filter(r => found.includes(r));
        const rest = found.filter(r => !known.includes(r) && r !== NO_REGION).sort((a, b) => a.localeCompare(b, 'ko-KR'));
        const ordered = [...known, ...rest, ...(found.includes(NO_REGION) ? [NO_REGION] : [])];
        // 이 숙박 지역을 맨 앞에
        const mine = ordered.find(r => sameText(r, area));
        return mine ? [mine, ...ordered.filter(r => r !== mine)] : ordered;
    }, [lodges, regions, area]);

    const show = () => {
        if (disabled) return;
        setQuery('');
        setGrade(ALL);
        setRegion(regionOrder.find(r => sameText(r, area)) || ALL);
        setOpen(true);
    };
    const close = () => setOpen(false);

    const byText = lodges.filter(l => lodgeMatches(l, query));
    const inRegion = byText.filter(l => region === ALL || lodgeRegionOf(l) === region);
    const grades = [...new Set(lodges.map(l => l.type?.trim()).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'ko-KR'));
    const list = inRegion.filter(l => grade === ALL || sameText(l.type, grade));
    const groups = regionOrder
        .map(r => ({ region: r, items: list.filter(l => lodgeRegionOf(l) === r).sort((a, b) => a.name.localeCompare(b.name, 'ko-KR')) }))
        .filter(g => g.items.length);
    const first = groups[0]?.items[0];

    const pick = (lodge: RegisteredLodge) => { onPick(lodge); close(); };
    const regionItems = [
        { value: ALL, label: '전체', count: byText.length },
        ...regionOrder.map(r => ({ value: r, label: r, count: byText.filter(l => lodgeRegionOf(l) === r).length })),
    ];
    const gradeItems = [
        { value: ALL, label: '전체 등급', count: inRegion.length },
        ...grades.map(g => ({ value: g, label: g, count: inRegion.filter(l => sameText(l.type, g)).length })),
    ];

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

            <AdminDialog open={open} onClose={close} title={`숙소 고르기 · ${nightLabel}`} className="lp-dialog"
                description={`${area ? `숙소지역 ${area} · ` : ''}등록 숙소 ${lodges.length}곳`}
                footStart={<span className="lp-foot-actions">
                    {hasLodge && <AdminTextButton size="sm" tone="assistive" onClick={() => { onClear(); close(); }}>선택 해제(미배정)</AdminTextButton>}
                    <AdminTextButton size="sm" tone="primary" onClick={() => { onManual(); close(); }}>목록에 없는 숙소 직접 입력</AdminTextButton>
                </span>}
                cancelLabel="닫기">
                <div className="lp-tools">
                    <AdminSearch id={`${id}-q`} wide autoFocus value={query} onChange={setQuery} placeholder="숙소 이름·지역·등급으로 찾기"
                        aria-label="숙소 찾기" onKeyDown={e => { if (e.key === 'Enter' && first) { e.preventDefault(); pick(first); } }} />
                    <AdminChipGroup label="숙소 지역" items={regionItems} value={region} onChange={setRegion} />
                    {grades.length > 1 && <AdminChipGroup label="숙소 등급" items={gradeItems} value={grade} onChange={setGrade} />}
                </div>

                {!groups.length
                    ? <AdminEmpty title={lodges.length ? '찾는 숙소가 없어요.' : '등록된 숙소가 없어요.'}
                        description={lodges.length ? '검색어나 지역·등급을 바꿔 보거나, 목록에 없는 숙소는 직접 입력하세요.' : '가이드·숙소·차량의 등록 정보에서 숙소를 추가할 수 있어요.'}
                        action={<AdminTextButton size="sm" tone="primary" onClick={() => { onManual(); close(); }}>직접 입력</AdminTextButton>} />
                    : groups.map(g => (
                        <section key={g.region} className="lp-group" aria-label={`${g.region} 숙소`}>
                            <h4 className="lp-group-title">{g.region} <span className="lp-count">{g.items.length}곳</span>
                                {sameText(g.region, area) && <AdminBadge tone="info">이 숙박 지역</AdminBadge>}</h4>
                            <ul className="lp-list">
                                {g.items.map(l => {
                                    const selected = current?.id === l.id;
                                    return (
                                        <li key={l.id}>
                                            <AdminPickCard className="lp-item" selected={selected} onClick={() => pick(l)}>
                                                <span className="lp-item-main">
                                                    <b>{l.name}</b>
                                                    <span className="lp-sub">{[l.type, l.occupancy, l.address].filter(Boolean).join(' · ') || '등급 미정'}</span>
                                                </span>
                                                {selected && <IconCheck className="lp-check" aria-label="지금 고른 숙소" />}
                                            </AdminPickCard>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
            </AdminDialog>
        </>
    );
}
