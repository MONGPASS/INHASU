import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { uploadImage } from '../utils/upload';
import { loadDesignSpots, saveDesignSpots, type DesignSpot } from '../components/product/designTemplates/designSpots';
import { MAP_DESTINATIONS, toJaDestinationName } from '../components/product/designTemplates/mapDestinations';

const CUSTOM = '__custom__';

/**
 * 여행지 사진 — 디자인 템플릿 「방문 여행지」 카드에서 바로 불러 쓰는
 * 이미지 + 이름만의 가벼운 등록 페이지. (관광지 마스터와 별개)
 * 이름은 영어 목록에서 고르면 운영 페이지에는 공식 한국어 표기(mapDestinations의 표시 라벨 ja)로 표시된다.
 */
export const AdminDesignSpotManage: React.FC = () => {
    const [spots, setSpots] = useState<DesignSpot[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [converted, setConverted] = useState<string[]>([]);
    const [pick, setPick] = useState('');            // 선택한 영어 표기 (또는 CUSTOM)
    const [customName, setCustomName] = useState('');
    const [newImage, setNewImage] = useState('');
    const [uploadingNew, setUploadingNew] = useState(false);
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const selectRef = useRef<HTMLSelectElement>(null);

    /** 영어 → 고객용 표기 목록을 지역별로 묶는다 (지도 경유지와 같은 순서) */
    const groups = useMemo(() => {
        const out: { name: string; items: typeof MAP_DESTINATIONS }[] = [];
        for (const d of MAP_DESTINATIONS) {
            const last = out[out.length - 1];
            if (last && last.name === d.group) last.items.push(d);
            else out.push({ name: d.group, items: [d] });
        }
        return out;
    }, []);

    useEffect(() => {
        loadDesignSpots(true).then(async (v) => {
            // 예전에 영어·일본어로 등록해 둔 이름은 공식 한국어 표기로 한 번 바꿔 저장한다
            const changed: string[] = [];
            const next = v.map(s => {
                const ja = toJaDestinationName(s.name);
                if (ja === s.name) return s;
                changed.push(`${s.name} → ${ja}`);
                const hit = MAP_DESTINATIONS.find(d => d.ja === ja);
                return { ...s, name: ja, en: hit?.en ?? s.en };
            });
            setSpots(next);
            setLoading(false);
            if (changed.length > 0) {
                setConverted(changed);
                try { await saveDesignSpots(next); } catch (error) { console.error('Design spot auto-convert save failed:', error); }
            }
        });
    }, []);

    const persist = async (next: DesignSpot[]) => {
        setSpots(next);
        setSaving(true);
        try {
            await saveDesignSpots(next);
        } catch (error) {
            console.error('Design spot save failed:', error);
            alert('저장 실패 — 잠시 후 다시 시도해 주세요');
        } finally {
            setSaving(false);
        }
    };

    const handleNewUpload = async (file: File | undefined) => {
        if (!file) return;
        try {
            setUploadingNew(true);
            setNewImage(await uploadImage(file, 'design-spots'));
        } catch (error) {
            console.error('Design spot image upload failed:', error);
            alert('이미지 업로드 실패');
        } finally {
            setUploadingNew(false);
        }
    };

    const picked = pick && pick !== CUSTOM ? MAP_DESTINATIONS.find(d => d.en === pick) : undefined;
    const previewName = picked ? picked.ja : (pick === CUSTOM ? toJaDestinationName(customName) : '');

    const addSpot = () => {
        if (!pick) { alert('여행지를 목록에서 골라 주세요'); return; }
        const name = previewName.trim();
        if (!name) { alert('여행지 이름을 입력해 주세요 (운영 페이지에 그대로 표시되므로 한국어 권장)'); return; }
        if (!newImage) { alert('사진을 올려 주세요'); return; }
        persist([...spots, { id: `spot_${Date.now()}`, name, en: picked?.en, image: newImage }]);
        setPick('');
        setCustomName('');
        setNewImage('');
        selectRef.current?.focus();
    };

    const replaceImage = async (id: string, file: File | undefined) => {
        if (!file) return;
        try {
            setUploadingId(id);
            const url = await uploadImage(file, 'design-spots');
            await persist(spots.map(s => (s.id === id ? { ...s, image: url } : s)));
        } catch (error) {
            console.error('Design spot image upload failed:', error);
            alert('이미지 업로드 실패');
        } finally {
            setUploadingId(null);
        }
    };

    /** 기존 카드의 이름을 목록에서 다시 고른다 (영어 → 고객용 표기) */
    const repick = (id: string, en: string) => {
        if (en === CUSTOM) {
            const typed = window.prompt('여행지 이름을 직접 입력 (한국어 권장)');
            if (typed === null) return;
            const name = toJaDestinationName(typed).trim();
            if (!name) return;
            persist(spots.map(s => (s.id === id ? { ...s, name, en: undefined } : s)));
            return;
        }
        const hit = MAP_DESTINATIONS.find(d => d.en === en);
        if (!hit) return;
        persist(spots.map(s => (s.id === id ? { ...s, name: hit.ja, en: hit.en } : s)));
    };

    const removeSpot = (id: string) => {
        const target = spots.find(s => s.id === id);
        if (!target) return;
        if (!window.confirm(`"${target.name}" 여행지를 삭제하시겠습니까?\n\n이미 카드에 담아 저장한 상품에는 영향이 없습니다.`)) return;
        persist(spots.filter(s => s.id !== id));
    };

    const destinationOptions = () => (
        <>
            <option value="">여행지 선택 (영어)</option>
            {groups.map(g => (
                <optgroup key={g.name} label={g.name}>
                    {g.items.map(d => <option key={d.en} value={d.en}>{d.en} — {d.ja}</option>)}
                </optgroup>
            ))}
            <option value={CUSTOM}>직접 입력…</option>
        </>
    );

    return (
        <AdminLayout
            activePage="design-spots"
            title="여행지 사진"
            description="디자인 템플릿의 「방문 여행지」 카드에서 바로 골라 쓰는 목록입니다. 영어로 고르면 운영 페이지에는 공식 한국어 표기로 표시됩니다."
            showSearch={false}
            actions={saving ? <span className="cell-muted" style={{ fontSize: 12 }}>저장 중…</span> : undefined}
        >
            {converted.length > 0 && (
                <div className="card" style={{ padding: '10px 14px', marginBottom: 12, fontSize: 13, borderLeft: '3px solid #06C4A0' }}>
                    예전 표기(영어·일본어)로 등록돼 있던 이름을 공식 한국어 표기로 바꿨습니다: {converted.join(', ')}
                </div>
            )}

            {/* 새 여행지 등록 */}
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label title="사진 업로드" style={{ flex: 'none', width: 72, height: 72, borderRadius: 12, overflow: 'hidden', border: newImage ? '2px solid #06C4A0' : '2px dashed var(--border-default)', cursor: 'pointer', display: 'grid', placeItems: 'center', background: 'var(--bg-muted, #f8f9fa)' }}>
                        {uploadingNew
                            ? <Icon name="progress_activity" style={{ fontSize: 20, color: '#06C4A0' }} />
                            : newImage
                                ? <img src={newImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <Icon name="add_a_photo" style={{ fontSize: 22, color: 'var(--text-muted)' }} />}
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={(e) => { handleNewUpload(e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    <select ref={selectRef} className="inp" style={{ flex: 1, minWidth: 240 }} value={pick} onChange={(e) => setPick(e.target.value)}>
                        {destinationOptions()}
                    </select>
                    {pick === CUSTOM && (
                        <input
                            className="inp"
                            style={{ flex: 1, minWidth: 200 }}
                            value={customName}
                            placeholder="여행지 이름 직접 입력 (한국어 권장)"
                            onChange={(e) => setCustomName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') addSpot(); }}
                        />
                    )}
                    {previewName && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f766e', whiteSpace: 'nowrap' }}>
                            페이지 표시: {previewName}
                        </span>
                    )}
                    <button type="button" className="btn btn-primary" onClick={addSpot}>
                        <Icon name="add" />여행지 등록
                    </button>
                </div>
            </div>

            {/* 등록된 여행지 그리드 */}
            {loading ? (
                <div className="cell-muted" style={{ padding: 24 }}>불러오는 중…</div>
            ) : spots.length === 0 ? (
                <div className="cell-muted" style={{ padding: 24 }}>등록된 여행지가 없습니다. 위에서 사진을 올리고 여행지를 골라 등록해 주세요.</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                    {spots.map(s => (
                        <div key={s.id} className="card" style={{ overflow: 'hidden' }}>
                            <label title="사진 변경" style={{ display: 'block', position: 'relative', aspectRatio: '4/3', cursor: 'pointer', background: 'var(--bg-muted, #f0f1f3)' }}>
                                {uploadingId === s.id
                                    ? <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><Icon name="progress_activity" style={{ fontSize: 22, color: '#06C4A0' }} /></span>
                                    : <img src={s.image} alt={s.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                                <input type="file" accept="image/*" style={{ display: 'none' }}
                                    onChange={(e) => { replaceImage(s.id, e.target.files?.[0]); e.target.value = ''; }} />
                            </label>
                            <div style={{ padding: '8px 10px' }}>
                                <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                                        {s.en && <div className="cell-muted" style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.en}</div>}
                                    </div>
                                    <button type="button" className="act-btn" title="삭제" onClick={() => removeSpot(s.id)}>
                                        <Icon name="delete" style={{ fontSize: 16, color: 'var(--mrt-red)' }} />
                                    </button>
                                </div>
                                <select className="inp" style={{ width: '100%', marginTop: 6, fontSize: 12 }} value={s.en ?? ''} onChange={(e) => repick(s.id, e.target.value)} title="이름 다시 고르기">
                                    {destinationOptions()}
                                </select>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </AdminLayout>
    );
};
