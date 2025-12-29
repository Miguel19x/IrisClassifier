import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
    title: string;
    value: number | string;
    icon: LucideIcon;
    trend?: "up" | "down" | "neutral";
    trendValue?: string;
    delay?: number;
    variant?: "default" | "primary" | "accent" | "success" | "warning";
}

export function StatsCard({
    title,
    value,
    icon: Icon,
    trend,
    trendValue,
    delay = 0,
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
        <div className="animate-slide-up" style={{ animationDelay: `${delay}s` }}>
            <Card
                variant="glass"
                className="p-6 hover:border-primary/30 hover:shadow-glow transition-all duration-300 group"
            >
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-1">{title}</p>
                        <p
                            className="text-3xl font-display font-bold text-foreground animate-fade-in"
                            style={{ animationDelay: `${delay + 0.2}s` }}
                        >
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
                            "p-3 rounded-xl transition-all duration-300 group-hover:scale-110",
                            iconColors[variant]
                        )}
                    >
                        <Icon className="h-6 w-6" />
                    </div>
                </div>
            </Card>
        </div>
    );
}
