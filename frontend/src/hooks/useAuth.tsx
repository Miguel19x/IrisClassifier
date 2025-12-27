/**
 * Authentication hook and context.
 * 
 * Provides auth state and methods throughout the app.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as authService from '../services/auth';
import type { User, LoginCredentials, RegisterData } from '../services/auth';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (credentials: LoginCredentials) => Promise<void>;
    register: (data: RegisterData) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check authentication on mount
    useEffect(() => {
        checkAuth();
    }, []);

    async function checkAuth() {
        setIsLoading(true);
        try {
            const isAuth = await authService.isAuthenticated();
            if (isAuth) {
                const currentUser = await authService.getCurrentUser();
                setUser(currentUser);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }

    async function login(credentials: LoginCredentials) {
        setIsLoading(true);
        try {
            const user = await authService.login(credentials);
            setUser(user);
        } finally {
            setIsLoading(false);
        }
    }

    async function register(data: RegisterData) {
        setIsLoading(true);
        try {
            const user = await authService.register(data);
            setUser(user);
        } finally {
            setIsLoading(false);
        }
    }

    async function logout() {
        setIsLoading(true);
        try {
            await authService.logout();
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }

    const value: AuthContextType = {
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
