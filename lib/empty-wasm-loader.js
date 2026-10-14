// 空 wasm loader：拦截 onnxruntime-web 的超大 EP wasm（jsep/asyncify，>25MiB 会超 CF 单资产限制）。
// 这些 EP 运行时不会被使用（OCR 用 backend: "wasm"，模型/主 wasm 从 /onnx/ 自托管），
// 因此把它们的 import 编译成空模块，避免 webpack 打包进 _next/static/media 导致部署失败。
module.exports = function () {
  return "module.exports = '';";
};
