import { type ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

type Page = 'lists' | 'products' | 'management';

interface AppLayoutProps {
    children: ReactNode;
    userEmail?: string;
    currentPage: Page;
    onNavigate: (page: Page) => void;
    onLogout: () => void;
}

export function AppLayout({ children, userEmail, currentPage, onNavigate, onLogout }: AppLayoutProps) {
    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Header userEmail={userEmail} currentPage={currentPage} onNavigate={onNavigate} onLogout={onLogout} />
            <main className="flex-1 pt-16">
                {children}
            </main>
            <Footer />
        </div>
    );
}
