import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { DashboardIcon } from '../components/admin/dashboard/DashboardIcon';
import { api } from '../lib/api';
import type { InquiryRecord, InquiryStatus } from '../types/inquiry';
import './AdminContentManage.css';
import { adminConfirm, adminNotify } from '../components/admin/ui/adminFeedback';

type StatusFilter = InquiryStatus | 'all';

const STATUS_META: Record<InquiryStatus, { label: string; tone: 'mint' | 'gray' }> = {
    new: { label: '신규', tone: 'mint' },
    answered: { label: '답변 완료', tone: 'mint' },
    closed: { label: '종료', tone: 'gray' },
};
const STATUS_ORDER: InquiryStatus[] = ['new', 'answered', 'closed'];

const NOTE_MAX = 2000;

const MIGRATION_TEXT = '문의 테이블이 아직 없습니다. 관리자로 로그인한 상태에서 /api/migrate-db 를 한 번 열어 주세요.';

/** 답장 문구 빠른 입력. 메일 앱에 채워 넣을 초안일 뿐 저장·발송하지 않는다. */
const QUICK_PHRASES: Array<{ label: string; text: string; append?: boolean }> = [
    { label: '인사말', text: '안녕하세요, 몽골 여행 문의 주셔서 감사합니다.\n' },
    { label: '견적 안내', text: '말씀하신 일정으로 맞춤 견적을 준비해 드릴게요. 희망 출발일과 인원을 한 번 더 알려 주세요.\n' },
    { label: '마무리', text: '\n더 궁금한 점이 있으면 언제든 편하게 문의해 주세요. 감사합니다.', append: true },
];

/** Lucide outlines (ISC) that DashboardIcon does not carry. Keys keep the `lc-` prefix for the icon-subset check. */
const LOCAL_ICONS = {
    'lc-inbox': <><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>,
    'lc-mail': <><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
    'lc-mail-plus': <><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /><path d="M19 16v6" /><path d="M16 19h6" /></>,
    'lc-mail-check': <><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /><path d="m16 19 2 2 4-4" /></>,
    'lc-clock': <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    'lc-send': <><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" /><path d="m21.854 2.147-10.94 10.939" /></>,
    'lc-ticket': <><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" /></>,
    'lc-save': <><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" /><path d="M7 3v4a1 1 0 0 0 1 1h7" /></>,
    'lc-triangle-alert': <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
} as const;

const LocalIcon: React.FC<{ name: keyof typeof LOCAL_ICONS; size?: number }> = ({ name, size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flex: 'none', display: 'block' }}>
        {LOCAL_ICONS[name]}
    </svg>
);

/** The API names the fix in its "table missing" error. */
const isMigrationError = (e: unknown) => e instanceof Error && e.message.includes('migrate-db');

const describeError = (e: unknown) => {
    if (isMigrationError(e)) return MIGRATION_TEXT;
    const message = e instanceof Error ? e.message : String(e);
    if (message === 'Unauthorized' || message === 'Forbidden') return '관리자 권한이 필요합니다. 다시 로그인해 주세요.';
    return message || '알 수 없는 오류가 발생했습니다.';
};

/** created_at is stored in UTC ("YYYY-MM-DD HH:MM:SS"); shown in the browser's time zone. */
const parseReceived = (value: string) => {
    const date = new Date(`${(value || '').replace(' ', 'T')}Z`);
    return value && !Number.isNaN(date.getTime()) ? date : null;
};

const formatReceived = (value: string) => {
    const date = parseReceived(value);
    if (!date) return value || '-';
    return date.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
};

/** 목록용 짧은 접수 시각: 방금 · N분 전 · N시간 전 · 어제 · N일 전 · MM.DD */
const formatAgo = (value: string, now: number) => {
    const date = parseReceived(value);
    if (!date) return '';
    const minutes = Math.floor((now - date.getTime()) / 60000);
    if (minutes < 1) return '방금';
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '어제';
    if (days < 7) return `${days}일 전`;
    return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};

