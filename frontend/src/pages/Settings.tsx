/**
 * Componente de página de Ajustes.
 * 
 * Gestiona la configuración de rangos de precios con visualización mejorada.
 */
import { useState, useMemo } from 'react';
import {
    usePriceRanges,
    useCreatePriceRange,
    useUpdatePriceRange,
    useDeletePriceRange,
} from '../services/queries';
import './Settings.css';

// Rangos sugeridos para inicio rápido
const SUGGESTED_RANGES = [
    { name: 'Barato', min_price: 0, max_price: 50, color: '#4caf50' },
    { name: 'Medio', min_price: 50.01, max_price: 150, color: '#ffc107' },
    { name: 'Caro', min_price: 150.01, max_price: null, color: '#f44336' },
];

export function SettingsPage() {
    const { data: ranges, isLoading, error } = usePriceRanges();
    const createMutation = useCreatePriceRange();
    const updateMutation = useUpdatePriceRange();
    const deleteMutation = useDeletePriceRange();

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        min_price: '',
        max_price: '',
        color: '#667eea',
        display_order: 0,
    });

    // Ordenar rangos por precio mínimo
    const sortedRanges = useMemo(() => {
        if (!ranges) return [];
        return [...ranges].sort((a, b) => (a.min_price || 0) - (b.min_price || 0));
    }, [ranges]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const data = {
            name: formData.name,
            min_price: formData.min_price ? parseFloat(formData.min_price) : null,
            max_price: formData.max_price ? parseFloat(formData.max_price) : null,
            color: formData.color,
            display_order: formData.display_order,
        };

        try {
            if (editingId) {
                await updateMutation.mutateAsync({ id: editingId, data });
                setEditingId(null);
            } else {
                await createMutation.mutateAsync(data);
            }
            resetForm();
        } catch (err) {
            alert('Error al guardar rango de precios');
        }
    };

    const handleEdit = (range: any) => {
        setEditingId(range.id);
        setFormData({
            name: range.name,
            min_price: range.min_price?.toString() || '',
            max_price: range.max_price?.toString() || '',
            color: range.color,
            display_order: range.display_order,
        });
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (confirm('¿Estás seguro de que deseas eliminar este rango de precios?')) {
            try {
                await deleteMutation.mutateAsync(id);
            } catch (err) {
                alert('Error al eliminar rango de precios');
            }
        }
    };

    const handleCreateSuggested = async () => {
        for (let i = 0; i < SUGGESTED_RANGES.length; i++) {
            const range = SUGGESTED_RANGES[i];
            await createMutation.mutateAsync({
                name: range.name,
                min_price: range.min_price,
                max_price: range.max_price,
                color: range.color,
                display_order: i,
            });
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            min_price: '',
            max_price: '',
            color: '#667eea',
            display_order: ranges?.length || 0,
        });
        setShowForm(false);
        setEditingId(null);
    };

    if (isLoading) return <div className="loading">Cargando ajustes...</div>;
    if (error) return <div className="error">Error: {error.message}</div>;

    return (
        <div className="settings-page">
            <div className="page-header">
                <h2>⚙️ Ajustes</h2>
                <p className="subtitle">Configura rangos de precios para clasificación automática</p>
            </div>

            <div className="settings-content">
                {/* Visual Range Bar */}
                {sortedRanges.length > 0 && (
                    <div className="range-visualization">
                        <h3>Vista de Rangos</h3>
                        <div className="range-bar">
                            {sortedRanges.map((range) => (
                                <div
                                    key={range.id}
                                    className="range-segment"
                                    style={{
                                        backgroundColor: range.color,
                                        flex: range.max_price
                                            ? Math.min(range.max_price - (range.min_price || 0), 200)
                                            : 1,
                                    }}
                                >
                                    <span className="segment-label">{range.name}</span>
                                    <span className="segment-prices">
                                        ${Number(range.min_price ?? 0).toFixed(0)} - {range.max_price ? `$${Number(range.max_price).toFixed(0)}` : '∞'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Price Ranges List */}
                <div className="ranges-section">
                    <div className="section-header">
                        <h3>Rangos de Precios ({sortedRanges.length})</h3>
                        <div className="header-actions">
                            {sortedRanges.length === 0 && (
                                <button
                                    onClick={handleCreateSuggested}
                                    className="btn-suggested"
                                    disabled={createMutation.isPending}
                                >
                                    ✨ Crear rangos sugeridos
                                </button>
                            )}
                            <button
                                onClick={() => setShowForm(!showForm)}
                                className="btn-add"
                            >
                                {showForm ? '✗ Cancelar' : '+ Agregar Rango'}
                            </button>
                        </div>
                    </div>

                    {showForm && (
                        <form onSubmit={handleSubmit} className="range-form">
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Nombre</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        placeholder="ej., Económico, Medio, Premium"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Precio Mínimo ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.min_price}
                                        onChange={(e) => setFormData({ ...formData, min_price: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Precio Máximo ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.max_price}
                                        onChange={(e) => setFormData({ ...formData, max_price: e.target.value })}
                                        placeholder="Vacío = ilimitado (∞)"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Color</label>
                                    <div className="color-picker">
                                        <input
                                            type="color"
                                            value={formData.color}
                                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        />
                                        <span className="color-value">{formData.color}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="quick-colors">
                                <span>Colores rápidos:</span>
                                {['#4caf50', '#8bc34a', '#ffc107', '#ff9800', '#f44336', '#e91e63', '#9c27b0', '#667eea'].map(color => (
                                    <button
                                        key={color}
                                        type="button"
                                        className="quick-color-btn"
                                        style={{ backgroundColor: color }}
                                        onClick={() => setFormData({ ...formData, color })}
                                    />
                                ))}
                            </div>

                            <div className="form-actions">
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                >
                                    {editingId ? 'Actualizar Rango' : 'Crear Rango'}
                                </button>
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="btn-secondary"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="ranges-list">
                        {sortedRanges.length > 0 ? (
                            sortedRanges.map((range, index) => (
                                <div key={range.id} className="range-card">
                                    <div className="range-order">{index + 1}</div>
                                    <div className="range-info">
                                        <div
                                            className="range-color"
                                            style={{ backgroundColor: range.color }}
                                        />
                                        <div className="range-details">
                                            <h4>{range.name}</h4>
                                            <p className="range-prices">
                                                ${Number(range.min_price ?? 0).toFixed(2)} -{' '}
                                                {range.max_price ? `$${Number(range.max_price).toFixed(2)}` : '∞ (sin límite)'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="range-actions">
                                        <button
                                            onClick={() => handleEdit(range)}
                                            className="btn-icon"
                                            title="Editar"
                                        >
                                            ✎
                                        </button>
                                        <button
                                            onClick={() => handleDelete(range.id)}
                                            className="btn-icon btn-danger"
                                            title="Eliminar"
                                            disabled={deleteMutation.isPending}
                                        >
                                            🗑
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">
                                <div className="empty-icon">📊</div>
                                <p>No hay rangos de precios configurados</p>
                                <p className="hint">
                                    Los rangos de precios permiten clasificar productos automáticamente.<br />
                                    Haz click en "Crear rangos sugeridos" o agrega los tuyos propios.
                                </p>
                            </div>
                        )}
                    </div>

                    {sortedRanges.length > 0 && (
                        <div className="ranges-summary">
                            <p>
                                💡 <strong>Consejo:</strong> Los productos sin precio o fuera de los rangos definidos
                                aparecerán como "Sin clasificar". Asegúrate de cubrir todo el espectro de precios.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
