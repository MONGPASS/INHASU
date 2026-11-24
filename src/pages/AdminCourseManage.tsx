import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../components/admin/AdminLayout';
import {
    AdminBadge, AdminButton, AdminCard, AdminChip, AdminDialog, AdminEmpty, AdminError, AdminField, AdminIconButton, AdminLoading, AdminMessage,
    AdminSearch, AdminSelect, AdminTable, AdminTbody, AdminTd, AdminTextArea, AdminTextButton, AdminTextInput, AdminTh, AdminThead, AdminTr,
    IconArrowDown, IconArrowUp, IconCopy, IconPencil, IconPlus, IconSend, IconTrash,
} from '../components/admin/ui';
import { adminConfirm, adminNotify } from '../components/admin/ui/adminFeedback';
import { adminValidateRequired } from '../components/admin/ui/adminForm';
import { quoteDeskHref, quoteDeskPageId } from '../components/admin/quoteDesk';
import { loadFallbackCourses, loadFallbackSnippets, loadFallbackSpots } from '../components/admin/quoteLibrary';
import { readQuoteLibrary } from '../components/admin/quoteLibraryStore';
import { useQuoteLibrary } from '../components/admin/useQuoteLibrary';
import { readCats, readLibrary as readSnippets, type SnippetLibrary } from '../components/admin/itinerarySnippets';
import {
    EMPTY_FILTER, INTENSITY_RANGES, PRICE_RANGES, addBalance, blankDay, courseDayCount, courseFromForm, dayFormFromSnippet, duplicateCourse,
    filterChoices, filterCourses, formFromCourse, moveDay, putCourse, readCourses, removeCourse, snippetGroups, toggleHighlight, won,
    type CourseFilter, type CourseForm, type CourseLibrary, type DayForm,
} from '../components/admin/courseLibrary';
import './AdminCourseManage.css';

interface Editor { previousName: string | null; form: CourseForm; initial: string }
/** 편집 창이 함께 쓰는 자료(읽기만): 여행지 이름·하루 일정 */
interface Extras { spots: string[]; snippets: SnippetLibrary; snippetCats: string[]; error: string }

const SHARE_KEY = 'leaders_course_share';

/**
 * 코스 관리(/admin/quote-desk/courses) — 옛 견적 도구 `public/코스관리.html`을 React로 옮긴 화면.
 * 목록형 기준: 머리(‘새 코스 추가’) → 카드 하나 안에 검색·다섯 고르기 칸 → 표. 저장은 옛 도구와 같은 `/api/data/courses`(충돌 확인 포함).
 * 여기서 만든 코스가 견적서 만들기의 ‘코스 불러오기’와 상품의 코스 가져오기에 나타난다.
 */
