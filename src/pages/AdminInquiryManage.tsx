import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import {
    AdminBadge, AdminButton, AdminChipGroup, AdminEmpty, AdminError, AdminField, AdminIconButton, AdminLoading, AdminMessage, AdminSearch,
    AdminStat, AdminStatRow, AdminTextArea, AdminTextButton, IconClock, IconClose, IconMail, IconRefresh, IconTicket, IconTrash,
    adminConfirm, adminNotify, type AdminBadgeProps,
} from '../components/admin/ui';
import { api } from '../lib/api';
import type { InquiryRecord, InquiryStatus } from '../types/inquiry';
import './AdminInquiryManage.css';

/*
 * 일반 문의 — 당근 Seed(은하수 판) 관리자 부품으로 그린다(2026-11-24).
 * 요약·검색·칩·입력칸·버튼·알림·빈 화면은 우리 관리자 부품이고, 목록 줄·첫 글자 동그라미·문의 말풍선만 AdminInquiryManage.css가 그린다.
 * API 호출·저장 순서는 바꾸지 않았다. 다른 문의로 옮길 때 묻는 확인은 브라우저 기본 창 대신 공통 확인 창(adminConfirm)이다.
 */
type StatusFilter = InquiryStatus | 'all';

const STATUS_META: Record<InquiryStatus, { label: string; tone: AdminBadgeProps['tone'] }> = {
    new: { label: '신규', tone: 'warn' },
    answered: { label: '답변 완료', tone: 'success' },
    closed: { label: '종료', tone: 'neutral' },
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

const openInNewTab = (href: string) => { window.open(href, '_blank', 'noopener,noreferrer'); };

const initialOf = (inquiry: InquiryRecord) => (inquiry.name || inquiry.email || '?').trim().slice(0, 1) || '?';

const StatusBadge: React.FC<{ status: InquiryStatus }> = ({ status }) => <AdminBadge tone={STATUS_META[status].tone}>{STATUS_META[status].label}</AdminBadge>;

const MigrationNotice: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
    <AdminMessage tone="cautionary" role="alert" title={MIGRATION_TEXT}
        actions={<><AdminTextButton size="sm" onClick={() => openInNewTab('/api/migrate-db')}>/api/migrate-db 열기</AdminTextButton><AdminTextButton size="sm" tone="assistive" onClick={onRetry}>다시 확인</AdminTextButton></>}>
        열린 화면에 결과(JSON)가 나오면 완료입니다. 배포 후 한 번만 하면 됩니다. 그 전에는 고객의 문의 폼 전송이 실패합니다.
    </AdminMessage>
);

type LeaveGuard = () => Promise<boolean>;

interface PanelProps {
    inquiry: InquiryRecord;
    busy: boolean;
    onClose: () => void;
    onStatus: (status: InquiryStatus) => void;
    onSaveNote: (note: string) => Promise<boolean>;
    onDelete: () => void;
    /** 다른 문의로 옮기기 전에 저장하지 않은 메모·답장 초안을 확인한다. */
    registerLeaveGuard: (guard: LeaveGuard | null) => void;
}

