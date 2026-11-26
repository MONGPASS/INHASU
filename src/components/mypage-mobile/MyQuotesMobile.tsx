import { useNavigate, useSearchParams } from 'react-router-dom';
import { QuoteDetailPanel, QuoteListPanel } from '../mypage-desktop/MyQuotes.desktop';
import { useMe, useMyPageData } from '../mypage-desktop/useMyPageData';
import { MobileShell } from '../mobile/MobileShell';
import { SD, SIcon } from '../site-seed/seed';

/**
 * 휴대폰 견적 내역 · 견적 상세(PC ‘마이페이지 — 견적 내역’과 같은 부품을 휴대폰 크기로).
 * `/mypage/estimates` = 목록(상태 칩), `?id=` = 그 견적의 상세.
 */
export function MyQuotesMobile() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { data: me } = useMe();
    const { quotes } = useMyPageData(me);
    const list = quotes.data ?? [];
    const openId = params.get('id');
    const open = openId ? list.find((q) => q.id === openId) : undefined;
    const go = (path: string) => {
        if (/\.html(?:[?#]|$)/i.test(path) || /^\/estimate\//.test(path)) { window.location.assign(path); return; }
        navigate(path);
        window.scrollTo(0, 0);
    };
    const plus = (
        <button type="button" aria-label="새 견적 요청" onClick={() => go('/custom-estimate')}
            style={{ width: 44, height: 44, border: 'none', background: 'transparent', color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <SIcon name="plusLine" size={22} stroke={1.8} />
        </button>
    );

    return (
        <MobileShell title={open ? '견적 상세' : '견적 내역'} onBack={() => go(open ? '/mypage/estimates' : '/mypage')} brandHeader={false} footer={false} titleAction={open ? undefined : plus}>
            {open
                ? <QuoteDetailPanel compact q={open} onBack={() => go('/mypage/estimates')} />
                : <QuoteListPanel compact quotes={list} loading={!me || quotes.isPending} go={go}
                    onOpen={(q) => (q.source === 'request' ? go(`/mypage/estimates?id=${encodeURIComponent(q.id)}`) : go(q.href))} />}
        </MobileShell>
    );
}
