import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
    plugins: [react(), basicSsl()],
    server: {
        host: '0.0.0.0',
        port: 3000,
        https: true,
        proxy: {
            '/api': {
                target: 'http://192.168.1.189:5000',
                changeOrigin: true,
                secure: false,
            },
            '/uploads': {
                target: 'http://192.168.1.189:5000',
                changeOrigin: true,
                secure: false,
            },
            '/socket.io': {
                target: 'http://192.168.88.151:5000',
                ws: true,
                changeOrigin: true,
                secure: false,
            }
        }
    }
});
