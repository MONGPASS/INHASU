import type { V7MenuItem } from './v7Ui';
import { guideOverlaps, overlapLabel } from '../../../utils/assignmentAvailability';
import { adminConfirm } from '../ui/adminFeedback';

interface PickableGuide { id: string; name: string }

/**
 * 가이드 선택 메뉴: 이 일정에 비어 있는 가이드를 먼저, 같은 날 교대만 있는 가이드를 다음에,
 * 같은 날짜에 다른 예약이 있는 가이드를 맨 아래에 보여 준다. 겹치는 가이드는 이유를 적고 고를 때 한 번 더 확인한다.
 * pick의 두 번째 값은 관리자가 겹침을 이미 확인했는지 — 그때는 서버 중복 확인을 다시 묻지 않는다.
 */
export function guideMenuItems<G extends PickableGuide>(guides: G[], bookings: any[], current: { id: string; source: string; startDate?: string; endDate?: string },
    selectedName: string | undefined, pick: (guide: G, confirmedOverlap: boolean) => void): V7MenuItem[] {
    return guides.map(guide => {
        const found = guideOverlaps(bookings, guide, current);
        const overlap = found.find(item => item.kind === 'overlap'), handover = found.find(item => item.kind === 'handover');
        return { guide, overlap, handover, rank: overlap ? 2 : handover ? 1 : 0 };
    }).sort((a, b) => a.rank - b.rank || a.guide.name.localeCompare(b.guide.name, 'ko-KR')).map(({ guide, overlap, handover }) => ({
        key: guide.id, label: guide.name, on: !!selectedName && selectedName === guide.name,
        sub: overlap ? `일정 겹침 · ${overlapLabel(overlap.booking)}` : handover ? `같은 날 교대 · ${overlapLabel(handover.booking)}` : '이 일정에 배정 가능',
        subTone: overlap ? 'warn' as const : handover ? 'muted' as const : 'ok' as const,
        onPick: async () => {
            if (overlap && !await adminConfirm(`${guide.name} 가이드는 같은 기간에 ${overlapLabel(overlap.booking)} 일정이 있습니다. 그래도 배정할까요?`)) return;
            pick(guide, !!overlap);
        },
    }));
}

/** 서버가 중복으로 거절했을 때(다른 화면에서 방금 배정한 경우 등) 확인 후 다시 저장할지 묻는다. */
export const confirmGuideConflict = async (error: any) => error?.code === 'guide_conflict' && typeof window !== 'undefined'
    && await adminConfirm(`${error.message || '같은 기간에 다른 예약이 있는 가이드입니다.'}\n그래도 배정할까요?`);
