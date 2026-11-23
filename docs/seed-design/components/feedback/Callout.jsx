import React from "react";

/* docs/content/component/callout/style.mdx */
const calloutVariants = {
  outline: { bg: "transparent", border: "1px solid var(--seed-scale-color-gray-300)", fg: "var(--seed-scale-color-gray-900)" },
  normal: { bg: "var(--seed-scale-color-gray-100)", border: "none", fg: "var(--seed-scale-color-gray-900)" },
  info: { bg: "var(--seed-scale-color-blue-alpha-50)", border: "none", fg: "var(--seed-scale-color-blue-950)" },
  warning: { bg: "var(--seed-scale-color-yellow-alpha-50)", border: "none", fg: "var(--seed-scale-color-yellow-950)" },
  danger: { bg: "var(--seed-scale-color-red-alpha-50)", border: "none", fg: "var(--seed-scale-color-red-950)" },
};

export function Callout({ variant = "normal", title, icon, children, style, ...rest }) {
  const v = calloutVariants[variant] ?? calloutVariants.normal;
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: "14px 16px",
        borderRadius: 10,
        background: v.bg,
        border: v.border,
        color: v.fg,
        ...style,
      }}
      {...rest}
    >
      {icon ? <span style={{ display: "inline-flex", width: 16, height: 16, marginTop: 2, flex: "none" }}>{icon}</span> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 14, lineHeight: "135%" }}>
        {title ? <strong style={{ fontWeight: "bold" }}>{title}</strong> : null}
        {children ? <span>{children}</span> : null}
      </div>
    </div>
  );
}
