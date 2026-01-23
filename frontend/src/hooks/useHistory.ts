/**
 * History management hook for undo/redo functionality.
 * 
 * Uses delta-based approach for memory efficiency - stores only affected
 * product IDs and their changed values, not full state snapshots.
 */
import { useState, useCallback } from 'react';

export type HistoryActionType = 'MARGIN_UPDATE' | 'RENAME' | 'DELETE';

export interface HistoryAction {
    type: HistoryActionType;
    timestamp: Date;
    affectedIds: number[];
    previousValues: any[];  // Snapshot before change
    newValues?: any[];      // Snapshot after change (not needed for delete)
    description: string;    // Human-readable description
}

const MAX_HISTORY_SIZE = 50;  // Limit history to prevent memory issues

export function useHistory() {
    const [history, setHistory] = useState<HistoryAction[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    const canUndo = historyIndex >= 0;
    const canRedo = historyIndex < history.length - 1;

    /**
     * Push a new action to history.
     * Clears any future actions (redo stack) when new action is performed.
     */
    const pushAction = useCallback((action: HistoryAction) => {
        setHistory(prev => {
            // Remove any future actions (they're invalidated by new action)
            const newHistory = prev.slice(0, historyIndex + 1);

            // Add new action
            newHistory.push(action);

            // Limit history size
            if (newHistory.length > MAX_HISTORY_SIZE) {
                newHistory.shift();
                setHistoryIndex(MAX_HISTORY_SIZE - 1);
            } else {
                setHistoryIndex(newHistory.length - 1);
            }

            return newHistory;
        });
    }, [historyIndex]);

    /**
     * Get the action to undo (current action at historyIndex).
     */
    const getUndoAction = useCallback((): HistoryAction | null => {
        if (!canUndo) return null;
        return history[historyIndex];
    }, [canUndo, history, historyIndex]);

    /**
     * Get the action to redo (next action after historyIndex).
     */
    const getRedoAction = useCallback((): HistoryAction | null => {
        if (!canRedo) return null;
        return history[historyIndex + 1];
    }, [canRedo, history, historyIndex]);

    /**
     * Move history pointer back (undo).
     */
    const undo = useCallback(() => {
        if (canUndo) {
            setHistoryIndex(prev => prev - 1);
        }
    }, [canUndo]);

    /**
     * Move history pointer forward (redo).
     */
    const redo = useCallback(() => {
        if (canRedo) {
            setHistoryIndex(prev => prev + 1);
        }
    }, [canRedo]);

    /**
     * Clear all history.
     */
    const clearHistory = useCallback(() => {
        setHistory([]);
        setHistoryIndex(-1);
    }, []);

    return {
        canUndo,
        canRedo,
        pushAction,
        getUndoAction,
        getRedoAction,
        undo,
        redo,
        clearHistory,
        history,
        historyIndex
    };
}
