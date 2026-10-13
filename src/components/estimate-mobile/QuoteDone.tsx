import { QuoteDoneBody } from '../estimate-desktop/QuoteDoneBody';
import type { QuoteDoneState } from '../estimate-desktop/quoteLinks';

/**
 * Mobile "request sent" screen (Claude Design: M Quote Done) shown on /estimate-complete:
 * 접수 확인, 내 견적 전용 링크(확인하기·복사), 카카오 알림톡 안내, 카카오톡 채널 상담, 투어 상품 둘러보기.
 * 본문은 PC 완료 화면과 같은 QuoteDoneBody를 모바일 크기로 쓴다.
 */
export function QuoteDoneSummary({ done, go }: { done: QuoteDoneState; go: (path: string) => void }) {
    return (
        <div style={{ padding: '28px 18px 0', display: 'flex', flexDirection: 'column', gap: 22 }}>
            <QuoteDoneBody done={done} go={go} compact />
        </div>
    );
}
