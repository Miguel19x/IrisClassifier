/**
 * Upload page - File upload interface for lists with progress tracking.
 * Now includes integrated price comparison tool.
 */
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useLists } from '../services/queries';

interface ProgressData {
    list_id: number;
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

interface PriceComparison {
    product_name: string;
    barato: number;
    mediano?: number;
    caro: number;
}

export default function Upload() {
    const [file, setFile] = useState<File | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [listId, setListId] = useState<number | null>(null);
    const queryClient = useQueryClient();

    // Compare functionality
    const [showCompare, setShowCompare] = useState(false);
    const [selectedForCompare, setSelectedForCompare] = useState<number[]>([]);
    const [comparisonResults, setComparisonResults] = useState<PriceComparison[]>([]);
    const { data: listsData } = useLists();

    // Polling for progress when we have a list being processed
    const { data: progress } = useQuery({
        queryKey: ['listProgress', listId],
        queryFn: async () => {
            const response = await api.get<ProgressData>(`/lists/${listId}/progress`);
            return response.data;
        },
        enabled: listId !== null,
        refetchInterval: (query) => {
            const data = query.state.data;
            // Stop polling when completed or failed
            if (data?.status === 'completed' || data?.status === 'failed') {
                return false;
            }
            return 2000; // Poll every 2 seconds
        },
    });

    // Reset list ID when processing completes
    useEffect(() => {
        if (progress?.status === 'completed') {
            queryClient.invalidateQueries({ queryKey: ['lists'] });
            queryClient.invalidateQueries({ queryKey: ['master-products'] });
            // Keep showing success for 5 seconds, then reset
            const timer = setTimeout(() => {
                setListId(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [progress?.status, queryClient]);

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            // Using new /lists/upload endpoint with ETL Intelligent
            const response = await api.post('/lists/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        },
        onSuccess: (data) => {
            setListId(data.list_id);
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

    // Compare functionality
    const toggleListForCompare = (id: number) => {
        setSelectedForCompare(prev => {
            if (prev.includes(id)) {
                return prev.filter(c => c !== id);
            } else if (prev.length < 3) {
                return [...prev, id];
            }
            return prev;
        });
    };

    const handleCompare = async () => {
        if (selectedForCompare.length < 2) {
            alert('Selecciona al menos 2 listas para comparar');
            return;
        }

        try {
            const response = await api.post('/compare', {
                list_ids: selectedForCompare,
                use_ai: false // Simplified comparison
            });

            const results = response.data;

            // Simplify results to show Barato, Mediano, Caro
            const simplified: PriceComparison[] = results.matches.map((match: any) => {
                const prices = match.products.map((p: any) => p.price).filter((p: number) => p > 0).sort((a: number, b: number) => a - b);

                if (prices.length === 0) return null;

                const comparison: PriceComparison = {
                    product_name: match.canonical_name,
                    barato: prices[0],
                    caro: prices[prices.length - 1]
                };

                // Only show mediano if comparing 3+ lists
                if (selectedForCompare.length >= 3 && prices.length >= 3) {
                    comparison.mediano = (prices[0] + prices[prices.length - 1]) / 2;
                }

                return comparison;
            }).filter((c: PriceComparison | null) => c !== null);

            setComparisonResults(simplified);
        } catch (error) {
            alert('Error al comparar listas');
        }
    };

    const isProcessing = listId !== null && progress?.status !== 'completed' && progress?.status !== 'failed';

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">Subir Listado</h1>
                <p className="text-gray-600 mb-8">
                    Sube archivos PDF o Excel para extraer y clasificar productos
                </p>

                {/* Progress Tracker */}
                {listId !== null && progress && (
                    <div className={`mb-6 rounded-lg p-6 ${progress.status === 'completed' ? 'bg-green-50 border border-green-200' :
                        progress.status === 'failed' ? 'bg-red-50 border border-red-200' :
                            'bg-blue-50 border border-blue-200'
                        }`}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-lg">
                                {progress.status === 'completed' ? '✓ Procesamiento Completado' :
                                    progress.status === 'failed' ? '✗ Error en Procesamiento' :
                                        '⏳ Procesando Listado...'}
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
                            {uploadMutation.isPending ? 'Subiendo...' : 'Subir Listado'}
                        </button>
                    </>
                )}

                {/* Error Message */}
                {uploadMutation.isError && (
                    <div className="mt-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                        Error al subir el archivo. Intenta nuevamente.
                    </div>
                )}

                {/* Compare Section */}
                {listsData && listsData.lists && listsData.lists.length >= 2 && (
                    <div className="mt-12 border-t pt-8">
                        <button
                            onClick={() => setShowCompare(!showCompare)}
                            className="flex items-center justify-between w-full text-left mb-4"
                        >
                            <h2 className="text-2xl font-bold">📊 Comparar Precios</h2>
                            <span className="text-gray-500">{showCompare ? '▼' : '▶'}</span>
                        </button>

                        {showCompare && (
                            <div className="space-y-6">
                                <p className="text-gray-600">
                                    Selecciona 2 o 3 listas para comparar precios (Barato, Mediano, Caro)
                                </p>

                                {/* List Selection */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {listsData.lists.map((list: any) => (
                                        <div
                                            key={list.id}
                                            onClick={() => toggleListForCompare(list.id)}
                                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedForCompare.includes(list.id)
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-300 hover:border-gray-400'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-semibold">{list.name}</p>
                                                    <p className="text-sm text-gray-500">
                                                        {list.product_count} productos
                                                    </p>
                                                </div>
                                                {selectedForCompare.includes(list.id) && (
                                                    <span className="text-blue-600 text-2xl">✓</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Compare Button */}
                                <button
                                    onClick={handleCompare}
                                    disabled={selectedForCompare.length < 2}
                                    className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {selectedForCompare.length < 2
                                        ? 'Selecciona al menos 2 listas'
                                        : '🔍 Comparar Precios'}
                                </button>

                                {/* Comparison Results */}
                                {comparisonResults.length > 0 && (
                                    <div className="mt-6 bg-white border rounded-lg overflow-hidden">
                                        <div className="bg-gray-50 px-6 py-4 border-b">
                                            <h3 className="font-semibold text-lg">
                                                Resultados de Comparación
                                            </h3>
                                            <p className="text-sm text-gray-600">
                                                {comparisonResults.length} productos encontrados
                                            </p>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead className="bg-gray-50 border-b">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                            Producto
                                                        </th>
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                                            🟢 Barato
                                                        </th>
                                                        {selectedForCompare.length >= 3 && (
                                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                                                🟡 Mediano
                                                            </th>
                                                        )}
                                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                                            🔴 Caro
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {comparisonResults.map((result, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50">
                                                            <td className="px-6 py-4 text-sm">
                                                                {result.product_name}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-right font-semibold text-green-600">
                                                                ${result.barato.toFixed(2)}
                                                            </td>
                                                            {selectedForCompare.length >= 3 && result.mediano && (
                                                                <td className="px-6 py-4 text-sm text-right font-semibold text-yellow-600">
                                                                    ${result.mediano.toFixed(2)}
                                                                </td>
                                                            )}
                                                            <td className="px-6 py-4 text-sm text-right font-semibold text-red-600">
                                                                ${result.caro.toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
