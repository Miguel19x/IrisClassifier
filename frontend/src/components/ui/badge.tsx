import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "border-transparent bg-primary text-primary-foreground shadow",
                secondary:
                    "border-transparent bg-secondary text-secondary-foreground",
                destructive:
                    "border-transparent bg-destructive text-destructive-foreground shadow",
                outline:
                    "text-foreground border-border",
                success:
                    "border-success/30 bg-success/10 text-success",
                warning:
                    "border-warning/30 bg-warning/10 text-warning",
                processing:
                    "border-accent/30 bg-accent/10 text-accent animate-pulse",
                completed:
                    "border-success/30 bg-success/10 text-success",
                pending:
                    "border-warning/30 bg-warning/10 text-warning",
                confirmed:
                    "border-success/30 bg-success/10 text-success",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
