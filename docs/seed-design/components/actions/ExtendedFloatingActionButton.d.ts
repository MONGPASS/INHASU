import * as React from "react";

/** A floating pill button carrying both an icon and a label. */
export interface ExtendedFloatingActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "small" | "medium";
  /** `overPaper` is the dark gray-900 pill; `overImage` is the white floating pill. */
  variant?: "overPaper" | "overImage";
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export declare function ExtendedFloatingActionButton(props: ExtendedFloatingActionButtonProps): JSX.Element;
