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
      // round 34: three.js in its own vendor chunk (cached across game updates), the post-processing passes in a second
      // one; both load in parallel with the game code. The street assets and lil-gui stay lazy (dynamic imports).
      rolldownOptions: single ? {} : {
        output: {
          codeSplitting: {
            groups: [
              { name: 'three', test: /[\\/]node_modules[\\/]three[\\/]build[\\/]/, priority: 20 },
              { name: 'three-post', test: /[\\/]node_modules[\\/]three[\\/]examples[\\/]jsm[\\/](postprocessing|shaders)[\\/]/, priority: 10 },
            ],
          },
        },
      },
    },
  };
});
