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
}

const InquiryDrawer: React.FC<DrawerProps> = ({ inquiry, busy, onClose, onStatus, onSaveNote, onDelete }) => {
    const [note, setNote] = useState(inquiry.admin_note);
    const [savingNote, setSavingNote] = useState(false);
    const noteDirty = note !== inquiry.admin_note;

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
        <div className="drawer-scrim" onClick={close}>
            <div className="drawer" onClick={(e) => e.stopPropagation()}>
                <div className="drawer-head">
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="row" style={{ gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                            <StatusBadge status={inquiry.status} />
                            <span className="badge b-blue">{inquiry.kind}</span>
                            {inquiry.user_id && <span className="badge b-gray">회원</span>}
                        </div>
                        <div className="page-title" style={{ fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis' }}>{inquiry.name || '이름 없음'}</div>
                    </div>
                    <button type="button" className="act-btn" title="닫기" onClick={close}>
                        <Icon name="close" />
                    </button>
                </div>

                <div className="drawer-body">
                    <div className="card card-pad" style={{ marginBottom: 16 }}>
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
                    </div>

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

    const stop = (e: React.MouseEvent) => e.stopPropagation();

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
        <AdminLayout activePage="inquiries" title="문의 관리" eyebrow="고객 지원" showSearch={false} actions={headerActions}>
            <div className="route-anim">
                {needsMigration && <MigrationNotice onRetry={() => void load()} />}

                <div className="sec-head">
                    <div>
                        <h3>
                            문의 목록
                            {counts.new > 0 && <span className="badge b-red" style={{ marginLeft: 10, verticalAlign: 'middle' }}>미처리 {counts.new}건</span>}
                        </h3>
                        <div className="cell-muted" style={{ fontSize: 13 }}>고객 화면 '문의'(/contact) 폼으로 접수된 문의입니다. 최신순으로 표시됩니다.</div>
                    </div>
                </div>

                <div className="toolbar">
                    <div className="seg">
                        {(['all', ...STATUS_ORDER] as StatusFilter[]).map((key) => (
                            <button key={key} type="button" className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>
                                {key === 'all' ? '전체' : STATUS_META[key].label} {counts[key]}
                            </button>
                        ))}
                    </div>
                    <div className="spacer" />
                    <div className="tb-search">
                        <Icon name="search" />
                        <input type="text" placeholder="이름 · 이메일 · 내용 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                </div>

                <div className="card">
                    {visible.length > 0 && (
                        <div className="tbl-wrap">
                            <table className="tbl">
                                <thead>
                                    <tr>
                                        <th style={{ width: 96 }}>상태</th>
                                        <th>종류</th>
                                        <th>보낸 사람</th>
                                        <th>내용</th>
                                        <th>접수 시각</th>
                                        <th className="r">관리</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visible.map((inquiry) => (
                                        <tr key={inquiry.id} onClick={() => setSelectedId(inquiry.id)}>
                                            <td><StatusBadge status={inquiry.status} /></td>
                                            <td><span className="badge b-blue">{inquiry.kind}</span></td>
                                            <td>
                                                <div className="cell-strong" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{inquiry.name || '이름 없음'}</div>
                                                <div className="cell-muted" style={{ fontSize: 12.5, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{inquiry.email}</div>
                                            </td>
                                            <td style={{ maxWidth: 360 }}>
                                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: inquiry.status === 'new' ? 700 : 400 }}>{inquiry.message}</div>
                                                {inquiry.reservation_number && <div className="cell-muted" style={{ fontSize: 12.5 }}>예약번호 {inquiry.reservation_number}</div>}
                                            </td>
                                            <td className="cell-mono" style={{ whiteSpace: 'nowrap' }} title={`${inquiry.created_at} UTC`}>{formatReceived(inquiry.created_at)}</td>
                                            <td className="r" onClick={stop}>
                                                <span className="row-actions">
                                                    <a className="act-btn" href={replyHref(inquiry)} title="메일로 답장">
                                                        <Icon name="forward_to_inbox" />
                                                    </a>
                                                    {inquiry.status === 'new' && (
                                                        <button type="button" className="act-btn" title="답변 완료로 변경" disabled={busyId === inquiry.id} onClick={() => void changeStatus(inquiry, 'answered')}>
                                                            <Icon name="task_alt" />
                                                        </button>
                                                    )}
                                                    <button type="button" className="act-btn danger" title="삭제" disabled={busyId === inquiry.id} onClick={() => void remove(inquiry)}>
                                                        <Icon name="delete" />
                                                    </button>
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {visible.length === 0 && (
                        <div className="empty">
                            <Icon name={loadError ? 'error' : 'inbox'} />
                            <p>{emptyText}</p>
                        </div>
                    )}
                </div>
            </div>

            {selected && (
                <InquiryDrawer
                    key={selected.id}
                    inquiry={selected}
                    busy={busyId === selected.id}
                    onClose={() => setSelectedId(null)}
                    onStatus={(status) => void changeStatus(selected, status)}
                    onSaveNote={(note) => saveNote(selected, note)}
                    onDelete={() => void remove(selected)}
                />
            )}

            {toast && (
                <div className="page-toast">
                    <Icon name="check_circle" />
                    <span>{toast}</span>
                </div>
            )}
        </AdminLayout>
    );
};
