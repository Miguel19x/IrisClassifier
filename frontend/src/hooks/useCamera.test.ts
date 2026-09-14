import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCamera } from './useCamera';
import { Camera } from '@capacitor/camera';

// Mock the Capacitor Camera plugin
vi.mock('@capacitor/camera', () => ({
    Camera: {
        getPhoto: vi.fn(),
        checkPermissions: vi.fn(),
        requestPermissions: vi.fn(),
    },
    CameraResultType: {
        DataUrl: 'dataUrl',
        Base64: 'base64',
        Uri: 'uri',
    },
    CameraSource: {
        Camera: 'CAMERA',
        Photos: 'PHOTOS',
        Prompt: 'PROMPT',
    },
}));

describe('useCamera', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize with null photo', () => {
        const { result } = renderHook(() => useCamera());

        expect(result.current.photo).toBeNull();
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('should capture photo successfully', async () => {
        const mockPhoto = {
            dataUrl: 'data:image/jpeg;base64,mockImageData',
            format: 'jpeg',
            saved: false,
        };

        vi.mocked(Camera.getPhoto).mockResolvedValue(mockPhoto as any);

        const { result } = renderHook(() => useCamera());

        await act(async () => {
            await result.current.takePhoto();
        });

        expect(Camera.getPhoto).toHaveBeenCalledWith({
            quality: 90,
            allowEditing: false,
            resultType: expect.anything(),
            source: expect.anything(),
        });
        expect(result.current.photo).toBe(mockPhoto.dataUrl);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('should handle photo capture error', async () => {
        const mockError = new Error('Camera permission denied');
        vi.mocked(Camera.getPhoto).mockRejectedValue(mockError);

        const { result } = renderHook(() => useCamera());

        await act(async () => {
            await result.current.takePhoto();
        });

        expect(result.current.photo).toBeNull();
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe('Camera permission denied');
    });

    it('should set loading state during photo capture', async () => {
        let resolvePhoto: any;
        const photoPromise = new Promise((resolve) => {
            resolvePhoto = resolve;
        });

        vi.mocked(Camera.getPhoto).mockReturnValue(photoPromise as any);

        const { result } = renderHook(() => useCamera());

        act(() => {
            result.current.takePhoto();
        });

        // Should be loading
        expect(result.current.loading).toBe(true);

        // Resolve the promise
        await act(async () => {
            resolvePhoto({
                dataUrl: 'data:image/jpeg;base64,test',
                format: 'jpeg',
                saved: false,
            });
            await photoPromise;
        });

        // Should no longer be loading
        expect(result.current.loading).toBe(false);
    });

    it('should clear photo', () => {
        const { result } = renderHook(() => useCamera());

        // Set a photo first
        act(() => {
            (result.current as any).setPhoto('data:image/jpeg;base64,test');
        });

        // Clear it
        act(() => {
            result.current.clearPhoto();
        });

        expect(result.current.photo).toBeNull();
        expect(result.current.error).toBeNull();
    });
});
