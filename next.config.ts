import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* PaddleOCR.js 依赖 @techstark/opencv-js，其在浏览器端引用了 Node 内置模块（fs 等），
     这里把这些模块在打包时 fallback 为空，保证 client bundle 可解析。 */
  turbopack: {},
  webpack(config) {
    config.resolve.fallback = {
      fs: false,
      path: false,
      os: false,
      crypto: false,
      stream: false,
      buffer: false,
      util: false,
      zlib: false,
      worker_threads: false,
      child_process: false,
      http: false,
      https: false,
      net: false,
      tls: false,
      url: false,
      querystring: false,
      events: false,
      assert: false,
      constants: false,
      module: false,
    };
    return config;
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
