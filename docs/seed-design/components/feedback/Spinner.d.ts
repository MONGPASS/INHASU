import * as React from "react";

/** An indeterminate loading indicator. */
export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** 24px (small) or 40px (medium). */
  size?: "small" | "medium";
  /** `white` for use over imagery or the dark snackbar; `primary` for carrot. */
  variant?: "gray" | "white" | "primary";
}

export declare function Spinner(props: SpinnerProps): JSX.Element;
