/**
 * Dashboard page - Main overview of lists and statistics.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

interface List {
    id: number;
    name: string;
    status: string;
    product_count: number;
    created_at: string;
}

interface ListResponse {
    catalogs: List[];  // Backend still uses 'catalogs' field
    total: number;
    page: number;
    page_size: number;
}

export default function Dashboard() {
    const [page, setPage] = useState(1);

    const { data, isLoading, error } = useQuery<ListResponse>({
        queryKey: ['lists', page],
        queryFn: async () => {
            const response = await api.get(`/catalogs?page=${page}&page_size=10`);
            return response.data;
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg">Cargando listas...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-red-500">Error al cargar listas</div>
            </div>
        );
    }

    const lists = data?.catalogs || [];

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
                <p className="text-gray-600">
                    Gestiona tus listas de precios y productos clasificados
                </p>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-gray-500 text-sm font-medium">Total Listas</h3>
                    <p className="text-3xl font-bold mt-2">{data?.total || 0}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-gray-500 text-sm font-medium">Productos Totales</h3>
                    <p className="text-3xl font-bold mt-2">
                        {lists.reduce((sum, list) => sum + list.product_count, 0)}
                    </p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-gray-500 text-sm font-medium">Procesando</h3>
                    <p className="text-3xl font-bold mt-2">
                        {lists.filter(l => l.status === 'processing').length}
                    </p>
                </div>
            </div>

            {/* Lists */}
            <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b">
                    <h2 className="text-xl font-semibold">Listas Recientes</h2>
                </div>
                <div className="divide-y">
                    {lists.map((list) => (
                        <div key={list.id} className="px-6 py-4 hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium">{list.name}</h3>
                                    <p className="text-sm text-gray-500">
                                        {list.product_count} productos • {' '}
                                        {new Date(list.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div>
                                    <span
                                        className={`px-3 py-1 rounded-full text-sm ${list.status === 'completed'
                                            ? 'bg-green-100 text-green-800'
                                            : list.status === 'processing'
                                                ? 'bg-blue-100 text-blue-800'
                                                : list.status === 'failed'
                                                    ? 'bg-red-100 text-red-800'
                                                    : 'bg-gray-100 text-gray-800'
                                            }`}
                                    >
                                        {list.status}
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
