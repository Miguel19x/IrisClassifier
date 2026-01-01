/**
 * Mock data service for offline/demo mode.
 * 
 * Provides sample data and simulates backend operations using localStorage.
 */

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

interface PriceRange {
    id: number;
    name: string;
    min_price: number | null;
    max_price: number | null;
    color: string;
    display_order: number;
}

interface PriceStats {
    min_price: number;
    max_price: number;
    p25: number;
    p50: number;
    p75: number;
}

// ============================================
// STORAGE KEYS
// ============================================

const STORAGE_KEYS = {
    LISTS: 'mock_lists',
    PRODUCTS: 'mock_products',
    MASTER_PRODUCTS: 'mock_master_products',
    PRICE_RANGES: 'mock_price_ranges',
};

// ============================================
// INITIAL DATA
// ============================================

const INITIAL_LISTS: PriceList[] = [
    {
        id: 1,
        name: 'Catálogo Electrónica 2024',
        status: 'completed',
        product_count: 25,
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 2,
        name: 'Lista Herramientas Industrial',
        status: 'completed',
        product_count: 18,
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 3,
        name: 'Productos Oficina',
        status: 'completed',
        product_count: 12,
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
];

const INITIAL_PRODUCTS: Product[] = [
    // List 1 - Electronics
    { id: 1, code: 'ELEC-001', name: 'Laptop Dell Inspiron 15', brand: 'Dell', price: 899.99, currency: 'USD', price_range_name: 'Alto', classification_method: 'ai', confidence_score: 0.95, list_type: 'catalog', structured_data: null },
    { id: 2, code: 'ELEC-002', name: 'Mouse Logitech MX Master 3', brand: 'Logitech', price: 99.99, currency: 'USD', price_range_name: 'Medio', classification_method: 'ai', confidence_score: 0.92, list_type: 'catalog', structured_data: null },
    { id: 3, code: 'ELEC-003', name: 'Teclado Mecánico Corsair K95', brand: 'Corsair', price: 179.99, currency: 'USD', price_range_name: 'Medio', classification_method: 'ai', confidence_score: 0.88, list_type: 'catalog', structured_data: null },
    { id: 4, code: 'ELEC-004', name: 'Monitor Samsung 27" 4K', brand: 'Samsung', price: 449.99, currency: 'USD', price_range_name: 'Alto', classification_method: 'ai', confidence_score: 0.94, list_type: 'catalog', structured_data: null },
    { id: 5, code: 'ELEC-005', name: 'Webcam Logitech C920', brand: 'Logitech', price: 79.99, currency: 'USD', price_range_name: 'Medio', classification_method: 'ai', confidence_score: 0.90, list_type: 'catalog', structured_data: null },

    // List 2 - Tools
    { id: 26, code: 'TOOL-001', name: 'Taladro Inalámbrico DeWalt 20V', brand: 'DeWalt', price: 159.99, currency: 'USD', price_range_name: 'Medio', classification_method: 'ai', confidence_score: 0.93, list_type: 'catalog', structured_data: null },
    { id: 27, code: 'TOOL-002', name: 'Sierra Circular Makita 7-1/4"', brand: 'Makita', price: 189.99, currency: 'USD', price_range_name: 'Medio', classification_method: 'ai', confidence_score: 0.91, list_type: 'catalog', structured_data: null },
    { id: 28, code: 'TOOL-003', name: 'Juego Llaves Stanley 200 pzs', brand: 'Stanley', price: 249.99, currency: 'USD', price_range_name: 'Alto', classification_method: 'ai', confidence_score: 0.89, list_type: 'catalog', structured_data: null },

    // List 3 - Office
    { id: 44, code: 'OFF-001', name: 'Silla Ergonómica Herman Miller', brand: 'Herman Miller', price: 1299.99, currency: 'USD', price_range_name: 'Alto', classification_method: 'ai', confidence_score: 0.96, list_type: 'catalog', structured_data: null },
    { id: 45, code: 'OFF-002', name: 'Escritorio Ajustable IKEA', brand: 'IKEA', price: 499.99, currency: 'USD', price_range_name: 'Medio', classification_method: 'ai', confidence_score: 0.92, list_type: 'catalog', structured_data: null },
];

const INITIAL_MASTER_PRODUCTS: MasterProduct[] = [
    { id: 1, index_number: 1, clean_code: 'ELEC-001', description: 'Laptop Dell Inspiron 15', brand: 'Dell', price_usd: 899.99, review_status: 'confirmed', confidence_score: 0.95, source_list_id: 1, original_list_name: 'Catálogo Electrónica 2024', margin_percentage: 15, final_price: 1034.99 },
    { id: 2, index_number: 2, clean_code: 'ELEC-002', description: 'Mouse Logitech MX Master 3', brand: 'Logitech', price_usd: 99.99, review_status: 'confirmed', confidence_score: 0.92, source_list_id: 1, original_list_name: 'Catálogo Electrónica 2024', margin_percentage: 20, final_price: 119.99 },
    { id: 3, index_number: 3, clean_code: 'ELEC-003', description: 'Teclado Mecánico Corsair K95', brand: 'Corsair', price_usd: 179.99, review_status: 'pending', confidence_score: 0.88, source_list_id: 1, original_list_name: 'Catálogo Electrónica 2024', margin_percentage: null, final_price: 179.99 },
    { id: 4, index_number: 4, clean_code: 'ELEC-004', description: 'Monitor Samsung 27" 4K', brand: 'Samsung', price_usd: 449.99, review_status: 'confirmed', confidence_score: 0.94, source_list_id: 1, original_list_name: 'Catálogo Electrónica 2024', margin_percentage: 18, final_price: 530.99 },
    { id: 5, index_number: 5, clean_code: 'TOOL-001', description: 'Taladro Inalámbrico DeWalt 20V', brand: 'DeWalt', price_usd: 159.99, review_status: 'confirmed', confidence_score: 0.93, source_list_id: 2, original_list_name: 'Lista Herramientas Industrial', margin_percentage: 25, final_price: 199.99 },
    { id: 6, index_number: 6, clean_code: 'TOOL-002', description: 'Sierra Circular Makita 7-1/4"', brand: 'Makita', price_usd: 189.99, review_status: 'pending', confidence_score: 0.91, source_list_id: 2, original_list_name: 'Lista Herramientas Industrial', margin_percentage: null, final_price: 189.99 },
    { id: 7, index_number: 7, clean_code: 'OFF-001', description: 'Silla Ergonómica Herman Miller', brand: 'Herman Miller', price_usd: 1299.99, review_status: 'confirmed', confidence_score: 0.96, source_list_id: 3, original_list_name: 'Productos Oficina', margin_percentage: 10, final_price: 1429.99 },
];

const INITIAL_PRICE_RANGES: PriceRange[] = [
    { id: 1, name: 'Bajo', min_price: 0, max_price: 100, color: '#22c55e', display_order: 1 },
    { id: 2, name: 'Medio', min_price: 100, max_price: 500, color: '#3b82f6', display_order: 2 },
    { id: 3, name: 'Alto', min_price: 500, max_price: null, color: '#ef4444', display_order: 3 },
];

// ============================================
// STORAGE HELPERS
// ============================================

function getFromStorage<T>(key: string, defaultValue: T): T {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : defaultValue;
    } catch {
        return defaultValue;
    }
}

