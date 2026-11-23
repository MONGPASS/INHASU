import React from 'react';
import { IconChevronLeft, IconChevronRight } from './AdminIcons';
import { cx } from './adminUiUtils';
import './admin-components.css';

/**
 * 표: 머리 13px 보조 글자·흰 바탕·아래 1px 선, 줄 14px·좌우 여백 16px, 줄 사이 옅은 선.
 * 줄 끝 행동은 `AdminButton size="sm"`(보조). 휴대폰에서는 `AdminLayout`의 `useCardTables`가 머리글을 칸 이름표로 붙여
 * 한 줄을 카드 한 장으로 바꾼다(머리글이 ‘관리’·‘작업’인 칸은 카드 맨 아래 버튼 줄).
 *
 * 쉬운 쓰임은 `AdminDataTable`(열 정의 + 자료). 칸을 직접 짜야 하면 `AdminTable` + `AdminTr`/`AdminTh`/`AdminTd`.
 */
export interface AdminTableProps {
    /** 표 이름(화면 읽기) */
    label: string;
    className?: string;
    /** 휴대폰에서도 표 그대로 둔다(이유를 디자인 문서 7절에 적는다) */
    cardOff?: boolean;
    children: React.ReactNode;
}

export const AdminTable: React.FC<AdminTableProps> = ({ label, className, cardOff, children }) => (
    // 휴대폰 카드 모양은 admin-components.css의 .adm-ui-table 규칙(옛 .tbl 규칙은 쓰지 않는다). cardOff면 표 그대로.
    <div className={cx('adm-ui-table', className)} data-card-off={cardOff ? '' : undefined}>
        <table aria-label={label} className="adm-ui-table-el" data-card-off={cardOff ? '' : undefined}>{children}</table>
    </div>
);

export const AdminThead: React.FC<{ children: React.ReactNode }> = ({ children }) => <thead className="adm-ui-thead">{children}</thead>;
export const AdminTbody: React.FC<{ children: React.ReactNode }> = ({ children }) => <tbody className="adm-ui-tbody">{children}</tbody>;

export interface AdminTrProps extends React.HTMLAttributes<HTMLTableRowElement> { selected?: boolean }
export const AdminTr: React.FC<AdminTrProps> = ({ selected, className, ...rest }) => (
    <tr {...rest} aria-selected={selected || undefined} className={cx('adm-ui-tr', selected && 'is-selected', className)} />
);

type Align = 'left' | 'center' | 'right';
export interface AdminCellProps extends Omit<React.TdHTMLAttributes<HTMLTableCellElement>, 'align' | 'color'> { align?: Align; nowrap?: boolean }

export const AdminTh: React.FC<AdminCellProps> = ({ align = 'left', nowrap = true, className, ...rest }) => (
    <th {...rest} scope="col" className={cx('adm-ui-th', `is-${align}`, nowrap && 'is-nowrap', className)} />
);
export const AdminTd: React.FC<AdminCellProps> = ({ align = 'left', nowrap, className, ...rest }) => (
    <td {...rest} className={cx('adm-ui-td', `is-${align}`, nowrap && 'is-nowrap', className)} />
);

export interface AdminColumn<T> {
    key: string;
    /** 머리글. 휴대폰 카드의 칸 이름표가 된다. 줄 끝 버튼 칸은 ‘관리’ */
    header: string;
    render: (row: T, index: number) => React.ReactNode;
    align?: Align;
    nowrap?: boolean;
    /** 칸 폭(열 클래스 이름 — CSS에서 정한다). 숫자 폭을 직접 적지 않는다 */
    className?: string;
}

export interface AdminDataTableProps<T> {
    label: string;
    columns: AdminColumn<T>[];
    rows: T[];
    rowKey: (row: T, index: number) => string;
    /** 줄을 누르면(줄 안의 버튼·링크를 누른 경우는 제외) */
    onRowClick?: (row: T) => void;
    isSelected?: (row: T) => boolean;
    /** 자료가 없을 때 표 자리에 보일 것(보통 AdminEmpty) */
    empty?: React.ReactNode;
    cardOff?: boolean;
    className?: string;
}

