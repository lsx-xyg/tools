"use client";

import { useState } from "react";
import {
  IconFileStack,
  IconLoader,
  IconLock,
  IconLockOpen,
  IconPlus,
} from "@/components/icons";
import { decryptPdf, downloadBytes, encryptPdf, pdfError } from "@/lib/pdf-utils";
import { FileDropZone } from "@/components/drop-zone";

type Sub = "encrypt" | "decrypt";

export function SecurityTab() {
  const [sub, setSub] = useState<Sub>("encrypt");
  const [file, setFile] = useState<{ name: string; bytes: ArrayBuffer } | null>(null);
  const [userPw, setUserPw] = useState("");
  const [ownerPw, setOwnerPw] = useState("");
  const [printing, setPrinting] = useState(true);
  const [copying, setCopying] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  const addFile = async (files: File[]) => {
    const f = files.find((x) => x.type === "application/pdf" || /\.pdf$/i.test(x.name));
    if (!f) {
      setErr("请选择 PDF 文件");
      return;
    }
    setErr("");
    setNote("");
    try {
      const bytes = await f.arrayBuffer();
      setFile({ name: f.name, bytes });
    } catch {
      setErr("无法读取文件");
    }
  };

  async function runEncrypt() {
    if (!file) return;
    if (!userPw) {
      setErr("请设置用户密码");
      return;
    }
    setBusy(true);
    setErr("");
    setNote("");
    try {
      const out = await encryptPdf(file.bytes, {
        userPassword: userPw,
        ownerPassword: ownerPw || undefined,
        printing,
        copying,
      });
      downloadBytes(out, file.name.replace(/\.pdf$/i, "-encrypted.pdf"));
      setNote("已加密：打开文件时需输入用户密码。");
    } catch (e) {
      setErr(pdfError(e));
    } finally {
      setBusy(false);
    }
  }

  async function runDecrypt() {
    if (!file) return;
    if (!userPw) {
      setErr("请输入 PDF 的打开密码");
      return;
    }
    setBusy(true);
    setErr("");
    setNote("");
    try {
      const res = await decryptPdf(file.bytes, userPw);
      if (!res.wasEncrypted) {
        setNote("该 PDF 未加密，可直接打开。");
      } else {
        downloadBytes(res.bytes, file.name.replace(/\.pdf$/i, "-decrypted.pdf"));
        setNote("已解除密码，下载的文件无需密码即可打开。");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "解密失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="single-panel tab-anim">
      <div className="seg" role="group" aria-label="加密 / 解密">
        <button data-active={sub === "encrypt"} onClick={() => { setSub("encrypt"); setErr(""); setNote(""); }} type="button">
          <IconLock width={14} height={14} />
          加密
        </button>
        <button data-active={sub === "decrypt"} onClick={() => { setSub("decrypt"); setErr(""); setNote(""); }} type="button">
          <IconLockOpen width={14} height={14} />
          解密
        </button>
      </div>

      <div style={{ marginTop: 14 }}>
        <FileDropZone
          accept="application/pdf,.pdf"
          icon={<IconPlus width={18} height={18} />}
          label={file ? `已选择：${file.name}` : "拖入 PDF，或点击选择文件"}
          onFiles={(files) => void addFile(files)}
        />
      </div>

      {file && (
        <div className="vd-grid" style={{ marginTop: 14 }}>
          <div className="vd-field">
            <label className="vc-label">{sub === "encrypt" ? "用户密码（打开密码，必填）" : "打开密码（必填）"}</label>
            <input className="input" type="password" value={userPw} onChange={(e) => setUserPw(e.target.value)} placeholder="输入密码" />
          </div>
          {sub === "encrypt" && (
            <>
              <div className="vd-field">
                <label className="vc-label">所有者密码（可选，留空则与用户密码相同）</label>
                <input className="input" type="password" value={ownerPw} onChange={(e) => setOwnerPw(e.target.value)} placeholder="可选" />
              </div>
              <div className="vd-field">
                <label className="vc-label">权限</label>
                <label style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                  <input type="checkbox" checked={printing} onChange={(e) => setPrinting(e.target.checked)} />
                  允许打印
                </label>
                <label style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                  <input type="checkbox" checked={copying} onChange={(e) => setCopying(e.target.checked)} />
                  允许复制内容
                </label>
              </div>
            </>
          )}
        </div>
      )}

      {err && <p className="count-hint warn" style={{ marginTop: 10 }}>{err}</p>}
      {note && <p className="count-hint" style={{ marginTop: 10 }}>{note}</p>}

      <div className="tool-row" style={{ marginTop: 14 }}>
        <span className="count-hint">{sub === "encrypt" ? "加密后打开文件需输入密码" : "验证密码后导出无加密版本"}</span>
        <span className="spacer" />
        <button className="btn btn-primary" onClick={() => void (sub === "encrypt" ? runEncrypt() : runDecrypt())} type="button" disabled={busy || !file}>
          {busy ? <IconLoader width={15} height={15} className="spin" /> : <IconFileStack width={15} height={15} />}
          {busy ? "处理中…" : sub === "encrypt" ? "加密并下载" : "解密并下载"}
        </button>
      </div>
    </div>
  );
}
