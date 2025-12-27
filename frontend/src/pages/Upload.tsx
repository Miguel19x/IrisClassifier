/**
 * Upload page - File upload interface for catalogs.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

export default function Upload() {
    const [file, setFile] = useState<File | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const queryClient = useQueryClient();

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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['catalogs'] });
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

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">Subir Catálogo</h1>
                <p className="text-gray-600 mb-8">
                    Sube archivos PDF o Excel para extraer y clasificar productos
                </p>

                {/* Drag and Drop Area */}
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

                {/* Success Message */}
                {uploadMutation.isSuccess && (
                    <div className="mt-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
                        ✓ Catálogo subido exitosamente. Procesando...
                    </div>
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
