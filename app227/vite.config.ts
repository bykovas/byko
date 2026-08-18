import { defineConfig } from "vite";

/* The client builds into dist/client, which wrangler serves as static
   assets (see [assets] in wrangler.toml). public/ is copied verbatim —
   that is how /.well-known/farcaster.json ships. */
export default defineConfig({
  publicDir: "public",
  build: { outDir: "dist/client", emptyOutDir: true },
});
