import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App Component', () => {
    it('should render without crashing', () => {
        render(<App />);
        expect(document.body).toBeTruthy();
    });

    it('should render the app title', () => {
        render(<App />);
        const titleElement = screen.getByText(/IrisClassifier/i);
        expect(titleElement).toBeInTheDocument();
    });

    it('should have main container', () => {
        const { container } = render(<App />);
        const mainElement = container.querySelector('main') || container.querySelector('.app');
        expect(mainElement).toBeTruthy();
    });
});
