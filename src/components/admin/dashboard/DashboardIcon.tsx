import { SEED_FOR_LUCIDE } from '../ui/legacyIconNames';

/**
 * 예전 이름(`lc-…`)으로 부르는 관리자 아이콘. 2026-11-24부터 Lucide 선 대신 당근 Seed 아이콘을 그린다
 * (이름 → 모양 표는 ui/legacyIconNames.ts). 새 코드는 이 부품 대신 `Icon*`(components/admin/ui)를 바로 쓴다.
 * 키의 `lc-`는 scripts/check-icon-subset.mjs가 Material 이름으로 읽지 않게 하려는 것이다.
 */
export type DashboardIconName = keyof typeof SEED_FOR_LUCIDE;

export function DashboardIcon({ name, size = 16, color = 'currentColor' }: {
    name: DashboardIconName; size?: number; color?: string;
    /** 예전 Lucide 선 두께. Seed 아이콘은 채움 모양이라 쓰지 않는다(부르는 쪽 호환용) */
    strokeWidth?: number;
}) {
    const Glyph = SEED_FOR_LUCIDE[name];
    // 색은 CSS color로 넘겨 var(--adm-*) 값도 쓸 수 있게 한다.
    return <Glyph width={size} height={size} focusable="false"
        style={{ flex: 'none', display: 'block', ...(color === 'currentColor' ? {} : { color }) }} />;
}
