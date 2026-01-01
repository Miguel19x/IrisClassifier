/**
 * Export Configuration Context
 * 
 * Global state for export settings with localStorage persistence.
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

// ============================================
// TYPES
// ============================================

export interface ManualHeader {
    content: string; // HTML from rich text editor
    alignment: 'left' | 'center' | 'right';
}

export interface TemplateFile {
    name: string;
    type: 'pdf' | 'excel';
    data: string; // Base64 encoded file
}

export interface ExportConfig {
    filename: string;
    headerMode: 'manual' | 'template';
    manualHeader: ManualHeader;
    templateFile: TemplateFile | null;
}

interface ExportConfigContextType {
    config: ExportConfig;
    updateConfig: (updates: Partial<ExportConfig>) => void;
    updateManualHeader: (updates: Partial<ManualHeader>) => void;
    setTemplate: (file: TemplateFile) => void;
    clearTemplate: () => void;
    resetToDefaults: () => void;
}

// ============================================
// DEFAULTS
// ============================================

const DEFAULT_CONFIG: ExportConfig = {
    filename: 'Listado_de_Productos',
    headerMode: 'manual',
    manualHeader: {
        content: '<p style="text-align: center"><strong>Listado de Productos</strong></p>',
        alignment: 'center',
    },
    templateFile: null,
};

const STORAGE_KEY = 'export-config';

// ============================================
// CONTEXT
// ============================================

const ExportConfigContext = createContext<ExportConfigContextType | undefined>(undefined);

// ============================================
// PROVIDER
// ============================================

export function ExportConfigProvider({ children }: { children: ReactNode }) {
    const [config, setConfig] = useState<ExportConfig>(() => {
        // Load from localStorage on init
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return { ...DEFAULT_CONFIG, ...parsed };
            }
        } catch (e) {
            console.warn('Failed to load export config from localStorage:', e);
        }
        return DEFAULT_CONFIG;
    });

    // Persist to localStorage on change
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        } catch (e) {
            console.warn('Failed to save export config to localStorage:', e);
        }
    }, [config]);

    const updateConfig = (updates: Partial<ExportConfig>) => {
        setConfig(prev => ({ ...prev, ...updates }));
    };

    const updateManualHeader = (updates: Partial<ManualHeader>) => {
        setConfig(prev => ({
            ...prev,
            manualHeader: { ...prev.manualHeader, ...updates },
        }));
    };

    const setTemplate = (file: TemplateFile) => {
        setConfig(prev => ({
            ...prev,
            headerMode: 'template',
            templateFile: file,
        }));
    };

    const clearTemplate = () => {
        setConfig(prev => ({
            ...prev,
            headerMode: 'manual',
            templateFile: null,
        }));
    };

    const resetToDefaults = () => {
        setConfig(DEFAULT_CONFIG);
    };

    return (
        <ExportConfigContext.Provider value={{
            config,
            updateConfig,
            updateManualHeader,
            setTemplate,
            clearTemplate,
            resetToDefaults,
        }}>
            {children}
        </ExportConfigContext.Provider>
    );
}

// ============================================
// HOOK
// ============================================

export function useExportConfig() {
    const context = useContext(ExportConfigContext);
    if (!context) {
        throw new Error('useExportConfig must be used within ExportConfigProvider');
    }
    return context;
}
