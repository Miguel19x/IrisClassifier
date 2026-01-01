/**
 * React Query hooks for API calls.
 * 
 * REFACTORED: All "Catalog" references eliminated. Using "List" terminology.
 */
import { useQuery, useMutation, useQueryClient, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import api from './api';
import { mockDataService } from './mockData';

// Check if running in mock mode
const MOCK_MODE = import.meta.env.VITE_MOCK_API === 'true';

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
            if (MOCK_MODE) {
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
            if (MOCK_MODE) {
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
            if (MOCK_MODE) {
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
            if (MOCK_MODE) {
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
            if (MOCK_MODE) {
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
            if (MOCK_MODE) {
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
            if (MOCK_MODE) {
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
            if (MOCK_MODE) {
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
            if (MOCK_MODE) {
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
            if (MOCK_MODE) {
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
            if (MOCK_MODE) {
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
            if (MOCK_MODE) {
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
            if (MOCK_MODE) {
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
            if (MOCK_MODE) {
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
            if (MOCK_MODE) {
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
            if (MOCK_MODE) {
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
            if (MOCK_MODE) {
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
            if (MOCK_MODE) {
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
}) {
    return useInfiniteQuery({
        queryKey: ['master-products-infinite', params],
        queryFn: async ({ pageParam = 1 }) => {
            if (MOCK_MODE) {
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
            if (MOCK_MODE) {
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
            if (MOCK_MODE) {
                return mockDataService.updateMargin(productId, margin_percentage);
            }
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
            if (MOCK_MODE) {
                return mockDataService.updateFinalPrice(productId, final_price);
            }
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
            if (MOCK_MODE) {
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
            if (MOCK_MODE) {
                // Mock PDF export - create a simple text file as placeholder
                const content = `Mock PDF Export\n\nTitle: ${customTitle}\nView Mode: ${viewMode}\n\nThis is a mock export in offline mode.`;
                const blob = new Blob([content], { type: 'text/plain' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `${customTitle.replace(/\s+/g, '_')}_${Date.now()}.txt`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
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
            if (MOCK_MODE) {
                // Mock Excel export - create a simple text file as placeholder
                const content = `Mock Excel Export\n\nTitle: ${customTitle}\nView Mode: ${viewMode}\n\nThis is a mock export in offline mode.`;
                const blob = new Blob([content], { type: 'text/plain' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `${customTitle.replace(/\s+/g, '_')}_${Date.now()}.txt`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
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
    brand_filter?: string;
    review_status_filter?: 'pending' | 'confirmed' | 'rejected';
    format: 'excel' | 'pdf';
}

export function useExportAdvanced() {
    return useMutation({
        mutationFn: async (config: AdvancedExportConfig) => {
            if (MOCK_MODE) {
                // Mock export
                const content = `Mock Advanced Export\n\nConfig: ${JSON.stringify(config, null, 2)}`;
                const blob = new Blob([content], { type: 'text/plain' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `${config.filename}_${Date.now()}.txt`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
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
