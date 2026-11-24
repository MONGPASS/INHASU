import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminLayout } from '../components/admin/AdminLayout';
import { GuideSchedule } from '../components/admin/guides/GuideSchedule';
import {
    AdminBadge, AdminButton, AdminCard, AdminChip, AdminChipGroup, AdminDialog, AdminEmpty, AdminError, AdminField, AdminIconButton,
    AdminLoading, AdminSegmented, AdminSelect, AdminTable, AdminTabs, AdminTbody, AdminTd, AdminTextArea, AdminTextButton, AdminTextInput,
    AdminTh, AdminThead, AdminTr, IconChevronRight, IconImage, IconPencil, IconPlus, IconTrash,
} from '../components/admin/ui';
import { adminConfirm, adminNotify } from '../components/admin/ui/adminFeedback';
import { adminValidateRequired } from '../components/admin/ui/adminForm';
import { quoteDeskPageId, resourceScheduleView } from '../components/admin/quoteDesk';
import { uploadQuoteImage } from '../components/admin/quoteLibraryStore';
import { useQuoteLibrary } from '../components/admin/useQuoteLibrary';
import { useUser } from '../contexts/UserContext';
import {
    ALL, DEFAULT_LODGE_CATS, KINDS, LODGE_UNCAT, NONE, RESOURCE_KINDS, catNameProblem, chipValues, countUsage, coverOf, deleteLodgeCat,
    entriesInRegion, formFromResource, introMissing, introOf, lodgeCatCount, lodgeCatOf, lodgeNoneCount, mergeLodgeCats, officialSourcesValid,
    photoState, putResource, readResources, removeResource, renameLodgeCat, resourceFromForm, typeChoices, typeTone, usageText,
    type ResourceForm, type ResourceKind, type ResourceLibrary, type ResourceUsage,
} from '../components/admin/resourceRegistry';
import { imageUrl } from '../utils/lodgingDisplay';
import './AdminResourceManage.css';

const VIEW_KEY = 'leaders_resource_view';
const NEW_REGION = '__new';
type CardView = 'card' | 'list';

const readLocal = (key: string): unknown => { try { return JSON.parse(window.localStorage.getItem(key) ?? 'null'); } catch { return null; } };
/** 서버에 자료가 없을 때 옛 도구처럼 이 브라우저 저장분(없으면 빈 목록) */
const localLibrary = (kind: ResourceKind) => async () => {
    const saved = readLocal(`leaders_${kind}`);
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
};
const localLodgeCats = () => {
    const saved = readLocal('leaders_lodge_cats');
    return Array.isArray(saved) && saved.every((item) => typeof item === 'string') ? saved as string[] : DEFAULT_LODGE_CATS.slice();
};
const kindParam = (value: string | null): ResourceKind => (RESOURCE_KINDS.includes(value as ResourceKind) ? value as ResourceKind : 'guides');

interface Editor {
    kind: ResourceKind;
    previousName: string | null;
    form: ResourceForm;
    initial: string;
    /** 숙소 보관 사진(대표가 아니어도 지우지 않는다) */
    pool: string[];
    /** 차량의 4번째 이후 사진(보관) */
    extraPhotos: string[];
    newRegion: string;
}
interface CatEditor { from: string | null; value: string }

const catProblemText = (problem: ReturnType<typeof catNameProblem>) =>
    problem === 'empty' ? '지역 이름을 입력해 주세요.'
    : problem === 'reserved' ? `‘${LODGE_UNCAT}’은(는) 쓸 수 없는 이름입니다.`
    : problem === 'duplicate' ? '이미 있는 지역입니다.' : '';

/** 칩으로 고르고(다시 누르면 비움) 필요하면 직접 적는 칸 — 옛 도구의 종류 칩과 같은 동작 */
const ChipPicker: React.FC<{ label: string; values: string[]; value: string; onChange: (value: string) => void; free?: boolean; placeholder?: string; hint?: string; id: string }> =
    ({ label, values, value, onChange, free, placeholder, hint, id }) => (
        <AdminField id={id} label={label} hint={hint}>
            <div className="rs-chips">
                <div className="rs-chip-row" role="group" aria-label={label}>
                    {values.map((item) => <AdminChip key={item} active={value.trim() === item} onClick={() => onChange(value.trim() === item ? '' : item)}>{item}</AdminChip>)}
                </div>
                {free && <AdminTextInput id={id} placeholder={placeholder || '목록에 없으면 직접 입력'} value={value} onChange={(e) => onChange(e.target.value)} />}
            </div>
        </AdminField>
    );

