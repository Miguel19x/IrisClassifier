import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFilesystem } from './useFilesystem';
import { Filesystem, Directory } from '@capacitor/filesystem';

// Mock the Capacitor Filesystem plugin
vi.mock('@capacitor/filesystem', () => ({
    Filesystem: {
        writeFile: vi.fn(),
        readFile: vi.fn(),
        deleteFile: vi.fn(),
        mkdir: vi.fn(),
        readdir: vi.fn(),
    },
    Directory: {
        Data: 'DATA',
        Documents: 'DOCUMENTS',
    },
}));

describe('useFilesystem', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('writeFile', () => {
        it('should write file successfully', async () => {
            vi.mocked(Filesystem.writeFile).mockResolvedValue({ uri: 'file://test.txt' });

            const { result } = renderHook(() => useFilesystem());

            let writeResult: any;
            await act(async () => {
                writeResult = await result.current.writeFile('test.txt', 'Hello World');
            });

            expect(Filesystem.writeFile).toHaveBeenCalledWith({
                path: 'test.txt',
                data: 'Hello World',
                directory: Directory.Data,
                encoding: expect.anything(),
            });
            expect(writeResult).toBe(true);
        });

        it('should handle write error', async () => {
            const mockError = new Error('Write failed');
            vi.mocked(Filesystem.writeFile).mockRejectedValue(mockError);

            const { result } = renderHook(() => useFilesystem());

            let writeResult: any;
            await act(async () => {
                writeResult = await result.current.writeFile('test.txt', 'Hello World');
            });

            expect(writeResult).toBe(false);
        });
    });

    describe('readFile', () => {
        it('should read file successfully', async () => {
            vi.mocked(Filesystem.readFile).mockResolvedValue({ data: 'File contents' });

            const { result } = renderHook(() => useFilesystem());

            let fileData: any;
            await act(async () => {
                fileData = await result.current.readFile('test.txt');
            });

            expect(Filesystem.readFile).toHaveBeenCalledWith({
                path: 'test.txt',
                directory: Directory.Data,
                encoding: expect.anything(),
            });
            expect(fileData).toBe('File contents');
        });

        it('should return null on read error', async () => {
            const mockError = new Error('File not found');
            vi.mocked(Filesystem.readFile).mockRejectedValue(mockError);

            const { result } = renderHook(() => useFilesystem());

            let fileData: any;
            await act(async () => {
                fileData = await result.current.readFile('nonexistent.txt');
            });

            expect(fileData).toBeNull();
        });
    });

    describe('deleteFile', () => {
        it('should delete file successfully', async () => {
            vi.mocked(Filesystem.deleteFile).mockResolvedValue(undefined);

            const { result } = renderHook(() => useFilesystem());

            let deleteResult: any;
            await act(async () => {
                deleteResult = await result.current.deleteFile('test.txt');
            });

            expect(Filesystem.deleteFile).toHaveBeenCalledWith({
                path: 'test.txt',
                directory: Directory.Data,
            });
            expect(deleteResult).toBe(true);
        });

        it('should handle delete error', async () => {
            const mockError = new Error('Delete failed');
            vi.mocked(Filesystem.deleteFile).mockRejectedValue(mockError);

            const { result } = renderHook(() => useFilesystem());

            let deleteResult: any;
            await act(async () => {
                deleteResult = await result.current.deleteFile('test.txt');
            });

            expect(deleteResult).toBe(false);
        });
    });

    describe('createDirectory', () => {
        it('should create directory successfully', async () => {
            vi.mocked(Filesystem.mkdir).mockResolvedValue(undefined);

            const { result } = renderHook(() => useFilesystem());

            let mkdirResult: any;
            await act(async () => {
                mkdirResult = await result.current.createDirectory('testdir');
            });

            expect(Filesystem.mkdir).toHaveBeenCalledWith({
                path: 'testdir',
                directory: Directory.Data,
                recursive: true,
            });
            expect(mkdirResult).toBe(true);
        });

        it('should handle mkdir error', async () => {
            const mockError = new Error('Mkdir failed');
            vi.mocked(Filesystem.mkdir).mockRejectedValue(mockError);

            const { result } = renderHook(() => useFilesystem());

            let mkdirResult: any;
            await act(async () => {
                mkdirResult = await result.current.createDirectory('testdir');
            });

            expect(mkdirResult).toBe(false);
        });
    });

    describe('listFiles', () => {
        it('should list files successfully', async () => {
            const mockFiles = {
                files: [
                    { name: 'file1.txt', type: 'file', size: 100, mtime: 123456789 },
                    { name: 'file2.txt', type: 'file', size: 200, mtime: 123456790 },
                ],
            };
            vi.mocked(Filesystem.readdir).mockResolvedValue(mockFiles as any);

            const { result } = renderHook(() => useFilesystem());

            let files: any;
            await act(async () => {
                files = await result.current.listFiles('testdir');
            });

            expect(Filesystem.readdir).toHaveBeenCalledWith({
                path: 'testdir',
                directory: Directory.Data,
            });
            expect(files).toEqual(mockFiles.files);
        });

        it('should return empty array on error', async () => {
            const mockError = new Error('Directory not found');
            vi.mocked(Filesystem.readdir).mockRejectedValue(mockError);

            const { result } = renderHook(() => useFilesystem());

            let files: any;
            await act(async () => {
                files = await result.current.listFiles('nonexistent');
            });

            expect(files).toEqual([]);
        });
    });
});
