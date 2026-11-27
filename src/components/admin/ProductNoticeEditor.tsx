import { useState } from 'react';
import type { DesignBlockContent, DetailContentBlock } from '../../types/product';
import { AdminButton, AdminCard, AdminField, AdminFileButton, AdminMessage, AdminTextArea, AdminTextInput, adminConfirm, adminNotify } from './ui';
import { designTemplates, getDesignTemplate } from '../product/designTemplates/registry';
import { suffixOf, visibleInstances } from '../product/designTemplates/sections';
import { saveDesignDefaults, useAllDesignDefaults } from '../product/designTemplates/globalDefaults';
import { uploadImage } from '../../utils/upload';
import './ProductNoticeEditor.css';

/**
 * 상품 수정의 ‘유의사항’ 탭(2026-11-27 오너 요청) — **모든 상품 공통** 유의사항을 고친다.
 * 상품 페이지 ‘유의 사항·FAQ’의 유의사항 접기 내용이고, 디자인 틀의 공통 섹션(registry `sharedSections`, ‘19 예약 전 확인사항’) 칸이다.
 * 저장 자리는 사이트 공통값(settings `design_defaults`)이라 이 탭의 ‘공통 유의사항 저장’ 한 번이면 모든 상품에 반영된다 — 상품 저장과 따로다.
 * 공통값은 상품마다 따로 복사돼 있던 예전 값보다 먼저 쓴다(DesignBlockView·상세의 값 순서). 처음 열 때 공통값이 없으면
 * 지금 상품에 들어 있던 내용(없으면 디자인 원본 문구)으로 채워 보여 주므로, 그대로 저장하면 지금 내용이 공통이 된다.
 */
const NOTICE_SECTION = '19 예약 전 확인사항';

/** 이 상품의 디자인 블록 중 유의사항 섹션이 보이는 것(처음 채울 값을 읽는 데만 쓴다) */
function findNoticeBlock(blocks: DetailContentBlock[]): { content: DesignBlockContent; suffix: string } | null {
    for (const block of blocks) {
        if (block.type !== 'design') continue;
        const content = block.content as DesignBlockContent;
        const def = getDesignTemplate(content?.templateId ?? '');
        if (!def) continue;
        const instance = visibleInstances(def, content.sections).find((i) => i.def === NOTICE_SECTION);
        if (instance) return { content, suffix: suffixOf(instance.id) };
    }
    return null;
}

export function ProductNoticeEditor({ blocks }: { blocks: DetailContentBlock[] }) {
    const found = findNoticeBlock(blocks);
    // 공통 유의사항이 있는 디자인 틀(지금은 승마 트레킹 하나)
    const def = (found && getDesignTemplate(found.content.templateId)) || designTemplates.find((t) => t.sharedSections?.includes(NOTICE_SECTION));
    const all = useAllDesignDefaults();
    const [draft, setDraft] = useState<Record<string, string>>({});
    const [uploading, setUploading] = useState('');
    const [saving, setSaving] = useState(false);
    if (!def) return null;
    const shared = all[def.id] || {};
    const fields = def.fields.filter((f) => f.section === NOTICE_SECTION);
    const defaults: Record<string, string> = {};
    for (const field of def.fields) defaults[field.key] = field.default ?? '';
    const productValue = (key: string) => (found ? found.content.values?.[key + found.suffix] || '' : '');
    /** 저장된 공통값 → (없으면) 이 상품에 있던 값 → 디자인 원본 문구 */
    const initial = (key: string) => shared[key] || productValue(key) || defaults[key] || '';
    const value = (key: string) => (key in draft ? draft[key] : initial(key));
    const set = (key: string, next: string) => setDraft((d) => ({ ...d, [key]: next }));
    const hasShared = fields.some((f) => !!shared[f.key]);
    // 고친 칸이 있거나, 공통값이 아직 하나도 없으면(지금 내용을 공통으로 처음 저장) 저장할 수 있다
    const dirty = Object.keys(draft).some((key) => draft[key] !== initial(key)) || !hasShared;

    const upload = async (key: string, file: File | undefined) => {
        if (!file) return;
        setUploading(key);
        try { set(key, await uploadImage(file, 'product-details')); }
        catch (error) { console.error('Notice image upload failed:', error); adminNotify('사진을 올리지 못했어요. 다시 시도해 주세요.', 'error'); }
        finally { setUploading(''); }
    };
    const save = async () => {
        if (!await adminConfirm({ title: '공통 유의사항 저장', confirmLabel: '모든 상품에 저장',
            message: '이 유의사항을 모든 상품에 함께 보여 줄까요?\n저장하면 바로 상품 페이지에 반영돼요. 상품 저장은 따로 누르지 않아도 돼요.' })) return;
        const next = { ...shared };
        for (const field of fields) {
            const v = value(field.key).trim() ? value(field.key) : '';
            // 채운 칸은 원본 문구와 같아도 공통값으로 저장한다 — 그래야 상품마다 따로 복사돼 있던 옛 값보다 먼저 나와 모든 상품이 같아진다.
            // 비운 칸만 공통값을 지운다(그 칸은 상품 값 → 원본 문구를 따라간다)
            if (!v) delete next[field.key];
            else next[field.key] = v;
        }
        setSaving(true);
        try {
            await saveDesignDefaults({ ...all, [def.id]: next });
            setDraft({});
            adminNotify('공통 유의사항을 저장했어요. 모든 상품에 반영됐어요.', 'success');
        } catch (error) {
            console.error('Shared notice save failed:', error);
            adminNotify('저장하지 못했어요. 다시 시도해 주세요.', 'error');
        } finally { setSaving(false); }
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
    const setHead = (i: number, next: string) => set('gt_head', [0, 1, 2].map((n) => (n === i ? next : head[n] || '').replace(/\|/g, '')).join('|'));
    const busy = saving || !!uploading;

    return (
        <div className="pne">
            <AdminMessage tone="info" title="모든 상품에 함께 들어가는 공통 유의사항이에요"
                actions={<AdminButton variant="primary" size="sm" loading={saving} disabled={busy || !dirty} onClick={() => void save()}>공통 유의사항 저장</AdminButton>}>
                한 번 저장하면 모든 상품 페이지 ‘유의 사항·FAQ’의 유의사항 접기에 같은 내용이 나와요. 상품마다 사진·문구를 다시 올리지 않아도 돼요.
                {!hasShared && ' 아직 저장한 공통 유의사항이 없어 지금 상품에 들어 있던 내용으로 채워 두었어요.'}
                {!found && ' 이 상품에는 디자인 블록이 없어 상품 페이지에는 아직 보이지 않아요.'}
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

            <AdminCard title="숙박 안내" description="게르·호텔 유형별 사진과 설비를 표로 보여 줘요. 사진도 한 번 올리면 모든 상품에 같이 나와요.">
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
                                        <AdminFileButton size="sm" accept="image/*" disabled={busy} onFiles={(files) => upload(imgKey, files[0])}>
                                            {uploading === imgKey ? '올리는 중…' : img ? '사진 바꾸기' : '사진 올리기'}
                                        </AdminFileButton>
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

            <div className="pne-foot">
                <span>{dirty ? '저장하지 않은 공통 유의사항이 있어요.' : '공통 유의사항이 저장된 상태예요.'}</span>
                <AdminButton variant="primary" loading={saving} disabled={busy || !dirty} onClick={() => void save()}>공통 유의사항 저장</AdminButton>
            </div>
        </div>
    );
}
