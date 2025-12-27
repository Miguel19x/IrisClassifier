/**
 * Página de Comparación de Catálogos.
 * 
 * Permite comparar productos entre múltiples catálogos para encontrar mejores precios.
 */
import { useState } from 'react';
import { useCatalogs, useCompareCatalogs, useCreateMixedListing } from '../services/queries';
import './Compare.css';

export function ComparePage() {
    const { data: catalogsData } = useCatalogs();
    const compareMutation = useCompareCatalogs();
    const createListingMutation = useCreateMixedListing();

    const [selectedCatalogs, setSelectedCatalogs] = useState<number[]>([]);
    const [useAI, setUseAI] = useState(true);
    const [comparisonResult, setComparisonResult] = useState<any>(null);

    const handleCompare = async () => {
        if (selectedCatalogs.length < 2) {
            alert('Selecciona al menos 2 catálogos');
            return;
        }

        const result = await compareMutation.mutateAsync({
            catalog_ids: selectedCatalogs,
            use_ai: useAI
        });

        setComparisonResult(result);
    };

    const handleCreateMixedListing = async () => {
        const name = prompt('Nombre del listado mixto:');
        if (!name) return;

        await createListingMutation.mutateAsync({
            name,
            catalog_ids: selectedCatalogs,
            use_best_prices: true
        });

        alert('Listado mixto creado!');
    };

    const toggleCatalog = (id: number) => {
        setSelectedCatalogs(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    return (
        <div className="compare-page">
            <div className="page-header">
                <h2>📊 Comparador de Catálogos</h2>
                <p className="subtitle">Encuentra los mejores precios entre tus catálogos</p>
            </div>

            <div className="catalog-selector">
                <h3>Selecciona catálogos para comparar:</h3>
                <div className="catalog-grid">
                    {catalogsData?.catalogs.map((catalog: any) => (
                        <div
                            key={catalog.id}
                            className={`catalog-card ${selectedCatalogs.includes(catalog.id) ? 'selected' : ''}`}
                            onClick={() => toggleCatalog(catalog.id)}
                        >
                            <div className="catalog-name">{catalog.name}</div>
                            <div className="catalog-info">{catalog.product_count} productos</div>
                            {selectedCatalogs.includes(catalog.id) && <div className="check-mark">✓</div>}
                        </div>
                    ))}
                </div>

                <div className="compare-options">
                    <label>
                        <input
                            type="checkbox"
                            checked={useAI}
                            onChange={(e) => setUseAI(e.target.checked)}
                        />
                        Usar IA para matching avanzado (más lento pero más preciso)
                    </label>
                </div>

                <button
                    className="btn-compare"
                    onClick={handleCompare}
                    disabled={selectedCatalogs.length < 2 || compareMutation.isPending}
                >
                    {compareMutation.isPending ? '🔄 Comparando...' : '🔍 Comparar Catálogos'}
                </button>
            </div>

            {comparisonResult && (
                <div className="comparison-results">
                    <div className="stats-summary">
                        <div className="stat-card">
                            <div className="stat-value">{comparisonResult.stats.total_matches}</div>
                            <div className="stat-label">Productos Coincidentes</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">${comparisonResult.stats.potential_savings.toFixed(2)}</div>
                            <div className="stat-label">Ahorro Potencial</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{comparisonResult.stats.unique_products}</div>
                            <div className="stat-label">Productos Únicos</div>
                        </div>
                    </div>

                    <div className="matches-section">
                        <div className="section-header">
                            <h3>Productos Coincidentes</h3>
                            <button className="btn-create-listing" onClick={handleCreateMixedListing}>
                                📋 Crear Listado con Mejores Precios
                            </button>
                        </div>

                        <div className="matches-table-container">
                            <table className="matches-table">
                                <thead>
                                    <tr>
                                        <th>Producto</th>
                                        {comparisonResult.catalogs.map((cat: any) => (
                                            <th key={cat.id}>{cat.name}</th>
                                        ))}
                                        <th>Diferencia</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comparisonResult.matches.map((match: any) => {
                                        const productsByCatalog: Record<number, any> = {};
                                        match.products.forEach((p: any) => {
                                            productsByCatalog[p.catalog_id] = p;
                                        });

                                        return (
                                            <tr key={match.match_id}>
                                                <td className="product-name">{match.canonical_name}</td>
                                                {comparisonResult.catalogs.map((cat: any) => {
                                                    const product = productsByCatalog[cat.id];
                                                    return (
                                                        <td key={cat.id} className={product?.is_best_price ? 'best-price' : ''}>
                                                            {product ? (
                                                                <>
                                                                    ${product.price?.toFixed(2) || '-'}
                                                                    {product.is_best_price && ' ✓'}
                                                                </>
                                                            ) : '-'}
                                                        </td>
                                                    );
                                                })}
                                                <td className={match.price_range > 0 ? 'has-difference' : ''}>
                                                    {match.price_range ? `$${match.price_range.toFixed(2)}` : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
