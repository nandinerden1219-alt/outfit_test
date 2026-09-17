import Link from "next/link";

import { cn } from "@/lib/utils";

type BrandProps = {
  href?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
};

/** Wordmark. Kept as text so renaming the product later is a one-line change. */
export function Brand({ href = "/", className, size = "md" }: BrandProps) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", sizes[size], className)}
    >
      <span aria-hidden className="inline-block size-2.5 rounded-full bg-brand" />
      Outfit
    </Link>
  );
}