function saveToStorage<T>(key: string, value: T): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error('Failed to save to localStorage:', error);
    }
}

// ============================================
// MOCK DATA SERVICE
// ============================================

class MockDataService {
    private delay(ms: number = 300): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // LISTS
    async getLists(status?: string): Promise<{ lists: PriceList[]; total: number }> {
        await this.delay();
        let lists = getFromStorage(STORAGE_KEYS.LISTS, INITIAL_LISTS);

        if (status) {
            lists = lists.filter(l => l.status === status);
        }

        return { lists, total: lists.length };
    }

    async getList(id: number): Promise<PriceList | null> {
        await this.delay();
        const lists = getFromStorage(STORAGE_KEYS.LISTS, INITIAL_LISTS);
        return lists.find(l => l.id === id) || null;
    }

    async uploadList(file: File): Promise<PriceList> {
        await this.delay(1000); // Simulate upload time
        const lists = getFromStorage(STORAGE_KEYS.LISTS, INITIAL_LISTS);

        const newList: PriceList = {
            id: Math.max(...lists.map(l => l.id), 0) + 1,
            name: file.name.replace(/\.[^/.]+$/, ''),
            status: 'completed',
            product_count: Math.floor(Math.random() * 50) + 10,
            created_at: new Date().toISOString(),
        };

        lists.push(newList);
        saveToStorage(STORAGE_KEYS.LISTS, lists);

        return newList;
    }

