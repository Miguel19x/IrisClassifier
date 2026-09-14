import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        host: true, // Allow external connections for mobile testing
    },
    build: {
        outDir: 'dist',
        sourcemap: false, // Disable sourcemaps in production for smaller bundle
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true,
                pure_funcs: ['console.log', 'console.info'],
            },
        },
        rollupOptions: {
            output: {
                manualChunks: {
                    // Split vendor code for better caching
                    'vendor-react': ['react', 'react-dom'],
                    'vendor-query': ['@tanstack/react-query', '@tanstack/react-virtual'],
                    'vendor-ui': [
                        '@radix-ui/react-dialog',
                        '@radix-ui/react-select',
                        '@radix-ui/react-tabs',
                        '@radix-ui/react-checkbox',
                        '@radix-ui/react-switch',
                        '@radix-ui/react-avatar',
                        '@radix-ui/react-label',
                        '@radix-ui/react-progress',
                        '@radix-ui/react-scroll-area',
                        '@radix-ui/react-separator',
                        '@radix-ui/react-slot',
                        '@radix-ui/react-tooltip',
                    ],
                    'vendor-icons': ['lucide-react'],
                    'vendor-pdf': ['pdf-lib'],
                    'vendor-editor': [
                        '@tiptap/react',
                        '@tiptap/starter-kit',
                        '@tiptap/extension-text-align',
                        '@tiptap/extension-underline',
                    ],
                },
            },
        },
        chunkSizeWarningLimit: 1000, // Increase limit to 1000 kB
    },
    test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: './src/test/setup.ts',
    },
})
