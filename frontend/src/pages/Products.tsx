/**
 * Página de Productos de una Lista.
 * 
 * Diseño premium con tabla editable, selector de lista y animaciones.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
    Search,
    SortAsc,
    Filter,
    Edit2,
    Check,
    X,
    Save,
    AlertTriangle,
    CheckCircle2,
    Package,
    Undo2,
    Redo2,
    Trash2,
} from 'lucide-react';
import { useLists, useInfiniteMasterProducts, useUpdateMasterProduct, useVerifyProduct, useBulkUpdateMargin, useBulkRename, useBulkDelete, useRestoreProducts, useUpdateMargin } from '../services/queries';
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

interface Product {
    id: number;
    index_number: number;
    clean_code: string;
    description: string;
    brand: string | null;
    price_usd: number;
    review_status: 'pending' | 'confirmed' | 'rejected';
    confidence_score: number;
    source_list_id: number;
    original_list_name: string;
    margin_percentage: number | null;
    final_price: number | null;
}

interface ListItem {
    id: number;
    name: string;
    status: string;
    product_count: number;
}

interface ProductsPageProps {
    selectedListId: number | null;
}

const ROW_HEIGHT_DESKTOP = 56;
const ROW_HEIGHT_MOBILE_ESTIMATE = 200; // Estimate for initial render, actual height measured dynamically

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

export function ProductsPage({ selectedListId: initialListId }: ProductsPageProps) {
    const isMobile = useIsMobile();

    const { data: listsData, isLoading: listsLoading } = useLists();
    const [internalListId, setInternalListId] = useState<number | null>(initialListId);

    // Use the internal list id, but prefer the prop if provided
    const activeListId = initialListId || internalListId;

    const [searchInput, setSearchInput] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified'>('all');
    const [sortBy, setSortBy] = useState<'index' | 'alphabetical' | 'brand' | 'price'>('index');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValues, setEditValues] = useState<Partial<Product>>({});
    const [editingCell, setEditingCell] = useState<{ id: number; field: 'margin' } | null>(null);
    const [marginEditValue, setMarginEditValue] = useState('');

    // Debounce search to avoid too many API calls
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Fetch from server with filters and sorting
    const {
        data: productsData,
        isLoading: productsLoading,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteMasterProducts({
        listId: activeListId || undefined,
        search: debouncedSearch || undefined,
        sortBy: sortBy === 'index' ? 'index' : sortBy === 'alphabetical' ? 'alphabetical' : sortBy === 'brand' ? 'brand' : sortBy === 'price' ? 'price' : 'alphabetical',
    });

    const updateProductMutation = useUpdateMasterProduct();
    const verifyProductMutation = useVerifyProduct();
    const bulkUpdateMarginMutation = useBulkUpdateMargin();
    const bulkRenameMutation = useBulkRename();
    const bulkDeleteMutation = useBulkDelete();
    const restoreProductsMutation = useRestoreProducts();
    const updateMarginMutation = useUpdateMargin();

    // Bulk operations state
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkMargin, setBulkMargin] = useState('');
    const [replaceText, setReplaceText] = useState('');
    const [deletionMode, setDeletionMode] = useState(false);

    // Undo/Redo system
    const history = useHistory();

    // Ref for virtualization container
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const lists: ListItem[] = (listsData?.lists || []) as ListItem[];

    // Flatten all pages of products (already filtered and sorted by server - always by index)
    const products: Product[] = useMemo(() => {
        if (!productsData?.pages) return [];
        return productsData.pages.flatMap(page => page.products) as Product[];
    }, [productsData?.pages]);

    const totalProducts = productsData?.pages?.[0]?.total || 0;
    const selectedList = lists.find((l) => l.id === activeListId);

    // Handle list selection change
    const handleListChange = (value: string) => {
        const listId = parseInt(value);
        if (listId) {
            setInternalListId(listId);
            setSearchInput('');
            setStatusFilter('all');
            // Dispatch event for App.tsx to update selectedListId
            window.dispatchEvent(new CustomEvent('selectList', { detail: listId }));
        }
    };

    // Virtualizer for table rows with dynamic height measurement for mobile
    const rowVirtualizer = useVirtualizer({
        count: products.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: () => isMobile ? ROW_HEIGHT_MOBILE_ESTIMATE : ROW_HEIGHT_DESKTOP,
        overscan: 10,
        measureElement: isMobile ? (element) => {
            return element?.getBoundingClientRect().height ?? ROW_HEIGHT_MOBILE_ESTIMATE;
        } : undefined,
    });

    // Force recalculate virtualizer when mobile state or editing changes
    useEffect(() => {
        rowVirtualizer.measure();
    }, [isMobile, editingId, rowVirtualizer]);

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

    // Margin cell editing handlers
    const handleCellEdit = useCallback((id: number, currentValue: number | null) => {
        setEditingCell({ id, field: 'margin' });
        setMarginEditValue(currentValue?.toString() || '0');
    }, []);

    const handleCellSave = useCallback(async () => {
        if (!editingCell) return;
        const parsedValue = parseFloat(marginEditValue);
        const value = isNaN(parsedValue) ? 0 : parsedValue;
        try {
            await updateMarginMutation.mutateAsync({
                productId: editingCell.id,
                margin_percentage: value,
            });
        } catch {
            alert('Error al guardar margen');
        }
        setEditingCell(null);
    }, [editingCell, marginEditValue, updateMarginMutation]);

    const handleMarginKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCellSave();
        } else if (e.key === 'Escape') {
            setEditingCell(null);
        }
    };

    const handleEdit = useCallback((product: Product) => {
        setEditingId(product.id);
        setEditValues(product);
    }, []);

    const handleSave = useCallback(async () => {
        if (editingId && editValues) {
            try {
                await updateProductMutation.mutateAsync({
                    productId: editingId,
                    data: {
                        clean_code: editValues.clean_code,
                        description: editValues.description,
                        brand: editValues.brand ?? undefined,
                        price_usd: editValues.price_usd,
                    },
                });
                setEditingId(null);
                setEditValues({});
            } catch {
                alert('Error al guardar cambios');
            }
        }
    }, [editingId, editValues, updateProductMutation]);

    const handleVerify = useCallback(async (productId: number) => {
        if (activeListId) {
            try {
                await verifyProductMutation.mutateAsync({
                    listId: activeListId,
                    productId,
                });
            } catch {
                alert('Error al verificar producto');
            }
        }
    }, [activeListId, verifyProductMutation]);

    // Toggle selection for deletion
    const toggleSelection = useCallback((id: number) => {
        setSelectedIds((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    }, []);

    // Handle bulk delete
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

            history.pushAction({
                type: 'DELETE',
                timestamp: new Date(),
                affectedIds: Array.from(selectedIds),
                previousValues: result.deleted_products,
                description: `${selectedIds.size} productos eliminados`
            });

            setSelectedIds(new Set());
            setDeletionMode(false);
            alert(`${result.deleted_count} productos eliminados`);
        } catch {
            alert('Error al eliminar productos');
        }
    }, [selectedIds, bulkDeleteMutation, history]);

    // Bulk margin update handler
    const handleBulkMarginUpdate = useCallback(async () => {
        const margin = parseFloat(bulkMargin);
        if (isNaN(margin)) return;
        try {
            const result = await bulkUpdateMarginMutation.mutateAsync({
                margin_percentage: margin,
                search: debouncedSearch || undefined
            });
            history.pushAction({
                type: 'MARGIN_UPDATE',
                timestamp: new Date(),
                affectedIds: result.updated_ids,
                previousValues: result.previous_values,
                newValues: result.updated_ids.map((id: number) => ({ id, margin_percentage: margin })),
                description: `Margen: ${margin}%`
            });
            setBulkMargin('');
        } catch { alert('Error'); }
    }, [bulkMargin, debouncedSearch, bulkUpdateMarginMutation, history]);

    // Bulk rename handler
    const handleBulkRename = useCallback(async () => {
        if (!searchInput.trim()) return;
        try {
            const result = await bulkRenameMutation.mutateAsync({
                target_text: searchInput,
                replacement_text: replaceText,
                search: debouncedSearch || undefined
            });
            history.pushAction({
                type: 'RENAME',
                timestamp: new Date(),
                affectedIds: result.updated_ids,
                previousValues: result.previous_values,
                description: `"${searchInput}" → "${replaceText}"`
            });
            setReplaceText('');
        } catch { alert('Error'); }
    }, [searchInput, replaceText, debouncedSearch, bulkRenameMutation, history]);

    // Undo/Redo handlers
    const handleUndo = useCallback(async () => {
        const action = history.getUndoAction();
        if (!action) return;
        try {
            await restoreProductsMutation.mutateAsync({ products: action.previousValues });
            history.undo();
        } catch { alert('Error'); }
    }, [history, restoreProductsMutation]);

    const handleRedo = useCallback(async () => {
        const action = history.getRedoAction();
        if (!action) return;
        try {
            if (action.type === 'DELETE') {
                await bulkDeleteMutation.mutateAsync({ productIds: action.affectedIds });
            } else {
                await restoreProductsMutation.mutateAsync({ products: action.newValues || [] });
            }
            history.redo();
        } catch { alert('Error'); }
    }, [history, restoreProductsMutation, bulkDeleteMutation]);

    // Memoize status counts to avoid O(2n) iterations on every render
    const { pendingCount, confirmedCount } = useMemo(() => {
        let pending = 0;
        let confirmed = 0;
        for (const p of products) {
            if (p.review_status === 'pending') pending++;
            else if (p.review_status === 'confirmed') confirmed++;
        }
        return { pendingCount: pending, confirmedCount: confirmed };
    }, [products]);

    return (
        <div className="container mx-auto px-4 py-8 pb-24">
            <div className="animate-slide-up">
                <h1 className="font-display text-3xl font-bold text-foreground mb-6">
                    Productos
                </h1>

                {/* List Selector */}
                <Card variant="glass" className="mb-6">
                    <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1">
                                <label className="text-sm font-medium text-foreground mb-2 block">
                                    Seleccionar Lista
                                </label>
                                {listsLoading ? (
                                    <div className="h-10 bg-secondary animate-pulse rounded-md" />
                                ) : (
                                    <Select
                                        value={activeListId?.toString() || ''}
                                        onValueChange={handleListChange}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Elige una lista para ver sus productos" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {lists.map((list) => (
                                                <SelectItem
                                                    key={list.id}
                                                    value={list.id.toString()}
                                                    disabled={list.status === 'processing'}
                                                    className="truncate"
                                                >
                                                    <span className="truncate block">
                                                        {list.name} ({list.product_count} productos)
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                            {selectedList && (
                                <div className="flex gap-2 items-end">
                                    <Badge variant="pending" className="gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        {pendingCount} pendientes
                                    </Badge>
                                    <Badge variant="confirmed" className="gap-1">
                                        <CheckCircle2 className="h-3 w-3" />
                                        {confirmedCount} verificados
                                    </Badge>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Empty State */}
                {!activeListId && (
                    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                        <Package className="h-16 w-16 text-muted-foreground mb-4" />
                        <h2 className="font-display text-xl font-semibold text-foreground mb-2">
                            Selecciona una lista
                        </h2>
                        <p className="text-muted-foreground text-center max-w-md">
                            Elige una lista de precios del selector de arriba para ver y editar
                            sus productos.
                        </p>
                    </div>
                )}

                {/* Loading State */}
                {activeListId && productsLoading && (
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="text-muted-foreground animate-pulse">Cargando productos...</div>
                    </div>
                )}

                {/* Error State */}
                {activeListId && error && (
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="text-destructive">Error al cargar productos: {error.message}</div>
                    </div>
                )}

                {/* Products Table */}
                {activeListId && !productsLoading && !error && (
                    <div className="animate-slide-up">
                        {/* Filters */}
                        <Card variant="glass" className="mb-6">
                            <CardContent className="p-4">
                                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                                    {/* Search Bar */}
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Buscar por código, descripción o marca..."
                                            value={searchInput}
                                            onChange={(e) => setSearchInput(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>

                                    {/* Sort Dropdown */}
                                    <Select value={sortBy} onValueChange={(v: typeof sortBy) => setSortBy(v)}>
                                        <SelectTrigger className="w-full lg:w-[140px]">
                                            <SortAsc className="h-4 w-4 mr-2" />
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="index">Original</SelectItem>
                                            <SelectItem value="alphabetical">Alfabético</SelectItem>
                                            <SelectItem value="brand">Por Marca</SelectItem>
                                            <SelectItem value="price">Por Precio</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {/* Status Filter */}
                                    <Select
                                        value={statusFilter}
                                        onValueChange={(v: typeof statusFilter) => setStatusFilter(v)}
                                    >
                                        <SelectTrigger className="w-full lg:w-[140px]">
                                            <Filter className="h-4 w-4 mr-2" />
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos</SelectItem>
                                            <SelectItem value="pending">Pendientes</SelectItem>
                                            <SelectItem value="verified">Verificados</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {/* Undo/Redo Buttons */}
                                    <div className="flex gap-1">
                                        <Button variant="outline" size="sm" onClick={handleUndo} disabled={!history.canUndo} title="Deshacer" className="flex items-center justify-center">
                                            <Undo2 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={handleRedo} disabled={!history.canRedo} title="Rehacer" className="flex items-center justify-center">
                                            <Redo2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Bulk Operations */}
                                <div className="flex flex-col lg:flex-row gap-3 pt-3 mt-2 border-t border-border/50">
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm font-medium">Margen masivo:</label>
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
                                        <Button variant="outline" size="sm" onClick={handleBulkMarginUpdate} disabled={!bulkMargin}>Aplicar a Todos</Button>
                                    </div>
                                    <div className="flex items-center gap-2 flex-1">
                                        <label className="text-sm font-medium">Reemplazar con:</label>
                                        <Input placeholder="Nuevo texto" value={replaceText} onChange={(e) => setReplaceText(e.target.value)} className="flex-1 min-w-[80px]" />
                                        <Button variant="outline" size="sm" onClick={handleBulkRename} disabled={!searchInput || !replaceText}>Ejecutar</Button>
                                    </div>
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
                            </CardContent>
                        </Card>

                        {/* Responsive Table */}
                        <Card variant="glass" className="overflow-hidden">
                            {/* Table Header - Hidden on mobile */}
                            <div className="hidden md:block bg-secondary">
                                <div className={`grid ${deletionMode ? 'grid-cols-[40px_50px_120px_1fr_120px_80px_80px_90px]' : 'grid-cols-[50px_120px_1fr_120px_80px_80px_90px]'} p-4 text-sm font-medium text-foreground`}>
                                    {deletionMode && (
                                        <div className="flex items-center justify-center">
                                            <Checkbox
                                                checked={selectedIds.size === products.length && products.length > 0}
                                                onCheckedChange={() => {
                                                    if (selectedIds.size === products.length) {
                                                        setSelectedIds(new Set());
                                                    } else {
                                                        setSelectedIds(new Set(products.map(p => p.id)));
                                                    }
                                                }}
                                            />
                                        </div>
                                    )}
                                    <div>N°</div>
                                    <div>Código</div>
                                    <div className="text-center">Descripción</div>
                                    <div>Marca</div>
                                    <div className="text-center">USD</div>
                                    <div className="text-center">%</div>
                                    <div className="text-center">Acciones</div>
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
                                                        {/* Card Header */}
                                                        <div className="px-4 py-3 bg-secondary/40 border-b border-border/50">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex items-center gap-2">
                                                                    {/* Delete checkbox - only when deletion mode is active */}
                                                                    {deletionMode && (
                                                                        <button
                                                                            onClick={() => toggleSelection(product.id)}
                                                                            className={cn(
                                                                                "flex-shrink-0 w-6 h-6 rounded-md border flex items-center justify-center transition-all",
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
                                                                    <span className="bg-secondary text-muted-foreground px-2 py-0.5 rounded text-xs font-mono">
                                                                        #{rowIndex}
                                                                    </span>
                                                                    {product.review_status === "pending" ? (
                                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning/10 text-warning">
                                                                            Pendiente
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-success/10 text-success">
                                                                            Verificado
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-xl font-bold text-foreground">
                                                                    ${typeof product.price_usd === 'number' ? product.price_usd.toFixed(2) : (product.price_usd ?? '0.00')}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Card Body */}
                                                        <div className="px-4 py-3">
                                                            {editingId === product.id ? (
                                                                /* Editing Mode */
                                                                <div className="space-y-3">
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <div>
                                                                            <label className="text-xs text-muted-foreground mb-1 block">Código</label>
                                                                            <Input
                                                                                value={editValues.clean_code || ''}
                                                                                onChange={(e) => setEditValues({ ...editValues, clean_code: e.target.value })}
                                                                                className="h-8 text-sm"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-xs text-muted-foreground mb-1 block">Precio $</label>
                                                                            <Input
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={editValues.price_usd || 0}
                                                                                onChange={(e) => setEditValues({ ...editValues, price_usd: parseFloat(e.target.value) || 0 })}
                                                                                className="h-8 text-sm"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-xs text-muted-foreground mb-1 block">Descripción</label>
                                                                        <Input
                                                                            value={editValues.description || ''}
                                                                            onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                                                                            className="h-8 text-sm"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-xs text-muted-foreground mb-1 block">Marca</label>
                                                                        <Input
                                                                            value={editValues.brand || ''}
                                                                            onChange={(e) => setEditValues({ ...editValues, brand: e.target.value })}
                                                                            className="h-8 text-sm"
                                                                        />
                                                                    </div>
                                                                    <div className="flex gap-2 pt-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => { setEditingId(null); setEditValues({}); }}
                                                                            className="flex-1"
                                                                        >
                                                                            <X className="h-4 w-4 mr-1" />
                                                                            Cancelar
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={handleSave}
                                                                            className="flex-1"
                                                                            disabled={updateProductMutation.isPending}
                                                                        >
                                                                            <Save className="h-4 w-4 mr-1" />
                                                                            {updateProductMutation.isPending ? 'Guardando...' : 'Guardar'}
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                /* View Mode */
                                                                <div className="space-y-3">
                                                                    {/* Product Name */}
                                                                    <p className="font-semibold text-foreground text-sm leading-snug">
                                                                        {product.description}
                                                                    </p>

                                                                    {/* Metadata Row */}
                                                                    <div className="flex items-center gap-2 flex-wrap text-xs">
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

                                                                    {/* Actions */}
                                                                    <div className="flex gap-2 pt-2 border-t border-border/30">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => handleEdit(product)}
                                                                            className="flex-1"
                                                                        >
                                                                            <Edit2 className="h-4 w-4 mr-1" />
                                                                            Editar
                                                                        </Button>
                                                                        {product.review_status === "pending" && (
                                                                            <Button
                                                                                size="sm"
                                                                                onClick={() => handleVerify(product.id)}
                                                                                className="flex-1"
                                                                            >
                                                                                <Check className="h-4 w-4 mr-1" />
                                                                                Verificar
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Desktop Row Layout */}
                                                <div className={`hidden md:grid ${deletionMode ? 'grid-cols-[40px_50px_120px_1fr_120px_80px_80px_90px]' : 'grid-cols-[50px_120px_1fr_120px_80px_80px_90px]'} items-center p-4 border-b border-border hover:bg-secondary/50 h-full`}>
                                                    {deletionMode && (
                                                        <div className="flex items-center justify-center">
                                                            <Checkbox
                                                                checked={selectedIds.has(product.id)}
                                                                onCheckedChange={() => {
                                                                    const newSet = new Set(selectedIds);
                                                                    if (newSet.has(product.id)) newSet.delete(product.id);
                                                                    else newSet.add(product.id);
                                                                    setSelectedIds(newSet);
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="text-muted-foreground">{rowIndex}</div>
                                                    <div className="flex items-center gap-2">
                                                        {product.review_status === "pending" ? (
                                                            <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
                                                        ) : (
                                                            <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                                                        )}
                                                        {editingId === product.id ? (
                                                            <Input
                                                                value={editValues.clean_code || ""}
                                                                onChange={(e) => setEditValues({ ...editValues, clean_code: e.target.value })}
                                                                className="h-8 w-20"
                                                            />
                                                        ) : (
                                                            <span className="font-mono text-foreground truncate">{product.clean_code}</span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        {editingId === product.id ? (
                                                            <Input
                                                                value={editValues.description || ""}
                                                                onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                                                                className="h-8"
                                                            />
                                                        ) : (
                                                            <span className="text-foreground truncate block">{product.description}</span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        {editingId === product.id ? (
                                                            <Input
                                                                value={editValues.brand || ""}
                                                                onChange={(e) => setEditValues({ ...editValues, brand: e.target.value })}
                                                                className="h-8 w-24"
                                                            />
                                                        ) : (
                                                            <span className="text-muted-foreground truncate block">{product.brand}</span>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        {editingId === product.id ? (
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                value={editValues.price_usd || ''}
                                                                onChange={(e) => setEditValues({ ...editValues, price_usd: parseFloat(e.target.value) })}
                                                                className="h-8 w-20 text-right"
                                                            />
                                                        ) : (
                                                            <span className="font-medium text-foreground">
                                                                ${typeof product.price_usd === 'number' ? product.price_usd.toFixed(2) : product.price_usd}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div
                                                        className="text-right text-sm text-muted-foreground cursor-pointer hover:bg-accent/50 px-2 py-1 rounded"
                                                        onClick={() => handleCellEdit(product.id, product.margin_percentage)}
                                                    >
                                                        {editingCell?.id === product.id ? (
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                value={marginEditValue}
                                                                onChange={(e) => setMarginEditValue(e.target.value)}
                                                                onKeyDown={handleMarginKeyDown}
                                                                onBlur={handleCellSave}
                                                                autoFocus
                                                                className="h-6 w-16 text-right text-xs"
                                                            />
                                                        ) : (
                                                            <span>{product.margin_percentage != null ? `${product.margin_percentage}%` : '0%'}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-center gap-1">
                                                        {editingId === product.id ? (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon-sm"
                                                                    onClick={handleSave}
                                                                    className="text-success hover:bg-success/10"
                                                                    disabled={updateProductMutation.isPending}
                                                                >
                                                                    <Save className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon-sm"
                                                                    onClick={() => {
                                                                        setEditingId(null);
                                                                        setEditValues({});
                                                                    }}
                                                                    className="text-destructive hover:bg-destructive/10"
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon-sm"
                                                                    onClick={() => handleEdit(product)}
                                                                    className="text-muted-foreground hover:text-foreground"
                                                                >
                                                                    <Edit2 className="h-4 w-4" />
                                                                </Button>
                                                                {product.review_status === "pending" && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon-sm"
                                                                        onClick={() => handleVerify(product.id)}
                                                                        className="text-success"
                                                                        disabled={verifyProductMutation.isPending}
                                                                    >
                                                                        <Check className="h-4 w-4" />
                                                                    </Button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
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

                            {/* Empty products state */}
                            {products.length === 0 && (
                                <div className="p-12 text-center">
                                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                    <p className="text-muted-foreground">No hay productos en esta lista.</p>
                                </div>
                            )}
                        </Card>
                    </div>
                )}
            </div>

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
                            onClick={() => {
                                setSelectedIds(new Set());
                                setDeletionMode(false);
                            }}
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
        </div >
    );
}

