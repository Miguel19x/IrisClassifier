/**
 * Página de Comparación de Listas.
 * 
 * Permite comparar productos entre múltiples listas para encontrar mejores precios.
 */
import { useState } from 'react';
import { useLists, useCompareLists, useCreateMixedListing } from '../services/queries';
import './Compare.css';

export function ComparePage() {
    const { data: listsData } = useLists();
    const compareMutation = useCompareLists();
    const createListingMutation = useCreateMixedListing();

    const [selectedLists, setSelectedLists] = useState<number[]>([]);
    const [useAI, setUseAI] = useState(true);
    const [comparisonResult, setComparisonResult] = useState<any>(null);

    const handleCompare = async () => {
        if (selectedLists.length < 2) {
            alert('Selecciona al menos 2 listas');
            return;
        }

        const result = await compareMutation.mutateAsync({
            list_ids: selectedLists,
            use_ai: useAI
        });

        setComparisonResult(result);
    };

    const handleCreateMixedListing = async () => {
        const name = prompt('Nombre del listado mixto:');
        if (!name) return;

        await createListingMutation.mutateAsync({
            name,
            list_ids: selectedLists,
            use_best_prices: true
        });

        alert('Listado mixto creado!');
    };

    const toggleList = (id: number) => {
        setSelectedLists(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    return (
        <div className="compare-page">
            <div className="page-header">
                <h2>📊 Comparador de Listas</h2>
                <p className="subtitle">Encuentra los mejores precios entre tus listas</p>
            </div>

            <div className="list-selector">
                <h3>Selecciona listas para comparar:</h3>
                <div className="list-grid">
                    {listsData?.lists?.map((list: any) => (
                        <div
                            key={list.id}
                            className={`list-card ${selectedLists.includes(list.id) ? 'selected' : ''}`}
                            onClick={() => toggleList(list.id)}
                        >
                            <div className="list-name">{list.name}</div>
                            <div className="list-info">{list.product_count} productos</div>
                            {selectedLists.includes(list.id) && <div className="check-mark">✓</div>}
                        </div>
                    ))}
                </div>
            </div>

            <div className="compare-options">
                <label>
                    <input
                        type="checkbox"
                        checked={useAI}
                        onChange={(e) => setUseAI(e.target.checked)}
                    />
                    Usar IA para matching mejorado
                </label>
            </div>

            <div className="compare-actions">
                <button
                    onClick={handleCompare}
                    className="btn-primary"
                    disabled={selectedLists.length < 2 || compareMutation.isPending}
                >
                    {compareMutation.isPending ? 'Comparando...' : `Comparar ${selectedLists.length} Listas`}
                </button>
            </div>

            {comparisonResult && (
                <div className="comparison-results">
                    <h3>Resultados de Comparación</h3>
                    <div className="stats-summary">
                        <div className="stat">
                            <span className="stat-value">{comparisonResult.matches_found}</span>
                            <span className="stat-label">Productos Coincidentes</span>
                        </div>
                        <div className="stat">
                            <span className="stat-value">${comparisonResult.potential_savings?.toFixed(2)}</span>
                            <span className="stat-label">Ahorro Potencial</span>
                        </div>
                    </div>

                    <div className="matches-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    {comparisonResult.lists?.map((list: any) => (
                                        <th key={list.id}>{list.name}</th>
                                    ))}
                                    <th>Mejor Precio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {comparisonResult.matches?.map((match: any, idx: number) => {
                                    const productsByList: Record<number, any> = {};
                                    match.products.forEach((p: any) => {
                                        productsByList[p.list_id] = p;
                                    });
                                    return (
                                        <tr key={idx}>
                                            <td>{match.canonical_name}</td>
                                            {comparisonResult.lists?.map((list: any) => {
                                                const product = productsByList[list.id];
                                                return (
                                                    <td key={list.id} className={product?.is_best_price ? 'best-price' : ''}>
                                                        {product ? `$${product.price}` : '-'}
                                                    </td>
                                                );
                                            })}
                                            <td className="best-price">${match.best_price}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <button
                        onClick={handleCreateMixedListing}
                        className="btn-secondary"
                        disabled={createListingMutation.isPending}
                    >
                        {createListingMutation.isPending ? 'Creando...' : '📋 Crear Listado con Mejores Precios'}
                    </button>
                </div>
            )}
        </div>
    );
}
