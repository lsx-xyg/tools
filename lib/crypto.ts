/**
 * 本地哈希计算：文本 MD5/SHA1/SHA256/SHA512 + HMAC；文件哈希。
 * 全部在浏览器本地执行，不上传。
 */
import CryptoJS from "crypto-js";

export const HASH_ALGOS = ["md5", "sha1", "sha256", "sha512"] as const;
export type HashAlgo = (typeof HASH_ALGOS)[number];

export const ALGO_LABEL: Record<HashAlgo, string> = {
  md5: "MD5",
  sha1: "SHA-1",
  sha256: "SHA-256",
  sha512: "SHA-512",
};

export function hashText(text: string, algo: HashAlgo): string {
  switch (algo) {
    case "md5":
      return CryptoJS.MD5(text).toString();
    case "sha1":
      return CryptoJS.SHA1(text).toString();
    case "sha256":
      return CryptoJS.SHA256(text).toString();
    case "sha512":
      return CryptoJS.SHA512(text).toString();
  }
}

export function hmacText(text: string, key: string, algo: HashAlgo): string {
  switch (algo) {
    case "md5":
      return CryptoJS.HmacMD5(text, key).toString();
    case "sha1":
      return CryptoJS.HmacSHA1(text, key).toString();
    case "sha256":
      return CryptoJS.HmacSHA256(text, key).toString();
    case "sha512":
      return CryptoJS.HmacSHA512(text, key).toString();
  }
}

const HEX = (b: ArrayBuffer) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

/** 文件哈希：SHA 系走 Web Crypto（流式高性能）；MD5 走 crypto-js（大文件较慢） */
export async function hashFile(file: File, algo: HashAlgo): Promise<string> {
  const buf = await file.arrayBuffer();
  if (algo === "md5") {
    const words = CryptoJS.lib.WordArray.create(new Uint8Array(buf));
    return CryptoJS.MD5(words).toString();
  }
  const name = algo === "sha1" ? "SHA-1" : algo === "sha256" ? "SHA-256" : "SHA-512";
  return HEX(await crypto.subtle.digest(name, buf));
}
