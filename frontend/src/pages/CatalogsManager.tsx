/**
 * Página consolidada de Gestión de Catálogos.
 * 
 * Combina subida de archivos, cámara, y gestión de catálogos.
 */
import { useState } from 'react';
import { useCatalogs, useUploadCatalog, useDeleteCatalog } from '../services/queries';
import { useCamera } from '../hooks/useCamera';
import './CatalogsManager.css';

interface CatalogsManagerProps {
    onSelectCatalog: (id: number) => void;
}

export function CatalogsManagerPage({ onSelectCatalog }: CatalogsManagerProps) {
    const { data, isLoading, error } = useCatalogs();
    const uploadMutation = useUploadCatalog();
    const deleteMutation = useDeleteCatalog();
    const { takePhoto, pickFromGallery } = useCamera();

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadMode, setUploadMode] = useState<'file' | 'camera'>('file');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (selectedFile) {
            try {
                await uploadMutation.mutateAsync(selectedFile);
                setSelectedFile(null);
                const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
                alert('¡Archivo subido exitosamente! Procesamiento iniciado.');
            } catch (err) {
                alert('Error al subir: ' + (err instanceof Error ? err.message : 'Error desconocido'));
            }
        }
    };

    const handleTakePhoto = async () => {
        try {
            const photoDataUrl = await takePhoto();
            if (photoDataUrl) {
                // Convert data URL to File
                const response = await fetch(photoDataUrl);
                const blob = await response.blob();
                const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
                setSelectedFile(file);
                setUploadMode('camera');
            }
        } catch (err) {
            alert('Error al tomar foto: ' + (err instanceof Error ? err.message : 'Error desconocido'));
        }
    };

    const handlePickFromGallery = async () => {
        try {
            const photoDataUrl = await pickFromGallery();
            if (photoDataUrl) {
                const response = await fetch(photoDataUrl);
                const blob = await response.blob();
                const file = new File([blob], `gallery_${Date.now()}.jpg`, { type: 'image/jpeg' });
                setSelectedFile(file);
                setUploadMode('camera');
            }
        } catch (err) {
            alert('Error al seleccionar imagen: ' + (err instanceof Error ? err.message : 'Error desconocido'));
        }
    };

    const handleDeleteCatalog = async (id: number, name: string) => {
        if (confirm(`¿Eliminar el catálogo "${name}"? Esta acción no se puede deshacer.`)) {
            try {
                await deleteMutation.mutateAsync(id);
            } catch (err) {
                alert('Error al eliminar catálogo');
            }
        }
    };

    if (isLoading) return <div className="loading">Cargando catálogos...</div>;
    if (error) return <div className="error">Error al cargar catálogos: {error.message}</div>;

    const totalCatalogs = data?.catalogs.length || 0;
    const totalProducts = data?.catalogs.reduce((sum: number, c: any) => sum + (c.product_count || 0), 0) || 0;
    const completedCatalogs = data?.catalogs.filter((c: any) => c.status === 'completed').length || 0;
    const processingCatalogs = data?.catalogs.filter((c: any) => c.status === 'processing').length || 0;

    return (
        <div className="catalogs-manager">
            <div className="page-header">
                <h2>📚 Gestión de Catálogos</h2>
                <p className="subtitle">Sube, escanea y administra tus catálogos</p>
            </div>

            {/* Stats Dashboard */}
            {totalCatalogs > 0 && (
                <div className="stats-dashboard">
                    <div className="stat-card">
                        <div className="stat-icon">📚</div>
                        <div className="stat-content">
                            <div className="stat-value">{totalCatalogs}</div>
                            <div className="stat-label">Catálogos</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">📦</div>
                        <div className="stat-content">
                            <div className="stat-value">{totalProducts.toLocaleString()}</div>
                            <div className="stat-label">Productos</div>
                        </div>
                    </div>
                    <div className="stat-card stat-success">
                        <div className="stat-icon">✅</div>
                        <div className="stat-content">
                            <div className="stat-value">{completedCatalogs}</div>
                            <div className="stat-label">Procesados</div>
                        </div>
                    </div>
                    {processingCatalogs > 0 && (
                        <div className="stat-card stat-processing">
                            <div className="stat-icon">⏳</div>
                            <div className="stat-content">
                                <div className="stat-value">{processingCatalogs}</div>
                                <div className="stat-label">En proceso</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Upload Section */}
            <div className="upload-section">
                <h3>Agregar Nuevo Catálogo</h3>

                <div className="upload-tabs">
                    <button
                        className={`tab-btn ${uploadMode === 'file' ? 'active' : ''}`}
                        onClick={() => setUploadMode('file')}
                    >
                        📄 Archivo
                    </button>
                    <button
                        className={`tab-btn ${uploadMode === 'camera' ? 'active' : ''}`}
                        onClick={() => setUploadMode('camera')}
                    >
                        📸 Cámara
                    </button>
                </div>

                {uploadMode === 'file' ? (
                    <div className="upload-controls">
                        <input
                            type="file"
                            accept=".pdf,.xlsx,.xls"
                            onChange={handleFileChange}
                            disabled={uploadMutation.isPending}
                        />
                        <button
                            onClick={handleUpload}
                            disabled={!selectedFile || uploadMutation.isPending}
                            className="btn-primary"
                        >
                            {uploadMutation.isPending ? 'Subiendo...' : 'Subir'}
                        </button>
                    </div>
                ) : (
                    <div className="camera-controls">
                        <button onClick={handleTakePhoto} className="btn-camera">
                            📷 Tomar Foto
                        </button>
                        <button onClick={handlePickFromGallery} className="btn-camera">
                            🖼️ Desde Galería
                        </button>
                    </div>
                )}

                {selectedFile && (
                    <p className="file-info">
                        Seleccionado: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                )}
            </div>

            {/* Catalogs List */}
            <div className="catalogs-list">
                <h3>Catálogos ({totalCatalogs})</h3>
                {data && data.catalogs.length > 0 ? (
                    <div className="catalog-grid">
                        {data.catalogs.map((catalog: any) => (
                            <div key={catalog.id} className="catalog-card">
                                <div className="catalog-header">
                                    <h4>{catalog.name}</h4>
                                    <span className={`status status-${catalog.status}`}>
                                        {catalog.status}
                                    </span>
                                </div>
                                <div className="catalog-info">
                                    <p>📦 Productos: {catalog.product_count}</p>
                                    <p>📅 {new Date(catalog.created_at).toLocaleDateString()}</p>
                                </div>
                                <div className="catalog-actions">
                                    <button
                                        onClick={() => onSelectCatalog(catalog.id)}
                                        className="btn-view"
                                    >
                                        👁️ Ver Productos
                                    </button>
                                    <button
                                        onClick={() => handleDeleteCatalog(catalog.id, catalog.name)}
                                        className="btn-delete"
                                        disabled={deleteMutation.isPending}
                                    >
                                        🗑️ Eliminar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-icon">📚</div>
                        <p>Aún no hay catálogos</p>
                        <p className="hint">Sube un archivo o escanea con la cámara para empezar</p>
                    </div>
                )}
            </div>
        </div>
    );
}