const mailtoHref = (inquiry: InquiryRecord, body = '') => {
    const params = [`subject=${encodeURIComponent(`Re: [문의] ${inquiry.kind}`)}`];
    if (body.trim()) params.push(`body=${encodeURIComponent(body)}`);
    return `mailto:${encodeURIComponent(inquiry.email).replace('%40', '@')}?${params.join('&')}`;
};

const initialOf = (inquiry: InquiryRecord) => (inquiry.name || inquiry.email || '?').trim().slice(0, 1) || '?';

const StatusPill: React.FC<{ status: InquiryStatus }> = ({ status }) => (
    <span className="cm-pill" data-tone={STATUS_META[status].tone}>{STATUS_META[status].label}</span>
);

const MigrationNotice: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
    <div className="cm-notice" data-tone="wait" role="alert">
        <LocalIcon name="lc-triangle-alert" size={20} />
        <div style={{ flex: 1, minWidth: 240 }}>
            {MIGRATION_TEXT}
            <div style={{ fontWeight: 500 }}>열린 화면에 결과(JSON)가 나오면 완료입니다. 배포 후 한 번만 하면 됩니다. 그 전에는 고객의 문의 폼 전송이 실패합니다.</div>
        </div>
        <a className="cm-btn" href="/api/migrate-db" target="_blank" rel="noopener noreferrer">
            <DashboardIcon name="lc-external-link" />/api/migrate-db 열기
        </a>
        <button type="button" className="cm-btn" onClick={onRetry}>
            <DashboardIcon name="lc-refresh-cw" />다시 확인
        </button>
    </div>
);

interface PanelProps {
    inquiry: InquiryRecord;
    busy: boolean;
    onClose: () => void;
    onStatus: (status: InquiryStatus) => void;
    onSaveNote: (note: string) => Promise<boolean>;
    onDelete: () => void;
    /** 다른 문의로 옮기기 전에 저장하지 않은 메모·답장 초안을 확인한다. */
    registerLeaveGuard: (guard: (() => boolean) | null) => void;
}

