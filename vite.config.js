import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['buffer', 'bip39'],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          buffer: true,
          process: true,
          crypto: true
        }),
        NodeModulesPolyfillPlugin()
      ]
    }
  },
  build: {
    rollupOptions: {
      plugins: []
    }
  },
  resolve: {
    alias: {
      buffer: 'buffer/',
      process: 'process/browser',
      stream: 'stream-browserify',
      crypto: 'crypto-browserify'
    }
  },
  define: {
    'process.env': {},
    global: 'globalThis',
    'process.browser': true
  }
})
