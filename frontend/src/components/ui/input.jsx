import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-stone-300 bg-white dark:bg-stone-800 dark:border-stone-600 px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-white file:text-sm file:font-medium file:text-stone-900 placeholder:text-stone-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EA580C] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:text-white dark:placeholder:text-stone-400",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
