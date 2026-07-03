import type { CSSProperties, HTMLAttributes } from "react";

interface SkeletonProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  className?: string;
  variant?: "text" | "circle" | "rectangular";
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
}

export default function Skeleton({
  className = "",
  variant = "rectangular",
  width,
  height,
  style,
  ...props
}: SkeletonProps) {
  const baseShape =
    variant === "circle"
      ? "rounded-full"
      : variant === "text"
        ? "rounded h-4 w-full"
        : "rounded-xl";

  return (
    <div
      {...props}
      aria-hidden={props["aria-hidden"] ?? true}
      className={`skeleton-shimmer ${baseShape} ${className}`}
      style={{
        ...style,
        width: width ?? style?.width,
        height: height ?? style?.height,
      }}
    />
  );
}
