import * as React from "react";

/** A pill chip that toggles between outlined and gray-800 filled. */
export interface ChipToggleButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  size?: "small" | "medium";
  selected?: boolean;
  defaultSelected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  prefixIcon?: React.ReactNode;
  suffixIcon?: React.ReactNode;
  disabled?: boolean;
  children?: React.ReactNode;
}

export declare function ChipToggleButton(props: ChipToggleButtonProps): JSX.Element;
