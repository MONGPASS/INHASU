import React from 'react';
import { AdminBadge, AdminField, AdminFileButton, AdminSelect, AdminTextInput, IconUpload } from '../ui';
import { THEME_WORDS, inTheme } from '../../home/homeContent';
import { PICK_FALLBACK, PICK_TAB_IMAGES, ROW_FALLBACK, findCategory, type HomePickTab, type HomeThemeRow } from '../../home/homeSettings';
import type { ThemeKey } from '../../home/homeContent';

/** 카테고리 고르기에 쓰는 최소 정보. */
export interface SlotCategory { id: string; name: string }
/** 상품 수를 세는 데 쓰는 최소 정보(판매 중 상품만 넘긴다). */
export interface SlotProduct { id: string; name: string; category: string; tags: string[] }

interface Props {
    categories: SlotCategory[];
    products: SlotProduct[];
    rows: HomeThemeRow[];
    tabs: HomePickTab[];
    onRow: (index: number, field: keyof HomeThemeRow, value: string) => void;
    onTab: (index: number, field: keyof HomePickTab, value: string) => void;
    onRowImage: (file: File | undefined, index: number) => void;
}

const countIn = (products: SlotProduct[], category: SlotCategory) => products.filter((p) => p.category === category.name || p.category === category.id).length;

/**
 * 홈 화면 관리 ‘테마 줄 · 추천 PICK’: 자리마다 문구와 카테고리 하나만 고른다. 그 카테고리의 판매 중 상품이 홈에 자동으로 나온다.
 * 카테고리를 고르지 않은 자리는 상품 이름·분류·태그의 낱말로 묶는다(home/homeSettings.ts의 slotProducts).
 */
export const HomeThemeSlotsEditor: React.FC<Props> = ({ categories, products, rows, tabs, onRow, onTab, onRowImage }) => {
    const options = [{ value: '', label: '자동 (낱말로 묶기)' }, ...categories.map((c) => ({ value: c.id, label: `${c.name} · 판매 중 ${countIn(products, c)}개` }))];
    /** 고른 자리에 지금 몇 개가 보이는지 한 줄로. */
    const status = (categoryId: string, fallback: ThemeKey) => {
        const category = findCategory(categories, categoryId);
        if (categoryId && !category) return { tone: 'danger' as const, text: '고른 카테고리가 없어져 자동으로 보여요' };
        if (category) {
            const n = countIn(products, category);
            return n > 0 ? { tone: 'info' as const, text: `${category.name} 상품 ${n}개가 보여요` } : { tone: 'warn' as const, text: `${category.name}에 판매 중 상품이 없어 맞춤 견적 안내가 보여요` };
        }
        const n = products.filter((p) => inTheme(p, fallback)).length;
        return { tone: 'neutral' as const, text: `이름·태그에 ‘${THEME_WORDS[fallback].join(' · ')}’가 든 상품 ${n}개가 보여요` };
    };
    const select = (value: string, onChange: (v: string) => void) => (fid: string) => <AdminSelect id={fid} value={value} options={options} onChange={onChange} />;

    return (
        <div className="hm-slot-grid">
            {rows.map((row, i) => {
                const s = status(row.categoryId, ROW_FALLBACK[i]);
                return (
                    <section className="hm-card" key={i} aria-label={`테마 줄 ${i + 1}`}>
                        <div className="hm-sec-title"><h4 className="hm-pick-name">테마 줄 {i + 1}</h4><AdminBadge tone={s.tone}>{s.text}</AdminBadge></div>
                        <div className="hm-slot-body">
                            <div className="hm-media-item hm-slot-photo">
                                <span className="hm-media-label">큰 사진<em>{i % 2 === 0 ? 'PC 왼쪽' : 'PC 오른쪽'}</em></span>
                                <div className="hm-slot-img">
                                    {row.image && <img className="hm-cover" src={row.image} alt="" loading="lazy" />}
                                    <AdminFileButton size="sm" accept="image/*" className="hm-upload-btn" aria-label={`테마 줄 ${i + 1} 사진 변경`} leading={<IconUpload />} onFiles={(files) => onRowImage(files[0], i)}>바꾸기</AdminFileButton>
                                </div>
                            </div>
                            <div className="hm-fields">
                                <AdminField label="제목" required>{(fid) => <AdminTextInput id={fid} value={row.title} maxLength={60} placeholder="예: #초원질주 #몽골 승마 투어" onChange={(e) => onRow(i, 'title', e.target.value)} />}</AdminField>
                                <AdminField label="설명">{(fid) => <AdminTextInput id={fid} value={row.sub} maxLength={120} placeholder="예: 대초원을 말로 달리는 가장 몽골다운 방법" onChange={(e) => onRow(i, 'sub', e.target.value)} />}</AdminField>
                                <AdminField label="보여 줄 카테고리" hint="이 카테고리의 판매 중 상품이 상품 목록 순서대로 나와요.">{select(row.categoryId, (v) => onRow(i, 'categoryId', v))}</AdminField>
                            </div>
                        </div>
                    </section>
                );
            })}
            <section className="hm-card" aria-label="이달의 추천 PICK 탭">
                <div className="hm-sec-title"><h4 className="hm-pick-name">이달의 추천 PICK 탭</h4><AdminBadge>‘전체’ 다음 3개</AdminBadge></div>
                <p className="hm-pick-where">‘전체’ 탭은 추천·인기 상품이 먼저 나와요. 나머지 탭마다 이름과 카테고리를 정해요.</p>
                <div className="hm-tab-rows">
                    {tabs.map((tab, i) => {
                        const s = status(tab.categoryId, PICK_FALLBACK[i]);
                        return (
                            <div className="hm-tab-row" key={i}>
                                <span className="hm-tab-thumb">{PICK_TAB_IMAGES[i] && <img className="hm-cover" src={PICK_TAB_IMAGES[i]} alt="" loading="lazy" />}<b>{i + 1}</b></span>
                                <AdminField label={`탭 ${i + 1} 이름`} className="hm-tab-name">{(fid) => <AdminTextInput id={fid} value={tab.label} maxLength={20} onChange={(e) => onTab(i, 'label', e.target.value)} />}</AdminField>
                                <AdminField label="카테고리" className="hm-tab-cat" hint={s.text}>{select(tab.categoryId, (v) => onTab(i, 'categoryId', v))}</AdminField>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
};
