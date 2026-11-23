import React from "react";
import { ChipToggleButton } from "./ChipToggleButton.jsx";

/* docs/content/component/chip-radio-group/style.mdx — chips 8pt apart,
   chip visuals identical to ChipToggleButton. */
export function ChipRadioGroup({ size = "medium", items = [], value: valueProp, defaultValue, onValueChange, style, ...rest }) {
  const [inner, setInner] = React.useState(defaultValue);
  const value = valueProp ?? inner;
  return (
    <div role="radiogroup" style={{ display: "flex", flexWrap: "wrap", gap: 8, ...style }} {...rest}>
      {items.map((item) => (
        <ChipToggleButton
          key={item.value}
          role="radio"
          aria-checked={value === item.value}
          size={size}
          selected={value === item.value}
          disabled={item.disabled}
          prefixIcon={item.prefixIcon}
          suffixIcon={item.suffixIcon}
          onClick={() => { setInner(item.value); onValueChange?.(item.value); }}
        >
          {item.label}
        </ChipToggleButton>
      ))}
    </div>
  );
}
