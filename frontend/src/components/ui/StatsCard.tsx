import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
    title: string;
    value: number | string;
    icon: LucideIcon;
    trend?: "up" | "down" | "neutral";
    trendValue?: string;
    variant?: "default" | "primary" | "accent" | "success" | "warning";
}

export function StatsCard({
    title,
    value,
    icon: Icon,
    trend,
    trendValue,
    variant = "default",
}: StatsCardProps) {
    const iconColors = {
        default: "text-muted-foreground bg-secondary",
        primary: "text-primary bg-primary/10",
        accent: "text-accent bg-accent/10",
        success: "text-success bg-success/10",
        warning: "text-warning bg-warning/10",
    };

    return (
        <div>
            <Card
                variant="glass"
                className="p-4 sm:p-6 hover:border-primary/30 hover:shadow-glow transition-all duration-300 group h-full"
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm text-muted-foreground mb-1 truncate">{title}</p>
                        <p className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                            {typeof value === 'number' ? value.toLocaleString() : value}
                        </p>
                        {trendValue && (
                            <p
                                className={cn(
                                    "text-xs mt-2",
                                    trend === "up" && "text-success",
                                    trend === "down" && "text-destructive",
                                    trend === "neutral" && "text-muted-foreground"
                                )}
                            >
                                {trend === "up" && "↑ "}
                                {trend === "down" && "↓ "}
                                {trendValue}
                            </p>
                        )}
                    </div>
                    <div
                        className={cn(
                            "p-2 sm:p-3 rounded-xl transition-all duration-300 group-hover:scale-110 flex-shrink-0",
                            iconColors[variant]
                        )}
                    >
                        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                </div>
            </Card>
        </div>
    );
}
