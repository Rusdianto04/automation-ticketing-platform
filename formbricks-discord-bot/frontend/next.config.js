/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3001", "*.internal", "*"],
    },
  },

  serverExternalPackages: ["@prisma/client", "bcryptjs"],

  env: {
    NEXT_PUBLIC_ORG_NAME: process.env.ORG_NAME       || "IT Support Division",
    NEXT_PUBLIC_ORG_DEPT: process.env.ORG_DEPARTMENT || "IT Infrastructure",
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;