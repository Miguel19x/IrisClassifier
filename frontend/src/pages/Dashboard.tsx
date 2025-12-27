/**
 * Dashboard page - Main overview of catalogs and statistics.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

interface Catalog {
    id: number;
    name: string;
    status: string;
    product_count: number;
    created_at: string;
}

interface CatalogListResponse {
    catalogs: Catalog[];
    total: number;
    page: number;
    page_size: number;
}

export default function Dashboard() {
    const [page, setPage] = useState(1);

    const { data, isLoading, error } = useQuery<CatalogListResponse>({
        queryKey: ['catalogs', page],
        queryFn: async () => {
            const response = await api.get(`/catalogs?page=${page}&page_size=10`);
            return response.data;
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg">Cargando catálogos...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-red-500">Error al cargar catálogos</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
                <p className="text-gray-600">
                    Gestiona tus catálogos y productos clasificados
                </p>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-gray-500 text-sm font-medium">Total Catálogos</h3>
                    <p className="text-3xl font-bold mt-2">{data?.total || 0}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-gray-500 text-sm font-medium">Productos Totales</h3>
                    <p className="text-3xl font-bold mt-2">
                        {data?.catalogs.reduce((sum, cat) => sum + cat.product_count, 0) || 0}
                    </p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-gray-500 text-sm font-medium">Procesando</h3>
                    <p className="text-3xl font-bold mt-2">
                        {data?.catalogs.filter(c => c.status === 'processing').length || 0}
                    </p>
                </div>
            </div>

            {/* Catalogs List */}
            <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b">
                    <h2 className="text-xl font-semibold">Catálogos Recientes</h2>
                </div>
                <div className="divide-y">
                    {data?.catalogs.map((catalog) => (
                        <div key={catalog.id} className="px-6 py-4 hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium">{catalog.name}</h3>
                                    <p className="text-sm text-gray-500">
                                        {catalog.product_count} productos • {' '}
                                        {new Date(catalog.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div>
                                    <span
                                        className={`px-3 py-1 rounded-full text-sm ${catalog.status === 'completed'
                                                ? 'bg-green-100 text-green-800'
                                                : catalog.status === 'processing'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : catalog.status === 'failed'
                                                        ? 'bg-red-100 text-red-800'
                                                        : 'bg-gray-100 text-gray-800'
                                            }`}
                                    >
                                        {catalog.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Pagination */}
                {data && data.total > 10 && (
                    <div className="px-6 py-4 border-t flex items-center justify-between">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 border rounded disabled:opacity-50"
                        >
                            Anterior
                        </button>
                        <span className="text-sm text-gray-600">
                            Página {page} de {Math.ceil(data.total / 10)}
                        </span>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={page >= Math.ceil(data.total / 10)}
                            className="px-4 py-2 border rounded disabled:opacity-50"
                        >
                            Siguiente
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
