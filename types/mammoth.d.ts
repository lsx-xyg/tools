/* mammoth 无内置类型声明：最小声明，仅覆盖本仓库使用的 API */
declare module "mammoth" {
  export interface ConvertToHtmlOptions {
    arrayBuffer?: ArrayBuffer;
  }
  export interface ConvertToHtmlResult {
    value: string;
    messages: unknown[];
  }
  export function convertToHtml(options: ConvertToHtmlOptions): Promise<ConvertToHtmlResult>;
}
