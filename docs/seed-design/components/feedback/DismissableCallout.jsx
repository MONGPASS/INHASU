import React from "react";

/* docs/content/component/dismissable-callout/style.mdx */
const dismissableCalloutVariants = {
  outline: { bg: "transparent", border: "1px solid var(--seed-scale-color-gray-300)", fg: "var(--seed-scale-color-gray-900)" },
  normal: { bg: "var(--seed-scale-color-gray-100)", border: "none", fg: "var(--seed-scale-color-gray-900)" },
  info: { bg: "var(--seed-scale-color-blue-alpha-50)", border: "none", fg: "var(--seed-scale-color-blue-950)" },
  warning: { bg: "var(--seed-scale-color-yellow-alpha-50)", border: "none", fg: "var(--seed-scale-color-yellow-950)" },
  danger: { bg: "var(--seed-scale-color-red-alpha-50)", border: "none", fg: "var(--seed-scale-color-red-950)" },
};

export function DismissableCallout({ variant = "normal", title, closeIcon, onDismiss, children, style, ...rest }) {
  const [open, setOpen] = React.useState(true);
  const v = dismissableCalloutVariants[variant] ?? dismissableCalloutVariants.normal;
  if (!open) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "14px 14px 14px 16px",
        borderRadius: 10,
        background: v.bg,
        border: v.border,
        color: v.fg,
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, fontSize: 14, lineHeight: "135%" }}>
        {title ? <strong style={{ fontWeight: "bold" }}>{title}</strong> : null}
        {children ? <span>{children}</span> : null}
      </div>
      <button
        type="button"
        aria-label="닫기"
        onClick={() => { setOpen(false); onDismiss?.(); }}
        style={{ display: "inline-flex", width: 18, height: 18, padding: 0, border: "none", background: "none", color: "inherit", cursor: "pointer", flex: "none" }}
      >
        {closeIcon}
      </button>
    </div>
  );
}
