import * as React from "react";

/** An immediate on/off control for settings rows. One fixed size: 52×42. */
export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export declare function Switch(props: SwitchProps): JSX.Element;
