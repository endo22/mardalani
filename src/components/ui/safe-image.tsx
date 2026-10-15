"use client";

import { cn } from "@/lib/utils";
import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type SafeImageProps = Omit<ImageProps, "onError"> & {
  fallbackClassName?: string;
};

/**
 * next/image with an editorial gradient/pattern fallback when the remote
 * asset fails — layout stays intact for `fill` parents.
 */
export function SafeImage({
  className,
  fallbackClassName,
  alt,
  fill,
  ...props
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn(
          "fallback-pattern",
          fill ? "absolute inset-0 h-full w-full" : "block min-h-40 w-full",
          fallbackClassName,
          className,
        )}
        role="img"
        aria-label={alt}
      />
    );
  }

  return (
    <Image
      {...props}
      alt={alt}
      fill={fill}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
