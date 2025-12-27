/**
 * TanStack Query configuration.
 * 
 * Configures caching, stale time, and retry behavior for React Query.
 */
import { QueryClient } from '@tanstack/react-query';

// Performance configuration from PERFORMANCE_TUNING.md
export const PERFORMANCE_CONFIG = {
    /** Time in ms before cached data is considered stale */
    STALE_TIME: 5 * 60 * 1000,  // 5 minutes

    /** Time in ms to keep unused data in cache */
    GC_TIME: 30 * 60 * 1000,    // 30 minutes

    /** Number of products to load per page */
    PAGE_SIZE: 50,

    /** Debounce delay for search input in ms */
    SEARCH_DEBOUNCE: 300,

    /** Maximum retries for failed API requests */
    MAX_RETRIES: 3,

    /** Request timeout in ms */
    REQUEST_TIMEOUT: 30000,

    /** Enable offline mode caching */
    OFFLINE_ENABLED: true,

    /** Maximum items to store offline */
    OFFLINE_MAX_ITEMS: 1000,
} as const;

/**
 * Create and configure QueryClient instance.
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: PERFORMANCE_CONFIG.STALE_TIME,
            gcTime: PERFORMANCE_CONFIG.GC_TIME,
            retry: PERFORMANCE_CONFIG.MAX_RETRIES,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
        },
        mutations: {
            retry: 1,
        },
    },
});
