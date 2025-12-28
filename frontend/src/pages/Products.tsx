/**
 * Componente de página de Productos.
 * 
 * Muestra productos separados por lista con selector y paginación.
 * Columnas: Código, Nombre, Marca, Precio
 */
import { useState, useMemo } from 'react';
import { useProducts, useUpdateProduct, useLists } from '../services/queries';
import './Products.css';

interface ProductsPageProps {
    listId?: number;
}

const ITEMS_PER_PAGE = 50;

// Format price with currency symbol
const formatPrice = (price: number | string | null, currency: string = 'USD'): string => {
    if (price === null || price === undefined) return '-';

    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) return '-';

    const symbols: { [key: string]: string } = {
        'USD': '$',
        'EUR': '€',
        'COP': '$',
        'VES': 'Bs'
    };

    const symbol = symbols[currency] || '$';

    if (currency === 'VES') {
        return `${symbol} ${numPrice.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
    } else if (currency === 'COP') {
        return `${symbol}${numPrice.toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
    } else if (currency === 'EUR') {
        return `${symbol}${numPrice.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
    }
    return `${symbol}${numPrice.toFixed(2)}`;
};

export function ProductsPage({ listId: initialListId }: ProductsPageProps) {
    const { data: listsData } = useLists();
    const [selectedListId, setSelectedListId] = useState<number | undefined>(initialListId);
    const [currentPage, setCurrentPage] = useState(1);

    // Update selected list when prop changes
    useMemo(() => {
        if (initialListId !== undefined) {
            setSelectedListId(initialListId);
            setCurrentPage(1);
        }
    }, [initialListId]);

    const { data, isLoading, error } = useProducts(selectedListId);
    const updateMutation = useUpdateProduct();
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editCode, setEditCode] = useState('');
    const [editName, setEditName] = useState('');
    const [editBrand, setEditBrand] = useState('');
    const [editPrice, setEditPrice] = useState('');

    // Pagination
    const totalProducts = data?.products?.length || 0;
    const totalPages = Math.ceil(totalProducts / ITEMS_PER_PAGE);
    const paginatedProducts = useMemo(() => {
        if (!data?.products) return [];
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return data.products.slice(start, start + ITEMS_PER_PAGE);
    }, [data?.products, currentPage]);

    const handleEdit = (product: any) => {
        setEditingId(product.id);
        setEditCode(product.code || '');
        setEditName(product.name);
        setEditBrand(product.brand || '');
        setEditPrice(product.price?.toString() || '');
    };

    const handleSave = async (id: number) => {
        try {
            await updateMutation.mutateAsync({
                id,
                data: {
                    code: editCode || null,
                    name: editName,
                    brand: editBrand || null,
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
        setEditCode('');
        setEditName('');
        setEditBrand('');
        setEditPrice('');
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const selectedList = listsData?.lists?.find((l: any) => l.id === selectedListId);

    if (isLoading) return <div className="loading">Cargando productos...</div>;
    if (error) return <div className="error">Error: {error.message}</div>;

    return (
        <div className="products-page">
            <div className="page-header">
                <div className="header-row">
                    <div>
                        <h2>📦 Productos</h2>
                        {selectedList ? (
                            <p className="subtitle">
                                Lista: <strong>{selectedList.name}</strong> • {totalProducts} productos
                            </p>
                        ) : (
                            <p className="subtitle">Selecciona una lista para ver sus productos</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Selector de lista */}
            <div className="list-selector-bar">
                <label htmlFor="list-select">Lista:</label>
                <select
                    id="list-select"
                    value={selectedListId || ''}
                    onChange={(e) => {
                        setSelectedListId(e.target.value ? parseInt(e.target.value) : undefined);
                        setCurrentPage(1);
                    }}
                    className="list-select"
                >
                    <option value="">-- Selecciona una lista --</option>
                    {listsData?.lists?.map((list: any) => (
                        <option key={list.id} value={list.id}>
                            {list.name} ({list.product_count} productos)
                        </option>
                    ))}
                </select>
            </div>

            {selectedListId ? (
                paginatedProducts.length > 0 ? (
                    <>
                        <div className="products-table-container">
                            <table className="products-table">
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Nombre del Producto</th>
                                        <th>Marca</th>
                                        <th>Precio</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedProducts.map((product: any) => (
                                        <tr key={product.id}>
                                            {editingId === product.id ? (
                                                <>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={editCode}
                                                            onChange={(e) => setEditCode(e.target.value)}
                                                            className="edit-input"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            className="edit-input"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={editBrand}
                                                            onChange={(e) => setEditBrand(e.target.value)}
                                                            className="edit-input"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            value={editPrice}
                                                            onChange={(e) => setEditPrice(e.target.value)}
                                                            className="edit-input"
                                                            step="0.01"
                                                        />
                                                    </td>
                                                    <td className="actions-cell">
                                                        <button
                                                            onClick={() => handleSave(product.id)}
                                                            className="save-btn"
                                                            disabled={updateMutation.isPending}
                                                        >
                                                            💾
                                                        </button>
                                                        <button onClick={handleCancel} className="cancel-btn">
                                                            ✖
                                                        </button>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="code-cell">{product.code || '-'}</td>
                                                    <td className="name-cell">{product.name}</td>
                                                    <td className="brand-cell">{product.brand || '-'}</td>
                                                    <td className="price-cell">
                                                        {formatPrice(product.price, product.currency)}
                                                    </td>
                                                    <td className="actions-cell">
                                                        <button
                                                            onClick={() => handleEdit(product)}
                                                            className="edit-btn"
                                                        >
                                                            ✏️
                                                        </button>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="pagination">
                                <button
                                    onClick={() => handlePageChange(1)}
                                    disabled={currentPage === 1}
                                    className="pagination-btn"
                                >
                                    ⏮ Inicio
                                </button>
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="pagination-btn"
                                >
                                    ◀ Anterior
                                </button>
                                <span className="pagination-info">
                                    Página {currentPage} de {totalPages}
                                </span>
                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="pagination-btn"
                                >
                                    Siguiente ▶
                                </button>
                                <button
                                    onClick={() => handlePageChange(totalPages)}
                                    disabled={currentPage === totalPages}
                                    className="pagination-btn"
                                >
                                    Fin ⏭
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="no-products">
                        <p>No hay productos en esta lista.</p>
                    </div>
                )
            ) : (
                <div className="no-list-selected">
                    <div className="empty-state">
                        <span className="empty-icon">📋</span>
                        <h3>Selecciona una Lista</h3>
                        <p>Elige una lista del menú desplegable para ver sus productos</p>
                    </div>
                </div>
            )}
        </div>
    );
}