const InquiryPanel: React.FC<PanelProps> = ({ inquiry, busy, onClose, onStatus, onSaveNote, onDelete, registerLeaveGuard }) => {
    const [note, setNote] = useState(inquiry.admin_note);
    const [savingNote, setSavingNote] = useState(false);
    const [draft, setDraft] = useState('');
    const noteDirty = note !== inquiry.admin_note;
    const draftDirty = draft.trim() !== '';
    const closed = inquiry.status === 'closed';

    useEffect(() => {
        registerLeaveGuard(() => {
            if (!noteDirty && !draftDirty) return true;
            const what = noteDirty && draftDirty ? '저장하지 않은 메모와 답장 초안' : noteDirty ? '저장하지 않은 메모' : '작성 중인 답장 초안';
            return window.confirm(`${what}이 있습니다. 이 문의를 닫을까요?`);
        });
        return () => registerLeaveGuard(null);
    }, [noteDirty, draftDirty, registerLeaveGuard]);

    const saveNote = async () => {
        const trimmed = note.trim();
        setSavingNote(true);
        if (await onSaveNote(trimmed)) setNote(trimmed);
        setSavingNote(false);
    };

    const insertPhrase = (phrase: typeof QUICK_PHRASES[number]) =>
        setDraft((current) => (phrase.append ? current + phrase.text : phrase.text + current));

    return (
        <section className="cm-card iq-panel" aria-label={`${inquiry.name || inquiry.email} 님의 문의`}>
            <div className="iq-panel-head">
                <span className="iq-avatar is-lg" data-new={inquiry.status === 'new' || undefined}>{initialOf(inquiry)}</span>
                <div className="iq-panel-who">
                    <div className="iq-panel-name">
                        <span>{inquiry.name || '이름 없음'}</span>
                        <StatusPill status={inquiry.status} />
                        {inquiry.user_id && <span className="cm-tag">회원</span>}
                    </div>
                    <div className="iq-panel-meta">
                        <a href={mailtoHref(inquiry)} title="메일 앱으로 답장"><LocalIcon name="lc-mail" size={14} />{inquiry.email}</a>
                        {inquiry.reservation_number && <span title="예약번호"><LocalIcon name="lc-ticket" size={14} />{inquiry.reservation_number}</span>}
                        <span title={`${inquiry.created_at} UTC`}><LocalIcon name="lc-clock" size={14} />{formatReceived(inquiry.created_at)}</span>
                    </div>
                </div>
                <button type="button" className="cm-icon-btn" title="닫기" aria-label="문의 닫기" onClick={onClose}>
                    <DashboardIcon name="lc-x" />
                </button>
            </div>

            <div className="iq-panel-body">
                <div className="iq-message">
                    <span className="iq-kind">{inquiry.kind}</span>
                    <div className="iq-bubble">{inquiry.message}</div>
                </div>

                <div className="iq-status">
                    <span className="cm-label">처리 상태</span>
                    <div className="cm-chips">
                        {STATUS_ORDER.map((status) => (
                            <button
                                key={status}
                                type="button"
                                className="cm-chip"
                                aria-pressed={inquiry.status === status}
                                disabled={busy || inquiry.status === status}
                                onClick={() => onStatus(status)}
                            >
                                {STATUS_META[status].label}
                            </button>
                        ))}
                    </div>
                </div>

                {closed ? (
                    <div className="iq-closed"><DashboardIcon name="lc-lock" size={14} />종료된 문의예요. 다시 열면 답장을 이어서 쓸 수 있어요.</div>
                ) : (
                    <div className="iq-compose">
                        <div className="iq-compose-head">
                            <span className="iq-compose-title">답장 작성</span>
                            {QUICK_PHRASES.map((phrase) => (
                                <button key={phrase.label} type="button" className="iq-phrase" onClick={() => insertPhrase(phrase)}>{phrase.label}</button>
                            ))}
                        </div>
                        <textarea
                            className="cm-textarea"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder="고객 이메일로 보낼 답장을 적어 주세요"
                            aria-label="답장 초안"
                        />
                        <p className="cm-hint">
                            「메일 앱으로 답장」은 이 컴퓨터의 메일 앱을 열고 받는 사람·제목·작성한 내용을 채워 넣습니다. 이 화면에서 메일을 자동 발송하거나 초안을 저장하지 않으니, 답장을 보낸 뒤 「답변 완료」로 바꿔 주세요.
                        </p>
                    </div>
                )}

                <div className="iq-note">
                    <label className="cm-label" htmlFor={`iq-note-${inquiry.id}`}>관리자 메모 <span className="cm-label-sub">· 고객에게 보이지 않습니다</span></label>
                    <textarea
                        id={`iq-note-${inquiry.id}`}
                        className="cm-textarea is-short"
                        maxLength={NOTE_MAX}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="처리 내용, 담당자 등을 적어 두세요."
                    />
                    <div className="iq-note-foot">
                        <span>{note.length} / {NOTE_MAX}</span>
                        <button type="button" className="cm-btn is-sm" onClick={() => void saveNote()} disabled={!noteDirty || savingNote}>
                            <LocalIcon name="lc-save" size={14} />{savingNote ? '저장 중…' : '메모 저장'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="iq-panel-foot">
                <button type="button" className="cm-icon-btn is-danger" title="삭제" aria-label="문의 삭제" onClick={onDelete} disabled={busy}>
                    <DashboardIcon name="lc-trash" />
                </button>
                <button type="button" className="cm-btn" disabled={busy} onClick={() => onStatus(closed ? 'new' : 'closed')}>
                    {closed ? '다시 열기' : '문의 종료'}
                </button>
                {!closed && (
                    <a
                        className={`cm-btn iq-send${draftDirty ? ' is-ready' : ''}`}
                        href={mailtoHref(inquiry, draft)}
                        title="메일 앱을 열어 작성한 답장을 채워 넣습니다"
                    >
                        <LocalIcon name="lc-send" />메일 앱으로 답장
                    </a>
                )}
            </div>
        </section>
    );
};

export const AdminInquiryManage: React.FC = () => {
    const [rows, setRows] = useState<InquiryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [needsMigration, setNeedsMigration] = useState(false);
    const [filter, setFilter] = useState<StatusFilter>('all');
    const [query, setQuery] = useState('');
    /** undefined = 보이는 첫 문의를 자동 선택, null = 사용자가 닫음 */
    const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [toast, setToast] = useState('');
    const [now, setNow] = useState(() => Date.now());
    const toastTimer = useRef<number | undefined>(undefined);
    const leaveGuard = useRef<(() => boolean) | null>(null);

    const registerLeaveGuard = useCallback((guard: (() => boolean) | null) => { leaveGuard.current = guard; }, []);
    const canLeave = () => !leaveGuard.current || leaveGuard.current();

    const load = useCallback(async () => {
        try {
            const list = await api.inquiries.list();
            setRows(Array.isArray(list) ? list : []);
            setLoadError('');
            setNeedsMigration(false);
            setNow(Date.now());
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
        adminNotify(describeError(e));
    };

    const counts = useMemo(() => {
        const result: Record<StatusFilter, number> = { all: rows.length, new: 0, answered: 0, closed: 0 };
        for (const row of rows) result[row.status] += 1;
        return result;
    }, [rows]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return rows.filter((row) => (filter === 'all' || row.status === filter)
            && (!q || [row.name, row.email, row.reservation_number, row.message, row.kind].some((v) => (v || '').toLowerCase().includes(q))));
    }, [rows, filter, query]);

    const effectiveId = selectedId === undefined ? visible[0]?.id ?? null : selectedId;
    const selected = rows.find((row) => row.id === effectiveId) ?? null;

    const select = (id: string | null) => {
        if (id === effectiveId || !canLeave()) return;
        setSelectedId(id);
    };

    const changeFilter = (next: StatusFilter) => {
        if (next === filter || !canLeave()) return;
        setFilter(next);
        setSelectedId(undefined);
    };

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
        if (!await adminConfirm(`${inquiry.name || inquiry.email} 님의 문의를 삭제하시겠습니까?\n삭제하면 되돌릴 수 없습니다.`)) return;
        setBusyId(inquiry.id);
        try {
            await api.inquiries.delete(inquiry.id);
            leaveGuard.current = null;
            setRows((list) => list.filter((row) => row.id !== inquiry.id));
            setSelectedId((id) => (id === inquiry.id || id === undefined ? undefined : id));
            showToast('문의를 삭제했습니다.');
        } catch (e) {
            fail(e);
        } finally {
            setBusyId(null);
        }
    };

    const refresh = () => {
        if (!canLeave()) return;
        leaveGuard.current = null;
        void load();
    };

    const headerActions = (
        <>
            <a className="btn btn-ghost" href="/contact" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <DashboardIcon name="lc-external-link" />고객 화면 보기
            </a>
            <button type="button" className="btn btn-ghost" onClick={refresh}>
                <DashboardIcon name="lc-refresh-cw" />새로고침
            </button>
        </>
    );

    const emptyText = loading
        ? '불러오는 중…'
        : loadError
            ? `목록을 불러오지 못했습니다: ${loadError}`
            : rows.length === 0
                ? '접수된 문의가 없어요.'
                : query.trim()
                    ? '검색 결과가 없어요.'
                    : `${filter === 'all' ? '' : `${STATUS_META[filter].label} `}문의가 없어요.`;

    const kpis: Array<{ key: StatusFilter; label: string; icon: React.ReactNode }> = [
        { key: 'all', label: '전체', icon: <LocalIcon name="lc-inbox" /> },
        { key: 'new', label: '신규', icon: <LocalIcon name="lc-mail-plus" /> },
        { key: 'answered', label: '답변 완료', icon: <LocalIcon name="lc-mail-check" /> },
        { key: 'closed', label: '종료', icon: <DashboardIcon name="lc-archive" /> },
    ];

    return (
        <AdminLayout activePage="inquiries" title="일반 문의" eyebrow="고객 지원" showSearch={false} actions={headerActions}>
            <div className="cm-page iq-page route-anim">
                {needsMigration && <MigrationNotice onRetry={refresh} />}

                <section className="cm-kpis" aria-label="문의 현황">
                    {kpis.map(({ key, label, icon }) => {
                        const n = counts[key];
                        return (
                            <button key={key} type="button" className="cm-kpi" aria-pressed={filter === key} onClick={() => changeFilter(key)}>
                                <span className="cm-kpi-head">
                                    <span className="cm-kpi-ico" data-tone={key === 'new' && n > 0 ? 'warn' : n ? 'has' : 'zero'}>{icon}</span>
                                    <span className="cm-kpi-label">{label}</span>
                                </span>
                                <span className="cm-kpi-value"><span className="cm-kpi-num" data-zero={!n || undefined}>{loading ? '–' : n}</span><span className="cm-kpi-unit">건</span></span>
                            </button>
                        );
                    })}
                </section>

                <div className="iq-split">
                    <section className="cm-card iq-list" aria-label="문의 목록">
                        <div className="iq-list-search">
                            <label className="cm-search">
                                <DashboardIcon name="lc-search" color="var(--text-tertiary)" />
                                <input type="text" placeholder="이름 · 이메일 · 내용 검색" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="문의 검색" />
                            </label>
                        </div>
                        {visible.map((inquiry) => (
                            <button
                                key={inquiry.id}
                                type="button"
                                className="iq-row"
                                aria-current={inquiry.id === effectiveId || undefined}
                                onClick={() => select(inquiry.id)}
                            >
                                <span className="iq-avatar" data-new={inquiry.status === 'new' || undefined}>{initialOf(inquiry)}</span>
                                <span className="iq-row-main">
                                    <span className="iq-row-top">
                                        <span className="iq-row-name">{inquiry.name || '이름 없음'}</span>
                                        <span className="iq-row-kind">{inquiry.kind}</span>
                                        <span className="iq-row-ago" title={formatReceived(inquiry.created_at)}>{formatAgo(inquiry.created_at, now)}</span>
                                    </span>
                                    <span className="iq-row-preview" data-new={inquiry.status === 'new' || undefined}>{inquiry.message.replace(/\s+/g, ' ')}</span>
                                </span>
                                <StatusPill status={inquiry.status} />
                            </button>
                        ))}
                        {visible.length === 0 && (
                            <div className="cm-empty">
                                {loadError ? <DashboardIcon name="lc-circle-alert" size={32} /> : <LocalIcon name="lc-inbox" size={32} />}
                                <span>{emptyText}</span>
                            </div>
                        )}
                    </section>

                    {selected && (
                        <InquiryPanel
                            key={selected.id}
                            inquiry={selected}
                            busy={busyId === selected.id}
                            onClose={() => select(null)}
                            onStatus={(status) => void changeStatus(selected, status)}
                            onSaveNote={(note) => saveNote(selected, note)}
                            onDelete={() => void remove(selected)}
                            registerLeaveGuard={registerLeaveGuard}
                        />
                    )}
                </div>
            </div>

            {toast && (
                <div className="page-toast">
                    <DashboardIcon name="lc-circle-check" color="var(--mrt-green)" />
                    <span>{toast}</span>
                </div>
            )}
        </AdminLayout>
    );
};
