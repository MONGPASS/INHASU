import React from "react";

/* docs/content/component/switch/style.mdx — root 52×42, track 52×30, handle 26. */
export function Switch({ checked: checkedProp, defaultChecked = false, onCheckedChange, disabled = false, style, ...rest }) {
  const [inner, setInner] = React.useState(defaultChecked);
  const checked = checkedProp ?? inner;
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 52,
        height: 42,
        opacity: disabled ? 0.38 : 1,
        cursor: disabled ? "default" : "pointer",
        ...style,
      }}
    >
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => { setInner(e.target.checked); onCheckedChange?.(e.target.checked); }}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
        {...rest}
      />
      <span
        style={{
          position: "relative",
          display: "block",
          width: 52,
          height: 30,
          borderRadius: "var(--seed-radius-full)",
          background: checked ? "var(--seed-semantic-color-primary)" : "var(--seed-scale-color-gray-500)",
          transition: "background-color 50ms var(--seed-timing-function-standard-easing) 20ms",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 24 : 2,
            width: 26,
            height: 26,
            borderRadius: "var(--seed-radius-full)",
            background: "var(--seed-semantic-color-on-primary)",
            transition: "left 150ms var(--seed-timing-function-standard-easing)",
          }}
        />
      </span>
    </label>
  );
}