export function AdminDataTable<T>({ label, columns, rows, rowKey, onRowClick, isSelected, empty, cardOff, className }: AdminDataTableProps<T>) {
    if (!rows.length && empty) return <div className={cx('adm-ui-table', 'is-empty', className)}>{empty}</div>;
    return (
        <AdminTable label={label} cardOff={cardOff} className={className}>
            <AdminThead>
                <AdminTr>{columns.map((col) => <AdminTh key={col.key} align={col.align} className={col.className}>{col.header}</AdminTh>)}</AdminTr>
            </AdminThead>
            <AdminTbody>
                {rows.map((row, index) => (
                    <AdminTr
                        key={rowKey(row, index)}
                        selected={isSelected?.(row)}
                        className={onRowClick ? 'is-clickable' : undefined}
                        onClick={onRowClick ? (event) => { if (!(event.target as Element).closest('button, a, input, label, [role="menuitem"]')) onRowClick(row); } : undefined}
                    >
                        {columns.map((col) => <AdminTd key={col.key} align={col.align} nowrap={col.nowrap} className={col.className}>{col.render(row, index)}</AdminTd>)}
                    </AdminTr>
                ))}
            </AdminTbody>
        </AdminTable>
    );
}

export interface AdminPaginationProps {
    page: number;
    totalPages: number;
    onChange: (page: number) => void;
    /** 왼쪽 글자(예: ‘전체 128건’) */
    summary?: React.ReactNode;
    className?: string;
}

/** 페이지 이동. 표 아래 가운데. 한 쪽뿐이면 그리지 않는다. */
export const AdminPagination: React.FC<AdminPaginationProps> = ({ page, totalPages, onChange, summary, className }) => {
    if (totalPages <= 1 && !summary) return null;
    return (
        <nav className={cx('adm-ui-pagination', className)} aria-label="페이지 이동">
            {summary && <span className="adm-ui-pagination-summary">{summary}</span>}
            {totalPages > 1 && <PageButtons page={page} totalPages={totalPages} onChange={(next) => { if (next && next !== page) onChange(next); }} />}
        </nav>
    );
};

/** 보일 쪽 번호: 처음·끝과 지금 쪽 앞뒤 하나, 사이는 ‘…’ */
export function pageWindow(page: number, totalPages: number): Array<number | 'gap'> {
    const keep = new Set([1, totalPages, page - 1, page, page + 1]);
    if (page <= 3) [2, 3, 4].forEach((n) => keep.add(n));
    if (page >= totalPages - 2) [totalPages - 1, totalPages - 2, totalPages - 3].forEach((n) => keep.add(n));
    const list = [...keep].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
    const out: Array<number | 'gap'> = [];
    list.forEach((n, i) => { if (i && n - list[i - 1] > 1) out.push('gap'); out.push(n); });
    return out;
}

const PageButtons: React.FC<{ page: number; totalPages: number; onChange: (page: number) => void }> = ({ page, totalPages, onChange }) => (
    <div className="adm-ui-pages">
        <button type="button" className="adm-ui-page-btn is-arrow" aria-label="이전 쪽" disabled={page <= 1} onClick={() => onChange(page - 1)}><IconChevronLeft /></button>
        {pageWindow(page, totalPages).map((n, i) => n === 'gap'
            ? <span key={`gap${i}`} className="adm-ui-page-gap" aria-hidden="true">…</span>
            : <button key={n} type="button" className={cx('adm-ui-page-btn', n === page && 'is-current')} aria-current={n === page ? 'page' : undefined} aria-label={`${n}쪽`} onClick={() => onChange(n)}>{n}</button>)}
        <button type="button" className="adm-ui-page-btn is-arrow" aria-label="다음 쪽" disabled={page >= totalPages} onClick={() => onChange(page + 1)}><IconChevronRight /></button>
    </div>
);
