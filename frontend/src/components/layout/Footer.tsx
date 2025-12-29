import { Heart } from "lucide-react";

export function Footer() {
    return (
        <footer className="border-t border-border/50 bg-background/80 backdrop-blur-sm">
            <div className="container mx-auto px-4 py-4">
                <p className="text-center text-sm text-muted-foreground flex items-center justify-center gap-1">
                    Desarrollado con
                    <Heart className="h-4 w-4 text-destructive fill-destructive animate-pulse" />
                    usando React + Vite + Capacitor
                </p>
            </div>
        </footer>
    );
}
