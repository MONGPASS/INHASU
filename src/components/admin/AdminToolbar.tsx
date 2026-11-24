import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useAdminWorkspace } from './AdminWorkspaceContext';
import { AdminIconButton, AdminTextButton } from './ui/AdminButton';
import { AdminSearch } from './ui/AdminFields';
import { IconBell, IconClose, IconSearch } from './ui/AdminIcons';
import { adminSearchGroups, adminTaskBadge, isAdminHref, nextSearchIndex } from './adminToolbarHelpers';
import './AdminToolbar.css';

const taskLabel = { deposit_report: '입금 신고', contract: '계약 동의', assignment: '출발 준비', quote: '견적 문의' };

export function AdminToolbar({ showSearch = true }: { showSearch?: boolean }) {
    const { data, loading, error, refresh } = useAdminWorkspace();
    const { user } = useUser();
    const authorized = user?.role === 'admin';
    const workspace = authorized ? data : null;
    const errorMessage = error;
    const [panel, setPanel] = useState<'search' | 'tasks' | null>(null);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const toolbar = useRef<HTMLDivElement>(null);
    const input = useRef<HTMLInputElement>(null);
    const bell = useRef<HTMLButtonElement>(null);
    const suppressFocus = useRef(false);
    const taskPanel = useRef<HTMLDivElement>(null);
    const id = useId().replace(/:/g, '');
    const listId = `admin-search-${id}`;
    const searchPanelId = `admin-search-panel-${id}`;
    const taskId = `admin-tasks-${id}`;
    const location = useLocation();
    const navigate = useNavigate();
    const groups = useMemo(() => adminSearchGroups(workspace?.searchItems || [], query), [workspace, query]);
    const results = groups.flatMap(group => group.items);
    const resultKeys = results.map(result => result.key).join('|');
    const partial = !!workspace && (workspace.warnings.length > 0 || Object.values(workspace.availability).some(value => !value));
    const badge = adminTaskBadge(workspace, loading, !!errorMessage);
    const initialLoading = loading && !workspace;

    const close = (restore = false) => {
        setPanel(null);
        if (restore && panel === 'tasks') bell.current?.focus();
        if (restore && panel === 'search') {
            suppressFocus.current = true;
            input.current?.focus();
            queueMicrotask(() => { suppressFocus.current = false; });
        }
    };
    useEffect(() => { setPanel(null); setQuery(''); }, [location.key, authorized]);
    useEffect(() => { setActive(0); }, [query, resultKeys]);
    useEffect(() => {
        if (panel !== 'search') return;
        toolbar.current?.querySelector(`#${listId}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
    }, [active, panel, listId]);
    useEffect(() => {
        if (panel === 'tasks') taskPanel.current?.focus();
        if (!panel) return;
        const outside = (event: PointerEvent) => { if (!toolbar.current?.contains(event.target as Node)) setPanel(null); };
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(true); } };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
    }, [panel]);

    const sourceStatus = () => <>
        {errorMessage && <p className="at-warning" role="alert">{errorMessage} {workspace && '마지막으로 확인한 자료입니다.'}</p>}
        {partial && <div className="at-warning" role="status"><strong>일부 자료를 불러오지 못했습니다.</strong>
            {workspace?.warnings.map((warning, index) => <span key={index}>{warning}</span>)}<span>조회되지 않은 예약이나 업무가 있을 수 있습니다.</span></div>}
        {loading && workspace && <p className="at-hint" role="status">최신 자료 확인 중…</p>}
    </>;
    const retry = <AdminTextButton size="sm" tone="assistive" className="at-refresh" disabled={loading || !authorized} onClick={() => { void refresh(); }}>{loading ? '확인 중…' : '새로고침'}</AdminTextButton>;
    return <div className="admin-toolbar" ref={toolbar}>
        {showSearch && <div className={`at-search${panel === 'search' ? ' at-search-open' : ''}`}>
            <AdminIconButton className="at-mobile-search at-icon-button" label="관리자 통합 검색 열기" aria-expanded={panel === 'search'} aria-controls={panel === 'search' ? searchPanelId : undefined}
                onClick={() => { setPanel('search'); requestAnimationFrame(() => input.current?.focus()); }}><IconSearch /></AdminIconButton>
            <AdminSearch className="at-search-field" ref={input} role="combobox" aria-label="관리자 통합 검색"
                placeholder="예약번호, 고객명, 상품 검색" value={query} autoComplete="off" aria-autocomplete="list" aria-expanded={panel === 'search'}
                aria-controls={panel === 'search' && workspace && query.trim() ? listId : undefined} aria-activedescendant={panel === 'search' && results[active] ? `${listId}-option-${active}` : undefined}
                onFocus={() => { if (suppressFocus.current) { suppressFocus.current = false; return; } setPanel('search'); }}
                onChange={value => { setQuery(value); setPanel('search'); }}
                onKeyDown={event => {
                    // Esc는 아래 문서 단위 처리가 창만 닫는다(검색어는 남긴다) — 검색 칸의 ‘Esc로 지우기’는 쓰지 않는다
                    if (event.key === 'Escape') event.preventDefault();
                    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault(); setPanel('search'); setActive(current => nextSearchIndex(current, event.key === 'ArrowDown' ? 1 : -1, results.length));
                    } else if (event.key === 'Enter') {
                        event.preventDefault(); const result = results[active] || results[0];
                        if (result) { close(); navigate(result.href); }
                    }
                }} />
            {panel === 'search' && <div className="at-panel at-search-panel" id={searchPanelId}>
                <div className="at-panel-head"><strong>통합 검색</strong>{retry}<AdminIconButton size="sm" className="at-close" label="검색 닫기" onClick={() => close(true)}><IconClose /></AdminIconButton></div>
                {sourceStatus()}
                {!authorized ? <p className="at-empty">관리자 로그인 상태를 확인해 주세요.</p>
                    : initialLoading ? <p className="at-empty" role="status">예약·견적·상품 자료를 불러오고 있습니다.</p>
                        : !workspace ? <p className="at-empty">검색 자료를 불러오지 못했습니다. 다시 시도해 주세요.</p>
                            : !query.trim() ? <p className="at-empty">예약번호·고객명·이메일·전화번호 또는 상품명을 입력하세요.</p>
                                : <><div className="at-search-results" id={listId} role="listbox" aria-label="통합 검색 결과">
                                    {groups.map(group => <div role="group" aria-label={group.label} key={group.category}><div className="at-group-label">{group.label}</div>
                                        {group.items.map(result => {
                                            const index = results.findIndex(item => item.key === result.key);
                                            return <Link key={result.key} id={`${listId}-option-${index}`} to={result.href} role="option" aria-selected={index === active}
                                                className={`at-result${index === active ? ' at-active' : ''}`} onMouseEnter={() => setActive(index)} onClick={() => close()}>
                                                <span><strong>{result.title}</strong><small>{result.subtitle}</small></span><span className="at-state">{result.statusLabel}</span></Link>;
                                        })}</div>)}
                                </div>{!results.length && <p className="at-empty" role="status">{partial || errorMessage ? '확인된 자료에서 검색 결과가 없습니다.' : '검색 결과가 없습니다.'}</p>}
                                    <p className="at-hint">종류별 최대 4건 표시 · 방향키로 선택 · Enter로 열기</p></>}
            </div>}
        </div>}
        <div className="at-tasks">
            <AdminIconButton ref={bell} className="at-icon-button at-bell" label={badge.label} title="업무 알림" aria-expanded={panel === 'tasks'} aria-controls={panel === 'tasks' ? taskId : undefined} aria-haspopup="dialog"
                onClick={() => setPanel(current => current === 'tasks' ? null : 'tasks')}><IconBell /><span className={`at-count${partial || !workspace ? ' at-count-warning' : ''}`} aria-hidden="true">{badge.text}</span></AdminIconButton>
            {panel === 'tasks' && <div ref={taskPanel} className="at-panel at-task-panel" id={taskId} role="dialog" aria-modal="false" aria-labelledby={`${taskId}-title`} tabIndex={-1}>
                <div className="at-panel-head"><strong id={`${taskId}-title`}>업무 알림</strong>{retry}<AdminIconButton size="sm" className="at-close" label="업무 알림 닫기" onClick={() => close(true)}><IconClose /></AdminIconButton></div>
                <p className="at-hint">처리가 필요한 업무입니다. 해당 예약이나 문의에서 완료하면 목록에 반영됩니다.</p>
                {sourceStatus()}
                {!authorized ? <p className="at-empty">관리자 로그인 상태를 확인해 주세요.</p>
                    : initialLoading ? <p className="at-empty" role="status">업무 알림을 불러오고 있습니다.</p>
                        : !workspace ? <p className="at-empty">업무를 확인하지 못했습니다. 다시 시도해 주세요.</p>
                            : !workspace.tasks.length ? <p className="at-empty" role="status">{partial ? '확인된 자료에는 미완료 업무가 없습니다. 조회되지 않은 자료를 확인해 주세요.' : errorMessage ? '마지막 확인한 자료에는 미완료 업무가 없습니다. 새로고침 후 현재 업무를 확인해 주세요.' : '미완료 업무가 없습니다.'}</p>
                                : <div className="at-task-list">{workspace.tasks.filter(task => isAdminHref(task.href)).map(task => <Link key={task.key} to={task.href} className="at-task" onClick={() => close()}>
                                    <span className={`at-task-kind${task.priority === 'urgent' ? ' at-task-urgent' : ''}`}>{taskLabel[task.kind]}</span>
                                    <strong>{task.title}</strong><small>{task.description}</small></Link>)}</div>}
            </div>}
        </div>
        <a className="at-site-link" href="/" target="_blank" rel="noopener noreferrer">사이트 보기</a>
    </div>;
}
