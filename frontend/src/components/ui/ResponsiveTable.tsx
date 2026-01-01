/**
 * Componente de tabla responsive que se adapta a diferentes tamaños de pantalla.
 * En móvil muestra tarjetas, en desktop muestra tabla con scroll horizontal.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

interface ResponsiveTableProps {
    children: React.ReactNode;
    className?: string;
}

export function ResponsiveTable({ children, className }: ResponsiveTableProps) {
    return (
        <div className={cn("w-full", className)}>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                    {children}
                </div>
            </div>
        </div>
    );
}

interface ResponsiveTableHeaderProps {
    children: React.ReactNode;
    className?: string;
}

export function ResponsiveTableHeader({ children, className }: ResponsiveTableHeaderProps) {
    return (
        <div className={cn(
            "hidden md:grid bg-secondary text-sm font-medium text-foreground sticky top-0 z-10",
            className
        )}>
            {children}
        </div>
    );
}

interface ResponsiveTableBodyProps {
    children: React.ReactNode;
    className?: string;
}

export function ResponsiveTableBody({ children, className }: ResponsiveTableBodyProps) {
    return (
        <div className={cn("divide-y divide-border", className)}>
            {children}
        </div>
    );
}

interface ResponsiveTableRowProps {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    mobileLayout?: React.ReactNode;
}

export function ResponsiveTableRow({ children, className, style, mobileLayout }: ResponsiveTableRowProps) {
    return (
        <>
            {/* Mobile card layout */}
            {mobileLayout && (
                <div className={cn(
                    "md:hidden p-4 bg-card hover:bg-secondary/50 transition-colors",
                    className
                )} style={style}>
                    {mobileLayout}
                </div>
            )}
            {/* Desktop row layout */}
            <div className={cn(
                mobileLayout ? "hidden md:grid" : "grid",
                "items-center hover:bg-secondary/50 transition-colors",
                className
            )} style={style}>
                {children}
            </div>
        </>
    );
}

interface ResponsiveTableCellProps {
    children: React.ReactNode;
    className?: string;
    label?: string;
}

export function ResponsiveTableCell({ children, className, label }: ResponsiveTableCellProps) {
    return (
        <div className={cn("py-3 px-2 sm:px-4", className)}>
            {label && (
                <span className="md:hidden text-xs text-muted-foreground font-medium block mb-1">
                    {label}
                </span>
            )}
            {children}
        </div>
    );
}

// Mobile-specific card component for product display
interface MobileProductCardProps {
    index: number;
    code?: string | null;
    name: string;
    brand?: string | null;
    price?: number | null;
    status?: 'pending' | 'verified' | 'confirmed';
    children?: React.ReactNode;
    className?: string;
}

export function MobileProductCard({
    index,
    code,
    name,
    brand,
    price,
    status,
    children,
    className
}: MobileProductCardProps) {
    return (
        <div className={cn("space-y-3", className)}>
            {/* Header row with index and status */}
            <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">#{index}</span>
                {status && (
                    <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        status === 'pending' && "bg-warning/10 text-warning",
                        (status === 'verified' || status === 'confirmed') && "bg-success/10 text-success"
                    )}>
                        {status === 'pending' ? 'Pendiente' : 'Verificado'}
                    </span>
                )}
            </div>

            {/* Product info */}
            <div>
                <p className="font-medium text-foreground line-clamp-2">{name}</p>
                {code && (
                    <p className="text-sm text-muted-foreground font-mono mt-1">{code}</p>
                )}
            </div>

            {/* Meta row */}
            <div className="flex items-center justify-between text-sm">
                {brand && (
                    <span className="text-muted-foreground">{brand}</span>
                )}
                {price !== null && price !== undefined && (
                    <span className="font-semibold text-foreground">
                        ${price.toFixed(2)}
                    </span>
                )}
            </div>

            {/* Actions */}
            {children && (
                <div className="pt-2 border-t border-border">
                    {children}
                </div>
            )}
        </div>
    );
}
