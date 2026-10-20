import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { api } from '../lib/api';
import type { InquiryRecord, InquiryStatus } from '../types/inquiry';

type StatusFilter = InquiryStatus | 'all';

const STATUS_META: Record<InquiryStatus, { label: string; tone: string }> = {
    new: { label: '신규', tone: 'b-red' },
    answered: { label: '답변 완료', tone: 'b-green' },
    closed: { label: '종료', tone: 'b-gray' },
};
const STATUS_ORDER: InquiryStatus[] = ['new', 'answered', 'closed'];

const NOTE_MAX = 2000;

const MIGRATION_TEXT = '문의 테이블이 아직 없습니다. 관리자로 로그인한 상태에서 /api/migrate-db 를 한 번 열어 주세요.';

/** The API names the fix in its "table missing" error. */
const isMigrationError = (e: unknown) => e instanceof Error && e.message.includes('migrate-db');

const describeError = (e: unknown) => {
    if (isMigrationError(e)) return MIGRATION_TEXT;
    const message = e instanceof Error ? e.message : String(e);
    if (message === 'Unauthorized' || message === 'Forbidden') return '관리자 권한이 필요합니다. 다시 로그인해 주세요.';
    return message || '알 수 없는 오류가 발생했습니다.';
};

/** created_at is stored in UTC ("YYYY-MM-DD HH:MM:SS"); shown in the browser's time zone. */
const formatReceived = (value: string) => {
    const date = new Date(`${value.replace(' ', 'T')}Z`);
    if (!value || Number.isNaN(date.getTime())) return value || '-';
    return date.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
};

const replyHref = (inquiry: InquiryRecord) =>
    `mailto:${encodeURIComponent(inquiry.email).replace('%40', '@')}?subject=${encodeURIComponent(`Re: [문의] ${inquiry.kind}`)}`;

const StatusBadge: React.FC<{ status: InquiryStatus }> = ({ status }) => (
    <span className={`badge ${STATUS_META[status].tone}`}>{STATUS_META[status].label}</span>
);

const MigrationNotice: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
    <div
        style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 16px', marginBottom: 16,
            background: '#FFF3DC', border: '1px solid #F3DDAE', borderRadius: 'var(--r-md)', color: '#8A5A12', fontSize: 13.5, fontWeight: 600, lineHeight: 1.55,
        }}
    >
        <Icon name="warning" style={{ fontSize: 20, flex: 'none' }} />
        <div style={{ flex: 1, minWidth: 240 }}>
            {MIGRATION_TEXT}
            <div style={{ fontWeight: 500 }}>열린 화면에 결과(JSON)가 나오면 완료입니다. 배포 후 한 번만 하면 됩니다. 그 전에는 고객의 문의 폼 전송이 실패합니다.</div>
        </div>
        <a className="btn btn-ink btn-sm" href="/api/migrate-db" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <Icon name="open_in_new" />/api/migrate-db 열기
        </a>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
            <Icon name="refresh" />다시 확인
        </button>
    </div>
);

interface DrawerProps {
    inquiry: InquiryRecord;
    busy: boolean;
    onClose: () => void;
    onStatus: (status: InquiryStatus) => void;
    onSaveNote: (note: string) => Promise<boolean>;
    onDelete: () => void;
    inline?: boolean;
    registerCloseGuard?: (guard: (() => boolean) | null) => void;
}

