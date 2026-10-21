/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { outputFileTracingIncludes: { '/api/ai': ['./server/skills/**/*'], '/api/ai/image': ['./server/skills/**/*'], '/api/ai/design': ['./server/skills/**/*'] } },
};
export default nextConfig;
