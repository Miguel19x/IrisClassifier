/**
 * Capacitor Filesystem hook.
 * 
 * Provides file storage functionality for offline catalogs.
 */
import { useState } from 'react';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export function useFilesystem() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const writeFile = async (filename: string, data: string) => {
        setLoading(true);
        setError(null);

        try {
            await Filesystem.writeFile({
                path: filename,
                data: data,
                directory: Directory.Data,
                encoding: Encoding.UTF8,
            });

            setLoading(false);
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to write file');
            setLoading(false);
            return false;
        }
    };

    const readFile = async (filename: string) => {
        setLoading(true);
        setError(null);

        try {
            const result = await Filesystem.readFile({
                path: filename,
                directory: Directory.Data,
                encoding: Encoding.UTF8,
            });

            setLoading(false);
            return result.data as string;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to read file');
            setLoading(false);
            return null;
        }
    };

    const deleteFile = async (filename: string) => {
        setLoading(true);
        setError(null);

        try {
            await Filesystem.deleteFile({
                path: filename,
                directory: Directory.Data,
            });

            setLoading(false);
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete file');
            setLoading(false);
            return false;
        }
    };

    const createDirectory = async (path: string) => {
        setLoading(true);
        setError(null);

        try {
            await Filesystem.mkdir({
                path: path,
                directory: Directory.Data,
                recursive: true,
            });

            setLoading(false);
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create directory');
            setLoading(false);
            return false;
        }
    };

    const listFiles = async (path: string = '') => {
        setLoading(true);
        setError(null);

        try {
            const result = await Filesystem.readdir({
                path: path,
                directory: Directory.Data,
            });

            setLoading(false);
            return result.files;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to list files');
            setLoading(false);
            return [];
        }
    };

    return {
        writeFile,
        readFile,
        deleteFile,
        createDirectory,
        listFiles,
        loading,
        error,
    };
}
