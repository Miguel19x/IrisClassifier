import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import './App.css';
import { useCatalogs, useUploadCatalog } from './services/queries';
import { ProductsPage } from './pages/Products';
import { SettingsPage } from './pages/Settings';
import { CameraPage } from './pages/Camera';
import { LoginPage } from './pages/Login';
import { ComparePage } from './pages/Compare';
import { MixedListingsPage } from './pages/MixedListings';
import { AuthProvider, useAuth } from './hooks/useAuth';

// Create a client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

type Page = 'catalogs' | 'products' | 'compare' | 'mixed-listings' | 'camera' | 'settings';

function Navigation({ currentPage, onNavigate }: { currentPage: Page; onNavigate: (page: Page) => void }) {
    const { user, logout } = useAuth();

    return (
        <nav className="navigation">
            <div className="nav-left">
                <button
                    className={`nav-item ${currentPage === 'catalogs' ? 'active' : ''}`}
                    onClick={() => onNavigate('catalogs')}
                >
                    📚 Catálogos
                </button>
                <button
                    className={`nav-item ${currentPage === 'products' ? 'active' : ''}`}
                    onClick={() => onNavigate('products')}
                >
                    📦 Productos
                </button>
                <button
                    className={`nav-item ${currentPage === 'compare' ? 'active' : ''}`}
                    onClick={() => onNavigate('compare')}
                >
                    📊 Comparar
                </button>
                <button
                    className={`nav-item ${currentPage === 'mixed-listings' ? 'active' : ''}`}
                    onClick={() => onNavigate('mixed-listings')}
                >
                    📋 Listados
                </button>
                <button
                    className={`nav-item ${currentPage === 'camera' ? 'active' : ''}`}
                    onClick={() => onNavigate('camera')}
                >
                    📸 Cámara
                </button>
                <button
                    className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
                    onClick={() => onNavigate('settings')}
                >
                    ⚙️ Ajustes
                </button>
            </div>
            <div className="nav-right">
                <span className="user-email">{user?.email}</span>
                <button className="btn-logout" onClick={logout}>
                    🚪 Salir
                </button>
            </div>
        </nav>
    );
}

