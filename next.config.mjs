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
  // Prevent jose / next-auth from being bundled into the Edge runtime
  serverExternalPackages: ["@node-rs/argon2", "@node-rs/bcrypt"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
};

export default nextConfig;
