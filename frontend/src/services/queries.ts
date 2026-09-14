/**
 * React Query hooks for API calls.
 * 
 * REFACTORED: All "Catalog" references eliminated. Using "List" terminology.
 */
import { useQuery, useMutation, useQueryClient, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import api from './api';
import { mockDataService } from './mockData';
import { isDemoMode } from '../config/demoMode';

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
            if (isDemoMode()) {
                return mockDataService.getLists(status);
            }
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
            if (isDemoMode()) {
                return mockDataService.getList(id);
            }
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
            if (isDemoMode()) {
                return mockDataService.uploadList(file);
            }
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
            if (isDemoMode()) {
                await mockDataService.deleteList(id);
                return;
            }
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
            if (isDemoMode()) {
                return mockDataService.getProducts({ list_id: listId });
            }
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
            if (isDemoMode()) {
                const result = await mockDataService.getProducts({
                    list_id: listId,
                    page: pageParam,
                    page_size: PRODUCTS_PAGE_SIZE,
                    search: params?.search,
                });
                return result;
            }
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
        getNextPageParam: (lastPage: { page: number; page_size: number; total: number }) => {
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
            if (isDemoMode()) {
                return mockDataService.updateProduct(listId, productId, data);
            }
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
            if (isDemoMode()) {
                return mockDataService.updateProduct(listId, productId, { status: 'verified' } as any);
            }
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
            if (isDemoMode()) {
                return mockDataService.getPriceRanges();
            }
            const response = await api.get<PriceRange[]>('/price-ranges');
            return response.data;
        },
    });
}

export function useCreatePriceRange() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: Omit<PriceRange, 'id' | 'user_id' | 'is_default' | 'created_at'>) => {
            if (isDemoMode()) {
                return mockDataService.createPriceRange(data as any);
            }
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
            if (isDemoMode()) {
                return mockDataService.updatePriceRange(id, data);
            }
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
            if (isDemoMode()) {
                await mockDataService.deletePriceRange(id);
                return;
            }
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
            if (isDemoMode()) {
                return mockDataService.compareLists(data);
            }
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
            if (isDemoMode()) {
                return mockDataService.getMixedListings();
            }
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
            if (isDemoMode()) {
                return mockDataService.createMixedListing(data);
            }
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
            if (isDemoMode()) {
                return mockDataService.getMixedListingProducts(listingId, filters);
            }
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
            if (isDemoMode()) {
                await mockDataService.deleteMixedListing(id);
                return;
            }
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
            if (isDemoMode()) {
                return mockDataService.getMasterProducts(params);
            }
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
    listId?: number;
}) {
    return useInfiniteQuery({
        queryKey: ['master-products-infinite', params],
        queryFn: async ({ pageParam = 1 }) => {
            if (isDemoMode()) {
                return mockDataService.getMasterProducts({
                    ...params,
                    page: pageParam,
                    limit: MASTER_PRODUCTS_PAGE_SIZE,
                });
            }
            const queryParams = new URLSearchParams();
            queryParams.append('page', pageParam.toString());
            queryParams.append('limit', MASTER_PRODUCTS_PAGE_SIZE.toString());
            if (params?.viewMode) queryParams.append('view_mode', params.viewMode);
            if (params?.sortBy) queryParams.append('sort_by', params.sortBy);
            if (params?.search) queryParams.append('search', params.search);
            if (params?.brandFilter) queryParams.append('brand_filter', params.brandFilter);
            if (params?.reviewStatusFilter) queryParams.append('review_status_filter', params.reviewStatusFilter);
            if (params?.listId !== undefined) queryParams.append('list_id', params.listId.toString());

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
        getNextPageParam: (lastPage: { has_next: boolean; page: number }) => {
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
            if (isDemoMode()) {
                return mockDataService.getPriceStats();
            }
            const response = await api.get<PriceStats>('/master-products/stats');
            return response.data;
        },
    });
}

export function useUpdateMargin() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ productId, margin_percentage }: { productId: number; margin_percentage: number }) => {
            if (isDemoMode()) {
                return mockDataService.updateMargin(productId, margin_percentage);
            }
            const response = await api.patch(`/master-products/${productId}/margin`, {
                margin_percentage
            });
            return response.data;
        },
        // Optimistic update - instantly update the cache before API responds
        onMutate: async ({ productId, margin_percentage }) => {
            // Cancel any outgoing refetches to avoid overwriting optimistic update
            await queryClient.cancelQueries({ queryKey: ['master-products-infinite'] });

            // Snapshot the previous value for potential rollback
            const previousData = queryClient.getQueryData(['master-products-infinite']);

            // Optimistically update the cache
            queryClient.setQueriesData(
                { queryKey: ['master-products-infinite'] },
                (oldData: any) => {
                    if (!oldData?.pages) return oldData;
                    return {
                        ...oldData,
                        pages: oldData.pages.map((page: any) => ({
                            ...page,
                            products: page.products.map((p: any) =>
                                p.id === productId
                                    ? {
                                        ...p,
                                        margin_percentage,
                                        final_price: p.price_usd * (1 + margin_percentage / 100)
                                    }
                                    : p
                            )
                        }))
                    };
                }
            );

            return { previousData };
        },
        // Rollback on error
        onError: (_err, _variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['master-products-infinite'], context.previousData);
            }
        },
        // Only refetch if needed (minimal sync)
        onSettled: () => {
            // Optionally refetch to ensure consistency, but debounced/delayed
            // queryClient.invalidateQueries({ queryKey: ['master-products-infinite'] });
        },
    });
}

