import * as React from "react";

/** A modal that interrupts to confirm or warn. Max width 272px. */
export interface AlertDialogProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  title?: React.ReactNode;
  description?: React.ReactNode;
  primaryLabel?: React.ReactNode;
  onPrimaryAction?: () => void;
  secondaryLabel?: React.ReactNode;
  onSecondaryAction?: () => void;
  /**
   * `neutral` (gray secondary, side by side), `alternative` (carrot-tint secondary,
   * side by side), `nonpreferred` (plain gray-700 label, stacked under the primary).
   */
  secondaryActionIntent?: "neutral" | "alternative" | "nonpreferred";
}

export declare function AlertDialog(props: AlertDialogProps): JSX.Element;
