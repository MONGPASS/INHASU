import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import type { DesignBlockContent, TourPricingOption } from '../../types/product';
import type { DesignTemplateField } from '../product/designTemplates/types';
import { getDesignTemplate } from '../product/designTemplates/registry';
import DesignBlockView from '../product/designTemplates/DesignBlockView';
import { commitTextSize } from '../product/designTemplates/textStyles';
import { priceRowsFromOptions } from '../product/designTemplates/pricing';
import { MAP_DESTINATIONS } from '../product/designTemplates/mapDestinations';
import { baseKey, fieldKeysOfSection, nextCopyId, resolveInstances, scopeOf, scopedKey } from '../product/designTemplates/sections';
import { saveDesignDefaults, useAllDesignDefaults, useDesignGlobalDefaults } from '../product/designTemplates/globalDefaults';
import { uploadImage } from '../../utils/upload';
import { Icon } from './console/Icon';
import { useDesignSpots } from '../product/designTemplates/designSpots';
import { Ico, V7Menu, menuAt, type V7MenuState } from './v7/v7Ui';
import { PresetChips, PresetLineChips } from './designEditor/PresetChips';
import { FieldPopover } from './designEditor/FieldPopover';
import { ImagePopover } from './designEditor/ImagePopover';
import { SectionToolbar } from './designEditor/SectionToolbar';
import { useAnchorRect } from './designEditor/useAnchorRect';
import { clampSectionAnchor, commitValue, fieldSelector, findDesignTarget, sectionSelector } from './designEditor/inlineEdit';
import { adminConfirm, adminNotify } from './ui/adminFeedback';
import { AdminButton, AdminIconButton } from './ui/AdminButton';
import { AdminSelect, AdminTextArea, AdminTextInput } from './ui/AdminFields';
import { AdminBadge, AdminChip, AdminSegmented, type AdminChoiceItem } from './ui/AdminChoice';
import { cx } from './ui/adminUiUtils';
import './designEditor/design-editor.css';

/** 미리보기 PC·모바일 전환 */
const PREVIEW_VARIANTS: AdminChoiceItem<'desktop' | 'mobile'>[] = [{ value: 'desktop', label: 'PC' }, { value: 'mobile', label: '모바일' }];

/**
 * 지도 경유지 선택 UI — 지도에 좌표가 등록된 여행지 목록에서 골라 담는다.
 * 저장 형식은 기존과 동일한 텍스트("지역명|표시 라벨" 줄 단위)라서
 * 지도/템플릿 쪽은 그대로 동작하고, 직접 입력(좌표·사진)도 그대로 지원한다.
 */