const InquiryPanel: React.FC<PanelProps> = ({ inquiry, busy, onClose, onStatus, onSaveNote, onDelete, registerLeaveGuard }) => {
    const [note, setNote] = useState(inquiry.admin_note);
    const [savingNote, setSavingNote] = useState(false);
    const [draft, setDraft] = useState('');
    const noteDirty = note !== inquiry.admin_note;
    const draftDirty = draft.trim() !== '';
    const closed = inquiry.status === 'closed';
    const who = inquiry.name || inquiry.email;

    useEffect(() => {
        registerLeaveGuard(async () => {
            if (!noteDirty && !draftDirty) return true;
            const what = noteDirty && draftDirty ? '저장하지 않은 메모와 답장 초안' : noteDirty ? '저장하지 않은 메모' : '작성 중인 답장 초안';
            return adminConfirm({ title: '이 문의를 닫을까요?', message: `${what}이 있습니다. 닫으면 지금 적은 내용이 사라집니다.`, confirmLabel: '닫기', cancelLabel: '계속 작성' });
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
        <section className="adm-iq-panel" aria-label={`${who} 님의 문의`}>
            <header className="adm-iq-panel-head">
                <span className="adm-iq-avatar is-lg" data-new={inquiry.status === 'new' || undefined} aria-hidden="true">{initialOf(inquiry)}</span>
                <div className="adm-iq-panel-who">
                    <div className="adm-iq-panel-name">
                        <h2>{inquiry.name || '이름 없음'}</h2>
                        <StatusBadge status={inquiry.status} />
                        {inquiry.user_id && <AdminBadge outlined>회원</AdminBadge>}
                    </div>
                    <div className="adm-iq-panel-meta">
                        <a href={mailtoHref(inquiry)} title="메일 앱으로 답장"><IconMail />{inquiry.email}</a>
                        {inquiry.reservation_number && <span title="예약번호"><IconTicket />{inquiry.reservation_number}</span>}
                        <span title={`${inquiry.created_at} UTC`}><IconClock />{formatReceived(inquiry.created_at)}</span>
                    </div>
                </div>
                <AdminIconButton label="문의 닫기" size="sm" onClick={onClose}><IconClose /></AdminIconButton>
            </header>

            <div className="adm-iq-panel-body">
                <div className="adm-iq-message">
                    <span className="adm-iq-kind">{inquiry.kind}</span>
                    <div className="adm-iq-bubble">{inquiry.message}</div>
                </div>

                <div className="adm-iq-status">
                    <span className="adm-iq-label">처리 상태</span>
                    <AdminChipGroup label="처리 상태" value={inquiry.status} onChange={onStatus}
                        items={STATUS_ORDER.map((status) => ({ value: status, label: STATUS_META[status].label, disabled: busy }))} />
                </div>

                {closed ? (
                    <AdminMessage>종료된 문의예요. 다시 열면 답장을 이어서 쓸 수 있어요.</AdminMessage>
                ) : (
                    <div className="adm-iq-section">
                        <div className="adm-iq-compose-head">
                            <span className="adm-iq-label">답장 작성</span>
                            {QUICK_PHRASES.map((phrase) => (
                                <AdminButton key={phrase.label} size="sm" variant="weak" onClick={() => insertPhrase(phrase)}>{phrase.label}</AdminButton>
                            ))}
                        </div>
                        <AdminTextArea value={draft} onChange={(e) => setDraft(e.target.value)} minRows={5} placeholder="고객 이메일로 보낼 답장을 적어 주세요" aria-label="답장 초안" />
                        <p className="adm-iq-hint">
                            「메일 앱으로 답장」은 이 컴퓨터의 메일 앱을 열고 받는 사람·제목·작성한 내용을 채워 넣습니다. 이 화면에서 메일을 자동 발송하거나 초안을 저장하지 않으니, 답장을 보낸 뒤 「답변 완료」로 바꿔 주세요.
                        </p>
                    </div>
                )}

                <div className="adm-iq-section">
                    <AdminField label="관리자 메모" hint="고객에게 보이지 않습니다." aside={`${note.length} / ${NOTE_MAX}`} id={`adm-iq-note-${inquiry.id}`}>
                        {(id, describedBy) => <AdminTextArea id={id} aria-describedby={describedBy} minRows={3} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} placeholder="처리 내용, 담당자 등을 적어 두세요." />}
                    </AdminField>
                    <div className="adm-iq-note-foot">
                        <AdminButton size="sm" loading={savingNote} disabled={!noteDirty} onClick={() => void saveNote()}>{savingNote ? '저장 중…' : '메모 저장'}</AdminButton>
                    </div>
                </div>
            </div>

            <footer className="adm-iq-panel-foot">
                <AdminButton size="sm" variant="weak" leading={<IconTrash />} disabled={busy} onClick={onDelete}>삭제</AdminButton>
                <span className="adm-iq-spacer" />
                <AdminButton size="sm" disabled={busy} onClick={() => onStatus(closed ? 'new' : 'closed')}>{closed ? '다시 열기' : '문의 종료'}</AdminButton>
                {!closed && (
                    <AdminButton size="sm" variant={draftDirty ? 'primary' : 'secondary'} leading={<IconMail />} title="메일 앱을 열어 작성한 답장을 채워 넣습니다"
                        onClick={() => { window.location.href = mailtoHref(inquiry, draft); }}>메일 앱으로 답장</AdminButton>
                )}
            </footer>
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
    const [now, setNow] = useState(() => Date.now());
    const leaveGuard = useRef<LeaveGuard | null>(null);
    /** 확인 창이 열려 있는 동안 다른 이동 요청은 받지 않는다(확인 창이 겹치지 않게). */
    const asking = useRef(false);

    const registerLeaveGuard = useCallback((guard: LeaveGuard | null) => { leaveGuard.current = guard; }, []);
    const canLeave = async () => {
        if (!leaveGuard.current) return true;
        if (asking.current) return false;
        asking.current = true;
        try { return await leaveGuard.current(); } finally { asking.current = false; }
    };

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

    const fail = (e: unknown) => {
        if (isMigrationError(e)) setNeedsMigration(true);
        adminNotify(describeError(e), 'error');
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

    const select = async (id: string | null) => {
        if (id === effectiveId || !(await canLeave())) return;
        setSelectedId(id);
    };

    const changeFilter = async (next: StatusFilter) => {
        if (next === filter || !(await canLeave())) return;
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
            adminNotify(`상태를 「${STATUS_META[status].label}」로 변경했습니다.`, 'success');
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
            adminNotify('메모를 저장했습니다.', 'success');
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
            adminNotify('문의를 삭제했습니다.', 'success');
        } catch (e) {
            fail(e);
        } finally {
            setBusyId(null);
        }
    };

    const refresh = async () => {
        if (!(await canLeave())) return;
        leaveGuard.current = null;
        void load();
    };

    const headerActions = (
        <>
            <AdminButton onClick={() => openInNewTab('/contact')}>고객 화면 보기</AdminButton>
            <AdminButton leading={<IconRefresh />} onClick={() => void refresh()}>새로고침</AdminButton>
        </>
    );

    const emptyTitle = rows.length === 0
        ? '접수된 문의가 없어요.'
        : query.trim()
            ? '검색 결과가 없어요.'
            : `${filter === 'all' ? '' : `${STATUS_META[filter].label} `}문의가 없어요.`;

    const kpis: Array<{ key: StatusFilter; label: string }> = [
        { key: 'all', label: '전체' },
        { key: 'new', label: '신규' },
        { key: 'answered', label: '답변 완료' },
        { key: 'closed', label: '종료' },
    ];

    return (
        <AdminLayout activePage="inquiries" title="일반 문의" eyebrow="고객 지원" showSearch={false} actions={headerActions}>
            <div className="adm-iq route-anim">
                {needsMigration && <MigrationNotice onRetry={() => void refresh()} />}

                <AdminStatRow label="문의 현황">
                    {kpis.map(({ key, label }) => {
                        // 처음 불러오기 전·실패했을 때는 0건으로 단정하지 않는다.
                        const unknown = loading || (Boolean(loadError) && rows.length === 0);
                        return <AdminStat key={key} label={label} value={unknown ? '–' : counts[key]} unit={unknown ? undefined : '건'}
                            attention={key === 'new' && !unknown && counts.new > 0} active={filter === key} onClick={() => void changeFilter(key)} />;
                    })}
                </AdminStatRow>

                <div className="adm-iq-split">
                    <section className="adm-iq-list" aria-label="문의 목록">
                        <div className="adm-iq-list-search">
                            <AdminSearch wide value={query} onChange={setQuery} placeholder="이름 · 이메일 · 내용 검색" aria-label="문의 검색" />
                        </div>
                        {visible.map((inquiry) => (
                            <button
                                key={inquiry.id}
                                type="button"
                                className="adm-iq-row"
                                aria-current={inquiry.id === effectiveId || undefined}
                                onClick={() => void select(inquiry.id)}
                            >
                                <span className="adm-iq-avatar" data-new={inquiry.status === 'new' || undefined} aria-hidden="true">{initialOf(inquiry)}</span>
                                <span className="adm-iq-row-main">
                                    <span className="adm-iq-row-top">
                                        <span className="adm-iq-row-name">{inquiry.name || '이름 없음'}</span>
                                        <span className="adm-iq-row-kind">{inquiry.kind}</span>
                                        <span className="adm-iq-row-ago" title={formatReceived(inquiry.created_at)}>{formatAgo(inquiry.created_at, now)}</span>
                                    </span>
                                    <span className="adm-iq-row-preview" data-new={inquiry.status === 'new' || undefined}>{inquiry.message.replace(/\s+/g, ' ')}</span>
                                </span>
                                <StatusBadge status={inquiry.status} />
                            </button>
                        ))}
                        {visible.length === 0 && (loading ? <AdminLoading />
                            : loadError ? <AdminError title="목록을 불러오지 못했습니다" reason={loadError} onRetry={() => void refresh()} />
                                : <AdminEmpty title={emptyTitle} />)}
                    </section>

                    {selected && (
                        <InquiryPanel
                            key={selected.id}
                            inquiry={selected}
                            busy={busyId === selected.id}
                            onClose={() => void select(null)}
                            onStatus={(status) => void changeStatus(selected, status)}
                            onSaveNote={(note) => saveNote(selected, note)}
                            onDelete={() => void remove(selected)}
                            registerLeaveGuard={registerLeaveGuard}
                        />
                    )}
                </div>
            </div>
        </AdminLayout>
    );
};
