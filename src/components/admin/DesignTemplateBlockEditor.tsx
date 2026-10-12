import { useMemo, useRef, useState } from 'react';
import type { DesignBlockContent, TourPricingOption } from '../../types/product';
import type { DesignPreset, DesignTemplateField } from '../product/designTemplates/types';
import { getDesignTemplate } from '../product/designTemplates/registry';
import DesignBlockView from '../product/designTemplates/DesignBlockView';
import { priceRowsFromOptions } from '../product/designTemplates/pricing';
import { MAP_DESTINATIONS } from '../product/designTemplates/mapDestinations';
import { baseKey, fieldKeysOfSection, nextCopyId, resolveInstances, scopeOf, scopedKey } from '../product/designTemplates/sections';
import { saveDesignDefaults, useAllDesignDefaults, useDesignGlobalDefaults } from '../product/designTemplates/globalDefaults';
import { uploadImage } from '../../utils/upload';
import { Icon } from './console/Icon';
import { useDesignSpots } from '../product/designTemplates/designSpots';

/**
 * 지도 경유지 선택 UI — 지도에 좌표가 등록된 여행지 목록에서 골라 담는다.
 * 저장 형식은 기존과 동일한 텍스트("지역명|표시 라벨" 줄 단위)라서
 * 지도/템플릿 쪽은 그대로 동작하고, 직접 입력(좌표·사진)도 그대로 지원한다.
 */
