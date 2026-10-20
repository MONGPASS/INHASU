import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { requireCustomerAccess, type CustomerSource } from '../../../public/customer-access.js';

/** Authentication alone does not attach an older guest record to this account. */
export function CustomerAccessGuard({ source, resourceKey, children }: { source: CustomerSource; resourceKey?: string; children: ReactNode }) {
    const params = useParams();
    const key = resourceKey ?? params.id ?? params.reservationId ?? '';
    const identity = `${source}:${key}`;
    const [ready, setReady] = useState('');
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        setError('');
        requireCustomerAccess(source, key).then(() => { if (active) setReady(identity); }).catch(() => { if (active) setError('이 이력을 확인할 수 없습니다. 처음 연결한 Google 계정으로 로그인하거나 담당자에게 문의해 주세요.'); });
        return () => { active = false; };
    }, [source, key, identity]);
    if (error) return <main className="min-h-screen flex items-center justify-center p-6"><div role="alert"><h1 className="text-xl font-bold mb-3">이력을 확인할 수 없습니다</h1><p>{error}</p><a className="inline-block mt-5 text-primary font-bold" href="/mypage/estimates">내 견적 내역으로</a></div></main>;
    return ready === identity ? children : <main className="min-h-screen flex items-center justify-center" aria-busy="true">접근 권한을 확인하고 있습니다.</main>;
}
