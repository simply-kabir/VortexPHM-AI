/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three.js ESM packages used through react-three-fiber/drei
  transpilePackages: ["three"],
  async headers() {
    return [
      // frames and the GLB never change for a given filename: cache them hard
      { source: "/engine-seq/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/models/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};
export default nextConfig;
