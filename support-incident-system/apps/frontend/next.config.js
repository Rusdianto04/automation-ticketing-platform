/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  experimental: {
    serverActions: {
      allowedOrigins: ["*"],
      bodySizeLimit: "10mb",
    },
  },

  // Serve uploaded files dari /public/uploads dengan header yang benar
  async headers() {
    return [
      {
        source: "/uploads/:path*",
        headers: [
          { key: "Cache-Control",               value: "public, max-age=86400" },
          { key: "Access-Control-Allow-Origin",  value: "*" },
          { key: "X-Content-Type-Options",       value: "nosniff" },
        ],
      },
    ];
  },
  eslint:     { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

module.exports = nextConfig;
