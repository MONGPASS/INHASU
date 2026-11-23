import React from "react";

/* docs/content/component/text-field/style.mdx */
const textFieldSizes = {
  small: { outlined: 42, underlined: 41, padding: 12, font: 14, gap: 6, labelGapOutlined: 12, labelGapUnderlined: 6, description: 12 },
  medium: { outlined: 52, underlined: 43, padding: 14, font: 16, gap: 8, labelGapOutlined: 12, labelGapUnderlined: 8, description: 14 },
  large: { outlined: 54, underlined: 45, padding: 14, font: 18, gap: 8, labelGapOutlined: 12, labelGapUnderlined: 8, description: 14 },
};

export function TextField({
  size = "medium",
  variant = "outlined",
  label,
  indicator,
  placeholder,
  description,
  errorMessage,
  invalid = false,
  disabled = false,
  readOnly = false,
  maxLength,
  prefix,
  suffix,
  value,
  defaultValue,
  onChange,
  style,
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  const [inner, setInner] = React.useState(defaultValue ?? "");
  const current = value ?? inner;
  const s = textFieldSizes[size] ?? textFieldSizes.medium;
  const outlined = variant === "outlined";

  let fieldBg = "var(--seed-semantic-color-paper-default)";
  let border = "var(--seed-scale-color-gray-400)";
  if (invalid) { fieldBg = "var(--seed-semantic-color-danger-low)"; border = "var(--seed-semantic-color-danger)"; }
  else if (disabled) { fieldBg = "var(--seed-scale-color-gray-100)"; }
  else if (readOnly) { fieldBg = "var(--seed-scale-color-gray-50)"; }
  else if (focused) { border = "var(--seed-scale-color-gray-900)"; }

  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 280, ...style }}>
      {label ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: outlined ? s.labelGapOutlined : s.labelGapUnderlined, fontSize: 14, fontWeight: "bold", color: "var(--seed-scale-color-gray-900)" }}>
          <span>{label}</span>
          {indicator ? <span style={{ fontWeight: "normal" }}>{indicator}</span> : null}
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: s.gap,
          height: outlined ? s.outlined : s.underlined,
          padding: outlined ? `0 ${s.padding}px` : 0,
          background: outlined ? fieldBg : "transparent",
          borderRadius: outlined ? 6 : 0,
          border: outlined ? `1px solid ${border}` : "none",
          borderBottom: `1px solid ${border}`,
        }}
      >
        {prefix ? <span style={{ color: "var(--seed-scale-color-gray-600)", fontSize: 14 }}>{prefix}</span> : null}
        <input
          value={current}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => { setInner(e.target.value); onChange?.(e); }}
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            fontFamily: "inherit",
            fontSize: s.font,
            color: disabled ? "var(--seed-scale-color-gray-400)" : "var(--seed-scale-color-gray-900)",
            caretColor: "var(--seed-scale-color-gray-900)",
          }}
          {...rest}
        />
        {suffix ? <span style={{ color: "var(--seed-scale-color-gray-600)", fontSize: 14 }}>{suffix}</span> : null}
      </div>
      {(description || errorMessage || maxLength) ? (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, marginTop: 8, fontSize: s.description }}>
          <span style={{ color: invalid && errorMessage ? "var(--seed-semantic-color-danger)" : disabled ? "var(--seed-scale-color-gray-400)" : "var(--seed-scale-color-gray-600)" }}>
            {invalid && errorMessage ? errorMessage : description}
          </span>
          {maxLength ? (
            <span style={{ color: "var(--seed-scale-color-gray-600)", flex: "none" }}>
              <span style={{ color: focused ? "var(--seed-scale-color-gray-900)" : "var(--seed-scale-color-gray-600)" }}>{String(current).length}</span>
              {`/${maxLength}`}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
