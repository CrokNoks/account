import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Mes Comptes',
        short_name: 'Comptes',
        description: 'Gestion de comptes personnels',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'logo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    // Enable source maps for debugging
    sourcemap: true,
    
    // Optimize chunks for better caching
    rollupOptions: {
      output: {
        // Manual chunk splitting strategy
        manualChunks: {
          // React ecosystem
          'react-vendor': ['react', 'react-dom'],
          
          // React Admin ecosystem
          'ra-vendor': [
            'react-admin',
            'ra-i18n-polyglot',
            'ra-language-french',
            'ra-language-english',
            'ra-ui-materialui'
          ],
          
          // UI libraries
          'mui-vendor': [
            '@mui/material',
            '@mui/icons-material',
            '@emotion/react',
            '@emotion/styled'
          ],
          
          // Data and utilities
          'data-vendor': [
            '@tanstack/react-query',
            '@supabase/supabase-js',
            'ra-supabase'
          ],
          
          // Charts and visualization
          'chart-vendor': [
            'recharts'
          ],
          
          // Heavy utilities
          'utils-vendor': [
            'papaparse',
            'tesseract.js',
            '@tensorflow/tfjs'
          ],
          
          // Common utilities
          'common': [
            'lodash'
          ]
        },
        
        // Optimize chunk naming for better caching
        chunkFileNames: (chunkInfo) => {
          // Add hash for non-vendor chunks
          if (chunkInfo.name && !chunkInfo.name.includes('-vendor')) {
            return `assets/[name]-[hash].js`;
          }
          return 'assets/[name].js';
        },
        
        // Optimize asset naming
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'assets/css/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      },
      
      // Optimize bundle size
      treeshake: true,
      
    },
  },
  

  
  // Development server optimization
  server: {
    fs: {
      // Allow serving files from root
      allow: ['..']
    }
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@context': resolve(__dirname, 'src/context'),
      '@providers': resolve(__dirname, 'src/providers'),
      '@resources': resolve(__dirname, 'src/resources'),
    }
  },
  
  // CSS optimization
  css: {
    devSourcemap: true,
    
    // PostCSS configuration for optimization
    postcss: {
      plugins: [
        // Add autoprefixer for browser compatibility
        // Add cssnano for minification in production
      ]
    }
  },
  
  // Environment variables
  define: {
    // Remove env-specific code from bundles
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development')
  }
})