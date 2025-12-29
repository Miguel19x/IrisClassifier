/**
 * Componente de página de Captura de Cámara.
 * 
 * Permite a los usuarios tomar fotos de listas de precios usando la cámara del dispositivo.
 */
import { useState } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useUploadList } from '../services/queries';
import './Camera.css';

export function CameraPage() {
    const { takePhoto, pickFromGallery, loading: cameraLoading, error: cameraError } = useCamera();
    const uploadMutation = useUploadList();
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [listName, setListName] = useState('');

    const handleTakePhoto = async () => {
        const photoUrl = await takePhoto();
        if (photoUrl) {
            setCapturedImage(photoUrl);
            const timestamp = new Date().toLocaleString();
            setListName(`Lista de Cámara - ${timestamp}`);
        }
    };

    const handlePickFromGallery = async () => {
        const photoUrl = await pickFromGallery();
        if (photoUrl) {
            setCapturedImage(photoUrl);
            const timestamp = new Date().toLocaleString();
            setListName(`Imagen de Galería - ${timestamp}`);
        }
    };

    const handleUpload = async () => {
        if (!capturedImage) return;

        try {
            const response = await fetch(capturedImage);
            const blob = await response.blob();
            const file = new File([blob], `${listName}.jpg`, { type: 'image/jpeg' });

            await uploadMutation.mutateAsync(file);

            setCapturedImage(null);
            setListName('');
            alert('¡Foto subida exitosamente! Procesamiento iniciado.');
        } catch (err) {
            alert('Error al subir: ' + (err instanceof Error ? err.message : 'Error desconocido'));
        }
    };

    const handleRetake = () => {
        setCapturedImage(null);
        setListName('');
    };

    return (
        <div className="camera-page">
            <div className="page-header">
                <h2>📸 Captura de Cámara</h2>
                <p className="subtitle">Toma una foto de tu lista de precios para subir</p>
            </div>

            {cameraError && (
                <div className="error-banner">
                    ⚠️ {cameraError}
                </div>
            )}

            <div className="camera-content">
                {!capturedImage ? (
                    <div className="camera-actions">
                        <div className="action-card">
                            <div className="icon-large">📷</div>
                            <h3>Tomar Foto</h3>
                            <p>Usa la cámara de tu dispositivo para capturar una página de la lista</p>
                            <button
                                onClick={handleTakePhoto}
                                disabled={cameraLoading}
                                className="btn-camera"
                            >
                                {cameraLoading ? 'Abriendo Cámara...' : 'Abrir Cámara'}
                            </button>
                        </div>

                        <div className="divider">
                            <span>O</span>
                        </div>

                        <div className="action-card">
                            <div className="icon-large">🖼️</div>
                            <h3>Elegir de Galería</h3>
                            <p>Selecciona una foto existente de tu dispositivo</p>
                            <button
                                onClick={handlePickFromGallery}
                                disabled={cameraLoading}
                                className="btn-gallery"
                            >
                                {cameraLoading ? 'Abriendo Galería...' : 'Abrir Galería'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="preview-section">
                        <div className="preview-container">
                            <img
                                src={capturedImage}
                                alt="Lista capturada"
                                className="preview-image"
                            />
                        </div>

                        <div className="preview-controls">
                            <div className="form-group">
                                <label htmlFor="list-name">Nombre de la Lista</label>
                                <input
                                    id="list-name"
                                    type="text"
                                    value={listName}
                                    onChange={(e) => setListName(e.target.value)}
                                    placeholder="Ingresa el nombre de la lista"
                                    className="name-input"
                                />
                            </div>

                            <div className="button-group">
                                <button
                                    onClick={handleRetake}
                                    className="btn-secondary"
                                    disabled={uploadMutation.isPending}
                                >
                                    🔄 Retomar
                                </button>
                                <button
                                    onClick={handleUpload}
                                    className="btn-primary"
                                    disabled={!listName.trim() || uploadMutation.isPending}
                                >
                                    {uploadMutation.isPending ? 'Subiendo...' : '📤 Subir'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="camera-tips">
                <h4>📋 Consejos para Mejores Resultados</h4>
                <ul>
                    <li>Asegura buena iluminación para un reconocimiento de texto claro</li>
                    <li>Mantén la cámara estable para evitar desenfoque</li>
                    <li>Captura toda la página o lista de productos</li>
                    <li>Evita sombras y reflejos</li>
                    <li>Toma fotos en modo horizontal para listas anchas</li>
                </ul>
            </div>
        </div>
    );
}
