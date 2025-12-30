import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#EA580C] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#EA580C] text-white shadow hover:bg-[#C2410C]",
        secondary:
          "border-transparent bg-stone-200 text-stone-900 hover:bg-stone-300 dark:bg-stone-700 dark:text-white dark:hover:bg-stone-600",
        destructive:
          "border-transparent bg-red-600 text-white shadow hover:bg-red-700",
        outline: "text-stone-900 dark:text-white border-stone-300 dark:border-stone-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
