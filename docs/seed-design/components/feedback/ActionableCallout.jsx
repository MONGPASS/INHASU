import React from "react";

/* docs/content/component/actionable-callout/style.mdx */
const actionableCalloutVariants = {
  outline: { bg: "transparent", pressed: "var(--seed-semantic-color-gray-pressed)", border: "1px solid var(--seed-scale-color-gray-300)", fg: "var(--seed-scale-color-gray-900)" },
  normal: { bg: "var(--seed-scale-color-gray-100)", pressed: "var(--seed-scale-color-gray-200)", border: "none", fg: "var(--seed-scale-color-gray-900)" },
  info: { bg: "var(--seed-scale-color-blue-alpha-50)", pressed: "var(--seed-scale-color-blue-alpha-100)", border: "none", fg: "var(--seed-scale-color-blue-950)" },
  warning: { bg: "var(--seed-scale-color-yellow-alpha-50)", pressed: "var(--seed-scale-color-yellow-alpha-100)", border: "none", fg: "var(--seed-scale-color-yellow-950)" },
  danger: { bg: "var(--seed-scale-color-red-alpha-50)", pressed: "var(--seed-scale-color-red-alpha-100)", border: "none", fg: "var(--seed-scale-color-red-950)" },
};

export function ActionableCallout({ variant = "normal", title, actionIndicator, children, style, ...rest }) {
  const [pressed, setPressed] = React.useState(false);
  const v = actionableCalloutVariants[variant] ?? actionableCalloutVariants.normal;
  return (
    <button
      type="button"
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "14px 12px 14px 16px",
        borderRadius: 10,
        background: pressed ? v.pressed : v.bg,
        border: v.border,
        color: v.fg,
        fontFamily: "inherit",
        textAlign: "start",
        cursor: "pointer",
        ...style,
      }}
      {...rest}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, fontSize: 14, lineHeight: "135%" }}>
        {title ? <strong style={{ fontWeight: "bold" }}>{title}</strong> : null}
        {children ? <span>{children}</span> : null}
      </span>
      <span style={{ display: "inline-flex", width: 18, height: 18, flex: "none" }}>{actionIndicator}</span>
    </button>
  );
}
