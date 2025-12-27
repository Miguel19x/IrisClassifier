import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import './App.css';
import { ProductsPage } from './pages/Products';
import { LoginPage } from './pages/Login';
import { CatalogsManagerPage } from './pages/CatalogsManager';
import { ToolsHubPage } from './pages/ToolsHub';
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

type Page = 'catalogs' | 'products' | 'tools';

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
                    className={`nav-item ${currentPage === 'tools' ? 'active' : ''}`}
                    onClick={() => onNavigate('tools')}
                >
                    🛠️ Herramientas
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

// CatalogList component removed - now using CatalogsManagerPage

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
                {currentPage === 'catalogs' && <CatalogsManagerPage onSelectCatalog={handleSelectCatalog} />}
                {currentPage === 'products' && <ProductsPage catalogId={selectedCatalogId} />}
                {currentPage === 'tools' && <ToolsHubPage />}
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
