/**
 * Capacitor Preferences wrapper for token storage.
 * 
 * Provides secure storage for JWT tokens and user preferences.
 */
import { Preferences } from '@capacitor/preferences';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

export const storage = {
    /**
     * Save JWT token to secure storage.
     */
    async setToken(token: string): Promise<void> {
        await Preferences.set({
            key: TOKEN_KEY,
            value: token,
        });
    },

    /**
     * Get JWT token from storage.
     */
    async getToken(): Promise<string | null> {
        const { value } = await Preferences.get({ key: TOKEN_KEY });
        return value;
    },

    /**
     * Remove JWT token from storage.
     */
    async removeToken(): Promise<void> {
        await Preferences.remove({ key: TOKEN_KEY });
    },

    /**
     * Save user data to storage.
     */
    async setUser(user: any): Promise<void> {
        await Preferences.set({
            key: USER_KEY,
            value: JSON.stringify(user),
        });
    },

    /**
     * Get user data from storage.
     */
    async getUser(): Promise<any | null> {
        const { value } = await Preferences.get({ key: USER_KEY });
        return value ? JSON.parse(value) : null;
    },

    /**
     * Remove user data from storage.
     */
    async removeUser(): Promise<void> {
        await Preferences.remove({ key: USER_KEY });
    },

    /**
     * Clear all auth data.
     */
    async clearAuth(): Promise<void> {
        await this.removeToken();
        await this.removeUser();
    },
};
