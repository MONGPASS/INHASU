import React from "react";

/* docs/content/component/extended-floating-action-button/style.mdx */
const efabSizes = {
  small: { height: 35, padding: 16, font: 14, weight: "normal", icon: 16, shadow: "0 1px 3px 0 rgba(0,0,0,0.28)" },
  medium: { height: 46, padding: 18, font: 16, weight: "bold", icon: 16, shadow: "0 2px 6px 0 rgba(0,0,0,0.16)" },
};

export function ExtendedFloatingActionButton({ size = "medium", variant = "overPaper", icon, children, style, ...rest }) {
  const [pressed, setPressed] = React.useState(false);
  const s = efabSizes[size] ?? efabSizes.medium;
  const overPaper = variant === "overPaper";
  const bg = overPaper
    ? pressed ? "#074D41" : "#032B25"
    : pressed ? "#ECFDF7" : "var(--seed-semantic-color-paper-floating)";
  const fg = overPaper ? "#FFFFFF" : "var(--seed-scale-color-gray-900)";
  return (
    <button
      type="button"
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        height: s.height,
        padding: `0 ${s.padding}px`,
        border: "none",
        borderRadius: "var(--seed-radius-full)",
        background: bg,
        color: fg,
        fontFamily: "inherit",
        fontSize: s.font,
        fontWeight: s.weight,
        boxShadow: s.shadow,
        cursor: "pointer",
        transition: "background-color var(--seed-duration-press) var(--seed-timing-function-standard-easing)",
        ...style,
      }}
      {...rest}
    >
      {icon ? <span style={{ display: "inline-flex", width: s.icon, height: s.icon }}>{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
