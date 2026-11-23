import React from "react";

/* docs/content/component/floating-action-button/style.mdx */
const fabSizes = {
  small: { box: 40, icon: 20, shadow: "0 1px 3px 0 rgba(0,0,0,0.28)" },
  medium: { box: 48, icon: 22, shadow: "0 2px 6px 0 rgba(0,0,0,0.16)" },
};

export function FloatingActionButton({ size = "medium", icon, style, ...rest }) {
  const [pressed, setPressed] = React.useState(false);
  const s = fabSizes[size] ?? fabSizes.medium;
  return (
    <button
      type="button"
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: s.box,
        height: s.box,
        border: "none",
        borderRadius: "var(--seed-radius-full)",
        background: pressed ? "#ECFDF7" : "var(--seed-semantic-color-paper-floating)",
        color: "#075E4E",
        boxShadow: s.shadow,
        cursor: "pointer",
        transition: "background-color var(--seed-duration-press) var(--seed-timing-function-standard-easing)",
        ...style,
      }}
      {...rest}
    >
      <span style={{ display: "inline-flex", width: s.icon, height: s.icon }}>{icon}</span>
    </button>
  );
}
