import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import {
    AdminBadge, AdminButton, AdminCard, AdminChipGroup, AdminDialog, AdminEmpty, AdminError, AdminField, AdminIconButton,
    AdminLoading, AdminSearch, AdminSelect, AdminTable, AdminTbody, AdminTd, AdminTextArea, AdminTextButton, AdminTextInput,
    AdminTh, AdminThead, AdminTr,
} from '../components/admin/ui';
import { IconPencil, IconPlus, IconTrash } from '@montage-ui/icon';
import { adminConfirm, adminNotify } from '../components/admin/ui/adminFeedback';
import { adminValidateRequired } from '../components/admin/ui/adminForm';
import { useUser } from '../contexts/UserContext';
import { connectQuoteDesk, quoteDeskPageId } from '../components/admin/quoteDesk';
import { loadFallbackSnippets } from '../components/admin/quoteLibrary';
import { readQuoteLibrary, writeQuoteLibrary, type QuoteLibraryKey } from '../components/admin/quoteLibraryStore';
import {
    ALL, NONE, UNCAT, catOf, categoryNameProblem, countIn, countNone, deleteCategory, filterSnippets, formFromSnippet, mergeCats,
    moveText, putSnippet, readCats, readLibrary, removeSnippet, renameCategory, snippetFromForm, stripBr,
    type Snippet, type SnippetForm, type SnippetLibrary,
} from '../components/admin/itinerarySnippets';
import './AdminItineraryManage.css';

type Phase = 'connecting' | 'loading' | 'ready' | 'unset' | 'error';
/** 카테고리 고르기의 ‘새 지역’ 값(지역 이름과 겹치지 않게) */
const NEW_CAT = '__new';
const PREVIEW_LINES = 3;

interface Editor { previousName: string | null; form: SnippetForm; newCat: string; initial: string }
interface CatEditor { from: string | null; value: string }

const problemText = (problem: ReturnType<typeof categoryNameProblem>) =>
    problem === 'empty' ? '지역 이름을 입력해 주세요.'
    : problem === 'reserved' ? `‘${UNCAT}’은(는) 쓸 수 없는 이름입니다.`
    : problem === 'duplicate' ? '이미 있는 지역입니다.' : '';

/** 세부 일정 한 줄: `*`로 시작하면 강조, `(`로 시작하면 회색(견적서와 같은 규칙). */
const ItemLine: React.FC<{ text: string }> = ({ text }) => (
    <span className={text.startsWith('*') ? 'it-line is-strong' : text.startsWith('(') ? 'it-line is-sub' : 'it-line'}>{text}</span>
);

/**
 * 일정 관리(/admin/quote-desk/itinerary) — 옛 견적 도구 `public/일정관리.html`을 React로 옮긴 화면.
 * 목록형 기준: 머리(‘새 일정 추가’) → 카드 하나 안에 검색·지역 칩 → 표. 저장은 옛 도구와 같은 `/api/data/snippets`·`snippet_cats`(충돌 확인 포함).
 */
