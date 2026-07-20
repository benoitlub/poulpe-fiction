import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  base: "/poulpe-fiction/",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), "index.html"),
        mobileV2: resolve(process.cwd(), "mobile-v2.html"),
      },
    },
  },
});
