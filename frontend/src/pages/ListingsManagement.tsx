/**
 * Página de Gestión de Listados (Master Table).
 * 
 * Diseño premium con vista empresarial/cliente, heatmap y exportación.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
    Search,
    SortAsc,
    FileDown,
    FileSpreadsheet,
    Briefcase,
    User,
    Thermometer,
} from 'lucide-react';
import { useInfiniteMasterProducts, usePriceStats, useExportPDF, useExportExcel, useUpdateMargin, useUpdateFinalPrice } from '../services/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface MasterProduct {
    id: number;
    clean_code: string;
    description: string;
    brand: string | null;
    original_list_name: string;
    price_usd: number;
    margin_percentage: number | null;
    final_price: number | null;
}

const ROW_HEIGHT = 56; // Fixed row height for virtualization

export function ListingsManagementPage() {
    const [view, setView] = useState<'business' | 'client'>('business');
    const [heatmapEnabled, setHeatmapEnabled] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [sortBy, setSortBy] = useState<'alpha' | 'brand' | 'price'>('alpha');
    const [editingCell, setEditingCell] = useState<{ id: number; field: 'margin' | 'finalPrice' } | null>(null);
    const [editValue, setEditValue] = useState('');

    // Debounce search to avoid too many API calls
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Update debounced search after 300ms of no typing
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Map frontend sort values to backend values
    const getSortByParam = () => {
        switch (sortBy) {
            case 'alpha': return 'alphabetical';
            case 'brand': return 'brand';
            case 'price': return 'price';
            default: return 'alphabetical';
        }
    };

    // Fetch from server with filters
    const {
        data: productsData,
        isLoading,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteMasterProducts({
        viewMode: view === 'business' ? 'enterprise' : 'client',
        sortBy: getSortByParam() as 'alphabetical' | 'brand' | 'price',
        search: debouncedSearch || undefined,
    });

    const { data: statsData } = usePriceStats();
    const viewModeForExport = view === 'business' ? 'enterprise' : 'client';
    const exportPDFMutation = useExportPDF(viewModeForExport);
    const exportExcelMutation = useExportExcel(viewModeForExport);
    const updateMarginMutation = useUpdateMargin();
    const updateFinalPriceMutation = useUpdateFinalPrice();

    // Ref for virtualization container
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Flatten all pages of products (already filtered and sorted by server)
    const products: MasterProduct[] = useMemo(() => {
        if (!productsData?.pages) return [];
        return productsData.pages.flatMap(page => page.products) as MasterProduct[];
    }, [productsData?.pages]);

    const totalProducts = productsData?.pages?.[0]?.total || 0;
    const priceRange = { min: statsData?.min_price || 0, max: statsData?.max_price || 1000 };

    const getHeatmapClass = (price: number) => {
        if (!heatmapEnabled) return '';
        const range = priceRange.max - priceRange.min;
        if (range === 0) return '';
        const ratio = (price - priceRange.min) / range;
        if (ratio <= 0.33) return 'heatmap-low';
        if (ratio <= 0.66) return 'heatmap-medium';
        return 'heatmap-high';
    };

    // Virtualizer for table rows
    const rowVirtualizer = useVirtualizer({
        count: products.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 10, // Render 10 extra rows for smooth scrolling
    });

    // Infinite scroll: fetch more when near the end
    useEffect(() => {
        const virtualItems = rowVirtualizer.getVirtualItems();
        const lastItem = virtualItems[virtualItems.length - 1];

        if (!lastItem) return;

        // If we're within 50 items of the end and have more to fetch
        if (
            lastItem.index >= products.length - 50 &&
            hasNextPage &&
            !isFetchingNextPage
        ) {
            fetchNextPage();
        }
    }, [
        rowVirtualizer.getVirtualItems(),
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
        products.length,
    ]);

    const handleCellEdit = useCallback((id: number, field: 'margin' | 'finalPrice', currentValue: number) => {
        setEditingCell({ id, field });
        setEditValue(currentValue?.toString() || '0');
    }, []);

    const handleCellSave = useCallback(async () => {
        if (!editingCell) return;

        // Allow saving even if value is empty/NaN - default to 0
        const parsedValue = parseFloat(editValue);
        const value = isNaN(parsedValue) ? 0 : parsedValue;

        try {
            if (editingCell.field === 'margin') {
                await updateMarginMutation.mutateAsync({
                    productId: editingCell.id,
                    margin_percentage: value,
                });
            } else {
                await updateFinalPriceMutation.mutateAsync({
                    productId: editingCell.id,
                    final_price: value,
                });
            }
        } catch {
            alert('Error al guardar cambios');
        }

        setEditingCell(null);
    }, [editingCell, editValue, updateMarginMutation, updateFinalPriceMutation]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCellSave();
        } else if (e.key === 'Escape') {
            setEditingCell(null);
        }
    };

    const handleExportPDF = useCallback(async () => {
        try {
            await exportPDFMutation.mutateAsync();
        } catch {
            alert('Error al exportar PDF');
        }
    }, [exportPDFMutation]);

    const handleExportExcel = useCallback(async () => {
        try {
            await exportExcelMutation.mutateAsync();
        } catch {
            alert('Error al exportar Excel');
        }
    }, [exportExcelMutation]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-muted-foreground animate-pulse">Cargando listados...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-destructive">Error al cargar listados: {error.message}</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 pb-24">
            <div className="animate-slide-up">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <h1 className="font-display text-3xl font-bold text-foreground">
                        Gestión de Listados
                    </h1>

                    {/* View Toggle */}
                    <div className="flex items-center gap-2 p-1 rounded-lg bg-secondary">
                        <Button
                            variant={view === 'business' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setView('business')}
                            className="gap-2"
                        >
                            <Briefcase className="h-4 w-4" />
                            Vista Empresarial
                        </Button>
                        <Button
                            variant={view === 'client' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setView('client')}
                            className="gap-2"
                        >
                            <User className="h-4 w-4" />
                            Vista Cliente
                        </Button>
                    </div>
                </div>

                {/* Filters and Actions */}
                <Card variant="glass" className="mb-6">
                    <CardContent className="p-4">
                        <div className="flex flex-col lg:flex-row gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar productos..."
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    className="pl-10"
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Select value={sortBy} onValueChange={(v: 'alpha' | 'brand' | 'price') => setSortBy(v)}>
                                    <SelectTrigger className="w-[140px]">
                                        <SortAsc className="h-4 w-4 mr-2" />
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="alpha">Alfabético</SelectItem>
                                        <SelectItem value="brand">Por Marca</SelectItem>
                                        <SelectItem value="price">Por Precio</SelectItem>
                                    </SelectContent>
                                </Select>

                                {view === 'business' && (
                                    <Button
                                        variant={heatmapEnabled ? 'default' : 'outline'}
                                        onClick={() => setHeatmapEnabled(!heatmapEnabled)}
                                        className="gap-2"
                                    >
                                        <Thermometer className="h-4 w-4" />
                                        Heatmap
                                    </Button>
                                )}

                                <Button
                                    variant="outline"
                                    className="gap-2"
                                    onClick={handleExportPDF}
                                    disabled={exportPDFMutation.isPending}
                                >
                                    <FileDown className="h-4 w-4" />
                                    {exportPDFMutation.isPending ? 'Exportando...' : 'PDF'}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="gap-2"
                                    onClick={handleExportExcel}
                                    disabled={exportExcelMutation.isPending}
                                >
                                    <FileSpreadsheet className="h-4 w-4" />
                                    {exportExcelMutation.isPending ? 'Exportando...' : 'Excel'}
                                </Button>
                            </div>
                        </div>

                        {/* Heatmap Legend */}
                        {view === 'business' && heatmapEnabled && (
                            <div className="mt-4 pt-4 border-t border-border animate-fade-in">
                                <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-sm">
                                    <span className="text-muted-foreground w-full sm:w-auto">Leyenda:</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-success/20" />
                                        <span className="text-success text-xs sm:text-sm">25% más barato</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-warning/20" />
                                        <span className="text-warning text-xs sm:text-sm">Precio medio</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-destructive/20" />
                                        <span className="text-destructive text-xs sm:text-sm">25% más caro</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Virtualized Master Table */}
                <Card variant="glass" className="overflow-hidden">
                    {/* Table Header */}
                    <div className="bg-secondary">
                        <div className={cn(
                            "grid p-4 text-sm font-medium text-foreground",
                            view === 'business'
                                ? "grid-cols-[50px_140px_1fr_140px_100px_90px_70px_90px]"
                                : "grid-cols-[50px_140px_1fr_140px_90px]"
                        )}>
                            <div className="text-center">N°</div>
                            <div className="text-center">Código</div>
                            <div className="text-center">Descripción</div>
                            <div className="text-center">Marca</div>
                            {view === 'business' && (
                                <>
                                    <div className="text-center">Empresa</div>
                                    <div className="text-center">USD</div>
                                    <div className="text-center">%</div>
                                </>
                            )}
                            <div className="text-center">{view === 'business' ? 'USD Final' : 'USD'}</div>
                        </div>
                    </div>

                    {/* Virtualized Table Body */}
                    <div
                        ref={tableContainerRef}
                        className="overflow-auto"
                        style={{ height: 'calc(100vh - 400px)', minHeight: '400px' }}
                    >
                        <div
                            style={{
                                height: `${rowVirtualizer.getTotalSize()}px`,
                                width: '100%',
                                position: 'relative',
                            }}
                        >
                            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                const product = products[virtualRow.index];
                                const rowIndex = virtualRow.index + 1;

                                return (
                                    <div
                                        key={product.id}
                                        className={cn(
                                            "grid items-center p-4 border-b border-border hover:bg-secondary/50 absolute w-full",
                                            view === 'business'
                                                ? "grid-cols-[50px_140px_1fr_140px_100px_90px_70px_90px]"
                                                : "grid-cols-[50px_140px_1fr_140px_90px]"
                                        )}
                                        style={{
                                            height: `${virtualRow.size}px`,
                                            transform: `translateY(${virtualRow.start}px)`,
                                            contain: 'layout style paint',
                                        }}
                                    >
                                        <div className="text-center text-muted-foreground">{rowIndex}</div>
                                        <div className="text-center font-mono text-foreground truncate">{product.clean_code}</div>
                                        <div className="text-foreground truncate">{product.description}</div>
                                        <div className="text-center text-muted-foreground truncate">{product.brand}</div>
                                        {view === 'business' && (
                                            <>
                                                <div className="truncate">
                                                    <Badge variant="outline" className="text-xs truncate max-w-full">
                                                        {product.original_list_name || 'N/A'}
                                                    </Badge>
                                                </div>
                                                <div className={cn('text-center font-medium', getHeatmapClass(Number(product.price_usd) || 0))}>
                                                    ${(Number(product.price_usd) || 0).toFixed(2)}
                                                </div>
                                                <div className="text-center">
                                                    {editingCell?.id === product.id && editingCell?.field === 'margin' ? (
                                                        <Input
                                                            type="number"
                                                            step="0.1"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            onBlur={handleCellSave}
                                                            onKeyDown={handleKeyDown}
                                                            className="h-9 w-16 text-center text-base font-medium bg-background border-2 border-accent focus:border-accent focus:ring-2 focus:ring-accent/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <button
                                                            onClick={() => handleCellEdit(product.id, 'margin', Number(product.margin_percentage) || 0)}
                                                            className="px-2 py-1 rounded hover:bg-secondary transition-colors text-accent cursor-pointer"
                                                        >
                                                            {(Number(product.margin_percentage) || 0).toFixed(1)}%
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                        <div className="text-center">
                                            {editingCell?.id === product.id && editingCell?.field === 'finalPrice' ? (
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={handleCellSave}
                                                    onKeyDown={handleKeyDown}
                                                    className="h-9 w-20 text-right text-base font-medium bg-background border-2 border-success focus:border-success focus:ring-2 focus:ring-success/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    autoFocus
                                                />
                                            ) : view === 'business' ? (
                                                <button
                                                    onClick={() => handleCellEdit(product.id, 'finalPrice', Number(product.final_price) || Number(product.price_usd) || 0)}
                                                    className="px-2 py-1 rounded hover:bg-secondary transition-colors font-semibold text-success cursor-pointer"
                                                >
                                                    ${(Number(product.final_price) || Number(product.price_usd) || 0).toFixed(2)}
                                                </button>
                                            ) : (
                                                <span className="font-semibold text-foreground">
                                                    ${(Number(product.final_price) || Number(product.price_usd) || 0).toFixed(2)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Product Count Footer */}
                    {products.length > 0 && (
                        <div className="p-4 border-t border-border text-sm text-muted-foreground flex items-center justify-between">
                            <span>
                                {products.length} de {totalProducts} productos cargados
                                {debouncedSearch && ` (búsqueda: "${debouncedSearch}")`}
                            </span>
                            {isFetchingNextPage && (
                                <span className="animate-pulse">Cargando más...</span>
                            )}
                            {!hasNextPage && products.length > 0 && (
                                <span className="text-success">Todos los productos cargados</span>
                            )}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
