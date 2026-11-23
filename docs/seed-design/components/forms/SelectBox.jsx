import React from "react";
import { Icon } from "../icon/Icon.jsx";

/* NOTE: upstream docs/content/component/select-box/style.mdx is empty — Seed has
   not published visual specs for SelectBox. Geometry below is borrowed from the
   outlined TextField so the two line up in a form; treat it as provisional. */
const selectBoxSizes = {
  small: { height: 42, padding: 12, font: 14 },
  medium: { height: 52, padding: 14, font: 16 },
  large: { height: 54, padding: 14, font: 18 },
};

export function SelectBox({ size = "medium", label, placeholder = "선택해주세요", items = [], value, defaultValue, onValueChange, disabled = false, invalid = false, style, ...rest }) {
  const [focused, setFocused] = React.useState(false);
  const [inner, setInner] = React.useState(defaultValue ?? "");
  const current = value ?? inner;
  const s = selectBoxSizes[size] ?? selectBoxSizes.medium;
  const border = invalid ? "var(--seed-semantic-color-danger)" : focused ? "var(--seed-scale-color-gray-900)" : "var(--seed-scale-color-gray-400)";
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 280, ...style }}>
      {label ? <div style={{ marginBottom: 12, fontSize: 14, fontWeight: "bold", color: "var(--seed-scale-color-gray-900)" }}>{label}</div> : null}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          height: s.height,
          padding: `0 ${s.padding}px`,
          background: disabled ? "var(--seed-scale-color-gray-100)" : invalid ? "var(--seed-semantic-color-danger-low)" : "var(--seed-semantic-color-paper-default)",
          border: `1px solid ${border}`,
          borderRadius: 6,
        }}
      >
        <select
          value={current}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => { setInner(e.target.value); onValueChange?.(e.target.value); }}
          style={{
            appearance: "none",
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontFamily: "inherit",
            fontSize: s.font,
            color: current ? "var(--seed-scale-color-gray-900)" : "var(--seed-scale-color-gray-600)",
            cursor: disabled ? "default" : "pointer",
          }}
          {...rest}
        >
          <option value="" disabled>{placeholder}</option>
          {items.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <Icon
          name="expand_more_regular"
          size={20}
          color={disabled ? "var(--seed-scale-color-gray-400)" : "var(--seed-scale-color-gray-600)"}
          style={{ marginLeft: 8 }}
        />
      </div>
    </div>
  );
}
