import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every screen runs in the browser, so the site is exported as plain static files (out/).
  // Any static host can serve it; there is no server process to keep alive overnight.
  output: "export",
  // cacheComponents is off on purpose: it keeps the previous screen alive, hidden, with its old state.
  // Every screen here must re-read device storage when it opens.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