/**
 * 가이드·숙소·차량(/admin/quote-desk/resources) — ‘등록 정보’는 옛 견적 도구 `public/리소스관리.html`을 React로 옮긴 화면이고,
 * ‘가이드 배정 현황’은 기존 React 화면(GuideSchedule)이다. 저장은 옛 도구와 같은 `/api/data/guides`·`lodges`·`lodge_cats`·`vehicles`(충돌 확인 포함).
 * 예약 배정·확정 일정표·가이드 일정표가 같은 자료를 읽는다.
 */
export const AdminResourceManage: React.FC = () => {
    const [params, setParams] = useSearchParams();
    const { user } = useUser();
    const accountId = user?.role === 'admin' ? user.id : '';
    const schedule = resourceScheduleView(params);
    const setSchedule = (on: boolean) => { const next = new URLSearchParams(params); next.set('view', on ? 'schedule' : 'registry'); setParams(next, { replace: true }); };

    return (
        <AdminLayout
            activePage={quoteDeskPageId('resources')}
            /* 가이드·숙소·차량은 제목만 둔다(운영 요청으로 라벨·설명 제거) */
            eyebrow={null}
            title="가이드·숙소·차량"
            flush={schedule}
            titleAside={<AdminTabs size="lg" label="가이드·숙소·차량 화면" value={schedule ? 'schedule' : 'registry'} onChange={(v) => setSchedule(v === 'schedule')}
                items={[{ value: 'registry', label: '등록 정보' }, { value: 'schedule', label: '가이드 배정 현황' }]} />}
        >
            {schedule
                ? <div className="rs-schedule">{accountId && <GuideSchedule accountId={accountId} />}</div>
                : <ResourceRegistry initialKind={kindParam(params.get('resourceType'))} onKindChange={(kind) => { const next = new URLSearchParams(params); next.set('resourceType', kind); next.set('view', 'registry'); setParams(next, { replace: true }); }} />}
        </AdminLayout>
    );
};

