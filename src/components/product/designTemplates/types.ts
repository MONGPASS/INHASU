import type React from 'react';
import type { DesignSectionInstance } from '../../../types/product';

/**
 * 디자인 템플릿 — 코드로 내장된 상세페이지 디자인.
 *
 * Claude Design 등에서 만든 고정폭(캔버스) 디자인을 React 컴포넌트로 이식하고,
 * 편집 가능한 지점(텍스트/이미지)을 매니페스트로 선언한다.
 * 관리자 페이지는 매니페스트를 읽어 자동으로 폼을 생성하고,
 * 입력값은 상품 detailBlocks 안의 design 블록(content.values)에 저장된다.
 */
export type DesignFieldType = 'text' | 'textarea' | 'image' | 'map-stops' | 'spot-cards';

export interface DesignTemplateField {
    key: string;
    /** 관리자 폼에 표시되는 라벨 */
    label: string;
    type: DesignFieldType;
    /** 관리자 폼에서 묶어 보여줄 섹션 이름 */
    section: string;
    /** 값이 비어있을 때 사용할 기본값 (텍스트 전용; 이미지 기본값은 빈 슬롯) */
    default?: string;
    /**
     * 모든 일차 카드가 함께 쓰는 값 (일수, DAY 탭 목록 등).
     * 복제된 섹션에서도 접미사 없이 같은 값을 읽고 쓴다.
     */
    shared?: boolean;
    /** 입력 형식 안내 (선택) */
    help?: string;
    /**
     * 자주 쓰는 값 — 관리자 폼에 버튼으로 표시되고, 누르면 그 값으로 채워진다.
     * text 필드용(하나만 선택). 목록에 없는 값은 직접 입력하면 된다.
     */
    presets?: DesignPreset[];
    /**
     * 자주 쓰는 항목 — 여러 개 선택.
     * 버튼을 누르면 추가되고, 다시 누르면 빠진다.
     * 기본은 줄바꿈으로 이어붙이며, presetSeparator를 주면 그 문자로 이어붙인다
     * (예: 한 줄에 「승마 체험, 샌드보드 체험」처럼 나열하는 항목).
     */
    presetLines?: DesignPreset[];
    /** presetLines를 이어붙일 구분자 (기본: 줄바꿈) */
    presetSeparator?: string;
}

/**
 * 프리셋 항목.
 * 문자열이면 버튼 라벨과 입력값이 같고,
 * { label, value }면 버튼은 label(관리자용 한국어)로 보이되 실제로 들어가는 값은
 * value(고객에게 보이는 문구)가 된다.
 */
export type DesignPreset = string | { label: string; value: string };

export interface DesignTemplateValues {
    /** field key → 관리자가 입력한 값(텍스트 또는 이미지 URL) */
    [key: string]: string;
}

export interface DesignTemplateProps {
    /** field key로 최종 값(입력값 ?? default ?? '')을 돌려주는 getter */
    v: (key: string) => string;
    /** true면 빈 이미지 슬롯에 안내 placeholder를 표시(관리자 미리보기용) */
    editing?: boolean;
    /**
     * 표시할 섹션 인스턴스 목록. 없으면 템플릿 기본 섹션 전체를 한 번씩 표시.
     * 복제본은 같은 섹션을 접미사 붙은 key로 다시 렌더링한다.
     */
    instances?: DesignSectionInstance[];
}

/** 템플릿이 가진 섹션 정의 — 관리자에서 복제/삭제하는 단위 */
export interface DesignSectionDef {
    /** 섹션 id (관리자 목록에 그대로 표시된다) */
    id: string;
    /** 이 섹션이 포함하는 매니페스트 필드 section 이름들 */
    fieldSections: string[];
    /** false면 복제 버튼을 숨긴다 (한 번만 있어야 자연스러운 섹션) */
    repeatable?: boolean;
}

export interface DesignTemplateDef {
    id: string;
    /** 관리자에게 표시되는 템플릿 이름 */
    name: string;
    /** 디자인 원본 캔버스 폭(px). 화면에서는 컨테이너 폭에 맞춰 축소된다 */
    canvasWidth: number;
    fields: DesignTemplateField[];
    /**
     * 이 섹션(def id)까지 렌더한 뒤 상품 일정탭의 일정표를 삽입한다.
     * 상세페이지가 itinerarySlot을 넘겨줄 때만 적용된다.
     */
    itineraryAfter?: string;
    /** 관리자에서 복제·삭제할 수 있는 섹션 목록 (표시 순서) */
    sectionDefs: DesignSectionDef[];
    Component: React.ComponentType<DesignTemplateProps>;
    /**
     * 모바일 전용 디자인(별도 캔버스). 있으면 모바일 상세페이지는 이쪽을 렌더링한다.
     * 필드 매니페스트는 데스크톱과 공유한다 — 같은 key, 같은 입력값.
     */
    mobile?: {
        canvasWidth: number;
        Component: React.ComponentType<DesignTemplateProps>;
    };
}