export function useUpdateFinalPrice() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ productId, final_price }: { productId: number; final_price: number }) => {
            if (isDemoMode()) {
                return mockDataService.updateFinalPrice(productId, final_price);
            }
            const response = await api.patch(`/master-products/${productId}/final-price`, {
                final_price
            });
            return response.data;
        },
        onMutate: async ({ productId, final_price }) => {
            await queryClient.cancelQueries({ queryKey: ['master-products-infinite'] });
            const previousData = queryClient.getQueryData(['master-products-infinite']);

            queryClient.setQueriesData(
                { queryKey: ['master-products-infinite'] },
                (oldData: any) => {
                    if (!oldData?.pages) return oldData;
                    return {
                        ...oldData,
                        pages: oldData.pages.map((page: any) => ({
                            ...page,
                            products: page.products.map((p: any) => {
                                if (p.id !== productId) return p;
                                const margin = p.price_usd > 0
                                    ? ((final_price - p.price_usd) / p.price_usd) * 100
                                    : 0;
                                return { ...p, final_price, margin_percentage: margin };
                            })
                        }))
                    };
                }
            );
            return { previousData };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['master-products-infinite'], context.previousData);
            }
        },
        onSettled: () => { },
    });
}

export function useUpdateMasterProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ productId, data }: {
            productId: number;
            data: {
                clean_code?: string;
                description?: string;
                brand?: string;
                price_usd?: number;
            }
        }) => {
            if (isDemoMode()) {
                return mockDataService.updateMasterProduct(productId, data);
            }
            const response = await api.patch(`/master-products/${productId}`, data);
            return response.data;
        },
        onMutate: async ({ productId, data }) => {
            await queryClient.cancelQueries({ queryKey: ['master-products-infinite'] });
            const previousData = queryClient.getQueryData(['master-products-infinite']);

            queryClient.setQueriesData(
                { queryKey: ['master-products-infinite'] },
                (oldData: any) => {
                    if (!oldData?.pages) return oldData;
                    return {
                        ...oldData,
                        pages: oldData.pages.map((page: any) => ({
                            ...page,
                            products: page.products.map((p: any) =>
                                p.id === productId ? { ...p, ...data } : p
                            )
                        }))
                    };
                }
            );
            return { previousData };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['master-products-infinite'], context.previousData);
            }
        },
        onSettled: () => { },
    });
}

