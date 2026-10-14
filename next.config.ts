import type { NextConfig } from "next";
import path from "node:path";

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
    /* onnxruntime-web 会引用各 ExecutionProvider 的 wasm（jsep/asyncify 等），
       jsep(27MiB)/asyncify(26MiB) 超 CF Workers 单资产 25MiB 上限且运行时不会用到
       （OCR 用 backend:"wasm"，主 wasm 从 /onnx/ 自托管），拦截为空 so 不被打包。 */
    config.module.rules.push({
      test: /onnxruntime-web.*ort-wasm-simd-threaded\.(jsep|asyncify)\.wasm$/,
      type: "javascript/auto",
      use: [{ loader: path.join(__dirname, "lib/empty-wasm-loader.js") }],
    });
    return config;
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
