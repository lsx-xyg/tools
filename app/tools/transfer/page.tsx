"use client";

import { Suspense, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SendPanel } from "@/components/transfer/send-panel";
import { ReceivePanel } from "@/components/transfer/receive-panel";
import { IconBolt, IconChevronLeft, IconExternal } from "@/components/icons";

const noopSubscribe = () => () => {};

/** 微信内置浏览器无法下载文件，提示用户转系统浏览器（SSR 安全） */
function WechatHint() {
  const isWechat = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator !== "undefined" && /MicroMessenger/i.test(navigator.userAgent),
    () => false,
  );
  if (!isWechat) return null;
  return (
    <div className="wechat-hint" role="status">
      <IconExternal width={14} height={14} />
      微信内无法下载文件：请点击右上角「···」→「在浏览器中打开」后再使用
    </div>
  );
}

function TransferPageInner() {
  const sp = useSearchParams();
  const mode = sp.get("mode") ?? undefined;
  const code = sp.get("code") ?? undefined;

  return (
    <div className="fade-rise">
      <WechatHint />
      <div className="transfer-head">
        <Link href="/" className="back-link">
          <IconChevronLeft width={15} height={15} />
          仪表台
        </Link>
        <h1>文本 / 文件互传</h1>
        <p className="lede">
          在线直传不落服务器 · 离线到期自动清除 · 凭提取码或扫码取回
          <span className="lede-chip">
            <IconBolt width={12} height={12} />
            在线 P2P
          </span>
        </p>
      </div>

      <div className="transfer-grid">
        <SendPanel />
        <ReceivePanel autoJoin={{ mode, code }} />
      </div>
    </div>
  );
}

export default function TransferPage() {
  return (
    <Suspense fallback={<div className="fade-rise">正在加载工具…</div>}>
      <TransferPageInner />
    </Suspense>
  );
}
