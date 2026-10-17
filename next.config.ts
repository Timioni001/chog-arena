import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { optimizePackageImports: ['lucide-react', '@react-three/drei'] },
  webpack: (config) => {
    // Optional peers of wallet connectors we don't ship (logging, storage, x402 payments); never executed.
    // Aliased to empty modules rather than externals so the Cloudflare Worker bundle stays self-contained.
    config.resolve.alias = {
      ...config.resolve.alias,
      'pino-pretty': false,
      lokijs: false,
      encoding: false,
      '@x402/core/client': false,
      '@x402/evm': false,
      '@x402/evm/exact/client': false,
      '@x402/evm/upto/client': false,
      '@x402/svm/exact/client': false,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
};

export default nextConfig;

// Lets `next dev` see Cloudflare bindings locally.
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev();
