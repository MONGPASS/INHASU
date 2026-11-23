import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { adminConfirm, adminNotify } from './ui/adminFeedback';
import {
    AdminButton, AdminEmpty, AdminField, AdminIconButton, AdminLoading, AdminMessage, AdminTextArea, AdminTextInput, IconArrowDown, IconArrowUp,
    IconPlus, IconTrash,
} from './ui';
import './TourFAQEditor.css';

/**
 * Editor for the site-wide "tour common FAQ" — the FAQ block displayed at
 * the bottom of every product detail page. Rendered as a tab inside
 * AdminFAQManage so the admin sees one unified "FAQ 관리" menu instead of
 * two confusing entries. No sidebar / header chrome — that's the host
 * page's job.
 */

interface FAQRow {
    id?: string;
    question: string;
    answer: string;
}

const STARTER_ROWS: FAQRow[] = [
    { question: '출발 전에 무엇을 준비해야 하나요?', answer: '국제선 항공권과 여권(유효기간 6개월 이상)이 필요합니다. 비자 필요 여부는 출발 시점의 규정에 따라 달라질 수 있어, 예약 시 안내해 드립니다. 일교차가 크므로 계절에 관계없이 걸칠 수 있는 겉옷은 꼭 챙겨 주세요.' },
    { question: '취소 규정을 알려 주세요.', answer: '예약금은 호텔 및 숙박 시설의 선결제금으로 사용되므로, 일정을 취소하실 경우 환불되지 않습니다. 취소나 일정 변경을 원하시면 가능한 한 빨리 카카오톡 채널 또는 이메일로 연락해 주세요.' },
    { question: '게르 숙박 시 침구가 있나요?', answer: '모든 게르 캠프에 침대·매트리스·담요·수건이 갖춰져 있습니다. 겨울철에는 전기담요도 준비해 드립니다.' },
    { question: '혼자 여행해도 참가할 수 있나요?', answer: '물론 가능합니다. 1인 참가 추가 요금 180,000원을 받고 있습니다(개인실 추가 요금분). 동행 찾기 게시판도 이용해 보세요.' },
    { question: '식사 알레르기 대응이 가능한가요?', answer: '사전에 알려 주시면 식품 알레르기나 종교상의 식사 제한에 개별적으로 대응해 드립니다. 베지테리언·비건 대응도 가능합니다.' },
    { question: '현지에서의 통신 수단은?', answer: '울란바토르 시내는 4G가 잘 갖춰져 있습니다. 고비·테를지에서는 전파가 약한 곳도 있습니다. 가이드가 위성 전화를 소지하고 있어 긴급 연락은 가능합니다.' },
];

