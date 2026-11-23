import * as React from "react";

/** A two-handle slider selecting a range. */
export interface RangeSliderProps {
  min?: number;
  max?: number;
  step?: number;
  value?: [number, number];
  defaultValue?: [number, number];
  onValueChange?: (value: [number, number]) => void;
  label?: React.ReactNode;
  output?: React.ReactNode;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export declare function RangeSlider(props: RangeSliderProps): JSX.Element;
