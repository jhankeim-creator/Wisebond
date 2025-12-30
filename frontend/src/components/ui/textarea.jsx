import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-stone-300 bg-white dark:bg-stone-800 dark:border-stone-600 px-3 py-2 text-base shadow-sm placeholder:text-stone-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EA580C] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:text-white dark:placeholder:text-stone-400",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Textarea.displayName = "Textarea"

export { Textarea }
