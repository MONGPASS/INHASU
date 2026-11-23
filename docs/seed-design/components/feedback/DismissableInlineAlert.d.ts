import * as React from "react";
import type { InlineAlertProps } from "./InlineAlert";

/** An InlineAlert with a close button. */
export interface DismissableInlineAlertProps extends InlineAlertProps {
  closeIcon?: React.ReactNode;
  onDismiss?: () => void;
}

export declare function DismissableInlineAlert(props: DismissableInlineAlertProps): JSX.Element;
