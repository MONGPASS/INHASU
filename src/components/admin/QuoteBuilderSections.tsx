import React, { useMemo, useState } from 'react';
import {
    AdminBadge, AdminButton, AdminChipGroup, AdminField, AdminIconButton, AdminMenu, AdminPickCard, AdminSearch, AdminTextArea, AdminTextButton, AdminTextInput,
    IconCheck, IconChevronDown, IconChevronLeft, IconChevronUp, IconClock, IconClose, IconCopy, IconGrip, IconListCategory, IconMap, IconMoreHorizontal, IconPlus, IconTrash, IconWarning,
    type AdminMenuItem,
} from './ui';
import { INTENSITY_DESC, ROOM_ECO, ROOM_FULL, balEco, balFull, dayDateStr, nightsOf, type Json, type QuoteDay, type QuoteState } from './quoteBuilder';
import {
    BUILDER_SECTIONS, courseRegions, courseRows, dayEmpty, mealsFromText, mealsText, snippetGroups, spotRegions, spotRows, tripLength,
    type BuilderCheck, type BuilderSectionId, type RequestItem,
} from './quoteBuilderView';

/**
 * 견적서 만들기 화면 부품(2026-11-26 Claude Design ‘견적서 만들기 개선’ — 고객 요청 있을 때 / 직접 만들 때).
 * 한 화면에 섹션 6개를 차례로 두고, 위 단계 줄은 그 섹션으로 옮겨 간다. 값 계산은 quoteBuilderView.ts, 저장은 AdminQuoteBuilder.tsx.
 * 모양은 AdminQuoteBuilder.css(qbd-*)와 우리 관리자 부품이 정한다.
 */

type Patch = (next: Partial<QuoteState>) => void;
const won = (n: number) => `${(n || 0).toLocaleString('ko-KR')}원`;

/** 섹션 틀: 제목 · 설명 · 오른쪽 단추 */
export function BuilderSection({ id, title, count, help, actions, children }: { id: BuilderSectionId; title: string; count?: React.ReactNode; help?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section id={id} className="qbd-sec" aria-labelledby={`${id}-title`}>
            <div className="qbd-sec-head">
                <div className="qbd-sec-title">
                    <h2 id={`${id}-title`}>{title}{count != null && <span className="qbd-sec-count">{count}</span>}</h2>
                    {help && <p>{help}</p>}
                </div>
                {actions && <div className="qbd-sec-actions">{actions}</div>}
            </div>
            {children}
        </section>
    );
}

function Text({ label, value, onChange, hint, placeholder, type = 'text', trailing, maxLength, className }: {
    label: string; value: string | number; onChange: (value: string) => void; hint?: React.ReactNode; placeholder?: string; type?: string; trailing?: React.ReactNode; maxLength?: number; className?: string;
}) {
    return (
        <AdminField label={label} hint={hint} className={className}>
            {(id, describedBy) => <AdminTextInput id={id} aria-describedby={describedBy} type={type} placeholder={placeholder} trailing={trailing} maxLength={maxLength}
                value={String(value ?? '')} onChange={e => onChange(e.target.value)} />}
        </AdminField>
    );
}

// ── 머리 줄 ────────────────────────────────────────────────
export function BuilderHead({ backTo, name, badge, meta, status, menu }: { backTo?: string; name: string; badge: string; meta: string; status: string; menu: AdminMenuItem[] }) {
    return (
        <header className="qbd-head">
            {backTo && <><AdminTextButton tone="assistive" size="sm" to={backTo} leading={<IconChevronLeft />}>고객 현황</AdminTextButton><span className="qbd-head-rule" aria-hidden="true" /></>}
            <div className="qbd-head-main">
                <div className="qbd-head-name"><h1>{name}</h1><AdminBadge tone="neutral" size="sm">{badge}</AdminBadge></div>
                <p>{meta}</p>
            </div>
            {status && <span className="qbd-head-status"><IconClock aria-hidden="true" />{status}</span>}
            <AdminMenu label="견적서 더보기" items={menu}
                trigger={<AdminIconButton label="더보기" variant="outlined" size="sm"><IconMoreHorizontal /></AdminIconButton>} />
        </header>
    );
}

// ── 위 단계 줄(화면을 내려도 위에 붙는다) ─────────────────────
export function BuilderStepNav({ marks, active, onGo }: { marks: Record<BuilderSectionId, { done: boolean; note: string }>; active: BuilderSectionId; onGo: (id: BuilderSectionId) => void }) {
    const done = BUILDER_SECTIONS.filter(s => marks[s.id].done).length;
    return (
        <nav className="qbd-steps" aria-label="견적서 작성 단계">
            <div className="qbd-steps-row">
                {BUILDER_SECTIONS.map((s, i) => (
                    <a key={s.id} href={`#${s.id}`} className={s.id === active ? 'is-active' : undefined} aria-current={s.id === active ? 'location' : undefined}
                        onClick={e => { e.preventDefault(); onGo(s.id); }}>
                        <span>{i + 1}. {s.label}</span>
                        {marks[s.id].done && <IconCheck className="qbd-ok" aria-label="완료" />}
                        {!marks[s.id].done && marks[s.id].note && <b>{marks[s.id].note}</b>}
                    </a>
                ))}
                <span className="qbd-steps-count">{BUILDER_SECTIONS.length}단계 중 {done}단계 완료</span>
            </div>
        </nav>
    );
}

