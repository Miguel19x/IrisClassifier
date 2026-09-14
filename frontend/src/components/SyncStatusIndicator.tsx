/**
 * Sync Status Indicator Component
 * 
 * Displays connection status, pending changes, and sync controls.
 */
import { useOfflineSync } from '../hooks/useOfflineSync';
import { Wifi, WifiOff, RefreshCw, AlertCircle, Check } from 'lucide-react';

export function SyncStatusIndicator() {
    const {
        isOnline,
        syncing,
        lastSyncTime,
        pendingChanges,
        error,
        forceSync,
        clearError
    } = useOfflineSync();

    const formatLastSync = (timestamp: string | null): string => {
        if (!timestamp) return 'Never';

        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 min-w-[280px]">
                {/* Connection Status */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        {isOnline ? (
                            <Wifi className="w-5 h-5 text-green-500" />
                        ) : (
                            <WifiOff className="w-5 h-5 text-red-500" />
                        )}
                        <span className="text-sm font-medium">
                            {isOnline ? 'Online' : 'Offline'}
                        </span>
                    </div>

                    {/* Sync Button */}
                    <button
                        onClick={forceSync}
                        disabled={syncing || !isOnline}
                        className={`p-2 rounded-md transition-colors ${syncing || !isOnline
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                            }`}
                        title="Force sync"
                    >
                        <RefreshCw
                            className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`}
                        />
                    </button>
                </div>

                {/* Pending Changes */}
                {pendingChanges > 0 && (
                    <div className="flex items-center gap-2 mb-2 text-sm text-amber-600 dark:text-amber-400">
                        <AlertCircle className="w-4 h-4" />
                        <span>{pendingChanges} pending change{pendingChanges !== 1 ? 's' : ''}</span>
                    </div>
                )}

                {/* Last Sync */}
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Check className="w-3 h-3" />
                    <span>Last sync: {formatLastSync(lastSyncTime)}</span>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
                                <button
                                    onClick={clearError}
                                    className="text-xs text-red-600 dark:text-red-400 underline mt-1"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Syncing Indicator */}
                {syncing && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span>Synchronizing...</span>
                    </div>
                )}
            </div>
        </div>
    );
}
