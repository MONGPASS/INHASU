import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { getOptimizedImageUrl } from '../../utils/cloudflareImage';
import { splitItineraryDays, toItinerarySource, type DaySource, type ItinerarySource } from './itineraryImport';
import { AdminButton, AdminCheckbox, AdminDialog, AdminSearch, AdminTable, AdminTbody, AdminTd, AdminTr } from './ui';
import './CourseImportModal.css';

interface ItineraryImportModalProps {
    open: boolean;
    /** 편집 중인 상품 — 목록에서 뺀다 (자기 자신을 불러오는 건 의미가 없으므로) */
    currentProductId?: string;
    /** 선택한 일차들을 순서대로 합친 결과 */
    onPick: (selection: ItinerarySource) => void;
    onClose: () => void;
}

/**
 * 「일정표 불러오기」 — 다른 상품들의 일정을 **일차 단위**로 골라 가져온다.
 * 예: A상품의 '테를지 국립공원' 하루 + B상품의 '미니 고비' 하루를 체크해서 한 번에 불러오기.
 * 새 상품을 만들 때 필요한 일차만 조합한 뒤 편집만 하면 되도록.
 */
export const ItineraryImportModal: React.FC<ItineraryImportModalProps> = ({ open, currentProductId, onPick, onClose }) => {
    if (!open) return null;
    // 열릴 때마다 새로 마운트되어 목록을 다시 읽는다
    return <DayPicker currentProductId={currentProductId} onPick={onPick} onClose={onClose} />;
};

/** 줄 전체를 눌러도 고르므로, 체크 칸을 누른 것이 줄까지 올라가 두 번 바뀌지 않게 막는다 */
const stopRowClick = (event: React.MouseEvent) => event.stopPropagation();

