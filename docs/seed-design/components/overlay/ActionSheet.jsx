import React from "react";

/* docs/content/component/action-sheet/style.mdx */
export function ActionSheet({ open = true, title, description, actions = [], onClose, style, ...rest }) {
  if (!open) return null;
  return (
    <div
      style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", background: "var(--seed-semantic-color-overlay-dim)", zIndex: 100, ...style }}
      onClick={onClose}
      {...rest}
    >
      <div
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          padding: "14px 0",
          background: "var(--seed-semantic-color-paper-sheet)",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        }}
      >
        {(title || description) ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 16px 14px" }}>
            {title ? <strong style={{ fontSize: 14, fontWeight: "bold", color: "var(--seed-scale-color-gray-900)" }}>{title}</strong> : null}
            {description ? <span style={{ fontSize: 13, lineHeight: "150%", color: "var(--seed-scale-color-gray-600)" }}>{description}</span> : null}
          </div>
        ) : null}
        {(title || description) ? <div style={{ height: 0.5, margin: "0 16px", background: "var(--seed-semantic-color-divider-2)" }} /> : null}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {actions.map((action, i) => (
            <button
              key={i}
              type="button"
              disabled={action.disabled}
              onClick={action.onClick}
              style={{
                padding: "12px 16px",
                border: "none",
                background: "none",
                textAlign: "start",
                fontFamily: "inherit",
                fontSize: 16,
                color: action.disabled
                  ? "var(--seed-scale-color-gray-400)"
                  : action.variant === "destructive"
                  ? "var(--seed-semantic-color-danger)"
                  : "var(--seed-semantic-color-secondary)",
                cursor: action.disabled ? "default" : "pointer",
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
