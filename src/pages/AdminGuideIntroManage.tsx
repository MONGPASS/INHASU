import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { DEFAULT_GUIDE_INTRO } from '../hooks/useGuideIntro';

/**
 * Admin page to edit the site-wide "Your Guide" intro card (settings key:
 * `guide_intro`). One JSON record: { title, body, chips: string[] }.
 *
 * Shown on every product detail page (mobile + PC). Admin can update the
 * copy without touching code or each product individually.
 */
export const AdminGuideIntroManage: React.FC = () => {
    const [title, setTitle] = useState(DEFAULT_GUIDE_INTRO.title);
    const [body, setBody] = useState(DEFAULT_GUIDE_INTRO.body);
    const [chipsRaw, setChipsRaw] = useState(DEFAULT_GUIDE_INTRO.chips.join('\n'));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await api.settings.get('guide_intro');
                if (cancelled) return;
                const raw = res?.value ?? res;
                let parsed: { title?: string; body?: string; chips?: string[] } = {};
                if (typeof raw === 'string') {
                    try { parsed = JSON.parse(raw); } catch { /* ignore */ }
                } else if (raw && typeof raw === 'object') {
                    parsed = raw;
                }
                if (parsed.title) setTitle(parsed.title);
                if (parsed.body) setBody(parsed.body);
                if (Array.isArray(parsed.chips) && parsed.chips.length > 0) setChipsRaw(parsed.chips.join('\n'));
            } catch {
                // keep defaults
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const chips = chipsRaw.split('\n').map((s) => s.trim()).filter(Boolean);
            await api.settings.save('guide_intro', JSON.stringify({ title, body, chips }));
            setSavedAt(new Date().toLocaleTimeString('ko-KR'));
        } catch (e) {
            console.error('Failed to save guide intro:', e);
            alert('저장에 실패했습니다');
        } finally {
            setSaving(false);
        }
    };

    const chipList = chipsRaw.split('\n').map((s) => s.trim()).filter(Boolean);

    if (loading) {
        return (
            <AdminLayout activePage="guide-intro" title="가이드 소개 (공통)">
                <div className="route-anim" style={{ maxWidth: 920 }}>
                    <div className="cell-muted" style={{ fontSize: 14 }}>읽어들이는 중...</div>
                </div>
            </AdminLayout>
        );
    }

    const saveBtn = (
        <button
            className="btn btn-ink"
            onClick={handleSave}
            disabled={saving || !title.trim() || !body.trim()}
        >
            <Icon name="check" />{saving ? '저장 중...' : '저장하기'}
        </button>
    );

    return (
        <AdminLayout activePage="guide-intro" title="가이드 소개 (공통)" actions={saveBtn}>
            <div className="route-anim" style={{ maxWidth: 920 }}>
                <div className="card-muted-note">
                    <Icon name="info" />
                    <span>모든 투어 상품 상세 페이지(모바일·PC)에 공통으로 표시되는 “가이드 소개” 카드입니다. 여기서 한 번만 수정하면 전체 상품에 반영됩니다.</span>
                </div>

                <div className="grid-2" style={{ gridTemplateColumns: '1fr 360px', alignItems: 'start', marginTop: 18 }}>
                    <div className="card card-pad">
                        <div className="field">
                            <label>제목 <span className="muted" style={{ fontWeight: 500 }}>(예: 한국어 가이드 동행)</span></label>
                            <input
                                className="inp"
                                value={title}
                                onChange={(e) => { setTitle(e.target.value); setSavedAt(null); }}
                            />
                        </div>
                        <div className="field">
                            <label>본문 <span className="muted" style={{ fontWeight: 500 }}>(2~3 문장 권장)</span></label>
                            <textarea
                                className="inp"
                                rows={4}
                                value={body}
                                onChange={(e) => { setBody(e.target.value); setSavedAt(null); }}
                            />
                        </div>
                        <div className="field" style={{ marginBottom: 0 }}>
                            <label>칩(태그) <span className="muted" style={{ fontWeight: 500 }}>(한 줄에 하나씩, 예: 한국어 능통)</span></label>
                            <textarea
                                className="inp"
                                rows={4}
                                style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                                value={chipsRaw}
                                onChange={(e) => { setChipsRaw(e.target.value); setSavedAt(null); }}
                            />
                        </div>
                        <div className="row" style={{ marginTop: 18 }}>
                            {savedAt && (
                                <span className="row" style={{ gap: 4, color: 'var(--mrt-green)', fontSize: 13, fontWeight: 700 }}>
                                    <Icon name="check_circle" fill style={{ fontSize: 16 }} />{savedAt} 에 저장됨
                                </span>
                            )}
                            <div className="spacer" style={{ flex: 1 }} />
                            <button
                                className="btn btn-ink"
                                onClick={handleSave}
                                disabled={saving || !title.trim() || !body.trim()}
                            >
                                <Icon name="check" />{saving ? '저장 중...' : '저장하기'}
                            </button>
                        </div>
                    </div>

                    <div>
                        <div className="sec-label">미리보기</div>
                        <div className="gi-preview">
                            <div className="row" style={{ gap: 12, marginBottom: 12 }}>
                                <span className="gi-ava"><Icon name="translate" /></span>
                                <div>
                                    <div className="gi-eyebrow">Your Guide</div>
                                    <div className="cell-strong" style={{ fontSize: 15 }}>{title || '(제목 없음)'}</div>
                                </div>
                            </div>
                            <p className="gi-body">{body || '(본문 없음)'}</p>
                            <div className="chip-row" style={{ gap: 6 }}>
                                {chipList.map((c) => <span className="gi-chip" key={c}>{c}</span>)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};
