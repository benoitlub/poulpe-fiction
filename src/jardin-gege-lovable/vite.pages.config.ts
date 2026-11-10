import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
  root: here,
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    outDir: fileURLToPath(new URL("../../dist-gege", import.meta.url)),
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL("./static.html", import.meta.url)) },
  },
});
