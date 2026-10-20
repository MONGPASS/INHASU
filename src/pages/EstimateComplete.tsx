import React, { useMemo } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { SEO } from '../components/seo/SEO';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { MobileShell } from '../components/mobile/MobileShell';
import { MW } from '../components/desktop-primitives/mwTokens';
import { QuoteDoneBody } from '../components/estimate-desktop/QuoteDoneBody';
import { resolveQuoteDone } from '../components/estimate-desktop/quoteLinks';
import { QuoteDoneSummary } from '../components/estimate-mobile/QuoteDone';
import { CustomerAccessGuard } from '../components/auth/CustomerAccessGuard';

/**
 * 견적 요청 완료(`/estimate-complete`): 접수 확인 + 내 견적 전용 링크(`/내견적.html?t=…`).
 * 방금 제출한 요청은 라우터 state로 넘어오고, 새로고침·직접 접속처럼 state가 없으면
 * 이 브라우저에 보관한 최근 견적 링크로 복구한다. 그것도 없으면 견적 요청 화면으로 보낸다.
 */
export const EstimateComplete: React.FC = () => {
    const isDesktop = useIsDesktop();
    const navigate = useNavigate();
    const { state } = useLocation();
    const done = useMemo(() => resolveQuoteDone(state), [state]);

    if (!done) return <Navigate to="/custom-estimate" replace />;

    const go = (path: string) => {
        navigate(path);
        window.scrollTo(0, 0);
    };

    return (
        <CustomerAccessGuard source="request" resourceKey={done.token}>
            {/* 개인 전용 링크가 있는 화면이므로 검색에 노출하지 않는다. */}
            <SEO title="견적 요청 접수 완료" description="견적 요청이 접수되었습니다. 내 견적 전용 링크에서 진행 상황과 견적서를 확인하세요." robots="noindex, nofollow" />
            {isDesktop ? (
                <DesktopLayout>
                    <section style={{ background: '#F7FAF9', padding: '56px 24px 96px' }}>
                        <div style={{ maxWidth: 520, margin: '0 auto', boxSizing: 'border-box', background: '#FFFFFF', border: `1px solid ${MW.line}`, borderRadius: 24, padding: '44px 36px 24px', display: 'flex', flexDirection: 'column', gap: 28, boxShadow: '0 16px 40px rgba(10,31,46,0.06)' }}>
                            <QuoteDoneBody done={done} go={go} />
                        </div>
                    </section>
                </DesktopLayout>
            ) : (
                <MobileShell title="견적">
                    <QuoteDoneSummary done={done} go={go} />
                </MobileShell>
            )}
        </CustomerAccessGuard>
    );
};
