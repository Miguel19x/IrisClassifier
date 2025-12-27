import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Add global fetch mock
globalThis.fetch = vi.fn();
