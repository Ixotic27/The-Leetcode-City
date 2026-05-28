import React from "react";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circle" | "rectangular";
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = "",
  variant = "rectangular",
  width,
  height,
}) => {
  const baseShape =
    variant === "circle"
      ? "rounded-full"
      : variant === "text"
        ? "rounded h-4 w-full"
        : "rounded-xl";

  return (
    <div
      className={`animate-pulse bg-slate-700/50 backdrop-blur-sm ${baseShape} ${className}`}
      style={{
        width: width,
        height: height,
      }}
    />
  );
};
