import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  preview: {
    allowedHosts: true,
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
  },
})
