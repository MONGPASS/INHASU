import React from "react";
import { BoxButton } from "../actions/BoxButton.jsx";

/* docs/content/component/alert-dialog/style.mdx — 272pt max width, 16pt radius. */
export function AlertDialog({
  open = true,
  title,
  description,
  primaryLabel,
  onPrimaryAction,
  secondaryLabel,
  onSecondaryAction,
  secondaryActionIntent = "neutral",
  style,
  ...rest
}) {
  if (!open) return null;
  const column = secondaryActionIntent === "nonpreferred";
  return (
    <div
      role="alertdialog"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--seed-semantic-color-overlay-dim)",
        zIndex: 100,
        ...style,
      }}
      {...rest}
    >
      <div style={{ width: "100%", maxWidth: 272, background: "var(--seed-semantic-color-paper-dialog)", borderRadius: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "20px 20px 0" }}>
          {title ? <strong style={{ fontSize: 18, fontWeight: "bold", lineHeight: "135%", color: "var(--seed-scale-color-gray-900)" }}>{title}</strong> : null}
          {description ? <span style={{ fontSize: 16, lineHeight: "135%", color: "var(--seed-scale-color-gray-900)" }}>{description}</span> : null}
        </div>
        <div style={{ display: "flex", flexDirection: column ? "column" : "row", gap: 8, marginTop: 16, padding: "0 16px 20px" }}>
          {secondaryLabel && secondaryActionIntent !== "nonpreferred" ? (
            <BoxButton
              size="medium"
              variant={secondaryActionIntent === "alternative" ? "primary-low" : "secondary"}
              onClick={onSecondaryAction}
              style={{ flex: 1 }}
            >
              {secondaryLabel}
            </BoxButton>
          ) : null}
          <BoxButton size="medium" variant="primary" onClick={onPrimaryAction} style={{ flex: 1, width: column ? "100%" : undefined }}>
            {primaryLabel}
          </BoxButton>
          {secondaryLabel && secondaryActionIntent === "nonpreferred" ? (
            <button
              type="button"
              onClick={onSecondaryAction}
              style={{ height: 40, border: "none", background: "none", color: "var(--seed-scale-color-gray-700)", fontFamily: "inherit", fontSize: 14, fontWeight: "bold", cursor: "pointer" }}
            >
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
