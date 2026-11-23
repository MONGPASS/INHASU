import * as React from "react";

/** A multi-line input for descriptions and long-form entry. */
export interface MultilineTextFieldProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "prefix"> {
  label?: React.ReactNode;
  indicator?: React.ReactNode;
  description?: React.ReactNode;
  errorMessage?: React.ReactNode;
  invalid?: boolean;
  maxLength?: number;
  rows?: number;
}

export declare function MultilineTextField(props: MultilineTextFieldProps): JSX.Element;
