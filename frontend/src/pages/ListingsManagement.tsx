/**
 * Página de Gestión de Listados (Master Table).
 * 
 * Diseño premium con vista empresarial/cliente, heatmap y exportación.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PredictiveSearchInput } from '@/components/PredictiveSearchInput';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
    SortAsc,
    FileText,
    FileSpreadsheet,
    Briefcase,
    User,
    Thermometer,
    Undo2,
    Redo2,
    Trash2,
    Check
} from 'lucide-react';
import {
    useInfiniteMasterProducts,
    usePriceStats,
    useExportAdvanced,
    useExportAdvancedForPrint,
    useUpdateMargin,
    useUpdateFinalPrice,
    useBulkUpdateMargin,
    useBulkRename,
    useBulkDelete,
    useRestoreProducts
} from '../services/queries';
import { useHistory } from '../hooks/useHistory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useExportConfig } from '@/contexts/ExportConfigContext';
import { ExportPreviewDialog } from '@/components/ExportPreviewDialog';

interface MasterProduct {
    id: number;
    clean_code: string;
    description: string;
    brand: string | null;
    original_list_name: string;
    price_usd: number;
    margin_percentage: number | null;
    final_price: number | null;
    review_status?: 'pending' | 'confirmed' | 'rejected';
}

const ROW_HEIGHT_DESKTOP = 56;
const ROW_HEIGHT_MOBILE_ESTIMATE = 220; // Estimate for initial render, actual height measured dynamically

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

export function ListingsManagementPage({ onNavigate: _onNavigate }: ListingsManagementPageProps) {
    const isMobile = useIsMobile();

    const [view, setView] = useState<'business' | 'client'>('business');
    const [heatmapEnabled, setHeatmapEnabled] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [sortBy, setSortBy] = useState<'alpha' | 'brand' | 'price'>('alpha');
    const [editingCell, setEditingCell] = useState<{ id: number; field: 'margin' | 'finalPrice' } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [exportingFormat, setExportingFormat] = useState<'pdf' | 'excel' | null>(null);

    // Export preview state
    const [showExportPreview, setShowExportPreview] = useState(false);
    const [exportPreviewFormat, setExportPreviewFormat] = useState<'pdf' | 'excel'>('pdf');

    // Bulk operations state
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkMargin, setBulkMargin] = useState('');
    const [replaceText, setReplaceText] = useState('');
    const [deletionMode, setDeletionMode] = useState(false);

    // Export configuration from context
    const { config: exportConfig } = useExportConfig();

    // Undo/Redo system
    const history = useHistory();

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
    const bulkUpdateMarginMutation = useBulkUpdateMargin();
    const bulkRenameMutation = useBulkRename();
    const bulkDeleteMutation = useBulkDelete();
    const restoreProductsMutation = useRestoreProducts();


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

    // Virtualizer for table rows with dynamic height measurement for mobile
    const rowVirtualizer = useVirtualizer({
        count: products.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => isMobile ? ROW_HEIGHT_MOBILE_ESTIMATE : ROW_HEIGHT_DESKTOP,
        overscan: 10,
        measureElement: isMobile ? (element) => {
            // Dynamically measure element height on mobile for variable content
            return element?.getBoundingClientRect().height ?? ROW_HEIGHT_MOBILE_ESTIMATE;
        } : undefined,
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

    // Selection handlers
    const toggleSelection = useCallback((id: number) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    }, []);

    const handleSelectAll = useCallback(() => {
        if (selectedIds.size === products.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(products.map(p => p.id)));
        }
    }, [selectedIds.size, products]);

    // Bulk margin update handler
    const handleBulkMarginUpdate = useCallback(async () => {
        const margin = parseFloat(bulkMargin);
        if (isNaN(margin)) {
            alert('Por favor ingresa un margen válido');
            return;
        }

        try {
            const result = await bulkUpdateMarginMutation.mutateAsync({
                margin_percentage: margin,
                search: debouncedSearch || undefined
            });

            // Push to history for undo
            history.pushAction({
                type: 'MARGIN_UPDATE',
                timestamp: new Date(),
                affectedIds: result.updated_ids,
                previousValues: result.previous_values,
                newValues: result.updated_ids.map((id: number) => ({
                    id,
                    margin_percentage: margin,
                    final_price: null  // Will be recalculated
                })),
                description: `Margen actualizado a ${margin}%`
            });

            setBulkMargin('');
            alert(`${result.updated_count} productos actualizados`);
        } catch {
            alert('Error al actualizar márgenes');
        }
    }, [bulkMargin, debouncedSearch, bulkUpdateMarginMutation, history]);

    // Bulk rename handler
    const handleBulkRename = useCallback(async () => {
        if (!searchInput.trim()) {
            alert('Por favor ingresa texto en el buscador');
            return;
        }

        try {
            const result = await bulkRenameMutation.mutateAsync({
                target_text: searchInput,
                replacement_text: replaceText,
                search: debouncedSearch || undefined
            });

            // Push to history for undo
            history.pushAction({
                type: 'RENAME',
                timestamp: new Date(),
                affectedIds: result.updated_ids,
                previousValues: result.previous_values,
                description: `Reemplazado "${searchInput}" por "${replaceText}"`
            });

            setReplaceText('');
            alert(`${result.updated_count} productos actualizados`);
        } catch {
            alert('Error al renombrar productos');
        }
    }, [searchInput, replaceText, debouncedSearch, bulkRenameMutation, history]);

    // Bulk delete handler
    const handleBulkDelete = useCallback(async () => {
        if (selectedIds.size === 0) {
            alert('Por favor selecciona productos para eliminar');
            return;
        }

        if (!confirm(`¿Eliminar ${selectedIds.size} productos seleccionados?`)) {
            return;
        }

        try {
            const result = await bulkDeleteMutation.mutateAsync({
                productIds: Array.from(selectedIds)
            });

            // Push to history for undo
            history.pushAction({
                type: 'DELETE',
                timestamp: new Date(),
                affectedIds: Array.from(selectedIds),
                previousValues: result.deleted_products,
                description: `Eliminados ${result.deleted_count} productos`
            });

            setSelectedIds(new Set());
            alert(`${result.deleted_count} productos eliminados`);
        } catch {
            alert('Error al eliminar productos');
        }
    }, [selectedIds, bulkDeleteMutation, history]);

    // Undo/Redo handlers
    const handleUndo = useCallback(async () => {
        const action = history.getUndoAction();
        if (!action) return;

        try {
            await restoreProductsMutation.mutateAsync({
                products: action.previousValues
            });
            history.undo();
        } catch {
            alert('Error al deshacer');
        }
    }, [history, restoreProductsMutation]);

    const handleRedo = useCallback(async () => {
        const action = history.getRedoAction();
        if (!action) return;

        try {
            if (action.type === 'DELETE') {
                // For delete, redo means delete again
                await bulkDeleteMutation.mutateAsync({
                    productIds: action.affectedIds
                });
            } else {
                // For other operations, restore new values
                await restoreProductsMutation.mutateAsync({
                    products: action.newValues || []
                });
            }
            history.redo();
        } catch {
            alert('Error al rehacer');
        }
    }, [history, restoreProductsMutation, bulkDeleteMutation]);


    // Advanced export mutations
    const exportAdvancedMutation = useExportAdvanced();
    const exportForPrintMutation = useExportAdvancedForPrint();


    // Map frontend sort values to backend API values
    const mapSortBy = (sort: 'alpha' | 'brand' | 'price'): 'alphabetical' | 'brand' | 'price' => {
        if (sort === 'alpha') return 'alphabetical';
        return sort;
    };

    const handleExportPDF = useCallback(async () => {
        // Show preview instead of direct export
        setExportPreviewFormat('pdf');
        setShowExportPreview(true);
    }, []);

    const handleExportPDFConfirmed = useCallback(async () => {
        try {
            setExportingFormat('pdf');
            const viewMode = view === 'business' ? 'enterprise' : 'client';

            // Context-aware export: pass search filter if searchInput is non-empty
            const exportSearch = searchInput.trim() ? debouncedSearch : undefined;

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
                    search: exportSearch,
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
                    search: exportSearch,
                    format: 'pdf',
                });
            }
        } catch {
            alert('Error al exportar PDF');
        } finally {
            setExportingFormat(null);
        }
    }, [exportAdvancedMutation, view, sortBy, exportConfig, searchInput, debouncedSearch]);

    const handleExportExcel = useCallback(async () => {
        // Show preview instead of direct export
        setExportPreviewFormat('excel');
        setShowExportPreview(true);
    }, []);

    const handleExportExcelConfirmed = useCallback(async () => {
        try {
            setExportingFormat('excel');
            const viewMode = view === 'business' ? 'enterprise' : 'client';

            // Context-aware export: pass search filter if searchInput is non-empty
            const exportSearch = searchInput.trim() ? debouncedSearch : undefined;

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
                    search: exportSearch,
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
                    search: exportSearch,
                    format: 'excel',
                });
            }
        } catch {
            alert('Error al exportar Excel');
        } finally {
            setExportingFormat(null);
        }
    }, [exportAdvancedMutation, view, sortBy, exportConfig, searchInput, debouncedSearch]);

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
                            {/* Search Bar with Markov Predictions */}
                            <PredictiveSearchInput
                                value={searchInput}
                                onChange={(val) => setSearchInput(val)}
                                placeholder="Buscar productos..."
                            />

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

                            {/* Export Buttons */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleExportPDF}
                                    disabled={exportingFormat !== null}
                                    className="gap-2"
                                >
                                    {exportingFormat === 'pdf' ? (
                                        <>
                                            <div className="h-4 w-4 border-2 border-t-transparent border-primary rounded-full animate-spin" />
                                            Exportando...
                                        </>
                                    ) : (
                                        <>
                                            <FileText className="h-4 w-4" />
                                            PDF
                                        </>
                                    )}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleExportExcel}
                                    disabled={exportingFormat !== null}
                                    className="gap-2"
                                >
                                    {exportingFormat === 'excel' ? (
                                        <>
                                            <div className="h-4 w-4 border-2 border-t-transparent border-primary rounded-full animate-spin" />
                                            Exportando...
                                        </>
                                    ) : (
                                        <>
                                            <FileSpreadsheet className="h-4 w-4" />
                                            Excel
                                        </>
                                    )}
                                </Button>
                            </div>

                            {/* Undo/Redo Buttons */}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleUndo}
                                    disabled={!history.canUndo}
                                    className="flex items-center gap-2"
                                    title="Deshacer"
                                >
                                    <Undo2 className="h-4 w-4" />
                                    {!isMobile && 'Deshacer'}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRedo}
                                    disabled={!history.canRedo}
                                    className="flex items-center gap-2"
                                    title="Rehacer"
                                >
                                    <Redo2 className="h-4 w-4" />
                                    {!isMobile && 'Rehacer'}
                                </Button>
                            </div>
                        </div>

                        {/* Bulk Operations Section */}
                        {view === 'business' && (
                            <div className="flex flex-col lg:flex-row gap-3 pt-3 mt-2 border-t border-border/50">
                                {/* Bulk Margin Update */}
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium whitespace-nowrap">Margen masivo:</label>
                                    <Input
                                        type="number"
                                        placeholder="%"
                                        value={bulkMargin}
                                        onFocus={() => {
                                            if (!bulkMargin) setBulkMargin('0.00');
                                        }}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            const numValue = parseFloat(value);
                                            if (value === '' || (numValue >= 0 && numValue <= 100)) {
                                                setBulkMargin(value);
                                            }
                                        }}
                                        className="w-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleBulkMarginUpdate}
                                        disabled={!bulkMargin}
                                    >
                                        Aplicar a Todos
                                    </Button>
                                </div>

                                {/* Find & Replace - Uses main search */}
                                <div className="flex items-center gap-2 flex-1">
                                    <label className="text-sm font-medium whitespace-nowrap">Reemplazar con:</label>
                                    <Input
                                        placeholder="Nuevo texto"
                                        value={replaceText}
                                        onChange={(e) => setReplaceText(e.target.value)}
                                        className="flex-1 min-w-[80px]"
                                    />
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleBulkRename}
                                        disabled={!searchInput || !replaceText}
                                    >
                                        Ejecutar
                                    </Button>
                                </div>

                                {/* Deletion Mode Toggle */}
                                <Button
                                    variant={deletionMode ? "destructive" : "outline"}
                                    size="sm"
                                    onClick={() => {
                                        if (deletionMode && selectedIds.size > 0) {
                                            handleBulkDelete();
                                        } else {
                                            setDeletionMode(!deletionMode);
                                            if (deletionMode) setSelectedIds(new Set());
                                        }
                                    }}
                                    className="gap-2"
                                    title={deletionMode && selectedIds.size > 0 ? "Eliminar seleccionados" : deletionMode ? "Cancelar eliminación" : "Activar modo eliminación"}
                                >
                                    <Trash2 className="h-4 w-4" />
                                    {deletionMode && selectedIds.size > 0 && `(${selectedIds.size})`}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Selection Floating Action Bar */}
                {selectedIds.size > 0 && (
                    <div className="fixed bottom-6 right-6 bg-card border border-border rounded-lg shadow-2xl p-4 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-4">
                        <span className="text-sm font-medium">
                            {selectedIds.size} seleccionado{selectedIds.size > 1 ? 's' : ''}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedIds(new Set())}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleBulkDelete}
                                className="gap-2"
                            >
                                <Trash2 className="h-4 w-4" />
                                Eliminar
                            </Button>
                        </div>
                    </div>
                )}

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
                                ? (deletionMode ? "grid-cols-[40px_40px_100px_1fr_100px_80px_70px_60px_70px]" : "grid-cols-[40px_100px_1fr_100px_80px_70px_60px_70px]")
                                : (deletionMode ? "grid-cols-[40px_40px_100px_1fr_100px_80px]" : "grid-cols-[40px_100px_1fr_100px_80px]")
                        )}>
                            {deletionMode && (
                                <div className="flex items-center justify-center">
                                    <Checkbox
                                        checked={selectedIds.size === products.length && products.length > 0}
                                        onCheckedChange={handleSelectAll}
                                    />
                                </div>
                            )}
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
                                        ref={rowVirtualizer.measureElement}
                                        data-index={virtualRow.index}
                                        className="absolute w-full"
                                        style={{
                                            transform: `translateY(${virtualRow.start}px)`,
                                        }}
                                    >
                                        {/* Mobile Card Layout - Redesigned */}
                                        <div className="md:hidden p-2">
                                            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                                                {/* Card Header - Product Name + List Badge + Delete Action */}
                                                <div className="px-4 py-3 bg-secondary/40 border-b border-border/50">
                                                    <div className="flex items-start gap-3">
                                                        {/* Delete checkbox - only in business view and when deletion mode is active */}
                                                        {view === 'business' && deletionMode && (
                                                            <button
                                                                onClick={() => toggleSelection(product.id)}
                                                                className={cn(
                                                                    "flex-shrink-0 mt-0.5 w-6 h-6 rounded-md border flex items-center justify-center transition-all",
                                                                    selectedIds.has(product.id)
                                                                        ? "bg-destructive border-destructive text-destructive-foreground"
                                                                        : "border-border hover:border-destructive hover:bg-destructive/10"
                                                                )}
                                                            >
                                                                {selectedIds.has(product.id) ? (
                                                                    <Check className="h-4 w-4" />
                                                                ) : (
                                                                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                                                                )}
                                                            </button>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-foreground text-sm leading-snug">
                                                                {product.description || 'Sin descripción'}
                                                            </p>
                                                        </div>
                                                        <Badge variant="outline" className="text-[10px] shrink-0 px-2 py-0.5 bg-background">
                                                            {product.original_list_name?.split('.')[0]?.slice(0, 15) || 'N/A'}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                {/* Card Body */}
                                                <div className="px-4 py-3 space-y-3">
                                                    {/* Metadata Row - Code, Brand, Index */}
                                                    <div className="flex items-center gap-2 flex-wrap text-xs">
                                                        <span className="bg-secondary text-muted-foreground px-2 py-0.5 rounded font-mono">
                                                            #{rowIndex}
                                                        </span>
                                                        {product.clean_code && (
                                                            <span className="text-muted-foreground font-mono">
                                                                {product.clean_code}
                                                            </span>
                                                        )}
                                                        {product.brand && (
                                                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">
                                                                {product.brand}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Pricing Section */}
                                                    <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
                                                        {/* Business view: Base USD + Margin */}
                                                        {view === 'business' && (
                                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                                <div className="flex flex-col">
                                                                    <span className="text-muted-foreground mb-0.5">Base USD</span>
                                                                    <span className={cn("font-mono font-medium", getHeatmapClass(Number(product.price_usd) || 0))}>
                                                                        ${(Number(product.price_usd) || 0).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-muted-foreground mb-0.5">Margen</span>
                                                                    {editingCell?.id === product.id && editingCell?.field === 'margin' ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <Input
                                                                                type="number"
                                                                                value={editValue}
                                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                                onKeyDown={handleKeyDown}
                                                                                className="w-14 h-6 text-xs px-1"
                                                                                autoFocus
                                                                            />
                                                                            <span className="text-muted-foreground">%</span>
                                                                            <Button size="sm" onClick={handleCellSave} className="h-6 w-6 p-0">
                                                                                ✓
                                                                            </Button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => handleCellEdit(product.id, 'margin', Number(product.margin_percentage) || 0)}
                                                                            className="text-accent font-mono font-medium underline underline-offset-2 text-left"
                                                                        >
                                                                            {(Number(product.margin_percentage) || 0).toFixed(2)}%
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Final Price - Prominent */}
                                                        <div className="flex items-center justify-between pt-2 border-t border-border/30">
                                                            <span className="text-sm font-medium text-muted-foreground">Precio:</span>
                                                            {editingCell?.id === product.id && editingCell?.field === 'finalPrice' ? (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-muted-foreground">$</span>
                                                                    <Input
                                                                        type="number"
                                                                        value={editValue}
                                                                        onChange={(e) => setEditValue(e.target.value)}
                                                                        onKeyDown={handleKeyDown}
                                                                        className="w-20 h-8 text-sm px-2"
                                                                        autoFocus
                                                                    />
                                                                    <Button size="sm" onClick={handleCellSave} className="h-8 w-8 p-0">
                                                                        ✓
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleCellEdit(product.id, 'finalPrice', Number(product.final_price) || Number(product.price_usd) || 0)}
                                                                    className={cn(
                                                                        "text-xl font-bold",
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
                                        </div>

                                        {/* Desktop Table Row */}
                                        <div className={cn(
                                            "hidden md:grid p-4 border-b border-border text-sm min-w-[600px]",
                                            view === 'business'
                                                ? (deletionMode ? "grid-cols-[40px_40px_100px_1fr_100px_80px_70px_60px_70px]" : "grid-cols-[40px_100px_1fr_100px_80px_70px_60px_70px]")
                                                : (deletionMode ? "grid-cols-[40px_40px_100px_1fr_100px_80px]" : "grid-cols-[40px_100px_1fr_100px_80px]")
                                        )}>
                                            {/* Checkbox */}
                                            {deletionMode && (
                                                <div className="flex items-center justify-center">
                                                    <Checkbox
                                                        checked={selectedIds.has(product.id)}
                                                        onCheckedChange={() => toggleSelection(product.id)}
                                                    />
                                                </div>
                                            )}

                                            {/* Row Number */}
                                            <div className="text-center text-muted-foreground">
                                                {rowIndex}
                                            </div>
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
                    </div>

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
                </Card>
            </div>

            {/* Export Preview Dialog */}
            <ExportPreviewDialog
                open={showExportPreview}
                onClose={() => setShowExportPreview(false)}
                format={exportPreviewFormat}
                view={view}
                products={products}
                totalProducts={totalProducts}
                headerContent={exportConfig.manualHeader.content}
                onExport={exportPreviewFormat === 'pdf' ? handleExportPDFConfirmed : handleExportExcelConfirmed}
                onPrint={async () => {
                    const viewMode = view === 'business' ? 'enterprise' : 'client';
                    const exportSearch = searchInput.trim() ? debouncedSearch : undefined;
                    await exportForPrintMutation.mutateAsync({
                        filename: exportConfig.filename,
                        header_mode: 'manual',
                        manual_header: {
                            content: exportConfig.manualHeader.content,
                            alignment: exportConfig.manualHeader.alignment,
                        },
                        view_mode: viewMode,
                        sort_by: mapSortBy(sortBy),
                        search: exportSearch,
                        format: 'pdf',
                    });
                }}
            />
        </div>
    );
}
