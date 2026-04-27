import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "drive.google.com" },
    ],
  },
  serverExternalPackages: ["@node-rs/argon2", "@node-rs/bcrypt"],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "light-house-6w9nqaief-gleb302596555s-projects.vercel.app",
        "*.vercel.app",
      ],
    },
  },
};

export default withNextIntl(nextConfig);
