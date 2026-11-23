import React from "react";

/* docs/content/component/chip-toggle-button/style.mdx */
const chipToggleSizes = {
  small: { height: 32, padding: 12, font: 13, prefix: 14, suffix: 14, gap: 4 },
  medium: { height: 38, padding: 14, font: 14, prefix: 16, suffix: 14, gap: 4 },
};

export function ChipToggleButton({
  size = "medium",
  selected: selectedProp,
  defaultSelected = false,
  onSelectedChange,
  prefixIcon,
  suffixIcon,
  disabled = false,
  children,
  style,
  ...rest
}) {
  const [inner, setInner] = React.useState(defaultSelected);
  const [hover, setHover] = React.useState(false);
  const selected = selectedProp ?? inner;
  const s = chipToggleSizes[size] ?? chipToggleSizes.medium;
  let bg = "transparent", fg = "var(--seed-scale-color-gray-900)", outline = "1px solid var(--seed-semantic-color-divider-2)";
  if (selected) {
    bg = hover ? "var(--seed-scale-color-gray-700)" : "var(--seed-scale-color-gray-800)";
    fg = "var(--seed-scale-color-gray-00)";
    outline = "1px solid transparent";
  } else if (hover) {
    bg = "var(--seed-semantic-color-gray-hover)";
  }
  if (disabled) { bg = "transparent"; fg = "var(--seed-scale-color-gray-400)"; outline = "1px solid var(--seed-semantic-color-divider-2)"; }
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => { setInner(!selected); onSelectedChange?.(!selected); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: s.gap,
        height: s.height,
        padding: `0 ${s.padding}px`,
        border: outline,
        borderRadius: "var(--seed-radius-full)",
        background: bg,
        color: fg,
        fontFamily: "inherit",
        fontSize: s.font,
        cursor: disabled ? "default" : "pointer",
        transition: "background-color 50ms var(--seed-timing-function-standard-easing)",
        ...style,
      }}
      {...rest}
    >
      {prefixIcon ? <span style={{ display: "inline-flex", width: s.prefix, height: s.prefix }}>{prefixIcon}</span> : null}
      <span>{children}</span>
      {suffixIcon ? <span style={{ display: "inline-flex", width: s.suffix, height: s.suffix }}>{suffixIcon}</span> : null}
    </button>
  );
}
