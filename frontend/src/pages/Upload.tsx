/**
 * Upload page - File upload interface for catalogs with progress tracking.
 */
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

interface ProgressData {
    catalog_id: number;
    status: string;
    total_pages: number;
    pages_processed: number;
    current_batch: number;
    total_batches: number;
    products_extracted: number;
    progress_percent: number;
    progress_message: string | null;
    error_message: string | null;
}

export default function Upload() {
    const [file, setFile] = useState<File | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [catalogId, setCatalogId] = useState<number | null>(null);
    const queryClient = useQueryClient();

    // Polling for progress when we have a catalog being processed
    const { data: progress } = useQuery({
        queryKey: ['catalogProgress', catalogId],
        queryFn: async () => {
            const response = await api.get<ProgressData>(`/catalogs/${catalogId}/progress`);
            return response.data;
        },
        enabled: catalogId !== null,
        refetchInterval: (query) => {
            const data = query.state.data;
            // Stop polling when completed or failed
            if (data?.status === 'completed' || data?.status === 'failed') {
                return false;
            }
            return 2000; // Poll every 2 seconds
        },
    });

    // Reset catalog ID when processing completes
    useEffect(() => {
        if (progress?.status === 'completed') {
            queryClient.invalidateQueries({ queryKey: ['catalogs'] });
            // Keep showing success for 5 seconds, then reset
            const timer = setTimeout(() => {
                setCatalogId(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [progress?.status, queryClient]);

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const response = await api.post('/catalogs/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        },
        onSuccess: (data) => {
            setCatalogId(data.catalog_id);
            setFile(null);
        },
    });

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = () => {
        if (file) {
            uploadMutation.mutate(file);
        }
    };

    const isProcessing = catalogId !== null && progress?.status !== 'completed' && progress?.status !== 'failed';

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">Subir Catálogo</h1>
                <p className="text-gray-600 mb-8">
                    Sube archivos PDF o Excel para extraer y clasificar productos
                </p>

                {/* Progress Tracker */}
                {catalogId !== null && progress && (
                    <div className={`mb-6 rounded-lg p-6 ${progress.status === 'completed' ? 'bg-green-50 border border-green-200' :
                        progress.status === 'failed' ? 'bg-red-50 border border-red-200' :
                            'bg-blue-50 border border-blue-200'
                        }`}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-lg">
                                {progress.status === 'completed' ? '✓ Procesamiento Completado' :
                                    progress.status === 'failed' ? '✗ Error en Procesamiento' :
                                        '⏳ Procesando Catálogo...'}
                            </h3>
                            {isProcessing && (
                                <span className="text-sm text-blue-600 font-medium">
                                    {progress.progress_percent.toFixed(1)}%
                                </span>
                            )}
                        </div>

                        {/* Progress Bar */}
                        {isProcessing && (
                            <div className="w-full bg-blue-200 rounded-full h-3 mb-4">
                                <div
                                    className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${Math.max(progress.progress_percent, 2)}%` }}
                                />
                            </div>
                        )}

                        {/* Progress Details */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            {progress.total_pages > 0 && (
                                <div className="bg-white/50 rounded p-3">
                                    <div className="text-gray-500">Páginas</div>
                                    <div className="font-semibold text-lg">
                                        {progress.pages_processed} / {progress.total_pages}
                                    </div>
                                </div>
                            )}
                            {progress.total_batches > 0 && (
                                <div className="bg-white/50 rounded p-3">
                                    <div className="text-gray-500">Lote Actual</div>
                                    <div className="font-semibold text-lg">
                                        {progress.current_batch} / {progress.total_batches}
                                    </div>
                                </div>
                            )}
                            <div className="bg-white/50 rounded p-3">
                                <div className="text-gray-500">Productos Extraídos</div>
                                <div className="font-semibold text-lg text-green-600">
                                    {progress.products_extracted}
                                </div>
                            </div>
                            <div className="bg-white/50 rounded p-3">
                                <div className="text-gray-500">Estado</div>
                                <div className="font-semibold">
                                    {progress.status === 'started' ? 'Iniciando...' :
                                        progress.status === 'extracting' ? 'Extrayendo...' :
                                            progress.status === 'classifying' ? 'Clasificando...' :
                                                progress.status === 'completed' ? 'Completado' :
                                                    progress.status === 'failed' ? 'Error' :
                                                        progress.status}
                                </div>
                            </div>
                        </div>

                        {/* Progress Message */}
                        {progress.progress_message && (
                            <p className="mt-3 text-sm text-gray-600 italic">
                                {progress.progress_message}
                            </p>
                        )}

                        {/* Error Message */}
                        {progress.error_message && (
                            <p className="mt-3 text-sm text-red-600">
                                {progress.error_message}
                            </p>
                        )}
                    </div>
                )}

                {/* Drag and Drop Area - Only show when not processing */}
                {!isProcessing && (
                    <>
                        <div
                            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${dragActive
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-300 hover:border-gray-400'
                                }`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            <svg
                                className="mx-auto h-12 w-12 text-gray-400"
                                stroke="currentColor"
                                fill="none"
                                viewBox="0 0 48 48"
                            >
                                <path
                                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                            <div className="mt-4">
                                <label
                                    htmlFor="file-upload"
                                    className="cursor-pointer text-blue-600 hover:text-blue-500"
                                >
                                    <span>Selecciona un archivo</span>
                                    <input
                                        id="file-upload"
                                        name="file-upload"
                                        type="file"
                                        className="sr-only"
                                        accept=".pdf,.xlsx,.xls"
                                        onChange={handleFileChange}
                                    />
                                </label>
                                <span className="text-gray-500"> o arrastra y suelta</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                PDF, Excel hasta 100MB
                            </p>
                        </div>

                        {/* Selected File */}
                        {file && (
                            <div className="mt-6 bg-gray-50 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">{file.name}</p>
                                        <p className="text-sm text-gray-500">
                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setFile(null)}
                                        className="text-red-600 hover:text-red-700"
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Upload Button */}
                        <button
                            onClick={handleUpload}
                            disabled={!file || uploadMutation.isPending}
                            className="mt-6 w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {uploadMutation.isPending ? 'Subiendo...' : 'Subir Catálogo'}
                        </button>
                    </>
                )}

                {/* Error Message */}
                {uploadMutation.isError && (
                    <div className="mt-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                        Error al subir el archivo. Intenta nuevamente.
                    </div>
                )}
            </div>
        </div>
    );
}
