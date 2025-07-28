/** @type {import('next').NextConfig} */
const nextConfig = {
  //transpilePackages: ['opa-builder'],
  experimental: {
    esmExternals: true,
  },
  // turbopack: {
  //   root: '..',
  //   resolveAlias: {
  //     'opa-builder': 'builder/src/index.js',
  //   },
  // },
};

export default nextConfig;
