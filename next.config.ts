import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent clickjacking – block all framing
  { key: "X-Frame-Options", value: "DENY" },
  // Block MIME-type sniffing (e.g. treating a .txt as script)
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Control what info the Referer header leaks
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable unnecessary browser APIs
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Enable DNS prefetch for faster navigation
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Force HTTPS (browsers cache this for 2 years)
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "kxuhnbmureteruqbiubi.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  webpack: (config: any) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string | false>),
      "pino-pretty": false,
      "@react-native-async-storage/async-storage": false,
      "accounts": false,
      "@metamask/connect-evm": false,
      "porto": false,
      "porto/internal": false,
      "@walletconnect/ethereum-provider": false,
    };
    return config;
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