// ── 1. 기본 정보 ────────────────────────────────────────────
export function BasicSection({ st, patch, setDates, autoNo }: { st: QuoteState; patch: Patch; setDates: (depart: string, return_: string) => void; autoNo: string }) {
    const [flightOpen, setFlightOpen] = useState(() => !!(st.flightIn || st.flightOut || st.pickup || st.drop || st.paxNote || st.quoteNo));
    const n = nightsOf(st);
    const length = tripLength(st);
    const endHint = n !== null && n <= 0 ? '종료일이 시작일보다 빨라요'
        : length ? `${length} · 일정 ${st.days.length}일${st.days.length !== n! + 1 ? ` — ${n! + 1}일이 필요해요` : ''}` : '시작일·종료일을 넣으면 일정 칸 수가 맞춰져요';
    return (
        <BuilderSection id="qb-basic" title="기본 정보" help="고객과 여행 정보를 입력해요. 종료일을 넣으면 일자별 일정이 자동으로 맞춰져요.">
            <div className="qbd-group">
                <h3>고객</h3>
                <div className="qbd-fields">
                    <Text label="고객명" value={st.customer} placeholder="예) 강민지" onChange={v => patch({ customer: v })} />
                    <Text label="연락처" value={st.phone} type="tel" placeholder="01012345678" onChange={v => patch({ phone: v })} />
                    <Text label="예약자 이메일" value={st.email} type="email" maxLength={120} placeholder="name@example.com" hint="Google 계정이면 고객 마이페이지에 표시돼요" onChange={v => patch({ email: v })} />
                </div>
            </div>
            <div className="qbd-group">
                <h3>여행</h3>
                <div className="qbd-fields">
                    <Text label="여행지" value={st.destination} placeholder="예) 고비" onChange={v => patch({ destination: v })} />
                    <Text label="인원" value={st.pax} type="number" trailing="명" onChange={v => patch({ pax: parseInt(v) || 0 })} />
                    <Text label="차량" value={st.vehicle} placeholder="예) 스타렉스 (6인)" onChange={v => patch({ vehicle: v })} />
                    <Text label="투어 시작일" value={st.depart} type="date" onChange={v => setDates(v, st.return_)} />
                    <Text label="투어 종료일" value={st.return_} type="date" hint={endHint} onChange={v => setDates(st.depart, v)} />
                    <Text label="담당자" value={st.manager} placeholder="예) 볼라" onChange={v => patch({ manager: v })} />
                </div>
                <div className="qbd-intensity">
                    <span className="qbd-label">여행 강도</span>
                    <AdminChipGroup label="여행 강도" value={String(st.intensity)} onChange={v => patch({ intensity: Number(v) })}
                        items={[1, 2, 3, 4, 5].map(i => ({ value: String(i), label: i === 1 ? '1 쉬움' : i === 3 ? '3 보통' : i === 5 ? '5 힘듦' : String(i) }))} />
                    <span className="qbd-muted">견적서에 점 5개 중 {st.intensity}개로 표시돼요 · {INTENSITY_DESC[st.intensity] || ''}</span>
                </div>
            </div>
            <div className="qbd-group">
                <div className="qbd-group-head">
                    <h3>항공 · 픽업 · 문서번호 <span>(선택)</span></h3>
                    <AdminTextButton tone="assistive" size="sm" aria-expanded={flightOpen} onClick={() => setFlightOpen(o => !o)}
                        trailing={flightOpen ? <IconChevronUp /> : <IconChevronDown />}>{flightOpen ? '접기' : '펼치기'}</AdminTextButton>
                </div>
                {flightOpen && <div className="qbd-fields">
                    <Text label="항공 IN" value={st.flightIn} placeholder="예) 11/26 04:30 OM302" onChange={v => patch({ flightIn: v })} />
                    <Text label="항공 OUT" value={st.flightOut} placeholder="예) 11/28 18:15 OM301" onChange={v => patch({ flightOut: v })} />
                    <Text label="인원 표기" value={st.paxNote} placeholder="예) 6인 (남2/여4)" hint={`비우면 '${st.pax}인'으로 표시돼요`} onChange={v => patch({ paxNote: v })} />
                    <Text label="픽업" value={st.pickup} placeholder="비우면 '항공 IN + 공항'" hint="항공 IN 기준으로 자동 입력돼요" onChange={v => patch({ pickup: v })} />
                    <Text label="드랍" value={st.drop} placeholder="비우면 '항공 OUT + 공항'" hint="항공 OUT 기준으로 자동 입력돼요" onChange={v => patch({ drop: v })} />
                    <Text label="문서번호" value={st.quoteNo} placeholder={autoNo} hint="비우면 자동 번호" onChange={v => patch({ quoteNo: v })} />
                </div>}
            </div>
        </BuilderSection>
    );
}

