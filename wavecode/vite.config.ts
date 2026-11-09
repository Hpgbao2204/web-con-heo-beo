import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // API chạy bằng Vercel Functions (thư mục api/); local dùng `vercel dev`.
  // HTTPS=1 để bật cert tự ký khi cần thử camera qua IP LAN.
  const https = env.HTTPS === '1';

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(https ? [basicSsl({ name: 'wavecode-dev' })] : []),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'WaveCode – Quét sóng âm',
          short_name: 'WaveCode',
          description: 'Quét mã sóng âm để nghe nhạc',
          lang: 'vi',
          start_url: '/scan',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#0b0b12',
          theme_color: '#0b0b12',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // chỉ cache app shell; API và file nhạc luôn lấy từ mạng
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/media\//],
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        },
        devOptions: { enabled: true, type: 'module', navigateFallback: 'index.html' },
      }),
    ],
    // local: /api → scripts/dev-api.ts (chạy handler của Vercel Functions)
    server: { host: true, allowedHosts: ['.trycloudflare.com'], proxy: { '/api': 'http://localhost:3301' } },
    test: { include: ['tests/**/*.test.ts'], testTimeout: 60_000 },
  };
});
