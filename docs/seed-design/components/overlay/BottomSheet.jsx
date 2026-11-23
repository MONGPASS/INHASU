import React from "react";

/* docs/content/component/bottom-sheet/style.mdx — 375pt max height, 20pt top radius. */
export function BottomSheet({ open = true, title, description, headerAlign = "start", closeIcon, onClose, footer, children, style, ...rest }) {
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
          display: "flex",
          flexDirection: "column",
          width: "100%",
          maxHeight: 375,
          padding: 16,
          background: "var(--seed-semantic-color-paper-default)",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, textAlign: headerAlign === "center" ? "center" : "start" }}>
            {title ? <strong style={{ fontSize: 14, fontWeight: "bold", color: "var(--seed-scale-color-gray-900)" }}>{title}</strong> : null}
            {description ? <span style={{ fontSize: 14, color: "var(--seed-scale-color-gray-900)" }}>{description}</span> : null}
          </div>
          {closeIcon ? (
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              style={{ display: "inline-flex", width: 24, height: 24, padding: 0, border: "none", background: "none", color: "var(--seed-scale-color-gray-900)", cursor: "pointer" }}
            >
              {closeIcon}
            </button>
          ) : null}
        </div>
        <div style={{ marginTop: 16, overflowY: "auto", flex: 1 }}>{children}</div>
        {footer ? <div style={{ marginTop: 16 }}>{footer}</div> : null}
      </div>
    </div>
  );
}
