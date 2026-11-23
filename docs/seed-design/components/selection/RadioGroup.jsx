import React from "react";

/* docs/content/component/radio-group/style.mdx */
const radioSizes = {
  small: { minHeight: 27, control: 18, dot: 7, font: 13, gap: 8 },
  medium: { minHeight: 30, control: 20, dot: 8, font: 14, gap: 8 },
  large: { minHeight: 36, control: 24, dot: 10, font: 16, gap: 8 },
};

export function RadioGroup({
  size = "medium",
  items = [],
  value: valueProp,
  defaultValue,
  onValueChange,
  name,
  orientation = "vertical",
  style,
  ...rest
}) {
  const [inner, setInner] = React.useState(defaultValue);
  const value = valueProp ?? inner;
  const s = radioSizes[size] ?? radioSizes.medium;
  const groupName = React.useMemo(() => name ?? `seed-radio-${Math.random().toString(36).slice(2, 8)}`, [name]);
  return (
    <div
      role="radiogroup"
      style={{ display: "flex", flexDirection: orientation === "horizontal" ? "row" : "column", gap: orientation === "horizontal" ? 16 : 4, ...style }}
      {...rest}
    >
      {items.map((item) => {
        const selected = value === item.value;
        const disabled = item.disabled;
        return (
          <label
            key={item.value}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: s.gap,
              minHeight: s.minHeight,
              color: disabled ? "var(--seed-scale-color-gray-400)" : "var(--seed-scale-color-gray-900)",
              fontSize: s.font,
              cursor: disabled ? "default" : "pointer",
            }}
          >
            <input
              type="radio"
              name={groupName}
              value={item.value}
              checked={selected}
              disabled={disabled}
              onChange={() => { setInner(item.value); onValueChange?.(item.value); }}
              style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: s.control,
                height: s.control,
                flex: "none",
                borderRadius: "100%",
                background: disabled
                  ? selected ? "transparent" : "var(--seed-scale-color-gray-200)"
                  : selected ? "var(--seed-semantic-color-primary)" : "transparent",
                border: selected && !disabled ? "none" : "1px solid var(--seed-scale-color-gray-300)",
                transition: "background-color 50ms var(--seed-timing-function-standard-easing)",
              }}
            >
              <span
                style={{
                  width: s.dot,
                  height: s.dot,
                  borderRadius: "100%",
                  background: disabled ? "var(--seed-scale-color-gray-200)" : "var(--seed-semantic-color-on-primary)",
                  transform: selected ? "scale(1)" : "scale(0)",
                  transition: "transform 100ms var(--seed-timing-function-standard-easing)",
                }}
              />
            </span>
            <span>{item.label}</span>
          </label>
        );
      })}
    </div>
  );
}
