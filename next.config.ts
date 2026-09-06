import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
