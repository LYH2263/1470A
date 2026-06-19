import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Docker 部署配置
  output: 'standalone',
  // 图片优化配置
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
