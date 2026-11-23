import React from "react";

/* docs/content/component/inline-alert — the usage doc defines the option set
   (variant normal|info|success|danger, weight standard|strong, icon, description)
   but Seed publishes no colour/layout table for this family. Tints below follow
   the Callout system: standard uses the alpha-50 tint with 950 text; strong uses
   the solid semantic colour. Treat the exact values as provisional. */
const inlineAlertVariants = {
  normal: { standardBg: "var(--seed-scale-color-gray-100)", standardFg: "var(--seed-scale-color-gray-900)", strongBg: "var(--seed-scale-color-gray-900)", strongFg: "var(--seed-scale-color-gray-00)" },
  info: { standardBg: "var(--seed-scale-color-blue-alpha-50)", standardFg: "var(--seed-scale-color-blue-950)", strongBg: "var(--seed-semantic-color-accent)", strongFg: "var(--seed-static-color-static-white)" },
  success: { standardBg: "var(--seed-scale-color-green-alpha-50)", standardFg: "var(--seed-scale-color-green-950)", strongBg: "var(--seed-semantic-color-success)", strongFg: "var(--seed-static-color-static-white)" },
  danger: { standardBg: "var(--seed-scale-color-red-alpha-50)", standardFg: "var(--seed-scale-color-red-950)", strongBg: "var(--seed-semantic-color-danger)", strongFg: "var(--seed-static-color-static-white)" },
};

export function InlineAlert({ variant = "normal", weight = "standard", icon, children, style, ...rest }) {
  const v = inlineAlertVariants[variant] ?? inlineAlertVariants.normal;
  const strong = weight === "strong";
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 6,
        padding: "10px 12px",
        borderRadius: 8,
        background: strong ? v.strongBg : v.standardBg,
        color: strong ? v.strongFg : v.standardFg,
        fontSize: 13,
        lineHeight: "150%",
        ...style,
      }}
      {...rest}
    >
      {icon ? <span style={{ display: "inline-flex", width: 16, height: 16, marginTop: 1, flex: "none" }}>{icon}</span> : null}
      <span>{children}</span>
    </div>
  );
}
