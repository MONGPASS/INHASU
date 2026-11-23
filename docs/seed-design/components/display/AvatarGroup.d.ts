import * as React from "react";

export interface AvatarGroupItem {
  src?: string;
  alt?: string;
  fallback?: React.ReactNode;
}

/** Overlapping avatars with a "+N" excess disc. */
export interface AvatarGroupProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "xxsmall" | "xsmall" | "small" | "medium";
  /** How many avatars to show before collapsing into "+N". */
  limit?: number;
  /** Which end of the stack sits on top. */
  topItem?: "firstItem" | "lastItem";
  items?: AvatarGroupItem[];
}

export declare function AvatarGroup(props: AvatarGroupProps): JSX.Element;
