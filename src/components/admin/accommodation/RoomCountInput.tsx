import type React from 'react';
import { MAX_ROOMS_PER_NIGHT } from '../../../utils/reservationAssignment';
import { AdminTextInput } from '../ui';

interface Props {
    'aria-label': string;
    value?: number | null;
    onChange: (count: number | null) => void;
    /** 우리 입력 칸(AdminTextInput)의 바깥 칸에 붙는다 */
    className?: string;
    disabled?: boolean;
    /** 칸 뒤 단위(예: 개) */
    trailing?: React.ReactNode;
}

/** 방 수(1~10) 숫자 칸 — 범위를 벗어나면 브라우저 안내를 띄우고 값을 바꾸지 않는다 */
export function RoomCountInput({ value, onChange, ...props }: Props) {
    return <AdminTextInput {...props} type="number" inputMode="numeric" min={1} max={MAX_ROOMS_PER_NIGHT} step={1}
        placeholder="1~10" value={value ?? ''} onChange={event => {
            const input = event.currentTarget;
            if (input.reportValidity()) onChange(input.value === '' ? null : input.valueAsNumber);
        }} />;
}
