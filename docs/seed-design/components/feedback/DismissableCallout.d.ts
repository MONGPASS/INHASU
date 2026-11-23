import * as React from "react";

/** A Callout the reader can close. */
export interface DismissableCalloutProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "outline" | "normal" | "info" | "warning" | "danger";
  title?: React.ReactNode;
  /** 18px close glyph. */
  closeIcon?: React.ReactNode;
  onDismiss?: () => void;
  children?: React.ReactNode;
}

export declare function DismissableCallout(props: DismissableCalloutProps): JSX.Element;