const InquiryDrawer: React.FC<DrawerProps> = ({ inquiry, busy, onClose, onStatus, onSaveNote, onDelete, inline = false, registerCloseGuard }) => {
    const [note, setNote] = useState(inquiry.admin_note);
    const [savingNote, setSavingNote] = useState(false);
    const noteDirty = note !== inquiry.admin_note;
    useEffect(() => {
        registerCloseGuard?.(() => !busy && !savingNote && (!noteDirty || confirm('저장하지 않은 메모가 있습니다. 다른 문의를 열까요?')));
        return () => registerCloseGuard?.(null);
    }, [registerCloseGuard, busy, savingNote, noteDirty]);

    const close = () => {
        if (noteDirty && !confirm('저장하지 않은 메모가 있습니다. 닫으시겠습니까?')) return;
        onClose();
    };

    const saveNote = async () => {
        const trimmed = note.trim();
        setSavingNote(true);
        if (await onSaveNote(trimmed)) setNote(trimmed);
        setSavingNote(false);
    };

    return (
        <div className={inline ? 'rd-inquiry-detail' : 'drawer-scrim'} onClick={inline ? undefined : close}>
            <div className={inline ? 'rd-inquiry-detail-panel' : 'drawer'} onClick={(e) => e.stopPropagation()}>
                <div className="drawer-head">
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="row" style={{ gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                            <StatusBadge status={inquiry.status} />
                            <span className="badge b-blue">{inquiry.kind}</span>
                            {inquiry.user_id && <span className="badge b-gray">회원</span>}
                        </div>
                        <div className="page-title" style={{ fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis' }}>{inquiry.name || '이름 없음'}</div>
                        {inline && <div className="rd-inquiry-contact"><a href={replyHref(inquiry)}>{inquiry.email}</a><span>{formatReceived(inquiry.created_at)}</span>{inquiry.reservation_number && <span>예약번호 {inquiry.reservation_number}</span>}</div>}
                    </div>
                    <button type="button" className="act-btn" title="닫기" onClick={close}>
                        <Icon name="close" />
                    </button>
                </div>

                <div className="drawer-body">
                    {!inline && <div className="card card-pad" style={{ marginBottom: 16 }}>
                        <div className="kv"><span>종류</span><b>{inquiry.kind}</b></div>
                        <div className="kv"><span>이름</span><b>{inquiry.name || '-'}</b></div>
                        <div className="kv">
                            <span>이메일</span>
                            <b style={{ overflowWrap: 'anywhere', textAlign: 'right' }}>
                                <a href={replyHref(inquiry)} style={{ color: 'var(--mrt-blue-strong)' }}>{inquiry.email}</a>
                            </b>
                        </div>
                        <div className="kv"><span>예약번호</span><b>{inquiry.reservation_number || '-'}</b></div>
                        <div className="kv" style={{ borderBottom: 'none' }}><span>접수 시각</span><b>{formatReceived(inquiry.created_at)}</b></div>
                    </div>}

                    <div className="field">
                        <label>문의 내용</label>
                        <div className="card card-pad" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 14, lineHeight: 1.75, color: 'var(--text-body)' }}>
                            {inquiry.message}
                        </div>
                    </div>

                    <div className="field">
                        <label>처리 상태</label>
                        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                            {STATUS_ORDER.map((status) => (
                                <button
                                    key={status}
                                    type="button"
                                    className={`btn btn-sm ${inquiry.status === status ? 'btn-ink' : 'btn-ghost'}`}
                                    aria-pressed={inquiry.status === status}
                                    disabled={busy || inquiry.status === status}
                                    onClick={() => onStatus(status)}
                                >
                                    {STATUS_META[status].label}
                                </button>
                            ))}
                        </div>
                        <div className="cell-muted" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
                            답장은 메일로 보냅니다. 답장을 보낸 뒤 「답변 완료」로 바꿔 주세요. 고객에게 자동 회신 메일은 발송되지 않습니다.
                        </div>
                    </div>

                    <div className="field" style={{ marginBottom: 0 }}>
                        <label>관리자 메모 <span className="cell-muted" style={{ fontWeight: 600 }}>· 고객에게 보이지 않습니다</span></label>
                        <textarea
                            className="inp"
                            rows={4}
                            maxLength={NOTE_MAX}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="처리 내용, 담당자 등을 적어 두세요."
                        />
                        <div className="row" style={{ marginTop: 8 }}>
                            <span className="cell-muted" style={{ flex: 1, fontSize: 12 }}>{note.length} / {NOTE_MAX}</span>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void saveNote()} disabled={!noteDirty || savingNote}>
                                <Icon name="save" />{savingNote ? '저장 중…' : '메모 저장'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="drawer-foot">
                    <button type="button" className="btn btn-danger btn-sm" onClick={onDelete} disabled={busy}>
                        <Icon name="delete" />삭제
                    </button>
                    <div style={{ flex: 1 }} />
                    <a className="btn btn-ink" href={replyHref(inquiry)} style={{ textDecoration: 'none' }}>
                        <Icon name="forward_to_inbox" />메일로 답장
                    </a>
                </div>
            </div>
        </div>
    );
};

export const AdminInquiryManage: React.FC = () => {
    const [rows, setRows] = useState<InquiryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [needsMigration, setNeedsMigration] = useState(false);
    const [filter, setFilter] = useState<StatusFilter>('all');
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [toast, setToast] = useState('');
    const detailGuard = useRef<(() => boolean) | null>(null);
    const registerDetailGuard = useCallback((guard: (() => boolean) | null) => { detailGuard.current = guard; }, []);
    const selectInquiry = (id: string) => { if (selectedId === id || (detailGuard.current && !detailGuard.current())) return; setSelectedId(id); };
    const toastTimer = useRef<number | undefined>(undefined);

    const load = useCallback(async () => {
        try {
            const list = await api.inquiries.list();
            setRows(Array.isArray(list) ? list : []);
            setLoadError('');
            setNeedsMigration(false);
        } catch (e) {
            if (isMigrationError(e)) {
                setNeedsMigration(true);
                setLoadError('');
            } else {
                setLoadError(describeError(e));
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => () => window.clearTimeout(toastTimer.current), []);

    const showToast = (message: string) => {
        setToast(message);
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(''), 2600);
    };

    const fail = (e: unknown) => {
        if (isMigrationError(e)) setNeedsMigration(true);
        alert(describeError(e));
    };

    const counts = useMemo(() => {
        const result: Record<StatusFilter, number> = { all: rows.length, new: 0, answered: 0, closed: 0 };
        for (const row of rows) result[row.status] += 1;
        return result;
    }, [rows]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return rows.filter((row) => (filter === 'all' || row.status === filter)
            && (!q || [row.name, row.email, row.reservation_number, row.message, row.kind].some((v) => v.toLowerCase().includes(q))));
    }, [rows, filter, query]);

    const selected = rows.find((row) => row.id === selectedId) ?? null;

    const patchRow = (id: string, changes: Partial<InquiryRecord>) =>
        setRows((list) => list.map((row) => (row.id === id ? { ...row, ...changes } : row)));

    const changeStatus = async (inquiry: InquiryRecord, status: InquiryStatus) => {
        if (inquiry.status === status) return;
        setBusyId(inquiry.id);
        patchRow(inquiry.id, { status });
        try {
            await api.inquiries.update(inquiry.id, { status });
            showToast(`상태를 「${STATUS_META[status].label}」로 변경했습니다.`);
        } catch (e) {
            patchRow(inquiry.id, { status: inquiry.status });
            fail(e);
        } finally {
            setBusyId(null);
        }
    };

    const saveNote = async (inquiry: InquiryRecord, admin_note: string) => {
        try {
            await api.inquiries.update(inquiry.id, { admin_note });
            patchRow(inquiry.id, { admin_note });
            showToast('메모를 저장했습니다.');
            return true;
        } catch (e) {
            fail(e);
            return false;
        }
    };

    const remove = async (inquiry: InquiryRecord) => {
        if (!confirm(`${inquiry.name || inquiry.email} 님의 문의를 삭제하시겠습니까?\n삭제하면 되돌릴 수 없습니다.`)) return;
        setBusyId(inquiry.id);
        try {
            await api.inquiries.delete(inquiry.id);
            setRows((list) => list.filter((row) => row.id !== inquiry.id));
            setSelectedId((id) => (id === inquiry.id ? null : id));
            showToast('문의를 삭제했습니다.');
        } catch (e) {
            fail(e);
        } finally {
            setBusyId(null);
        }
    };

    const headerActions = (
        <>
            <a className="btn btn-ghost" href="/contact" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <Icon name="open_in_new" />고객 화면 보기
            </a>
            <button type="button" className="btn btn-ghost" onClick={() => void load()}>
                <Icon name="refresh" />새로고침
            </button>
        </>
    );

    const emptyText = loading
        ? '불러오는 중…'
        : loadError
            ? `목록을 불러오지 못했습니다: ${loadError}`
            : rows.length === 0
                ? '접수된 문의가 없습니다.'
                : '조건에 맞는 문의가 없습니다.';

    return (
        <AdminLayout activePage="inquiries" title="일반 문의" eyebrow="고객 지원" showSearch={false} actions={headerActions}>
            <div className="route-anim rd-content-page rd-inquiry-page">
                {needsMigration && <MigrationNotice onRetry={() => void load()} />}

                <section className="rd-content-kpis">
                    {(['all', ...STATUS_ORDER] as StatusFilter[]).map(key => <button type="button" key={key} className={'rd-content-kpi' + (filter === key ? ' is-selected' : '')} aria-pressed={filter === key} onClick={() => setFilter(key)}><span><i><Icon name={key === 'all' ? 'mail' : key === 'new' ? 'mail' : key === 'answered' ? 'check_circle' : 'inbox'} /></i><b>{key === 'all' ? '전체 문의' : STATUS_META[key].label}</b></span><strong>{loading && !rows.length ? '—' : counts[key]}<small>건</small></strong></button>)}
                </section>
                <div className="rd-inquiry-layout">
                    <section className="rd-content-panel rd-inquiry-list">
                        <div className="rd-inquiry-search"><label className="rd-content-search"><Icon name="search" /><input type="text" placeholder="이름 · 이메일 · 내용 검색" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
                        {visible.map(inquiry => <button type="button" key={inquiry.id} className={'rd-inquiry-item' + (selectedId === inquiry.id ? ' is-selected' : '')} aria-pressed={selectedId === inquiry.id} onClick={() => selectInquiry(inquiry.id)}>
                            <span className="rd-content-avatar">{(inquiry.name || '문').slice(0, 1)}</span><span className="rd-inquiry-item-copy"><span><strong>{inquiry.name || '이름 없음'}</strong><small>{inquiry.kind}</small><time>{formatReceived(inquiry.created_at)}</time></span><span>{inquiry.message}</span></span><StatusBadge status={inquiry.status} />
                        </button>)}
                        {!visible.length && <div className="empty"><Icon name={loadError ? 'error' : 'inbox'} /><p>{emptyText}</p></div>}
                    </section>
                    {selected ? <InquiryDrawer key={selected.id} inline inquiry={selected} busy={busyId === selected.id} registerCloseGuard={registerDetailGuard} onClose={() => setSelectedId(null)} onStatus={status => void changeStatus(selected, status)} onSaveNote={note => saveNote(selected, note)} onDelete={() => void remove(selected)} /> : <section className="rd-content-panel rd-inquiry-placeholder"><Icon name="mail" /><strong>문의 내용을 선택해 주세요.</strong><p>목록에서 문의를 선택하면 내용과 처리 상태를 확인할 수 있어요.</p></section>}
                </div>
            </div>
            {toast && (
                <div className="page-toast">
                    <Icon name="check_circle" />
                    <span>{toast}</span>
                </div>
            )}
        </AdminLayout>
    );
};
