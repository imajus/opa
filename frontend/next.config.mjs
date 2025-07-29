/** @type {import('next').NextConfig} */
const nextConfig = {
  //transpilePackages: ['opa-builder'],
  experimental: {
    esmExternals: true,
  },
  // turbopack: {
  //   // Set root to frontend directory to avoid scanning parent directories
  //   root: '.',
  //   resolveAlias: {
  //     // Only resolve opa-builder when explicitly imported
  //     'opa-builder': '../builder/src/index.js',
  //   },
  // },
};

export default nextConfig;
