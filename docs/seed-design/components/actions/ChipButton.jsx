import React from "react";

/* docs/content/component/chip-button/style.mdx */
const chipButtonSizes = {
  small: { height: 32, padding: 12, font: 13, prefix: 14, suffix: 14, gap: 4 },
  medium: { height: 38, padding: 14, font: 14, prefix: 16, suffix: 14, gap: 4 },
};

export function ChipButton({ size = "medium", count, prefixIcon, suffixIcon, disabled = false, children, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  const s = chipButtonSizes[size] ?? chipButtonSizes.medium;
  const fg = disabled ? "var(--seed-scale-color-gray-400)" : "var(--seed-scale-color-gray-900)";
  const countFg = disabled
    ? "var(--seed-scale-color-gray-400)"
    : hover || pressed
    ? "#067661"
    : "#079475";
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: s.gap,
        height: s.height,
        padding: `0 ${s.padding}px`,
        borderRadius: "var(--seed-radius-full)",
        border: "1px solid var(--seed-semantic-color-divider-2)",
        background: pressed
          ? "#D2F9E9"
          : hover
          ? "#ECFDF7"
          : "transparent",
        color: fg,
        fontFamily: "inherit",
        fontSize: s.font,
        fontWeight: "normal",
        lineHeight: "135%",
        cursor: disabled ? "default" : "pointer",
        transition: "background-color var(--seed-duration-press) var(--seed-timing-function-standard-easing)",
        ...style,
      }}
      {...rest}
    >
      {prefixIcon ? <span style={{ display: "inline-flex", width: s.prefix, height: s.prefix }}>{prefixIcon}</span> : null}
      <span>{children}</span>
      {count != null ? <span style={{ color: countFg }}>{count}</span> : null}
      {suffixIcon ? <span style={{ display: "inline-flex", width: s.suffix, height: s.suffix }}>{suffixIcon}</span> : null}
    </button>
  );
}
