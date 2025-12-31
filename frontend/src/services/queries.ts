/**
 * React Query hooks for API calls.
 * 
 * REFACTORED: All "Catalog" references eliminated. Using "List" terminology.
 */
import { useQuery, useMutation, useQueryClient, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
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

const PRODUCTS_PAGE_SIZE = 200;

export function useProducts(listId?: number) {
    return useQuery({
        queryKey: ['products', listId],
        queryFn: async () => {
            const params: Record<string, any> = { page_size: 20000 };
            if (listId) params.list_id = listId;
            const response = await api.get<{ products: Product[]; total: number }>('/products', { params });
            return response.data;
        },
    });
}

/**
 * Infinite scroll version of useProducts for large datasets.
 * Loads products in pages as user scrolls.
 */
export function useInfiniteProducts(listId?: number, params?: {
    search?: string;
    statusFilter?: 'pending' | 'verified';
    sortBy?: 'index' | 'alphabetical' | 'brand' | 'price';
}) {
    return useInfiniteQuery({
        queryKey: ['products-infinite', listId, params],
        queryFn: async ({ pageParam = 1 }) => {
            const queryParams: Record<string, any> = {
                page: pageParam,
                page_size: PRODUCTS_PAGE_SIZE,
            };
            if (listId) queryParams.list_id = listId;
            if (params?.search) queryParams.search = params.search;
            if (params?.statusFilter) queryParams.status_filter = params.statusFilter;
            if (params?.sortBy) queryParams.sort_by = params.sortBy;

            const response = await api.get<{
                products: Product[];
                total: number;
                page: number;
                page_size: number;
            }>('/products', { params: queryParams });
            return response.data;
        },
        getNextPageParam: (lastPage) => {
            const hasMore = lastPage.page * PRODUCTS_PAGE_SIZE < lastPage.total;
            return hasMore ? lastPage.page + 1 : undefined;
        },
        initialPageParam: 1,
        // Keep previous data while fetching new - prevents page reset on search
        placeholderData: keepPreviousData,
    });
}

export function useUpdateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ listId, productId, data }: { listId: number; productId: number; data: Partial<Product> }) => {
            const response = await api.patch<Product>(`/lists/${listId}/products/${productId}`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });
}

export function useVerifyProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ listId, productId }: { listId: number; productId: number }) => {
            const response = await api.patch<Product>(`/lists/${listId}/products/${productId}`, { status: 'verified' });
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

const MASTER_PRODUCTS_PAGE_SIZE = 200;

export function useMasterProducts(params?: {
    viewMode?: 'enterprise' | 'client';
    sortBy?: 'index' | 'alphabetical' | 'brand' | 'description' | 'price';
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

/**
 * Infinite scroll version of useMasterProducts for large datasets.
 * Loads products in pages as user scrolls.
 */
export function useInfiniteMasterProducts(params?: {
    viewMode?: 'enterprise' | 'client';
    sortBy?: 'index' | 'alphabetical' | 'brand' | 'description' | 'price';
    search?: string;
    brandFilter?: string;
    reviewStatusFilter?: string;
}) {
    return useInfiniteQuery({
        queryKey: ['master-products-infinite', params],
        queryFn: async ({ pageParam = 1 }) => {
            const queryParams = new URLSearchParams();
            queryParams.append('page', pageParam.toString());
            queryParams.append('limit', MASTER_PRODUCTS_PAGE_SIZE.toString());
            if (params?.viewMode) queryParams.append('view_mode', params.viewMode);
            if (params?.sortBy) queryParams.append('sort_by', params.sortBy);
            if (params?.search) queryParams.append('search', params.search);
            if (params?.brandFilter) queryParams.append('brand_filter', params.brandFilter);
            if (params?.reviewStatusFilter) queryParams.append('review_status_filter', params.reviewStatusFilter);

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
        getNextPageParam: (lastPage) => {
            return lastPage.has_next ? lastPage.page + 1 : undefined;
        },
        initialPageParam: 1,
        // Keep previous data while fetching new - prevents page reset on search
        placeholderData: keepPreviousData,
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
            queryClient.invalidateQueries({ queryKey: ['master-products-infinite'] });
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
            queryClient.invalidateQueries({ queryKey: ['master-products-infinite'] });
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

// ============================================
// EXPORT
// ============================================

interface ExportParams {
    viewMode: 'enterprise' | 'client';
    customTitle?: string;
}

export function useExportPDF() {
    return useMutation({
        mutationFn: async ({ viewMode, customTitle = 'Listado de Productos' }: ExportParams) => {
            const title = encodeURIComponent(customTitle);
            const response = await api.get(`/master-products/export?format=pdf&view_mode=${viewMode}&custom_title=${title}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${customTitle.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        },
    });
}

export function useExportExcel() {
    return useMutation({
        mutationFn: async ({ viewMode, customTitle = 'Listado de Productos' }: ExportParams) => {
            const title = encodeURIComponent(customTitle);
            const response = await api.get(`/master-products/export?format=excel&view_mode=${viewMode}&custom_title=${title}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${customTitle.replace(/\s+/g, '_')}_${Date.now()}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        },
    });
}
