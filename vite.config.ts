import { readFileSync } from 'node:fs'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `--mode single` builds one self-contained HTML file that opens by double-click (file://).
// Its JS is inlined, so the CSP must allow inline scripts there; nothing else is loosened.
const singleCsp: Plugin = {
  name: 'single-file-csp',
  transformIndexHtml: (html) =>
    html
      .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
      .replace(/\s*<link rel="(manifest|apple-touch-icon)"[^>]*>/g, '')
      .replace('href="./favicon.svg"', `href="data:image/svg+xml,${encodeURIComponent(readFileSync('public/favicon.svg', 'utf8'))}"`),
}

export default defineConfig(({ mode }) => ({
  // base './' so the build works from any sub-path or folder
  base: './',
  plugins: mode === 'single' ? [svelte(), viteSingleFile(), singleCsp] : [svelte()],
  build: mode === 'single' ? { outDir: 'dist-single' } : {},
}))
