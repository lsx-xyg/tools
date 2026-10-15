/* opencv.js 懒加载替代模块（webpack alias: @techstark/opencv-js → 本文件）
 *
 * 背景：@techstark/opencv-js 的 dist/opencv.js 是 emscripten 单文件构建，
 * 内部内联了 ~7.6MiB wasm（base64），webpack 会把它整体打成一个 ~10MB 的动态 chunk，
 * 弱网/边缘节点波动时直接 "Loading chunk ... failed (timeout)"（生产实测）。
 *
 * 做法：chunk 里不再打包 opencv，运行时用 <script> 从 /opencv/opencv.js 独立加载
 * （12MiB 静态资产，Cloudflare 可缓存，仅在真正 OCR 初始化时下载）。
 * 默认导出 Promise<cv>，PaddleOCR.js 对 cvModule 按 `instanceof Promise` 分支 await。
 */
export default new Promise((resolve, reject) => {
  if (typeof window === "undefined") {
    reject(new Error("opencv 仅支持浏览器环境"));
    return;
  }
  if (window.cv && window.cv.Mat) {
    resolve(window.cv);
    return;
  }
  const s = document.createElement("script");
  s.src = "/opencv/opencv.js";
  s.async = true;
  s.onload = () => {
    const mod = window.cv;
    if (!mod) {
      reject(new Error("opencv.js 加载失败"));
      return;
    }
    if (mod.Mat) {
      resolve(mod);
    } else if (mod.onRuntimeInitialized) {
      mod.onRuntimeInitialized = () => resolve(mod);
    } else {
      reject(new Error("opencv.js 初始化失败"));
    }
  };
  s.onerror = () => reject(new Error("opencv.js 网络加载失败，请检查网络后重试"));
  document.head.appendChild(s);
});
