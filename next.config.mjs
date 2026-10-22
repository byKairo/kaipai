/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      // Keep editor previews and existing scripts working; this is not a complete script CSP.
      { key: 'Content-Security-Policy', value: "base-uri 'self'; object-src 'none'; frame-ancestors 'self'" },
    ] }];
  },
  outputFileTracingIncludes: { '/api/ai': ['./server/skills/**/*'], '/api/ai/image': ['./server/skills/**/*'], '/api/ai/design': ['./server/skills/**/*'] },
};
export default nextConfig;