/** 방문 여행지 카드 목록 — 「여행지 사진」 페이지에 등록한 목록에서 골라 담고, 이름·사진을 줄 단위로 관리한다 */
function SpotCardsField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
    const registered = useDesignSpots();
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
        try {
            setUploadingIdx(i);
            patch(i, { img: await uploadImage(file, 'product-details') });
        } catch (error) {
            console.error('Spot card image upload failed:', error);
            alert('이미지 업로드 실패');
        } finally {
            setUploadingIdx(null);
        }
    };

    return (
        <div className="stack" style={{ gap: 8 }}>
            {lines.length === 0 && (
                <div className="cell-muted" style={{ fontSize: 12 }}>아래에서 여행지를 추가하면 카드가 순서대로 표시됩니다</div>
            )}
            {lines.map((line, i) => {
                const { title, img } = parseLine(line);
                return (
                    <div key={i} className="row" style={{ gap: 6, alignItems: 'center', padding: '6px 8px', border: '1px solid var(--border-default)', borderRadius: 8, background: 'var(--bg-muted, #f8f9fa)' }}>
                        <label title={img ? '사진 변경' : '사진 업로드'} style={{ flex: 'none', width: 44, height: 44, borderRadius: 8, overflow: 'hidden', border: img ? '2px solid #06C4A0' : '2px dashed var(--border-default)', cursor: 'pointer', display: 'grid', placeItems: 'center', background: '#fff' }}>
                            {uploadingIdx === i
                                ? <Icon name="progress_activity" style={{ fontSize: 16, color: '#06C4A0' }} />
                                : img
                                    ? <img src={img} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <Icon name="add_a_photo" style={{ fontSize: 15, color: 'var(--text-muted)' }} />}
                            <input type="file" accept="image/*" style={{ display: 'none' }}
                                onChange={(e) => { handleUpload(i, e.target.files?.[0]); e.target.value = ''; }} />
                        </label>
                        <input
                            className="inp"
                            style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700 }}
                            value={title}
                            placeholder="여행지 이름 (한국어 표기)"
                            onChange={(e) => patch(i, { title: e.target.value })}
                        />
                        <button type="button" className="act-btn" title="위로" onClick={() => move(i, -1)}><Icon name="arrow_upward" style={{ fontSize: 15 }} /></button>
                        <button type="button" className="act-btn" title="아래로" onClick={() => move(i, 1)}><Icon name="arrow_downward" style={{ fontSize: 15 }} /></button>
                        <button type="button" className="act-btn" title="카드 제거" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Icon name="close" style={{ fontSize: 15, color: 'var(--mrt-red)' }} /></button>
                    </div>
                );
            })}
            <div style={{ border: '1px dashed var(--border-default)', borderRadius: 8, padding: '8px 10px' }}>
                <div className="cell-muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    등록된 여행지 — 누르면 카드에 추가됩니다
                    <a href="/admin/design-spots" target="_blank" rel="noreferrer" style={{ marginLeft: 8, color: '#06C4A0', fontWeight: 700 }}>여행지 등록 관리 ↗</a>
                </div>
                {registered.length === 0 ? (
                    <div className="cell-muted" style={{ fontSize: 12 }}>아직 등록된 여행지가 없습니다. 「여행지 사진」 페이지에서 사진+이름을 등록해 주세요.</div>
                ) : (
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        {registered.map(sp => (
                            <button key={sp.id} type="button" className="chip" title={`${sp.name} 카드 추가`} onClick={() => addRegistered(sp.name, sp.image)} style={{ paddingLeft: 4 }}>
                                <img src={sp.image} alt="" style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover' }} />
                                {sp.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function MapStopsField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
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
        try {
            setUploadingIdx(i);
            const url = await uploadImage(file, 'product-details');
            setLineImage(i, url);
        } catch (error) {
            console.error('Map stop image upload failed:', error);
            alert('이미지 업로드 실패');
        } finally {
            setUploadingIdx(null);
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
        <div className="stack" style={{ gap: 8 }}>
            {lines.length === 0 && (
                <div className="cell-muted" style={{ fontSize: 12 }}>아래에서 여행지를 추가하면 지도에 순서대로 표시됩니다</div>
            )}
            {lines.map((line, i) => {
                const { ko, ja, img } = parseLine(line);
                return (
                    <div key={`${ko}-${i}`} className="row" style={{ gap: 6, alignItems: 'center', padding: '6px 8px', border: '1px solid var(--border-default)', borderRadius: 8, background: 'var(--bg-muted, #f8f9fa)' }}>
                        <span style={{ flex: 'none', width: 20, height: 20, borderRadius: '50%', background: '#06C4A0', color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{i + 1}</span>
                        {/* 원형 버블에 표시될 사진 — 클릭해서 업로드/변경 */}
                        <label title={img ? '사진 변경' : '사진 업로드 (지도 원형에 표시)'} style={{ flex: 'none', width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', border: img ? '2px solid #06C4A0' : '2px dashed var(--border-default)', cursor: 'pointer', display: 'grid', placeItems: 'center', background: '#fff' }}>
                            {uploadingIdx === i
                                ? <Icon name="progress_activity" style={{ fontSize: 16, color: '#06C4A0' }} />
                                : img
                                    ? <img src={img} alt={ko} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <Icon name="add_a_photo" style={{ fontSize: 15, color: 'var(--text-muted)' }} />}
                            <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={(e) => { handleStopImageUpload(i, e.target.files?.[0]); e.target.value = ''; }}
                            />
                        </label>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ko}{ja ? <span className="cell-muted" style={{ fontWeight: 500, marginLeft: 6 }}>{ja}</span> : null}
                        </span>
                        {img && (
                            <button type="button" className="act-btn" title="사진 제거" onClick={() => setLineImage(i, '')}><Icon name="image" style={{ fontSize: 15, color: 'var(--mrt-red)' }} /></button>
                        )}
                        <button type="button" className="act-btn" title="위로" disabled={i === 0} onClick={() => move(i, -1)}><Icon name="arrow_upward" style={{ fontSize: 15 }} /></button>
                        <button type="button" className="act-btn" title="아래로" disabled={i === lines.length - 1} onClick={() => move(i, 1)}><Icon name="arrow_downward" style={{ fontSize: 15 }} /></button>
                        <button type="button" className="act-btn danger" title="삭제" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}><Icon name="close" style={{ fontSize: 15 }} /></button>
                    </div>
                );
            })}
            <select
                className="inp"
                value=""
                onChange={(e) => { addDestination(e.target.value); e.target.value = ''; }}
            >
                <option value="">＋ 여행지 추가…</option>
                {groups.map(g => (
                    <optgroup key={g.name} label={g.name}>
                        {g.items.map(d => (
                            <option key={d.ko} value={d.ko}>{d.ja} — {d.en}</option>
                        ))}
                    </optgroup>
                ))}
            </select>
            <button type="button" className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => setAdvanced(a => !a)}>
                <Icon name="edit_note" style={{ fontSize: 15 }} />{advanced ? '직접 입력 닫기' : '직접 입력 (목록에 없는 지역·좌표·사진)'}
            </button>
            {advanced && (
                <>
                    <textarea
                        className="inp"
                        rows={Math.max(3, lines.length + 1)}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                    />
                    <div className="muted" style={{ fontSize: 11 }}>
                        한 줄에 한 곳: 지역명|표시문구|사진URL|위도,경도 (사진·좌표 생략 가능). 미등록 지역은 위도,경도를 넣으면 그 위치에 표시됩니다.
                    </div>
                </>
            )}
        </div>
    );
}

/**
 * 프리셋을 { label, value }로 정규화.
 * 버튼에는 관리자가 알아보기 쉬운 label을, 실제 입력값에는 value(고객 페이지에 표시되는 문구)를 쓴다.
 */
function normPresets(presets: DesignPreset[]): { label: string; value: string }[] {
    return presets.map(p => (typeof p === 'string' ? { label: p, value: p } : p));
}

/**
 * 자주 쓰는 값 버튼 — 누르면 입력칸이 그 값으로 채워진다.
 * (직접 입력도 그대로 가능. 목록에 없는 값은 타이핑하면 된다)
 */
function PresetChips({ presets, value, onPick }: { presets: DesignPreset[]; value: string; onPick: (v: string) => void }) {
    const items = normPresets(presets);
    const translated = items.some(p => p.label !== p.value);
    return (
        <>
            <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginBottom: 5 }}>
                {items.map(p => (
                    <button
                        key={p.value}
                        type="button"
                        onClick={() => onPick(p.value)}
                        title={p.label === p.value ? `"${p.value}"(으)로 채우기` : `페이지에는 "${p.value}"로 표시됩니다`}
                        style={{
                            padding: '2px 8px', borderRadius: 500, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                            border: '1px solid', ...(value === p.value
                                ? { borderColor: '#06C4A0', background: 'rgba(6,196,160,0.12)', color: '#029F85' }
                                : { borderColor: 'var(--border-default)', background: 'transparent', color: 'var(--text-muted)' }),
                        }}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
            {translated && (
                <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
                    버튼 이름과 페이지에 표시되는 문구가 다를 수 있습니다 (버튼에 마우스를 올리면 확인)
                </div>
            )}
        </>
    );
}

/**
 * 자주 쓰는 줄 버튼 — 누르면 그 줄이 추가되고, 다시 누르면 빠진다.
 * 순서는 프리셋 목록 순서를 따르고, 직접 입력한 줄은 뒤에 남는다.
 */
function PresetLineChips({ presetLines, value, onChange, separator = '\n' }: { presetLines: DesignPreset[]; value: string; onChange: (v: string) => void; separator?: string }) {
    const items = normPresets(presetLines);
    const known = items.map(p => p.value);
    const lines = value.split(separator).map(s => s.trim()).filter(Boolean);
    const translated = items.some(p => p.label !== p.value);
    const toggle = (line: string) => {
        const next = lines.includes(line) ? lines.filter(l => l !== line) : [...lines, line];
        // 프리셋에 있는 항목은 목록 순서대로, 직접 입력한 항목은 그 뒤에
        onChange([...known.filter(k => next.includes(k)), ...next.filter(l => !known.includes(l))].join(separator));
    };
    return (
        <>
            <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginBottom: 5 }}>
                {items.map(p => {
                    const on = lines.includes(p.value);
                    return (
                        <button
                            key={p.value}
                            type="button"
                            onClick={() => toggle(p.value)}
                            title={`${on ? '빼기' : '추가'} — 페이지 표시: ${p.value}`}
                            style={{
                                padding: '2px 8px', borderRadius: 500, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                                border: '1px solid', ...(on
                                    ? { borderColor: '#06C4A0', background: 'rgba(6,196,160,0.12)', color: '#029F85' }
                                    : { borderColor: 'var(--border-default)', background: 'transparent', color: 'var(--text-muted)' }),
                            }}
                        >
                            {on ? '✓ ' : '+ '}{p.label}
                        </button>
                    );
                })}
            </div>
            {translated && (
                <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>
                    버튼 이름과 페이지에 표시되는 문구가 다를 수 있습니다 (버튼에 마우스를 올리면 확인)
                </div>
            )}
        </>
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
}: {
    content: DesignBlockContent;
    onChange: (next: DesignBlockContent) => void;
    /** 상품 「가격/옵션」 탭의 인원별 가격 — 있으면 디자인 가격표에 자동 반영된다 */
    pricingOptions?: TourPricingOption[];
}) {
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

    /** 미리보기에서 필드 클릭 → 해당 섹션 열고 입력칸으로 스크롤 + 포커스 */
    const handlePreviewFieldClick = (key: string) => {
        const owner = sections.find(s => s.fields.some(f => f.key === key));
        if (!owner) return;
        setSelectedField(key);
        setOpenSection(owner.instId);
        // 섹션이 방금 열렸으면 입력칸이 다음 렌더에 생기므로 한 프레임 기다린다
        setTimeout(() => {
            const el = fieldRefs.current.get(key);
            el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            (el as HTMLInputElement | HTMLTextAreaElement | null)?.focus?.({ preventScroll: true });
        }, 60);
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
        for (const key of fieldKeysOfSection(def, defId)) {
            const from = scopedKey(key, instId);
            const cur = content.values?.[from];
            if (cur !== undefined && cur !== '') nextValues[scopedKey(key, newId)] = cur;
        }
        const nextSections = [...instances];
        nextSections.splice(idx + 1, 0, { id: newId, def: defId });
        onChange({ ...content, values: nextValues, sections: nextSections });
        setOpenSection(newId);
    };

    /** 섹션 빼기 — 마지막 하나면 hidden 표시로 남긴다 (템플릿에 새 섹션이 생겨도 삭제가 유지되도록) */
    const removeSection = (instId: string) => {
        if (!window.confirm('이 섹션을 상세페이지에서 빼시겠습니까? 입력한 내용은 남아 있습니다.')) return;
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
            <div className="card-muted-note">
                <Icon name="warning" />
                <span>알 수 없는 디자인 템플릿입니다: {content?.templateId}</span>
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
        const ok = window.confirm(
            `지금 올린 사진 ${ownImageKeys.length}장을 모든 상품이 함께 쓰는 공통 사진으로 저장할까요?\n\n` +
            '이 상품 화면은 그대로이고, 앞으로 새로 만드는 상품에도 같은 사진이 자동으로 들어갑니다.',
        );
        if (!ok) return;
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
            alert('공통 사진 저장에 실패했습니다');
        } finally {
            setSavingShared(false);
        }
    };

    const setValue = (key: string, value: string) => {
        onChange({ ...content, values: { ...values, [key]: value } });
    };

    const handleImageUpload = async (key: string, file: File | undefined) => {
        if (!file) return;
        try {
            setUploadingKey(key);
            const url = await uploadImage(file, 'product-details');
            setValue(key, url);
        } catch (error) {
            console.error('Design image upload failed:', error);
            alert('이미지 업로드 실패');
        } finally {
            setUploadingKey(null);
        }
    };

    const filledCount = (fields: { field: DesignTemplateField; key: string }[]) =>
        fields.filter(({ field, key }) => {
            const raw = values[key] ?? '';
            return raw !== '' && raw !== (field.default ?? '');
        }).length;

    return (
        <div className="stack" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="badge b-gray">{def.name}</span>
                <span className="cell-muted" style={{ fontSize: 12 }}>
                    미리보기의 문구·사진을 클릭하면 바로 편집할 수 있습니다 — 전부 지우면 원본으로 되돌아갑니다
                </span>
                <div className="spacer" />
                {sharedCount > 0 && (
                    <span className="cell-muted" style={{ fontSize: 12 }}>
                        공통 사진 {sharedCount}장 사용 중
                    </span>
                )}
                <button
                    type="button"
                    className="chip"
                    onClick={saveOwnImagesAsShared}
                    disabled={ownImageKeys.length === 0 || savingShared}
                    title={
                        ownImageKeys.length === 0
                            ? '이 상품에 직접 올린 사진이 없습니다'
                            : '미리보기에서 올린 사진들을 모든 상품이 함께 쓰는 공통 사진으로 저장합니다'
                    }
                    style={ownImageKeys.length > 0 ? { borderColor: '#06C4A0', color: '#029F85' } : undefined}
                >
                    <Icon name="photo_library" style={{ fontSize: 16 }} />
                    {savingShared ? '저장 중…' : `올린 사진 ${ownImageKeys.length}장을 공통으로 저장`}
                </button>
                {def.mobile && (
                    <div className="row" style={{ gap: 6 }}>
                        {(['desktop', 'mobile'] as const).map(vt => (
                            <button
                                key={vt}
                                type="button"
                                className="chip"
                                onClick={() => setPreviewVariant(vt)}
                                style={previewVariant === vt ? { background: 'var(--mrt-navy, #1a2b4a)', color: '#fff' } : undefined}
                            >
                                {vt === 'desktop' ? 'PC' : '모바일'}
                            </button>
                        ))}
                    </div>
                )}
            </div>


            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {/* 좌: 클릭 가능한 미리보기 */}
                <div
                    ref={previewRef}
                    style={{ flex: 1, minWidth: 0, maxHeight: '78vh', overflowY: 'auto', border: '1px solid var(--border-default)', borderRadius: 'var(--r-md)', background: '#fff' }}
                >
                    <div style={{ maxWidth: previewVariant === 'mobile' ? 430 : undefined, margin: previewVariant === 'mobile' ? '0 auto' : undefined }}>
                        <DesignBlockView
                            content={content}
                            editing
                            variant={previewVariant}
                            onFieldClick={handlePreviewFieldClick}
                            selectedField={selectedField}
                            valueOverrides={valueOverrides}
                            itinerarySlot={(
                                <div style={{ padding: '28px 16px', background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: 12, margin: '8px 0', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                                    📋 이 자리에 상품의 <b>일정탭</b>에서 작성한 일정표가 표시됩니다
                                </div>
                            )}
                        />
                    </div>
                </div>

                {/* 우: 섹션별 폼 */}
                <div className="stack" style={{ gap: 6, flex: '0 0 420px', maxHeight: '78vh', overflowY: 'auto' }}>
                {sections.map(sec => {
                    const open = openSection === sec.instId;
                    const filled = filledCount(sec.fields);
                    const repeatable = def.sectionDefs.find(s => s.id === sec.defId)?.repeatable;
                    return (
                        <div key={sec.instId} style={{ flex: 'none', border: '1px solid var(--border-default)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                            <div className="row" style={{ gap: 0, alignItems: 'stretch', background: open ? 'var(--bg-muted, #f6f7f8)' : 'transparent' }}>
                                <button
                                    type="button"
                                    onClick={() => setOpenSection(open ? null : sec.instId)}
                                    style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 4px 10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                                >
                                    <Icon name={open ? 'expand_less' : 'expand_more'} style={{ fontSize: 18, flex: 'none' }} />
                                    <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec.name}</span>
                                    <span className="cell-muted" style={{ fontSize: 12, marginLeft: 'auto', flex: 'none' }}>
                                        {filled > 0 ? `${filled}개 수정됨` : '원본 그대로'}
                                    </span>
                                </button>
                                <div className="row" style={{ gap: 2, alignItems: 'center', padding: '0 8px 0 4px', flex: 'none' }}>
                                    {repeatable && (
                                        <button
                                            type="button"
                                            className="act-btn"
                                            title="이 섹션을 내용까지 복제해 아래에 추가"
                                            onClick={() => duplicateSection(sec.instId)}
                                        >
                                            <Icon name="content_copy" style={{ fontSize: 15 }} />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="act-btn danger"
                                        title="이 섹션을 상세페이지에서 빼기"
                                        onClick={() => removeSection(sec.instId)}
                                    >
                                        <Icon name="delete" style={{ fontSize: 15 }} />
                                    </button>
                                </div>
                            </div>
                            {open && (
                                <div className="stack" style={{ gap: 10, padding: '12px 12px 14px' }}>
                                    {sec.fields.map(({ field: f, key: fk }) => (
                                        <div key={fk}>
                                            <label className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                                                {f.label}
                                            </label>
                                            {valueOverrides?.[baseKey(fk)] !== undefined ? (
                                                <div
                                                    ref={el => { if (el) fieldRefs.current.set(fk, el); else fieldRefs.current.delete(fk); }}
                                                    style={{ border: '1px dashed var(--border-default)', borderRadius: 'var(--r-md)', padding: '10px 12px', background: 'var(--bg-muted, #f8fafc)' }}
                                                >
                                                    <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                                                        「가격/옵션」 탭의 인원별 가격이 자동으로 반영됩니다. 수정은 그 탭에서 해 주세요.
                                                    </div>
                                                    <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--text-muted)' }}>{valueOverrides[baseKey(fk)]}</pre>
                                                </div>
                                            ) : f.type === 'image' ? (
                                                <div
                                                    ref={el => { if (el) fieldRefs.current.set(fk, el); else fieldRefs.current.delete(fk); }}
                                                    className="row"
                                                    style={{ gap: 10, alignItems: 'center', ...(selectedField === fk ? { outline: '2px solid rgba(6,196,160,0.5)', outlineOffset: 4, borderRadius: 6 } : {}) }}
                                                >
                                                    {values[fk] ? (
                                                        <div style={{ position: 'relative', flex: 'none' }}>
                                                            <img
                                                                src={values[fk]}
                                                                alt={f.label}
                                                                style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--r-md)', border: '1px solid var(--border-default)' }}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setValue(fk, '')}
                                                                title="이미지 제거"
                                                                style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'var(--mrt-red)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
                                                            >
                                                                <Icon name="close" style={{ fontSize: 14 }} />
                                                            </button>
                                                        </div>
                                                    ) : sharedAssets[baseKey(fk)] ? (
                                                        // 상품에 따로 올리지 않았고 공통 이미지가 있는 경우
                                                        <div style={{ position: 'relative', flex: 'none' }}>
                                                            <img
                                                                src={sharedAssets[baseKey(fk)]}
                                                                alt={f.label}
                                                                style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--r-md)', border: '1px solid #06C4A0' }}
                                                            />
                                                            <span
                                                                title="공통 이미지를 사용 중입니다. 이 상품만 다르게 하려면 업로드하세요."
                                                                style={{ position: 'absolute', left: -4, bottom: -6, padding: '1px 6px', borderRadius: 500, background: '#06C4A0', color: '#fff', fontSize: 10, fontWeight: 800 }}
                                                            >
                                                                공통
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div style={{ width: 72, height: 72, borderRadius: 'var(--r-md)', border: '1px dashed var(--border-default)', display: 'grid', placeItems: 'center', color: 'var(--text-muted)', flex: 'none' }}>
                                                            <Icon name="image" style={{ fontSize: 20 }} />
                                                        </div>
                                                    )}
                                                    <label className="chip" style={{ cursor: 'pointer' }}>
                                                        <Icon name="upload" style={{ fontSize: 16 }} />
                                                        {uploadingKey === fk ? '업로드 중…' : (values[fk] ? '변경' : '업로드')}
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            style={{ display: 'none' }}
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
                                                        value={values[fk] ?? f.default ?? ''}
                                                        onChange={(next) => setValue(fk, next)}
                                                    />
                                                </div>
                                            ) : f.type === 'map-stops' ? (
                                                <div ref={el => { if (el) fieldRefs.current.set(fk, el); else fieldRefs.current.delete(fk); }}>
                                                    <MapStopsField
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
                                                <textarea
                                                    ref={el => { if (el) fieldRefs.current.set(fk, el); else fieldRefs.current.delete(fk); }}
                                                    className="inp"
                                                    rows={Math.min(6, Math.max(2, (f.default?.split('\n').length ?? 2)))}
                                                    value={values[fk] ?? f.default ?? ''}
                                                    placeholder={f.default || ''}
                                                    onChange={(e) => setValue(fk, e.target.value)}
                                                    onFocus={() => handleFieldFocus(fk)}
                                                    style={selectedField === fk ? { borderColor: '#06C4A0', boxShadow: '0 0 0 2px rgba(6,196,160,0.25)' } : undefined}
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
                                                <input
                                                    ref={el => { if (el) fieldRefs.current.set(fk, el); else fieldRefs.current.delete(fk); }}
                                                    type="text"
                                                    className="inp"
                                                    value={values[fk] ?? f.default ?? ''}
                                                    placeholder={f.default || ''}
                                                    onChange={(e) => setValue(fk, e.target.value)}
                                                    onFocus={() => handleFieldFocus(fk)}
                                                    style={selectedField === fk ? { borderColor: '#06C4A0', boxShadow: '0 0 0 2px rgba(6,196,160,0.25)' } : undefined}
                                                />
                                                </>
                                            )}
                                            {f.help && f.type !== 'map-stops' && (
                                                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{f.help}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {removedDefs.length > 0 && (
                    <div style={{ flex: 'none', border: '1px dashed var(--border-default)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
                        <div className="cell-muted" style={{ fontSize: 12, marginBottom: 8 }}>뺀 섹션 — 다시 넣으면 입력했던 내용이 그대로 돌아옵니다</div>
                        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                            {removedDefs.map(s => (
                                <button key={s.id} type="button" className="chip" onClick={() => restoreSection(s.id)}>
                                    <Icon name="add" style={{ fontSize: 15 }} />{s.id}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                </div>
            </div>
        </div>
    );
}
