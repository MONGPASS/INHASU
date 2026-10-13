import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useToast } from '../ui/Toast';
import { paymentSummary, readDepositReport, type DepositReport, type ReservationDetail } from '../../utils/reservationDetail';

/** Same limit as the server (POST /api/reservations/:id/deposit-report). */
export const DEPOSITOR_NAME_MAX = 30;

const FALLBACK_ERROR = '입금 신고를 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.';

/**
 * 예약금 '입금 완료' 신고 — PC·모바일 예약 상세가 같이 쓰는 상태와 요청.
 * 계좌이체 후 고객이 입금자명을 알리면 담당자에게 알림이 가고, 담당자가 확인해야 예약이 확정된다.
 * (예약 상태는 여기서 바뀌지 않는다. 신고 내용만 캐시에 반영하고 목록·상세를 다시 불러온다.)
 */
export function useDepositReport(reservation: ReservationDetail) {
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const { pb, depositStage, depositReport } = paymentSummary(reservation);

    const [formOpen, setFormOpen] = useState(false);
    const [name, setName] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    /** Opens the name form: the earlier report's name when correcting, otherwise the booking person's name. */
    const openForm = () => {
        setName(depositReport?.name || reservation.customerName || '');
        setError('');
        setFormOpen(true);
    };

    const closeForm = () => {
        if (sending) return;
        setFormOpen(false);
        setError('');
    };

    const changeName = (value: string) => {
        setName(value);
        if (error) setError('');
    };

    const submit = async () => {
        if (sending) return;
        const depositor = name.replace(/\s+/g, ' ').trim();
        if (!depositor) {
            setError('입금자명을 입력해 주세요.');
            return;
        }
        if (Array.from(depositor).length > DEPOSITOR_NAME_MAX) {
            setError(`입금자명은 ${DEPOSITOR_NAME_MAX}자 이내로 입력해 주세요.`);
            return;
        }

        setSending(true);
        setError('');
        try {
            const result = await api.reservations.reportDeposit(reservation.id, depositor);
            const saved: DepositReport = readDepositReport(result ?? {})
                ?? { status: 'reported', name: depositor, reportedAt: new Date().toISOString() };
            const detailKey = ['myPage', 'reservation', reservation.id];
            queryClient.setQueryData<ReservationDetail>(detailKey, (current) => (
                current ? { ...current, depositReport: saved, deposit_report: saved } : current
            ));
            // The timeline entry and the list badge come from the server.
            void queryClient.invalidateQueries({ queryKey: detailKey });
            void queryClient.invalidateQueries({ queryKey: ['myPage', 'reservations'] });
            setFormOpen(false);
            showToast('success', '입금 완료를 알려 주셔서 감사합니다. 담당자가 확인한 뒤 알려 드리겠습니다.');
        } catch (e) {
            // The endpoint answers in Korean; anything else (network failure …) gets the generic line.
            const message = e instanceof Error ? e.message : '';
            setError(/[가-힣]/.test(message) ? message : FALLBACK_ERROR);
        } finally {
            setSending(false);
        }
    };

    return {
        /** 'unpaid' → 'reported' (담당자 확인 대기) → 'paid' */
        stage: depositStage,
        report: depositReport,
        amount: pb?.deposit ?? 0,
        cancelled: reservation.status === 'cancelled',
        formOpen, name, sending, error,
        openForm, closeForm, changeName, submit,
    };
}
