import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground shadow-md hover:shadow-glow hover:bg-primary/90 hover:translate-y-[-1px] hover:brightness-105 active:scale-[0.98] active:translate-y-0",
                destructive:
                    "bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90 active:scale-[0.98]",
                outline:
                    "border border-border bg-transparent text-foreground hover:bg-secondary hover:border-primary/50 hover:translate-y-[-1px] active:scale-[0.98] active:translate-y-0",
                secondary:
                    "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 active:scale-[0.98]",
                ghost:
                    "text-foreground hover:bg-secondary hover:text-foreground active:scale-[0.98]",
                link:
                    "text-primary underline-offset-4 hover:underline",
                success:
                    "bg-success text-success-foreground shadow-md hover:bg-success/90 active:scale-[0.98]",
                warning:
                    "bg-warning text-warning-foreground shadow-md hover:bg-warning/90 active:scale-[0.98]",
                premium:
                    "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow hover:shadow-[0_0_50px_hsl(var(--primary)/0.5)] hover:translate-y-[-2px] hover:brightness-110 active:scale-[0.98] active:translate-y-0",
                glass:
                    "backdrop-blur-xl bg-card/60 border border-border/50 text-foreground hover:bg-card/80 hover:border-primary/30 active:scale-[0.98]",
                accent:
                    "bg-accent text-accent-foreground shadow-md hover:shadow-glow-accent hover:bg-accent/90 active:scale-[0.98]",
            },
            size: {
                default: "h-10 px-5 py-2",
                sm: "h-8 rounded-md px-3 text-xs",
                lg: "h-12 rounded-lg px-8 text-base",
                xl: "h-14 rounded-xl px-10 text-lg font-semibold",
                icon: "h-10 w-10",
                "icon-sm": "h-8 w-8",
                "icon-lg": "h-12 w-12",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
