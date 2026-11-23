import * as React from "react";
import type { InlineAlertProps } from "./InlineAlert";

/** An InlineAlert that is tappable, with a trailing action indicator. */
export interface ActionableInlineAlertProps extends InlineAlertProps {
  actionIndicator?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export declare function ActionableInlineAlert(props: ActionableInlineAlertProps): JSX.Element;
