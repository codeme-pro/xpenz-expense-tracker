import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
    server: {
        host: true,
        port: 3000,
        allowedHosts: ['xpenz-dev-local.skstech.xyz'],
    },
    resolve: { tsconfigPaths: true },
    plugins: [
        devtools(),
        tailwindcss(),
        tanstackRouter({ target: 'react', autoCodeSplitting: true }),
        viteReact(),
    ],
})

export default config
