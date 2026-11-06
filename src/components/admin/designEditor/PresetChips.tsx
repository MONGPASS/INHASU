import type { DesignPreset } from '../../product/designTemplates/types';

/**
 * 프리셋을 { label, value }로 정규화.
 * 버튼에는 관리자가 알아보기 쉬운 label을, 실제 입력값에는 value(고객 페이지에 표시되는 문구)를 쓴다.
 */
export function normPresets(presets: DesignPreset[]): { label: string; value: string }[] {
    return presets.map(p => (typeof p === 'string' ? { label: p, value: p } : p));
}

const chipStyle = (on: boolean): React.CSSProperties => ({
    padding: '2px 8px', borderRadius: 500, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: '1px solid',
    ...(on ? { borderColor: '#06C4A0', background: 'rgba(6,196,160,0.12)', color: '#029F85' } : { borderColor: 'var(--border-default)', background: 'transparent', color: 'var(--text-muted)' }),
});

/**
 * 자주 쓰는 값 버튼 — 누르면 입력칸이 그 값으로 채워진다.
 * (직접 입력도 그대로 가능. 목록에 없는 값은 타이핑하면 된다)
 */
export function PresetChips({ presets, value, onPick }: { presets: DesignPreset[]; value: string; onPick: (v: string) => void }) {
    const items = normPresets(presets);
    const translated = items.some(p => p.label !== p.value);
    return (
        <>
            <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginBottom: 5 }}>
                {items.map(p => (
                    <button key={p.value} type="button" onClick={() => onPick(p.value)} style={chipStyle(value === p.value)}
                        title={p.label === p.value ? `"${p.value}"(으)로 채우기` : `페이지에는 "${p.value}"로 표시됩니다`}>
                        {p.label}
                    </button>
                ))}
            </div>
            {translated && <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>버튼 이름과 페이지에 표시되는 문구가 다를 수 있습니다 (버튼에 마우스를 올리면 확인)</div>}
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
            <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginBottom: 5 }}>
                {items.map(p => {
                    const on = lines.includes(p.value);
                    return <button key={p.value} type="button" onClick={() => toggle(p.value)} style={chipStyle(on)} title={`${on ? '빼기' : '추가'} — 페이지 표시: ${p.value}`}>{on ? '✓ ' : '+ '}{p.label}</button>;
                })}
            </div>
            {translated && <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>버튼 이름과 페이지에 표시되는 문구가 다를 수 있습니다 (버튼에 마우스를 올리면 확인)</div>}
        </>
    );
}
