import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useUser } from '../../contexts/UserContext';
import type { AdminWorkspaceData } from '../../types/adminWorkspace';

interface WorkspaceState { data: AdminWorkspaceData | null; loading: boolean; error: string; refresh: () => Promise<void>; }
const WorkspaceContext = createContext<WorkspaceState | null>(null);

/** Shared, account-scoped read-only snapshot for the dashboard, search and work alerts. */
export function AdminWorkspaceProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
    const { user } = useUser();
    const account = enabled && user?.role === 'admin' ? user.id : '';
    const [data, setData] = useState<AdminWorkspaceData | null>(null);
    const [dataAccount, setDataAccount] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const controller = useRef<AbortController | null>(null);
    const activeAccount = useRef(account);
    activeAccount.current = account;
    const pending = useRef<Promise<void> | null>(null);
    const revision = useRef(0);
    const refresh = useCallback(async () => {
        if (!account || activeAccount.current !== account) return;
        if (pending.current) return pending.current;
        const abort = new AbortController();
        controller.current = abort;
        const requestRevision = revision.current;
        setLoading(true);
        const request = (async () => {
            try {
                const response = await fetch('/api/admin/workspace', { credentials: 'include', cache: 'no-store', signal: abort.signal });
                if (!response.ok) {
                    if ((response.status === 401 || response.status === 403) && !abort.signal.aborted
                        && activeAccount.current === account && requestRevision === revision.current) setData(null);
                    throw new Error(response.status === 401 || response.status === 403 ? '관리자 로그인을 다시 확인해 주세요.' : '업무 현황을 불러오지 못했습니다. 다시 시도해 주세요.');
                }
                const next: AdminWorkspaceData = await response.json();
                if (![next.bookings, next.inquiries, next.products, next.tasks, next.searchItems, next.warnings].every(Array.isArray)
                    || !next.metrics || !next.availability) throw new Error('업무 현황 응답을 확인할 수 없습니다.');
                if (!abort.signal.aborted && activeAccount.current === account && requestRevision === revision.current) { setDataAccount(account); setData(next); setError(''); }
            } catch (reason: any) {
                if (!abort.signal.aborted && activeAccount.current === account && requestRevision === revision.current) setError(reason?.message || '업무 현황을 불러오지 못했습니다.');
            } finally {
                if (requestRevision === revision.current && activeAccount.current === account) { setLoading(false); pending.current = null; }
            }
        })();
        pending.current = request;
        await request;
    }, [account]);
    useEffect(() => {
        revision.current++;
        controller.current?.abort(); pending.current = null;
        setData(null); setDataAccount(''); setError(''); setLoading(false);
        if (!account) return;
        void refresh();
        let changedTimer: ReturnType<typeof setTimeout> | undefined;
        const onFocus = () => { if (!document.hidden) void refresh(); };
        const onChange = () => { clearTimeout(changedTimer); changedTimer = setTimeout(() => { void refresh(); }, 300); };
        const timer = window.setInterval(onFocus, 60000);
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onFocus);
        window.addEventListener('admin-workspace-changed', onChange);
        return () => {
            revision.current++; controller.current?.abort(); pending.current = null;
            clearTimeout(changedTimer); window.clearInterval(timer);
            window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus);
            window.removeEventListener('admin-workspace-changed', onChange);
        };
    }, [account, refresh]);
    return <WorkspaceContext.Provider value={{ data: dataAccount === account ? data : null, loading, error, refresh }}>{children}</WorkspaceContext.Provider>;
}
export function useAdminWorkspace() {
    const value = useContext(WorkspaceContext);
    if (!value) throw new Error('AdminWorkspaceProvider 안에서 관리자 업무 현황을 사용하세요.');
    return value;
}
