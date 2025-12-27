/**
 * Página consolidada de Herramientas.
 * 
 * Combina Comparación, Listados Mixtos y Ajustes en pestañas.
 */
import { useState } from 'react';
import { ComparePage } from './Compare';
import { MixedListingsPage } from './MixedListings';
import { SettingsPage } from './Settings';
import './ToolsHub.css';

type ToolTab = 'compare' | 'listings' | 'settings';

export function ToolsHubPage() {
    const [activeTab, setActiveTab] = useState<ToolTab>('compare');

    return (
        <div className="tools-hub">
            <div className="page-header">
                <h2>🛠️ Herramientas</h2>
                <p className="subtitle">Compara precios, gestiona listados y configura rangos</p>
            </div>

            <div className="tools-tabs">
                <button
                    className={`tool-tab ${activeTab === 'compare' ? 'active' : ''}`}
                    onClick={() => setActiveTab('compare')}
                >
                    <span className="tab-icon">📊</span>
                    <span className="tab-label">Comparar</span>
                </button>
                <button
                    className={`tool-tab ${activeTab === 'listings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('listings')}
                >
                    <span className="tab-icon">📋</span>
                    <span className="tab-label">Listados</span>
                </button>
                <button
                    className={`tool-tab ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('settings')}
                >
                    <span className="tab-icon">⚙️</span>
                    <span className="tab-label">Ajustes</span>
                </button>
            </div>

            <div className="tool-content">
                {activeTab === 'compare' && <ComparePage />}
                {activeTab === 'listings' && <MixedListingsPage />}
                {activeTab === 'settings' && <SettingsPage />}
            </div>
        </div>
    );
}
