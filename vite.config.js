import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  root: '.',
  publicDir: 'assets',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      // script.js はここに書かない。
      // 各 HTML が <script type="module" src="/script.js"> で読んでおり、
      // vite が HTML を見て自動で束ねてくれる。ここへ入口として足すと、
      // HTML と結び付かない孤立した束が別にできあがり、ページ側の
      // <script> の差し替えが行われない。その結果、配信物の index.html
      // から script.js が丸ごと落ち、サイトの JS が一切動かなくなる
      //（スクロールの演出が出ず、loading="lazy" の写真が永久に読み込まれない）。
      input: {
        index: 'index.html',
        privacy: 'privacy.html',
        terms: 'terms.html',
        notfound: '404.html',
      },
    },
    cssCodeSplit: true,
    modulePreload: {
      polyfill: true,
    },
  },
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11'],
      additionalLegacyPolyfills: ['regenerator-runtime'],
    }),
  ],
  server: {
    port: 3000,
    open: true,
  },
});