    async deleteList(id: number): Promise<void> {
        await this.delay();
        const lists = getFromStorage(STORAGE_KEYS.LISTS, INITIAL_LISTS);
        const filtered = lists.filter(l => l.id !== id);
        saveToStorage(STORAGE_KEYS.LISTS, filtered);
    }

    // PRODUCTS
    async getProducts(params?: { list_id?: number; page?: number; page_size?: number; search?: string }): Promise<{ products: Product[]; total: number; page: number; page_size: number }> {
        await this.delay();
        let products = getFromStorage(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);

        if (params?.search) {
            const search = params.search.toLowerCase();
            products = products.filter(p =>
                p.name.toLowerCase().includes(search) ||
                p.code?.toLowerCase().includes(search) ||
                p.brand?.toLowerCase().includes(search)
            );
        }

        const page = params?.page || 1;
        const page_size = params?.page_size || 20000;
        const start = (page - 1) * page_size;
        const end = start + page_size;

        return {
            products: products.slice(start, end),
            total: products.length,
            page,
            page_size,
        };
    }

    async updateProduct(_listId: number, productId: number, data: Partial<Product>): Promise<Product> {
        await this.delay();
        const products = getFromStorage(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
        const index = products.findIndex(p => p.id === productId);

        if (index !== -1) {
            products[index] = { ...products[index], ...data };
            saveToStorage(STORAGE_KEYS.PRODUCTS, products);
            return products[index];
        }

        throw new Error('Product not found');
    }

    // MASTER PRODUCTS
    async getMasterProducts(params?: {
        viewMode?: 'enterprise' | 'client';
        sortBy?: string;
        search?: string;
        brandFilter?: string;
        reviewStatusFilter?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        products: MasterProduct[];
        total: number;
        page: number;
        limit: number;
        has_next: boolean;
        has_prev: boolean;
    }> {
        await this.delay();
        let products = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);

        // Apply filters
        if (params?.search) {
            const search = params.search.toLowerCase();
            products = products.filter(p =>
                p.description.toLowerCase().includes(search) ||
                p.clean_code.toLowerCase().includes(search) ||
                p.brand?.toLowerCase().includes(search)
            );
        }

        if (params?.brandFilter) {
            products = products.filter(p => p.brand === params.brandFilter);
        }

        if (params?.reviewStatusFilter) {
            products = products.filter(p => p.review_status === params.reviewStatusFilter);
        }

        // Apply sorting
        if (params?.sortBy === 'alphabetical') {
            products.sort((a, b) => a.description.localeCompare(b.description));
        } else if (params?.sortBy === 'brand') {
            products.sort((a, b) => (a.brand || '').localeCompare(b.brand || ''));
        } else if (params?.sortBy === 'price') {
            products.sort((a, b) => a.price_usd - b.price_usd);
        } else {
            products.sort((a, b) => a.index_number - b.index_number);
        }

        const page = params?.page || 1;
        const limit = params?.limit || 200;
        const start = (page - 1) * limit;
        const end = start + limit;

        return {
            products: products.slice(start, end),
            total: products.length,
            page,
            limit,
            has_next: end < products.length,
            has_prev: page > 1,
        };
    }

    async getPriceStats(): Promise<PriceStats> {
        await this.delay();
        const products = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);
        const prices = products.map(p => p.price_usd).sort((a, b) => a - b);

        return {
            min_price: Math.min(...prices),
            max_price: Math.max(...prices),
            p25: prices[Math.floor(prices.length * 0.25)],
            p50: prices[Math.floor(prices.length * 0.50)],
            p75: prices[Math.floor(prices.length * 0.75)],
        };
    }

