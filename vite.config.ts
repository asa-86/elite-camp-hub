// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

const productionSiteUrl = loadEnv("production", process.cwd(), "VITE_")
  .VITE_SITE_URL?.trim()
  .replace(/\/$/, "");

export default defineConfig({
  // Publish static files only; the built site has no runtime Node/Nitro server.
  nitro: false,
  tanstackStart: {
    // SPA mode serves dashboard routes from a static shell. The public home route
    // is separately prerendered as /index.html for search and social crawlers.
    spa: {
      enabled: true,
      // Use an existing route to generate the shell; TanStack only renders the
      // root match while prerendering the shell, so this URL is just a mask.
      maskPath: "/login",
      prerender: { outputPath: "/_shell", crawlLinks: false },
    },
    pages: [
      {
        path: "/",
        prerender: {
          enabled: true,
          outputPath: "/index.html",
          crawlLinks: false,
        },
      },
    ],
    // A sitemap is emitted only when the production domain is configured.
    sitemap: productionSiteUrl
      ? { enabled: true, host: productionSiteUrl, outputPath: "sitemap.xml" }
      : { enabled: false },
    // Keep the custom server entry for build-time prerendering.
    server: { entry: "server" },
  },
});
