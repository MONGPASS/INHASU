import { useState } from 'react';
import type { DesignBlockContent, DetailContentBlock } from '../../types/product';
import { AdminButton, AdminCard, AdminEmpty, AdminField, AdminFileButton, AdminMessage, AdminTextArea, AdminTextInput, adminNotify } from './ui';
import { getDesignTemplate } from '../product/designTemplates/registry';
import { suffixOf, visibleInstances } from '../product/designTemplates/sections';
import { useDesignGlobalDefaults } from '../product/designTemplates/globalDefaults';
import { uploadImage } from '../../utils/upload';
import './ProductNoticeEditor.css';

/**
 * 상품 수정의 ‘유의사항’ 탭(2026-11-27 오너 요청). 상품 페이지 ‘유의 사항·FAQ’의 유의사항 접기에 들어가는 내용이다.
 * 저장 자리는 따로 두지 않고 상품 디자인 블록의 ‘19 예약 전 확인사항’ 칸 값(content.values)을 그대로 고친다 —
 * 디자인 블록 편집과 이 탭이 늘 같은 내용을 보인다. 값 순서는 상세와 같다: 상품 값 → 사이트 공통값 → 원본 기본값.
 * 비우거나 공통값·기본 문구와 같게 적으면 그 키를 지워 공통값·기본 문구를 따라가게 한다(디자인 블록 편집과 같은 규칙).
 */
const NOTICE_SECTION = '19 예약 전 확인사항';

/** 이 탭이 고칠 디자인 블록 — ‘19 예약 전 확인사항’이 보이는 첫 디자인 블록 */
function findNoticeBlock(blocks: DetailContentBlock[]): { index: number; content: DesignBlockContent; suffix: string } | null {
    for (let index = 0; index < blocks.length; index++) {
        const block = blocks[index];
        if (block.type !== 'design') continue;
        const content = block.content as DesignBlockContent;
        const def = getDesignTemplate(content?.templateId ?? '');
        if (!def) continue;
        const instance = visibleInstances(def, content.sections).find((i) => i.def === NOTICE_SECTION);
        if (instance) return { index, content, suffix: suffixOf(instance.id) };
    }
    return null;
}

interface Props {
    blocks: DetailContentBlock[];
    onChange: (index: number, content: DesignBlockContent) => void;
    onBusyChange?: (busy: boolean) => void;
}