// ── 2. 코스 ────────────────────────────────────────────────
export function CourseSection({ courses, sorted, picked, length, help, onPick, onClone }: {
    courses: Record<string, Json>; sorted: Array<[string, Json]>; picked: string; length: string; help: boolean; onPick: (name: string) => void; onClone: () => void;
}) {
    const [open, setOpen] = useState(!picked);
    const [region, setRegion] = useState('all');
    const [query, setQuery] = useState('');
    const rows = useMemo(() => courseRows(sorted, { region, query, length }), [sorted, region, query, length]);
    const regions = useMemo(() => courseRegions(sorted), [sorted]);
    const applied = picked ? courses[picked] : null;
    const appliedRow = applied ? courseRows([[picked, applied]], { region: 'all', query: '', length })[0] : null;
    return (
        <BuilderSection id="qb-course" title="코스" help={help ? '코스를 고르면 일정·명소·기본 요금이 한 번에 채워져요. 이후 각 섹션에서 고칠 수 있어요.' : undefined}
            actions={<AdminTextButton size="sm" leading={<IconCopy />} onClick={onClone}>다른 견적에서 복제</AdminTextButton>}>
            <div className="qbd-applied">
                {appliedRow ? <IconCheck className="qbd-ok" aria-hidden="true" /> : <IconWarning className="qbd-warn-icon" aria-hidden="true" />}
                <div className="qbd-applied-text">
                    <b>{appliedRow ? picked : '코스를 고르지 않았어요'}</b>
                    <span>{appliedRow ? [appliedRow.region, appliedRow.length, appliedRow.match ? '여행 기간과 일치' : ''].filter(Boolean).join(' · ') : '직접 작성하거나 아래에서 코스를 골라 주세요'}</span>
                </div>
                <AdminButton variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? '닫기' : picked ? '코스 변경' : '코스 고르기'}</AdminButton>
            </div>
            {open && <div className="qbd-pick-panel">
                <div className="qbd-pick-tools">
                    <AdminSearch value={query} onChange={setQuery} placeholder="코스 검색 (예: 온천, 승마)" aria-label="코스 이름 검색" />
                    <AdminChipGroup label="코스 지역" value={region} onChange={setRegion} items={regions.map(r => ({ value: r.value, label: r.label, count: r.count }))} />
                </div>
                {rows.length ? <div className="qbd-course-grid">
                    {rows.map(r => (
                        <AdminPickCard key={r.name} selected={r.name === picked} className="qbd-course" onClick={() => { onPick(r.name); setOpen(false); }}>
                            <span className="qbd-course-name">{r.name}</span>
                            <span className={r.match ? 'qbd-course-len is-match' : 'qbd-course-len'}>{r.length}</span>
                        </AdminPickCard>
                    ))}
                </div> : <p className="qbd-empty">{sorted.length ? '맞는 코스가 없어요. 다른 지역을 고르거나 검색어를 바꿔 보세요.' : '등록된 코스가 없어요. 견적 관리 → 코스 관리에서 추가해 주세요.'}</p>}
                <span className="qbd-muted">{length ? `여행 기간(${length})과 맞는 코스가 먼저 나와요. ` : ''}고르면 일정·명소·기본 요금이 채워져요.</span>
            </div>}
        </BuilderSection>
    );
}

