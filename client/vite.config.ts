import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// @types/node isn't a dependency; declare just the sliver of `process` this
// config reads so tsc can type-check it without pulling in Node types.
declare const process: { env: Record<string, string | undefined> };

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    // Docker-on-Mac bind mounts do not deliver filesystem events into the
    // container, so Vite's watcher never sees edits — the dev server keeps
    // serving a stale module graph and HMR never fires. Poll instead.
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: {
      // The HMR websocket server binds to this port INSIDE the container;
      // docker-compose maps the host CLIENT_HMR_PORT onto container 3010.
      port: 3010,
      // The browser runs on the host, so it must connect to the published
      // host port (CLIENT_HMR_PORT), not the container-internal one.
      clientPort: Number(process.env.VITE_HMR_PORT) || 3010,
    },
  },
});