export const AdminItineraryManage: React.FC = () => {
    const { user } = useUser();
    const accountId = user?.role === 'admin' ? user.id : '';
    const [phase, setPhase] = useState<Phase>('connecting');
    const [loadError, setLoadError] = useState('');
    const [library, setLibrary] = useState<SnippetLibrary>({});
    const [cats, setCats] = useState<string[]>([]);
    const token = useRef('');
    const meta = useRef<Record<'snippets' | 'snippet_cats', string | null>>({ snippets: null, snippet_cats: null });
    const [active, setActive] = useState(ALL);
    const [query, setQuery] = useState('');
    const [editor, setEditor] = useState<Editor | null>(null);
    const [catEditor, setCatEditor] = useState<CatEditor | null>(null);
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);
    const loadRequest = useRef(0);

    const load = useCallback(async () => {
        const request = ++loadRequest.current;
        if (!accountId) return;
        setLoadError('');
        try {
            if (!token.current) {
                setPhase('connecting');
                const value = await connectQuoteDesk({ accountId });
                if (request !== loadRequest.current) return;
                if (!value) { setPhase('unset'); return; }
                token.current = value;
            }
            setPhase((current) => (current === 'ready' ? current : 'loading'));
            const [snippets, snippetCats] = await Promise.all([
                readQuoteLibrary('snippets', token.current), readQuoteLibrary('snippet_cats', token.current),
            ]);
            if (request !== loadRequest.current) return;
            // 서버에 아직 저장된 일정이 없으면 옛 도구처럼 이 브라우저 저장분 → 기본 일정을 보여 준다(저장하면 서버에 올라간다).
            const nextLibrary = snippets.data == null ? readLibrary(await loadFallbackSnippets().catch(() => ({}))) : readLibrary(snippets.data);
            if (request !== loadRequest.current) return;
            const nextCats = mergeCats(nextLibrary, readCats(snippetCats.data));
            meta.current = { snippets: snippets.updatedAt, snippet_cats: snippetCats.updatedAt };
            setLibrary(nextLibrary);
            setCats(nextCats);
            setActive((current) => (current === ALL || current === NONE || nextCats.includes(current) ? current : ALL));
            setPhase('ready');
        } catch (error) {
            if (request !== loadRequest.current) return;
            setLoadError(error instanceof Error ? error.message : String(error));
            setPhase('error');
        }
    }, [accountId]);

    useEffect(() => {
        token.current = '';
        void load();
        return () => { loadRequest.current++; };
    }, [load]);

    /** 서버에 저장. 다른 기기가 먼저 저장했으면 덮어쓸지 묻는다. 모두 저장됐으면 true. */
    const writeKey = async (key: 'snippets' | 'snippet_cats', data: unknown): Promise<boolean> => {
        let result = await writeQuoteLibrary(key as QuoteLibraryKey, data, token.current, { base: meta.current[key] });
        if (!result.ok) {
            const overwrite = await adminConfirm({
                title: '먼저 저장된 내용이 있어요',
                message: '다른 기기(또는 다른 탭)에서 이 목록을 먼저 저장했어요. 지금 화면의 내용으로 덮어쓸까요? 취소하면 저장하지 않고 최신 목록을 다시 불러옵니다.',
                confirmLabel: '덮어쓰기', danger: true,
            });
            if (!overwrite) return false;
            result = await writeQuoteLibrary(key as QuoteLibraryKey, data, token.current, { base: null, force: true });
            if (!result.ok) return false;
        }
        meta.current[key] = result.updatedAt;
        return true;
    };

    /** 바뀐 쪽만 저장하고, 저장된 쪽만 화면에 반영한다. */
    const persist = async (next: { library?: SnippetLibrary; cats?: string[] }): Promise<boolean> => {
        if (savingRef.current) return false;
        savingRef.current = true; setSaving(true);
        try {
            if (next.library) {
                if (!await writeKey('snippets', next.library)) { await load(); return false; }
                setLibrary(next.library);
            }
            if (next.cats) {
                if (!await writeKey('snippet_cats', next.cats)) { await load(); return false; }
                setCats(next.cats);
            }
            return true;
        } catch (error) {
            adminNotify(error instanceof Error ? error.message : '저장하지 못했습니다.');
            return false;
        } finally {
            savingRef.current = false; setSaving(false);
        }
    };

    /* ── 일정 추가·편집 ── */
    const openEditor = (name: string | null) => {
        const defaultCat = name === null && active !== ALL && active !== NONE ? active : '';
        const form = formFromSnippet(name ?? '', name === null ? undefined : library[name], defaultCat);
        setEditor({ previousName: name, form, newCat: '', initial: JSON.stringify(form) });
    };
    const setForm = (patch: Partial<SnippetForm>) => setEditor((current) => (current ? { ...current, form: { ...current.form, ...patch } } : current));
    const closeEditor = () => { if (!savingRef.current) setEditor(null); };

    const saveEditor = async () => {
        if (!editor) return;
        if (!adminValidateRequired()) return;
        const name = editor.form.name.trim();
        if (!name) return;
        if (name !== editor.previousName && library[name]) { adminNotify('같은 이름의 일정이 이미 있습니다. 다른 이름을 입력해 주세요.'); return; }
        let cat = editor.form.cat;
        let nextCats: string[] | undefined;
        if (cat === NEW_CAT) {
            const problem = categoryNameProblem(editor.newCat, cats);
            if (problem && problem !== 'duplicate') { adminNotify(problemText(problem)); return; }
            cat = editor.newCat.trim();
            if (!cats.includes(cat)) nextCats = [...cats, cat];
        }
        const original = editor.previousName === null ? undefined : library[editor.previousName];
        const snippet: Snippet = snippetFromForm({ ...editor.form, name, cat }, original);
        const ok = await persist({ library: putSnippet(library, editor.previousName, name, snippet), cats: nextCats });
        if (!ok) return;
        setEditor(null);
        if (editor.previousName === null && cat) setActive(cat);
        adminNotify(editor.previousName === null ? '일정을 추가했습니다.' : '저장했습니다.');
    };

    const deleteSnippet = async (name: string) => {
        if (!await adminConfirm({ title: '일정 삭제', message: `‘${name}’ 일정을 삭제할까요? 이미 만든 견적서에 불러온 내용은 그대로입니다.`, confirmLabel: '삭제', danger: true })) return false;
        const ok = await persist({ library: removeSnippet(library, name) });
        if (ok) adminNotify('삭제했습니다.');
        return ok;
    };

    /* ── 지역(카테고리) ── */
    const saveCategory = async () => {
        if (!catEditor) return;
        const problem = categoryNameProblem(catEditor.value, cats, catEditor.from ?? undefined);
        if (problem) { adminNotify(problemText(problem)); return; }
        const name = catEditor.value.trim();
        if (catEditor.from === null) {
            if (!await persist({ cats: [...cats, name] })) return;
            setActive(name);
            adminNotify(`‘${name}’ 지역을 추가했습니다.`);
        } else if (name !== catEditor.from) {
            const next = renameCategory(library, cats, catEditor.from, name);
            const moved = countIn(library, catEditor.from) > 0;
            if (!await persist({ library: moved ? next.library : undefined, cats: next.cats })) return;
            if (active === catEditor.from) setActive(name);
            adminNotify('지역 이름을 바꿨습니다.');
        }
        setCatEditor(null);
    };

    const removeCategory = async (cat: string) => {
        const count = countIn(library, cat);
        const message = count
            ? `‘${cat}’ 지역을 삭제할까요? 이 지역의 일정 ${count}개는 ‘${UNCAT}’로 옮겨지고, 일정은 지워지지 않습니다.`
            : `‘${cat}’ 지역을 삭제할까요?`;
        if (!await adminConfirm({ title: '지역 삭제', message, confirmLabel: '삭제', danger: true })) return;
        const next = deleteCategory(library, cats, cat);
        if (!await persist({ library: count ? next.library : undefined, cats: next.cats })) return;
        if (active === cat) setActive(ALL);
        adminNotify('지역을 삭제했습니다.');
    };

    const rows = useMemo(() => filterSnippets(library, active, query), [library, active, query]);
    const total = Object.keys(library).length;
    const noneCount = countNone(library);
    const chipItems = [
        { value: ALL, label: '전체', count: total },
        ...cats.map((cat) => ({ value: cat, label: cat, count: countIn(library, cat) })),
        ...(noneCount ? [{ value: NONE, label: UNCAT, count: noneCount }] : []),
    ];
    const activeCat = active !== ALL && active !== NONE ? active : '';
    const ready = phase === 'ready';

    const body = phase === 'connecting' || phase === 'loading' ? <AdminLoading label="일정을 불러오는 중…" />
        : phase === 'unset' ? <AdminError title="견적 데스크가 연결되지 않았어요" reason="서버에 견적 관리자 값(ADMIN_TOKEN)이 설정되어 있어야 일정을 불러오고 저장할 수 있습니다." />
        : phase === 'error' ? <AdminError reason={loadError} onRetry={() => void load()} />
        : rows.length === 0 ? (
            <AdminEmpty
                title={total ? '조건에 맞는 일정이 없어요.' : '등록된 일정이 없어요.'}
                description={total ? '검색어나 지역을 바꿔 보세요.' : '‘새 일정 추가’로 자주 쓰는 하루 일정을 만들어 두세요.'}
            />
        ) : (
            <AdminTable label="일정 목록" className="it-table">
                <AdminThead>
                    <AdminTr>
                        <AdminTh>일정 이름</AdminTh>
                        <AdminTh className="it-c-dest">목적지·이동</AdminTh>
                        <AdminTh>세부 일정</AdminTh>
                        <AdminTh className="it-c-stay">숙소</AdminTh>
                        <AdminTh className="it-c-meals">식사(조·중·석)</AdminTh>
                        <AdminTh align="right" className="it-c-actions">관리</AdminTh>
                    </AdminTr>
                </AdminThead>
                <AdminTbody>
                    {rows.map(([name, snippet]) => {
                        const items = Array.isArray(snippet.items) ? snippet.items.map(String) : [];
                        const meals = Array.isArray(snippet.meals) ? snippet.meals.map(String).slice(0, 3) : [];
                        const tags = Array.isArray(snippet.stay?.tags) ? snippet.stay!.tags!.map(String) : [];
                        const cat = catOf(snippet);
                        return (
                            <AdminTr key={name}>
                                <AdminTd className="it-name">
                                    <span className="it-name-in">
                                        <AdminTextButton className="it-name-btn" onClick={() => openEditor(name)}>{name}</AdminTextButton>
                                        {cat ? <AdminBadge tone="tag-cyan">{cat}</AdminBadge> : <AdminBadge outlined>{UNCAT}</AdminBadge>}
                                    </span>
                                </AdminTd>
                                <AdminTd className="it-c-dest">
                                    <span className="it-stack">
                                        <span className="it-dest">{stripBr(snippet.dest).trim() || '목적지 미정'}</span>
                                        {moveText(snippet) && <span className="it-sub">{moveText(snippet)}</span>}
                                    </span>
                                </AdminTd>
                                <AdminTd className="it-items">
                                    <span className="it-stack">
                                        {items.slice(0, PREVIEW_LINES).map((line, i) => <ItemLine key={i} text={line} />)}
                                        {items.length > PREVIEW_LINES && <span className="it-more">+ {items.length - PREVIEW_LINES}줄 더</span>}
                                        {!items.length && <span className="it-sub">—</span>}
                                    </span>
                                </AdminTd>
                                <AdminTd className="it-c-stay">
                                    <span className="it-stack">
                                        <span>{stripBr(snippet.stay?.name).trim() || '—'}</span>
                                        {tags.length > 0 && <span className="it-sub">{tags.join(' · ')}</span>}
                                    </span>
                                </AdminTd>
                                <AdminTd className="it-c-meals">{meals.some((meal) => meal.trim()) ? meals.map((meal) => meal.trim() || '—').join(' · ') : '—'}</AdminTd>
                                <AdminTd align="right" className="it-c-actions">
                                    <span className="it-actions">
                                        <AdminIconButton size="sm" label={`${name} 편집`} onClick={() => openEditor(name)}><IconPencil /></AdminIconButton>
                                        <AdminIconButton size="sm" label={`${name} 삭제`} className="it-danger" disabled={saving} onClick={() => void deleteSnippet(name)}><IconTrash /></AdminIconButton>
                                    </span>
                                </AdminTd>
                            </AdminTr>
                        );
                    })}
                </AdminTbody>
            </AdminTable>
        );

    const editing = editor?.previousName ?? null;
    const catOptions = [
        { value: '', label: `${UNCAT} (지역 미지정)` },
        ...cats.map((cat) => ({ value: cat, label: cat })),
        { value: NEW_CAT, label: '＋ 새 지역 만들기' },
    ];

    return (
        <AdminLayout
            activePage={quoteDeskPageId('itinerary')}
            title="일정 관리"
            description="자주 쓰는 하루 일정을 만들어 두면 견적서 만들기의 일자별 일정에서 ‘일정 불러오기’로 한 번에 채워집니다."
            actions={<AdminButton variant="primary" leading={<IconPlus />} disabled={!ready} onClick={() => openEditor(null)}>새 일정 추가</AdminButton>}
        >
            <div className="it-page">
                <AdminCard flush className="it-card">
                    <div className="it-filters">
                        <AdminSearch value={query} onChange={setQuery} placeholder="일정 이름 · 목적지 · 숙소 검색" aria-label="일정 검색" disabled={!ready} />
                        <AdminChipGroup label="지역" items={chipItems} value={active} onChange={setActive} />
                        <span className="it-cat-tools">
                            {activeCat && (
                                <>
                                    <AdminTextButton tone="assistive" size="sm" disabled={saving} onClick={() => setCatEditor({ from: activeCat, value: activeCat })}>지역 이름 바꾸기</AdminTextButton>
                                    <AdminTextButton tone="assistive" size="sm" disabled={saving} onClick={() => void removeCategory(activeCat)}>지역 삭제</AdminTextButton>
                                </>
                            )}
                            <AdminTextButton tone="primary" size="sm" leading={<IconPlus />} disabled={!ready || saving} onClick={() => setCatEditor({ from: null, value: '' })}>지역 추가</AdminTextButton>
                        </span>
                        <span className="it-count" role="status"><b>{ready ? rows.length : '–'}</b>개</span>
                    </div>
                    {body}
                    <p className="it-note">세부 일정은 한 줄에 한 항목입니다. 줄 앞에 <b>*</b>를 붙이면 강조, <b>(</b>로 시작하면 회색으로 견적서에 보입니다. 지역을 삭제해도 그 지역의 일정은 ‘{UNCAT}’로 옮겨질 뿐 지워지지 않습니다.</p>
                </AdminCard>
            </div>

            <AdminDialog
                open={!!editor}
                onClose={closeEditor}
                title={editing === null ? '새 일정 추가' : '일정 편집'}
                dirty={!!editor && JSON.stringify(editor.form) !== editor.initial}
                onSubmit={() => void saveEditor()}
                submitLabel={editing === null ? '추가하기' : '저장하기'}
                submitting={saving}
                submitDisabled={!editor?.form.name.trim() || (editor?.form.cat === NEW_CAT && !editor.newCat.trim())}
                onDelete={editing === null ? undefined : () => { void deleteSnippet(editing).then((ok) => { if (ok) setEditor(null); }); }}
                deleteLabel="일정 삭제"
            >
                {editor && (
                    <>
                        <AdminField id="it-name" label="일정 이름" required hint="견적서 만들기의 ‘일정 불러오기’ 목록에 이 이름으로 보입니다.">
                            <AdminTextInput id="it-name" placeholder="예: 홍고린엘스 사막투어" value={editor.form.name} onChange={(e) => setForm({ name: e.target.value })} />
                        </AdminField>
                        <div className="it-grid">
                            <AdminField id="it-cat" label="지역">
                                <AdminSelect id="it-cat" value={editor.form.cat} options={catOptions} onChange={(value) => setForm({ cat: value })} />
                            </AdminField>
                            {editor.form.cat === NEW_CAT && (
                                <AdminField id="it-newcat" label="새 지역 이름" required>
                                    <AdminTextInput id="it-newcat" placeholder="예: 고비" value={editor.newCat} onChange={(e) => setEditor({ ...editor, newCat: e.target.value })} />
                                </AdminField>
                            )}
                        </div>
                        <div className="it-grid">
                            <AdminField id="it-dest" label="목적지">
                                <AdminTextInput id="it-dest" placeholder="예: 홍고린엘스" value={editor.form.dest} onChange={(e) => setForm({ dest: e.target.value })} />
                            </AdminField>
                            <AdminField id="it-move" label="이동(시간·거리)" hint="거리는 괄호 안에 적어요.">
                                <AdminTextInput id="it-move" placeholder="예: 이동 5시간 (250 km)" value={editor.form.move} onChange={(e) => setForm({ move: e.target.value })} />
                            </AdminField>
                        </div>
                        <AdminField id="it-items" label="세부 일정" hint="한 줄에 한 항목. 줄 앞에 * → 강조, ( → 회색으로 보입니다.">
                            <AdminTextArea id="it-items" minRows={6} placeholder={'예:\n아침식사 후 출발\n*캠프파이어 (현지 상황에 따라 진행)\n(선셋투어, 모래썰매)'} value={editor.form.items} onChange={(e) => setForm({ items: e.target.value })} />
                        </AdminField>
                        <div className="it-grid">
                            <AdminField id="it-stay" label="숙소">
                                <AdminTextInput id="it-stay" placeholder="예: 여행자 캠프" value={editor.form.stay} onChange={(e) => setForm({ stay: e.target.value })} />
                            </AdminField>
                            <AdminField id="it-tags" label="숙소 태그" hint="쉼표로 나눠요.">
                                <AdminTextInput id="it-tags" placeholder="예: 전기 O, 샤워 O" value={editor.form.tags} onChange={(e) => setForm({ tags: e.target.value })} />
                            </AdminField>
                        </div>
                        <div className="it-grid is-3">
                            <AdminField id="it-breakfast" label="조식">
                                <AdminTextInput id="it-breakfast" placeholder="예: 캠프식" value={editor.form.breakfast} onChange={(e) => setForm({ breakfast: e.target.value })} />
                            </AdminField>
                            <AdminField id="it-lunch" label="중식">
                                <AdminTextInput id="it-lunch" placeholder="예: 현지식당" value={editor.form.lunch} onChange={(e) => setForm({ lunch: e.target.value })} />
                            </AdminField>
                            <AdminField id="it-dinner" label="석식">
                                <AdminTextInput id="it-dinner" placeholder="예: 캠프식" value={editor.form.dinner} onChange={(e) => setForm({ dinner: e.target.value })} />
                            </AdminField>
                        </div>
                    </>
                )}
            </AdminDialog>

            <AdminDialog
                open={!!catEditor}
                onClose={() => { if (!savingRef.current) setCatEditor(null); }}
                title={catEditor?.from ? '지역 이름 바꾸기' : '지역 추가'}
                size="sm"
                dirty={!!catEditor && catEditor.value.trim() !== (catEditor.from ?? '')}
                onSubmit={() => void saveCategory()}
                submitLabel={catEditor?.from ? '바꾸기' : '추가하기'}
                submitting={saving}
                submitDisabled={!catEditor?.value.trim()}
            >
                {catEditor && (
                    <AdminField id="it-cat-name" label="지역 이름" required
                        hint={catEditor.from && countIn(library, catEditor.from) ? `이 지역의 일정 ${countIn(library, catEditor.from)}개도 새 이름으로 옮겨집니다.` : '일정을 지역별로 묶어 볼 수 있어요.'}>
                        <AdminTextInput id="it-cat-name" placeholder="예: 중앙몽골" value={catEditor.value} onChange={(e) => setCatEditor({ ...catEditor, value: e.target.value })} />
                    </AdminField>
                )}
            </AdminDialog>
        </AdminLayout>
    );
};

export default AdminItineraryManage;