// ── 3. 일자별 일정 ──────────────────────────────────────────
export function DaysSection({ days, depart, snippets, snippetCats, help, onField, onSnippet, onDelete, onReorder, onAdd }: {
    days: QuoteDay[]; depart: string; snippets: Record<string, Json>; snippetCats: string[]; help: boolean;
    onField: (index: number, field: 'dest' | 'move' | 'dist' | 'date' | 'items' | 'stay' | 'meals', value: unknown) => void;
    onSnippet: (index: number, name: string) => void; onDelete: (index: number) => void; onReorder: (from: number, to: number) => void; onAdd: () => void;
}) {
    const [openDay, setOpenDay] = useState(0);
    const [picker, setPicker] = useState(-1);
    const [pickQuery, setPickQuery] = useState('');
    const [pickCat, setPickCat] = useState('all');
    const [loaded, setLoaded] = useState<Record<number, string>>({});
    const [drag, setDrag] = useState(-1);
    const filled = days.filter(day => !dayEmpty(day)).length;
    const groups = useMemo(() => snippetGroups(snippets, snippetCats, { cat: pickCat, query: pickQuery }), [snippets, snippetCats, pickCat, pickQuery]);
    const cats = useMemo(() => snippetGroups(snippets, snippetCats, { cat: 'all', query: '' }), [snippets, snippetCats]);
    const load = (i: number, name: string) => { onSnippet(i, name); setLoaded(m => ({ ...m, [i]: name })); setPicker(-1); setOpenDay(i); };
    return (
        <BuilderSection id="qb-days" title="일자별 일정" count={`${days.length}일 중 ${filled}일 작성`}
            help={help ? "일자마다 '일정 불러오기'에서 고르면 목적지·숙소·세부 일정이 한 번에 채워져요. 줄 앞에 *를 쓰면 강조, (를 쓰면 회색으로 표시돼요." : undefined}
            actions={<AdminTextButton size="sm" leading={<IconPlus />} onClick={() => { onAdd(); setOpenDay(days.length); }}>일자 추가</AdminTextButton>}>
            {days.length ? <div className="qbd-days">
                {days.map((day, i) => {
                    const label = `${i + 1}일차`, open = openDay === i;
                    const date = String(day.date || '') || dayDateStr(depart, i);
                    return (
                        <div key={i} className={`qbd-day${open ? ' is-open' : ''}${drag === i ? ' is-dragging' : ''}`}
                            onDragOver={e => { if (drag >= 0) e.preventDefault(); }}
                            onDrop={e => { e.preventDefault(); if (drag >= 0 && drag !== i) { onReorder(drag, i); setOpenDay(i); setLoaded({}); } setDrag(-1); }}>
                            <div className="qbd-day-row">
                                <span className="qbd-grip" draggable title="끌어서 순서 바꾸기" aria-hidden="true"
                                    onDragStart={e => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDrag(-1)}><IconGrip /></span>
                                <span className="qbd-day-no">{label}</span>
                                <span className={day.date ? 'qbd-day-date' : 'qbd-day-date is-auto'}>{date || '날짜 없음'}</span>
                                <AdminTextInput className="qbd-day-dest" aria-label={`${label} 목적지`} placeholder="목적지 (예: 울란바타르 / 볼강)" value={String(day.dest || '')} onChange={e => onField(i, 'dest', e.target.value)} />
                                <AdminTextInput className="qbd-day-move" aria-label={`${label} 이동 시간`} placeholder="이동 시간" value={String(day.move || '')} onChange={e => onField(i, 'move', e.target.value)} />
                                <AdminTextButton tone="assistive" size="sm" aria-expanded={open} onClick={() => { setOpenDay(open ? -1 : i); setPicker(-1); }}
                                    trailing={open ? <IconChevronUp /> : <IconChevronDown />}>{open ? '접기' : '펼치기'}</AdminTextButton>
                                <AdminIconButton label={`${label} 삭제`} size="sm" onClick={() => { onDelete(i); setOpenDay(-1); setLoaded({}); }}><IconTrash /></AdminIconButton>
                            </div>
                            {open && <div className="qbd-day-body">
                                <div className="qbd-load">
                                    <AdminButton variant="secondary" className="qbd-load-btn" aria-expanded={picker === i} aria-label={`${label} 일정 불러오기`}
                                        leading={<IconListCategory />} trailing={picker === i ? <IconChevronUp /> : <IconChevronDown />}
                                        onClick={() => { setPicker(picker === i ? -1 : i); setPickQuery(''); }}>{loaded[i] || '일정 불러오기 · 목록에서 선택'}</AdminButton>
                                    <span className="qbd-muted">클릭 한 번에 이 일자를 채워요. 없으면 아래에 직접 작성해 주세요.</span>
                                </div>
                                {picker === i && <div className="qbd-picker">
                                    <div className="qbd-picker-tools">
                                        <AdminSearch value={pickQuery} onChange={setPickQuery} placeholder="일정 이름 검색 (예: 테를지)" aria-label="일정 이름 검색" />
                                        <AdminChipGroup label="일정 지역" value={pickCat} onChange={setPickCat}
                                            items={[{ value: 'all', label: '전체' }, ...cats.map(g => ({ value: g.cat, label: g.name, count: g.items.length }))]} />
                                        <AdminIconButton label="일정 불러오기 닫기" size="sm" onClick={() => setPicker(-1)}><IconClose /></AdminIconButton>
                                    </div>
                                    <div className="qbd-picker-list">
                                        {groups.map(g => (
                                            <div key={g.cat} className="qbd-picker-group">
                                                <span className="qbd-picker-cat">{g.name} · {g.items.length}</span>
                                                <div className="qbd-picker-grid">
                                                    {g.items.map(name => (
                                                        <AdminPickCard key={name} variant="row" selected={loaded[i] === name} onClick={() => load(i, name)}>
                                                            <span className="qbd-picker-name">{name}</span>
                                                        </AdminPickCard>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                        {!groups.length && <p className="qbd-empty">{Object.keys(snippets).length ? '맞는 일정이 없어요. 검색어를 바꾸거나 직접 작성해 주세요.' : '등록된 일정이 없어요. 견적 관리 → 일정 관리에서 추가해 주세요.'}</p>}
                                    </div>
                                </div>}
                                <AdminField label="세부 일정" hint="한 줄에 하나씩 적어 주세요. *로 시작하면 강조, (로 시작하면 회색">
                                    {(id, describedBy) => <AdminTextArea id={id} aria-describedby={describedBy} minRows={4} placeholder="한 줄에 하나씩 적어 주세요"
                                        value={(day.items || []).join('\n')} onChange={e => onField(i, 'items', e.target.value.split('\n'))} />}
                                </AdminField>
                                <div className="qbd-fields">
                                    <Text label="일정표 숙소" value={String(day.stay?.name || '')} placeholder="예) 3성급/4성급" onChange={v => onField(i, 'stay', { name: v })} />
                                    <Text label="식사" value={mealsText(day.meals)} placeholder="예) x, 중식, 석식" hint="조식, 중식, 석식 순서로 쉼표로 나눠 적어요. 없으면 x"
                                        onChange={v => onField(i, 'meals', mealsFromText(v))} />
                                    <Text label="이동 거리" value={String(day.dist || '')} placeholder="예) 120km" onChange={v => onField(i, 'dist', v)} />
                                    <Text label="날짜 표기" value={String(day.date || '')} placeholder={dayDateStr(depart, i) || '예) 07.20(월)'} hint="비우면 시작일 기준으로 채워요"
                                        onChange={v => onField(i, 'date', v)} />
                                </div>
                            </div>}
                        </div>
                    );
                })}
            </div> : <p className="qbd-empty">아직 일정이 없어요. 코스를 고르거나 ‘일자 추가’로 만들어 주세요.</p>}
        </BuilderSection>
    );
}

// ── 4. 요금 ────────────────────────────────────────────────
export function PriceSection({ st, patch }: { st: QuoteState; patch: Patch }) {
    const [optionDraft, setOptionDraft] = useState({ label: '', calc: '' });
    const rows = st.balances.slice().sort((a, b) => a.pax - b.pax);
    const setBalance = (pax: number, key: 'economy' | 'full', value: string) => patch({ balances: st.balances.map(b => b.pax === pax ? { ...b, [key]: parseInt(value) || 0 } : b) });
    const addPax = () => {
        const has = new Set(st.balances.map(b => b.pax));
        let pax = has.has(st.pax) || !st.pax ? Math.max(0, ...st.balances.map(b => b.pax)) + 1 : st.pax;
        while (has.has(pax)) pax++;
        patch({ balances: [...st.balances, { pax, economy: 0, full: 0 }] });
    };
    const addOption = () => {
        const label = optionDraft.label.trim(), calc = optionDraft.calc.trim();
        if (!label) return;
        patch({ options: [...st.options, { label, calc }] }); setOptionDraft({ label: '', calc: '' });
    };
    return (
        <BuilderSection id="qb-price" title="요금" help="인원과 숙소 기준을 바꾸면 예상 총액이 바로 다시 계산돼요.">
            <div className="qbd-price-top">
                <Text label="예약금 (1인)" className="qbd-deposit" value={st.deposit} type="number" trailing="원" onChange={v => patch({ deposit: parseInt(v) || 0 })} />
                <div className="qbd-basis">
                    <span className="qbd-label">총액 계산 기준</span>
                    <AdminChipGroup label="총액 계산 기준" value={st.roomType === ROOM_FULL ? ROOM_FULL : ROOM_ECO} onChange={v => patch({ roomType: v })}
                        items={[{ value: ROOM_ECO, label: '실속형 · 일반 게르' }, { value: ROOM_FULL, label: '풀패키지 · 고급 게르' }]} />
                </div>
            </div>
            <div className="qbd-block">
                <h3>인원별 1인 잔금</h3>
                <div className="qbd-tiers" role="group" aria-label="인원별 1인 잔금">
                    <div className="qbd-tier is-head" aria-hidden="true"><span>인원</span><span>실속형 · 일반 게르</span><span>풀패키지 · 고급 게르</span><span /></div>
                    {rows.map(b => (
                        <div key={b.pax} className={b.pax === st.pax ? 'qbd-tier is-current' : 'qbd-tier'}>
                            <span className="qbd-tier-pax"><b>{b.pax}인</b>{b.pax === st.pax && <small>현재 인원</small>}</span>
                            <AdminTextInput aria-label={`${b.pax}인 실속형 잔금`} type="number" step={1000} trailing="원" value={String(balEco(b))} onChange={e => setBalance(b.pax, 'economy', e.target.value)} />
                            <AdminTextInput aria-label={`${b.pax}인 풀패키지 잔금`} type="number" step={1000} trailing="원" value={String(balFull(b))} onChange={e => setBalance(b.pax, 'full', e.target.value)} />
                            <AdminIconButton label={`${b.pax}인 행 삭제`} size="sm" onClick={() => patch({ balances: st.balances.filter(x => x.pax !== b.pax) })}><IconClose /></AdminIconButton>
                        </div>
                    ))}
                    {!rows.length && <p className="qbd-empty">인원별 잔금이 없어요. ‘인원 추가’로 넣어 주세요.</p>}
                    <div className="qbd-tier-add"><AdminTextButton size="sm" leading={<IconPlus />} onClick={addPax}>인원 추가</AdminTextButton></div>
                </div>
            </div>
            <div className="qbd-block">
                <h3>추가 · 할인 안내</h3>
                <p className="qbd-muted">견적서에 안내로만 표시되고 총액에는 더해지지 않아요.</p>
                <div className="qbd-options">
                    {st.options.map((o, i) => (
                        <div key={i} className="qbd-option">
                            <span>{o.label}</span><b>{o.calc || ''}</b>
                            <AdminIconButton label={`${o.label} 삭제`} size="sm" onClick={() => patch({ options: st.options.filter((_, j) => j !== i) })}><IconClose /></AdminIconButton>
                        </div>
                    ))}
                    <div className="qbd-option-add">
                        <AdminTextInput aria-label="항목" placeholder="항목 (예: 게르 업그레이드)" value={optionDraft.label} onChange={e => setOptionDraft(d => ({ ...d, label: e.target.value }))} />
                        <AdminTextInput aria-label="금액 안내" placeholder="금액 안내 (예: 50,000원×1박)" value={optionDraft.calc} onChange={e => setOptionDraft(d => ({ ...d, calc: e.target.value }))} />
                        <AdminButton variant="secondary" size="sm" disabled={!optionDraft.label.trim()} onClick={addOption}>추가</AdminButton>
                    </div>
                </div>
            </div>
        </BuilderSection>
    );
}

// ── 5. 대표 명소 ────────────────────────────────────────────
export function SpotsSection({ spots, spotCats, selected, onToggle, onClear, onReorder, onMap }: {
    spots: Record<string, Json>; spotCats: string[]; selected: string[]; onToggle: (name: string) => void; onClear: () => void; onReorder: (from: number, to: number) => void; onMap: () => void;
}) {
    const regions = useMemo(() => spotRegions(spots, spotCats), [spots, spotCats]);
    const [region, setRegion] = useState('all');
    const [query, setQuery] = useState('');
    const [drag, setDrag] = useState(-1);
    const list = useMemo(() => spotRows(spots, { region, query }), [spots, region, query]);
    return (
        <BuilderSection id="qb-spots" title="대표 명소" help="왼쪽 순서대로 지도와 견적서에 표시돼요. 설명·몽골어 지명은 여행지 관리에서 채워져요."
            actions={<AdminTextButton size="sm" leading={<IconMap />} onClick={onMap}>지도 미리보기</AdminTextButton>}>
            <div className="qbd-spots">
                <div className="qbd-spots-picked">
                    <div className="qbd-spots-picked-head">
                        <h3>선택한 명소 <span>{selected.length}</span></h3>
                        {selected.length > 0 && <AdminTextButton tone="assistive" size="sm" onClick={onClear}>모두 빼기</AdminTextButton>}
                    </div>
                    {selected.length ? <ol>
                        {selected.map((name, i) => (
                            <li key={name} className={drag === i ? 'is-dragging' : undefined}
                                onDragOver={e => { if (drag >= 0) e.preventDefault(); }}
                                onDrop={e => { e.preventDefault(); if (drag >= 0 && drag !== i) onReorder(drag, i); setDrag(-1); }}>
                                <span className="qbd-grip" draggable title="끌어서 순서 바꾸기" aria-hidden="true"
                                    onDragStart={e => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDrag(-1)}><IconGrip /></span>
                                <span className="qbd-spot-no">{i + 1}</span>
                                <span className="qbd-spot-text"><b>{name}</b><small>{String(spots[name]?.region || (spots[name] ? '' : '목록에 없는 명소'))}</small></span>
                                <AdminIconButton label={`${name} 빼기`} size="sm" onClick={() => onToggle(name)}><IconClose /></AdminIconButton>
                            </li>
                        ))}
                    </ol> : <p className="qbd-muted qbd-spots-none">아직 고른 명소가 없어요. 오른쪽 목록에서 추가해 주세요.</p>}
                </div>
                <div className="qbd-spots-all">
                    <div className="qbd-spots-tools">
                        <AdminSearch value={query} onChange={setQuery} placeholder="명소 이름 검색" aria-label="명소 이름 검색" wide />
                        <AdminChipGroup label="명소 지역" value={region} onChange={setRegion} items={regions.map(r => ({ value: r.value, label: r.label, count: r.count }))} />
                    </div>
                    <div className="qbd-spots-grid">
                        {list.map(name => {
                            const at = selected.indexOf(name), s = spots[name] || {};
                            return (
                                <AdminPickCard key={name} selected={at >= 0} className="qbd-spot" onClick={() => onToggle(name)}>
                                    <span className={at >= 0 ? 'qbd-spot-badge is-on' : 'qbd-spot-badge'} aria-hidden="true">{at >= 0 ? at + 1 : ''}</span>
                                    <span className="qbd-spot-text"><b>{name}</b><small>{String(s.short || s.desc || '')}</small></span>
                                </AdminPickCard>
                            );
                        })}
                        {!list.length && <p className="qbd-empty">{Object.keys(spots).length ? '맞는 명소가 없어요. 검색어나 지역을 바꿔 보세요.' : '등록된 명소가 없어요. 견적 관리 → 여행지 관리에서 추가해 주세요.'}</p>}
                    </div>
                </div>
            </div>
        </BuilderSection>
    );
}

// ── 6. 혜택 · 이벤트 · 비고 ─────────────────────────────────
export function NotesSection({ st, patch, onDefaults }: { st: QuoteState; patch: Patch; onDefaults: () => void }) {
    return (
        <BuilderSection id="qb-notes" title="혜택 · 이벤트 · 비고" help="견적서 기본 정보 표에 그대로 표시돼요. 비우면 빈칸으로 나가요."
            actions={<AdminTextButton size="sm" onClick={onDefaults}>자주 쓰는 문구 불러오기</AdminTextButton>}>
            <div className="qbd-notes">
                <Text label="여행사 혜택" value={st.benefits} placeholder="예) 판초 1인1개, 캠핑의자 세트, 낙타양말 증정" onChange={v => patch({ benefits: v })} />
                <AdminField label="참여 가능 이벤트" hint="한 줄에 하나씩">
                    {(id, describedBy) => <AdminTextArea id={id} aria-describedby={describedBy} minRows={4} value={st.events}
                        placeholder={'1번: 후기 이벤트 참여 시 1인 1만원 할인\n2번: 인스타 후기 작성 시 1인 2만원 할인'} onChange={e => patch({ events: e.target.value })} />}
                </AdminField>
                <Text label="비고" value={st.remark} placeholder="고객에게 따로 안내할 내용 (비우면 '-')" onChange={v => patch({ remark: v })} />
            </div>
        </BuilderSection>
    );
}

// ── 오른쪽 카드 ─────────────────────────────────────────────
function CheckIcon({ state }: { state: BuilderCheck['state'] | RequestItem['mark'] }) {
    if (state === 'done' || state === 'ok') return <IconCheck className="qbd-ok" aria-label="완료" />;
    if (state === 'todo' || state === 'warn') return <IconWarning className="qbd-warn-icon" aria-label="확인 필요" />;
    return <span className="qbd-ring" aria-label="선택" />;
}
export function BuilderChecks({ checks, onGo }: { checks: BuilderCheck[]; onGo: (id: BuilderSectionId) => void }) {
    return (
        <div className="qbd-checks">
            <h3>보내기 전 확인</h3>
            {checks.map(c => (
                <a key={c.key} href={`#${c.section}`} className={c.state === 'todo' ? 'qbd-check is-todo' : 'qbd-check'} onClick={e => { e.preventDefault(); onGo(c.section); }}>
                    <CheckIcon state={c.state} /><span className="qbd-check-label">{c.label}</span><span className="qbd-check-note">{c.note}</span>
                </a>
            ))}
        </div>
    );
}

export function RequestCard({ received, rows, items, phone, phoneMasked, requestNo, onGo, onCopy, onRaw }: {
    received: string; rows: Array<[string, string]>; items: RequestItem[]; phone: string; phoneMasked: string; requestNo: string;
    onGo: (id: BuilderSectionId) => void; onCopy: (value: string, label: string) => void; onRaw: () => void;
}) {
    const [open, setOpen] = useState(true);
    const ok = items.filter(i => i.mark === 'ok').length;
    return (
        <div className="qbd-card qbd-request">
            <div className="qbd-card-head">
                <div><h2>고객 요청</h2><span>{[received && `${received} 접수`, '견적 작성 참고용'].filter(Boolean).join(' · ')}</span></div>
                <AdminTextButton tone="assistive" size="sm" aria-expanded={open} onClick={() => setOpen(o => !o)} trailing={open ? <IconChevronUp /> : <IconChevronDown />}>{open ? '접기' : '펼치기'}</AdminTextButton>
            </div>
            {open && <>
                {rows.length > 0 && <dl className="qbd-dl">{rows.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>}
                {items.length > 0 && <div className="qbd-req">
                    <div className="qbd-req-head"><h3>요청 사항</h3><span>{items.length}개 중 {ok}개 반영</span></div>
                    <div className="qbd-req-list">
                        {items.map(item => (
                            <a key={item.key} href={`#${item.section}`} className={item.mark === 'warn' ? 'qbd-req-item is-warn' : 'qbd-req-item'} onClick={e => { e.preventDefault(); onGo(item.section); }}>
                                <CheckIcon state={item.mark} />
                                <span><b>{item.label}</b><small>{item.note}</small></span>
                            </a>
                        ))}
                    </div>
                </div>}
                <div className="qbd-req-foot">
                    {phone && <div><span>연락처</span><span>{phoneMasked}<AdminTextButton tone="assistive" size="sm" onClick={() => onCopy(phone, '연락처')}>복사</AdminTextButton></span></div>}
                    {requestNo && <div><span>요청 번호</span><span>#{requestNo}<AdminTextButton tone="assistive" size="sm" onClick={() => onCopy(requestNo, '요청 번호')}>복사</AdminTextButton></span></div>}
                    <div className="qbd-req-raw"><AdminTextButton size="sm" onClick={onRaw}>요청 원문 보기</AdminTextButton></div>
                </div>
            </>}
        </div>
    );
}

export function SummaryCard({ rows, price, pax, optionCount, children }: {
    rows: Array<[string, React.ReactNode]>; pax: number; optionCount: number; children: React.ReactNode;
    price: { full: boolean; balance: number; per: number; total: number; deposit: number; rest: number; otherTotal: number } | null;
}) {
    return (
        <div className="qbd-card">
            <h2>견적 요약</h2>
            <dl className="qbd-dl">{rows.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>
            <div className="qbd-divider" />
            {price ? <div className="qbd-money">
                <div><span>1인 잔금 · {price.full ? '풀패키지' : '실속형'} {pax}인</span><span>{won(price.balance)}</span></div>
                <div><span>1인 예약금</span><span>{won(price.per - price.balance)}</span></div>
                <div><span>1인 합계</span><b>{won(price.per)}</b></div>
                <div className="qbd-money-total"><b>총액 · {pax}명</b><strong>{won(price.total)}</strong></div>
                <div className="qbd-money-notes">
                    <span>예약금 {won(price.deposit)} · 잔금 {won(price.rest)}</span>
                    <span>{price.full ? '실속형' : '풀패키지'}으로 바꾸면 {won(price.otherTotal)}</span>
                    {optionCount > 0 && <span>추가 · 할인 안내 {optionCount}건은 별도 표시</span>}
                </div>
            </div> : <p className="qbd-muted">{pax}인 잔금이 없어 총액을 계산하지 못했어요. 요금에서 {pax}인 줄을 넣어 주세요.</p>}
            <div className="qbd-divider" />
            {children}
        </div>
    );
}

// ── 아래 막대 ───────────────────────────────────────────────
export function BuilderBar({ pax, full, total, per, todo, onTodo, busy, locked, pendingDraft, onPreview, onSave, onShare }: {
    pax: number; full: boolean; total: number | null; per: number | null; todo: { text: string; section: BuilderSectionId } | null; onTodo: (id: BuilderSectionId) => void;
    busy: '' | 'save' | 'share'; locked: boolean; pendingDraft: boolean; onPreview: () => void; onSave: () => void; onShare: () => void;
}) {
    return (
        <div className="adm-ui-form-bar qbd-bar" role="region" aria-label="예상 총액과 저장">
            <div className="adm-ui-form-bar-status qbd-total">
                <small>{pax}인 · {full ? '풀패키지' : '실속형'} 기준 예상 총액</small>
                {total != null ? <b>{won(total)} <span>1인 {won(per || 0)}</span></b> : <b>— <span>{pax}인 잔금 미입력</span></b>}
            </div>
            {todo && <a href={`#${todo.section}`} className="qbd-todo" onClick={e => { e.preventDefault(); onTodo(todo.section); }}><IconWarning aria-hidden="true" />{todo.text}</a>}
            <div className="adm-ui-form-bar-actions">
                <AdminButton variant="secondary" disabled={pendingDraft} onClick={onPreview}>견적서 미리보기</AdminButton>
                <AdminButton variant="secondary" loading={busy === 'save'} disabled={locked} onClick={onSave}>저장하기</AdminButton>
                <AdminButton variant="primary" loading={busy === 'share'} disabled={locked} onClick={onShare}>링크 공유하기</AdminButton>
            </div>
        </div>
    );
}
