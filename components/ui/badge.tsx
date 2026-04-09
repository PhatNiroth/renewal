import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import type { HTMLAttributes } from "react"

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:     "bg-primary/10 text-primary",
        secondary:   "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive/10 text-destructive",
        outline:     "border border-border text-foreground bg-transparent",
        success:     "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        warning:     "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
