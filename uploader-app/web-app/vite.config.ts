import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { viteEnvs } from 'vite-envs'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({}),
    react(),
    viteEnvs({ declarationFile: 'env.declaration' }),
    tailwindcss()
  ]
})