function CatalogList({ onSelectCatalog }: { onSelectCatalog: (id: number) => void }) {
    const { data, isLoading, error } = useCatalogs();
    const uploadMutation = useUploadCatalog();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (selectedFile) {
            try {
                await uploadMutation.mutateAsync(selectedFile);
                setSelectedFile(null);
                // Reset file input
                const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
                alert('¡Archivo subido exitosamente! Procesamiento iniciado.');
            } catch (err) {
                alert('Error al subir: ' + (err instanceof Error ? err.message : 'Error desconocido'));
            }
        }
    };

    if (isLoading) return <div className="loading">Cargando catálogos...</div>;
    if (error) return <div className="error">Error al cargar catálogos: {error.message}</div>;

    // Calculate stats
    const totalCatalogs = data?.catalogs.length || 0;
    const totalProducts = data?.catalogs.reduce((sum: number, c: any) => sum + (c.product_count || 0), 0) || 0;
    const completedCatalogs = data?.catalogs.filter((c: any) => c.status === 'completed').length || 0;
    const processingCatalogs = data?.catalogs.filter((c: any) => c.status === 'processing').length || 0;

    return (
        <div className="catalog-container">
            <h2>📚 Mis Catálogos</h2>

            {/* Stats Dashboard */}
            {totalCatalogs > 0 && (
                <div className="stats-dashboard">
                    <div className="stat-card">
                        <div className="stat-icon">📚</div>
                        <div className="stat-content">
                            <div className="stat-value">{totalCatalogs}</div>
                            <div className="stat-label">Catálogos</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">📦</div>
                        <div className="stat-content">
                            <div className="stat-value">{totalProducts.toLocaleString()}</div>
                            <div className="stat-label">Productos</div>
                        </div>
                    </div>
                    <div className="stat-card stat-success">
                        <div className="stat-icon">✅</div>
                        <div className="stat-content">
                            <div className="stat-value">{completedCatalogs}</div>
                            <div className="stat-label">Procesados</div>
                        </div>
                    </div>
                    {processingCatalogs > 0 && (
                        <div className="stat-card stat-processing">
                            <div className="stat-icon">⏳</div>
                            <div className="stat-content">
                                <div className="stat-value">{processingCatalogs}</div>
                                <div className="stat-label">En proceso</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Upload Section */}
            <div className="upload-section">
                <h3>Subir Nuevo Catálogo</h3>
                <div className="upload-controls">
                    <input
                        type="file"
                        accept=".pdf,.xlsx,.xls"
                        onChange={handleFileChange}
                        disabled={uploadMutation.isPending}
                    />
                    <button
                        onClick={handleUpload}
                        disabled={!selectedFile || uploadMutation.isPending}
                        className="btn-primary"
                    >
                        {uploadMutation.isPending ? 'Subiendo...' : 'Subir'}
                    </button>
                </div>
                {selectedFile && (
                    <p className="file-info">Seleccionado: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</p>
                )}
            </div>

            {/* Catalogs List */}
            <div className="catalogs-list">
                <h3>Catálogos Recientes</h3>
                {data && data.catalogs.length > 0 ? (
                    <div className="catalog-grid">
                        {data.catalogs.map((catalog) => (
                            <div
                                key={catalog.id}
                                className="catalog-card clickable"
                                onClick={() => onSelectCatalog(catalog.id)}
                            >
                                <div className="catalog-header">
                                    <h4>{catalog.name}</h4>
                                    <span className={`status status-${catalog.status}`}>
                                        {catalog.status}
                                    </span>
                                </div>
                                <div className="catalog-info">
                                    <p>📦 Productos: {catalog.product_count}</p>
                                    <p>📅 {new Date(catalog.created_at).toLocaleDateString()}</p>
                                </div>
                                <div className="catalog-click-hint">Click para ver productos →</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="empty-state">Aún no hay catálogos. ¡Sube tu primer catálogo arriba!</p>
                )}
            </div>
        </div>
    );
}

function MainApp() {
    const [currentPage, setCurrentPage] = useState<Page>('catalogs');
    const [selectedCatalogId, setSelectedCatalogId] = useState<number | undefined>(undefined);

    const handleSelectCatalog = (catalogId: number) => {
        setSelectedCatalogId(catalogId);
        setCurrentPage('products');
    };

    const handleNavigate = (page: Page) => {
        if (page !== 'products') {
            setSelectedCatalogId(undefined);  // Clear selection when leaving products
        }
        setCurrentPage(page);
    };

    return (
        <div className="app">
            <header className="app-header">
                <h1>🌈 IrisClassifier</h1>
                <p>Clasificación de Productos con IA</p>
            </header>

            <Navigation currentPage={currentPage} onNavigate={handleNavigate} />

            <main className="app-main">
                {currentPage === 'catalogs' && <CatalogList onSelectCatalog={handleSelectCatalog} />}
                {currentPage === 'products' && <ProductsPage catalogId={selectedCatalogId} />}
                {currentPage === 'compare' && <ComparePage />}
                {currentPage === 'mixed-listings' && <MixedListingsPage />}
                {currentPage === 'camera' && <CameraPage />}
                {currentPage === 'settings' && <SettingsPage />}
            </main>

            <footer className="app-footer">
                <p>Desarrollado con React + Vite + Capacitor</p>
            </footer>
        </div>
    );
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <AuthGuard />
            </AuthProvider>
        </QueryClientProvider>
    );
}

function AuthGuard() {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner">⏳ Cargando...</div>
            </div>
        );
    }

    return isAuthenticated ? <MainApp /> : <LoginPage />;
}

export default App;
