/**
 * Página de Listados Mixtos.
 * 
 * Muestra y gestiona listados mixtos de productos de múltiples listas.
 */
import { useState } from 'react';
import { useMixedListings, useMixedListingProducts, useDeleteMixedListing, usePriceRanges } from '../services/queries';
import './MixedListings.css';

export function MixedListingsPage() {
    const { data: listings } = useMixedListings();
    const { data: priceRanges } = usePriceRanges();
    const deleteMutation = useDeleteMixedListing();

    const [selectedListing, setSelectedListing] = useState<number | null>(null);
    const [filters, setFilters] = useState({
        price_range_id: undefined as number | undefined,
        search: '',
        sort_by: 'price'
    });

    const { data: productsData } = useMixedListingProducts(
        selectedListing || 0,
        selectedListing ? filters : undefined
    );

    const handleDelete = async (id: number) => {
        if (confirm('¿Eliminar este listado mixto?')) {
            await deleteMutation.mutateAsync(id);
            if (selectedListing === id) {
                setSelectedListing(null);
            }
        }
    };

    const handleExportCSV = () => {
        if (!productsData?.products) return;

        const headers = ['Producto', 'Precio', 'Lista', 'Rango de Precio', 'Mejor Precio'];
        const rows = productsData.products.map((p: any) => [
            p.name,
            p.price?.toFixed(2) || '',
            p.list_name || p.catalog_name,
            p.price_range_name || '',
            p.is_best_price ? 'Sí' : 'No'
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map((row: string[]) => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `listado_mixto_${selectedListing}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handlePrint = () => {
        window.print();
    };

    const selectedListingData = listings?.find((l: any) => l.id === selectedListing);

    return (
        <div className="mixed-listings-page">
            <div className="page-header">
                <h2>📦 Listados Mixtos</h2>
                <p className="subtitle">Gestiona tus listados combinados con mejores precios</p>
            </div>

            <div className="listings-grid">
                <div className="listings-sidebar">
                    <h3>Mis Listados</h3>
                    {listings && listings.length > 0 ? (
                        <div className="listings-list">
                            {listings.map((listing: any) => (
                                <div
                                    key={listing.id}
                                    className={`listing-item ${selectedListing === listing.id ? 'active' : ''}`}
                                    onClick={() => setSelectedListing(listing.id)}
                                >
                                    <div className="listing-name">{listing.name}</div>
                                    <div className="listing-info">{listing.product_count} productos</div>
                                    <button
                                        className="btn-delete-listing"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(listing.id);
                                        }}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-listings">
                            <p>No tienes listados mixtos</p>
                            <p className="hint">Crea uno desde el Comparador</p>
                        </div>
                    )}
                </div>

                <div className="products-content">
                    {selectedListing && productsData ? (
                        <>
                            <div className="content-header">
                                <h3>{selectedListingData?.name}</h3>
                                <div className="export-buttons">
                                    <button onClick={handleExportCSV} className="btn-export">
                                        📥 Exportar CSV
                                    </button>
                                    <button onClick={handlePrint} className="btn-export btn-print">
                                        🖨️ Imprimir
                                    </button>
                                </div>
                            </div>

                            <div className="filters-bar">
                                <input
                                    type="text"
                                    placeholder="🔍 Buscar producto..."
                                    value={filters.search}
                                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                    className="search-input"
                                />

                                <select
                                    value={filters.price_range_id || ''}
                                    onChange={(e) => setFilters({
                                        ...filters,
                                        price_range_id: e.target.value ? parseInt(e.target.value) : undefined
                                    })}
                                    className="filter-select"
                                >
                                    <option value="">Todos los rangos</option>
                                    {priceRanges?.map((range: any) => (
                                        <option key={range.id} value={range.id}>
                                            {range.name}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={filters.sort_by}
                                    onChange={(e) => setFilters({ ...filters, sort_by: e.target.value })}
                                    className="filter-select"
                                >
                                    <option value="price">Ordenar por precio</option>
                                    <option value="name">Ordenar por nombre</option>
                                    <option value="list">Ordenar por lista</option>
                                </select>
                            </div>

                            <div className="products-table-container printable">
                                <table className="products-table">
                                    <thead>
                                        <tr>
                                            <th>Producto</th>
                                            <th>Precio</th>
                                            <th>Lista</th>
                                            <th>Rango</th>
                                            <th>Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productsData.products.map((product: any) => (
                                            <tr key={product.product_id}>
                                                <td className="product-name">{product.name}</td>
                                                <td className="product-price">
                                                    {product.price ? `$${product.price.toFixed(2)}` : '-'}
                                                </td>
                                                <td>{product.list_name || product.catalog_name}</td>
                                                <td>
                                                    {product.price_range_name && (
                                                        <span className={`badge badge-${product.price_range_name.toLowerCase()}`}>
                                                            {product.price_range_name}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    {product.is_best_price && (
                                                        <span className="best-price-badge">✓ Mejor Precio</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="products-summary">
                                <span>Total: {productsData.total} productos</span>
                                <span className="best-price-count">
                                    ✓ {productsData.products.filter((p: any) => p.is_best_price).length} con mejor precio
                                </span>
                            </div>
                        </>
                    ) : (
                        <div className="no-selection">
                            <div className="no-selection-icon">📋</div>
                            <p>Selecciona un listado para ver sus productos</p>
                            <p className="hint">Los listados mixtos combinan productos de múltiples listas</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
