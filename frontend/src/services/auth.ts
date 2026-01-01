/**
 * Authentication service.
 * 
 * Handles login, register, logout, and user management.
 */
import { api } from './api';
import { storage } from './storage';

// Check if running in mock mode
const MOCK_MODE = import.meta.env.VITE_MOCK_API === 'true';

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterData {
    email: string;
    password: string;
}

export interface User {
    id: number;
    email: string;
    is_active: boolean;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
}

/**
 * Login user and save token.
 */
export async function login(credentials: LoginCredentials): Promise<User> {
    // Mock mode: simulate login without API
    if (MOCK_MODE) {
        const mockUser: User = {
            id: 1,
            email: credentials.email,
            is_active: true,
        };

        await storage.setToken('mock-token-' + Date.now());
        await storage.setUser(mockUser);

        return mockUser;
    }

    // Real API mode
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    const { access_token } = response.data;

    // Save token to storage
    await storage.setToken(access_token);

    // Fetch and return user data
    const user = await getCurrentUser();
    await storage.setUser(user);

    return user;
}

/**
 * Register new user and auto-login.
 */
export async function register(data: RegisterData): Promise<User> {
    // Mock mode: simulate registration
    if (MOCK_MODE) {
        return login(data);
    }

    // Real API mode
    // Register user
    await api.post<User>('/auth/register', data);

    // Auto-login after registration
    return login(data);
}

/**
 * Logout user and clear storage.
 */
export async function logout(): Promise<void> {
    await storage.clearAuth();
}

/**
 * Get current authenticated user.
 */
export async function getCurrentUser(): Promise<User> {
    // Mock mode: return user from storage
    if (MOCK_MODE) {
        const user = await storage.getUser();
        if (user) return user;

        // Return default mock user if not in storage
        return {
            id: 1,
            email: 'demo@example.com',
            is_active: true,
        };
    }

    // Real API mode
    const response = await api.get<User>('/auth/me');
    return response.data;
}

/**
 * Check if user is authenticated.
 */
export async function isAuthenticated(): Promise<boolean> {
    const token = await storage.getToken();
    if (!token) return false;

    // Mock mode: always authenticated if token exists
    if (MOCK_MODE) {
        return true;
    }

    // Real API mode
    try {
        await getCurrentUser();
        return true;
    } catch {
        // Token invalid or expired
        await storage.clearAuth();
        return false;
    }
}
