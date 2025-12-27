/**
 * Offline sync hook.
 * 
 * Manages offline data synchronization with background sync.
 */
import { useState, useEffect } from 'react';
import { Network } from '@capacitor/network';
import { useFilesystem } from './useFilesystem';

interface SyncItem {
    id: string;
    type: 'catalog' | 'product' | 'price_range';
    action: 'create' | 'update' | 'delete';
    data: any;
    timestamp: number;
}

export function useOfflineSync() {
    const [isOnline, setIsOnline] = useState(true);
    const [syncQueue, setSyncQueue] = useState<SyncItem[]>([]);
    const [syncing, setSyncing] = useState(false);
    const { writeFile, readFile } = useFilesystem();

    const SYNC_QUEUE_FILE = 'sync_queue.json';

    // Monitor network status
    useEffect(() => {
        let listenerHandle: any = null;

        const setupListener = async () => {
            const status = await Network.getStatus();
            setIsOnline(status.connected);

            // Await the listener registration to get the PluginListenerHandle
            listenerHandle = await Network.addListener('networkStatusChange', (status) => {
                setIsOnline(status.connected);

                // Auto-sync when coming online
                if (status.connected && syncQueue.length > 0) {
                    syncPendingChanges();
                }
            });
        };

        setupListener();

        return () => {
            if (listenerHandle) {
                listenerHandle.remove();
            }
        };
    }, [syncQueue]);

    // Load sync queue from storage
    useEffect(() => {
        loadSyncQueue();
    }, []);

    const loadSyncQueue = async () => {
        const data = await readFile(SYNC_QUEUE_FILE);
        if (data) {
            try {
                const queue = JSON.parse(data);
                setSyncQueue(queue);
            } catch (err) {
                console.error('Failed to parse sync queue:', err);
            }
        }
    };

    const saveSyncQueue = async (queue: SyncItem[]) => {
        await writeFile(SYNC_QUEUE_FILE, JSON.stringify(queue));
    };

    const addToQueue = async (item: Omit<SyncItem, 'id' | 'timestamp'>) => {
        const newItem: SyncItem = {
            ...item,
            id: `${Date.now()}_${Math.random()}`,
            timestamp: Date.now(),
        };

        const newQueue = [...syncQueue, newItem];
        setSyncQueue(newQueue);
        await saveSyncQueue(newQueue);

        // Try to sync immediately if online
        if (isOnline) {
            syncPendingChanges();
        }
    };

    const syncPendingChanges = async () => {
        if (syncing || syncQueue.length === 0 || !isOnline) {
            return;
        }

        setSyncing(true);

        try {
            const successfulIds: string[] = [];

            for (const item of syncQueue) {
                try {
                    // Send to API based on type and action
                    const endpoint = getEndpoint(item.type);
                    const response = await fetch(endpoint, {
                        method: getMethod(item.action),
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: item.action !== 'delete' ? JSON.stringify(item.data) : undefined,
                    });

                    if (response.ok) {
                        successfulIds.push(item.id);
                    }
                } catch (err) {
                    console.error(`Failed to sync item ${item.id}:`, err);
                }
            }

            // Remove successful items from queue
            const newQueue = syncQueue.filter((item) => !successfulIds.includes(item.id));
            setSyncQueue(newQueue);
            await saveSyncQueue(newQueue);
        } finally {
            setSyncing(false);
        }
    };

    const getEndpoint = (type: string): string => {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

        switch (type) {
            case 'catalog':
                return `${baseUrl}/api/v1/catalogs`;
            case 'product':
                return `${baseUrl}/api/v1/products`;
            case 'price_range':
                return `${baseUrl}/api/v1/price-ranges`;
            default:
                return baseUrl;
        }
    };

    const getMethod = (action: string): string => {
        switch (action) {
            case 'create':
                return 'POST';
            case 'update':
                return 'PATCH';
            case 'delete':
                return 'DELETE';
            default:
                return 'GET';
        }
    };

    const clearQueue = async () => {
        setSyncQueue([]);
        await saveSyncQueue([]);
    };

    return {
        isOnline,
        syncQueue,
        syncing,
        addToQueue,
        syncPendingChanges,
        clearQueue,
        pendingCount: syncQueue.length,
    };
}
