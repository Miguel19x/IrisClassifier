/**
 * Mock data service for offline / demo mode.
 * 
 * Provides comprehensive sample data for MegaAutoPartes / IrisClassifier
 * and simulates backend operations using localStorage and client-side processing.
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// ============================================
// TYPES
// ============================================

export interface PriceList {
    id: number;
    name: string;
    status: string;
    product_count: number;
    created_at: string;
}

export interface Product {
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
    list_id?: number;
}

export interface MasterProduct {
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

export interface PriceRange {
    id: number;
    name: string;
    min_price: number | null;
    max_price: number | null;
    color: string;
    display_order: number;
}

export interface PriceStats {
    min_price: number;
    max_price: number;
    p25: number;
    p50: number;
    p75: number;
}

export interface MixedListing {
    id: number;
    name: string;
    created_at: string;
    product_count: number;
    list_ids: number[];
}

// ============================================
// STORAGE KEYS
// ============================================

const STORAGE_KEYS = {
    LISTS: 'mock_lists_v2',
    PRODUCTS: 'mock_products_v2',
    MASTER_PRODUCTS: 'mock_master_products_v2',
    PRICE_RANGES: 'mock_price_ranges_v2',
    MIXED_LISTINGS: 'mock_mixed_listings_v2',
};

// ============================================
// INITIAL REALISTIC DATA (MegaAutoPartes)
// ============================================

const INITIAL_LISTS: PriceList[] = [
    {
        id: 1,
        name: 'Catálogo Frenos y Suspensión 2024',
        status: 'completed',
        product_count: 12,
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 2,
        name: 'Lista Repuestos Denso & Bujías NGK',
        status: 'completed',
        product_count: 10,
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 3,
        name: 'Catálogo Motor & Transmisión Gates/LuK',
        status: 'completed',
        product_count: 9,
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 4,
        name: 'Filtros Automotrices Mann & Wix',
        status: 'completed',
        product_count: 8,
        created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    },
];

const INITIAL_MASTER_PRODUCTS: MasterProduct[] = [
    // List 1 - Frenos y Suspensión
    { id: 1, index_number: 1, clean_code: 'BOS-BP1054', description: 'Pastillas de Freno Delanteras Cerámicas', brand: 'Bosch', price_usd: 34.50, review_status: 'confirmed', confidence_score: 0.98, source_list_id: 1, original_list_name: 'Catálogo Frenos y Suspensión 2024', margin_percentage: 25, final_price: 43.13 },
    { id: 2, index_number: 2, clean_code: 'BREM-P06024', description: 'Pastillas de Freno Traseras Low-Metallic', brand: 'Brembo', price_usd: 48.00, review_status: 'confirmed', confidence_score: 0.96, source_list_id: 1, original_list_name: 'Catálogo Frenos y Suspensión 2024', margin_percentage: 20, final_price: 57.60 },
    { id: 3, index_number: 3, clean_code: 'BREM-09A721', description: 'Disco de Freno Delantero Ventilado 280mm', brand: 'Brembo', price_usd: 76.50, review_status: 'confirmed', confidence_score: 0.95, source_list_id: 1, original_list_name: 'Catálogo Frenos y Suspensión 2024', margin_percentage: 18, final_price: 90.27 },
    { id: 4, index_number: 4, clean_code: 'MON-72489', description: 'Amortiguador Delantero de Gas OESpectrum', brand: 'Monroe', price_usd: 64.00, review_status: 'confirmed', confidence_score: 0.97, source_list_id: 1, original_list_name: 'Catálogo Frenos y Suspensión 2024', margin_percentage: 22, final_price: 78.08 },
    { id: 5, index_number: 5, clean_code: 'KYB-341330', description: 'Amortiguador Trasero Excel-G Doble Tubo', brand: 'KYB', price_usd: 52.00, review_status: 'pending', confidence_score: 0.92, source_list_id: 1, original_list_name: 'Catálogo Frenos y Suspensión 2024', margin_percentage: 20, final_price: 62.40 },
    { id: 6, index_number: 6, clean_code: 'MOOG-ES3423', description: 'Terminal de Dirección Exterior Izquierdo', brand: 'Moog', price_usd: 22.50, review_status: 'confirmed', confidence_score: 0.94, source_list_id: 1, original_list_name: 'Catálogo Frenos y Suspensión 2024', margin_percentage: 30, final_price: 29.25 },
    { id: 7, index_number: 7, clean_code: '555-SB3882', description: 'Rótula Inferior de Suspensión Delantera', brand: '555 SanKei', price_usd: 19.80, review_status: 'confirmed', confidence_score: 0.91, source_list_id: 1, original_list_name: 'Catálogo Frenos y Suspensión 2024', margin_percentage: 28, final_price: 25.34 },
    { id: 8, index_number: 8, clean_code: 'TRW-JTS541', description: 'Bieleta Estabilizadora Delantera Reforzada', brand: 'TRW', price_usd: 16.50, review_status: 'pending', confidence_score: 0.89, source_list_id: 1, original_list_name: 'Catálogo Frenos y Suspensión 2024', margin_percentage: 25, final_price: 20.63 },
    { id: 9, index_number: 9, clean_code: 'BOS-BD992', description: 'Tambor de Freno Trasero Hierro Nodular', brand: 'Bosch', price_usd: 44.00, review_status: 'confirmed', confidence_score: 0.93, source_list_id: 1, original_list_name: 'Catálogo Frenos y Suspensión 2024', margin_percentage: 20, final_price: 52.80 },
    { id: 10, index_number: 10, clean_code: 'GAB-G51782', description: 'Puntal de Suspensión Ultra Gas Strut', brand: 'Gabriel', price_usd: 58.00, review_status: 'pending', confidence_score: 0.87, source_list_id: 1, original_list_name: 'Catálogo Frenos y Suspensión 2024', margin_percentage: 20, final_price: 69.60 },
    { id: 11, index_number: 11, clean_code: 'WAG-ZX1033', description: 'Zapatas de Freno de Mano Traseras', brand: 'Wagner', price_usd: 28.50, review_status: 'confirmed', confidence_score: 0.90, source_list_id: 1, original_list_name: 'Catálogo Frenos y Suspensión 2024', margin_percentage: 25, final_price: 35.63 },
    { id: 12, index_number: 12, clean_code: 'BOS-DOT4-1L', description: 'Líquido de Frenos DOT 4 Premium 1 Litro', brand: 'Bosch', price_usd: 11.50, review_status: 'confirmed', confidence_score: 0.99, source_list_id: 1, original_list_name: 'Catálogo Frenos y Suspensión 2024', margin_percentage: 35, final_price: 15.53 },

    // List 2 - Denso & NGK
    { id: 13, index_number: 13, clean_code: 'NGK-6441', description: 'Bujía Láser Iridio ILZKR7B-11 (Unidad)', brand: 'NGK', price_usd: 12.50, review_status: 'confirmed', confidence_score: 0.98, source_list_id: 2, original_list_name: 'Lista Repuestos Denso & Bujías NGK', margin_percentage: 30, final_price: 16.25 },
    { id: 14, index_number: 14, clean_code: 'NGK-SET-BKR6', description: 'Juego 4 Bujías Cobre Estándar BKR6E-11', brand: 'NGK', price_usd: 17.50, review_status: 'confirmed', confidence_score: 0.96, source_list_id: 2, original_list_name: 'Lista Repuestos Denso & Bujías NGK', margin_percentage: 28, final_price: 22.40 },
    { id: 15, index_number: 15, clean_code: 'DEN-6731301', description: 'Bobina de Encendido Directo Igniter Coil', brand: 'Denso', price_usd: 46.00, review_status: 'confirmed', confidence_score: 0.95, source_list_id: 2, original_list_name: 'Lista Repuestos Denso & Bujías NGK', margin_percentage: 22, final_price: 56.12 },
    { id: 16, index_number: 16, clean_code: 'DEN-1976030', description: 'Sensor de Flujo de Masa de Aire (MAF)', brand: 'Denso', price_usd: 88.00, review_status: 'confirmed', confidence_score: 0.94, source_list_id: 2, original_list_name: 'Lista Repuestos Denso & Bujías NGK', margin_percentage: 20, final_price: 105.60 },
    { id: 17, index_number: 17, clean_code: 'DEN-2344066', description: 'Sensor de Oxígeno Primario 4 Cables', brand: 'Denso', price_usd: 54.00, review_status: 'confirmed', confidence_score: 0.93, source_list_id: 2, original_list_name: 'Lista Repuestos Denso & Bujías NGK', margin_percentage: 25, final_price: 67.50 },
    { id: 18, index_number: 18, clean_code: 'DEN-2213134', description: 'Radiador de Enfriamiento de Motor Aluminio', brand: 'Denso', price_usd: 95.00, review_status: 'pending', confidence_score: 0.91, source_list_id: 2, original_list_name: 'Lista Repuestos Denso & Bujías NGK', margin_percentage: 18, final_price: 112.10 },
    { id: 19, index_number: 19, clean_code: 'DEN-2800320', description: 'Motor de Arranque Remanufacturado 12V 1.4kW', brand: 'Denso', price_usd: 138.00, review_status: 'confirmed', confidence_score: 0.92, source_list_id: 2, original_list_name: 'Lista Repuestos Denso & Bujías NGK', margin_percentage: 15, final_price: 158.70 },
    { id: 20, index_number: 20, clean_code: 'DEN-4711234', description: 'Compresor de Aire Acondicionado 10S17C', brand: 'Denso', price_usd: 265.00, review_status: 'pending', confidence_score: 0.88, source_list_id: 2, original_list_name: 'Lista Repuestos Denso & Bujías NGK', margin_percentage: 15, final_price: 304.75 },
    { id: 21, index_number: 21, clean_code: 'NGK-RC-HE73', description: 'Juego Cables de Bujías Siliconados Ultra', brand: 'NGK', price_usd: 31.00, review_status: 'confirmed', confidence_score: 0.95, source_list_id: 2, original_list_name: 'Lista Repuestos Denso & Bujías NGK', margin_percentage: 25, final_price: 38.75 },
    { id: 22, index_number: 22, clean_code: 'DEN-9500104', description: 'Bomba de Combustible Eléctrica 3.5 Bar', brand: 'Denso', price_usd: 62.00, review_status: 'confirmed', confidence_score: 0.90, source_list_id: 2, original_list_name: 'Lista Repuestos Denso & Bujías NGK', margin_percentage: 22, final_price: 75.64 },

    // List 3 - Motor & Transmisión
    { id: 23, index_number: 23, clean_code: 'GAT-T284', description: 'Correa de Distribución Sincrónica 123 Dientes', brand: 'Gates', price_usd: 24.50, review_status: 'confirmed', confidence_score: 0.97, source_list_id: 3, original_list_name: 'Catálogo Motor & Transmisión Gates/LuK', margin_percentage: 30, final_price: 31.85 },
    { id: 24, index_number: 24, clean_code: 'GAT-TCKWP329', description: 'Kit de Tiempo Completo + Bomba de Agua', brand: 'Gates', price_usd: 128.00, review_status: 'confirmed', confidence_score: 0.96, source_list_id: 3, original_list_name: 'Catálogo Motor & Transmisión Gates/LuK', margin_percentage: 20, final_price: 153.60 },
    { id: 25, index_number: 25, clean_code: 'LUK-6243247', description: 'Kit de Embrague Completo RepSet 220mm', brand: 'LuK', price_usd: 165.00, review_status: 'confirmed', confidence_score: 0.95, source_list_id: 3, original_list_name: 'Catálogo Motor & Transmisión Gates/LuK', margin_percentage: 18, final_price: 194.70 },
    { id: 26, index_number: 26, clean_code: 'VAL-439600', description: 'Alternador 120 Amperios con Polea Libre', brand: 'Valeo', price_usd: 175.00, review_status: 'confirmed', confidence_score: 0.93, source_list_id: 3, original_list_name: 'Catálogo Motor & Transmisión Gates/LuK', margin_percentage: 16, final_price: 203.00 },
    { id: 27, index_number: 27, clean_code: 'GMB-1201340', description: 'Bomba de Agua con Empaque Metálico', brand: 'GMB', price_usd: 36.50, review_status: 'confirmed', confidence_score: 0.91, source_list_id: 3, original_list_name: 'Catálogo Motor & Transmisión Gates/LuK', margin_percentage: 26, final_price: 45.99 },
    { id: 28, index_number: 28, clean_code: 'MAH-TM3688', description: 'Termostato con Brida Termoplástica 88°C', brand: 'Mahle', price_usd: 26.00, review_status: 'pending', confidence_score: 0.89, source_list_id: 3, original_list_name: 'Catálogo Motor & Transmisión Gates/LuK', margin_percentage: 25, final_price: 32.50 },
    { id: 29, index_number: 29, clean_code: 'INA-5340014', description: 'Tensor Automático Correa de Accesorios Poly-V', brand: 'INA', price_usd: 41.00, review_status: 'confirmed', confidence_score: 0.94, source_list_id: 3, original_list_name: 'Catálogo Motor & Transmisión Gates/LuK', margin_percentage: 24, final_price: 50.84 },
    { id: 30, index_number: 30, clean_code: 'FEL-26233PT', description: 'Empaque de Culata Multilámina MLS PermaTorque', brand: 'Fel-Pro', price_usd: 32.00, review_status: 'confirmed', confidence_score: 0.92, source_list_id: 3, original_list_name: 'Catálogo Motor & Transmisión Gates/LuK', margin_percentage: 28, final_price: 40.96 },
    { id: 31, index_number: 31, clean_code: 'CONT-6PK1880', description: 'Correa Serpentina Accesorios Multi-V 6PK1880', brand: 'Continental', price_usd: 18.50, review_status: 'rejected', confidence_score: 0.78, source_list_id: 3, original_list_name: 'Catálogo Motor & Transmisión Gates/LuK', margin_percentage: null, final_price: 18.50 },

    // List 4 - Filtros
    { id: 32, index_number: 32, clean_code: 'MANN-W712', description: 'Filtro de Aceite Blindado con Válvula Check', brand: 'Mann-Filter', price_usd: 8.90, review_status: 'confirmed', confidence_score: 0.99, source_list_id: 4, original_list_name: 'Filtros Automotrices Mann & Wix', margin_percentage: 35, final_price: 12.02 },
    { id: 33, index_number: 33, clean_code: 'MANN-C25114', description: 'Filtro de Aire Motor Panel Plisado', brand: 'Mann-Filter', price_usd: 14.20, review_status: 'confirmed', confidence_score: 0.97, source_list_id: 4, original_list_name: 'Filtros Automotrices Mann & Wix', margin_percentage: 30, final_price: 18.46 },
    { id: 34, index_number: 34, clean_code: 'WIX-WF10048', description: 'Filtro de Combustible en Línea Gasolina', brand: 'Wix', price_usd: 21.50, review_status: 'confirmed', confidence_score: 0.95, source_list_id: 4, original_list_name: 'Filtros Automotrices Mann & Wix', margin_percentage: 25, final_price: 26.88 },
    { id: 35, index_number: 35, clean_code: 'BOS-C3818WS', description: 'Filtro de Cabina Polen con Carbón Activo', brand: 'Bosch', price_usd: 17.80, review_status: 'confirmed', confidence_score: 0.94, source_list_id: 4, original_list_name: 'Filtros Automotrices Mann & Wix', margin_percentage: 30, final_price: 23.14 },
    { id: 36, index_number: 36, clean_code: 'FRAM-XG7317', description: 'Filtro de Aceite Ultra Synthetic 20K Millas', brand: 'Fram', price_usd: 12.00, review_status: 'pending', confidence_score: 0.91, source_list_id: 4, original_list_name: 'Filtros Automotrices Mann & Wix', margin_percentage: 28, final_price: 15.36 },
    { id: 37, index_number: 37, clean_code: 'MOT-FA1884', description: 'Filtro de Aire Original Motorcraft OE', brand: 'Motorcraft', price_usd: 19.50, review_status: 'confirmed', confidence_score: 0.96, source_list_id: 4, original_list_name: 'Filtros Automotrices Mann & Wix', margin_percentage: 22, final_price: 23.79 },
    { id: 38, index_number: 38, clean_code: 'K&N-HP1008', description: 'Filtro de Aceite Alto Flujo Performance', brand: 'K&N', price_usd: 18.00, review_status: 'confirmed', confidence_score: 0.93, source_list_id: 4, original_list_name: 'Filtros Automotrices Mann & Wix', margin_percentage: 25, final_price: 22.50 },
    { id: 39, index_number: 39, clean_code: 'MANN-HU719', description: 'Filtro de Aceite Cartucho Ecológico sin Metal', brand: 'Mann-Filter', price_usd: 9.80, review_status: 'confirmed', confidence_score: 0.98, source_list_id: 4, original_list_name: 'Filtros Automotrices Mann & Wix', margin_percentage: 35, final_price: 13.23 },
];

const INITIAL_PRODUCTS: Product[] = INITIAL_MASTER_PRODUCTS.map(mp => ({
    id: mp.id,
    code: mp.clean_code,
    name: mp.description,
    brand: mp.brand,
    price: mp.price_usd,
    currency: 'USD',
    price_range_name: mp.price_usd < 25 ? 'Bajo' : mp.price_usd < 80 ? 'Medio' : 'Alto',
    classification_method: 'ai',
    confidence_score: mp.confidence_score,
    list_type: 'catalog',
    structured_data: { 'OEM': mp.clean_code, 'Marca': mp.brand || 'N/A' },
    list_id: mp.source_list_id,
}));

const INITIAL_PRICE_RANGES: PriceRange[] = [
    { id: 1, name: 'Económico / Rápida Rotación', min_price: 0, max_price: 25, color: '#10b981', display_order: 1 },
    { id: 2, name: 'Gama Media / Mantenimiento', min_price: 25, max_price: 80, color: '#3b82f6', display_order: 2 },
    { id: 3, name: 'Premium / Componentes Mayores', min_price: 80, max_price: null, color: '#8b5cf6', display_order: 3 },
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
// MOCK DATA SERVICE CLASS
// ============================================

export class MockDataService {
    private delay(ms: number = 200): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    resetToDefaults(): void {
        localStorage.removeItem(STORAGE_KEYS.LISTS);
        localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
        localStorage.removeItem(STORAGE_KEYS.MASTER_PRODUCTS);
        localStorage.removeItem(STORAGE_KEYS.PRICE_RANGES);
        localStorage.removeItem(STORAGE_KEYS.MIXED_LISTINGS);
    }

    // ============================================
    // LISTS
    // ============================================

    async getLists(status?: string): Promise<{ lists: PriceList[]; total: number }> {
        await this.delay(150);
        let lists = getFromStorage(STORAGE_KEYS.LISTS, INITIAL_LISTS);

        if (status) {
            lists = lists.filter(l => l.status === status);
        }

        return { lists, total: lists.length };
    }

    async getList(id: number): Promise<PriceList | null> {
        await this.delay(100);
        const lists = getFromStorage(STORAGE_KEYS.LISTS, INITIAL_LISTS);
        return lists.find(l => l.id === id) || null;
    }

    async uploadList(file: File): Promise<PriceList> {
        await this.delay(900); // Simulate AI ETL extraction
        const lists = getFromStorage(STORAGE_KEYS.LISTS, INITIAL_LISTS);
        const products = getFromStorage(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
        const masterProducts = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);

        const newListId = Math.max(...lists.map(l => l.id), 0) + 1;
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        const productCount = 6;

        const newList: PriceList = {
            id: newListId,
            name: cleanName || `Lista Proveedor #${newListId}`,
            status: 'completed',
            product_count: productCount,
            created_at: new Date().toISOString(),
        };

        // Simulate AI-extracted products for this uploaded catalog
        const sampleParts = [
            { code: `REP-${newListId}01`, name: 'Pastillas de Freno Semimetálicas', brand: 'Wagner', price: 29.50 },
            { code: `REP-${newListId}02`, name: 'Amortiguador Trasero Reforzado', brand: 'Monroe', price: 55.00 },
            { code: `REP-${newListId}03`, name: 'Filtro de Aire Cabina Antibacterial', brand: 'Bosch', price: 16.80 },
            { code: `REP-${newListId}04`, name: 'Bomba de Gasolina Sumergible 4 Bar', brand: 'Walbro', price: 74.00 },
            { code: `REP-${newListId}05`, name: 'Kit Sellos de Válvulas Motor 16V', brand: 'Corteco', price: 23.50 },
            { code: `REP-${newListId}06`, name: 'Bujía de Platino Doble Electrodo', brand: 'Denso', price: 9.20 },
        ];

        let maxMasterId = Math.max(...masterProducts.map(p => p.id), 0);
        let maxProdId = Math.max(...products.map(p => p.id), 0);
        let maxIndex = Math.max(...masterProducts.map(p => p.index_number), 0);

        sampleParts.forEach((part) => {
            maxMasterId++;
            maxProdId++;
            maxIndex++;

            const newMaster: MasterProduct = {
                id: maxMasterId,
                index_number: maxIndex,
                clean_code: part.code,
                description: part.name,
                brand: part.brand,
                price_usd: part.price,
                review_status: 'pending',
                confidence_score: 0.94,
                source_list_id: newListId,
                original_list_name: newList.name,
                margin_percentage: 20,
                final_price: Number((part.price * 1.20).toFixed(2)),
            };

            const newProd: Product = {
                id: maxProdId,
                code: part.code,
                name: part.name,
                brand: part.brand,
                price: part.price,
                currency: 'USD',
                price_range_name: part.price < 25 ? 'Económico' : part.price < 80 ? 'Gama Media' : 'Premium',
                classification_method: 'ai',
                confidence_score: 0.94,
                list_type: 'catalog',
                structured_data: { 'OEM': part.code, 'Marca': part.brand },
                list_id: newListId,
            };

            masterProducts.push(newMaster);
            products.push(newProd);
        });

        lists.push(newList);

        saveToStorage(STORAGE_KEYS.LISTS, lists);
        saveToStorage(STORAGE_KEYS.PRODUCTS, products);
        saveToStorage(STORAGE_KEYS.MASTER_PRODUCTS, masterProducts);

        return newList;
    }

    async deleteList(id: number): Promise<void> {
        await this.delay(200);
        const lists = getFromStorage(STORAGE_KEYS.LISTS, INITIAL_LISTS);
        const filteredLists = lists.filter(l => l.id !== id);
        saveToStorage(STORAGE_KEYS.LISTS, filteredLists);

        const products = getFromStorage(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
        const filteredProds = products.filter(p => p.list_id !== id);
        saveToStorage(STORAGE_KEYS.PRODUCTS, filteredProds);

        const masterProducts = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);
        const filteredMaster = masterProducts.filter(p => p.source_list_id !== id);
        saveToStorage(STORAGE_KEYS.MASTER_PRODUCTS, filteredMaster);
    }

    // ============================================
    // PRODUCTS
    // ============================================

    async getProducts(params?: { list_id?: number; page?: number; page_size?: number; search?: string }): Promise<{ products: Product[]; total: number; page: number; page_size: number }> {
        await this.delay(150);
        let products = getFromStorage(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);

        if (params?.list_id) {
            products = products.filter(p => p.list_id === params.list_id);
        }

        if (params?.search) {
            const search = params.search.toLowerCase();
            products = products.filter(p =>
                p.name.toLowerCase().includes(search) ||
                p.code?.toLowerCase().includes(search) ||
                p.brand?.toLowerCase().includes(search)
            );
        }

        const page = params?.page || 1;
        const page_size = params?.page_size || 200;
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
        await this.delay(150);
        const products = getFromStorage(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
        const index = products.findIndex(p => p.id === productId);

        if (index !== -1) {
            products[index] = { ...products[index], ...data };
            saveToStorage(STORAGE_KEYS.PRODUCTS, products);

            // Sync with master table
            const masterProducts = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);
            const mIndex = masterProducts.findIndex(p => p.id === productId);
            if (mIndex !== -1) {
                if (data.name) masterProducts[mIndex].description = data.name;
                if (data.code) masterProducts[mIndex].clean_code = data.code;
                if (data.brand) masterProducts[mIndex].brand = data.brand;
                if (data.price !== undefined && data.price !== null) {
                    masterProducts[mIndex].price_usd = data.price;
                    const margin = masterProducts[mIndex].margin_percentage || 0;
                    masterProducts[mIndex].final_price = Number((data.price * (1 + margin / 100)).toFixed(2));
                }
                saveToStorage(STORAGE_KEYS.MASTER_PRODUCTS, masterProducts);
            }

            return products[index];
        }

        throw new Error('Product not found');
    }

    // ============================================
    // MASTER PRODUCTS
    // ============================================

    async getMasterProducts(params?: {
        viewMode?: 'enterprise' | 'client';
        sortBy?: string;
        search?: string;
        brandFilter?: string;
        reviewStatusFilter?: string;
        listId?: number;
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
        await this.delay(150);
        let products = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);

        // Apply filters
        if (params?.listId !== undefined) {
            products = products.filter(p => p.source_list_id === params.listId);
        }

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
        await this.delay(100);
        const products = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);
        const prices = products.map(p => p.price_usd).filter(p => p > 0).sort((a, b) => a - b);

        if (prices.length === 0) {
            return { min_price: 0, max_price: 100, p25: 25, p50: 50, p75: 75 };
        }

        return {
            min_price: prices[0],
            max_price: prices[prices.length - 1],
            p25: prices[Math.floor(prices.length * 0.25)],
            p50: prices[Math.floor(prices.length * 0.50)],
            p75: prices[Math.floor(prices.length * 0.75)],
        };
    }

    async updateMargin(productId: number, margin_percentage: number): Promise<MasterProduct> {
        await this.delay(100);
        const products = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);
        const index = products.findIndex(p => p.id === productId);

        if (index !== -1) {
            products[index].margin_percentage = margin_percentage;
            products[index].final_price = Number((products[index].price_usd * (1 + margin_percentage / 100)).toFixed(2));
            saveToStorage(STORAGE_KEYS.MASTER_PRODUCTS, products);
            return products[index];
        }

        throw new Error('Product not found');
    }

    async updateFinalPrice(productId: number, final_price: number): Promise<MasterProduct> {
        await this.delay(100);
        const products = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);
        const index = products.findIndex(p => p.id === productId);

        if (index !== -1) {
            products[index].final_price = Number(final_price.toFixed(2));
            const cost = products[index].price_usd;
            products[index].margin_percentage = cost > 0 ? Number((((final_price - cost) / cost) * 100).toFixed(1)) : 0;
            saveToStorage(STORAGE_KEYS.MASTER_PRODUCTS, products);
            return products[index];
        }

        throw new Error('Product not found');
    }

    async updateReviewStatus(productId: number, review_status: 'pending' | 'confirmed' | 'rejected'): Promise<MasterProduct> {
        await this.delay(100);
        const products = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);
        const index = products.findIndex(p => p.id === productId);

        if (index !== -1) {
            products[index].review_status = review_status;
            saveToStorage(STORAGE_KEYS.MASTER_PRODUCTS, products);
            return products[index];
        }

        throw new Error('Product not found');
    }

    async updateMasterProduct(productId: number, data: Partial<MasterProduct>): Promise<MasterProduct> {
        await this.delay(100);
        const products = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);
        const index = products.findIndex(p => p.id === productId);

        if (index !== -1) {
            products[index] = { ...products[index], ...data };
            if (data.price_usd !== undefined && products[index].margin_percentage !== null) {
                const margin = products[index].margin_percentage || 0;
                products[index].final_price = Number((products[index].price_usd * (1 + margin / 100)).toFixed(2));
            }
            saveToStorage(STORAGE_KEYS.MASTER_PRODUCTS, products);
            return products[index];
        }

        throw new Error('Product not found');
    }

    async bulkUpdateMargin(margin_percentage: number, productIds?: number[], search?: string): Promise<{ status: string; updated_count: number }> {
        await this.delay(200);
        const products = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);
        let updatedCount = 0;

        products.forEach(p => {
            const matchesId = !productIds || productIds.includes(p.id);
            const matchesSearch = !search || p.description.toLowerCase().includes(search.toLowerCase()) || p.clean_code.toLowerCase().includes(search.toLowerCase());
            if (matchesId && matchesSearch) {
                p.margin_percentage = margin_percentage;
                p.final_price = Number((p.price_usd * (1 + margin_percentage / 100)).toFixed(2));
                updatedCount++;
            }
        });

        saveToStorage(STORAGE_KEYS.MASTER_PRODUCTS, products);
        return { status: 'success', updated_count: updatedCount };
    }

    async bulkRename(target_text: string, replacement_text: string, productIds?: number[], search?: string, field: 'description' | 'brand' = 'description'): Promise<{ status: string; updated_count: number }> {
        await this.delay(200);
        const products = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);
        let updatedCount = 0;

        products.forEach(p => {
            const matchesId = !productIds || productIds.includes(p.id);
            const matchesSearch = !search || p.description.toLowerCase().includes(search.toLowerCase());
            if (matchesId && matchesSearch) {
                if (field === 'description' && p.description.includes(target_text)) {
                    p.description = p.description.replaceAll(target_text, replacement_text);
                    updatedCount++;
                } else if (field === 'brand' && p.brand?.includes(target_text)) {
                    p.brand = p.brand.replaceAll(target_text, replacement_text);
                    updatedCount++;
                }
            }
        });

        saveToStorage(STORAGE_KEYS.MASTER_PRODUCTS, products);
        return { status: 'success', updated_count: updatedCount };
    }

    async bulkDelete(productIds: number[]): Promise<{ status: string; deleted_count: number }> {
        await this.delay(200);
        const products = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);
        const remaining = products.filter(p => !productIds.includes(p.id));
        saveToStorage(STORAGE_KEYS.MASTER_PRODUCTS, remaining);
        return { status: 'success', deleted_count: productIds.length };
    }

    async restoreProducts(restored: MasterProduct[]): Promise<{ status: string; restored_count: number }> {
        await this.delay(200);
        const products = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);
        const restoredMap = new Map(restored.map(p => [p.id, p]));

        // Update existing or append restored
        const updated = products.map(p => restoredMap.get(p.id) || p);
        restored.forEach(r => {
            if (!updated.some(p => p.id === r.id)) {
                updated.push(r);
            }
        });

        saveToStorage(STORAGE_KEYS.MASTER_PRODUCTS, updated);
        return { status: 'success', restored_count: restored.length };
    }

    // ============================================
    // PRICE RANGES
    // ============================================

    async getPriceRanges(): Promise<PriceRange[]> {
        await this.delay(100);
        return getFromStorage(STORAGE_KEYS.PRICE_RANGES, INITIAL_PRICE_RANGES);
    }

    async createPriceRange(data: Omit<PriceRange, 'id'>): Promise<PriceRange> {
        await this.delay(150);
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
        await this.delay(150);
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
        await this.delay(150);
        const ranges = getFromStorage(STORAGE_KEYS.PRICE_RANGES, INITIAL_PRICE_RANGES);
        const filtered = ranges.filter(r => r.id !== id);
        saveToStorage(STORAGE_KEYS.PRICE_RANGES, filtered);
    }

    // ============================================
    // COMPARISON
    // ============================================

    async compareLists(data: { list_ids: number[]; use_ai?: boolean }): Promise<any> {
        await this.delay(400);
        const lists = getFromStorage(STORAGE_KEYS.LISTS, INITIAL_LISTS);
        const selectedLists = lists.filter(l => data.list_ids.includes(l.id));

        const sampleMatches = [
            {
                canonical_name: 'Pastillas de Freno Delanteras Cerámicas',
                best_price: 32.50,
                products: [
                    { list_id: data.list_ids[0] || 1, price: 34.50, is_best_price: false },
                    { list_id: data.list_ids[1] || 2, price: 32.50, is_best_price: true }
                ]
            },
            {
                canonical_name: 'Amortiguador Trasero de Gas Doble Tubo',
                best_price: 49.00,
                products: [
                    { list_id: data.list_ids[0] || 1, price: 54.00, is_best_price: false },
                    { list_id: data.list_ids[1] || 2, price: 49.00, is_best_price: true }
                ]
            },
            {
                canonical_name: 'Bujía Láser Iridio de Alto Rendimiento',
                best_price: 11.80,
                products: [
                    { list_id: data.list_ids[0] || 1, price: 11.80, is_best_price: true },
                    { list_id: data.list_ids[1] || 2, price: 13.50, is_best_price: false }
                ]
            },
            {
                canonical_name: 'Filtro de Aceite Blindado Rosca M20',
                best_price: 8.50,
                products: [
                    { list_id: data.list_ids[0] || 1, price: 9.80, is_best_price: false },
                    { list_id: data.list_ids[1] || 2, price: 8.50, is_best_price: true }
                ]
            }
        ];

        return {
            matches_found: sampleMatches.length,
            potential_savings: 14.50,
            lists: selectedLists.map(l => ({ id: l.id, name: l.name })),
            matches: sampleMatches
        };
    }

    // ============================================
    // MIXED LISTINGS
    // ============================================

    async getMixedListings(): Promise<MixedListing[]> {
        await this.delay(100);
        return getFromStorage(STORAGE_KEYS.MIXED_LISTINGS, [
            {
                id: 1,
                name: 'Listado Optimizado Frenos y Filtros',
                created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                product_count: 8,
                list_ids: [1, 4]
            }
        ]);
    }

    async createMixedListing(data: { name: string; list_ids: number[]; use_best_prices?: boolean }): Promise<MixedListing> {
        await this.delay(200);
        const listings = await this.getMixedListings();
        const newListing: MixedListing = {
            id: Math.max(...listings.map(l => l.id), 0) + 1,
            name: data.name,
            created_at: new Date().toISOString(),
            product_count: 6,
            list_ids: data.list_ids
        };

        listings.push(newListing);
        saveToStorage(STORAGE_KEYS.MIXED_LISTINGS, listings);
        return newListing;
    }

    async deleteMixedListing(id: number): Promise<void> {
        await this.delay(100);
        const listings = await this.getMixedListings();
        saveToStorage(STORAGE_KEYS.MIXED_LISTINGS, listings.filter(l => l.id !== id));
    }

    async getMixedListingProducts(_listingId: number, _filters?: Record<string, unknown>): Promise<{ products: unknown[]; total: number }> {
        await this.delay(150);
        const masterProducts = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);
        const sample = masterProducts.slice(0, 8).map(p => ({
            id: p.id,
            name: p.description,
            price: p.final_price || p.price_usd,
            list_name: p.original_list_name,
            price_range_name: p.price_usd < 25 ? 'Económico' : 'Medio',
            is_best_price: true
        }));
        return { products: sample, total: sample.length };
    }

    // ============================================
    // CLIENT-SIDE EXPORTS (Excel / PDF)
    // ============================================

    async exportMockExcel(title: string, viewMode: 'enterprise' | 'client'): Promise<void> {
        await this.delay(300);
        const products = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);

        const isEnterprise = viewMode === 'enterprise';
        const headers = isEnterprise
            ? ['Índice', 'Código OEM', 'Descripción Producto', 'Marca', 'Costo Base ($)', 'Margen %', 'Precio Venta ($)', 'Estado', 'Lista Origen']
            : ['Índice', 'Código', 'Descripción Producto', 'Marca', 'Precio Final ($)'];

        const rows = products.map(p => {
            if (isEnterprise) {
                return [
                    p.index_number,
                    `"${p.clean_code}"`,
                    `"${p.description}"`,
                    `"${p.brand || ''}"`,
                    p.price_usd.toFixed(2),
                    p.margin_percentage !== null ? `${p.margin_percentage}%` : '0%',
                    (p.final_price || p.price_usd).toFixed(2),
                    p.review_status,
                    `"${p.original_list_name}"`
                ];
            } else {
                return [
                    p.index_number,
                    `"${p.clean_code}"`,
                    `"${p.description}"`,
                    `"${p.brand || ''}"`,
                    (p.final_price || p.price_usd).toFixed(2)
                ];
            }
        });

        // Add UTF-8 BOM so Excel opens accented Spanish characters perfectly
        const csvContent = '\uFEFF' + [
            `# ${title} - MegaAutoPartes / IrisClassifier`,
            `# Generado: ${new Date().toLocaleString()}`,
            '',
            headers.join(';'),
            ...rows.map(r => r.join(';'))
        ].join('\r\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const sanitized = title.replace(/[^a-zA-Z0-9_-]/g, '_');
        link.setAttribute('download', `${sanitized}_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    }

    async exportMockPDF(title: string, viewMode: 'enterprise' | 'client'): Promise<void> {
        await this.delay(400);
        const products = getFromStorage(STORAGE_KEYS.MASTER_PRODUCTS, INITIAL_MASTER_PRODUCTS);

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        let page = pdfDoc.addPage([595.28, 841.89]); // A4
        const { width, height } = page.getSize();

        // Header branding banner
        page.drawRectangle({
            x: 0,
            y: height - 60,
            width: width,
            height: 60,
            color: rgb(0.08, 0.12, 0.22),
        });

        page.drawText('MegaAutoPartes • IrisClassifier', {
            x: 30,
            y: height - 38,
            size: 16,
            font: fontBold,
            color: rgb(1, 1, 1),
        });

        page.drawText(`Vista: ${viewMode === 'enterprise' ? 'Empresarial (Costos + Margen)' : 'Catálogo Cliente'}`, {
            x: width - 230,
            y: height - 35,
            size: 10,
            font: font,
            color: rgb(0.8, 0.85, 0.95),
        });

        // Document title
        page.drawText(title, {
            x: 30,
            y: height - 90,
            size: 15,
            font: fontBold,
            color: rgb(0.1, 0.1, 0.1),
        });

        page.drawText(`Fecha: ${new Date().toLocaleDateString()} | Total Artículos: ${products.length}`, {
            x: 30,
            y: height - 106,
            size: 9,
            font: font,
            color: rgb(0.4, 0.4, 0.4),
        });

        // Table Header
        let y = height - 130;
        page.drawRectangle({
            x: 30,
            y: y - 5,
            width: width - 60,
            height: 20,
            color: rgb(0.92, 0.94, 0.98),
        });

        page.drawText('#', { x: 35, y: y, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        page.drawText('Código', { x: 55, y: y, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        page.drawText('Descripción', { x: 130, y: y, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        page.drawText('Marca', { x: 330, y: y, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });

        if (viewMode === 'enterprise') {
            page.drawText('Costo', { x: 410, y: y, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
            page.drawText('Margen', { x: 465, y: y, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
            page.drawText('Final ($)', { x: 515, y: y, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        } else {
            page.drawText('Precio ($)', { x: 505, y: y, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        }

        y -= 22;

        // Print rows
        const itemsToPrint = products.slice(0, 32); // Fit on first page or split
        for (const item of itemsToPrint) {
            if (y < 40) {
                // New page if needed
                page = pdfDoc.addPage([595.28, 841.89]);
                y = height - 50;
            }

            page.drawText(`${item.index_number}`, { x: 35, y, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
            page.drawText(item.clean_code.substring(0, 14), { x: 55, y, size: 8, font: fontBold, color: rgb(0.1, 0.2, 0.4) });
            page.drawText(item.description.substring(0, 42), { x: 130, y, size: 8, font, color: rgb(0.1, 0.1, 0.1) });
            page.drawText((item.brand || '').substring(0, 14), { x: 330, y, size: 8, font, color: rgb(0.3, 0.3, 0.3) });

            if (viewMode === 'enterprise') {
                page.drawText(`$${item.price_usd.toFixed(2)}`, { x: 410, y, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
                page.drawText(`${item.margin_percentage || 0}%`, { x: 465, y, size: 8, font, color: rgb(0.1, 0.5, 0.2) });
                page.drawText(`$${(item.final_price || item.price_usd).toFixed(2)}`, { x: 515, y, size: 8, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
            } else {
                page.drawText(`$${(item.final_price || item.price_usd).toFixed(2)}`, { x: 505, y, size: 8, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
            }

            // Light horizontal row separator
            page.drawLine({
                start: { x: 30, y: y - 3 },
                end: { x: width - 30, y: y - 3 },
                thickness: 0.5,
                color: rgb(0.9, 0.9, 0.9),
            });

            y -= 18;
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const sanitized = title.replace(/[^a-zA-Z0-9_-]/g, '_');
        link.setAttribute('download', `${sanitized}_${Date.now()}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    }
}

export const mockDataService = new MockDataService();
