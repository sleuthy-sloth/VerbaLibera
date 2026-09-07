import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone server output is packaged into the Electron macOS edition.
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": ["./prisma/migrations/**/*", "./prisma/seed.ts"],
  },
  // Preserve old course bookmarks while keeping the public page static.
  async redirects() {
    return [{
      source: '/',
      has: [{ type: 'query', key: 'course' }],
      destination: '/dashboard',
      permanent: false,
    }];
  },
};

export default nextConfig;