export const AdminCourseManage: React.FC = () => {
    const navigate = useNavigate();
    // 서버에 아직 저장된 코스가 없으면 옛 도구처럼 이 브라우저 저장분 → 기본 코스를 보여 준다(저장하면 서버에 올라간다).
    const { phase, loadError, map: library, saving, load, persist, isSaving, token } = useQuoteLibrary<CourseLibrary>({
        mapKey: 'courses', readMap: readCourses, fallback: loadFallbackCourses,
    });
    const [filter, setFilter] = useState<CourseFilter>(EMPTY_FILTER);
    const [editor, setEditor] = useState<Editor | null>(null);
    const [extras, setExtras] = useState<Extras>({ spots: [], snippets: {}, snippetCats: [], error: '' });
    const [newOption, setNewOption] = useState({ label: '', calc: '' });
    const [newBalance, setNewBalance] = useState({ pax: '', economy: '', full: '' });
    const ready = phase === 'ready';

    // 여행지 이름(대표 명소)과 일정 관리의 하루 일정 — 편집 창에서 고르기만 한다
    useEffect(() => {
        if (!ready) return;
        let alive = true;
        (async () => {
            try {
                const value = token();
                const [spots, snippets, cats] = await Promise.all([
                    readQuoteLibrary('spots', value), readQuoteLibrary('snippets', value), readQuoteLibrary('snippet_cats', value),
                ]);
                const spotMap = spots.data == null ? await loadFallbackSpots().catch(() => ({})) : spots.data;
                const snippetMap = snippets.data == null ? await loadFallbackSnippets().catch(() => ({})) : snippets.data;
                if (!alive) return;
                setExtras({
                    spots: spotMap && typeof spotMap === 'object' && !Array.isArray(spotMap) ? Object.keys(spotMap) : [],
                    snippets: readSnippets(snippetMap), snippetCats: readCats(cats.data), error: '',
                });
            } catch (error) {
                if (alive) setExtras((current) => ({ ...current, error: error instanceof Error ? error.message : String(error) }));
            }
        })();
        return () => { alive = false; };
    }, [ready, token]);

    /* ── 목록 ── */
    const rows = useMemo(() => filterCourses(library, filter), [library, filter]);
    const choices = useMemo(() => filterChoices(library), [library]);
    const total = Object.keys(library).length;
    const filtered = JSON.stringify(filter) !== JSON.stringify(EMPTY_FILTER);
    const setFilterValue = (patch: Partial<CourseFilter>) => setFilter((current) => ({ ...current, ...patch }));

    const duplicate = async (name: string) => {
        const next = duplicateCourse(library, name);
        if (await persist({ map: next.library })) adminNotify(`‘${next.name}’ 코스를 만들었습니다.`);
    };
    const share = (name: string) => {
        // 견적서 만들기가 열릴 때 이 값을 읽어 코스를 채우고 고객 정보 없이 공유 견적으로 연다(옛 도구와 같은 약속)
        try { window.sessionStorage.setItem(SHARE_KEY, JSON.stringify({ course: name, anonymous: true })); } catch { /* 저장소를 쓸 수 없으면 빈 견적서로 열린다 */ }
        navigate(quoteDeskHref('builder'));
    };

    /* ── 추가·편집 ── */
    const openEditor = (name: string | null) => {
        const form = formFromCourse(name ?? '', name === null ? undefined : library[name]);
        setNewOption({ label: '', calc: '' });
        setNewBalance({ pax: '', economy: '', full: '' });
        setEditor({ previousName: name, form, initial: JSON.stringify(form) });
    };
    const setForm = (patch: Partial<CourseForm>) => setEditor((current) => (current ? { ...current, form: { ...current.form, ...patch } } : current));
    const setDay = (key: string, patch: Partial<DayForm>) => setEditor((current) => (current ? {
        ...current, form: { ...current.form, days: current.form.days.map((day) => (day.key === key ? { ...day, ...patch } : day)) },
    } : current));
    const closeEditor = () => { if (!isSaving()) setEditor(null); };

    const saveEditor = async () => {
        if (!editor) return;
        if (!adminValidateRequired()) return;
        const name = editor.form.name.trim();
        if (!name) return;
        if (name !== editor.previousName && library[name]) { adminNotify('같은 이름의 코스가 이미 있습니다. 다른 이름을 입력해 주세요.'); return; }
        const original = editor.previousName === null ? undefined : library[editor.previousName];
        const course = courseFromForm({ ...editor.form, name }, original);
        if (!await persist({ map: putCourse(library, editor.previousName, name, course) })) return;
        setEditor(null);
        adminNotify(editor.previousName === null ? '코스를 추가했습니다.' : '저장했습니다.');
    };
    const deleteCourse = async (name: string) => {
        if (!await adminConfirm({ title: '코스 삭제', message: `‘${name}’ 코스를 삭제할까요? 이미 만든 견적서에 불러온 내용은 그대로입니다.`, confirmLabel: '삭제', danger: true })) return false;
        const ok = await persist({ map: removeCourse(library, name) });
        if (ok) adminNotify('삭제했습니다.');
        return ok;
    };

    const addOption = () => {
        if (!editor) return;
        const label = newOption.label.trim();
        if (!label) { adminNotify('항목 이름을 입력해 주세요.'); return; }
        setForm({ options: [...editor.form.options, { label, calc: newOption.calc.trim() }] });
        setNewOption({ label: '', calc: '' });
    };
    const addBalanceRow = () => {
        if (!editor) return;
        const pax = parseInt(newBalance.pax, 10);
        if (!Number.isFinite(pax) || pax <= 0 || (!newBalance.economy.trim() && !newBalance.full.trim())) { adminNotify('인원과 금액을 입력해 주세요.'); return; }
        setForm({ balances: addBalance(editor.form.balances, pax, newBalance.economy.trim(), newBalance.full.trim()) });
        setNewBalance({ pax: '', economy: '', full: '' });
    };
    const loadSnippet = (key: string, snippetName: string) => {
        const snippet = extras.snippets[snippetName];
        if (!snippet || !editor) return;
        setEditor({ ...editor, form: { ...editor.form, days: editor.form.days.map((day) => (day.key === key ? dayFormFromSnippet(snippet) : day)) } });
        adminNotify(`‘${snippetName}’ 일정을 불러왔습니다.`, 'success');
    };

    const body = phase === 'connecting' || phase === 'loading' ? <AdminLoading label="코스를 불러오는 중…" />
        : phase === 'unset' ? <AdminError title="견적 데스크가 연결되지 않았어요" reason="서버에 견적 관리자 값(ADMIN_TOKEN)이 설정되어 있어야 코스를 불러오고 저장할 수 있습니다." />
        : phase === 'error' ? <AdminError reason={loadError} onRetry={() => void load()} />
        : rows.length === 0 ? (
            <AdminEmpty
                title={total ? '조건에 맞는 코스가 없어요.' : '등록된 코스가 없어요.'}
                description={total ? '검색어나 고르기 칸을 바꿔 보세요.' : '‘새 코스 추가’로 자주 쓰는 일정을 코스로 만들어 두세요.'}
                action={total ? <AdminButton size="sm" onClick={() => setFilter(EMPTY_FILTER)}>필터 초기화</AdminButton> : undefined}
            />
        ) : (
            <AdminTable label="코스 목록" className="cs-table">
                <AdminThead>
                    <AdminTr>
                        <AdminTh>코스</AdminTh>
                        <AdminTh className="cs-c-days">일정</AdminTh>
                        <AdminTh align="right" className="cs-c-price">기본 1인</AdminTh>
                        <AdminTh>대표 명소</AdminTh>
                        <AdminTh className="cs-c-intensity">이동 강도</AdminTh>
                        <AdminTh align="right" className="cs-c-actions">관리</AdminTh>
                    </AdminTr>
                </AdminThead>
                <AdminTbody>
                    {rows.map(([name, course]) => {
                        const highlights = Array.isArray(course.highlights) ? course.highlights.map(String) : [];
                        const days = (course.days || []).length;
                        return (
                            <AdminTr key={name}>
                                <AdminTd>
                                    <span className="cs-name">
                                        <AdminTextButton className="cs-name-btn" onClick={() => openEditor(name)}>{name}</AdminTextButton>
                                        <span className="cs-sub">{[course.destination, course.nights, course.vehicle].filter(Boolean).join(' · ') || '여행지·기간 미입력'}</span>
                                    </span>
                                </AdminTd>
                                <AdminTd nowrap className="cs-c-days"><AdminBadge tone="tag-cyan">{days || courseDayCount(course)}일 일정</AdminBadge></AdminTd>
                                <AdminTd align="right" nowrap className="cs-c-price">{won(course.base)}</AdminTd>
                                <AdminTd>
                                    <span className="cs-sub-strong">{highlights.length ? `${highlights.length}곳` : '—'}</span>
                                    {highlights.length > 0 && <span className="cs-sub"> · {highlights.slice(0, 3).join(', ')}{highlights.length > 3 ? ' 외' : ''}</span>}
                                </AdminTd>
                                <AdminTd nowrap className="cs-c-intensity">{course.intensity || 3} / 5</AdminTd>
                                <AdminTd align="right" className="cs-c-actions">
                                    <span className="cs-actions">
                                        <AdminIconButton size="sm" label={`${name} 편집`} onClick={() => openEditor(name)}><IconPencil /></AdminIconButton>
                                        <AdminIconButton size="sm" label={`${name} 복제`} disabled={saving} onClick={() => void duplicate(name)}><IconCopy /></AdminIconButton>
                                        <AdminButton size="sm" leading={<IconSend />} onClick={() => share(name)}>공유 견적</AdminButton>
                                    </span>
                                </AdminTd>
                            </AdminTr>
                        );
                    })}
                </AdminTbody>
            </AdminTable>
        );

    const editing = editor?.previousName ?? null;
    const form = editor?.form;
    const option = (value: string, label: string) => ({ value, label });

    return (
        <AdminLayout
            activePage={quoteDeskPageId('courses')}
            title="코스 관리"
            description="여기서 만든 코스가 견적서 만들기의 ‘코스 불러오기’에 나타납니다. 고르면 일정·명소·기본가가 한 번에 채워져요."
            actions={<AdminButton variant="primary" leading={<IconPlus />} disabled={!ready} onClick={() => openEditor(null)}>새 코스 추가</AdminButton>}
        >
            <div className="cs-page">
                <AdminCard flush className="cs-card">
                    <div className="cs-filters">
                        <AdminSearch value={filter.query} onChange={(query) => setFilterValue({ query })} placeholder="코스 · 여행지 · 명소 검색" aria-label="코스 검색" disabled={!ready} />
                        <AdminSelect aria-label="일정 길이" className="cs-filter" value={filter.days} onChange={(days) => setFilterValue({ days })}
                            options={[option('', '전체 일정'), ...choices.days.map((n) => option(String(n), `${n}일 일정 (${Math.max(0, n - 1)}박${n}일)`))]} />
                        <AdminSelect aria-label="여행지" className="cs-filter" value={filter.dest} onChange={(dest) => setFilterValue({ dest })}
                            options={[option('', '전체 여행지'), ...choices.dests.map((value) => option(value, value))]} />
                        <AdminSelect aria-label="대표 명소" className="cs-filter" value={filter.highlight} onChange={(highlight) => setFilterValue({ highlight })}
                            options={[option('', '전체 명소'), ...choices.highlights.map((value) => option(value, value))]} />
                        <AdminSelect aria-label="금액" className="cs-filter" value={filter.price} onChange={(price) => setFilterValue({ price })}
                            options={[option('', '전체 금액'), ...PRICE_RANGES]} />
                        <AdminSelect aria-label="이동 강도" className="cs-filter" value={filter.intensity} onChange={(intensity) => setFilterValue({ intensity })}
                            options={[option('', '전체 이동 강도'), ...INTENSITY_RANGES]} />
                        <span className="cs-count" role="status">
                            {ready ? <>전체 {total}개 중 <b>{rows.length}</b>개</> : '–'}
                            {filtered && <AdminTextButton size="sm" tone="assistive" onClick={() => setFilter(EMPTY_FILTER)}>필터 초기화</AdminTextButton>}
                        </span>
                    </div>
                    {body}
                    <p className="cs-note">‘공유 견적’은 이 코스로 견적서 만들기를 열어 고객 정보 없이 공유용 견적서를 만듭니다. 짧은 일정부터 보입니다.</p>
                </AdminCard>
            </div>

            <AdminDialog
                open={!!editor}
                onClose={closeEditor}
                size="lg"
                title={editing === null ? '새 코스 추가' : '코스 편집'}
                dirty={!!editor && JSON.stringify(editor.form) !== editor.initial}
                onSubmit={() => void saveEditor()}
                submitLabel={editing === null ? '추가하기' : '저장하기'}
                submitting={saving}
                submitDisabled={!form?.name.trim()}
                onDelete={editing === null ? undefined : () => { void deleteCourse(editing).then((ok) => { if (ok) setEditor(null); }); }}
                deleteLabel="코스 삭제"
            >
                {form && (
                    <div className="cs-editor">
                        <section className="cs-section">
                            <AdminField id="cs-name" label="코스 이름" required hint="견적서 만들기의 ‘코스 불러오기’ 목록에 이 이름으로 보입니다.">
                                <AdminTextInput id="cs-name" placeholder="예: 고비 4박5일" value={form.name} onChange={(e) => setForm({ name: e.target.value })} />
                            </AdminField>
                            <div className="cs-grid is-4">
                                <AdminField id="cs-dest" label="여행지"><AdminTextInput id="cs-dest" placeholder="예: 고비" value={form.destination} onChange={(e) => setForm({ destination: e.target.value })} /></AdminField>
                                <AdminField id="cs-nights" label="기간"><AdminTextInput id="cs-nights" placeholder="예: 4박5일" value={form.nights} onChange={(e) => setForm({ nights: e.target.value })} /></AdminField>
                                <AdminField id="cs-vehicle" label="차량"><AdminTextInput id="cs-vehicle" placeholder="예: 하이에이스" value={form.vehicle} onChange={(e) => setForm({ vehicle: e.target.value })} /></AdminField>
                                <AdminField id="cs-intensity" label="이동 강도 (1~5)">
                                    <AdminSelect id="cs-intensity" value={form.intensity} onChange={(intensity) => setForm({ intensity })}
                                        options={['1', '2', '3', '4', '5'].map((value) => option(value, value))} />
                                </AdminField>
                            </div>
                        </section>

                        <section className="cs-section">
                            <h3 className="cs-section-title"><span className="cs-step">1</span>요금 (1인 기준)<span className="cs-section-hint">견적서 만들기에서 이 코스를 고르면 그대로 채워집니다.</span></h3>
                            <div className="cs-grid is-4">
                                <AdminField id="cs-deposit" label="예약금 (1인)">
                                    <AdminTextInput id="cs-deposit" type="number" inputMode="numeric" step={1000} trailing="원" value={form.deposit} onChange={(e) => setForm({ deposit: e.target.value })} />
                                </AdminField>
                            </div>
                            <div className="cs-sub-title">추가 및 할인 사항 <span>· 견적서에 안내로 보입니다(자동 계산 없음)</span></div>
                            <div className="cs-list">
                                {form.options.length === 0 && <p className="cs-empty">등록된 추가·할인 안내가 없습니다.</p>}
                                {form.options.map((item, index) => (
                                    <div key={index} className="cs-option">
                                        <span className="cs-option-label">{item.label}</span>
                                        <span className="cs-sub">{item.calc}</span>
                                        <AdminIconButton size="sm" label={`${item.label} 빼기`} onClick={() => setForm({ options: form.options.filter((_, i) => i !== index) })}><IconTrash /></AdminIconButton>
                                    </div>
                                ))}
                            </div>
                            <div className="cs-add-row">
                                <AdminTextInput aria-label="추가·할인 항목" placeholder="항목 (예: 게르 업그레이드)" value={newOption.label} onChange={(e) => setNewOption({ ...newOption, label: e.target.value })} />
                                <AdminTextInput aria-label="금액 안내" placeholder="금액 안내 (예: 50,000원*1박)" value={newOption.calc} onChange={(e) => setNewOption({ ...newOption, calc: e.target.value })} />
                                <AdminButton size="md" leading={<IconPlus />} onClick={addOption}>옵션 추가</AdminButton>
                            </div>

                            <div className="cs-sub-title">인원별 잔금 (1인 기준) <span>· 실속형 = 일반게르 / 풀패키지 = 고급게르. 0원 줄은 저장하지 않아요</span></div>
                            <AdminTable label="인원별 잔금" className="cs-balance" cardOff>
                                <AdminThead><AdminTr><AdminTh>인원</AdminTh><AdminTh>실속형</AdminTh><AdminTh>풀패키지</AdminTh><AdminTh align="right">관리</AdminTh></AdminTr></AdminThead>
                                <AdminTbody>
                                    {form.balances.map((balance, index) => (
                                        <AdminTr key={balance.pax}>
                                            <AdminTd nowrap><AdminBadge tone="info">{balance.pax}인</AdminBadge></AdminTd>
                                            <AdminTd><AdminTextInput aria-label={`${balance.pax}인 실속형`} type="number" inputMode="numeric" step={1000} trailing="원" value={balance.economy}
                                                onChange={(e) => setForm({ balances: form.balances.map((b, i) => (i === index ? { ...b, economy: e.target.value } : b)) })} /></AdminTd>
                                            <AdminTd><AdminTextInput aria-label={`${balance.pax}인 풀패키지`} type="number" inputMode="numeric" step={1000} trailing="원" value={balance.full}
                                                onChange={(e) => setForm({ balances: form.balances.map((b, i) => (i === index ? { ...b, full: e.target.value } : b)) })} /></AdminTd>
                                            <AdminTd align="right"><AdminIconButton size="sm" label={`${balance.pax}인 줄 빼기`} onClick={() => setForm({ balances: form.balances.filter((_, i) => i !== index) })}><IconTrash /></AdminIconButton></AdminTd>
                                        </AdminTr>
                                    ))}
                                </AdminTbody>
                            </AdminTable>
                            <div className="cs-add-row">
                                <AdminTextInput aria-label="인원" className="cs-pax" type="number" inputMode="numeric" placeholder="인원" trailing="인" value={newBalance.pax} onChange={(e) => setNewBalance({ ...newBalance, pax: e.target.value })} />
                                <AdminTextInput aria-label="실속형 금액" type="number" inputMode="numeric" placeholder="실속형" trailing="원" value={newBalance.economy} onChange={(e) => setNewBalance({ ...newBalance, economy: e.target.value })} />
                                <AdminTextInput aria-label="풀패키지 금액" type="number" inputMode="numeric" placeholder="풀패키지" trailing="원" value={newBalance.full} onChange={(e) => setNewBalance({ ...newBalance, full: e.target.value })} />
                                <AdminButton size="md" leading={<IconPlus />} onClick={addBalanceRow}>인원 추가</AdminButton>
                            </div>
                        </section>

                        <section className="cs-section">
                            <h3 className="cs-section-title"><span className="cs-step">2</span>대표 명소<span className="cs-section-hint">고른 순서대로 견적서 명소 페이지에 나옵니다.</span></h3>
                            {extras.error && <AdminMessage tone="cautionary">여행지·일정 목록을 불러오지 못했습니다: {extras.error}</AdminMessage>}
                            <div className="cs-spots" role="group" aria-label="대표 명소">
                                {[...new Set([...extras.spots, ...form.highlights])].map((name) => {
                                    const order = form.highlights.indexOf(name);
                                    return <AdminChip key={name} active={order >= 0} count={order >= 0 ? order + 1 : null} onClick={() => setForm({ highlights: toggleHighlight(form.highlights, name) })}>{name}</AdminChip>;
                                })}
                                {!extras.spots.length && !form.highlights.length && <p className="cs-empty">여행지 관리에서 먼저 여행지를 등록해 주세요.</p>}
                            </div>
                        </section>

                        <section className="cs-section">
                            <h3 className="cs-section-title"><span className="cs-step">3</span>일자별 일정<span className="cs-section-hint">세부 일정은 한 줄에 한 항목. * → 강조, ( → 회색</span></h3>
                            {form.days.map((day, index) => (
                                <div key={day.key} className="cs-day">
                                    <div className="cs-day-head">
                                        <AdminBadge tone="info" strong>{index + 1}일차</AdminBadge>
                                        <AdminTextInput aria-label={`${index + 1}일차 목적지`} className="cs-day-dest" placeholder="목적지 (여러 곳은 / 로 나눠요)" value={day.dest} onChange={(e) => setDay(day.key, { dest: e.target.value })} />
                                        <AdminTextInput aria-label={`${index + 1}일차 이동`} className="cs-day-move" placeholder="이동 6시간 (300 km)" value={day.move} onChange={(e) => setDay(day.key, { move: e.target.value })} />
                                        <span className="cs-day-tools">
                                            <AdminIconButton size="sm" label={`${index + 1}일차 위로`} disabled={index === 0} onClick={() => setForm({ days: moveDay(form.days, index, -1) })}><IconArrowUp /></AdminIconButton>
                                            <AdminIconButton size="sm" label={`${index + 1}일차 아래로`} disabled={index === form.days.length - 1} onClick={() => setForm({ days: moveDay(form.days, index, 1) })}><IconArrowDown /></AdminIconButton>
                                            <AdminIconButton size="sm" label={`${index + 1}일차 삭제`} disabled={form.days.length <= 1} onClick={() => setForm({ days: form.days.filter((d) => d.key !== day.key) })}><IconTrash /></AdminIconButton>
                                        </span>
                                    </div>
                                    <AdminSelect aria-label={`${index + 1}일차 일정 불러오기`} className="cs-day-snippet" value="" onChange={(name) => { if (name) loadSnippet(day.key, name); }}
                                        options={[option('', '일정 관리에서 불러오기…'), ...snippetGroups(extras.snippets, extras.snippetCats).flatMap(({ group, names }) => names.map((name) => ({ value: name, label: name, group })))]} />
                                    <AdminTextArea aria-label={`${index + 1}일차 세부 일정`} minRows={3} placeholder="한 줄에 하나씩. *강조, (회색" value={day.items} onChange={(e) => setDay(day.key, { items: e.target.value })} />
                                    <div className="cs-grid">
                                        <AdminTextInput aria-label={`${index + 1}일차 숙소`} placeholder="숙소 (예: 여행자 캠프)" value={day.stay} onChange={(e) => setDay(day.key, { stay: e.target.value })} />
                                        <AdminTextInput aria-label={`${index + 1}일차 숙소 태그`} placeholder="숙소 태그 (쉼표로: 전기 O, 샤워 O)" value={day.tags} onChange={(e) => setDay(day.key, { tags: e.target.value })} />
                                    </div>
                                    <div className="cs-grid is-3">
                                        <AdminTextInput aria-label={`${index + 1}일차 조식`} placeholder="조식" value={day.breakfast} onChange={(e) => setDay(day.key, { breakfast: e.target.value })} />
                                        <AdminTextInput aria-label={`${index + 1}일차 중식`} placeholder="중식" value={day.lunch} onChange={(e) => setDay(day.key, { lunch: e.target.value })} />
                                        <AdminTextInput aria-label={`${index + 1}일차 석식`} placeholder="석식" value={day.dinner} onChange={(e) => setDay(day.key, { dinner: e.target.value })} />
                                    </div>
                                </div>
                            ))}
                            <AdminButton fullWidth leading={<IconPlus />} onClick={() => setForm({ days: [...form.days, blankDay()] })}>일자 추가</AdminButton>
                        </section>
                    </div>
                )}
            </AdminDialog>
        </AdminLayout>
    );
};

export default AdminCourseManage;
