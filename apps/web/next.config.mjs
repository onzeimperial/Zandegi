/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages are consumed as raw TypeScript source. The list matches
  // the app's import graph: it imports `@zandegi/api` and `@zandegi/core`, and
  // the server-side route pulls `@zandegi/ai` in transitively through the API
  // use case. The app itself never imports `@zandegi/ai` (AD-2, enforced by
  // the boundary rule in eslint.config.js).
  transpilePackages: ["@zandegi/core", "@zandegi/api", "@zandegi/ai"],
};

export default nextConfig;
