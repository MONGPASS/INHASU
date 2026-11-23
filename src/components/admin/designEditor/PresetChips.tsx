import type { DesignPreset } from '../../product/designTemplates/types';
import { AdminChip } from '../ui/AdminChoice';
import './design-editor.css';

/**
 * 프리셋을 { label, value }로 정규화.
 * 버튼에는 관리자가 알아보기 쉬운 label을, 실제 입력값에는 value(고객 페이지에 표시되는 문구)를 쓴다.
 */
export function normPresets(presets: DesignPreset[]): { label: string; value: string }[] {
    return presets.map(p => (typeof p === 'string' ? { label: p, value: p } : p));
}

/**
 * 자주 쓰는 값 버튼 — 누르면 입력칸이 그 값으로 채워진다.
 * (직접 입력도 그대로 가능. 목록에 없는 값은 타이핑하면 된다)
 */
export function PresetChips({ presets, value, onPick }: { presets: DesignPreset[]; value: string; onPick: (v: string) => void }) {
    const items = normPresets(presets);
    const translated = items.some(p => p.label !== p.value);
    return (
        <>
            <div className="de-presets">
                {items.map(p => (
                    <AdminChip key={p.value} className="de-preset-chip" active={value === p.value} onClick={() => onPick(p.value)}
                        title={p.label === p.value ? `"${p.value}"(으)로 채우기` : `페이지에는 "${p.value}"로 표시됩니다`}>
                        {p.label}
                    </AdminChip>
                ))}
            </div>
            {translated && <div className="de-note-sm">버튼 이름과 페이지에 표시되는 문구가 다를 수 있습니다 (버튼에 마우스를 올리면 확인)</div>}
        </>
    );
}

/**
 * 자주 쓰는 줄 버튼 — 누르면 그 줄이 추가되고, 다시 누르면 빠진다.
 * 순서는 프리셋 목록 순서를 따르고, 직접 입력한 줄은 뒤에 남는다.
 */
export function PresetLineChips({ presetLines, value, onChange, separator = '\n' }: { presetLines: DesignPreset[]; value: string; onChange: (v: string) => void; separator?: string }) {
    const items = normPresets(presetLines);
    const known = items.map(p => p.value);
    const lines = value.split(separator).map(s => s.trim()).filter(Boolean);
    const translated = items.some(p => p.label !== p.value);
    const toggle = (line: string) => {
        const next = lines.includes(line) ? lines.filter(l => l !== line) : [...lines, line];
        // 프리셋에 있는 항목은 목록 순서대로, 직접 입력한 항목은 그 뒤에
        onChange([...known.filter(k => next.includes(k)), ...next.filter(l => !known.includes(l))].join(separator));
    };
    return (
        <>
            <div className="de-presets">
                {items.map(p => {
                    const on = lines.includes(p.value);
                    return <AdminChip key={p.value} className="de-preset-chip" active={on} onClick={() => toggle(p.value)} title={`${on ? '빼기' : '추가'} — 페이지 표시: ${p.value}`}>{on ? '✓ ' : '+ '}{p.label}</AdminChip>;
                })}
            </div>
            {translated && <div className="de-note-sm">버튼 이름과 페이지에 표시되는 문구가 다를 수 있습니다 (버튼에 마우스를 올리면 확인)</div>}
        </>
    );
}
