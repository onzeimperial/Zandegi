/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages are consumed as raw TypeScript source.
  transpilePackages: ["@zandegi/core", "@zandegi/ai"],
};

export default nextConfig;
