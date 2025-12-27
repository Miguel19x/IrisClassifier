/**
 * React Query hooks for API calls.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';

// Types
interface Catalog {
    id: number;
    name: string;
    status: string;
    product_count: number;
    created_at: string;
}

interface Product {
    id: number;
    name: string;
    price: number | null;
    price_range_name: string | null;
    classification_method: string;
    confidence_score: number;
    catalog_type: string;  // 'price_list' or 'automotive_parts'
    structured_data: Record<string, string> | null;  // Flexible column data
}

interface PriceRange {
    id: number;
    name: string;
    min_price: number | null;
    max_price: number | null;
    color: string;
    display_order: number;
}

// Catalogs
export function useCatalogs(status?: string) {
    return useQuery({
        queryKey: ['catalogs', status],
        queryFn: async () => {
            const params = status ? { status } : {};
            const response = await api.get<{ catalogs: Catalog[]; total: number }>('/catalogs', { params });
            return response.data;
        },
    });
}

export function useCatalog(id: number) {
    return useQuery({
        queryKey: ['catalog', id],
        queryFn: async () => {
            const response = await api.get<Catalog>(`/catalogs/${id}`);
            return response.data;
        },
        enabled: !!id,
    });
}

export function useUploadCatalog() {
    const queryClient = useQueryClient();

    return useMutation({
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
        },
    });
}

export function useDeleteCatalog() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/catalogs/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['catalogs'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });
}

// Products
export function useProducts(catalogId?: number) {
    return useQuery({
        queryKey: ['products', catalogId],
        queryFn: async () => {
            const params = catalogId ? { catalog_id: catalogId } : {};
            const response = await api.get<{ products: Product[]; total: number }>('/products', { params });
            return response.data;
        },
    });
}

export function useUpdateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: number; data: Partial<Product> }) => {
            const response = await api.patch<Product>(`/products/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });
}

// Price Ranges
export function usePriceRanges() {
    return useQuery({
        queryKey: ['price-ranges'],
        queryFn: async () => {
            const response = await api.get<PriceRange[]>('/price-ranges');
            return response.data;
        },
    });
}

export function useCreatePriceRange() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: Omit<PriceRange, 'id' | 'user_id' | 'is_default' | 'created_at'>) => {
            const response = await api.post<PriceRange>('/price-ranges', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['price-ranges'] });
        },
    });
}

export function useUpdatePriceRange() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: number; data: Partial<PriceRange> }) => {
            const response = await api.put<PriceRange>(`/price-ranges/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['price-ranges'] });
        },
    });
}

export function useDeletePriceRange() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/price-ranges/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['price-ranges'] });
        },
    });
}

// Comparison
export function useCompareCatalogs() {
    return useMutation({
        mutationFn: async (data: { catalog_ids: number[]; use_ai?: boolean }) => {
            const response = await api.post('/compare', data);
            return response.data;
        },
    });
}

// Mixed Listings
export function useMixedListings() {
    return useQuery({
        queryKey: ['mixed-listings'],
        queryFn: async () => {
            const response = await api.get('/mixed-listings');
            return response.data;
        },
    });
}

export function useCreateMixedListing() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: {
            name: string;
            description?: string;
            catalog_ids: number[];
            use_best_prices?: boolean;
            price_range_ids?: number[];
        }) => {
            const response = await api.post('/mixed-listings', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mixed-listings'] });
        },
    });
}

export function useMixedListingProducts(listingId: number, filters?: {
    price_range_id?: number;
    search?: string;
    sort_by?: string;
}) {
    return useQuery({
        queryKey: ['mixed-listing-products', listingId, filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.price_range_id) params.append('price_range_id', filters.price_range_id.toString());
            if (filters?.search) params.append('search', filters.search);
            if (filters?.sort_by) params.append('sort_by', filters.sort_by);

            const response = await api.get(`/mixed-listings/${listingId}/products?${params}`);
            return response.data;
        },
        enabled: !!listingId,
    });
}

export function useDeleteMixedListing() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/mixed-listings/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mixed-listings'] });
        },
    });
}
