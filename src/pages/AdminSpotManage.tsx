import React, { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import {
    AdminBadge, AdminButton, AdminCard, AdminCheckbox, AdminChipGroup, AdminDialog, AdminEmpty, AdminError, AdminField, AdminFileButton,
    AdminIconButton, AdminLoading, AdminSearch, AdminSelect, AdminTable, AdminTbody, AdminTd, AdminTextArea, AdminTextButton,
    AdminTextInput, AdminTh, AdminThead, AdminTr,
} from '../components/admin/ui';
import { IconImage, IconPencil, IconPlus, IconTrash } from '@montage-ui/icon';
import { adminConfirm, adminNotify } from '../components/admin/ui/adminFeedback';
import { adminValidateRequired } from '../components/admin/ui/adminForm';
import { quoteDeskPageId } from '../components/admin/quoteDesk';
import { loadFallbackSpots } from '../components/admin/quoteLibrary';
import { uploadQuoteImage } from '../components/admin/quoteLibraryStore';
import { useQuoteLibrary } from '../components/admin/useQuoteLibrary';
import { ALL, NONE, UNCAT, categoryNameProblem } from '../components/admin/itinerarySnippets';
import {
    PHOTO, SUB_SLOTS, aliasList, applyCopyChanges, copyChanges, countNeedsPhoto, countNoRegion, countRegion, deleteRegion, filterSpots,
    formFromSpot, mergeRegions, needsPhoto, photoCount, putSpot, readSpots, regionOf, removeSpot, renameRegion, spotFromForm,
    type CopyChange, type SpotForm, type SpotLibrary,
} from '../components/admin/spotLibrary';
import './AdminSpotManage.css';

const NEW_REGION = '__new';
/** 옛 도구와 같은 크기·화질로 줄여 올린다(대표 1000px, 추가 500px) */
const MAIN_PHOTO = { maxPixels: 1000, quality: 0.82 };
const SUB_PHOTO = { maxPixels: 500, quality: 0.72 };

interface Editor { previousName: string | null; form: SpotForm; newRegion: string; initial: string }
interface RegionEditor { from: string | null; value: string }
interface CopyImport { loading: boolean; error: string; changes: CopyChange[]; picked: boolean[] }

const problemText = (problem: ReturnType<typeof categoryNameProblem>) =>
    problem === 'empty' ? '지역 이름을 입력해 주세요.'
    : problem === 'reserved' ? `‘${UNCAT}’은(는) 쓸 수 없는 이름입니다.`
    : problem === 'duplicate' ? '이미 있는 지역입니다.' : '';

const changeTitle = (change: CopyChange) =>
    change.kind === 'new' ? `새 여행지 · ${change.region || UNCAT}` : change.kind === 'short' ? (change.before ? '한 줄 소개 바꾸기' : '한 줄 소개 채우기') : '다른 이름 추가';

/**
 * 여행지 관리(/admin/quote-desk/spots) — 옛 견적 도구 `public/명소관리.html`을 React로 옮긴 화면.
 * 목록형 기준: 머리(‘문구 초안 가져오기’·‘새 여행지 추가’) → 카드 하나 안에 검색·지역 칩(사진 필요 포함) → 표.
 * 저장은 옛 도구와 같은 `/api/data/spots`·`spot_cats`, 사진은 같은 `/api/upload?folder=images`(WebP).
 */
export const AdminSpotManage: React.FC = () => {
    const { phase, loadError, map: library, cats, saving, load, persist, isSaving, token } = useQuoteLibrary<SpotLibrary>({
        mapKey: 'spots', catsKey: 'spot_cats', readMap: readSpots, mergeCats: mergeRegions, fallback: loadFallbackSpots,
    });
    const [active, setActive] = useState(ALL);
    const [query, setQuery] = useState('');
    const [editor, setEditor] = useState<Editor | null>(null);
    const [uploading, setUploading] = useState<string | null>(null);
    const [regionEditor, setRegionEditor] = useState<RegionEditor | null>(null);
    const [copyImport, setCopyImport] = useState<CopyImport | null>(null);
    useEffect(() => { if (active !== ALL && active !== NONE && active !== PHOTO && !cats.includes(active)) setActive(ALL); }, [cats, active]);

    /* ── 여행지 추가·편집 ── */
    const openEditor = (name: string | null) => {
        const defaultRegion = name === null && active !== ALL && active !== NONE && active !== PHOTO ? active : '';
        const form = formFromSpot(name ?? '', name === null ? undefined : library[name], defaultRegion);
        setEditor({ previousName: name, form, newRegion: '', initial: JSON.stringify(form) });
    };
    const setForm = (patch: Partial<SpotForm>) => setEditor((current) => (current ? { ...current, form: { ...current.form, ...patch } } : current));
    const closeEditor = () => {
        if (isSaving()) return;
        if (uploading) { adminNotify('사진을 다 올린 뒤 닫아 주세요.'); return; }
        setEditor(null);
    };

    /** slot: 'main' 또는 추가 사진 번호 */
    const upload = async (slot: 'main' | number, files: File[]) => {
        const file = files[0];
        if (!file || uploading) return;
        const key = String(slot);
        setUploading(key);
        try {
            const size = slot === 'main' ? MAIN_PHOTO : SUB_PHOTO;
            const url = await uploadQuoteImage(file, token(), size.maxPixels, size.quality);
            setEditor((current) => {
                if (!current) return current;
                if (slot === 'main') return { ...current, form: { ...current.form, img: url } };
                const subImgs = [...current.form.subImgs]; subImgs[slot] = url;
                return { ...current, form: { ...current.form, subImgs } };
            });
        } catch (error) {
            adminNotify(error instanceof Error ? error.message : '사진을 올리지 못했습니다.');
        } finally {
            setUploading(null);
        }
    };
    const clearSub = (index: number) => setEditor((current) => {
        if (!current) return current;
        const subImgs = [...current.form.subImgs]; subImgs[index] = '';
        return { ...current, form: { ...current.form, subImgs } };
    });

    const saveEditor = async () => {
        if (!editor || uploading) return;
        if (!adminValidateRequired()) return;
        const name = editor.form.name.trim();
        if (!name) return;
        if (name !== editor.previousName && library[name]) { adminNotify('같은 이름의 여행지가 이미 있습니다. 다른 이름을 입력해 주세요.'); return; }
        let region = editor.form.region;
        let nextCats: string[] | undefined;
        if (region === NEW_REGION) {
            const problem = categoryNameProblem(editor.newRegion, cats);
            if (problem && problem !== 'duplicate') { adminNotify(problemText(problem)); return; }
            region = editor.newRegion.trim();
            if (!cats.includes(region)) nextCats = [...cats, region];
        }
        const original = editor.previousName === null ? undefined : library[editor.previousName];
        const spot = spotFromForm({ ...editor.form, name, region }, original);
        if (!await persist({ map: putSpot(library, editor.previousName, name, spot), cats: nextCats })) return;
        setEditor(null);
        if (editor.previousName === null && region) setActive(region);
        adminNotify(editor.previousName === null ? '여행지를 추가했습니다.' : '저장했습니다.');
    };

    const deleteSpot = async (name: string) => {
        if (!await adminConfirm({ title: '여행지 삭제', message: `‘${name}’ 여행지를 삭제할까요? 이미 저장된 견적서·상품 일정표에 담긴 사진과 소개는 그대로입니다.`, confirmLabel: '삭제', danger: true })) return false;
        const ok = await persist({ map: removeSpot(library, name) });
        if (ok) adminNotify('삭제했습니다.');
        return ok;
    };

    /* ── 지역 ── */
    const saveRegion = async () => {
        if (!regionEditor) return;
        const problem = categoryNameProblem(regionEditor.value, cats, regionEditor.from ?? undefined);
        if (problem) { adminNotify(problemText(problem)); return; }
        const name = regionEditor.value.trim();
        if (regionEditor.from === null) {
            if (!await persist({ cats: [...cats, name] })) return;
            setActive(name);
            adminNotify(`‘${name}’ 지역을 추가했습니다.`);
        } else if (name !== regionEditor.from) {
            const next = renameRegion(library, cats, regionEditor.from, name);
            const moved = countRegion(library, regionEditor.from) > 0;
            if (!await persist({ map: moved ? next.library : undefined, cats: next.cats })) return;
            if (active === regionEditor.from) setActive(name);
            adminNotify('지역 이름을 바꿨습니다.');
        }
        setRegionEditor(null);
    };
    const removeRegion = async (region: string) => {
        const count = countRegion(library, region);
        const message = count
            ? `‘${region}’ 지역을 삭제할까요? 이 지역의 여행지 ${count}곳은 ‘${UNCAT}’로 옮겨지고, 여행지는 지워지지 않습니다.`
            : `‘${region}’ 지역을 삭제할까요?`;
        if (!await adminConfirm({ title: '지역 삭제', message, confirmLabel: '삭제', danger: true })) return;
        const next = deleteRegion(library, cats, region);
        if (!await persist({ map: count ? next.library : undefined, cats: next.cats })) return;
        if (active === region) setActive(ALL);
        adminNotify('지역을 삭제했습니다.');
    };

    /* ── 문구 초안 가져오기 ── */
    const openCopyImport = async () => {
        setCopyImport({ loading: true, error: '', changes: [], picked: [] });
        try {
            const res = await fetch('/spot-copy-draft.json', { cache: 'no-store' });
            if (!res.ok) throw new Error(`(${res.status})`);
            const changes = copyChanges(await res.json(), library);
            setCopyImport({ loading: false, error: '', changes, picked: changes.map(() => true) });
        } catch (error) {
            setCopyImport({ loading: false, error: `문구 초안 파일을 읽지 못했습니다 ${error instanceof Error ? error.message : ''}`.trim(), changes: [], picked: [] });
        }
    };
    const applyCopy = async () => {
        if (!copyImport) return;
        const picked = copyImport.changes.filter((_, i) => copyImport.picked[i]);
        if (!picked.length) return;
        const next = applyCopyChanges(library, cats, picked);
        if (!await persist({ map: next.library, cats: next.cats.length !== cats.length ? next.cats : undefined })) return;
        setCopyImport(null);
        if (Object.values(next.library).some(needsPhoto)) setActive(PHOTO);
        adminNotify(`${picked.length}건을 반영했습니다.`);
    };

    const rows = useMemo(() => filterSpots(library, active, query), [library, active, query]);
    const total = Object.keys(library).length;
    const noneCount = countNoRegion(library);
    const photoNeeded = countNeedsPhoto(library);
    const chipItems = [
        { value: ALL, label: '전체', count: total },
        ...cats.map((cat) => ({ value: cat, label: cat, count: countRegion(library, cat) })),
        ...(noneCount ? [{ value: NONE, label: UNCAT, count: noneCount }] : []),
        ...(photoNeeded || active === PHOTO ? [{ value: PHOTO, label: '사진 필요', count: photoNeeded }] : []),
    ];
    const activeRegion = active !== ALL && active !== NONE && active !== PHOTO ? active : '';
    const ready = phase === 'ready';

    const body = phase === 'connecting' || phase === 'loading' ? <AdminLoading label="여행지를 불러오는 중…" />
        : phase === 'unset' ? <AdminError title="견적 데스크가 연결되지 않았어요" reason="서버에 견적 관리자 값(ADMIN_TOKEN)이 설정되어 있어야 여행지를 불러오고 저장할 수 있습니다." />
        : phase === 'error' ? <AdminError reason={loadError} onRetry={() => void load()} />
        : rows.length === 0 ? (
            <AdminEmpty
                title={active === PHOTO ? '사진이 필요한 여행지가 없어요.' : total ? '조건에 맞는 여행지가 없어요.' : '등록된 여행지가 없어요.'}
                description={active === PHOTO ? '모든 여행지에 사진이 두 장 이상 있어요.' : total ? '검색어나 지역을 바꿔 보세요.' : '‘새 여행지 추가’로 여행지 사진과 소개를 등록하세요.'}
            />
        ) : (
            <AdminTable label="여행지 목록" className="sp-table">
                <AdminThead>
                    <AdminTr>
                        <AdminTh className="sp-c-photo">사진</AdminTh>
                        <AdminTh>여행지</AdminTh>
                        <AdminTh>한 줄 소개</AdminTh>
                        <AdminTh className="sp-c-alias">다른 이름</AdminTh>
                        <AdminTh align="center" className="sp-c-count">사진 수</AdminTh>
                        <AdminTh align="right" className="sp-c-actions">관리</AdminTh>
                    </AdminTr>
                </AdminThead>
                <AdminTbody>
                    {rows.map(([name, spot]) => {
                        const region = regionOf(spot);
                        const aliases = aliasList(spot.aliases);
                        const count = photoCount(spot);
                        return (
                            <AdminTr key={name}>
                                <AdminTd className="sp-c-photo">
                                    {spot.img ? <img className="sp-thumb" src={String(spot.img)} alt="" loading="lazy" /> : <span className="sp-thumb is-empty" aria-hidden="true"><IconImage /></span>}
                                </AdminTd>
                                <AdminTd className="sp-name">
                                    <span className="sp-stack">
                                        <AdminTextButton className="sp-name-btn" onClick={() => openEditor(name)}>{name}</AdminTextButton>
                                        {spot.nameMn && <span className="sp-sub">{String(spot.nameMn)}</span>}
                                        {region ? <AdminBadge tone="tag-cyan">{region}</AdminBadge> : <AdminBadge outlined>{UNCAT}</AdminBadge>}
                                    </span>
                                </AdminTd>
                                <AdminTd className="sp-short">{String(spot.short || '') || <span className="sp-sub">{spot.desc ? String(spot.desc).slice(0, 60) : '설명을 추가하세요'}</span>}</AdminTd>
                                <AdminTd className="sp-c-alias">{aliases.length ? aliases.join(', ') : <span className="sp-sub">—</span>}</AdminTd>
                                <AdminTd align="center" className="sp-c-count">
                                    {needsPhoto(spot) ? <AdminBadge tone="warn">{count}/2</AdminBadge> : <span className="sp-count">{count}장</span>}
                                </AdminTd>
                                <AdminTd align="right" className="sp-c-actions">
                                    <span className="sp-actions">
                                        <AdminIconButton size="sm" label={`${name} 편집`} onClick={() => openEditor(name)}><IconPencil /></AdminIconButton>
                                        <AdminIconButton size="sm" label={`${name} 삭제`} className="sp-danger" disabled={saving} onClick={() => void deleteSpot(name)}><IconTrash /></AdminIconButton>
                                    </span>
                                </AdminTd>
                            </AdminTr>
                        );
                    })}
                </AdminTbody>
            </AdminTable>
        );

    const editing = editor?.previousName ?? null;
    const regionOptions = [
        { value: '', label: `${UNCAT} (지역 미지정)` },
        ...cats.map((cat) => ({ value: cat, label: cat })),
        { value: NEW_REGION, label: '＋ 새 지역 만들기' },
    ];
    const pickedCount = copyImport ? copyImport.picked.filter(Boolean).length : 0;

    return (
        <AdminLayout
            activePage={quoteDeskPageId('spots')}
            title="여행지 관리"
            description="상품·예약 일정표와 견적에서 함께 쓰는 여행지 사진과 설명을 관리합니다."
            actions={(
                <>
                    <AdminButton variant="secondary" disabled={!ready || saving} onClick={() => void openCopyImport()}>문구 초안 가져오기</AdminButton>
                    <AdminButton variant="primary" leading={<IconPlus />} disabled={!ready} onClick={() => openEditor(null)}>새 여행지 추가</AdminButton>
                </>
            )}
        >
            <div className="sp-page">
                <AdminCard flush className="sp-card">
                    <div className="sp-filters">
                        <AdminSearch value={query} onChange={setQuery} placeholder="여행지 · 몽골어 지명 · 다른 이름 검색" aria-label="여행지 검색" disabled={!ready} />
                        <AdminChipGroup label="지역" items={chipItems} value={active} onChange={setActive} />
                        <span className="sp-region-tools">
                            {activeRegion && (
                                <>
                                    <AdminTextButton tone="assistive" size="sm" disabled={saving} onClick={() => setRegionEditor({ from: activeRegion, value: activeRegion })}>지역 이름 바꾸기</AdminTextButton>
                                    <AdminTextButton tone="assistive" size="sm" disabled={saving} onClick={() => void removeRegion(activeRegion)}>지역 삭제</AdminTextButton>
                                </>
                            )}
                            <AdminTextButton tone="primary" size="sm" leading={<IconPlus />} disabled={!ready || saving} onClick={() => setRegionEditor({ from: null, value: '' })}>지역 추가</AdminTextButton>
                        </span>
                        <span className="sp-count-all" role="status"><b>{ready ? rows.length : '–'}</b>곳</span>
                    </div>
                    {body}
                    <p className="sp-note">일정표에는 여행지마다 사진 두 장(대표 + 추가 1장)이 나옵니다. 사진이 두 장보다 적은 여행지는 ‘사진 필요’에 모입니다. 다른 이름을 적어 두면 코스 일정에 그 이름으로 적혀 있어도 이 여행지의 사진·소개가 붙습니다.</p>
                </AdminCard>
            </div>

            <AdminDialog
                open={!!editor}
                onClose={closeEditor}
                title={editing === null ? '새 여행지 추가' : '여행지 편집'}
                dirty={!!editor && JSON.stringify(editor.form) !== editor.initial}
                onSubmit={() => void saveEditor()}
                submitLabel={editing === null ? '추가하기' : '저장하기'}
                submitting={saving}
                submitDisabled={!!uploading || !editor?.form.name.trim() || (editor?.form.region === NEW_REGION && !editor.newRegion.trim())}
                onDelete={editing === null ? undefined : () => { void deleteSpot(editing).then((ok) => { if (ok) setEditor(null); }); }}
                deleteLabel="여행지 삭제"
            >
                {editor && (
                    <>
                        <AdminField id="sp-main" label="대표 사진" hint="큰 사진은 가로 1000px WebP로 줄여 올립니다. 가로 사진을 권장해요.">
                            <div className="sp-main-photo">
                                {editor.form.img
                                    ? <img src={editor.form.img} alt="대표 사진" />
                                    : <span className="sp-main-empty" aria-hidden="true"><IconImage /></span>}
                                <span className="sp-photo-tools">
                                    <AdminFileButton accept="image/*" size="sm" leading={<IconImage />} loading={uploading === 'main'} disabled={!!uploading && uploading !== 'main'}
                                        onFiles={(files) => void upload('main', files)}>{editor.form.img ? '사진 바꾸기' : '사진 올리기'}</AdminFileButton>
                                    {editor.form.img && <AdminTextButton tone="assistive" size="sm" disabled={!!uploading} onClick={() => setForm({ img: '' })}>빼기</AdminTextButton>}
                                </span>
                            </div>
                        </AdminField>
                        <AdminField id="sp-subs" label={`추가 사진 ${SUB_SLOTS}장(선택)`} hint="견적서 대표 명소의 작은 사진들. 일정표에는 대표 사진 다음 한 장이 함께 나옵니다.">
                            <div className="sp-subs">
                                {editor.form.subImgs.map((url, index) => (
                                    <figure key={index} className="sp-sub-slot">
                                        {url ? <img src={url} alt={`추가 사진 ${index + 1}`} /> : <span className="sp-sub-empty" aria-hidden="true"><IconImage /></span>}
                                        {url
                                            ? <AdminIconButton size="sm" label={`추가 사진 ${index + 1} 빼기`} className="sp-danger" disabled={!!uploading} onClick={() => clearSub(index)}><IconTrash /></AdminIconButton>
                                            : <AdminFileButton accept="image/*" size="sm" variant="weak" loading={uploading === String(index)} disabled={!!uploading && uploading !== String(index)}
                                                aria-label={`추가 사진 ${index + 1} 올리기`} onFiles={(files) => void upload(index, files)}>올리기</AdminFileButton>}
                                    </figure>
                                ))}
                            </div>
                        </AdminField>
                        <AdminField id="sp-name" label="여행지 이름(한글)" required>
                            <AdminTextInput id="sp-name" placeholder="예: 차강소브라가" value={editor.form.name} onChange={(e) => setForm({ name: e.target.value })} />
                        </AdminField>
                        <div className="sp-grid">
                            <AdminField id="sp-mn" label="몽골어 지명">
                                <AdminTextInput id="sp-mn" placeholder="예: Цагаан суварга" value={editor.form.nameMn} onChange={(e) => setForm({ nameMn: e.target.value })} />
                            </AdminField>
                            <AdminField id="sp-region" label="지역">
                                <AdminSelect id="sp-region" value={editor.form.region} options={regionOptions} onChange={(value) => setForm({ region: value })} />
                            </AdminField>
                        </div>
                        {editor.form.region === NEW_REGION && (
                            <AdminField id="sp-newregion" label="새 지역 이름" required>
                                <AdminTextInput id="sp-newregion" placeholder="예: 고비" value={editor.newRegion} onChange={(e) => setEditor({ ...editor, newRegion: e.target.value })} />
                            </AdminField>
                        )}
                        <AdminField id="sp-short" label="한 줄 소개" hint="카드·지도와 상품 일정표의 항목 설명에 나옵니다.">
                            <AdminTextInput id="sp-short" placeholder="예: ‘하얀 탑’ 침식지형" value={editor.form.short} onChange={(e) => setForm({ short: e.target.value })} />
                        </AdminField>
                        <AdminField id="sp-aliases" label="다른 이름" hint="쉼표로 나눠요. 코스 일정에 이렇게 적혀 있어도 이 여행지의 사진·소개가 붙습니다.">
                            <AdminTextInput id="sp-aliases" placeholder="예: 미니사막, 미니고비" value={editor.form.aliases} onChange={(e) => setForm({ aliases: e.target.value })} />
                        </AdminField>
                        <AdminField id="sp-desc" label="상세 설명" hint="견적서에 나옵니다.">
                            <AdminTextArea id="sp-desc" minRows={4} placeholder="여행지에 대한 설명을 적어 주세요." value={editor.form.desc} onChange={(e) => setForm({ desc: e.target.value })} />
                        </AdminField>
                        <div className="sp-grid">
                            <AdminField id="sp-lat" label="위도(지도용, 선택)">
                                <AdminTextInput id="sp-lat" inputMode="decimal" placeholder="44.7086" value={editor.form.lat} onChange={(e) => setForm({ lat: e.target.value })} />
                            </AdminField>
                            <AdminField id="sp-lng" label="경도(지도용, 선택)">
                                <AdminTextInput id="sp-lng" inputMode="decimal" placeholder="105.7469" value={editor.form.lng} onChange={(e) => setForm({ lng: e.target.value })} />
                            </AdminField>
                        </div>
                    </>
                )}
            </AdminDialog>

            <AdminDialog
                open={!!regionEditor}
                onClose={() => { if (!isSaving()) setRegionEditor(null); }}
                title={regionEditor?.from ? '지역 이름 바꾸기' : '지역 추가'}
                size="sm"
                dirty={!!regionEditor && regionEditor.value.trim() !== (regionEditor.from ?? '')}
                onSubmit={() => void saveRegion()}
                submitLabel={regionEditor?.from ? '바꾸기' : '추가하기'}
                submitting={saving}
                submitDisabled={!regionEditor?.value.trim()}
            >
                {regionEditor && (
                    <AdminField id="sp-region-name" label="지역 이름" required
                        hint={regionEditor.from && countRegion(library, regionEditor.from) ? `이 지역의 여행지 ${countRegion(library, regionEditor.from)}곳도 새 이름으로 옮겨집니다.` : '여행지를 지역별로 묶어 볼 수 있어요.'}>
                        <AdminTextInput id="sp-region-name" placeholder="예: 중앙몽골" value={regionEditor.value} onChange={(e) => setRegionEditor({ ...regionEditor, value: e.target.value })} />
                    </AdminField>
                )}
            </AdminDialog>

            <AdminDialog
                open={!!copyImport}
                onClose={() => { if (!isSaving()) setCopyImport(null); }}
                title="문구 초안 가져오기"
                description="반영할 항목만 고르세요. 사진과 상세 설명은 바뀌지 않습니다. 새 여행지는 사진 없이 만들어지고 ‘사진 필요’에 모입니다."
                onSubmit={copyImport?.changes.length ? () => void applyCopy() : undefined}
                submitLabel={`선택한 ${pickedCount}건 반영하기`}
                submitting={saving}
                submitDisabled={!pickedCount}
            >
                {copyImport?.loading ? <AdminLoading label="문구 초안을 읽는 중…" />
                    : copyImport?.error ? <AdminError reason={copyImport.error} onRetry={() => void openCopyImport()} />
                    : copyImport && !copyImport.changes.length ? <AdminEmpty title="반영할 내용이 없어요." description="문구 초안이 이미 모두 적용되어 있어요." />
                    : copyImport && (
                        <div className="sp-copy">
                            <AdminCheckbox
                                label={`전체 선택 (${copyImport.changes.length}건)`}
                                checked={pickedCount === copyImport.changes.length}
                                indeterminate={pickedCount > 0 && pickedCount < copyImport.changes.length}
                                onChange={(checked) => setCopyImport({ ...copyImport, picked: copyImport.changes.map(() => checked) })}
                            />
                            <ul className="sp-copy-list">
                                {copyImport.changes.map((change, i) => (
                                    <li key={`${change.name}-${change.kind}`} className="sp-copy-item">
                                        <AdminCheckbox
                                            aria-label={`${change.name} ${changeTitle(change)}`}
                                            checked={copyImport.picked[i]}
                                            onChange={(checked) => setCopyImport({ ...copyImport, picked: copyImport.picked.map((value, j) => (j === i ? checked : value)) })}
                                        />
                                        <span className="sp-copy-text">
                                            <b>{change.name}</b>
                                            <span className="sp-copy-kind">{changeTitle(change)}</span>
                                            {change.kind === 'aliases' ? <span>{change.aliases.join(', ')}</span> : <span>{change.short}</span>}
                                            {change.kind === 'short' && change.before && <s className="sp-sub">{change.before}</s>}
                                            {change.kind === 'new' && change.aliases.length > 0 && <span className="sp-sub">다른 이름: {change.aliases.join(', ')}</span>}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
            </AdminDialog>
        </AdminLayout>
    );
};

export default AdminSpotManage;
