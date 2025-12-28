/**
 * Página consolidada de Gestión de Listas de Precios.
 * 
 * Combina subida de archivos, cámara, y gestión de listas.
 */
import { useState } from 'react';
import { useLists, useUploadList, useDeleteList } from '../services/queries';
import { useCamera } from '../hooks/useCamera';
import './ListsManager.css';

interface ListsManagerProps {
    onSelectList: (id: number) => void;
}

export function ListsManagerPage({ onSelectList }: ListsManagerProps) {
    const { data, isLoading, error } = useLists();
    const uploadMutation = useUploadList();
    const deleteMutation = useDeleteList();
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
                alert('¡Lista subida exitosamente! ETL Inteligente iniciado.');
            } catch (err) {
                alert('Error al subir: ' + (err instanceof Error ? err.message : 'Error desconocido'));
            }
        }
    };

    const handleTakePhoto = async () => {
        try {
            const photoDataUrl = await takePhoto();
            if (photoDataUrl) {
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

    const handleDeleteList = async (id: number, name: string) => {
        if (confirm(`¿Eliminar la lista "${name}"? Esta acción no se puede deshacer.`)) {
            try {
                await deleteMutation.mutateAsync(id);
            } catch (err) {
                alert('Error al eliminar lista');
            }
        }
    };

    if (isLoading) return <div className="loading">Cargando listas...</div>;
    if (error) return <div className="error">Error al cargar listas: {error.message}</div>;

    const totalLists = data?.lists?.length || 0;
    const totalProducts = data?.lists?.reduce((sum: number, l: any) => sum + (l.product_count || 0), 0) || 0;
    const completedLists = data?.lists?.filter((l: any) => l.status === 'completed').length || 0;
    const processingLists = data?.lists?.filter((l: any) => l.status === 'processing').length || 0;

    return (
        <div className="lists-manager">
            <div className="page-header">
                <h2>📚 Gestión de Listas</h2>
                <p className="subtitle">Sube, escanea y administra tus listas de precios</p>
            </div>

            {/* Stats Dashboard */}
            {totalLists > 0 && (
                <div className="stats-dashboard">
                    <div className="stat-card">
                        <div className="stat-icon">📚</div>
                        <div className="stat-content">
                            <div className="stat-value">{totalLists}</div>
                            <div className="stat-label">Listas</div>
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
                            <div className="stat-value">{completedLists}</div>
                            <div className="stat-label">Procesados</div>
                        </div>
                    </div>
                    {processingLists > 0 && (
                        <div className="stat-card stat-processing">
                            <div className="stat-icon">⏳</div>
                            <div className="stat-content">
                                <div className="stat-value">{processingLists}</div>
                                <div className="stat-label">En proceso</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Upload Section */}
            <div className="upload-section">
                <h3>Agregar Nueva Lista</h3>

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
                            {uploadMutation.isPending ? 'Procesando ETL...' : 'Subir Lista'}
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

            {/* Lists */}
            <div className="lists-list">
                <h3>Listas de Precios ({totalLists})</h3>
                {data && data.lists && data.lists.length > 0 ? (
                    <div className="list-grid">
                        {data.lists.map((list: any) => (
                            <div key={list.id} className="list-card">
                                <div className="list-header">
                                    <h4>{list.name}</h4>
                                    <span className={`status status-${list.status}`}>
                                        {list.status}
                                    </span>
                                </div>
                                <div className="list-info">
                                    <p>📦 Productos: {list.product_count}</p>
                                    <p>📅 {new Date(list.created_at).toLocaleDateString()}</p>
                                </div>
                                <div className="list-actions">
                                    <button
                                        onClick={() => onSelectList(list.id)}
                                        className="btn-view"
                                    >
                                        👁️ Ver Productos
                                    </button>
                                    <button
                                        onClick={() => handleDeleteList(list.id, list.name)}
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
                        <p>Aún no hay listas</p>
                        <p className="hint">Sube un archivo o escanea con la cámara para empezar</p>
                    </div>
                )}
            </div>
        </div>
    );
}
