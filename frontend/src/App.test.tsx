import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

// Mock Capacitor Preferences
vi.mock('@capacitor/preferences', () => ({
    Preferences: {
        get: vi.fn().mockResolvedValue({ value: null }),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
    },
}));

describe('App Component', () => {
    it('should render without crashing', () => {
        render(<App />);
        expect(document.body).toBeTruthy();
    });

    it('should render the app title after initial auth check', async () => {
        render(<App />);
        await waitFor(() => {
            const titleElements = screen.getAllByText(/IrisClassifier/i);
            expect(titleElements.length).toBeGreaterThan(0);
        });
    });

    it('should render the container and auth form', async () => {
        const { container } = render(<App />);
        await waitFor(() => {
            expect(container.querySelector('form') || container.querySelector('main') || container.querySelector('.min-h-screen')).toBeTruthy();
        });
    });
});
