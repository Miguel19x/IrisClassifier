/**
 * Componente de página de Productos.
 * 
 * Muestra productos separados por catálogo con selector.
 */
import { useState, useMemo } from 'react';
import { useProducts, useUpdateProduct, useCatalogs } from '../services/queries';
import './Products.css';

interface ProductsPageProps {
    catalogId?: number;
}

export function ProductsPage({ catalogId: initialCatalogId }: ProductsPageProps) {
    const { data: catalogsData } = useCatalogs();
    const [selectedCatalogId, setSelectedCatalogId] = useState<number | undefined>(initialCatalogId);

    // Update selected catalog when prop changes
    useMemo(() => {
        if (initialCatalogId !== undefined) {
            setSelectedCatalogId(initialCatalogId);
        }
    }, [initialCatalogId]);

    const { data, isLoading, error } = useProducts(selectedCatalogId);
    const updateMutation = useUpdateProduct();
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editPrice, setEditPrice] = useState('');

    const handleEdit = (product: any) => {
        setEditingId(product.id);
        setEditName(product.name);
        setEditPrice(product.price?.toString() || '');
    };

    const handleSave = async (id: number) => {
        try {
            await updateMutation.mutateAsync({
                id,
                data: {
                    name: editName,
                    price: editPrice ? parseFloat(editPrice) : null,
                },
            });
            setEditingId(null);
        } catch (err) {
            alert('Error al actualizar producto');
        }
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditName('');
        setEditPrice('');
    };

    const selectedCatalog = catalogsData?.catalogs.find((c: any) => c.id === selectedCatalogId);

    if (isLoading) return <div className="loading">Cargando productos...</div>;
    if (error) return <div className="error">Error: {error.message}</div>;

    return (
        <div className="products-page">
            <div className="page-header">
                <div className="header-row">
                    <div>
                        <h2>📦 Productos</h2>
                        {selectedCatalog ? (
                            <p className="subtitle">
                                Catálogo: <strong>{selectedCatalog.name}</strong> • {data?.total || 0} productos
                            </p>
                        ) : (
                            <p className="subtitle">Selecciona un catálogo para ver sus productos</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Selector de catálogo */}
            <div className="catalog-selector-bar">
                <label htmlFor="catalog-select">Catálogo:</label>
                <select
                    id="catalog-select"
                    value={selectedCatalogId || ''}
                    onChange={(e) => setSelectedCatalogId(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="catalog-select"
                >
                    <option value="">-- Selecciona un catálogo --</option>
                    {catalogsData?.catalogs.map((catalog: any) => (
                        <option key={catalog.id} value={catalog.id}>
                            {catalog.name} ({catalog.product_count} productos)
                        </option>
                    ))}
                </select>
            </div>

            {selectedCatalogId ? (
                data && data.products.length > 0 ? (
                    <div className="products-table-container">
                        <table className="products-table">
                            <thead>
                                <tr>
                                    <th>Nombre del Producto</th>
                                    <th>Precio</th>
                                    <th>Rango de Precio</th>
                                    <th>Método</th>
                                    <th>Confianza</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.products.map((product: any) => (
                                    <tr key={product.id}>
                                        <td>
                                            {editingId === product.id ? (
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="edit-input"
                                                />
                                            ) : (
                                                product.name
                                            )}
                                        </td>
                                        <td>
                                            {editingId === product.id ? (
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={editPrice}
                                                    onChange={(e) => setEditPrice(e.target.value)}
                                                    className="edit-input"
                                                />
                                            ) : (
                                                product.price ? `$${Number(product.price).toFixed(2)}` : '-'
                                            )}
                                        </td>
                                        <td>
                                            <span className={`badge badge-${product.price_range_name?.toLowerCase() || 'none'}`}>
                                                {product.price_range_name || 'Sin clasificar'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`method method-${product.classification_method}`}>
                                                {product.classification_method}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="confidence-bar">
                                                <div
                                                    className="confidence-fill"
                                                    style={{ width: `${(product.confidence_score || 0) * 100}%` }}
                                                />
                                                <span className="confidence-text">
                                                    {((product.confidence_score || 0) * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            {editingId === product.id ? (
                                                <div className="action-buttons">
                                                    <button
                                                        onClick={() => handleSave(product.id)}
                                                        className="btn-save"
                                                        disabled={updateMutation.isPending}
                                                    >
                                                        ✓
                                                    </button>
                                                    <button
                                                        onClick={handleCancel}
                                                        className="btn-cancel"
                                                    >
                                                        ✗
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleEdit(product)}
                                                    className="btn-edit"
                                                >
                                                    ✎
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <p>No hay productos en este catálogo</p>
                    </div>
                )
            ) : (
                <div className="no-catalog-selected">
                    <div className="placeholder-icon">📋</div>
                    <p>Selecciona un catálogo del menú desplegable para ver sus productos</p>
                    <p className="hint">También puedes hacer click en un catálogo desde la pestaña "Catálogos"</p>
                </div>
            )}
        </div>
    );
}