export function ProductNoticeEditor({ blocks, onChange, onBusyChange }: Props) {
    const found = findNoticeBlock(blocks);
    const shared = useDesignGlobalDefaults(found?.content.templateId);
    const [uploading, setUploading] = useState('');
    if (!found) {
        return <AdminEmpty title="유의사항을 넣을 디자인 블록이 없어요"
            description="상세 정보 탭에서 디자인 블록(몽골 승마 트레킹 상세페이지)을 추가하고, ‘19 예약 전 확인사항’ 섹션을 빼지 않았는지 확인해 주세요." />;
    }
    const { index, content, suffix } = found;
    const def = getDesignTemplate(content.templateId)!;
    const defaults: Record<string, string> = {};
    for (const field of def.fields) defaults[field.key] = field.default ?? '';
    const values = content.values || {};
    const fallback = (key: string) => shared[key] || defaults[key] || '';
    const own = (key: string) => values[key + suffix] || '';
    const value = (key: string) => own(key) || fallback(key);
    const set = (key: string, next: string) => {
        const scoped = key + suffix;
        const nextValues = { ...values };
        if (!next.trim() || next === fallback(key)) delete nextValues[scoped];
        else nextValues[scoped] = next;
        onChange(index, { ...content, values: nextValues });
    };
    const upload = async (key: string, file: File | undefined) => {
        if (!file) return;
        setUploading(key); onBusyChange?.(true);
        try { set(key, await uploadImage(file, 'product-details')); }
        catch (error) { console.error('Notice image upload failed:', error); adminNotify('사진을 올리지 못했어요. 다시 시도해 주세요.', 'error'); }
        finally { setUploading(''); onBusyChange?.(false); }
    };

    const text = (key: string, label: string, hint?: string) => (
        <AdminField label={label} hint={hint}>
            {(id, describedBy) => <AdminTextInput id={id} aria-describedby={describedBy} value={value(key)} onChange={(e) => set(key, e.target.value)} />}
        </AdminField>
    );
    const area = (key: string, label: string, hint = '한 줄에 하나씩 적어요. 상품 페이지에서 점 목록으로 보여요.', rows = 4) => (
        <AdminField label={label} hint={hint}>
            {(id, describedBy) => <AdminTextArea id={id} aria-describedby={describedBy} minRows={rows} value={value(key)} onChange={(e) => set(key, e.target.value)} />}
        </AdminField>
    );
    const head = value('gt_head').split('|');
    const setHead = (i: number, next: string) => { const cols = [0, 1, 2].map((n) => (n === i ? next : head[n] || '').replace(/\|/g, '')); set('gt_head', cols.join('|')); };

    return (
        <div className="pne">
            <AdminMessage tone="info" title="상품 페이지 ‘유의 사항·FAQ’의 유의사항 접기에 들어가요">
                디자인 블록의 ‘19 예약 전 확인사항’과 같은 내용이라 어느 쪽에서 고쳐도 같아요. 칸을 비우면 사이트 공통값이나 기본 문구가 나와요. 상품 저장을 눌러야 반영돼요.
            </AdminMessage>

            <AdminCard title="머리" description="유의사항 접기 제목 아래 회색 설명으로 보여요.">
                {text('terms_title', '설명 문구')}
            </AdminCard>

            <AdminCard title="예약금 취소 규정">
                <div className="pne-fields">
                    {text('cancel_title', '제목')}
                    {area('cancel_body', '본문')}
                    {area('cancel_box', '강조 상자', '민트 상자 안에 굵게 보여요. 한 줄에 하나씩.', 2)}
                </div>
            </AdminCard>

            <AdminCard title="투어 안내">
                <div className="pne-fields">
                    {text('tour_title', '제목')}
                    {area('tour_body', '본문', '한 줄에 하나씩 적어요. 상품 페이지에서 점 목록으로 보여요.', 8)}
                    {text('tour_banner', '검은 띠 문구', '목록 아래 검은 띠로 보여요.')}
                </div>
            </AdminCard>

            <AdminCard title="숙박 안내" description="게르·호텔 유형별 사진과 설비를 표로 보여 줘요. 사진을 비우면 사이트 공통 사진이 나와요.">
                <div className="pne-fields">
                    {text('gerstay_title', '제목')}
                    {text('gerstay_lead', '강조 문구', '민트 굵은 글자로 보여요.')}
                    {area('gerstay_body', '설명', '줄바꿈한 그대로 보여요.', 3)}
                    <div className="pne-head">
                        <span className="pne-label">표 머리</span>
                        <div className="pne-head-row">
                            {['첫째 칸', '둘째 칸', '셋째 칸'].map((label, i) => (
                                <AdminTextInput key={label} aria-label={`표 머리 ${label}`} value={head[i] || ''} onChange={(e) => setHead(i, e.target.value)} />
                            ))}
                        </div>
                    </div>
                    <div className="pne-rows">
                        {[1, 2, 3, 4].map((n) => {
                            const imgKey = `gt${n}_img`;
                            const img = value(imgKey);
                            return (
                                <div key={n} className="pne-row">
                                    <span className="pne-row-no">{n}</span>
                                    <div className="pne-photo">
                                        <span className="pne-thumb">{img ? <img src={img} alt={`${n}번 사진`} /> : <span>사진 없음</span>}</span>
                                        <AdminFileButton size="sm" accept="image/*" disabled={!!uploading} onFiles={(files) => upload(imgKey, files[0])}>
                                            {uploading === imgKey ? '올리는 중…' : '사진 올리기'}
                                        </AdminFileButton>
                                        {own(imgKey) && <AdminButton size="sm" variant="weak" disabled={!!uploading} onClick={() => set(imgKey, '')}>공통 사진으로</AdminButton>}
                                        <small>{own(imgKey) ? '이 상품 사진' : img ? '공통 사진' : ''}</small>
                                    </div>
                                    <div className="pne-row-fields">
                                        {area(`gt${n}_name`, '이름', '두 줄로 나눠 적을 수 있어요. 예) 일반게르 / (실속)', 2)}
                                        {area(`gt${n}_spec`, '설비', '줄바꿈한 그대로 보여요. 예) 전기: 사용 가능', 4)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </AdminCard>

            <AdminCard title="동물 체험 안내">
                <div className="pne-fields">
                    {text('animal_title', '제목')}
                    {area('animal_body', '본문')}
                </div>
            </AdminCard>
        </div>
    );
}
