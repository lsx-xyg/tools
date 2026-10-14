// default open-next.config.ts file created by @opennextjs/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
// import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

const config = defineCloudflareConfig({
	// For best results consider enabling R2 caching
	// See https://opennext.js.org/cloudflare/caching for more details
	// incrementalCache: r2IncrementalCache
});

export default {
	...config,
	// OCR(PaddleOCR.js) 依赖 @techstark/opencv-js 引用的 Node 内置模块，需 webpack fallback，
	// 而 Next 16 默认 Turbopack 不认 webpack 配置，故强制构建走 webpack。
	buildCommand: "next build --webpack",
};
