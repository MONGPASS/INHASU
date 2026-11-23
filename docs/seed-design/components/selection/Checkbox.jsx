import React from "react";
import { Icon } from "../icon/Icon.jsx";

/* docs/content/component/checkbox/style.mdx */
const checkboxSizes = {
  small: { minHeight: 24, control: 18, icon: 8, font: 13, gap: 8 },
  medium: { minHeight: 28, control: 20, icon: 9, font: 14, gap: 8 },
  large: { minHeight: 36, control: 24, icon: 10, font: 16, gap: 8 },
};

export function Checkbox({
  size = "medium",
  shape = "square",
  bold = false,
  checked: checkedProp,
  defaultChecked = false,
  indeterminate = false,
  onCheckedChange,
  disabled = false,
  children,
  style,
  ...rest
}) {
  const [inner, setInner] = React.useState(defaultChecked);
  const [hover, setHover] = React.useState(false);
  const checked = checkedProp ?? inner;
  const s = checkboxSizes[size] ?? checkboxSizes.medium;
  const ghost = shape === "ghost";
  const on = checked || indeterminate;

  let controlBg = "transparent";
  let controlBorder = "none";
  let glyph = "transparent";
  if (ghost) {
    glyph = disabled ? "var(--seed-scale-color-gray-300)" : on ? "var(--seed-semantic-color-primary)" : "var(--seed-scale-color-gray-500)";
    controlBg = hover && !disabled ? (on ? "var(--seed-semantic-color-primary-low-hover)" : "var(--seed-semantic-color-gray-hover)") : "transparent";
  } else if (on) {
    controlBg = disabled ? "var(--seed-scale-color-gray-300)" : hover ? "var(--seed-semantic-color-primary-hover)" : "var(--seed-semantic-color-primary)";
    glyph = disabled ? "var(--seed-scale-color-gray-500)" : "var(--seed-semantic-color-on-primary)";
  } else {
    controlBg = disabled ? "var(--seed-scale-color-gray-200)" : hover ? "var(--seed-semantic-color-gray-hover)" : "transparent";
    controlBorder = "1px solid var(--seed-scale-color-gray-300)";
  }

  return (
    <label
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: s.gap,
        minHeight: s.minHeight,
        color: disabled ? "var(--seed-scale-color-gray-400)" : "var(--seed-scale-color-gray-900)",
        fontSize: s.font,
        fontWeight: bold ? "bold" : "normal",
        cursor: disabled ? "default" : "pointer",
        ...style,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => { setInner(e.target.checked); onCheckedChange?.(e.target.checked); }}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
        {...rest}
      />
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: s.control,
          height: s.control,
          flex: "none",
          borderRadius: shape === "circle" ? "100%" : 4,
          background: controlBg,
          border: controlBorder,
          transition: "background-color 50ms var(--seed-timing-function-standard-easing) 20ms",
        }}
      >
        {indeterminate ? (
          <span style={{ width: s.icon + 2, height: 2, borderRadius: 1, background: glyph }} />
        ) : (
          <span style={{ opacity: checked || ghost ? 1 : 0, display: "inline-flex", transition: "opacity 50ms var(--seed-timing-function-standard-easing)" }}>
            <Icon name="check_fill" size={Math.round(s.icon * 1.6)} color={glyph} />
          </span>
        )}
      </span>
      {children ? <span>{children}</span> : null}
    </label>
  );
}