export const TourFAQEditor: React.FC = () => {
    const [rows, setRows] = useState<FAQRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const data = await api.tourFaqs.list();
                if (Array.isArray(data) && data.length > 0) {
                    setRows(data.map((d) => ({ id: d.id, question: d.question, answer: d.answer })));
                } else {
                    setRows(STARTER_ROWS);
                }
            } catch (e) {
                console.error('Tour FAQ load failed:', e);
                setRows(STARTER_ROWS);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const update = (idx: number, patch: Partial<FAQRow>) => {
        setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    };
    const move = (idx: number, dir: -1 | 1) => {
        setRows((rs) => {
            const next = [...rs];
            const j = idx + dir;
            if (j < 0 || j >= next.length) return rs;
            [next[idx], next[j]] = [next[j], next[idx]];
            return next;
        });
    };
    const removeRow = async (idx: number) => {
        if (!await adminConfirm('이 질문을 삭제하시겠습니까?')) return;
        setRows((rs) => rs.filter((_, i) => i !== idx));
    };
    const addRow = () => {
        setRows((rs) => [...rs, { question: '', answer: '' }]);
    };

    const handleSave = async () => {
        if (saving) return;
        const clean = rows
            .map((r) => ({ id: r.id, question: r.question.trim(), answer: r.answer.trim() }))
            .filter((r) => r.question || r.answer);
        if (clean.length === 0) {
            if (!await adminConfirm('등록된 FAQ가 없습니다. 빈 상태로 저장하시면 상품 상세 페이지에 기본 FAQ가 표시됩니다. 계속하시겠습니까?')) return;
        }
        setSaving(true);
        try {
            await api.tourFaqs.saveBulk(clean);
            setSavedAt(new Date().toLocaleTimeString('ko-KR'));
            const refreshed = await api.tourFaqs.list();
            if (Array.isArray(refreshed)) {
                setRows(refreshed.map((d) => ({ id: d.id, question: d.question, answer: d.answer })));
            }
        } catch (e: any) {
            adminNotify('저장 실패: ' + (e?.message || '알 수 없는 오류'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <AdminLoading label="투어 공통 FAQ를 불러오는 중…" />;

    return (
        <div className="tf-root">
            <AdminMessage title="상품 페이지 아래 FAQ — 한 번 작성하면 모든 상품에 적용">
                <ul className="tf-notes">
                    <li>여기에 등록한 FAQ는 <strong>모든 상품 상세 페이지</strong>의 ‘유의 사항·자주 묻는 질문’에 자동으로 보입니다.</li>
                    <li>특정 상품에만 다른 FAQ를 보여 주려면 그 상품 편집 화면에서 따로 입력합니다(그 상품에서는 그쪽이 먼저).</li>
                    <li>‘FAQ 목록’·‘카테고리 관리’ 탭은 <strong>고객센터 페이지(/faq)</strong> 내용이라 서로 다릅니다.</li>
                </ul>
            </AdminMessage>

            <div className="tf-bar">
                <span className="tf-count">질문 {rows.length}개</span>
                <span className="tf-bar-end">
                    {savedAt && <span className="tf-saved" role="status">저장됨 ({savedAt})</span>}
                    <AdminButton variant="primary" loading={saving} onClick={handleSave}>{saving ? '저장 중…' : '전체 저장'}</AdminButton>
                </span>
            </div>

            {rows.length === 0 && <AdminEmpty title="등록된 FAQ가 없습니다." description="아래 ‘질문 추가’로 시작하세요." />}
            {rows.map((row, i) => (
                <section key={i} className="tf-row" aria-label={`질문 ${i + 1}`}>
                    <div className="tf-row-head">
                        <span className="tf-no">Q{i + 1}.</span>
                        <span className="tf-row-actions">
                            <AdminIconButton size="sm" label={`질문 ${i + 1} 위로`} onClick={() => move(i, -1)} disabled={i === 0}><IconArrowUp /></AdminIconButton>
                            <AdminIconButton size="sm" label={`질문 ${i + 1} 아래로`} onClick={() => move(i, 1)} disabled={i === rows.length - 1}><IconArrowDown /></AdminIconButton>
                            <AdminIconButton size="sm" label={`질문 ${i + 1} 삭제`} className="tf-danger" onClick={() => removeRow(i)}><IconTrash /></AdminIconButton>
                        </span>
                    </div>
                    <AdminField id={`tf-q-${i}`} label="질문 (한국어)">
                        <AdminTextInput
                            id={`tf-q-${i}`}
                            value={row.question}
                            onChange={(e) => update(i, { question: e.target.value })}
                            placeholder="예) 출발 전에 무엇을 준비해야 하나요?"
                        />
                    </AdminField>
                    <AdminField id={`tf-a-${i}`} label="답변 (한국어)">
                        <AdminTextArea
                            id={`tf-a-${i}`}
                            minRows={3}
                            value={row.answer}
                            onChange={(e) => update(i, { answer: e.target.value })}
                            placeholder="예) 국제선 항공권과 여권(유효기간 6개월 이상)이 필요합니다..."
                        />
                    </AdminField>
                </section>
            ))}

            <AdminButton variant="weak" fullWidth leading={<IconPlus />} onClick={addRow}>질문 추가</AdminButton>
        </div>
    );
};

export default TourFAQEditor;
