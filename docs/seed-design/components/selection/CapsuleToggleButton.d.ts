import * as React from "react";

/** A soft capsule toggle used inside cards and list rows. */
export interface CapsuleToggleButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  size?: "xsmall" | "small";
  selected?: boolean;
  defaultSelected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  children?: React.ReactNode;
}

export declare function CapsuleToggleButton(props: CapsuleToggleButtonProps): JSX.Element;
