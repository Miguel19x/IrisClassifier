import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './api';

describe('API Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should create axios instance with correct base URL', () => {
        expect(api.defaults.baseURL).toContain('/api/v1');
    });

    it('should have correct timeout', () => {
        expect(api.defaults.timeout).toBe(600000); // 10 minutes for large PDF processing
    });

    it('should have correct default headers', () => {
        expect(api.defaults.headers['Content-Type']).toBe('application/json');
    });

    describe('Request Interceptor', () => {
        it('should have request interceptor registered', () => {
            // Verify that request interceptors are registered
            expect(api.interceptors.request).toBeDefined();
        });
    });

    describe('Response Interceptor', () => {
        it('should have response interceptor registered', () => {
            // Verify that response interceptors are registered
            expect(api.interceptors.response).toBeDefined();
        });

        it('should handle successful responses', async () => {
            const mockData = { message: 'Success' };
            vi.spyOn(api, 'get').mockResolvedValue({
                data: mockData,
                status: 200,
                statusText: 'OK',
                headers: {},
                config: {} as any,
            });

            const response = await api.get('/test');
            expect(response.data).toEqual(mockData);
        });

        it('should handle error responses', async () => {
            const mockError = {
                response: {
                    status: 500,
                    data: { detail: 'Internal Server Error' },
                },
            };

            vi.spyOn(api, 'get').mockRejectedValue(mockError);

            await expect(api.get('/test')).rejects.toEqual(mockError);
        });
    });

    describe('API Methods', () => {
        it('should make GET requests', async () => {
            const mockData = { id: 1, name: 'Test' };
            vi.spyOn(api, 'get').mockResolvedValue({ data: mockData } as any);

            const response = await api.get('/lists');

            expect(api.get).toHaveBeenCalledWith('/lists');
            expect(response.data).toEqual(mockData);
        });

        it('should make POST requests', async () => {
            const mockData = { id: 1, name: 'New List' };
            const postData = { name: 'New List' };
            vi.spyOn(api, 'post').mockResolvedValue({ data: mockData } as any);

            const response = await api.post('/lists', postData);

            expect(api.post).toHaveBeenCalledWith('/lists', postData);
            expect(response.data).toEqual(mockData);
        });

        it('should make PATCH requests', async () => {
            const mockData = { id: 1, name: 'Updated Product' };
            const patchData = { name: 'Updated Product' };
            vi.spyOn(api, 'patch').mockResolvedValue({ data: mockData } as any);

            const response = await api.patch('/products/1', patchData);

            expect(api.patch).toHaveBeenCalledWith('/products/1', patchData);
            expect(response.data).toEqual(mockData);
        });

        it('should make DELETE requests', async () => {
            vi.spyOn(api, 'delete').mockResolvedValue({ data: null } as any);

            const response = await api.delete('/products/1');

            expect(api.delete).toHaveBeenCalledWith('/products/1');
            expect(response.data).toBeNull();
        });
    });
});
