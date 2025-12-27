/**
 * API client configuration.
 * 
 * Provides axios instance with base URL and interceptors.
 */
import axios from 'axios';
import { storage } from './storage';

// Get API URL from environment variable
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Create axios instance
export const api = axios.create({
    baseURL: `${API_URL}/api/v1`,
    timeout: 600000, // 10 minutes for large PDF processing with rate limiting
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(
    async (config) => {
        // Get JWT token from Capacitor Preferences
        const token = await storage.getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            // Server responded with error
            // Log to console only in development
            if (import.meta.env.DEV) {
                console.error('API Error:', error.response.data);
            }

            if (error.response.status === 401) {
                // Unauthorized - redirect to login
                // TODO: Implement auth redirect
            }
        } else if (error.request) {
            // Request made but no response (network error)
            if (import.meta.env.DEV) {
                console.error('Network Error:', error.message);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
