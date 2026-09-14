import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOfflineSync } from './useOfflineSync';
import { Network } from '@capacitor/network';
import { localDB } from '../services/localDatabase';
import api from '../services/api';

// Mock Capacitor Network
vi.mock('@capacitor/network', () => ({
    Network: {
        getStatus: vi.fn(),
        addListener: vi.fn(),
    },
}));

// Mock local database
vi.mock('../services/localDatabase', () => ({
    localDB: {
        initialize: vi.fn().mockResolvedValue(undefined),
        getLastSyncTime: vi.fn().mockResolvedValue(null),
        getUnsyncedChanges: vi.fn().mockResolvedValue({
            products: [],
            priceLists: [],
            masterProducts: [],
        }),
        updateLastSyncTime: vi.fn().mockResolvedValue(undefined),
        markAsSynced: vi.fn().mockResolvedValue(undefined),
        getProducts: vi.fn().mockResolvedValue([]),
        createProduct: vi.fn().mockResolvedValue(undefined),
        updateProduct: vi.fn().mockResolvedValue(undefined),
        deleteProduct: vi.fn().mockResolvedValue(undefined),
        getPriceLists: vi.fn().mockResolvedValue([]),
        createPriceList: vi.fn().mockResolvedValue(undefined),
        updatePriceList: vi.fn().mockResolvedValue(undefined),
        deletePriceList: vi.fn().mockResolvedValue(undefined),
        getMasterProducts: vi.fn().mockResolvedValue([]),
        createMasterProduct: vi.fn().mockResolvedValue(undefined),
        updateMasterProduct: vi.fn().mockResolvedValue(undefined),
        deleteMasterProduct: vi.fn().mockResolvedValue(undefined),
    },
}));

// Mock API client
vi.mock('../services/api', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { changes: [] } }),
        post: vi.fn().mockResolvedValue({ data: { success: true } }),
    },
}));

describe('useOfflineSync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(Network.getStatus).mockResolvedValue({ connected: true, connectionType: 'wifi' });
        vi.mocked(Network.addListener).mockResolvedValue({ remove: vi.fn() });
        vi.mocked(localDB.getLastSyncTime).mockResolvedValue('2026-01-01T00:00:00.000Z');
        vi.mocked(localDB.getUnsyncedChanges).mockResolvedValue({
            products: [],
            priceLists: [],
            masterProducts: [],
        });
    });

    it('should initialize with network status and lastSyncTime from database', async () => {
        const { result } = renderHook(() => useOfflineSync());

        await waitFor(() => {
            expect(result.current.isOnline).toBe(true);
            expect(result.current.lastSyncTime).toBe('2026-01-01T00:00:00.000Z');
            expect(result.current.pendingChanges).toBe(0);
            expect(result.current.syncing).toBe(false);
            expect(result.current.error).toBeNull();
        });
    });

    it('should calculate pending changes correctly', async () => {
        vi.mocked(localDB.getUnsyncedChanges).mockResolvedValue({
            products: [{ id: '1' } as any],
            priceLists: [{ id: '2' } as any],
            masterProducts: [{ id: '3' } as any],
        });

        const { result } = renderHook(() => useOfflineSync());

        await waitFor(() => {
            expect(result.current.pendingChanges).toBe(3);
        });
    });

    it('should perform forceSync when triggered', async () => {
        vi.mocked(api.get).mockResolvedValue({ data: { changes: [] } });

        const { result } = renderHook(() => useOfflineSync());

        await act(async () => {
            await result.current.forceSync();
        });

        expect(api.get).toHaveBeenCalledWith('/sync/pull/products', expect.any(Object));
        expect(api.get).toHaveBeenCalledWith('/sync/pull/lists', expect.any(Object));
        expect(api.get).toHaveBeenCalledWith('/sync/pull/master-products', expect.any(Object));
        expect(result.current.syncing).toBe(false);
    });

    it('should handle sync errors gracefully and allow clearing error', async () => {
        vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'));

        const { result } = renderHook(() => useOfflineSync());

        await act(async () => {
            await result.current.forceSync();
        });

        expect(result.current.error).toBe('Sync failed. Will retry automatically.');

        act(() => {
            result.current.clearError();
        });

        expect(result.current.error).toBeNull();
    });

    it('should cleanup listener on unmount', async () => {
        const mockRemove = vi.fn();
        vi.mocked(Network.addListener).mockResolvedValue({ remove: mockRemove });

        const { unmount } = renderHook(() => useOfflineSync());

        // Wait for setupListener to complete
        await waitFor(() => {
            expect(Network.addListener).toHaveBeenCalled();
        });

        unmount();

        expect(mockRemove).toHaveBeenCalled();
    });
});
