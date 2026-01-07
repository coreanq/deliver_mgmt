import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
var getBuildDate = function () {
    var now = new Date();
    var yy = String(now.getFullYear()).slice(-2);
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var dd = String(now.getDate()).padStart(2, '0');
    var hh = String(now.getHours()).padStart(2, '0');
    var min = String(now.getMinutes()).padStart(2, '0');
    return "".concat(yy, "/").concat(mm, "/").concat(dd, " ").concat(hh, ":").concat(min);
};
export default defineConfig({
    plugins: [react()],
    define: {
        __WEB_BUILD_DATE__: JSON.stringify(getBuildDate()),
        __WEB_VERSION__: JSON.stringify('1.0.0'),
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
        minify: 'esbuild',
    },
    server: {
        port: 3000,
        proxy: {
            '/api': {
                target: 'http://localhost:8787',
                changeOrigin: true,
            },
        },
    },
});