/** 방문 여행지 카드 목록 — 공통 여행지 관리에서 이름·사진을 복사해 저장한다. */
function SpotCardsField({ value, onChange, onBusyChange }: { value: string; onChange: (next: string) => void; onBusyChange?: (busy: boolean) => void }) {
    const { spots: registered, loading, error, retry } = useDesignSpots();
    const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
    const lines = value.split('\n').map(s => s.trim()).filter(Boolean);
    const setLines = (next: string[]) => onChange(next.join('\n'));

    const parseLine = (line: string) => {
        const p = line.split('|').map(x => x.trim());
        return { title: p[0] || '', img: p[1] || '' };
    };
    const serializeLine = (p: { title: string; img: string }) => (p.img ? `${p.title}|${p.img}` : `${p.title}|`);
    const patch = (i: number, part: Partial<{ title: string; img: string }>) => {
        const next = [...lines];
        next[i] = serializeLine({ ...parseLine(next[i]), ...part });
        setLines(next);
    };
    const move = (i: number, dir: -1 | 1) => {
        const next = [...lines];
        const j = i + dir;
        if (j < 0 || j >= next.length) return;
        [next[i], next[j]] = [next[j], next[i]];
        setLines(next);
    };
    const addRegistered = (name: string, image: string) => {
        setLines([...lines, serializeLine({ title: name, img: image })]);
    };
    const handleUpload = async (i: number, file: File | undefined) => {
        if (!file) return;
        onBusyChange?.(true);
        try {
            setUploadingIdx(i);
            patch(i, { img: await uploadImage(file, 'product-details') });
        } catch (error) {
            console.error('Spot card image upload failed:', error);
            adminNotify('이미지 업로드 실패');
        } finally {
            setUploadingIdx(null);
            onBusyChange?.(false);
        }
    };

    // 테스트(tests/design-travel-spots.test.mjs)가 이 함수만 떼어 그리므로 안에서는 생 요소와 Icon만 쓴다(모양은 같은 클래스로 맞춘다)
    return (
        <div className="de-stack">
            {lines.length === 0 && (
                <div className="de-note">아래에서 여행지를 추가하면 카드가 순서대로 표시됩니다</div>
            )}
            {lines.map((line, i) => {
                const { title, img } = parseLine(line);
                return (
                    <div key={i} className="de-item">
                        <label title={img ? '사진 변경' : '사진 업로드'} className={img ? 'de-thumb is-filled' : 'de-thumb'}>
                            {uploadingIdx === i
                                ? <Icon name="progress_activity" className="de-ico is-accent" />
                                : img
                                    ? <img src={img} alt={title} />
                                    : <Icon name="add_a_photo" className="de-ico is-muted" />}
                            <input type="file" accept="image/*" className="de-file"
                                onChange={(e) => { handleUpload(i, e.target.files?.[0]); e.target.value = ''; }} />
                        </label>
                        <AdminTextInput
                            className="de-grow de-spot-name"
                            value={title}
                            placeholder="여행지 이름 (한국어 표기)"
                            aria-label="여행지 이름"
                            onChange={(e) => patch(i, { title: e.target.value })}
                        />
                        <button type="button" className="adm-ui-icon-btn is-normal is-sm" title="위로" onClick={() => move(i, -1)}><Icon name="arrow_upward" className="de-ico" /></button>
                        <button type="button" className="adm-ui-icon-btn is-normal is-sm" title="아래로" onClick={() => move(i, 1)}><Icon name="arrow_downward" className="de-ico" /></button>
                        <button type="button" className="adm-ui-icon-btn is-normal is-sm" title="카드 제거" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Icon name="close" className="de-ico is-danger" /></button>
                    </div>
                );
            })}
            <div className="de-dashed-box">
                <div className="de-note">
                    등록된 여행지 — 누르면 카드에 추가됩니다
                    <a href="/admin/quote-desk/spots" target="_blank" rel="noopener noreferrer" className="de-link">여행지 등록 관리 ↗</a>
                </div>
                {loading ? (
                    <div className="de-note" role="status">여행지를 불러오는 중입니다…</div>
                ) : error ? (
                    <div className="de-note" role="alert">{error}<button type="button" className="adm-ui-btn is-secondary is-sm de-retry" onClick={retry}>다시 불러오기</button></div>
                ) : registered.length === 0 ? (
                    <div className="de-note">등록된 여행지가 없습니다. 여행지 관리에서 먼저 추가해 주세요.</div>
                ) : (
                    <div className="de-row is-wrap is-tight">
                        {registered.map(sp => (
                            <button key={sp.id} type="button" className="adm-ui-chip de-spot-chip" title={`${sp.name} 카드 추가`} onClick={() => addRegistered(sp.name, sp.image)}>
                                <img src={sp.image} alt="" className="de-spot-chip-img" />
                                {sp.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function MapStopsField({ value, onChange, onBusyChange }: { value: string; onChange: (next: string) => void; onBusyChange?: (busy: boolean) => void }) {
    const [advanced, setAdvanced] = useState(false);
    const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
    const lines = value.split('\n').map(s => s.trim()).filter(Boolean);

    const setLines = (next: string[]) => onChange(next.join('\n'));
    const move = (i: number, dir: -1 | 1) => {
        const next = [...lines];
        const j = i + dir;
        if (j < 0 || j >= next.length) return;
        [next[i], next[j]] = [next[j], next[i]];
        setLines(next);
    };

    const addDestination = (ko: string) => {
        if (!ko) return;
        const dest = MAP_DESTINATIONS.find(d => d.ko === ko);
        if (!dest) return;
        setLines([...lines, `${dest.ko}|${dest.ja}`]);
    };

    /** 한 줄 = 지역명|표시문구|사진URL|위도,경도 — 필드 단위로 안전하게 수정 */
    const parseLine = (line: string) => {
        const p = line.split('|').map(s => s.trim());
        return { ko: p[0] || '', ja: p[1] || '', img: p[2] || '', coords: p[3] || '' };
    };
    const serializeLine = (p: { ko: string; ja: string; img: string; coords: string }) => {
        const parts = [p.ko, p.ja, p.img, p.coords];
        while (parts.length > 1 && !parts[parts.length - 1]) parts.pop();
        return parts.join('|');
    };
    const setLineImage = (i: number, img: string) => {
        const next = [...lines];
        next[i] = serializeLine({ ...parseLine(next[i]), img });
        setLines(next);
    };

    const handleStopImageUpload = async (i: number, file: File | undefined) => {
        if (!file) return;
        onBusyChange?.(true);
        try {
            setUploadingIdx(i);
            const url = await uploadImage(file, 'product-details');
            setLineImage(i, url);
        } catch (error) {
            console.error('Map stop image upload failed:', error);
            adminNotify('이미지 업로드 실패');
        } finally {
            setUploadingIdx(null);
            onBusyChange?.(false);
        }
    };

    const groups = useMemo(() => {
        const out: { name: string; items: typeof MAP_DESTINATIONS }[] = [];
        for (const d of MAP_DESTINATIONS) {
            const last = out[out.length - 1];
            if (last && last.name === d.group) last.items.push(d);
            else out.push({ name: d.group, items: [d] });
        }
        return out;
    }, []);

    return (
        <div className="de-stack">
            {lines.length === 0 && (
                <div className="de-note">아래에서 여행지를 추가하면 지도에 순서대로 표시됩니다</div>
            )}
            {lines.map((line, i) => {
                const { ko, ja, img } = parseLine(line);
                return (
                    <div key={`${ko}-${i}`} className="de-item">
                        <span className="de-stop-no">{i + 1}</span>
                        {/* 원형 버블에 표시될 사진 — 클릭해서 업로드/변경 */}
                        <label title={img ? '사진 변경' : '사진 업로드 (지도 원형에 표시)'} className={cx('de-thumb is-round', img && 'is-filled')}>
                            {uploadingIdx === i
                                ? <Icon name="progress_activity" className="de-ico is-accent" />
                                : img
                                    ? <img src={img} alt={ko} />
                                    : <Icon name="add_a_photo" className="de-ico is-muted" />}
                            <input
                                type="file"
                                accept="image/*"
                                className="de-file"
                                onChange={(e) => { handleStopImageUpload(i, e.target.files?.[0]); e.target.value = ''; }}
                            />
                        </label>
                        <span className="de-stop-name">
                            {ko}{ja ? <span className="de-stop-sub">{ja}</span> : null}
                        </span>
                        {img && (
                            <AdminIconButton label="사진 제거" size="sm" className="de-icon-danger" onClick={() => setLineImage(i, '')}><Icon name="image" className="de-ico" /></AdminIconButton>
                        )}
                        <AdminIconButton label="위로" size="sm" disabled={i === 0} onClick={() => move(i, -1)}><Icon name="arrow_upward" className="de-ico" /></AdminIconButton>
                        <AdminIconButton label="아래로" size="sm" disabled={i === lines.length - 1} onClick={() => move(i, 1)}><Icon name="arrow_downward" className="de-ico" /></AdminIconButton>
                        <AdminIconButton label="삭제" size="sm" className="de-icon-danger" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}><Icon name="close" className="de-ico" /></AdminIconButton>
                    </div>
                );
            })}
            <AdminSelect
                className="de-spot-select"
                aria-label="여행지 추가"
                value=""
                onChange={(value) => { if (value) addDestination(value); }}
                options={[
                    { value: '', label: '＋ 여행지 추가…' },
                    ...groups.flatMap(g => g.items.map(d => ({ value: d.ko, label: `${d.ja} — ${d.en}`, group: g.name }))),
                ]}
            />
            <AdminButton size="sm" className="de-self-start" leading={<Icon name="edit_note" className="de-ico" />} onClick={() => setAdvanced(a => !a)}>
                {advanced ? '직접 입력 닫기' : '직접 입력 (목록에 없는 지역·좌표·사진)'}
            </AdminButton>
            {advanced && (
                <>
                    <AdminTextArea
                        minRows={Math.max(3, lines.length + 1)}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                    />
                    <div className="de-note-sm">
                        한 줄에 한 곳: 지역명|표시문구|사진URL|위도,경도 (사진·좌표 생략 가능). 미등록 지역은 위도,경도를 넣으면 그 위치에 표시됩니다.
                    </div>
                </>
            )}
        </div>
    );
}

/**
 * 'design' 상세 블록의 관리자 편집기 — 좌측 미리보기 / 우측 폼 분할.
 * 미리보기의 문구·사진을 클릭하면 해당 입력칸이 열리고 포커스된다.
 * 값을 전부 지우면 디자인 원본 문구(default)로 되돌아간다.
 */
export function DesignTemplateBlockEditor({
    content,
    onChange,
    pricingOptions,
    onBusyChange,
    focusMode = false,
    onFocusModeChange,
}: {
    content: DesignBlockContent;
    onChange: (next: DesignBlockContent) => void;
    /** 상품 「가격/옵션」 탭의 인원별 가격 — 있으면 디자인 가격표에 자동 반영된다 */
    pricingOptions?: TourPricingOption[];
    /** Prevent the containing product form from saving before image/shared-data work completes. */
    onBusyChange?: (busy: boolean) => void;
    /** 집중 편집(상품 편집창의 오른쪽 열·제목 숨김) 켜짐 여부와 토글 — 상품 편집창이 넘겨준다 */
    focusMode?: boolean;
    onFocusModeChange?: (on: boolean) => void;
}) {
    const pendingWork = useRef(0);
    const busyCallback = useRef(onBusyChange);
    busyCallback.current = onBusyChange;
    const changeBusy = useCallback((busy: boolean) => {
        pendingWork.current = Math.max(0, pendingWork.current + (busy ? 1 : -1));
        busyCallback.current?.(pendingWork.current > 0);
    }, []);
    useEffect(() => () => { if (pendingWork.current > 0) busyCallback.current?.(false); }, []);
    const def = getDesignTemplate(content?.templateId);
    // 가격/옵션 탭 값이 있으면 가격표는 자동 반영 (직접 입력 불가)
    const autoPriceRows = priceRowsFromOptions(pricingOptions);
    const valueOverrides = autoPriceRows ? { price_rows: autoPriceRows } : undefined;
    const [previewVariant, setPreviewVariant] = useState<'desktop' | 'mobile'>('desktop');
    const [uploadingKey, setUploadingKey] = useState<string | null>(null);
    const [openSection, setOpenSection] = useState<string | null>(null);
    const [selectedField, setSelectedField] = useState<string | null>(null);
    const [savingShared, setSavingShared] = useState(false);
    // 사이트 공통 이미지 — 상품에 따로 올리지 않은 자리에 자동으로 들어간다
    const sharedAssets = useDesignGlobalDefaults(content?.templateId);
    const allDefaults = useAllDesignDefaults();
    const fieldRefs = useRef(new Map<string, HTMLElement>());
    const previewRef = useRef<HTMLDivElement>(null);
    // 미리보기 인라인 편집: 열린 편집창, 마우스를 올린/마지막으로 다룬 섹션, 오른쪽 목록 패널, 드롭 대상
    const [inline, setInline] = useState<{ kind: 'text-field' | 'image-field'; key: string } | null>(null);
    const [hoverInst, setHoverInst] = useState<string | null>(null);
    const [activeInst, setActiveInst] = useState<string | null>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const [dropKey, setDropKey] = useState<string | null>(null);
    const [removedMenu, setRemovedMenu] = useState<V7MenuState | null>(null);
    const hoverTimer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

    const instances = useMemo(
        () => (def ? resolveInstances(def, content?.sections) : []),
        [def, content?.sections],
    );

    /**
     * 폼에 표시할 섹션 목록 — 인스턴스(복제본 포함) × 그 섹션이 가진 매니페스트 필드.
     * 복제본은 필드 key에 접미사가 붙어 원본과 값이 분리된다.
     */
    const values = useMemo(() => content.values || {}, [content.values]);

    const sections = useMemo(() => {
        if (!def) return [] as { instId: string; defId: string; name: string; copyNo: number; fields: { field: DesignTemplateField; key: string }[] }[];
        return instances.filter(inst => !inst.hidden).map(inst => {
            const sec = def.sectionDefs.find(s => s.id === inst.def)!;
            const names = new Set(sec.fieldSections);
            const hash = inst.id.indexOf('#');
            return {
                instId: inst.id,
                defId: inst.def,
                name: hash === -1 ? inst.id : `${inst.def} (복제 ${inst.id.slice(hash + 1)})`,
                copyNo: hash === -1 ? 1 : Number(inst.id.slice(hash + 1)),
                fields: def.fields
                    .filter(f => names.has(f.section))
                    // 복제본과 공유하는 값은 원본 섹션에서만 편집한다
                    .filter(f => !f.shared || inst.id === inst.def)
                    .map(f => ({
                        field: f,
                        // 공유 필드는 접미사 없이 저장해야 템플릿이 읽는 값과 일치한다
                        key: f.shared ? f.key : scopedKey(f.key, inst.id),
                    })),
            };
        });
    }, [def, instances]);

    /** 오른쪽 목록 패널을 열고 그 칸으로 스크롤 + 포커스 (전용 편집기가 필요한 칸용) */
    const openInPanel = (key: string, instId: string) => {
        setPanelOpen(true);
        setOpenSection(instId);
        // 섹션이 방금 열렸으면 입력칸이 다음 렌더에 생기므로 한 프레임 기다린다
        setTimeout(() => {
            const el = fieldRefs.current.get(key);
            el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            (el as HTMLInputElement | HTMLTextAreaElement | null)?.focus?.({ preventScroll: true });
        }, 60);
    };
    /** 미리보기에서 문구·사진 클릭 → 그 자리 옆 편집창. 지도 경유지·대표 명소는 전용 편집기가 있는 목록 패널로. */
    const handlePreviewFieldClick = (key: string) => {
        const entry = lookupField(key);
        if (!entry) return;
        setSelectedField(entry.key);
        setActiveInst(entry.instId);
        if (entry.field.type === 'map-stops' || entry.field.type === 'spot-cards') { setInline(null); openInPanel(entry.key, entry.instId); return; }
        setInline({ kind: entry.field.type === 'image' ? 'image-field' : 'text-field', key: entry.key });
    };

    /** 입력칸 포커스 → 미리보기의 해당 요소를 하이라이트하고 화면에 보이게 */
    const handleFieldFocus = (key: string) => {
        setSelectedField(key);
        previewRef.current?.querySelector(`[data-df-scope="${scopeOf(key)}"] [data-df="${baseKey(key)}"]`)
            ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };

    /** 섹션 복제 — 현재 입력값까지 그대로 복사해 바로 아래에 추가 */
    const duplicateSection = (instId: string) => {
        if (!def) return;
        const idx = instances.findIndex(s => s.id === instId);
        if (idx === -1) return;
        const defId = instances[idx].def;
        const newId = nextCopyId(defId, instances);
        const nextValues = { ...(content.values || {}) };
        const nextStyles = { ...(content.textStyles || {}) };
        for (const key of fieldKeysOfSection(def, defId)) {
            const from = scopedKey(key, instId);
            const cur = content.values?.[from];
            if (cur !== undefined && cur !== '') nextValues[scopedKey(key, newId)] = cur;
            const style = content.textStyles?.[from];
            if (style) nextStyles[scopedKey(key, newId)] = { ...style };
        }
        const nextSections = [...instances];
        nextSections.splice(idx + 1, 0, { id: newId, def: defId });
        onChange({ ...content, values: nextValues, sections: nextSections, ...(Object.keys(nextStyles).length ? { textStyles: nextStyles } : {}) });
        setOpenSection(newId);
    };

    /** 섹션 빼기 — 마지막 하나면 hidden 표시로 남긴다 (템플릿에 새 섹션이 생겨도 삭제가 유지되도록) */
    const removeSection = async (instId: string) => {
        if (!await adminConfirm('이 섹션을 상세페이지에서 빼시겠습니까? 입력한 내용은 남아 있습니다.')) return;
        const target = instances.find(s => s.id === instId);
        if (!target) return;
        const others = instances.some(s => s.def === target.def && s.id !== instId && !s.hidden);
        const next = others
            ? instances.filter(s => s.id !== instId)
            : instances.map(s => (s.id === instId ? { ...s, hidden: true } : s));
        onChange({ ...content, sections: next });
        if (openSection === instId) setOpenSection(null);
    };

    /** 뺀 섹션 다시 넣기 */
    const restoreSection = (defId: string) => {
        if (!def) return;
        const hiddenOne = instances.find(s => s.def === defId && s.hidden);
        const next = hiddenOne
            ? instances.map(s => (s.id === hiddenOne.id ? { id: s.id, def: s.def } : s))
            : (() => {
                const order = def.sectionDefs.map(s => s.id);
                return [...instances, { id: defId, def: defId }]
                    .sort((a, b) => order.indexOf(a.def) - order.indexOf(b.def));
            })();
        onChange({ ...content, sections: next });
        setOpenSection(hiddenOne ? hiddenOne.id : defId);
    };

    const removedDefs = useMemo(
        () => (def ? def.sectionDefs.filter(s => !instances.some(i => i.def === s.id && !i.hidden)) : []),
        [def, instances],
    );

    /** 필드 키 → 정의와 섹션. 복제본 안의 공유 필드(`key@2`)는 접미사 없는 원본 키로 찾는다. */
    const fieldByKey = useMemo(() => {
        const map = new Map<string, { field: DesignTemplateField; key: string; instId: string; name: string }>();
        for (const sec of sections) for (const f of sec.fields) map.set(f.key, { field: f.field, key: f.key, instId: sec.instId, name: sec.name });
        return map;
    }, [sections]);
    const lookupField = (key: string) => fieldByKey.get(key) || (scopeOf(key) ? fieldByKey.get(baseKey(key)) : undefined);
    const inlineEntry = inline ? lookupField(inline.key) : undefined;
    const inlineAnchor = useAnchorRect(
        () => (inline && previewRef.current ? previewRef.current.querySelector(fieldSelector(inline.key)) : null),
        // 글자 크기를 바꾸면 문구 크기가 달라지므로 편집창도 다시 자리를 잡는다(커진 문구를 가리지 않게)
        [inline?.key, inline ? values[inline.key] : undefined, inline ? content.textStyles?.[inline.key]?.size : undefined, previewVariant, content.sections, sections],
        () => previewRef.current,
    );
    const toolbarInst = hoverInst ?? activeInst;
    const toolbarSection = toolbarInst ? sections.find(s => s.instId === toolbarInst) : undefined;
    const sectionRect = useAnchorRect(
        () => (toolbarInst && previewRef.current ? previewRef.current.querySelector(sectionSelector(toolbarInst)) : null),
        [toolbarInst, previewVariant, content.sections, sections],
        () => previewRef.current,
    );
    const previewRect = useAnchorRect(() => previewRef.current, [toolbarInst, previewVariant]);
    const toolbarPosition = sectionRect && previewRect && toolbarSection ? clampSectionAnchor(sectionRect, previewRect) : null;

    /**
     * 이 상품에서 직접 올린 사진들의 key.
     * 복제 섹션(@2 이후 = 2일차·3일차처럼 일차마다 다른 사진)은 공통 대상이 아니다.
     */
    const ownImageKeys = useMemo(() => {
        if (!def) return [] as string[];
        const imageKeys = new Set(def.fields.filter(f => f.type === 'image').map(f => f.key));
        return Object.keys(values).filter(k => scopeOf(k) === '' && imageKeys.has(k) && values[k]);
    }, [def, values]);

    const sharedCount = Object.values(sharedAssets).filter(Boolean).length;

    if (!def) {
        return (
            <div className="adm-msg is-cautionary">
                <p>알 수 없는 디자인 템플릿입니다: {content?.templateId}</p>
            </div>
        );
    }

    /**
     * 미리보기에서 올린 사진을 "공통 사진"으로 저장한다.
     * 저장 후에는 이 상품도 공통 사진을 따라가도록 개별 값을 비운다
     * (화면은 그대로지만, 나중에 공통 사진을 바꾸면 이 상품에도 반영된다).
     */
    const saveOwnImagesAsShared = async () => {
        if (!def || ownImageKeys.length === 0) return;
        const ok = await adminConfirm(
            `지금 올린 사진 ${ownImageKeys.length}장을 모든 상품이 함께 쓰는 공통 사진으로 저장할까요?\n\n` +
            '이 상품 화면은 그대로이고, 앞으로 새로 만드는 상품에도 같은 사진이 자동으로 들어갑니다.',
        );
        if (!ok) return;
        changeBusy(true);
        setSavingShared(true);
        try {
            const nextShared = { ...sharedAssets };
            for (const k of ownImageKeys) nextShared[k] = values[k];
            await saveDesignDefaults({ ...allDefaults, [def.id]: nextShared });
            // 공통으로 올라갔으므로 이 상품의 개별 사진은 비워 공통을 따라가게 한다
            const nextValues = { ...values };
            for (const k of ownImageKeys) delete nextValues[k];
            onChange({ ...content, values: nextValues });
        } catch (e) {
            console.error('Failed to save shared design images:', e);
            adminNotify('공통 사진 저장에 실패했습니다');
        } finally {
            setSavingShared(false);
            changeBusy(false);
        }
    };

    const setValue = (key: string, value: string) => {
        onChange({ ...content, values: { ...values, [key]: value } });
    };
    /** 비우기 = 키 삭제. 미리보기는 공통 사진이나 원본 문구로 돌아간다. */
    const clearValue = (key: string) => {
        if (!(key in values)) return;
        const nextValues = { ...values };
        delete nextValues[key];
        onChange({ ...content, values: nextValues });
    };

    const handleImageUpload = async (key: string, file: File | undefined) => {
        if (!file) return;
        changeBusy(true);
        try {
            setUploadingKey(key);
            const url = await uploadImage(file, 'product-details');
            setValue(key, url);
        } catch (error) {
            console.error('Design image upload failed:', error);
            adminNotify('이미지 업로드 실패');
        } finally {
            setUploadingKey(null);
            changeBusy(false);
        }
    };

    const keepHover = () => window.clearTimeout(hoverTimer.current);
    const scheduleHoverClear = () => { keepHover(); hoverTimer.current = window.setTimeout(() => setHoverInst(null), 160); };
    const handlePreviewMouseOver = (event: React.MouseEvent) => {
        const id = (event.target as Element).closest?.('[data-df-section]')?.getAttribute('data-df-section') ?? null;
        keepHover();
        setHoverInst(prev => (prev === id ? prev : id));
    };
    /** 끌어다 놓는 지점의 사진 칸(자동 반영 칸 제외) */
    const dropTarget = (event: React.DragEvent) => {
        const target = findDesignTarget(document.elementFromPoint(event.clientX, event.clientY));
        const entry = target ? lookupField(target.key) : undefined;
        return entry && entry.field.type === 'image' ? entry : null;
    };
    const handlePreviewDragOver = (event: React.DragEvent) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        const entry = uploadingKey === null ? dropTarget(event) : null;
        event.dataTransfer.dropEffect = entry ? 'copy' : 'none';
        setDropKey(prev => (prev === (entry?.key ?? null) ? prev : entry?.key ?? null));
    };
    const handlePreviewDrop = (event: React.DragEvent) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setDropKey(null);
        const entry = uploadingKey === null ? dropTarget(event) : null;
        const file = event.dataTransfer.files?.[0];
        if (!entry || !file || !file.type.startsWith('image/')) return;
        setSelectedField(entry.key);
        setActiveInst(entry.instId);
        void handleImageUpload(entry.key, file);
    };

    const filledCount = (fields: { field: DesignTemplateField; key: string }[]) =>
        fields.filter(({ field, key }) => {
            const raw = values[key] ?? '';
            return raw !== '' && raw !== (field.default ?? '');
        }).length;

    return (
        <div className="de-editor">
            <div className="de-head">
                <AdminBadge>{def.name}</AdminBadge>
                <span className="de-note">
                    미리보기의 문구·사진을 클릭해 그 자리에서 고칩니다 — 비우면 원본으로 돌아갑니다
                </span>
                <div className="de-spacer" />
                {removedDefs.length > 0 && (
                    <AdminButton size="sm" aria-haspopup="menu" title="뺀 섹션을 다시 넣습니다. 입력했던 내용이 그대로 돌아옵니다" leading={<Ico name="lc-plus" size={14} />}
                        onClick={e => setRemovedMenu(menuAt(e.currentTarget, '뺀 섹션 다시 넣기', removedDefs.map(sec => ({ key: sec.id, label: sec.id, onPick: () => restoreSection(sec.id) })), true))}>
                        뺀 섹션 {removedDefs.length}
                    </AdminButton>
                )}
                <AdminChip active={panelOpen} title="모든 입력칸을 섹션별 목록으로 봅니다" leading={<Ico name="lc-list" size={14} />} onClick={() => setPanelOpen(v => !v)}>
                    목록으로 편집
                </AdminChip>
                {onFocusModeChange && (
                    <AdminChip active={focusMode} title="상품 편집창의 오른쪽 열과 제목을 숨기고 디자인을 넓게 봅니다" leading={<Ico name="lc-panels-top-left" size={14} />} onClick={() => onFocusModeChange(!focusMode)}>
                        {focusMode ? '집중 편집 끝' : '집중 편집'}
                    </AdminChip>
                )}
                {sharedCount > 0 && (
                    <span className="de-note">
                        공통 사진 {sharedCount}장 사용 중
                    </span>
                )}
                <AdminButton
                    size="sm"
                    className={ownImageKeys.length > 0 ? 'de-btn-accent' : undefined}
                    onClick={saveOwnImagesAsShared}
                    disabled={ownImageKeys.length === 0 || savingShared}
                    title={
                        ownImageKeys.length === 0
                            ? '이 상품에 직접 올린 사진이 없습니다'
                            : '미리보기에서 올린 사진들을 모든 상품이 함께 쓰는 공통 사진으로 저장합니다'
                    }
                    leading={<Icon name="photo_library" className="de-ico" />}
                >
                    {savingShared ? '저장 중…' : `올린 사진 ${ownImageKeys.length}장을 공통으로 저장`}
                </AdminButton>
                {def.mobile && (
                    <AdminSegmented
                        label="미리보기 화면"
                        items={PREVIEW_VARIANTS}
                        value={previewVariant}
                        onChange={setPreviewVariant}
                    />
                )}
            </div>


            <div className="de-split">
                {/* 좌: 클릭 가능한 미리보기 */}
                <div
                    ref={previewRef}
                    onMouseOver={handlePreviewMouseOver}
                    onMouseLeave={scheduleHoverClear}
                    onDragOver={handlePreviewDragOver}
                    onDragLeave={() => setDropKey(null)}
                    onDrop={handlePreviewDrop}
                    className={cx('de-preview', focusMode && 'is-focus')}
                >
                    <div className={cx('de-preview-inner', previewVariant === 'mobile' && 'is-mobile')}>
                        <DesignBlockView
                            content={content}
                            editing
                            variant={previewVariant}
                            onFieldClick={handlePreviewFieldClick}
                            selectedField={dropKey ?? selectedField}
                            highlightSection={toolbarInst}
                            valueOverrides={valueOverrides}
                            itinerarySlot={(
                                <div className="de-itinerary-slot">
                                    📋 이 자리에 상품의 <b>일정탭</b>에서 작성한 일정표가 표시됩니다
                                </div>
                            )}
                        />
                    </div>
                </div>

                {/* 우: 섹션별 입력칸 목록 — 기본 숨김. 전용 편집기가 필요한 칸이나 ‘목록으로 편집’일 때 연다 */}
                {panelOpen && <div className="de-panel">
                <div className="de-panel-head">
                    <span className="de-note">섹션별 입력칸</span><div className="de-spacer" />
                    <AdminButton size="sm" leading={<Ico name="lc-x" size={13} />} onClick={() => setPanelOpen(false)}>닫기</AdminButton>
                </div>
                {sections.map(sec => {
                    const open = openSection === sec.instId;
                    const filled = filledCount(sec.fields);
                    const repeatable = def.sectionDefs.find(s => s.id === sec.defId)?.repeatable;
                    return (
                        <div key={sec.instId} className="de-sec">
                            <div className={cx('de-sec-head', open && 'is-open')}>
                                {/* 섹션 접기 머리(줄 전체가 눌리는 모양)라 부품 대신 adm- 클래스의 생 버튼 */}
                                <button
                                    type="button"
                                    className="adm-de-sec-toggle"
                                    onClick={() => setOpenSection(open ? null : sec.instId)}
                                >
                                    <Icon name={open ? 'expand_less' : 'expand_more'} className="de-ico is-lg" />
                                    <span className="de-sec-name">{sec.name}</span>
                                    <span className="de-sec-count">
                                        {filled > 0 ? `${filled}개 수정됨` : '원본 그대로'}
                                    </span>
                                </button>
                                <div className="de-sec-tools">
                                    {repeatable && (
                                        <AdminIconButton
                                            label="이 섹션을 내용까지 복제해 아래에 추가"
                                            size="sm"
                                            onClick={() => duplicateSection(sec.instId)}
                                        >
                                            <Icon name="content_copy" className="de-ico" />
                                        </AdminIconButton>
                                    )}
                                    <AdminIconButton
                                        label="이 섹션을 상세페이지에서 빼기"
                                        size="sm"
                                        className="de-icon-danger"
                                        onClick={() => removeSection(sec.instId)}
                                    >
                                        <Icon name="delete" className="de-ico" />
                                    </AdminIconButton>
                                </div>
                            </div>
                            {open && (
                                <div className="de-sec-body">
                                    {sec.fields.map(({ field: f, key: fk }) => (
                                        <div key={fk}>
                                            <label className="de-field-label">
                                                {f.label}
                                            </label>
                                            {valueOverrides?.[baseKey(fk)] !== undefined ? (
                                                <div
                                                    ref={el => { if (el) fieldRefs.current.set(fk, el); else fieldRefs.current.delete(fk); }}
                                                    className="de-auto-box"
                                                >
                                                    <div className="de-note">
                                                        「가격/옵션」 탭의 인원별 가격이 자동으로 반영됩니다. 수정은 그 탭에서 해 주세요.
                                                    </div>
                                                    <pre className="de-pre">{valueOverrides[baseKey(fk)]}</pre>
                                                </div>
                                            ) : f.type === 'image' ? (
                                                <div
                                                    ref={el => { if (el) fieldRefs.current.set(fk, el); else fieldRefs.current.delete(fk); }}
                                                    className={cx('de-img-field', selectedField === fk && 'is-selected')}
                                                >
                                                    {values[fk] ? (
                                                        <div className="de-img-wrap">
                                                            <img
                                                                src={values[fk]}
                                                                alt={f.label}
                                                                className="de-img-thumb"
                                                            />
                                                            {/* 사진 모서리에 붙는 동그란 지우기 표시라 부품 대신 adm- 클래스의 생 버튼 */}
                                                            <button
                                                                type="button"
                                                                className="adm-de-img-remove"
                                                                onClick={() => clearValue(fk)}
                                                                title="이미지 제거"
                                                            >
                                                                <Icon name="close" className="de-ico" />
                                                            </button>
                                                        </div>
                                                    ) : sharedAssets[baseKey(fk)] ? (
                                                        // 상품에 따로 올리지 않았고 공통 이미지가 있는 경우
                                                        <div className="de-img-wrap">
                                                            <img
                                                                src={sharedAssets[baseKey(fk)]}
                                                                alt={f.label}
                                                                className="de-img-thumb is-shared"
                                                            />
                                                            <span
                                                                title="공통 이미지를 사용 중입니다. 이 상품만 다르게 하려면 업로드하세요."
                                                                className="de-shared-badge"
                                                            >
                                                                공통
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="de-img-empty">
                                                            <Icon name="image" className="de-ico is-xl" />
                                                        </div>
                                                    )}
                                                    {/* 파일 칸을 감싼 라벨이라 부품 대신 같은 모양 클래스(AdminButton 보조·작게) */}
                                                    <label className="adm-ui-btn is-secondary is-sm de-upload">
                                                        <span className="adm-ui-btn-icon"><Icon name="upload" className="de-ico" /></span>
                                                        <span className="adm-ui-btn-label">{uploadingKey === fk ? '업로드 중…' : (values[fk] ? '변경' : '업로드')}</span>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="de-file"
                                                            onChange={(e) => {
                                                                handleImageUpload(fk, e.target.files?.[0]);
                                                                e.target.value = '';
                                                            }}
                                                        />
                                                    </label>
                                                </div>
                                            ) : f.type === 'spot-cards' ? (
                                                <div ref={el => { if (el) fieldRefs.current.set(fk, el); else fieldRefs.current.delete(fk); }}>
                                                    <SpotCardsField
                                                        onBusyChange={changeBusy}
                                                        value={values[fk] ?? f.default ?? ''}
                                                        onChange={(next) => setValue(fk, next)}
                                                    />
                                                </div>
                                            ) : f.type === 'map-stops' ? (
                                                <div ref={el => { if (el) fieldRefs.current.set(fk, el); else fieldRefs.current.delete(fk); }}>
                                                    <MapStopsField
                                                        onBusyChange={changeBusy}
                                                        value={values[fk] ?? f.default ?? ''}
                                                        onChange={(next) => setValue(fk, next)}
                                                    />
                                                </div>
                                            ) : f.type === 'textarea' ? (
                                                <>
                                                {f.presetLines && (
                                                    <PresetLineChips
                                                        presetLines={f.presetLines}
                                                        separator={f.presetSeparator}
                                                        value={values[fk] ?? f.default ?? ''}
                                                        onChange={(next) => setValue(fk, next)}
                                                    />
                                                )}
                                                <AdminTextArea
                                                    ref={el => { if (el) fieldRefs.current.set(fk, el); else fieldRefs.current.delete(fk); }}
                                                    className={selectedField === fk ? 'de-selected' : undefined}
                                                    minRows={Math.min(6, Math.max(2, (f.default?.split('\n').length ?? 2)))}
                                                    value={values[fk] ?? f.default ?? ''}
                                                    placeholder={f.default || ''}
                                                    onChange={(e) => setValue(fk, e.target.value)}
                                                    onFocus={() => handleFieldFocus(fk)}
                                                />
                                                </>
                                            ) : (
                                                <>
                                                {f.presets && (
                                                    <PresetChips
                                                        presets={f.presets}
                                                        value={values[fk] ?? f.default ?? ''}
                                                        onPick={(p) => setValue(fk, p)}
                                                    />
                                                )}
                                                {f.presetLines && (
                                                    <PresetLineChips
                                                        presetLines={f.presetLines}
                                                        separator={f.presetSeparator}
                                                        value={values[fk] ?? f.default ?? ''}
                                                        onChange={(next) => setValue(fk, next)}
                                                    />
                                                )}
                                                <AdminTextInput
                                                    ref={el => { if (el) fieldRefs.current.set(fk, el); else fieldRefs.current.delete(fk); }}
                                                    type="text"
                                                    className={selectedField === fk ? 'de-selected' : undefined}
                                                    value={values[fk] ?? f.default ?? ''}
                                                    placeholder={f.default || ''}
                                                    onChange={(e) => setValue(fk, e.target.value)}
                                                    onFocus={() => handleFieldFocus(fk)}
                                                />
                                                </>
                                            )}
                                            {f.help && f.type !== 'map-stops' && (
                                                <div className="de-help">{f.help}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {removedDefs.length > 0 && (
                    <div className="de-dashed-box">
                        <div className="de-note">뺀 섹션 — 다시 넣으면 입력했던 내용이 그대로 돌아옵니다</div>
                        <div className="de-row is-wrap is-tight">
                            {removedDefs.map(s => (
                                <AdminButton key={s.id} size="sm" leading={<Icon name="add" className="de-ico" />} onClick={() => restoreSection(s.id)}>
                                    {s.id}
                                </AdminButton>
                            ))}
                        </div>
                    </div>
                )}
                </div>}
            </div>
            <V7Menu menu={removedMenu} onClose={() => setRemovedMenu(null)} />
            {inline && inlineEntry && inline.kind === 'text-field' && (
                <FieldPopover key={inline.key} field={inlineEntry.field} value={values[inline.key] ?? inlineEntry.field.default ?? ''} anchor={inlineAnchor} disabled={uploadingKey !== null}
                    readOnlyNote={valueOverrides?.[baseKey(inline.key)] !== undefined ? '「가격/옵션」 탭의 인원별 가격이 자동으로 반영됩니다. 수정은 그 탭에서 해 주세요.' : undefined}
                    size={content.textStyles?.[inline.key]?.size} onSizeChange={next => onChange({ ...content, textStyles: commitTextSize(content.textStyles, inline.key, next) })}
                    onChange={next => onChange({ ...content, values: commitValue(values, inline.key, next, inlineEntry.field.default) })} onClear={() => clearValue(inline.key)}
                    onClose={() => setInline(null)}
                    isInside={target => !!previewRef.current?.querySelector(fieldSelector(inline.key))?.contains(target)} />
            )}
            {inline && inlineEntry && inline.kind === 'image-field' && (
                <ImagePopover key={inline.key} label={inlineEntry.field.label} value={values[inline.key] ?? ''} sharedUrl={sharedAssets[baseKey(inline.key)]}
                    uploading={uploadingKey === inline.key} disabled={uploadingKey !== null && uploadingKey !== inline.key} anchor={inlineAnchor}
                    onUpload={file => void handleImageUpload(inline.key, file)} onUseShared={() => clearValue(inline.key)} onClear={() => clearValue(inline.key)} onClose={() => setInline(null)}
                    isInside={target => !!previewRef.current?.querySelector(fieldSelector(inline.key))?.contains(target)} />
            )}
            {toolbarSection && (
                <SectionToolbar name={toolbarSection.name} position={toolbarPosition} disabled={uploadingKey !== null || savingShared}
                    repeatable={!!def.sectionDefs.find(sec => sec.id === toolbarSection.defId)?.repeatable}
                    imageFields={toolbarSection.fields.filter(f => f.field.type === 'image').map(f => ({ key: f.key, label: f.field.label, filled: !!values[f.key] }))}
                    onDuplicate={() => duplicateSection(toolbarSection.instId)}
                    onRemove={() => { setInline(null); setActiveInst(null); setHoverInst(null); removeSection(toolbarSection.instId); }}
                    onPickImage={key => { setSelectedField(key); setActiveInst(toolbarSection.instId); setInline({ kind: 'image-field', key }); }}
                    onOpenPanel={() => { setPanelOpen(true); setOpenSection(toolbarSection.instId); }}
                    onPointerEnter={keepHover} onPointerLeave={scheduleHoverClear} />
            )}
        </div>
    );
}