    async updateMargin(productId: number, margin_percentage: number): Promise<MasterProduct> {
        await this.delay();
        const products = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);
        const index = products.findIndex(p => p.id === productId);

        if (index !== -1) {
            products[index].margin_percentage = margin_percentage;
            products[index].final_price = products[index].price_usd * (1 + margin_percentage / 100);
            saveToStorage(STORAGE_KEYS.MASTER_PRODUCTS, products);
            return products[index];
        }

        throw new Error('Product not found');
    }

    async updateFinalPrice(productId: number, final_price: number): Promise<MasterProduct> {
        await this.delay();
        const products = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);
        const index = products.findIndex(p => p.id === productId);

        if (index !== -1) {
            products[index].final_price = final_price;
            saveToStorage(STORAGE_KEYS.MASTER_PRODUCTS, products);
            return products[index];
        }

        throw new Error('Product not found');
    }

    async updateReviewStatus(productId: number, review_status: 'pending' | 'confirmed' | 'rejected'): Promise<MasterProduct> {
        await this.delay();
        const products = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);
        const index = products.findIndex(p => p.id === productId);

        if (index !== -1) {
            products[index].review_status = review_status;
            saveToStorage(STORAGE_KEYS.MASTER_PRODUCTS, products);
            return products[index];
        }

        throw new Error('Product not found');
    }

    // PRICE RANGES
    async getPriceRanges(): Promise<PriceRange[]> {
        await this.delay();
        return getFromStorage(STORAGE_KEYS.PRICE_RANGES, INITIAL_PRICE_RANGES);
    }

    async createPriceRange(data: Omit<PriceRange, 'id'>): Promise<PriceRange> {
        await this.delay();
        const ranges = getFromStorage(STORAGE_KEYS.PRICE_RANGES, INITIAL_PRICE_RANGES);

        const newRange: PriceRange = {
            id: Math.max(...ranges.map(r => r.id), 0) + 1,
            ...data,
        };

        ranges.push(newRange);
        saveToStorage(STORAGE_KEYS.PRICE_RANGES, ranges);

        return newRange;
    }

    async updatePriceRange(id: number, data: Partial<PriceRange>): Promise<PriceRange> {
        await this.delay();
        const ranges = getFromStorage(STORAGE_KEYS.PRICE_RANGES, INITIAL_PRICE_RANGES);
        const index = ranges.findIndex(r => r.id === id);

        if (index !== -1) {
            ranges[index] = { ...ranges[index], ...data };
            saveToStorage(STORAGE_KEYS.PRICE_RANGES, ranges);
            return ranges[index];
        }

        throw new Error('Price range not found');
    }

    async deletePriceRange(id: number): Promise<void> {
        await this.delay();
        const ranges = getFromStorage(STORAGE_KEYS.PRICE_RANGES, INITIAL_PRICE_RANGES);
        const filtered = ranges.filter(r => r.id !== id);
        saveToStorage(STORAGE_KEYS.PRICE_RANGES, filtered);
    }

    // COMPARISON
    async compareLists(_data: { list_ids: number[]; use_ai?: boolean }): Promise<any> {
        await this.delay(500);
        return {
            matched_products: 15,
            potential_savings: 234.50,
            comparison_table: [],
        };
    }

    // MIXED LISTINGS
    async getMixedListings(): Promise<any[]> {
        await this.delay();
        return [];
    }

    async createMixedListing(_data: Record<string, unknown>): Promise<Record<string, unknown>> {
        await this.delay();
        return { id: 1, ..._data };
    }

    async deleteMixedListing(_id: number): Promise<void> {
        await this.delay();
    }

    async getMixedListingProducts(_listingId: number, _filters?: Record<string, unknown>): Promise<{ products: unknown[]; total: number }> {
        await this.delay();
        return { products: [], total: 0 };
    }
}

export const mockDataService = new MockDataService();
