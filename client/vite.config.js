// client/vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'inject-csp',
        transformIndexHtml(html, ctx) {
          // Dev mode bypass: Vite HMR uses inline scripts and eval
          if (ctx.server) return html;

          const apiOrigin = env.VITE_API_ORIGIN || 'http://localhost:3001';
          const csp = [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            `connect-src 'self' ${apiOrigin}`,
            "img-src 'self' data:",
            "font-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; ');

          return html.replace(
            '<head>',
            `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`
          );
        },
      },
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
