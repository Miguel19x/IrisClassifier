import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOfflineSync } from './useOfflineSync';
import { Network } from '@capacitor/network';

// Mock dependencies
vi.mock('@capacitor/network', () => ({
    Network: {
        getStatus: vi.fn(),
        addListener: vi.fn(),
    },
}));

vi.mock('./useFilesystem', () => ({
    useFilesystem: () => ({
        writeFile: vi.fn().mockResolvedValue(true),
        readFile: vi.fn().mockResolvedValue(null),
    }),
}));

// Mock fetch
globalThis.fetch = vi.fn();

describe('useOfflineSync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(Network.getStatus).mockResolvedValue({ connected: true, connectionType: 'wifi' });
        vi.mocked(Network.addListener).mockResolvedValue({ remove: vi.fn() });
    });

    it('should initialize with online status', async () => {
        const { result } = renderHook(() => useOfflineSync());

        await waitFor(() => {
            expect(result.current.isOnline).toBe(true);
        });
    });

    it('should initialize with empty sync queue', () => {
        const { result } = renderHook(() => useOfflineSync());

        expect(result.current.syncQueue).toEqual([]);
        expect(result.current.pendingCount).toBe(0);
    });

    it('should add item to queue', async () => {
        const { result } = renderHook(() => useOfflineSync());

        await act(async () => {
            await result.current.addToQueue({
                type: 'catalog',
                action: 'create',
                data: { name: 'Test Catalog' },
            });
        });

        expect(result.current.syncQueue.length).toBe(1);
        expect(result.current.syncQueue[0].type).toBe('catalog');
        expect(result.current.syncQueue[0].action).toBe('create');
        expect(result.current.pendingCount).toBe(1);
    });

    it('should sync items when online', async () => {
        vi.mocked(globalThis.fetch).mockResolvedValue({
            ok: true,
            json: async () => ({}),
        } as Response);

        const { result } = renderHook(() => useOfflineSync());

        // Add item to queue
        await act(async () => {
            await result.current.addToQueue({
                type: 'product',
                action: 'update',
                data: { id: 1, name: 'Updated Product' },
            });
        });

        // Sync should be triggered automatically
        await waitFor(() => {
            expect(globalThis.fetch).toHaveBeenCalled();
        });
    });

    it('should not sync when offline', async () => {
        vi.mocked(Network.getStatus).mockResolvedValue({ connected: false, connectionType: 'none' });

        const { result } = renderHook(() => useOfflineSync());

        await act(async () => {
            await result.current.addToQueue({
                type: 'catalog',
                action: 'create',
                data: { name: 'Test' },
            });
        });

        // Should not call fetch when offline
        expect(globalThis.fetch).not.toHaveBeenCalled();
        expect(result.current.syncQueue.length).toBe(1);
    });

    it('should handle sync errors gracefully', async () => {
        vi.mocked(globalThis.fetch).mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => useOfflineSync());

        await act(async () => {
            await result.current.addToQueue({
                type: 'catalog',
                action: 'create',
                data: { name: 'Test' },
            });
        });

        // Item should remain in queue after failed sync
        await waitFor(() => {
            expect(result.current.syncQueue.length).toBe(1);
        });
    });

    it('should clear queue', async () => {
        const { result } = renderHook(() => useOfflineSync());

        // Add items
        await act(async () => {
            await result.current.addToQueue({
                type: 'catalog',
                action: 'create',
                data: { name: 'Test 1' },
            });
            await result.current.addToQueue({
                type: 'product',
                action: 'update',
                data: { id: 1 },
            });
        });

        expect(result.current.syncQueue.length).toBe(2);

        // Clear queue
        await act(async () => {
            await result.current.clearQueue();
        });

        expect(result.current.syncQueue.length).toBe(0);
        expect(result.current.pendingCount).toBe(0);
    });

    it('should use correct HTTP method for actions', async () => {
        vi.mocked(globalThis.fetch).mockResolvedValue({
            ok: true,
            json: async () => ({}),
        } as Response);

        const { result } = renderHook(() => useOfflineSync());

        // Test CREATE -> POST
        await act(async () => {
            await result.current.addToQueue({
                type: 'catalog',
                action: 'create',
                data: { name: 'Test' },
            });
        });

        await waitFor(() => {
            expect(globalThis.fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ method: 'POST' })
            );
        });
    });

    it('should cleanup listener on unmount', () => {
        const mockRemove = vi.fn();
        vi.mocked(Network.addListener).mockResolvedValue({ remove: mockRemove });

        const { unmount } = renderHook(() => useOfflineSync());

        unmount();

        // Listener should be removed
        expect(mockRemove).toHaveBeenCalled();
    });
});
