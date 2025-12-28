import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import './App.css';
import { ProductsPage } from './pages/Products';
import { LoginPage } from './pages/Login';
import { ListsManagerPage } from './pages/ListsManager';
import { ListingsManagementPage } from './pages/ListingsManagement';
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

type Page = 'lists' | 'products' | 'management';

function Navigation({ currentPage, onNavigate }: { currentPage: Page; onNavigate: (page: Page) => void }) {
    const { user, logout } = useAuth();

    return (
        <nav className="navigation">
            <div className="nav-left">
                <button
                    className={`nav-item ${currentPage === 'lists' ? 'active' : ''}`}
                    onClick={() => onNavigate('lists')}
                >
                    📚 Listas
                </button>
                <button
                    className={`nav-item ${currentPage === 'products' ? 'active' : ''}`}
                    onClick={() => onNavigate('products')}
                >
                    📦 Productos
                </button>
                <button
                    className={`nav-item ${currentPage === 'management' ? 'active' : ''}`}
                    onClick={() => onNavigate('management')}
                >
                    📋 Gestión Listados
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

function MainApp() {
    const [currentPage, setCurrentPage] = useState<Page>('lists');
    const [selectedListId, setSelectedListId] = useState<number | undefined>(undefined);

    const handleSelectList = (listId: number) => {
        setSelectedListId(listId);
        setCurrentPage('products');
    };

    const handleNavigate = (page: Page) => {
        if (page !== 'products') {
            setSelectedListId(undefined);  // Clear selection when leaving products
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
                {currentPage === 'lists' && <ListsManagerPage onSelectList={handleSelectList} />}
                {currentPage === 'products' && <ProductsPage listId={selectedListId} />}
                {currentPage === 'management' && <ListingsManagementPage />}
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