function DayPicker({ currentProductId, onPick, onClose }: { currentProductId?: string; onPick: (selection: ItinerarySource) => void; onClose: () => void }) {
    const [days, setDays] = useState<DaySource[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [selected, setSelected] = useState<string[]>([]);   // 선택한 순서 유지 (불러오는 순서)

    useEffect(() => {
        let cancelled = false;
        api.products.list()
            .then((data: unknown) => {
                if (cancelled) return;
                const items = Array.isArray(data) ? data : [];
                setDays(items
                    .map(it => toItinerarySource(it as Record<string, unknown>))
                    .filter(s => s.id !== currentProductId)
                    .flatMap(splitItineraryDays));
            })
            .catch(() => { if (!cancelled) setDays([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [currentProductId]);

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return days;
        return days.filter(d => `${d.tags.join(' ')} ${d.title} ${d.description} ${d.dayLabel} ${d.productName}`.toLowerCase().includes(needle));
    }, [days, q]);

    /** 상품별로 묶어서 표시 (검색 결과 순서 유지) */
    const groups = useMemo(() => {
        const out: { productId: string; productName: string; days: DaySource[] }[] = [];
        for (const d of filtered) {
            const last = out[out.length - 1];
            if (last && last.productId === d.productId) last.days.push(d);
            else out.push({ productId: d.productId, productName: d.productName, days: [d] });
        }
        return out;
    }, [filtered]);

    const toggle = (key: string) => setSelected(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
    const toggleProduct = (g: { days: DaySource[] }) => {
        const keys = g.days.map(d => d.key);
        const all = keys.every(k => selected.includes(k));
        setSelected(prev => (all ? prev.filter(k => !keys.includes(k)) : [...prev, ...keys.filter(k => !prev.includes(k))]));
    };

    const submit = () => {
        const picked = selected.map(k => days.find(d => d.key === k)).filter((d): d is DaySource => !!d);
        if (picked.length === 0) return;
        const names = picked.map(d => d.title || d.dayLabel || d.productName);
        onPick({
            id: picked.map(d => d.key).join(','),
            name: names.length > 2 ? `${names[0]} 외 ${names.length - 1}일차` : names.join(' + '),
            blocks: picked.flatMap(d => d.blocks),
            images: picked.flatMap(d => d.images),
        });
    };

    const footer = (
        <div className="adm-ui-dialog-foot cim-foot">
            <div className="adm-ui-dialog-foot-start cim-foot-text cim-foot-line">
                {selected.length > 0 ? <><b>{selected.length}일차</b> 선택됨 — 체크한 순서대로 들어갑니다</> : '불러올 일차를 체크하세요'}
            </div>
            <div className="adm-ui-dialog-foot-end">
                {selected.length > 0 && (
                    <AdminButton variant="secondary" onClick={() => setSelected([])}>선택 해제</AdminButton>
                )}
                <AdminButton variant="primary" onClick={submit} disabled={selected.length === 0} data-import-submit>
                    선택한 일차 불러오기
                </AdminButton>
            </div>
        </div>
    );

    return (
        <AdminDialog open onClose={onClose} size="lg" flush footer={footer} className="cim-dialog"
            title="일정표 불러오기"
            description="다른 상품의 일정을 일차 단위로 골라 가져옵니다. 여러 상품의 일차를 섞어서 선택할 수 있고, 일차 번호는 자동으로 다시 매겨집니다.">
            <div className="cim-search">
                <AdminSearch wide value={q} onChange={setQ} placeholder="여행지·일정 제목·상품명 검색 (예: Terelj, 테를지, 미니 고비)" />
            </div>

            <div className="cim-list">
                {loading ? (
                    <div className="cim-empty" role="status">불러오는 중...</div>
                ) : groups.length === 0 ? (
                    <div className="cim-empty">{q ? '검색 결과가 없습니다.' : '일정표가 있는 다른 상품이 없습니다.'}</div>
                ) : (
                    // 상품 묶음 줄(colSpan)이 섞인 고르기 표라 휴대폰에서도 카드로 바꾸지 않고 칸만 줄인다(CourseImportModal.css)
                    <AdminTable label="불러올 일차" cardOff className="cim-table">
                        <AdminTbody>
                            {groups.map(g => {
                                const allOn = g.days.every(d => selected.includes(d.key));
                                return (
                                    <React.Fragment key={g.productId}>
                                        <AdminTr className="cim-group" data-import-product={g.productId}>
                                            <AdminTd colSpan={5}>
                                                <AdminCheckbox size="sm" checked={allOn} onChange={() => toggleProduct(g)}
                                                    label={<><b>{g.productName}</b><span className="cim-note">{g.productId} · {g.days.length}일</span></>} />
                                            </AdminTd>
                                        </AdminTr>
                                        {g.days.map(d => {
                                            const on = selected.includes(d.key);
                                            return (
                                                <AdminTr key={d.key} data-import-day={d.key} onClick={() => toggle(d.key)} selected={on} className="is-clickable cim-pickrow">
                                                    <AdminTd className="cim-col-check">
                                                        <span onClick={stopRowClick}>
                                                            <AdminCheckbox size="sm" checked={on} onChange={() => toggle(d.key)} aria-label={`${d.title || d.dayLabel || d.productName} 선택`} />
                                                        </span>
                                                    </AdminTd>
                                                    <AdminTd className="cim-col-thumb">
                                                        {d.thumb
                                                            ? <img src={getOptimizedImageUrl(d.thumb, 'productThumbnail')} alt="" className="cim-thumb" onError={(e) => { const el = e.currentTarget; if (el.src !== d.thumb) el.src = d.thumb; else el.style.visibility = 'hidden'; }} />
                                                            : <div className="cim-thumb" />}
                                                    </AdminTd>
                                                    <AdminTd className="cim-col-name">
                                                        {d.tags.length > 0 && (
                                                            <div data-import-tags className="cim-day-sub">{d.tags.join(' / ')}</div>
                                                        )}
                                                        <div className="cim-day-title">
                                                            {d.dayLabel && <span>{d.dayLabel}</span>}
                                                            {d.title || '(제목 없음)'}
                                                        </div>
                                                        {d.description && <div className="cim-hint cim-clip">{d.description}</div>}
                                                    </AdminTd>
                                                    <AdminTd className="cim-col-num">일정 {d.eventCount}</AdminTd>
                                                    <AdminTd className="cim-col-num">사진 {d.photoCount}</AdminTd>
                                                </AdminTr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </AdminTbody>
                    </AdminTable>
                )}
            </div>
        </AdminDialog>
    );
}
