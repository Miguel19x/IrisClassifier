import { useState } from "react";
import { Menu, X, LogOut, FileText, Package, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

type Page = 'lists' | 'products' | 'management';

const navItems: { page: Page; label: string; icon: typeof FileText }[] = [
    { page: "lists", label: "Listas", icon: FileText },
    { page: "products", label: "Productos", icon: Package },
    { page: "management", label: "Gestión Listados", icon: ClipboardList },
];

interface HeaderProps {
    userEmail?: string;
    currentPage: Page;
    onNavigate: (page: Page) => void;
    onLogout: () => void;
}

export function Header({ userEmail = "usuario@ejemplo.com", currentPage, onNavigate, onLogout }: HeaderProps) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 backdrop-blur-xl bg-background/80">
            <div className="container mx-auto px-4">
                <div className="flex h-16 items-center justify-between">
                    {/* Logo */}
                    <button onClick={() => onNavigate('lists')} className="flex items-center gap-2 sm:gap-3 group">
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
                            <div className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                                <span className="text-primary-foreground font-display font-bold text-base sm:text-lg">IC</span>
                            </div>
                        </div>
                        <div>
                            <h1 className="font-display font-bold text-base sm:text-lg text-foreground text-left">IrisClassifier</h1>
                            <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Clasificación de Productos con IA</p>
                        </div>
                    </button>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navItems.map((item) => {
                            const isActive = currentPage === item.page;
                            const Icon = item.icon;

                            return (
                                <button
                                    key={item.page}
                                    onClick={() => onNavigate(item.page)}
                                    className={cn(
                                        "relative flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
                                        isActive
                                            ? "text-foreground"
                                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                    )}
                                >
                                    {isActive && (
                                        <div
                                            className="absolute inset-0 bg-secondary rounded-lg transition-all duration-300"
                                        />
                                    )}
                                    <Icon className="relative z-10 h-4 w-4" />
                                    <span className="relative z-10 font-medium text-sm">{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>

                    {/* User section */}
                    <div className="hidden md:flex items-center gap-3">
                        <ThemeToggle />
                        <span className="text-sm text-muted-foreground truncate max-w-[150px]">{userEmail}</span>
                        <Button variant="ghost" size="sm" onClick={onLogout} className="gap-2">
                            <LogOut className="h-4 w-4" />
                            Salir
                        </Button>
                    </div>

                    {/* Mobile menu button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </Button>
                </div>
            </div>

            {/* Mobile Navigation */}
            <div
                className={cn(
                    "md:hidden overflow-hidden border-t border-border/50 transition-all duration-300",
                    isMobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                )}
            >
                <nav className="container mx-auto px-4 py-4 flex flex-col gap-2">
                    {navItems.map((item) => {
                        const isActive = currentPage === item.page;
                        const Icon = item.icon;

                        return (
                            <button
                                key={item.page}
                                onClick={() => {
                                    onNavigate(item.page);
                                    setIsMobileMenuOpen(false);
                                }}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 text-left cursor-pointer",
                                    isActive
                                        ? "bg-secondary text-foreground"
                                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                )}
                            >
                                <Icon className="h-5 w-5" />
                                <span className="font-medium">{item.label}</span>
                            </button>
                        );
                    })}
                    <div className="border-t border-border/50 pt-4 mt-2 space-y-2">
                        <div className="flex items-center justify-between px-4">
                            <p className="text-sm text-muted-foreground truncate">{userEmail}</p>
                            <ThemeToggle />
                        </div>
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-3"
                            onClick={() => {
                                setIsMobileMenuOpen(false);
                                onLogout();
                            }}
                        >
                            <LogOut className="h-5 w-5" />
                            Cerrar Sesión
                        </Button>
                    </div>
                </nav>
            </div>
        </header>
    );
}
