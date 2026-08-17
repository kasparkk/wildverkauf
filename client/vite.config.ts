import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import netlify from "@netlify/vite-plugin";

// `netlify dev` serves the functions and applies the redirects from
// netlify.toml, so no manual /api proxy is needed here.
export default defineConfig({
  plugins: [react(), netlify()],
});
