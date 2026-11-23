import React from "react";

/* docs/content/component/range-slider — same parts as Slider with two handles. */
export function RangeSlider({ min = 0, max = 100, step = 1, value: valueProp, defaultValue = [20, 80], onValueChange, label, output, disabled = false, style, ...rest }) {
  const [inner, setInner] = React.useState(defaultValue);
  const value = valueProp ?? inner;
  const [lo, hi] = value;
  const pct = (v) => ((v - min) / (max - min)) * 100;
  const update = (next) => { setInner(next); onValueChange?.(next); };
  const handle = (left) => ({
    position: "absolute",
    left: `calc(${left}% - 14px)`,
    width: 28,
    height: 28,
    borderRadius: "var(--seed-radius-full)",
    background: "var(--seed-static-color-static-white)",
    boxShadow: "0 4px 6px 0 rgba(0,0,0,0.15)",
    pointerEvents: "none",
  });
  const input = {
    position: "absolute",
    left: 0,
    width: "100%",
    height: 28,
    margin: 0,
    opacity: 0,
    cursor: disabled ? "default" : "pointer",
  };
  return (
    <div style={{ minWidth: 240, ...style }} {...rest}>
      {(label || output != null) ? (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          {label ? <span style={{ fontSize: 14, fontWeight: "bold", color: "var(--seed-scale-color-gray-900)" }}>{label}</span> : null}
          {output != null ? <span style={{ fontSize: 14, color: disabled ? "var(--seed-scale-color-gray-400)" : "var(--seed-scale-color-gray-900)" }}>{output}</span> : null}
        </div>
      ) : null}
      <div style={{ position: "relative", height: 28, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 6, borderRadius: "var(--seed-radius-full)", background: "var(--seed-scale-color-gray-200)" }} />
        <div style={{ position: "absolute", left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%`, height: 6, borderRadius: "var(--seed-radius-full)", background: disabled ? "var(--seed-scale-color-gray-400)" : "var(--seed-semantic-color-primary)" }} />
        <div style={handle(pct(lo))} />
        <div style={handle(pct(hi))} />
        <input type="range" min={min} max={max} step={step} value={lo} disabled={disabled} onChange={(e) => update([Math.min(Number(e.target.value), hi), hi])} style={input} />
        <input type="range" min={min} max={max} step={step} value={hi} disabled={disabled} onChange={(e) => update([lo, Math.max(Number(e.target.value), lo)])} style={input} />
      </div>
    </div>
  );
}
