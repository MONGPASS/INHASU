import * as React from "react";

/** A transient dark bar confirming that something happened. */
export interface SnackbarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `success` tints the icon green, `warning` red. The bar itself is always gray-900. */
  type?: "default" | "success" | "warning";
  message?: React.ReactNode;
  icon?: React.ReactNode;
  actionLabel?: React.ReactNode;
  onAction?: () => void;
  visible?: boolean;
}

export declare function Snackbar(props: SnackbarProps): JSX.Element;
