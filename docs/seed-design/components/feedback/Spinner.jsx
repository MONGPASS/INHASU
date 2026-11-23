import React from "react";

/* docs/content/component/spinner/style.mdx — 24pt small, 40pt medium; the
   indicator sweeps a 1200ms rotation with an 800ms head / 900ms tail. */
const spinnerVariants = {
  gray: { indicator: "var(--seed-scale-color-gray-400)", track: "var(--seed-scale-color-gray-alpha-50)" },
  white: { indicator: "var(--seed-static-color-static-white)", track: "var(--seed-static-color-static-white-alpha-200)" },
  primary: { indicator: "var(--seed-semantic-color-primary)", track: "var(--seed-semantic-color-primary-low)" },
};

export function Spinner({ size = "medium", variant = "gray", style, ...rest }) {
  const box = size === "small" ? 24 : 40;
  const v = spinnerVariants[variant] ?? spinnerVariants.gray;
  const stroke = size === "small" ? 3 : 4;
  const r = (box - stroke) / 2;
  const c = 2 * Math.PI * r;
  const id = React.useId ? React.useId() : "seed-spinner";
  return (
    <span role="progressbar" style={{ display: "inline-flex", width: box, height: box, ...style }} {...rest}>
      <style>{`@keyframes seed-spin{to{transform:rotate(360deg)}}@keyframes seed-spin-dash{0%{stroke-dashoffset:${c * 0.99}}50%{stroke-dashoffset:${c * 0.25}}100%{stroke-dashoffset:${c * 0.99}}}`}</style>
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} style={{ animation: "seed-spin 1200ms cubic-bezier(0.35,0.25,0.65,0.75) infinite" }}>
        <circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke={v.track} strokeWidth={stroke} />
        <circle
          key={id}
          cx={box / 2}
          cy={box / 2}
          r={r}
          fill="none"
          stroke={v.indicator}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          style={{ animation: "seed-spin-dash 1200ms cubic-bezier(0.35,0,0.65,1) infinite" }}
        />
      </svg>
    </span>
  );
}
