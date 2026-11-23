import React from "react";

/* docs/content/component/text-button/style.mdx */
const textButtonSizes = {
  small: { height: 23, icon: 14, gap: 1, regular: 14, bold: 18 },
  medium: { height: 26, icon: 14, gap: 2, regular: 16, bold: 16 },
  large: { height: 28, icon: 16, gap: 2, regular: 18, bold: 14 },
};

const textButtonVariants = {
  primary: { fg: "#079475", hover: "#067661" },
  secondary: { fg: "var(--seed-semantic-color-secondary)", hover: "var(--seed-scale-color-gray-700)" },
  "secondary-low": { fg: "var(--seed-scale-color-gray-600)", hover: "var(--seed-scale-color-gray-700)" },
  accent: { fg: "#12B28C", hover: "#079475" },
  danger: { fg: "var(--seed-semantic-color-danger)", hover: "var(--seed-scale-color-red-400)" },
};

export function TextButton({
  size = "medium",
  variant = "secondary",
  buttonStyle = "basic",
  bold = false,
  prefixIcon,
  suffixIcon,
  disabled = false,
  children,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const s = textButtonSizes[size] ?? textButtonSizes.medium;
  const v = textButtonVariants[variant] ?? textButtonVariants.secondary;
  const fg = disabled ? "var(--seed-scale-color-gray-400)" : hover ? v.hover : v.fg;
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: s.gap,
        height: s.height,
        padding: 0,
        border: "none",
        background: "none",
        color: fg,
        fontFamily: "inherit",
        fontSize: bold ? s.bold : s.regular,
        fontWeight: bold ? "bold" : "normal",
        lineHeight: "135%",
        textDecoration: buttonStyle === "underlined" ? "underline" : "none",
        textUnderlineOffset: 4,
        cursor: disabled ? "default" : "pointer",
        ...style,
      }}
      {...rest}
    >
      {prefixIcon ? <span style={{ display: "inline-flex", width: s.icon, height: s.icon }}>{prefixIcon}</span> : null}
      <span>{children}</span>
      {suffixIcon ? <span style={{ display: "inline-flex", width: s.icon, height: s.icon }}>{suffixIcon}</span> : null}
    </button>
  );
}
