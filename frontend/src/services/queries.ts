/**
 * React Query hooks for API calls.
 * 
 * REFACTORED: All "Catalog" references eliminated. Using "List" terminology.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';

// ============================================
// TYPES
// ============================================

interface PriceList {
    id: number;
    name: string;
    status: string;
    product_count: number;
    created_at: string;
}

interface Product {
    id: number;
    code: string | null;
    name: string;
    brand: string | null;
    price: number | null;
    currency: string;
    price_range_name: string | null;
    classification_method: string;
    confidence_score: number;
    list_type: string;
    structured_data: Record<string, string> | null;
}

interface PriceRange {
    id: number;
    name: string;
    min_price: number | null;
    max_price: number | null;
    color: string;
    display_order: number;
}

interface MasterProduct {
    id: number;
    index_number: number;
    clean_code: string;
    description: string;
    brand: string | null;
    price_usd: number;
    review_status: 'pending' | 'confirmed' | 'rejected';
    confidence_score: number;
    source_list_id: number;
    original_list_name: string;
    margin_percentage: number | null;
    final_price: number | null;
}

interface PriceStats {
    min_price: number;
    max_price: number;
    p25: number;
    p50: number;
    p75: number;
}

// ============================================
// PRICE LISTS
// ============================================

export function useLists(status?: string) {
    return useQuery({
        queryKey: ['lists', status],
        queryFn: async () => {
            const params = status ? { status } : {};
            const response = await api.get<{ lists: PriceList[]; total: number }>('/lists', { params });
            return response.data;
        },
    });
}

export function useList(id: number) {
    return useQuery({
        queryKey: ['list', id],
        queryFn: async () => {
            const response = await api.get<PriceList>(`/lists/${id}`);
            return response.data;
        },
        enabled: !!id,
    });
}

export function useUploadList() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);

            const response = await api.post('/lists/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lists'] });
            queryClient.invalidateQueries({ queryKey: ['master-products'] });
        },
    });
}

export function useDeleteList() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/lists/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lists'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['master-products'] });
        },
    });
}

// ============================================
// PRODUCTS
// ============================================

export function useProducts(listId?: number) {
    return useQuery({
        queryKey: ['products', listId],
        queryFn: async () => {
            const params = listId ? { list_id: listId } : {};
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

// ============================================
// PRICE RANGES
// ============================================

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

// ============================================
// COMPARISON
// ============================================

export function useCompareLists() {
    return useMutation({
        mutationFn: async (data: { list_ids: number[]; use_ai?: boolean }) => {
            const response = await api.post('/compare', data);
            return response.data;
        },
    });
}

// ============================================
// MIXED LISTINGS
// ============================================

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
            list_ids: number[];
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

// ============================================
// MASTER TABLE (Gestión Listados)
// ============================================

export function useMasterProducts(params?: {
    viewMode?: 'enterprise' | 'client';
    sortBy?: 'alphabetical' | 'brand' | 'description' | 'price';
    brandFilter?: string;
    reviewStatusFilter?: string;
    page?: number;
    limit?: number;
}) {
    return useQuery({
        queryKey: ['master-products', params],
        queryFn: async () => {
            const queryParams = new URLSearchParams();
            if (params?.viewMode) queryParams.append('view_mode', params.viewMode);
            if (params?.sortBy) queryParams.append('sort_by', params.sortBy);
            if (params?.brandFilter) queryParams.append('brand_filter', params.brandFilter);
            if (params?.reviewStatusFilter) queryParams.append('review_status_filter', params.reviewStatusFilter);
            if (params?.page) queryParams.append('page', params.page.toString());
            if (params?.limit) queryParams.append('limit', params.limit.toString());

            const response = await api.get<{
                products: MasterProduct[];
                total: number;
                page: number;
                limit: number;
                has_next: boolean;
                has_prev: boolean;
            }>(`/master-products?${queryParams}`);
            return response.data;
        },
    });
}

export function usePriceStats() {
    return useQuery({
        queryKey: ['price-stats'],
        queryFn: async () => {
            const response = await api.get<PriceStats>('/master-products/stats');
            return response.data;
        },
    });
}

export function useUpdateMargin() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ productId, margin_percentage }: { productId: number; margin_percentage: number }) => {
            const response = await api.patch(`/master-products/${productId}/margin`, {
                margin_percentage
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['master-products'] });
        },
    });
}

export function useUpdateFinalPrice() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ productId, final_price }: { productId: number; final_price: number }) => {
            const response = await api.patch(`/master-products/${productId}/final-price`, {
                final_price
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['master-products'] });
        },
    });
}

export function useUpdateReviewStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ productId, review_status }: { productId: number; review_status: 'pending' | 'confirmed' | 'rejected' }) => {
            const response = await api.patch(`/master-products/${productId}/review-status`, {
                review_status
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['master-products'] });
        },
    });
}