export function useBulkUpdateMargin() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            margin_percentage,
            productIds,
            search
        }: {
            margin_percentage: number;
            productIds?: number[];
            search?: string;
        }) => {
            if (isDemoMode()) {
                return mockDataService.bulkUpdateMargin(margin_percentage, productIds, search);
            }
            const response = await api.post('/master-products/bulk-margin', {
                margin_percentage,
                product_ids: productIds,
                search
            });
            return response.data;
        },
        onMutate: async ({ margin_percentage, productIds }) => {
            await queryClient.cancelQueries({ queryKey: ['master-products-infinite'] });
            const previousData = queryClient.getQueryData(['master-products-infinite']);

            // Optimistically update all products (or only those in productIds if specified)
            queryClient.setQueriesData(
                { queryKey: ['master-products-infinite'] },
                (oldData: any) => {
                    if (!oldData?.pages) return oldData;
                    return {
                        ...oldData,
                        pages: oldData.pages.map((page: any) => ({
                            ...page,
                            products: page.products.map((p: any) => {
                                // If productIds specified, only update those; otherwise update all
                                const shouldUpdate = !productIds || productIds.includes(p.id);
                                if (!shouldUpdate) return p;
                                return {
                                    ...p,
                                    margin_percentage,
                                    final_price: p.price_usd * (1 + margin_percentage / 100)
                                };
                            })
                        }))
                    };
                }
            );
            return { previousData };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['master-products-infinite'], context.previousData);
            }
        },
        onSettled: () => {
            // Background sync to ensure complete data after optimistic update
            queryClient.invalidateQueries({ queryKey: ['master-products-infinite'] });
        },
    });
}

export function useUpdateReviewStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ productId, review_status }: { productId: number; review_status: 'pending' | 'confirmed' | 'rejected' }) => {
            if (isDemoMode()) {
                return mockDataService.updateReviewStatus(productId, review_status);
            }
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

export function useBulkRename() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            target_text,
            replacement_text,
            productIds,
            search,
            field = 'description'
        }: {
            target_text: string;
            replacement_text: string;
            productIds?: number[];
            search?: string;
            field?: 'description' | 'brand';
        }) => {
            if (isDemoMode()) {
                return mockDataService.bulkRename(target_text, replacement_text, productIds, search, field);
            }
            const response = await api.post('/master-products/bulk-rename', {
                target_text,
                replacement_text,
                product_ids: productIds,
                search,
                field
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['master-products-infinite'] });
        },
    });
}

export function useBulkDelete() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ productIds }: { productIds: number[] }) => {
            if (isDemoMode()) {
                return mockDataService.bulkDelete(productIds);
            }
            const response = await api.post('/master-products/bulk-delete', {
                product_ids: productIds
            });
            return response.data;
        },
        onMutate: async ({ productIds }) => {
            await queryClient.cancelQueries({ queryKey: ['master-products-infinite'] });
            const previousData = queryClient.getQueryData(['master-products-infinite']);

            // Optimistically remove deleted products from cache
            queryClient.setQueriesData(
                { queryKey: ['master-products-infinite'] },
                (oldData: any) => {
                    if (!oldData?.pages) return oldData;
                    return {
                        ...oldData,
                        pages: oldData.pages.map((page: any) => ({
                            ...page,
                            products: page.products.filter((p: any) => !productIds.includes(p.id))
                        }))
                    };
                }
            );
            return { previousData };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['master-products-infinite'], context.previousData);
            }
        },
        onSettled: () => {
            // Background sync to ensure complete data after optimistic update
            queryClient.invalidateQueries({ queryKey: ['master-products-infinite'] });
        },
    });
}

