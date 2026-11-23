import * as React from "react";

/** A compact one- or two-line notice attached to the thing it describes. */
export interface InlineAlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "normal" | "info" | "success" | "danger";
  /** `strong` is the high-attention solid fill — use sparingly. */
  weight?: "standard" | "strong";
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export declare function InlineAlert(props: InlineAlertProps): JSX.Element;
