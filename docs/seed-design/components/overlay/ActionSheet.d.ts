import * as React from "react";

export interface ActionSheetAction {
  label: React.ReactNode;
  variant?: "default" | "destructive";
  disabled?: boolean;
  onClick?: () => void;
}

/** A bottom sheet listing single-tap actions for the thing just tapped. */
export interface ActionSheetProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: ActionSheetAction[];
  onClose?: () => void;
}

export declare function ActionSheet(props: ActionSheetProps): JSX.Element;
