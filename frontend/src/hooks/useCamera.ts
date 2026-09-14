/**
 * Capacitor Camera hook.
 * 
 * Provides camera functionality for mobile devices.
 */
import { useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export function useCamera() {
    const [photo, setPhoto] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const takePhoto = async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await Camera.getPhoto({
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Camera,
                quality: 90,
                allowEditing: false,
            });

            setPhoto(result.dataUrl || null);
            setLoading(false);
            return result.dataUrl;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to take photo');
            setLoading(false);
            return null;
        }
    };

    const pickFromGallery = async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await Camera.getPhoto({
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Photos,
                quality: 90,
            });

            setPhoto(result.dataUrl || null);
            setLoading(false);
            return result.dataUrl;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to pick photo');
            setLoading(false);
            return null;
        }
    };

    const clearPhoto = () => {
        setPhoto(null);
        setError(null);
    };

    return {
        photo,
        setPhoto,
        takePhoto,
        pickFromGallery,
        clearPhoto,
        loading,
        error,
    };
}
