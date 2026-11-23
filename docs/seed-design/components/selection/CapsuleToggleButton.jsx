import React from "react";

/* docs/content/component/capsule-toggle-button/style.mdx */
const capsuleSizes = {
  xsmall: { minWidth: 40, px: 10, py: 8, radius: 16, font: 12, icon: 12, gap: 2 },
  small: { minWidth: 54, px: 14, py: 8, radius: 18, font: 14, icon: 16, gap: 4 },
};

export function CapsuleToggleButton({
  size = "small",
  selected: selectedProp,
  defaultSelected = false,
  onSelectedChange,
  icon,
  disabled = false,
  children,
  style,
  ...rest
}) {
  const [inner, setInner] = React.useState(defaultSelected);
  const [hover, setHover] = React.useState(false);
  const selected = selectedProp ?? inner;
  const s = capsuleSizes[size] ?? capsuleSizes.small;
  let bg, fg;
  if (disabled) { bg = "var(--seed-scale-color-gray-300)"; fg = "var(--seed-scale-color-gray-500)"; }
  else if (selected) {
    bg = hover ? "var(--seed-semantic-color-primary-low-hover)" : "var(--seed-semantic-color-primary-low)";
    fg = "var(--seed-semantic-color-primary)";
  } else {
    bg = hover ? "var(--seed-scale-color-gray-200)" : "var(--seed-semantic-color-secondary-low)";
    fg = "var(--seed-scale-color-gray-900)";
  }
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
        justifyContent: "center",
        gap: s.gap,
        minWidth: s.minWidth,
        padding: `${s.py}px ${s.px}px`,
        border: "none",
        borderRadius: s.radius,
        background: bg,
        color: fg,
        fontFamily: "inherit",
        fontSize: s.font,
        fontWeight: "bold",
        whiteSpace: "nowrap",
        cursor: disabled ? "default" : "pointer",
        transition: "background-color 50ms var(--seed-timing-function-standard-easing)",
        ...style,
      }}
      {...rest}
    >
      {icon ? <span style={{ display: "inline-flex", width: s.icon, height: s.icon }}>{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
