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
    /* @techstark/opencv-js 单文件含 7.6MiB 内联 wasm，打进 chunk 会导致弱网
       Loading chunk timeout：改为运行时从 /opencv/opencv.js 独立 script 加载 */
    config.resolve.alias["@techstark/opencv-js"] = path.join(__dirname, "lib/opencv-lazy.js");

    /* onnxruntime-web 会引用各 ExecutionProvider 的 wasm（主 wasm、jsep、asyncify 等），
       这些文件要么超 CF Workers 单资产 25MiB 上限、要么运行时不会用到
       （OCR 用 backend:"wasm" 且主 wasm 从 /onnx/ 自托管 public/onnx/ort-wasm-simd-threaded.wasm），
       全部 .wasm 拦截为空 so 不被打包——否则 7.6MiB 主 wasm 会被 base64 内联进动态 chunk，
       弱网下直接 Loading chunk timeout（生产实测报错）。ffmpeg/pdfjs 的 wasm 均自托管、不依赖打包。 */
    config.module.rules.push({
      test: /\.wasm$/,
      type: "javascript/auto",
      use: [{ loader: path.join(__dirname, "lib/empty-wasm-loader.js") }],
    });
    return config;
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
