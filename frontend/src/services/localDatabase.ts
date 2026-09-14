/**
 * Local SQLite Database Service
 * 
 * Provides offline-first data storage using Capacitor SQLite plugin.
 * Schema mirrors backend models with sync support.
 */

import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

// Database configuration
const DB_NAME = 'iris_local';
const DB_VERSION = 1;
const DB_ENCRYPTED = false;

// Syncable entity interface
export interface SyncableEntity {
    id: string;           // UUID for conflict-free replication
    updated_at: string;   // ISO timestamp
    synced: boolean;      // Sync status
    deleted: boolean;     // Soft delete flag
}

// Local entity types
export interface LocalProduct extends SyncableEntity {
    list_id: string;
    code: string;
    name: string;
    brand: string;
    price_usd: number;
    currency: string;
    review_status: 'pending' | 'verified' | 'rejected';
}

export interface LocalPriceList extends SyncableEntity {
    name: string;
    file_name: string;
    file_type: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    product_count: number;
}

export interface LocalMasterProduct extends SyncableEntity {
    code: string;
    description: string;
    brand: string;
    base_price_usd: number;
    margin_percentage: number | null;
    final_price_usd: number | null;
    review_status: 'pending' | 'verified' | 'rejected';
    source_list_id: string;
    index_number: number;
}

class LocalDatabaseService {
    private sqlite: SQLiteConnection;
    private db: SQLiteDBConnection | null = null;
    private isInitialized = false;

    constructor() {
        this.sqlite = new SQLiteConnection(CapacitorSQLite);
    }

    /**
     * Initialize database connection and create schema
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // Check if platform supports SQLite
            const platform = Capacitor.getPlatform();
            if (platform === 'web') {
                // For web, use sql.js (included with plugin)
                await this.sqlite.initWebStore();
            }

            // Create or open database
            this.db = await this.sqlite.createConnection(
                DB_NAME,
                DB_ENCRYPTED,
                'no-encryption',
                DB_VERSION,
                false
            );

            await this.db.open();

            // Create tables
            await this.createSchema();

            this.isInitialized = true;
            console.log('Local database initialized successfully');
        } catch (error) {
            console.error('Failed to initialize local database:', error);
            throw error;
        }
    }

    /**
     * Create database schema
     */
    private async createSchema(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const schema = `
            -- Price Lists table
            CREATE TABLE IF NOT EXISTS price_lists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                product_count INTEGER DEFAULT 0,
                updated_at TEXT NOT NULL,
                synced INTEGER DEFAULT 0,
                deleted INTEGER DEFAULT 0
            );

            -- Products table
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                list_id TEXT NOT NULL,
                code TEXT NOT NULL,
                name TEXT NOT NULL,
                brand TEXT,
                price_usd REAL NOT NULL,
                currency TEXT DEFAULT 'USD',
                review_status TEXT DEFAULT 'pending',
                updated_at TEXT NOT NULL,
                synced INTEGER DEFAULT 0,
                deleted INTEGER DEFAULT 0,
                FOREIGN KEY (list_id) REFERENCES price_lists(id)
            );

            -- Master Products table
            CREATE TABLE IF NOT EXISTS master_products (
                id TEXT PRIMARY KEY,
                code TEXT NOT NULL,
                description TEXT NOT NULL,
                brand TEXT,
                base_price_usd REAL NOT NULL,
                margin_percentage REAL,
                final_price_usd REAL,
                review_status TEXT DEFAULT 'pending',
                source_list_id TEXT NOT NULL,
                index_number INTEGER NOT NULL,
                updated_at TEXT NOT NULL,
                synced INTEGER DEFAULT 0,
                deleted INTEGER DEFAULT 0,
                FOREIGN KEY (source_list_id) REFERENCES price_lists(id)
            );

            -- Sync metadata table
            CREATE TABLE IF NOT EXISTS sync_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            -- Indexes for performance
            CREATE INDEX IF NOT EXISTS idx_products_list ON products(list_id);
            CREATE INDEX IF NOT EXISTS idx_products_synced ON products(synced);
            CREATE INDEX IF NOT EXISTS idx_master_synced ON master_products(synced);
            CREATE INDEX IF NOT EXISTS idx_lists_synced ON price_lists(synced);
        `;

        await this.db.execute(schema);
    }

    /**
     * Get unsynced changes for push to server
     */
    async getUnsyncedChanges(): Promise<{
        products: LocalProduct[];
        priceLists: LocalPriceList[];
        masterProducts: LocalMasterProduct[];
    }> {
        if (!this.db) throw new Error('Database not initialized');

        const products = await this.db.query('SELECT * FROM products WHERE synced = 0');
        const priceLists = await this.db.query('SELECT * FROM price_lists WHERE synced = 0');
        const masterProducts = await this.db.query('SELECT * FROM master_products WHERE synced = 0');

        return {
            products: products.values || [],
            priceLists: priceLists.values || [],
            masterProducts: masterProducts.values || [],
        };
    }

    /**
     * Mark entities as synced
     */
    async markAsSynced(table: string, ids: string[]): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const placeholders = ids.map(() => '?').join(',');
        const query = `UPDATE ${table} SET synced = 1 WHERE id IN (${placeholders})`;

