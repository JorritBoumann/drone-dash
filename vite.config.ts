import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build --mode single` inlines every script/style into dist-single/index.html.
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    plugins: single ? [viteSingleFile({ removeViteModuleLoader: true })] : [],
    server: { host: '127.0.0.1', port: 5188, strictPort: true },
    preview: { host: '127.0.0.1', port: 4188, strictPort: true },
    build: {
      outDir: single ? 'dist-single' : 'dist',
      sourcemap: !single,
      chunkSizeWarningLimit: 900,
      assetsInlineLimit: single ? 100_000_000 : 4096,
    },
  };
});
