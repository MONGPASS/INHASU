import * as React from "react";

/** A single-value slider with a 6px track and a 28px shadowed handle. */
export interface SliderProps {
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  label?: React.ReactNode;
  /** Current-value readout shown at the right of the label row. */
  output?: React.ReactNode;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export declare function Slider(props: SliderProps): JSX.Element;
