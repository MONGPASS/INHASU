import { type ReactNode } from 'react';
import { ReservationDetailV7, type ReservationDetailV7Links } from './v7/ReservationDetailV7';
import './CustomerWorkspaceOverview.css';

export interface CustomerWorkspaceOverviewModel {
    customerName: string; sourceLabel: string; bookingNumber?: string; statusLabel: string;
    /** Breadcrumb label of the list this workspace returns to. */
    backLabel?: string;
    bookedProduct?: { name: string; href?: string; image?: string };
    /** 없으면 표시하지 않는다. tier가 null이면 패키지를 확인할 수 없는 예약이다. */
    packageInfo?: { tier: 'full' | 'value' | null; detail?: string };
    /** 상품과 연결되지 않은 맞춤 견적의 희망 여행지. */
    placeLabel?: string;
    documentLabel?: string;
    /** 'documents': 예약 전 문의처럼 알림 패널 대신 문서 화면을 연다. 기본은 고객 알림 패널(디자인 v3). */
    documentAction?: 'notices' | 'documents';
    disabledActions?: string[];
    disabledActionReason?: string;
    workLabels?: Record<string, string>;
    period: string; partyLabel: string;
    facts: Array<{ label: string; value: string }>;
    preferences?: string[];
    flights?: Array<{ id: string; label: string; date?: string; time?: string; flight?: string; extra?: Array<{ label: string; value: string }> }>;
    travelers?: { expected: number | null; registered: number; people: Array<{ id: string; name: string; details: Array<{ label: string; value: string }> }>; status?: string };
    agreement?: { label: string; at?: string; name?: string };
    notes: Array<{ id: string; body: string; at?: string; author?: string }>;
    recentHistory?: Array<{ id: string; at: string; title: string; detail?: string; kind: 'inquiry' | 'quote' | 'booking' | 'payment' | 'contract' | 'customer' | 'assignment' | 'document' | 'memo' | 'change'; internal?: boolean }>;
    currentStage?: { label: string; detail?: string; tone: 'active' | 'waiting' | 'complete' | 'cancelled' };
    days: Array<{ id: string; day: number; title: string; date?: string; summary?: string; image?: string; region?: string;
        activities?: Array<{ time?: string; title: string; description?: string }>; stay?: string; stayAssigned?: boolean; stayRequired?: boolean; meals?: string; travel?: string }>;
    documents: Array<{ id: string; label: string; detail?: string; status?: string; action?: string; disabled?: boolean }>;
    payment: { total: number | null; deposit: number | null; balance: number | null; depositPaid: boolean | null; balancePaid: boolean | null };
    assignments: Array<{ id: 'guide' | 'vehicle' | 'stay'; label: string; value: string; detail?: string; statusLabel: string; state: 'ready' | 'pending' | 'unknown' }>;
    steps: Array<{ id: string; label: string; done: boolean; current?: boolean }>;
    tasks: Array<{ id: string; label: string; action: string; detail?: string; actionLabel?: string; waiting?: boolean }>;
    customerLinkAvailable?: boolean; canSendItinerary?: boolean;
}

/** 고객 예약 상세 — 예약 관리 v7 디자인. links가 있으면 결제·배정·운영 값을 이 화면에서 바로 저장한다. */
export function CustomerWorkspaceOverview({ model, onAction, busy = false, noteComposer, bookingSelector, assignmentEditor, notificationActions, links }: {
    model: CustomerWorkspaceOverviewModel; onAction: (action: string, id?: string) => void;
    busy?: boolean; noteComposer?: ReactNode; bookingSelector?: ReactNode; assignmentEditor?: ReactNode; notificationActions?: ReactNode; directAssignments?: boolean;
    links?: ReservationDetailV7Links;
}) {
    return <ReservationDetailV7 model={model} onAction={onAction} busy={busy} noteComposer={noteComposer} bookingSelector={bookingSelector}
        assignmentEditor={assignmentEditor} notificationActions={notificationActions} links={links} />;
}