const ResourceRegistry: React.FC<{ initialKind: ResourceKind; onKindChange: (kind: ResourceKind) => void }> = ({ initialKind, onKindChange }) => {
    const guides = useQuoteLibrary<ResourceLibrary>({ mapKey: 'guides', readMap: readResources, fallback: localLibrary('guides') });
    const lodges = useQuoteLibrary<ResourceLibrary>({
        mapKey: 'lodges', catsKey: 'lodge_cats', readMap: readResources, mergeCats: mergeLodgeCats, fallback: localLibrary('lodges'), catsFallback: localLodgeCats,
    });
    const vehicles = useQuoteLibrary<ResourceLibrary>({ mapKey: 'vehicles', readMap: readResources, fallback: localLibrary('vehicles') });
    const libs = { guides, lodges, vehicles };
    const [kind, setKind] = useState<ResourceKind>(initialKind);
    const current = libs[kind];
    const config = KINDS[kind];
    // 카드·목록 보기는 옛 도구와 같은 브라우저 값(‘list’ 글자 그대로)
    const [view, setView] = useState<CardView>(() => { try { return window.localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'card'; } catch { return 'card'; } });
    const [region, setRegion] = useState(ALL);
    const [typeFilter, setTypeFilter] = useState('');
    const [usage, setUsage] = useState<{ state: 'loading' | 'ok' | 'fail'; data?: ResourceUsage }>({ state: 'loading' });
    const [editor, setEditor] = useState<Editor | null>(null);
    const [catEditor, setCatEditor] = useState<CatEditor | null>(null);
    const [uploading, setUploading] = useState<number | 'qr' | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const qrInput = useRef<HTMLInputElement>(null);
    const pickSlot = useRef(0);

    // 이번 달 이용 현황 — 배정 API(상품·견적 예약 공통). 실패하면 상태 줄만 숨긴다.
    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/admin/assignments', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
            .then((res) => (res.ok ? res.json() : null))
            .then((body) => setUsage({ state: 'ok', data: countUsage(body?.items, new Date()) }))
            .catch(() => { if (!controller.signal.aborted) setUsage({ state: 'fail' }); });
        return () => controller.abort();
    }, []);
    // 다시 불러온 지역 목록에 지금 고른 지역이 없으면 전체로
    useEffect(() => { if (region !== ALL && region !== NONE && !lodges.cats.includes(region)) setRegion(ALL); }, [lodges.cats, region]);

    const chooseKind = (next: ResourceKind) => { if (next === kind) return; setKind(next); setTypeFilter(''); onKindChange(next); };
    const chooseView = (next: CardView) => { setView(next); try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* 저장소를 쓸 수 없는 창 */ } };

    const entries = useMemo(() => entriesInRegion(kind, current.map, region), [kind, current.map, region]);
    const types = useMemo(() => typeChoices(kind, entries), [kind, entries]);
    const items = typeFilter ? entries.filter(([, r]) => config.type(r) === typeFilter) : entries;
    const filtered = !!typeFilter || (kind === 'lodges' && region !== ALL);
    const ready = current.phase === 'ready';
    const status = (name: string) => (usage.state === 'loading' ? { on: false, text: '이용 현황 확인 중' } : usage.state === 'ok' && usage.data ? usageText(kind, usage.data, name) : { on: false, text: '' });

    /* ── 추가·편집 ── */
    const openEditor = (name: string | null) => {
        const record = name === null ? undefined : current.map[name];
        const defaultRegion = name === null && kind === 'lodges' && region !== ALL && region !== NONE ? region : '';
        const form = formFromResource(kind, name ?? '', record, defaultRegion);
        const photos = photoState(kind, record);
        setEditor({ kind, previousName: name, form, initial: JSON.stringify(form), pool: photos.pool, extraPhotos: photos.extra, newRegion: '' });
    };
    const setField = (key: string, value: string) => setEditor((e) => (e ? { ...e, form: { ...e.form, fields: { ...e.form.fields, [key]: value } } } : e));
    const setPhotos = (photos: string[]) => setEditor((e) => (e ? { ...e, form: { ...e.form, photos } } : e));
    const closeEditor = () => { if (uploading === null && !current.isSaving()) setEditor(null); };

    const upload = async (files: File[], slot: number) => {
        if (!editor || uploading !== null) return;
        const max = KINDS[editor.kind].maxPhotos;
        const images = files.filter((file) => /^image\//.test(file.type || ''));
        const replacing = slot < editor.form.photos.length;
        const room = max - editor.form.photos.length + (replacing ? 1 : 0);
        if (images.length > room) adminNotify(`사진은 최대 ${max}장이에요. 먼저 사진을 빼 주세요.`);
        const list = images.slice(0, Math.max(0, room));
        if (!list.length) return;
        setUploading(slot);
        try {
            let photos = [...editor.form.photos];
            const pool = [...editor.pool];
            for (const [n, file] of list.entries()) {
                const url = await uploadQuoteImage(file, libs[editor.kind].token(), 1200, 0.82);
                if (editor.kind === 'lodges' && !pool.includes(url)) pool.push(url);
                if (n === 0 && replacing) photos = photos.map((src, i) => (i === slot ? url : src)); else photos.push(url);
            }
            setEditor((e) => (e ? { ...e, pool, form: { ...e.form, photos } } : e));
        } catch (error) {
            adminNotify(error instanceof Error ? error.message : '사진을 올리지 못했습니다.');
        } finally { setUploading(null); }
    };
    const uploadQr = async (file: File | undefined) => {
        if (!file || !editor || uploading !== null) return;
        setUploading('qr');
        try { setField('qr', await uploadQuoteImage(file, guides.token(), 480, 0.9)); }
        catch (error) { adminNotify(error instanceof Error ? error.message : 'QR을 올리지 못했습니다.'); }
        finally { setUploading(null); }
    };

    const saveEditor = async () => {
        if (!editor) return;
        if (!adminValidateRequired()) return;
        const lib = libs[editor.kind];
        const name = editor.form.name.trim();
        if (!name) return;
        if (uploading !== null) { adminNotify('사진을 올리는 중이에요. 잠시 후 다시 눌러 주세요.'); return; }
        if (name !== editor.previousName && lib.map[name]) { adminNotify('이미 같은 이름이 있어요. 다른 이름을 입력해 주세요.'); return; }
        let fields = editor.form.fields;
        let nextCats: string[] | undefined;
        if (editor.kind === 'lodges') {
            if (!officialSourcesValid(fields.officialSources || '')) { adminNotify('공식 출처는 http/https 주소를 한 줄에 하나씩 입력해 주세요.'); return; }
            if (fields.region === NEW_REGION) {
                const problem = catNameProblem(editor.newRegion, lodges.cats);
                if (problem && problem !== 'duplicate') { adminNotify(catProblemText(problem)); return; }
                const regionName = editor.newRegion.trim();
                fields = { ...fields, region: regionName };
                if (!lodges.cats.includes(regionName)) nextCats = [...lodges.cats, regionName];
            }
        }
        const original = editor.previousName === null ? undefined : lib.map[editor.previousName];
        const record = resourceFromForm(editor.kind, { ...editor.form, name, fields }, original, { pool: editor.pool, extraPhotos: editor.extraPhotos });
        if (!await lib.persist({ map: putResource(lib.map, editor.previousName, name, record), cats: nextCats })) return;
        setEditor(null);
        if (editor.previousName === null && editor.kind === 'lodges' && lodgeCatOf(record)) setRegion(lodgeCatOf(record));
        adminNotify(editor.previousName === null ? `${name} 추가했어요.` : '저장했어요.', 'success');
    };
    const deleteResource = async (resourceKind: ResourceKind, name: string) => {
        if (!await adminConfirm({ title: `${KINDS[resourceKind].label} 삭제`, message: `‘${name}’을(를) 삭제할까요? 이미 배정된 예약의 기록은 그대로입니다.`, confirmLabel: '삭제', danger: true })) return false;
        const ok = await libs[resourceKind].persist({ map: removeResource(libs[resourceKind].map, name) });
        if (ok) adminNotify(`${name} 삭제했어요.`, 'success');
        return ok;
    };

    /* ── 숙소 지역 ── */
    const saveCategory = async () => {
        if (!catEditor) return;
        const problem = catNameProblem(catEditor.value, lodges.cats, catEditor.from ?? undefined);
        if (problem) { adminNotify(catProblemText(problem)); return; }
        const name = catEditor.value.trim();
        if (catEditor.from === null) {
            if (!await lodges.persist({ cats: [...lodges.cats, name] })) return;
            setRegion(name);
            adminNotify(`‘${name}’ 지역을 추가했어요.`, 'success');
        } else if (name !== catEditor.from) {
            const next = renameLodgeCat(lodges.map, lodges.cats, catEditor.from, name);
            const moved = lodgeCatCount(lodges.map, catEditor.from) > 0;
            if (!await lodges.persist({ map: moved ? next.lodges : undefined, cats: next.cats })) return;
            if (region === catEditor.from) setRegion(name);
            adminNotify('지역 이름을 바꿨어요.', 'success');
        }
        setCatEditor(null);
    };
    const removeCategory = async (cat: string) => {
        const count = lodgeCatCount(lodges.map, cat);
        const message = count ? `‘${cat}’ 지역을 삭제할까요? 이 지역의 숙소 ${count}개는 ‘${LODGE_UNCAT}’로 옮겨지고, 숙소는 지워지지 않습니다.` : `‘${cat}’ 지역을 삭제할까요?`;
        if (!await adminConfirm({ title: '지역 삭제', message, confirmLabel: '삭제', danger: true })) return;
        const next = deleteLodgeCat(lodges.map, lodges.cats, cat);
        if (!await lodges.persist({ map: count ? next.lodges : undefined, cats: next.cats })) return;
        if (region === cat) setRegion(ALL);
        adminNotify('지역을 삭제했어요.', 'success');
    };

    /* ── 목록 ── */
    const kindItems = RESOURCE_KINDS.map((k) => ({ value: k, label: KINDS[k].label, count: libs[k].phase === 'ready' ? Object.keys(libs[k].map).length : '–' }));
    const regionItems = [
        { value: ALL, label: '전체', count: Object.keys(lodges.map).length },
        ...lodges.cats.map((cat) => ({ value: cat, label: cat, count: lodgeCatCount(lodges.map, cat) })),
        ...(lodgeNoneCount(lodges.map) ? [{ value: NONE, label: LODGE_UNCAT, count: lodgeNoneCount(lodges.map) }] : []),
    ];
    const typeItems = [{ value: '', label: '전체', count: entries.length }, ...types.map((t) => ({ value: t, label: t, count: entries.filter(([, r]) => config.type(r) === t).length }))];
    const activeRegion = region !== ALL && region !== NONE ? region : '';
    const addLabel = `새 ${config.label} 추가`;

    const list = current.phase === 'connecting' || current.phase === 'loading' ? <AdminLoading label={`${config.label}를 불러오는 중…`} />
        : current.phase === 'unset' ? <AdminError title="견적 데스크가 연결되지 않았어요" reason="서버에 견적 관리자 값(ADMIN_TOKEN)이 설정되어 있어야 등록 정보를 불러오고 저장할 수 있습니다." />
        : current.phase === 'error' ? <AdminError reason={current.loadError} onRetry={() => void current.load()} />
        : items.length === 0 ? (
            <AdminEmpty title={filtered ? '조건에 맞는 항목이 없어요.' : `등록된 ${config.label}이(가) 없어요.`}
                action={<span className="rs-empty-actions">
                    {filtered && <AdminButton size="sm" onClick={() => { setTypeFilter(''); setRegion(ALL); }}>필터 초기화</AdminButton>}
                    <AdminButton size="sm" variant="primary" leading={<IconPlus />} onClick={() => openEditor(null)}>{addLabel}</AdminButton>
                </span>} />
        ) : view === 'list' ? (
            <AdminTable label={`${config.label} 목록`} className="rs-table">
                <AdminThead>
                    <AdminTr>
                        <AdminTh className="rs-c-photo"><span className="rs-sr">사진</span></AdminTh>
                        <AdminTh>이름</AdminTh>
                        <AdminTh className="rs-c-type">{config.typeTitle}</AdminTh>
                        <AdminTh className="rs-c-col3">{config.col3Title}</AdminTh>
                        <AdminTh>소개</AdminTh>
                        <AdminTh className="rs-c-status">상태</AdminTh>
                        <AdminTh align="right" className="rs-c-actions">관리</AdminTh>
                    </AdminTr>
                </AdminThead>
                <AdminTbody>
                    {items.map(([name, r]) => {
                        const type = config.type(r), intro = introOf(kind, r), st = status(name), cover = coverOf(kind, r);
                        return (
                            <AdminTr key={name}>
                                <AdminTd className="rs-c-photo"><span className="rs-thumb">{cover ? <img src={cover} alt="" /> : <IconImage />}</span></AdminTd>
                                <AdminTd><span className="rs-name"><AdminTextButton className="rs-name-btn" onClick={() => openEditor(name)}>{name}</AdminTextButton><span className="rs-sub">{config.sub(r)}</span></span></AdminTd>
                                <AdminTd nowrap className="rs-c-type">{type ? <AdminBadge tone={typeTone(type)}>{type}</AdminBadge> : '—'}</AdminTd>
                                <AdminTd className="rs-c-col3">{config.col3(r) || '—'}</AdminTd>
                                <AdminTd><span className={intro ? 'rs-intro' : 'rs-intro is-warn'}>{intro || introMissing(kind)}</span></AdminTd>
                                <AdminTd nowrap className="rs-c-status">{st.text && <span className={st.on ? 'rs-status is-on' : 'rs-status'}>{st.text}</span>}</AdminTd>
                                <AdminTd align="right" className="rs-c-actions"><AdminIconButton size="sm" label={`${name} 편집`} onClick={() => openEditor(name)}><IconChevronRight /></AdminIconButton></AdminTd>
                            </AdminTr>
                        );
                    })}
                </AdminTbody>
            </AdminTable>
        ) : (
            <div className="rs-grid">
                {items.map(([name, r]) => {
                    const type = config.type(r), intro = introOf(kind, r), st = status(name), cover = coverOf(kind, r);
                    return (
                        <button key={name} type="button" className={intro ? 'adm-rs-card' : 'adm-rs-card is-warn'} onClick={() => openEditor(name)}>
                            <span className="adm-rs-card-photo">
                                {cover ? <img src={cover} alt={name} /> : <span className="adm-rs-card-noimg"><IconImage /><span>{config.label} 사진</span></span>}
                                {type && <span className="adm-rs-card-type"><AdminBadge tone={typeTone(type)}>{type}</AdminBadge></span>}
                            </span>
                            <span className="adm-rs-card-body">
                                <span className="rs-name"><b>{name}</b><span className="rs-sub">{config.sub(r)}</span></span>
                                <span className={intro ? 'rs-intro is-clamp' : 'rs-intro is-clamp is-warn'}>{intro || introMissing(kind)}</span>
                            </span>
                            <span className="adm-rs-card-foot">
                                <span className={st.on ? 'rs-status is-on' : 'rs-status'}>{st.text}</span>
                                <span className="adm-rs-card-edit"><IconPencil />편집</span>
                            </span>
                        </button>
                    );
                })}
                <button type="button" className="adm-rs-card is-add" onClick={() => openEditor(null)}><IconPlus /><span>{addLabel}</span></button>
            </div>
        );

    /* ── 편집 창 ── */
    const ed = editor;
    const edConfig = ed ? KINDS[ed.kind] : config;
    const f = ed?.form.fields ?? {};
    const regionOptions = ed?.kind === 'lodges' ? [
        { value: '', label: '지역 미지정' },
        ...[...new Set([...lodges.cats, ...Object.values(lodges.map).map(lodgeCatOf).filter(Boolean), ...(f.region && f.region !== NEW_REGION ? [f.region] : [])])].map((value) => ({ value, label: value })),
        { value: NEW_REGION, label: '＋ 새 지역 추가…' },
    ] : [];
    const photoHint = ed?.kind === 'guides' ? '고객 확정 안내에 보여요.'
        : ed?.kind === 'vehicles' ? `견적서와 확정 일정표에는 대표 사진을 포함해 최대 3장이 보여요.${ed.extraPhotos.length ? ` 추가 사진 ${ed.extraPhotos.length}장은 그대로 보관돼요.` : ''}`
        : '첫 사진이 대표 사진이고, 확정 일정표에는 최대 3장이 보여요.';

    return (
        <div className="rs-page">
            <div className="rs-bar">
                <AdminSegmented size="md" label="종류" items={kindItems} value={kind} onChange={chooseKind} />
                <span className="rs-bar-end">
                    <AdminSegmented label="보기" items={[{ value: 'card', label: '카드' }, { value: 'list', label: '목록' }]} value={view} onChange={chooseView} />
                    <AdminButton variant="primary" leading={<IconPlus />} disabled={!ready} onClick={() => openEditor(null)}>{addLabel}</AdminButton>
                </span>
            </div>
            <AdminCard flush className="rs-card">
                {kind === 'lodges' && (
                    <div className="rs-filters is-region">
                        <AdminChipGroup label="숙소 지역" items={regionItems} value={region} onChange={(value) => { setRegion(value); setTypeFilter(''); }} />
                        <span className="rs-cat-tools">
                            {activeRegion && (
                                <>
                                    <AdminTextButton tone="assistive" size="sm" disabled={lodges.saving} onClick={() => setCatEditor({ from: activeRegion, value: activeRegion })}>지역 이름 바꾸기</AdminTextButton>
                                    <AdminTextButton tone="assistive" size="sm" disabled={lodges.saving} onClick={() => void removeCategory(activeRegion)}>지역 삭제</AdminTextButton>
                                </>
                            )}
                            <AdminTextButton size="sm" leading={<IconPlus />} disabled={!ready || lodges.saving} onClick={() => setCatEditor({ from: null, value: '' })}>지역 추가</AdminTextButton>
                        </span>
                    </div>
                )}
                <div className="rs-filters">
                    <AdminChipGroup label={config.typeTitle} items={typeItems} value={typeFilter} onChange={setTypeFilter} />
                    <span className="rs-count" role="status"><b>{ready ? items.length : '–'}</b>개 표시</span>
                </div>
                {list}
            </AdminCard>

            <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { const files = [...(e.target.files || [])]; e.target.value = ''; void upload(files, pickSlot.current); }} />
            <input ref={qrInput} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; void uploadQr(file); }} />

            <AdminDialog
                open={!!ed}
                onClose={closeEditor}
                size="lg"
                title={ed?.previousName === null ? `새 ${edConfig.label} 추가` : `${edConfig.label} 편집`}
                dirty={!!ed && JSON.stringify(ed.form) !== ed.initial}
                onSubmit={() => void saveEditor()}
                submitLabel={ed?.previousName === null ? '추가하기' : '저장하기'}
                submitting={!!ed && libs[ed.kind].saving}
                submitDisabled={!ed?.form.name.trim() || uploading !== null || (f.region === NEW_REGION && !ed?.newRegion.trim())}
                onDelete={!ed || ed.previousName === null ? undefined : () => { const target = ed; void deleteResource(target.kind, target.previousName!).then((ok) => { if (ok) setEditor(null); }); }}
                deleteLabel="삭제하기"
            >
                {ed && (
                    <div className="rs-editor">
                        <section className="rs-section">
                            <div className="rs-section-head"><b>사진</b><span>{photoHint}</span></div>
                            <div className={edConfig.maxPhotos === 1 ? 'rs-photos is-single' : 'rs-photos'}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); void upload([...(e.dataTransfer?.files || [])], ed.form.photos.length); }}>
                                {Array.from({ length: edConfig.maxPhotos }, (_, i) => {
                                    const src = ed.form.photos[i];
                                    if (src) return (
                                        <div key={i} className={i === 0 ? 'rs-photo is-main' : 'rs-photo'}>
                                            <img src={imageUrl(src) || src} alt={i === 0 ? '대표 사진' : `추가 사진 ${i}`} />
                                            {i === 0 ? <span className="rs-photo-tag"><AdminBadge tone="info" strong>대표</AdminBadge></span>
                                                : <AdminButton size="sm" variant="weak" className="rs-photo-up" onClick={() => setPhotos(ed.form.photos.map((p, n) => (n === i - 1 ? ed.form.photos[i] : n === i ? ed.form.photos[i - 1] : p)))}>앞으로</AdminButton>}
                                            <AdminIconButton size="sm" variant="background" className="rs-photo-off" label="사진 빼기" onClick={() => setPhotos(ed.form.photos.filter((_, n) => n !== i))}><IconTrash /></AdminIconButton>
                                            {uploading === i && <span className="rs-photo-busy">업로드 중…</span>}
                                        </div>
                                    );
                                    return (
                                        <button key={i} type="button" className={i === 0 ? 'adm-rs-slot is-main' : 'adm-rs-slot'} disabled={uploading !== null}
                                            onClick={() => { pickSlot.current = Math.min(i, ed.form.photos.length); fileInput.current?.click(); }}>
                                            <IconImage /><span>{uploading === i || (uploading !== null && uploading !== 'qr' && i === ed.form.photos.length) ? '업로드 중…' : i === 0 ? '대표 사진' : '추가 사진'}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {ed.kind === 'lodges' && (
                                <details className="rs-archive">
                                    <summary>보관 사진에서 선택</summary>
                                    <div className="rs-archive-grid">
                                        {ed.pool.filter((src) => !ed.form.photos.includes(src) && imageUrl(src)).map((src) => (
                                            <button key={src} type="button" className="adm-rs-archive" disabled={ed.form.photos.length >= 3} onClick={() => setPhotos([...ed.form.photos, src])}><img src={imageUrl(src)} alt="보관 사진 선택" /></button>
                                        ))}
                                        {!ed.pool.some((src) => !ed.form.photos.includes(src) && imageUrl(src)) && <span className="rs-sub">보관된 다른 사진이 없어요.</span>}
                                    </div>
                                </details>
                            )}
                        </section>

                        <AdminField id="rs-name" label={ed.kind === 'guides' ? '이름' : ed.kind === 'lodges' ? '숙소 이름' : '차량 이름'} required>
                            <AdminTextInput id="rs-name" placeholder={ed.kind === 'guides' ? '예: 빌궁' : ed.kind === 'lodges' ? '예: 테를지 스타캠프' : '예: 스타렉스'} value={ed.form.name}
                                onChange={(e) => setEditor({ ...ed, form: { ...ed.form, name: e.target.value } })} />
                        </AdminField>

                        {ed.kind === 'guides' && (
                            <>
                                <div className="rs-grid-2">
                                    <AdminField id="rs-nameEn" label="영문·현지 이름" hint="확정 일정표에 보여요."><AdminTextInput id="rs-nameEn" placeholder="예: Bilguun" value={f.nameEn} onChange={(e) => setField('nameEn', e.target.value)} /></AdminField>
                                    <AdminField id="rs-phone" label="전화번호" hint="현지 연락처 · 확정 일정표에 보여요."><AdminTextInput id="rs-phone" placeholder="+976 8000-0000" value={f.phone} onChange={(e) => setField('phone', e.target.value)} /></AdminField>
                                </div>
                                <ChipPicker id="rs-role" label="유형" hint="확정 일정표에 보여요." values={chipValues('guides', guides.map, f.role)} value={f.role} onChange={(v) => setField('role', v)} free />
                                <AdminField id="rs-qr" label="카카오톡 QR" hint="선택 · 확정 일정표에 보여요.">
                                    <div className="rs-qr">
                                        <button type="button" className="adm-rs-qr" disabled={uploading !== null} onClick={() => qrInput.current?.click()}>
                                            {uploading === 'qr' ? <span>업로드 중…</span> : imageUrl(f.qr) ? <img src={imageUrl(f.qr)} alt="카카오톡 QR" /> : <span>QR 올리기</span>}
                                        </button>
                                        <AdminTextInput id="rs-qr" placeholder="또는 이미지 주소 직접 입력" value={f.qr} onChange={(e) => setField('qr', e.target.value)} />
                                    </div>
                                </AdminField>
                                <AdminField id="rs-desc" label="소개" hint="확정 일정표에 보여요." aside={`${(f.desc || '').length}자`}>
                                    <AdminTextArea id="rs-desc" minRows={3} placeholder="고객 확정 안내에 보이는 소개예요. 2~3문장이면 충분해요." value={f.desc} onChange={(e) => setField('desc', e.target.value)} />
                                </AdminField>
                            </>
                        )}

                        {ed.kind === 'lodges' && (
                            <>
                                <div className="rs-grid-2">
                                    <AdminField id="rs-region" label="지역" hint="예약 숙소 배정에서 이 지역으로 묶여요.">
                                        <AdminSelect id="rs-region" value={f.region} options={regionOptions} onChange={(v) => setField('region', v)} />
                                    </AdminField>
                                    {f.region === NEW_REGION && (
                                        <AdminField id="rs-new-region" label="새 지역 이름" required>
                                            <AdminTextInput id="rs-new-region" placeholder="예: 서부몽골" value={ed.newRegion} onChange={(e) => setEditor({ ...ed, newRegion: e.target.value })} />
                                        </AdminField>
                                    )}
                                </div>
                                <ChipPicker id="rs-grade" label="등급" hint="확정 일정표에 보여요." values={chipValues('lodges', lodges.map, f.grade)} value={f.grade} onChange={(v) => setField('grade', v)} />
                                <AdminField id="rs-tags" label="시설 태그"><AdminTextInput id="rs-tags" placeholder="예: 샤워 · 전기" value={f.tags} onChange={(e) => setField('tags', e.target.value)} /></AdminField>
                                <AdminField id="rs-desc" label="기존 소개" hint="보관용 · 일정표 미표시" aside={`${(f.desc || '').length}자`}>
                                    <AdminTextArea id="rs-desc" minRows={2} value={f.desc} onChange={(e) => setField('desc', e.target.value)} />
                                </AdminField>
                                {([['address', '주소', ''], ['phone', '숙소 대표 전화번호', ''], ['roomAmenities', '객실 비품', '객실 비품을 입력해 주세요'], ['sharedFacilities', '호텔 공용시설', ''],
                                    ['operatingNotes', '운영 참고 (보관용·일정표 미표시)', ''], ['officialSources', '공식 출처', '웹사이트 주소를 한 줄에 하나씩 입력해 주세요']] as const).map(([key, label, placeholder]) => (
                                    <AdminField key={key} id={`rs-${key}`} label={label}>
                                        <AdminTextArea id={`rs-${key}`} minRows={2} placeholder={placeholder} value={f[key]} onChange={(e) => setField(key, e.target.value)} />
                                    </AdminField>
                                ))}
                            </>
                        )}

                        {ed.kind === 'vehicles' && (
                            <>
                                <div className="rs-grid-3">
                                    <AdminField id="rs-plate" label="차량 번호" hint="내부용"><AdminTextInput id="rs-plate" placeholder="예: 12가 3401" value={f.plate} onChange={(e) => setField('plate', e.target.value)} /></AdminField>
                                    <AdminField id="rs-driver" label="기사 이름" hint="가이드 일정표에 보여요."><AdminTextInput id="rs-driver" placeholder="예: Bat" value={f.driver} onChange={(e) => setField('driver', e.target.value)} /></AdminField>
                                    <AdminField id="rs-phone" label="기사 연락처" hint="가이드 일정표에 보여요."><AdminTextInput id="rs-phone" placeholder="+976 8000-0000" value={f.phone} onChange={(e) => setField('phone', e.target.value)} /></AdminField>
                                </div>
                                <ChipPicker id="rs-seats" label="탑승 인원" hint="견적서·확정 일정표에 보여요." values={chipValues('vehicles', vehicles.map, f.seats)} value={f.seats} onChange={(v) => setField('seats', v)} free placeholder="예: 6인" />
                                <AdminField id="rs-luggage" label="수하물" hint="견적서·확정 일정표에 보여요."><AdminTextInput id="rs-luggage" placeholder="대형 캐리어 4개 적재 가능" value={f.luggage} onChange={(e) => setField('luggage', e.target.value)} /></AdminField>
                                <AdminField id="rs-desc" label="차량 특징" hint="견적서·확정 일정표에 보여요." aside={`${(f.desc || '').length}자`}>
                                    <AdminTextArea id="rs-desc" minRows={3} placeholder="예: 몽골 장거리 이동에 적합한 차량입니다." value={f.desc} onChange={(e) => setField('desc', e.target.value)} />
                                </AdminField>
                            </>
                        )}
                    </div>
                )}
            </AdminDialog>

            <AdminDialog
                open={!!catEditor}
                onClose={() => { if (!lodges.isSaving()) setCatEditor(null); }}
                title={catEditor?.from ? '지역 이름 바꾸기' : '지역 추가'}
                size="sm"
                dirty={!!catEditor && catEditor.value.trim() !== (catEditor.from ?? '')}
                onSubmit={() => void saveCategory()}
                submitLabel={catEditor?.from ? '바꾸기' : '추가하기'}
                submitting={lodges.saving}
                submitDisabled={!catEditor?.value.trim()}
            >
                {catEditor && (
                    <AdminField id="rs-cat-name" label="지역 이름" required
                        hint={catEditor.from && lodgeCatCount(lodges.map, catEditor.from) ? `이 지역의 숙소 ${lodgeCatCount(lodges.map, catEditor.from)}개도 새 이름으로 옮겨집니다.` : '숙소를 지역별로 묶어 볼 수 있어요.'}>
                        <AdminTextInput id="rs-cat-name" placeholder="예: 테를지" value={catEditor.value} onChange={(e) => setCatEditor({ ...catEditor, value: e.target.value })} />
                    </AdminField>
                )}
            </AdminDialog>
        </div>
    );
};

export default AdminResourceManage;
