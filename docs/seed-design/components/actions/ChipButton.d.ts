import * as React from "react";

/** A pill-shaped outlined button, used in horizontal scroll rows above content. */
export interface ChipButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "small" | "medium";
  /** Trailing count rendered in gray-600 after the label. */
  count?: number;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
  disabled?: boolean;
  children?: React.ReactNode;
}

export declare function ChipButton(props: ChipButtonProps): JSX.Element;
