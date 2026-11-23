import React from "react";

/* docs/content/component/box-toggle-button/style.mdx — same geometry as BoxButton
   minus xlarge; colour flips to a neutral "selected" state. */
const boxToggleSizes = {
  xsmall: { height: 32, minWidth: 40, padding: 10, radius: 4, font: 11, prefix: 12, suffix: 12, gap: 2 },
  small: { height: 36, minWidth: 54, padding: 14, radius: 4, font: 14, prefix: 16, suffix: 14, gap: 4 },
  medium: { height: 40, minWidth: 58, padding: 16, radius: 6, font: 14, prefix: 16, suffix: 14, gap: 4 },
  large: { height: 48, minWidth: 66, padding: 20, radius: 6, font: 14, prefix: 16, suffix: 16, gap: 4 },
};

const boxToggleVariants = {
  primary: {
    off: { bg: "var(--seed-semantic-color-primary)", fg: "var(--seed-semantic-color-on-primary)", hover: "var(--seed-semantic-color-primary-hover)" },
    on: { bg: "var(--seed-semantic-color-secondary-low)", fg: "var(--seed-scale-color-gray-900)", hover: "var(--seed-scale-color-gray-200)" },
  },
  "primary-low": {
    off: { bg: "var(--seed-semantic-color-primary-low)", fg: "var(--seed-semantic-color-primary)", hover: "var(--seed-semantic-color-primary-low-hover)" },
    on: { bg: "var(--seed-semantic-color-secondary-low)", fg: "var(--seed-scale-color-gray-900)", hover: "var(--seed-scale-color-gray-200)" },
  },
  secondary: {
    off: { bg: "var(--seed-scale-color-gray-100)", fg: "var(--seed-scale-color-gray-900)", hover: "var(--seed-scale-color-gray-300)" },
    on: { bg: "var(--seed-semantic-color-primary-low)", fg: "var(--seed-semantic-color-primary)", hover: "var(--seed-semantic-color-primary-low-hover)" },
  },
};

export function BoxToggleButton({
  size = "medium",
  variant = "secondary",
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
  const [pressed, setPressed] = React.useState(false);
  const selected = selectedProp ?? inner;
  const s = boxToggleSizes[size] ?? boxToggleSizes.medium;
  const v = (boxToggleVariants[variant] ?? boxToggleVariants.secondary)[selected ? "on" : "off"];
  const bg = disabled ? "var(--seed-scale-color-gray-300)" : hover || pressed ? v.hover : v.bg;
  const fg = disabled ? "var(--seed-scale-color-gray-500)" : v.fg;
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => { setInner(!selected); onSelectedChange?.(!selected); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: s.gap,
        height: s.height,
        minWidth: s.minWidth,
        padding: `0 ${s.padding}px`,
        border: "none",
        borderRadius: s.radius,
        background: bg,
        color: fg,
        fontFamily: "inherit",
        fontSize: s.font,
        fontWeight: "bold",
        cursor: disabled ? "default" : "pointer",
        transform: pressed && !disabled ? "scale(var(--seed-press-scale))" : "scale(1)",
        transition: "transform var(--seed-duration-press) var(--seed-timing-function-standard-easing), background-color 50ms var(--seed-timing-function-standard-easing) 50ms",
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
