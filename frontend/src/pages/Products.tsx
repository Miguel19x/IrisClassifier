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

const ROW_HEIGHT = 56; // Fixed row height for virtualization

export function ProductsPage({ selectedListId: initialListId }: ProductsPageProps) {
    const { data: listsData, isLoading: listsLoading } = useLists();
    const [internalListId, setInternalListId] = useState<number | null>(initialListId);

    // Use the internal list id, but prefer the prop if provided
    const activeListId = initialListId || internalListId;

    const {
        data: productsData,
        isLoading: productsLoading,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteProducts(activeListId || undefined);
    const updateProductMutation = useUpdateProduct();
    const verifyProductMutation = useVerifyProduct();

    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'original' | 'alpha' | 'brand' | 'price'>('original');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified'>('all');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValues, setEditValues] = useState<Partial<Product>>({});

    // Ref for virtualization container
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const lists: ListItem[] = (listsData?.lists || []) as ListItem[];

    // Flatten all pages of products
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
            setSearchQuery('');
            setStatusFilter('all');
            // Dispatch event for App.tsx to update selectedListId
            window.dispatchEvent(new CustomEvent('selectList', { detail: listId }));
        }
    };

    // Filter and sort products
    const filteredProducts = useMemo(() => {
        let result = [...products];

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                (p) =>
                    p.code?.toLowerCase().includes(query) ||
                    p.name?.toLowerCase().includes(query) ||
                    p.brand?.toLowerCase().includes(query)
            );
        }

        // Status filter
        if (statusFilter !== 'all') {
            result = result.filter((p) => p.status === statusFilter);
        }

        // Sort
        switch (sortBy) {
            case 'alpha':
                result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                break;
            case 'brand':
                result.sort((a, b) => (a.brand || '').localeCompare(b.brand || ''));
                break;
            case 'price':
                result.sort((a, b) => (a.price || 0) - (b.price || 0));
                break;
        }

        return result;
    }, [products, searchQuery, statusFilter, sortBy]);

    // Virtualizer for table rows
    const rowVirtualizer = useVirtualizer({
        count: filteredProducts.length,
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
                                                >
                                                    {list.name} ({list.product_count} productos)
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
                                <div className="flex flex-col md:flex-row gap-4">
                                    <div className="flex-1 relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Buscar por código, descripción o marca..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <Select value={sortBy} onValueChange={(v: typeof sortBy) => setSortBy(v)}>
                                            <SelectTrigger className="w-[160px]">
                                                <SortAsc className="h-4 w-4 mr-2" />
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="original">Original</SelectItem>
                                                <SelectItem value="alpha">Alfabético</SelectItem>
                                                <SelectItem value="brand">Por Marca</SelectItem>
                                                <SelectItem value="price">Por Precio</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Select
                                            value={statusFilter}
                                            onValueChange={(v: typeof statusFilter) => setStatusFilter(v)}
                                        >
                                            <SelectTrigger className="w-[140px]">
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
                                </div>
                            </CardContent>
                        </Card>

                        {/* Virtualized Table */}
                        <Card variant="glass" className="overflow-hidden">
                            {/* Table Header */}
                            <div className="bg-secondary">
                                <div className="grid grid-cols-[60px_120px_1fr_120px_100px_100px] p-4 text-sm font-medium text-foreground">
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
                                        const product = filteredProducts[virtualRow.index];
                                        const rowIndex = virtualRow.index + 1;

                                        return (
                                            <div
                                                key={product.id}
                                                className="grid grid-cols-[60px_120px_1fr_120px_100px_100px] items-center p-4 border-b border-border hover:bg-secondary/50 absolute w-full"
                                                style={{
                                                    height: `${virtualRow.size}px`,
                                                    transform: `translateY(${virtualRow.start}px)`,
                                                    contain: 'layout style paint',
                                                }}
                                            >
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
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Product Count Footer */}
                            {filteredProducts.length > 0 && (
                                <div className="p-4 border-t border-border text-sm text-muted-foreground flex items-center justify-between">
                                    <span>
                                        {products.length} de {totalProducts} productos cargados
                                        {searchQuery && ` (${filteredProducts.length} filtrados)`}
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
