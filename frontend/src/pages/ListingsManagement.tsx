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
    Settings,
} from 'lucide-react';
import { useInfiniteMasterProducts, usePriceStats, useExportAdvanced, useUpdateMargin, useUpdateFinalPrice } from '../services/queries';
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
import { useExportConfig } from '@/contexts/ExportConfigContext';

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

const ROW_HEIGHT_DESKTOP = 56;
const ROW_HEIGHT_MOBILE = 200; // Increased for card layout

// Hook to detect mobile viewport
function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return isMobile;
}

type Page = 'lists' | 'products' | 'management' | 'export-settings';

interface ListingsManagementPageProps {
    onNavigate?: (page: Page) => void;
}

export function ListingsManagementPage({ onNavigate }: ListingsManagementPageProps) {
    const isMobile = useIsMobile();
    const rowHeight = isMobile ? ROW_HEIGHT_MOBILE : ROW_HEIGHT_DESKTOP;

    const [view, setView] = useState<'business' | 'client'>('business');
    const [heatmapEnabled, setHeatmapEnabled] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [sortBy, setSortBy] = useState<'alpha' | 'brand' | 'price'>('alpha');
    const [editingCell, setEditingCell] = useState<{ id: number; field: 'margin' | 'finalPrice' } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [exportingFormat, setExportingFormat] = useState<'pdf' | 'excel' | null>(null);

    // Export configuration from context
    const { config: exportConfig } = useExportConfig();

    // Debounce search to avoid too many API calls
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Update debounced search after 300ms of no typing
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Convert sortBy to API param
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
        estimateSize: () => rowHeight,
        overscan: 10,
    });

    // Force recalculate virtualizer when mobile state or editing changes
    useEffect(() => {
        rowVirtualizer.measure();
    }, [isMobile, editingCell, rowVirtualizer]);

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

    // Advanced export mutation
    const exportAdvancedMutation = useExportAdvanced();


    // Map frontend sort values to backend API values
    const mapSortBy = (sort: 'alpha' | 'brand' | 'price'): 'alphabetical' | 'brand' | 'price' => {
        if (sort === 'alpha') return 'alphabetical';
        return sort;
    };

    const handleExportPDF = useCallback(async () => {
        try {
            setExportingFormat('pdf');
            const viewMode = view === 'business' ? 'enterprise' : 'client';

            // Use advanced export if template is configured
            if (exportConfig.headerMode === 'template' && exportConfig.templateFile) {
                await exportAdvancedMutation.mutateAsync({
                    filename: exportConfig.filename,
                    header_mode: 'template',
                    template_file: {
                        name: exportConfig.templateFile.name,
                        type: exportConfig.templateFile.type,
                        data: exportConfig.templateFile.data,
                    },
                    view_mode: viewMode,
                    sort_by: mapSortBy(sortBy),
                    format: 'pdf',
                });
            } else {
                // Use advanced export with manual header - separate filename and header content
                await exportAdvancedMutation.mutateAsync({
                    filename: exportConfig.filename,
                    header_mode: 'manual',
                    manual_header: {
                        content: exportConfig.manualHeader.content,
                        alignment: exportConfig.manualHeader.alignment,
                    },
                    view_mode: viewMode,
                    sort_by: mapSortBy(sortBy),
                    format: 'pdf',
                });
            }
        } catch {
            alert('Error al exportar PDF');
        } finally {
            setExportingFormat(null);
        }
    }, [exportAdvancedMutation, view, sortBy, exportConfig]);

    const handleExportExcel = useCallback(async () => {
        try {
            setExportingFormat('excel');
            const viewMode = view === 'business' ? 'enterprise' : 'client';

            // Use advanced export if template is configured
            if (exportConfig.headerMode === 'template' && exportConfig.templateFile) {
                await exportAdvancedMutation.mutateAsync({
                    filename: exportConfig.filename,
                    header_mode: 'template',
                    template_file: {
                        name: exportConfig.templateFile.name,
                        type: exportConfig.templateFile.type,
                        data: exportConfig.templateFile.data,
                    },
                    view_mode: viewMode,
                    sort_by: mapSortBy(sortBy),
                    format: 'excel',
                });
            } else {
                // Use advanced export with manual header - separate filename and header content
                await exportAdvancedMutation.mutateAsync({
                    filename: exportConfig.filename,
                    header_mode: 'manual',
                    manual_header: {
                        content: exportConfig.manualHeader.content,
                        alignment: exportConfig.manualHeader.alignment,
                    },
                    view_mode: viewMode,
                    sort_by: mapSortBy(sortBy),
                    format: 'excel',
                });
            }
        } catch {
            alert('Error al exportar Excel');
        } finally {
            setExportingFormat(null);
        }
    }, [exportAdvancedMutation, view, sortBy, exportConfig]);

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
                    <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary w-fit">
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

                {/* Filters and Actions - Single row on desktop */}
                <Card variant="glass" className="mb-6">
                    <CardContent className="p-4">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                            {/* Search Bar */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar productos..."
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    className="pl-10"
                                />
                            </div>

                            {/* Sort Dropdown */}
                            <Select value={sortBy} onValueChange={(v: 'alpha' | 'brand' | 'price') => setSortBy(v)}>
                                <SelectTrigger className="w-full lg:w-[140px]">
                                    <SortAsc className="h-4 w-4 mr-2" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="alpha">Alfabético</SelectItem>
                                    <SelectItem value="brand">Por Marca</SelectItem>
                                    <SelectItem value="price">Por Precio</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Heatmap Button */}
                            {view === 'business' && (
                                <Button
                                    variant={heatmapEnabled ? 'default' : 'outline'}
                                    onClick={() => setHeatmapEnabled(!heatmapEnabled)}
                                    className="gap-2"
                                >
                                    <Thermometer className="h-4 w-4" />
                                    <span>Heatmap</span>
                                </Button>
                            )}

                            {/* Export Section */}
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button
                                    variant="premium"
                                    className="gap-2"
                                    onClick={() => onNavigate?.('export-settings')}
                                >
                                    <Settings className="h-4 w-4" />
                                    <span>Opciones de Exportación</span>
                                    {exportConfig.templateFile && (
                                        <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-success/20 text-success">
                                            Plantilla
                                        </span>
                                    )}
                                </Button>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="gap-2 flex-1 sm:flex-none"
                                        onClick={handleExportPDF}
                                        disabled={exportingFormat !== null}
                                    >
                                        <FileDown className="h-4 w-4" />
                                        {exportingFormat === 'pdf' ? 'Exportando...' : 'PDF'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="gap-2 flex-1 sm:flex-none"
                                        onClick={handleExportExcel}
                                        disabled={exportingFormat !== null}
                                    >
                                        <FileSpreadsheet className="h-4 w-4" />
                                        {exportingFormat === 'excel' ? 'Exportando...' : 'Excel'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

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

                {/* Responsive Master Table */}
                <Card variant="glass" className="overflow-hidden">
                    {/* Table Header - Hidden on mobile */}
                    <div className="hidden md:block bg-secondary overflow-x-auto">
                        <div className={cn(
                            "grid p-4 text-sm font-medium text-foreground min-w-[600px]",
                            view === 'business'
                                ? "grid-cols-[40px_100px_1fr_100px_80px_70px_60px_70px]"
                                : "grid-cols-[40px_100px_1fr_100px_80px]"
                        )}>
                            <div className="text-center">N°</div>
                            <div className="text-center">Código</div>
                            <div className="text-center">Descripción</div>
                            <div className="text-center">Marca</div>
                            {view === 'business' && (
                                <>
                                    <div className="text-center">Lista</div>
                                    <div className="text-center">USD</div>
                                    <div className="text-center">%</div>
                                </>
                            )}
                            <div className="text-center">{view === 'business' ? 'Final' : 'USD'}</div>
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
                                        className="absolute w-full"
                                        style={{
                                            height: `${virtualRow.size}px`,
                                            transform: `translateY(${virtualRow.start}px)`,
                                            contain: 'layout style paint',
                                        }}
                                    >
                                        {/* Mobile Card Layout */}
                                        <div className="md:hidden p-3 border-b border-border">
                                            <div className="bg-secondary/30 rounded-lg p-4 space-y-1">
                                                {/* Header Row */}
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-foreground text-sm leading-tight">
                                                            {product.description || 'Sin descripción'}
                                                        </p>
                                                        {product.clean_code && (
                                                            <p className="text-xs text-muted-foreground font-mono mt-1">
                                                                Código: {product.clean_code}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                                                        #{rowIndex}
                                                    </span>
                                                </div>

                                                {/* Info Row */}
                                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                                    {product.brand && (
                                                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">
                                                            {product.brand}
                                                        </span>
                                                    )}
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {product.original_list_name || 'N/A'}
                                                    </Badge>
                                                </div>

                                                {/* Price Row - Editable in both views */}
                                                <div className="pt-2 border-t border-border/50 space-y-2">
                                                    {view === 'business' && (
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-muted-foreground">Base USD:</span>
                                                            <span className={cn("font-medium", getHeatmapClass(Number(product.price_usd) || 0))}>
                                                                ${(Number(product.price_usd) || 0).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Margin - Only in business view */}
                                                    {view === 'business' && (
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-muted-foreground">Margen:</span>
                                                            {editingCell?.id === product.id && editingCell?.field === 'margin' ? (
                                                                <div className="flex items-center gap-1">
                                                                    <Input
                                                                        type="number"
                                                                        value={editValue}
                                                                        onChange={(e) => setEditValue(e.target.value)}
                                                                        onKeyDown={handleKeyDown}
                                                                        className="w-16 h-6 text-xs px-1"
                                                                        autoFocus
                                                                    />
                                                                    <span className="text-muted-foreground">%</span>
                                                                    <Button size="sm" onClick={handleCellSave} className="h-6 px-2 text-xs">
                                                                        ✓
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleCellEdit(product.id, 'margin', Number(product.margin_percentage) || 0)}
                                                                    className="text-accent font-medium underline"
                                                                >
                                                                    {(Number(product.margin_percentage) || 0).toFixed(1)}%
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Final Price - Editable in both views */}
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs text-muted-foreground">Precio:</span>
                                                        {editingCell?.id === product.id && editingCell?.field === 'finalPrice' ? (
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-muted-foreground">$</span>
                                                                <Input
                                                                    type="number"
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    onKeyDown={handleKeyDown}
                                                                    className="w-20 h-7 text-sm px-1"
                                                                    autoFocus
                                                                />
                                                                <Button size="sm" onClick={handleCellSave} className="h-7 px-2 text-xs">
                                                                    ✓
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleCellEdit(product.id, 'finalPrice', Number(product.final_price) || Number(product.price_usd) || 0)}
                                                                className={cn(
                                                                    "text-lg font-bold",
                                                                    view === 'business' ? "text-success" : "text-foreground"
                                                                )}
                                                            >
                                                                ${(Number(product.final_price) || Number(product.price_usd) || 0).toFixed(2)}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Desktop Row Layout */}
                                        <div
                                            className={cn(
                                                "hidden md:grid items-center p-4 border-b border-border hover:bg-secondary/50 h-full min-w-[600px]",
                                                view === 'business'
                                                    ? "grid-cols-[40px_100px_1fr_100px_80px_70px_60px_70px]"
                                                    : "grid-cols-[40px_100px_1fr_100px_80px]"
                                            )}
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
                                                ) : (
                                                    <button
                                                        onClick={() => handleCellEdit(product.id, 'finalPrice', Number(product.final_price) || Number(product.price_usd) || 0)}
                                                        className={cn(
                                                            "px-2 py-1 rounded hover:bg-secondary transition-colors font-semibold cursor-pointer",
                                                            view === 'business' ? "text-success" : "text-foreground"
                                                        )}
                                                    >
                                                        ${(Number(product.final_price) || Number(product.price_usd) || 0).toFixed(2)}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div >

                    {/* Product Count Footer */}
                    {
                        products.length > 0 && (
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
                        )
                    }
                </Card >
            </div >
        </div >
    );
}
