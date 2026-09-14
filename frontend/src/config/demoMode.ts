/**
 * Demo Mode configuration and utilities for IrisClassifier / MegaAutoPartes.
 * 
 * Enables a 100% interactive, self-contained demonstration for Vercel, Netlify,
 * or any web preview environment without requiring an active Python backend.
 */

const STORAGE_DEMO_KEY = 'iris_demo_mode_active';

export function isDemoMode(): boolean {
    // 1. If user explicitly toggled demo mode in UI or localStorage
    try {
        const stored = localStorage.getItem(STORAGE_DEMO_KEY);
        if (stored !== null) {
            return stored === 'true';
        }
    } catch {
        // Fallback if localStorage is inaccessible
    }

    // 2. Explicit environment variables (e.g. set in vercel.json or .env)
    if (
        import.meta.env.VITE_MOCK_API === 'true' ||
        import.meta.env.VITE_DEMO_MODE === 'true'
    ) {
        return true;
    }

    // 3. Automatic detection when hosted on cloud platforms like Vercel or Netlify
    if (typeof window !== 'undefined') {
        const host = window.location.hostname;
        if (
            host.includes('vercel.app') ||
            host.includes('netlify.app') ||
            host.includes('github.io')
        ) {
            return true;
        }
    }

    return false;
}

export function setDemoMode(enabled: boolean): void {
    try {
        localStorage.setItem(STORAGE_DEMO_KEY, enabled ? 'true' : 'false');
    } catch (e) {
        console.error('Failed to set demo mode flag:', e);
    }
    window.location.reload();
}
