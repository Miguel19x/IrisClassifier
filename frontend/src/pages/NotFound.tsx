/**
 * Página 404 - No Encontrada.
 * 
 * Diseño premium con animaciones.
 */
import { Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NotFoundProps {
    onNavigateHome: () => void;
}

export function NotFoundPage({ onNavigateHome }: NotFoundProps) {
    return (
        <div className="min-h-[70vh] flex items-center justify-center px-4">
            <div className="text-center animate-slide-up">
                <div
                    className="text-8xl font-display font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-4 animate-scale-in"
                    style={{ animationDelay: '0.2s' }}
                >
                    404
                </div>
                <h1 className="text-2xl font-display font-bold text-foreground mb-2">
                    Página no encontrada
                </h1>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                    Lo sentimos, la página que buscas no existe o ha sido movida.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button variant="outline" onClick={onNavigateHome} className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Volver atrás
                    </Button>
                    <Button variant="premium" onClick={onNavigateHome} className="gap-2">
                        <Home className="h-4 w-4" />
                        Ir al inicio
                    </Button>
                </div>
            </div>
        </div>
    );
}
