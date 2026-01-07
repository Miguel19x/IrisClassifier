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
} from 'lucide-react';
import { useLists, useInfiniteProducts, useUpdateProduct, useVerifyProduct } from '../services/queries';
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

interface Product {
    id: number;
    code: string | null;
    name: string;
    brand: string | null;
    price: number | null;
    status?: 'pending' | 'verified';
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
const ROW_HEIGHT_MOBILE = 200;
const ROW_HEIGHT_MOBILE_EDITING = 350; // Taller to show complete edit form

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
    } = useInfiniteProducts(activeListId || undefined, {
        search: debouncedSearch || undefined,
        statusFilter: statusFilter !== 'all' ? statusFilter : undefined,
        sortBy: sortBy,
    });

    const updateProductMutation = useUpdateProduct();
    const verifyProductMutation = useVerifyProduct();

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

    // Virtualizer for table rows - dynamic height based on editing state
    const getRowHeight = useCallback((index: number) => {
        if (!isMobile) return ROW_HEIGHT_DESKTOP;
        const product = products[index];
        if (product && editingId === product.id) {
            return ROW_HEIGHT_MOBILE_EDITING;
        }
        return ROW_HEIGHT_MOBILE;
    }, [isMobile, editingId, products]);

    const rowVirtualizer = useVirtualizer({
        count: products.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: (index) => getRowHeight(index),
        overscan: 10,
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

    const handleEdit = useCallback((product: Product) => {
        setEditingId(product.id);
        setEditValues(product);
    }, []);

    const handleSave = useCallback(async () => {
        if (editingId && editValues && activeListId) {
            try {
                await updateProductMutation.mutateAsync({
                    listId: activeListId,
                    productId: editingId,
                    data: {
                        code: editValues.code,
                        name: editValues.name,
                        brand: editValues.brand,
                        price: editValues.price,
                    },
                });
                setEditingId(null);
                setEditValues({});
            } catch {
                alert('Error al guardar cambios');
            }
        }
    }, [editingId, editValues, activeListId, updateProductMutation]);

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

    // Memoize status counts to avoid O(2n) iterations on every render
    const { pendingCount, verifiedCount } = useMemo(() => {
        let pending = 0;
        let verified = 0;
        for (const p of products) {
            if (p.status === 'pending') pending++;
            else if (p.status === 'verified') verified++;
        }
        return { pendingCount: pending, verifiedCount: verified };
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
                                        {verifiedCount} verificados
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
                                </div>
                            </CardContent>
                        </Card>

                        {/* Responsive Table */}
                        <Card variant="glass" className="overflow-hidden">
                            {/* Table Header - Hidden on mobile */}
                            <div className="hidden md:block bg-secondary">
                                <div className="grid grid-cols-[50px_120px_1fr_120px_80px_90px] lg:grid-cols-[50px_150px_1fr_150px_80px_90px] p-4 text-sm font-medium text-foreground">
                                    <div>N°</div>
                                    <div>Código</div>
                                    <div>Descripción</div>
                                    <div>Marca</div>
                                    <div className="text-right">USD</div>
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
                                                className="absolute w-full"
                                                style={{
                                                    height: `${virtualRow.size}px`,
                                                    transform: `translateY(${virtualRow.start}px)`,
                                                    contain: 'layout style paint',
                                                }}
                                            >
                                                {/* Mobile Card Layout */}
                                                <div className="md:hidden p-3 border-b border-border">
                                                    <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                                                        {/* Header with status */}
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">#{rowIndex}</span>
                                                            {product.status === "pending" ? (
                                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">
                                                                    Pendiente
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
                                                                    Verificado
                                                                </span>
                                                            )}
                                                        </div>

                                                        {editingId === product.id ? (
                                                            /* Editing Mode */
                                                            <>
                                                                <div className="space-y-2">
                                                                    <div>
                                                                        <label className="text-xs text-muted-foreground">Código</label>
                                                                        <Input
                                                                            value={editValues.code || ''}
                                                                            onChange={(e) => setEditValues({ ...editValues, code: e.target.value })}
                                                                            className="h-8 text-sm"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-xs text-muted-foreground">Nombre</label>
                                                                        <Input
                                                                            value={editValues.name || ''}
                                                                            onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                                                                            className="h-8 text-sm"
                                                                        />
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <div className="flex-1">
                                                                            <label className="text-xs text-muted-foreground">Marca</label>
                                                                            <Input
                                                                                value={editValues.brand || ''}
                                                                                onChange={(e) => setEditValues({ ...editValues, brand: e.target.value })}
                                                                                className="h-8 text-sm"
                                                                            />
                                                                        </div>
                                                                        <div className="w-24">
                                                                            <label className="text-xs text-muted-foreground">Precio $</label>
                                                                            <Input
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={editValues.price || 0}
                                                                                onChange={(e) => setEditValues({ ...editValues, price: parseFloat(e.target.value) || 0 })}
                                                                                className="h-8 text-sm"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-2 pt-2 border-t border-border/50">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => { setEditingId(null); setEditValues({}); }}
                                                                        className="flex-1"
                                                                    >
                                                                        Cancelar
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={handleSave}
                                                                        className="flex-1"
                                                                        disabled={updateProductMutation.isPending}
                                                                    >
                                                                        {updateProductMutation.isPending ? 'Guardando...' : 'Guardar'}
                                                                    </Button>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            /* View Mode */
                                                            <>
                                                                <div>
                                                                    <p className="font-semibold text-foreground text-sm leading-tight">{product.name}</p>
                                                                    {product.code && (
                                                                        <p className="text-xs text-muted-foreground font-mono mt-1">Código: {product.code}</p>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center justify-between text-sm">
                                                                    {product.brand && (
                                                                        <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded">{product.brand}</span>
                                                                    )}
                                                                    <span className="font-bold text-foreground text-lg">
                                                                        ${typeof product.price === 'number' ? product.price.toFixed(2) : (product.price ?? '0.00')}
                                                                    </span>
                                                                </div>
                                                                <div className="flex gap-2 pt-2 border-t border-border/50">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleEdit(product)}
                                                                        className="flex-1"
                                                                    >
                                                                        <Edit2 className="h-4 w-4 mr-1" />
                                                                        Editar
                                                                    </Button>
                                                                    {product.status === "pending" && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleVerify(product.id)}
                                                                            className="flex-1 text-success"
                                                                        >
                                                                            <Check className="h-4 w-4 mr-1" />
                                                                            Verificar
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Desktop Row Layout */}
                                                <div className="hidden md:grid grid-cols-[50px_120px_1fr_120px_80px_90px] lg:grid-cols-[50px_150px_1fr_150px_80px_90px] items-center p-4 border-b border-border hover:bg-secondary/50 h-full">
                                                    <div className="text-muted-foreground">{rowIndex}</div>
                                                    <div className="flex items-center gap-2">
                                                        {product.status === "pending" ? (
                                                            <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
                                                        ) : (
                                                            <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                                                        )}
                                                        {editingId === product.id ? (
                                                            <Input
                                                                value={editValues.code || ""}
                                                                onChange={(e) => setEditValues({ ...editValues, code: e.target.value })}
                                                                className="h-8 w-20"
                                                            />
                                                        ) : (
                                                            <span className="font-mono text-foreground truncate">{product.code}</span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        {editingId === product.id ? (
                                                            <Input
                                                                value={editValues.name || ""}
                                                                onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                                                                className="h-8"
                                                            />
                                                        ) : (
                                                            <span className="text-foreground truncate block">{product.name}</span>
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
                                                                value={editValues.price || ''}
                                                                onChange={(e) => setEditValues({ ...editValues, price: parseFloat(e.target.value) })}
                                                                className="h-8 w-20 text-right"
                                                            />
                                                        ) : (
                                                            <span className="font-medium text-foreground">
                                                                ${typeof product.price === 'number' ? product.price.toFixed(2) : product.price}
                                                            </span>
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
                                                                {product.status === "pending" && (
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
        </div >
    );
}
