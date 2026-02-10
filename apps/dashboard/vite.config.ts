import path from "node:path"
import { defineConfig, type PluginOption } from "vite"
import type { IncomingMessage, ServerResponse } from "node:http"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

function authRedirect(): PluginOption {
  return {
    name: "auth-redirect",
    configureServer(server) {
      server.middlewares.use(
        (req: IncomingMessage, _res: ServerResponse, next: () => void) => {
          if (req.url === "/auth") {
            req.url = "/auth/"
          }
          next()
        },
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), authRedirect()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    proxy: {
      "/auth": {
        target: "http://localhost:5174",
        changeOrigin: true,
      },
    },
  },
})
