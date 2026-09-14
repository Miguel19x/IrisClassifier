/**
 * Enhanced Offline Sync Hook with SQLite Integration
 * 
 * Manages bidirectional synchronization between local SQLite and cloud backend.
 * Implements conflict resolution with last-write-wins strategy.
 */
import { useState, useEffect, useCallback } from 'react';
import { Network } from '@capacitor/network';
import { localDB } from '../services/localDatabase';
import api from '../services/api';

interface SyncStatus {
    isOnline: boolean;
    syncing: boolean;
    lastSyncTime: string | null;
    pendingChanges: number;
    error: string | null;
}

export function useOfflineSync() {
    const [status, setStatus] = useState<SyncStatus>({
        isOnline: true,
        syncing: false,
        lastSyncTime: null,
        pendingChanges: 0,
        error: null,
    });

    // Initialize database on mount
    useEffect(() => {
        initializeDatabase();
    }, []);

    // Monitor network status
    useEffect(() => {
        let isMounted = true;
        let listenerHandle: any = null;

        const setupListener = async () => {
            const networkStatus = await Network.getStatus();
            if (!isMounted) return;
            setStatus(prev => ({ ...prev, isOnline: networkStatus.connected }));

            const handle = await Network.addListener('networkStatusChange', (networkStatus) => {
                if (!isMounted) return;
                setStatus(prev => ({ ...prev, isOnline: networkStatus.connected }));

                // Auto-sync when coming online
                if (networkStatus.connected) {
                    syncWithCloud();
                }
            });

            if (!isMounted) {
                handle.remove();
            } else {
                listenerHandle = handle;
            }
        };

        setupListener();

        return () => {
            isMounted = false;
            if (listenerHandle) {
                listenerHandle.remove();
            }
        };
    }, []);

    // Update pending changes count periodically
    useEffect(() => {
        const interval = setInterval(async () => {
            await updatePendingCount();
        }, 5000); // Check every 5 seconds

        return () => clearInterval(interval);
    }, []);

    /**
     * Initialize local database
     */
    const initializeDatabase = async () => {
        try {
            await localDB.initialize();
            const lastSync = await localDB.getLastSyncTime();
            setStatus(prev => ({ ...prev, lastSyncTime: lastSync }));
            await updatePendingCount();
        } catch (error) {
            console.error('Failed to initialize database:', error);
            setStatus(prev => ({
                ...prev,
                error: 'Failed to initialize local database'
            }));
        }
    };

    /**
     * Update count of pending changes
     */
    const updatePendingCount = async () => {
        try {
            const changes = await localDB.getUnsyncedChanges();
            const count =
                changes.products.length +
                changes.priceLists.length +
                changes.masterProducts.length;

            setStatus(prev => ({ ...prev, pendingChanges: count }));
        } catch (error) {
            console.error('Failed to get pending changes:', error);
        }
    };

    /**
     * Push local changes to cloud
     */
    const pushToCloud = async (): Promise<void> => {
        try {
            const changes = await localDB.getUnsyncedChanges();

            // Push products
            if (changes.products.length > 0) {
                const response = await api.post('/sync/push/products', {
                    changes: changes.products,
                });

                if (response.data.success) {
                    const syncedIds = changes.products.map(p => p.id);
                    await localDB.markAsSynced('products', syncedIds);
                }
            }

            // Push price lists
            if (changes.priceLists.length > 0) {
                const response = await api.post('/sync/push/lists', {
                    changes: changes.priceLists,
                });

                if (response.data.success) {
                    const syncedIds = changes.priceLists.map(l => l.id);
                    await localDB.markAsSynced('price_lists', syncedIds);
                }
            }

            // Push master products
            if (changes.masterProducts.length > 0) {
                const response = await api.post('/sync/push/master-products', {
                    changes: changes.masterProducts,
                });

                if (response.data.success) {
                    const syncedIds = changes.masterProducts.map(m => m.id);
                    await localDB.markAsSynced('master_products', syncedIds);
                }
            }
        } catch (error) {
            console.error('Failed to push changes to cloud:', error);
            throw error;
        }
    };

    /**
     * Pull changes from cloud
     */
    const pullFromCloud = async (): Promise<void> => {
        try {
            const lastSync = await localDB.getLastSyncTime();
            const since = lastSync || new Date(0).toISOString();

            // Pull products
            const productsResponse = await api.get('/sync/pull/products', {
                params: { since },
            });

            for (const product of productsResponse.data.changes || []) {
                if (product.deleted) {
                    await localDB.deleteProduct(product.id);
                } else {
                    // Check if exists locally
                    const existing = await localDB.getProducts();
                    const found = existing.find(p => p.id === product.id);

                    if (found) {
                        // Conflict resolution: last-write-wins
                        if (new Date(product.updated_at) > new Date(found.updated_at)) {
                            await localDB.updateProduct(product.id, {
                                ...product,
                                synced: true,
                            });
                        }
                    } else {
                        await localDB.createProduct({
                            ...product,
                            synced: true,
                        });
                    }
                }
            }

            // Pull price lists
            const listsResponse = await api.get('/sync/pull/lists', {
                params: { since },
            });

            for (const list of listsResponse.data.changes || []) {
                if (list.deleted) {
                    await localDB.deletePriceList(list.id);
                } else {
                    const existing = await localDB.getPriceLists();
                    const found = existing.find(l => l.id === list.id);

                    if (found) {
                        if (new Date(list.updated_at) > new Date(found.updated_at)) {
                            await localDB.updatePriceList(list.id, {
                                ...list,
                                synced: true,
                            });
                        }
                    } else {
                        await localDB.createPriceList({
                            ...list,
                            synced: true,
                        });
                    }
                }
            }

            // Pull master products
            const masterResponse = await api.get('/sync/pull/master-products', {
                params: { since },
            });

            for (const master of masterResponse.data.changes || []) {
                if (master.deleted) {
                    await localDB.deleteMasterProduct(master.id);
                } else {
                    const existing = await localDB.getMasterProducts();
                    const found = existing.find(m => m.id === master.id);

                    if (found) {
                        if (new Date(master.updated_at) > new Date(found.updated_at)) {
                            await localDB.updateMasterProduct(master.id, {
                                ...master,
                                synced: true,
                            });
                        }
                    } else {
                        await localDB.createMasterProduct({
                            ...master,
                            synced: true,
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Failed to pull changes from cloud:', error);
            throw error;
        }
    };

    /**
     * Bidirectional sync with cloud
     */
    const syncWithCloud = useCallback(async (): Promise<void> => {
        if (status.syncing || !status.isOnline) {
            return;
        }

        setStatus(prev => ({ ...prev, syncing: true, error: null }));

        try {
            // First pull from cloud (to get latest changes)
            await pullFromCloud();

            // Then push local changes
            await pushToCloud();

            // Update last sync time
            const now = new Date().toISOString();
            await localDB.updateLastSyncTime(now);

            setStatus(prev => ({
                ...prev,
                syncing: false,
                lastSyncTime: now,
                pendingChanges: 0,
            }));
        } catch (error) {
            console.error('Sync failed:', error);
            setStatus(prev => ({
                ...prev,
                syncing: false,
                error: 'Sync failed. Will retry automatically.',
            }));
        }
    }, [status.syncing, status.isOnline]);

    /**
     * Force manual sync
     */
    const forceSync = async (): Promise<void> => {
        await syncWithCloud();
    };

    /**
     * Clear sync error
     */
    const clearError = () => {
        setStatus(prev => ({ ...prev, error: null }));
    };

    return {
        ...status,
        syncWithCloud,
        forceSync,
        clearError,
        localDB, // Expose database for direct access
    };
}
