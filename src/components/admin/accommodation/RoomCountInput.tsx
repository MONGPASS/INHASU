import { MAX_ROOMS_PER_NIGHT } from '../../../utils/reservationAssignment';

interface Props {
    'aria-label': string;
    value?: number | null;
    onChange: (count: number | null) => void;
    className?: string;
    disabled?: boolean;
}

export function RoomCountInput({ value, onChange, ...props }: Props) {
    return <input {...props} type="number" inputMode="numeric" min={1} max={MAX_ROOMS_PER_NIGHT} step={1}
        placeholder="1~10" value={value ?? ''} onChange={event => {
            const input = event.currentTarget;
            if (input.reportValidity()) onChange(input.value === '' ? null : input.valueAsNumber);
        }} />;
}
