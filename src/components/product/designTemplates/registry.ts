import type { DesignTemplateDef } from './types';
import { horseTrekFields, horseTrekSectionDefs } from './horseTrekFields';
import HorseTrekTemplate from './HorseTrekTemplate';
import HorseTrekMobileTemplate from './HorseTrekMobileTemplate';

/**
 * 사용 가능한 디자인 템플릿 목록.
 * 새 디자인을 추가할 때: 템플릿 컴포넌트 + 필드 매니페스트를 만들고 여기에 등록한다.
 */
export const designTemplates: DesignTemplateDef[] = [
    {
        id: 'horse-trek',
        name: '몽골 승마 트레킹 상세페이지',
        canvasWidth: 860,
        fields: horseTrekFields,
        sectionDefs: horseTrekSectionDefs,
        // 이 섹션까지 렌더한 뒤 상품 일정탭의 일정표를 끼워 넣고, 나머지 섹션으로 이어간다
        itineraryAfter: '12 공항 도착',
        // 상품 상세의 위 메뉴(투어 소개·일정·포함 사항·후기·유의 사항·FAQ)에 맞춰 아래쪽 섹션을 나눠 보여 준다(2026-11-26 오너 결정).
        pageParts: { '17 포함/불포함': 'included', '18 투어 가격': 'hidden', '19 예약 전 확인사항': 'notice', '20 FAQ': 'faq' },
        // 예약 전 확인사항(유의사항)은 모든 상품 공통 — 사이트 공통값이 상품 값보다 먼저(상품 수정 ‘유의사항’ 탭에서 공통 저장)
        sharedSections: ['19 예약 전 확인사항'],
        Component: HorseTrekTemplate,
        mobile: {
            canvasWidth: 430,
            Component: HorseTrekMobileTemplate,
        },
    },
];

export function getDesignTemplate(id: string): DesignTemplateDef | undefined {
    return designTemplates.find(t => t.id === id);
}
