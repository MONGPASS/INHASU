/**
 * 관리자 공통 부품(우리 부품). 관리자 화면은 이 폴더의 부품만 쓰고 `@montage-ui/core`를 직접 import하지 않는다
 * (tests/admin-ui-boundary.test.mjs). Montage를 바꾸거나 갈아탈 때는 이 폴더만 고친다.
 * 규격: docs/admin-design-system.md 3절(부품)·4절(화면 틀). 미리보기: /admin/__ui
 */
export { AdminButton, AdminIconButton, AdminTextButton, AdminFileButton } from './AdminButton';
export type { AdminButtonProps, AdminButtonVariant, AdminIconButtonProps, AdminTextButtonProps, AdminFileButtonProps } from './AdminButton';
export { AdminField, AdminTextInput, AdminTextArea, AdminSelect, AdminCheckbox, AdminSwitch, AdminSearch } from './AdminFields';
export type { AdminFieldProps, AdminTextInputProps, AdminTextAreaProps, AdminSelectProps, AdminSelectOption, AdminCheckboxProps, AdminSwitchProps, AdminSearchProps } from './AdminFields';
export { AdminTable, AdminThead, AdminTbody, AdminTr, AdminTh, AdminTd, AdminDataTable, AdminPagination } from './AdminTable';
export type { AdminColumn, AdminDataTableProps, AdminPaginationProps } from './AdminTable';
export { AdminBadge, AdminChip, AdminChipGroup, AdminSegmented, AdminTabs } from './AdminChoice';
export type { AdminTone, AdminTagTone, AdminBadgeProps, AdminChipProps, AdminChoiceItem, AdminTabItem } from './AdminChoice';
export { AdminCard, AdminStat, AdminStatRow, AdminMessage, AdminLoading, AdminEmpty, AdminError } from './AdminSurface';
export type { AdminCardProps, AdminStatProps, AdminMessageProps, AdminEmptyProps, AdminErrorProps } from './AdminSurface';
export { AdminDialog } from './AdminDialog';
export { AdminMenu } from './AdminMenu';
export type { AdminMenuItem, AdminMenuProps } from './AdminMenu';
export type { AdminDialogProps } from './AdminDialog';
// 화면 틀 4종(ListPage·FormPage·DetailPage·DashboardPage와 AdminFilterBar·AdminFormSection·AdminDetailHeader·AdminSteps·AdminGrid)은
// AdminLayout(→ 모든 관리자 화면 미리 읽기)을 끌어오므로 여기서 내보내지 않는다. 화면 파일은 './ui/AdminPage'에서 직접 가져온다.
export { adminNotify, adminConfirm } from './adminFeedback';
export { adminValidateRequired } from './adminForm';
export { adminConfirmLeave } from './adminLeaveConfirm';
export { cx, useAdminNarrow } from './adminUiUtils';
export type { AdminSize } from './adminUiUtils';
