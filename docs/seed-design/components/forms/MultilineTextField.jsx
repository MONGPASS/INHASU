import React from "react";

/* docs/content/component/multiline-text-field/style.mdx */
export function MultilineTextField({
  label,
  indicator,
  placeholder,
  description,
  errorMessage,
  invalid = false,
  disabled = false,
  readOnly = false,
  maxLength,
  rows = 4,
  value,
  defaultValue,
  onChange,
  style,
  ...rest
}) {
  const [focused, setFocused] = React.useState(false);
  const [inner, setInner] = React.useState(defaultValue ?? "");
  const current = value ?? inner;

  let fieldBg = "var(--seed-semantic-color-paper-default)";
  let border = "var(--seed-scale-color-gray-400)";
  if (invalid) { fieldBg = "var(--seed-semantic-color-danger-low)"; border = "var(--seed-semantic-color-danger)"; }
  else if (disabled) { fieldBg = "var(--seed-scale-color-gray-100)"; }
  else if (readOnly) { fieldBg = "var(--seed-scale-color-gray-50)"; }
  else if (focused) { border = "var(--seed-scale-color-gray-900)"; }

  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 280, ...style }}>
      {label ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12, fontSize: 14, fontWeight: "bold", color: "var(--seed-scale-color-gray-900)" }}>
          <span>{label}</span>
          {indicator ? <span style={{ fontWeight: "normal" }}>{indicator}</span> : null}
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "12px 16px", background: fieldBg, border: `1px solid ${border}`, borderRadius: 6 }}>
        <textarea
          rows={rows}
          value={current}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => { setInner(e.target.value); onChange?.(e); }}
          style={{
            border: "none",
            outline: "none",
            resize: "none",
            background: "transparent",
            fontFamily: "inherit",
            fontSize: 16,
            lineHeight: "135%",
            color: disabled ? "var(--seed-scale-color-gray-400)" : "var(--seed-scale-color-gray-900)",
          }}
          {...rest}
        />
        {maxLength ? (
          <div style={{ textAlign: "right", fontSize: 12, color: "var(--seed-scale-color-gray-600)" }}>
            <span style={{ color: focused ? "var(--seed-scale-color-gray-900)" : "var(--seed-scale-color-gray-600)" }}>{String(current).length}</span>
            {`/${maxLength}`}
          </div>
        ) : null}
      </div>
      {(description || (invalid && errorMessage)) ? (
        <div style={{ marginTop: 8, fontSize: 14, color: invalid && errorMessage ? "var(--seed-semantic-color-danger)" : "var(--seed-scale-color-gray-600)" }}>
          {invalid && errorMessage ? errorMessage : description}
        </div>
      ) : null}
    </div>
  );
}