export function useRestoreProducts() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ products }: { products: any[] }) => {
            if (isDemoMode()) {
                return mockDataService.restoreProducts(products);
            }
            const response = await api.post('/master-products/restore', {
                products
            });
            return response.data;
        },
        onMutate: async ({ products }) => {
            await queryClient.cancelQueries({ queryKey: ['master-products-infinite'] });
            const previousData = queryClient.getQueryData(['master-products-infinite']);

            // Optimistically add restored products back to cache
            // For restoring deleted products or reverting changes
            queryClient.setQueriesData(
                { queryKey: ['master-products-infinite'] },
                (oldData: any) => {
                    if (!oldData?.pages) return oldData;

                    // Create a map of existing product IDs
                    const existingIds = new Set<number>();
                    oldData.pages.forEach((page: any) => {
                        page.products.forEach((p: any) => existingIds.add(p.id));
                    });

                    // Update existing products or prepare new ones to add
                    const productsToAdd: any[] = [];
                    const productsMap = new Map(products.map(p => [p.id, p]));

                    const updatedPages = oldData.pages.map((page: any) => ({
                        ...page,
                        products: page.products.map((p: any) =>
                            productsMap.has(p.id) ? { ...p, ...productsMap.get(p.id) } : p
                        )
                    }));

                    // Add products that don't exist (were deleted) to first page
                    products.forEach(p => {
                        if (!existingIds.has(p.id)) {
                            productsToAdd.push(p);
                        }
                    });

                    if (productsToAdd.length > 0 && updatedPages.length > 0) {
                        updatedPages[0] = {
                            ...updatedPages[0],
                            products: [...productsToAdd, ...updatedPages[0].products]
                        };
                    }

                    return { ...oldData, pages: updatedPages };
                }
            );
            return { previousData };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['master-products-infinite'], context.previousData);
            }
        },
        onSettled: () => {
            // Background sync to ensure complete data after optimistic update
            queryClient.invalidateQueries({ queryKey: ['master-products-infinite'] });
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
            if (isDemoMode()) {
                await mockDataService.exportMockPDF(customTitle, viewMode);
                return;
            }
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
            if (isDemoMode()) {
                await mockDataService.exportMockExcel(customTitle, viewMode);
                return;
            }
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

// ============================================
// ADVANCED EXPORT (with template support)
// ============================================

interface ManualHeaderConfig {
    content: string;
    alignment: 'left' | 'center' | 'right';
}

interface TemplateFileConfig {
    name: string;
    type: 'pdf' | 'excel';
    data: string; // Base64 encoded file
}

interface AdvancedExportConfig {
    filename: string;
    header_mode: 'manual' | 'template';
    manual_header?: ManualHeaderConfig;
    template_file?: TemplateFileConfig;
    view_mode: 'enterprise' | 'client';
    sort_by?: 'index' | 'alphabetical' | 'brand' | 'description' | 'price';
    search?: string;  // Search filter for context-aware export
    brand_filter?: string;
    review_status_filter?: 'pending' | 'confirmed' | 'rejected';
    format: 'excel' | 'pdf';
}

export function useExportAdvanced() {
    return useMutation({
        mutationFn: async (config: AdvancedExportConfig) => {
            if (isDemoMode()) {
                if (config.format === 'pdf') {
                    await mockDataService.exportMockPDF(config.filename || 'Listado_Productos', config.view_mode);
                } else {
                    await mockDataService.exportMockExcel(config.filename || 'Listado_Productos', config.view_mode);
                }
                return;
            }

            const response = await api.post('/master-products/export-advanced', config, {
                responseType: 'blob'
            });

            const mimeType = config.format === 'pdf'
                ? 'application/pdf'
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            const extension = config.format === 'pdf' ? 'pdf' : 'xlsx';

            // Try to get filename from Content-Disposition header, otherwise generate with date
            const contentDisposition = response.headers['content-disposition'];
            let downloadFilename = '';
            if (contentDisposition) {
                const match = contentDisposition.match(/filename=(.+)/);
                downloadFilename = match ? match[1].replace(/"/g, '') : '';
            }
            if (!downloadFilename) {
                // Generate filename with date format YYYY-MM-DD
                const today = new Date();
                const dateStr = today.toISOString().split('T')[0];
                downloadFilename = `${config.filename.replace(/\s+/g, '_')}_${dateStr}.${extension}`;
            }

            const url = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', downloadFilename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        },
    });
}

/**
 * Export PDF and open in new tab for printing.
 * This ensures ALL products are included (from database, not virtualized list).
 */
export function useExportAdvancedForPrint() {
    return useMutation({
        mutationFn: async (config: AdvancedExportConfig) => {
            if (isDemoMode()) {
                await mockDataService.exportMockPDF(config.filename || 'Impresion_Catalogo', config.view_mode);
                return;
            }

            // Force PDF format for printing
            const printConfig = { ...config, format: 'pdf' as const };

            const response = await api.post('/master-products/export-advanced', printConfig, {
                responseType: 'blob'
            });

            // Create blob URL and open in new tab
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);

            // Open in new tab for printing
            const printWindow = window.open(url, '_blank');

            if (printWindow) {
                // Some browsers need a delay before revoking the URL
                printWindow.onload = () => {
                    // Optionally trigger print dialog automatically
                    // printWindow.print();
                };
            } else {
                // Popup blocked - fall back to direct navigation
                window.location.href = url;
            }

            // Clean up URL after a delay
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
            }, 60000); // Keep URL valid for 1 minute
        },
    });
}

