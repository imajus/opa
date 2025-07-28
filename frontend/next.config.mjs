/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['opa-builder'],
  experimental: {
    esmExternals: true,
  },
};

export default nextConfig;
