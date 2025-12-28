/**
 * Gestión Listados - Core Page
 * 
 * Master Table unificada con vistas duales (Empresarial/Cliente).
 * Incluye heatmap dinámico, filtros inteligentes y exportación.
 */
import { useState } from 'react';
import { useMasterProducts, usePriceStats, useUpdateMargin, useUpdateFinalPrice } from '../services/queries';
import './ListingsManagement.css';

type ViewMode = 'enterprise' | 'client';
type SortBy = 'alphabetical' | 'brand' | 'description' | 'price';

export function ListingsManagementPage() {
    const [viewMode, setViewMode] = useState<ViewMode>('enterprise');
    const [heatmapEnabled, setHeatmapEnabled] = useState(false);
    const [sortBy, setSortBy] = useState<SortBy>('alphabetical');
    const [brandFilter, setBrandFilter] = useState('');
    const [reviewStatusFilter, setReviewStatusFilter] = useState<string>('');
    const [currentPage, setCurrentPage] = useState(1);

    // Editing state
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingField, setEditingField] = useState<'margin' | 'final_price' | null>(null);
    const [editMargin, setEditMargin] = useState('');
    const [editFinalPrice, setEditFinalPrice] = useState('');

    // Queries
    const { data, isLoading, error } = useMasterProducts({
        viewMode,
        sortBy,
        brandFilter: brandFilter || undefined,
        reviewStatusFilter: reviewStatusFilter || undefined,
        page: currentPage,
        limit: 50
    });

    const { data: stats } = usePriceStats();
    const updateMarginMutation = useUpdateMargin();
    const updateFinalPriceMutation = useUpdateFinalPrice();

    // Get heatmap color based on price percentiles
    const getHeatmapColor = (price: number): string => {
        if (!heatmapEnabled || !stats) return 'transparent';

        if (price <= stats.p25) return '#22c55e';  // Verde (25% más barato)
        if (price >= stats.p75) return '#ef4444';  // Rojo (25% más caro)
        return '#eab308';  // Amarillo (50% medio)
    };

    // Format price
    const formatPrice = (price: number | null): string => {
        if (price === null || price === undefined) return '-';
        return `$${price.toFixed(2)}`;
    };

    // Handle edit
    const handleEditMargin = (product: any) => {
        setEditingId(product.id);
        setEditingField('margin');
        setEditMargin(product.margin_percentage?.toString() || '0');
    };

    const handleEditFinalPrice = (product: any) => {
        setEditingId(product.id);
        setEditingField('final_price');
        setEditFinalPrice(product.final_price?.toString() || product.price_usd.toString());
    };

    // Handle save margin (Enterprise View)
    const handleSaveMargin = async (productId: number) => {
        try {
            await updateMarginMutation.mutateAsync({
                productId,
                margin_percentage: parseFloat(editMargin)
            });
            setEditingId(null);
            setEditingField(null);
        } catch (err) {
            alert('Error al actualizar margen');
        }
    };

    // Handle save final price
    const handleSaveFinalPrice = async (productId: number) => {
        try {
            await updateFinalPriceMutation.mutateAsync({
                productId,
                final_price: parseFloat(editFinalPrice)
            });
            setEditingId(null);
            setEditingField(null);
        } catch (err) {
            alert('Error al actualizar precio final');
        }
    };

    // Handle cancel
    const handleCancel = () => {
        setEditingId(null);
        setEditingField(null);
        setEditMargin('');
        setEditFinalPrice('');
    };

    // Handle export
    const handleExport = (format: 'pdf' | 'excel') => {
        // Build query params
        const params = new URLSearchParams({
            format,
            view_mode: viewMode,
            sort_by: sortBy
        });

        if (brandFilter) params.append('brand_filter', brandFilter);
        if (reviewStatusFilter) params.append('review_status_filter', reviewStatusFilter);

        // Download file - use the API base URL
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
        window.open(`${baseUrl}/master-products/export?${params.toString()}`, '_blank');
    };

    if (isLoading) return <div className="loading">Cargando productos...</div>;
    if (error) return <div className="error">Error: {error.message}</div>;

    const products = data?.products || [];
    const totalProducts = data?.total || 0;
    const totalPages = Math.ceil(totalProducts / 50);

    return (
        <div className="listings-management">
            <div className="page-header">
                <h2>📋 Gestión Listados</h2>
                <p className="subtitle">Master Table unificada de todos los listados de precios</p>
            </div>

            {/* View Controls */}
            <div className="view-controls">
                <div className="view-buttons">
                    <button
                        className={`view-btn ${viewMode === 'enterprise' ? 'active' : ''}`}
                        onClick={() => setViewMode('enterprise')}
                    >
                        📊 Vista Empresarial
                    </button>
                    <button
                        className={`view-btn ${viewMode === 'client' ? 'active' : ''}`}
                        onClick={() => setViewMode('client')}
                    >
                        👤 Vista Cliente
                    </button>
                </div>

                {viewMode === 'enterprise' && (
                    <button
                        className={`heatmap-btn ${heatmapEnabled ? 'active' : ''}`}
                        onClick={() => setHeatmapEnabled(!heatmapEnabled)}
                        title="Activar/desactivar diferencia de precios"
                    >
                        🌡️ Diferencia de Precios
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="filters-bar">
                <div className="filter-group">
                    <label>Ordenar por:</label>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
                        <option value="alphabetical">Orden Alfabético</option>
                        <option value="brand">Por Marca</option>
                        <option value="description">Por Descripción</option>
                        <option value="price">Por Precio</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label>Filtrar por marca:</label>
                    <input
                        type="text"
                        placeholder="Ej: TOYOTA"
                        value={brandFilter}
                        onChange={(e) => setBrandFilter(e.target.value)}
                    />
                </div>

                <div className="filter-group">
                    <label>Estado de revisión:</label>
                    <select value={reviewStatusFilter} onChange={(e) => setReviewStatusFilter(e.target.value)}>
                        <option value="">Todos</option>
                        <option value="pending">⚠️ Pendientes</option>
                        <option value="confirmed">✓ Confirmados</option>
                        <option value="rejected">✗ Rechazados</option>
                    </select>
                </div>

                <div className="export-buttons">
                    <button onClick={() => handleExport('pdf')} className="export-btn">
                        📄 Exportar PDF
                    </button>
                    <button onClick={() => handleExport('excel')} className="export-btn">
                        📊 Exportar Excel
                    </button>
                </div>
            </div>

            {/* Master Table */}
            <div className="master-table-container">
                <table className="master-table">
                    <thead>
                        <tr>
                            <th>N°</th>
                            <th>CÓDIGO</th>
                            <th>DESCRIPCIÓN</th>
                            <th>MARCA</th>
                            {viewMode === 'enterprise' && <th>EMPRESA/LISTADO</th>}
                            <th>USD</th>
                            {viewMode === 'enterprise' ? (
                                <>
                                    <th>%</th>
                                    <th>USD PRECIO FINAL</th>
                                </>
                            ) : (
                                <th>USD PRECIO FINAL</th>
                            )}
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map((product: any) => {
                            const needsReview = product.review_status === 'pending';
                            const priceColor = getHeatmapColor(product.price_usd);

                            return (
                                <tr
                                    key={product.id}
                                    className={needsReview ? 'needs-review' : ''}
                                    style={{ backgroundColor: needsReview ? '#fff3cd' : 'transparent' }}
                                >
                                    <td>{product.index_number}</td>
                                    <td className="code-cell">
                                        {needsReview && <span className="warning-icon" title="Requiere revisión manual">⚠️</span>}
                                        {product.clean_code}
                                    </td>
                                    <td>{product.description}</td>
                                    <td>{product.brand || '-'}</td>
                                    {viewMode === 'enterprise' && (
                                        <td className="source-cell">{product.original_list_name}</td>
                                    )}
                                    <td
                                        className="price-cell"
                                        style={{ backgroundColor: priceColor }}
                                    >
                                        {formatPrice(product.price_usd)}
                                    </td>
                                    {viewMode === 'enterprise' ? (
                                        <>
                                            <td className="margin-cell">
                                                {editingId === product.id && editingField === 'margin' ? (
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={editMargin}
                                                        onChange={(e) => setEditMargin(e.target.value)}
                                                        className="edit-input"
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <span
                                                        onClick={() => handleEditMargin(product)}
                                                        className="editable-cell"
                                                        title="Click para editar"
                                                    >
                                                        {product.margin_percentage ? `${product.margin_percentage}%` : '-'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="final-price-cell">
                                                {editingId === product.id && editingField === 'final_price' ? (
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={editFinalPrice}
                                                        onChange={(e) => setEditFinalPrice(e.target.value)}
                                                        className="edit-input"
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <span
                                                        onClick={() => handleEditFinalPrice(product)}
                                                        className="editable-cell"
                                                        title="Click para editar"
                                                    >
                                                        {formatPrice(product.final_price)}
                                                    </span>
                                                )}
                                            </td>
                                        </>
                                    ) : (
                                        <td className="final-price-cell">
                                            {editingId === product.id ? (
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={editFinalPrice}
                                                    onChange={(e) => setEditFinalPrice(e.target.value)}
                                                    className="edit-input"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span
                                                    onClick={() => handleEditFinalPrice(product)}
                                                    className="editable-cell"
                                                    title="Click para editar"
                                                >
                                                    {formatPrice(product.final_price)}
                                                </span>
                                            )}
                                        </td>
                                    )}
                                    <td className="actions-cell">
                                        {editingId === product.id ? (
                                            <div className="action-buttons">
                                                <button
                                                    onClick={() => editingField === 'margin'
                                                        ? handleSaveMargin(product.id)
                                                        : handleSaveFinalPrice(product.id)
                                                    }
                                                    className="btn-save"
                                                    title="Guardar"
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    onClick={handleCancel}
                                                    className="btn-cancel"
                                                    title="Cancelar"
                                                >
                                                    ✗
                                                </button>
                                            </div>
                                        ) : null}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="pagination">
                    <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="pagination-btn"
                    >
                        ⟪
                    </button>
                    <button
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="pagination-btn"
                    >
                        ◀
                    </button>

                    <span className="pagination-info">
                        Página {currentPage} de {totalPages} • {totalProducts} productos
                    </span>

                    <button
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="pagination-btn"
                    >
                        ▶
                    </button>
                    <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="pagination-btn"
                    >
                        ⟫
                    </button>
                </div>
            )}

            {/* Legend for heatmap */}
            {heatmapEnabled && viewMode === 'enterprise' && (
                <div className="heatmap-legend">
                    <span className="legend-title">Leyenda de precios:</span>
                    <span className="legend-item">
                        <span className="legend-color" style={{ backgroundColor: '#22c55e' }}></span>
                        Barato (25% inferior)
                    </span>
                    <span className="legend-item">
                        <span className="legend-color" style={{ backgroundColor: '#eab308' }}></span>
                        Mediano (50% medio)
                    </span>
                    <span className="legend-item">
                        <span className="legend-color" style={{ backgroundColor: '#ef4444' }}></span>
                        Caro (25% superior)
                    </span>
                </div>
            )}
        </div>
    );
}
