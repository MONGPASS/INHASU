import { QUICK_MENU } from '../mobile/mobileTheme';
import { SD } from '../site-seed/seed';
import { linkTo, useGo } from './homeMobileData';

/**
 * 휴대폰 홈 바로가기 메뉴(디자인 ‘홈 · 휴대폰’ 2026-11-25 2차): 3칸 × 2줄 그림 아이콘.
 * 아이콘·이름·주소는 전체 메뉴 서랍과 같은 QUICK_MENU(mobile/mobileTheme.ts)를 쓰고, 새 소식(isNew)에는 N 표시.
 */
export function QuickNavMobile() {
    const go = useGo();
    return (
        <nav aria-label="바로가기 메뉴" style={{ padding: '24px 20px 4px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', rowGap: 20 }}>
            {QUICK_MENU.map((item) => (
                <a key={item.key} {...linkTo(go, item.path)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 0, color: SD.gray900, textDecoration: 'none' }}>
                    <span style={{ position: 'relative', width: 60, height: 60, borderRadius: 18, background: SD.gray50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={item.icon} alt="" width={42} height={42} style={{ width: 42, height: 42, display: 'block', objectFit: 'contain' }} />
                        {item.isNew && (
                            <span aria-label="새 소식" style={{ position: 'absolute', right: -6, top: -6, width: 22, height: 22, boxSizing: 'border-box', borderRadius: 9999, background: SD.mint700, color: SD.white,
                                fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${SD.white}` }}>N</span>
                        )}
                    </span>
                    <span style={{ maxWidth: '100%', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                </a>
            ))}
        </nav>
    );
}