        await this.db.run(query, ids);
    }

    /**
     * Get last sync timestamp
     */
    async getLastSyncTime(): Promise<string | null> {
        if (!this.db) throw new Error('Database not initialized');

        const result = await this.db.query(
            'SELECT value FROM sync_metadata WHERE key = ?',
            ['last_sync_time']
        );

        return result.values?.[0]?.value || null;
    }

    /**
     * Update last sync timestamp
     */
    async updateLastSyncTime(timestamp: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        await this.db.run(
            `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) 
             VALUES (?, ?, ?)`,
            ['last_sync_time', timestamp, new Date().toISOString()]
        );
    }

    // CRUD Operations for Products
    async createProduct(product: Omit<LocalProduct, 'synced' | 'deleted'>): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        await this.db.run(
            `INSERT INTO products (id, list_id, code, name, brand, price_usd, currency, review_status, updated_at, synced, deleted)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
            [
                product.id,
                product.list_id,
                product.code,
                product.name,
                product.brand,
                product.price_usd,
                product.currency,
                product.review_status,
                product.updated_at,
            ]
        );
    }

    async getProducts(listId?: string): Promise<LocalProduct[]> {
        if (!this.db) throw new Error('Database not initialized');

        const query = listId
            ? 'SELECT * FROM products WHERE list_id = ? AND deleted = 0 ORDER BY code'
            : 'SELECT * FROM products WHERE deleted = 0 ORDER BY code';

        const result = await this.db.query(query, listId ? [listId] : []);
        return result.values || [];
    }

    async updateProduct(id: string, updates: Partial<LocalProduct>): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const fields = Object.keys(updates).filter(k => k !== 'id');
        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => (updates as any)[f]);

        await this.db.run(
            `UPDATE products SET ${setClause}, updated_at = ?, synced = 0 WHERE id = ?`,
            [...values, new Date().toISOString(), id]
        );
    }

    async deleteProduct(id: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        // Soft delete
        await this.db.run(
            'UPDATE products SET deleted = 1, synced = 0, updated_at = ? WHERE id = ?',
            [new Date().toISOString(), id]
        );
    }

    // CRUD Operations for Price Lists
    async createPriceList(list: Omit<LocalPriceList, 'synced' | 'deleted'>): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        await this.db.run(
            `INSERT INTO price_lists (id, name, file_name, file_type, status, product_count, updated_at, synced, deleted)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`,
            [
                list.id,
                list.name,
                list.file_name,
                list.file_type,
                list.status,
                list.product_count,
                list.updated_at,
            ]
        );
    }

    async getPriceLists(): Promise<LocalPriceList[]> {
        if (!this.db) throw new Error('Database not initialized');

        const result = await this.db.query(
            'SELECT * FROM price_lists WHERE deleted = 0 ORDER BY updated_at DESC'
        );
        return result.values || [];
    }

    async updatePriceList(id: string, updates: Partial<LocalPriceList>): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const fields = Object.keys(updates).filter(k => k !== 'id');
        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => (updates as any)[f]);

        await this.db.run(
            `UPDATE price_lists SET ${setClause}, updated_at = ?, synced = 0 WHERE id = ?`,
            [...values, new Date().toISOString(), id]
        );
    }

    async deletePriceList(id: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        await this.db.run(
            'UPDATE price_lists SET deleted = 1, synced = 0, updated_at = ? WHERE id = ?',
            [new Date().toISOString(), id]
        );
    }

    // CRUD Operations for Master Products
    async createMasterProduct(product: Omit<LocalMasterProduct, 'synced' | 'deleted'>): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        await this.db.run(
            `INSERT INTO master_products (id, code, description, brand, base_price_usd, margin_percentage, final_price_usd, review_status, source_list_id, index_number, updated_at, synced, deleted)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
            [
                product.id,
                product.code,
                product.description,
                product.brand,
                product.base_price_usd,
                product.margin_percentage,
                product.final_price_usd,
                product.review_status,
                product.source_list_id,
                product.index_number,
                product.updated_at,
            ]
        );
    }

    async getMasterProducts(): Promise<LocalMasterProduct[]> {
        if (!this.db) throw new Error('Database not initialized');

        const result = await this.db.query(
            'SELECT * FROM master_products WHERE deleted = 0 ORDER BY index_number'
        );
        return result.values || [];
    }

    async updateMasterProduct(id: string, updates: Partial<LocalMasterProduct>): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const fields = Object.keys(updates).filter(k => k !== 'id');
        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => (updates as any)[f]);

        await this.db.run(
            `UPDATE master_products SET ${setClause}, updated_at = ?, synced = 0 WHERE id = ?`,
            [...values, new Date().toISOString(), id]
        );
    }

    async deleteMasterProduct(id: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        await this.db.run(
            'UPDATE master_products SET deleted = 1, synced = 0, updated_at = ? WHERE id = ?',
            [new Date().toISOString(), id]
        );
    }

    /**
     * Clear all local data (for testing/reset)
     */
    async clearAllData(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        await this.db.execute(`
            DELETE FROM products;
            DELETE FROM price_lists;
            DELETE FROM master_products;
            DELETE FROM sync_metadata;
        `);
    }

    /**
     * Close database connection
     */
    async close(): Promise<void> {
        if (this.db) {
            await this.db.close();
            this.db = null;
            this.isInitialized = false;
        }
    }
}

// Export singleton instance
export const localDB = new LocalDatabaseService();
