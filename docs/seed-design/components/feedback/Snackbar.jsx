import React from "react";

/* docs/content/component/snackbar/style.mdx */
export function Snackbar({ type = "default", message, icon, actionLabel, onAction, visible = true, style, ...rest }) {
  const iconColor = type === "success" ? "var(--seed-semantic-color-success)" : type === "warning" ? "var(--seed-scale-color-red-600)" : "var(--seed-scale-color-gray-00)";
  return (
    <div style={{ width: "100%", padding: "0 8px", boxSizing: "border-box", ...style }} {...rest}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "10px 16px",
          borderRadius: "var(--seed-radius-large)",
          background: "var(--seed-scale-color-gray-900)",
          color: "var(--seed-scale-color-gray-00)",
          fontSize: 14,
          lineHeight: "150%",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.7)",
          transition: "transform 300ms var(--seed-timing-function-spring-entrance), opacity 100ms var(--seed-timing-function-spring-entrance)",
        }}
      >
        {icon ? <span style={{ display: "inline-flex", width: 20, height: 20, flex: "none", color: iconColor }}>{icon}</span> : null}
        <span style={{ flex: 1, textAlign: "start" }}>{message}</span>
        {actionLabel ? (
          <button
            type="button"
            onClick={onAction}
            style={{
              flex: "none",
              padding: "3px 4px",
              border: "none",
              background: "none",
              color: "var(--seed-semantic-color-primary)",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
