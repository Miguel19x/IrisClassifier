import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useState, useEffect } from 'react';
import './index.css';
import { LoginPage } from './pages/Login';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';

// Lazy load pages for better performance (as per PERFORMANCE_TUNING.md)
const ListsManagerPage = lazy(() => import('./pages/ListsManager').then(m => ({ default: m.ListsManagerPage })));
const ProductsPage = lazy(() => import('./pages/Products').then(m => ({ default: m.ProductsPage })));
const ListingsManagementPage = lazy(() => import('./pages/ListingsManagement').then(m => ({ default: m.ListingsManagementPage })));

// Create a client with optimized cache settings (as per PERFORMANCE_TUNING.md)
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
        },
    },
});

type Page = 'lists' | 'products' | 'management';

function LoadingSpinner() {
    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex items-center gap-3 text-muted-foreground">
                <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span>Cargando...</span>
            </div>
        </div>
    );
}

function MainApp() {
    const { user, logout } = useAuth();
    const [currentPage, setCurrentPage] = useState<Page>('lists');
    const [selectedListId, setSelectedListId] = useState<number | null>(null);

    // Listen for list selection events from Products page
    useEffect(() => {
        const handleSelectList = (event: CustomEvent<number>) => {
            setSelectedListId(event.detail);
        };
        window.addEventListener('selectList', handleSelectList as EventListener);
        return () => window.removeEventListener('selectList', handleSelectList as EventListener);
    }, []);

    const handleSelectList = (listId: number) => {
        setSelectedListId(listId);
        setCurrentPage('products');
    };

    const handleNavigate = (page: Page) => {
        if (page !== 'products') {
            setSelectedListId(null);  // Clear selection when leaving products
        }
        setCurrentPage(page);
    };

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Header
                userEmail={user?.email}
                currentPage={currentPage}
                onNavigate={handleNavigate}
                onLogout={logout}
            />

            <main className="flex-1 pt-16">
                <Suspense fallback={<LoadingSpinner />}>
                    {currentPage === 'lists' && <ListsManagerPage onSelectList={handleSelectList} />}
                    {currentPage === 'products' && <ProductsPage selectedListId={selectedListId} />}
                    {currentPage === 'management' && <ListingsManagementPage />}
                </Suspense>
            </main>

            <Footer />
        </div>
    );
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                <AuthProvider>
                    <AuthGuard />
                    <Toaster richColors position="top-right" />
                </AuthProvider>
            </TooltipProvider>
        </QueryClientProvider>
    );
}

function AuthGuard() {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <p className="text-muted-foreground">Cargando...</p>
                </div>
            </div>
        );
    }

    return isAuthenticated ? <MainApp /> : <LoginPage />;
}

export default App;
