import React from "react";

/* docs/content/component/slider/style.mdx — track 6pt, handle 28pt, min width 240pt. */
export function Slider({ min = 0, max = 100, step = 1, value: valueProp, defaultValue = 0, onValueChange, label, output, disabled = false, style, ...rest }) {
  const [inner, setInner] = React.useState(defaultValue);
  const [active, setActive] = React.useState(false);
  const value = valueProp ?? inner;
  const pct = ((value - min) / (max - min)) * 100;
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
        <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: 6, borderRadius: "var(--seed-radius-full)", background: disabled ? "var(--seed-scale-color-gray-400)" : "var(--seed-semantic-color-primary)" }} />
        <div
          style={{
            position: "absolute",
            left: `calc(${pct}% - 14px)`,
            width: 28,
            height: 28,
            borderRadius: "var(--seed-radius-full)",
            background: "var(--seed-static-color-static-white)",
            boxShadow: active ? "0 0 0 5px rgba(0,0,0,0.22)" : "0 4px 6px 0 rgba(0,0,0,0.15)",
            transition: "box-shadow 120ms var(--seed-timing-function-standard-entrance)",
            pointerEvents: "none",
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onMouseDown={() => setActive(true)}
          onMouseUp={() => setActive(false)}
          onFocus={() => setActive(true)}
          onBlur={() => setActive(false)}
          onChange={(e) => { const v = Number(e.target.value); setInner(v); onValueChange?.(v); }}
          style={{ position: "relative", width: "100%", opacity: 0, height: 28, margin: 0, cursor: disabled ? "default" : "pointer" }}
        />
      </div>
    </div>
  );
}
