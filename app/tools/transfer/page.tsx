"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SendPanel } from "@/components/transfer/send-panel";
import { ReceivePanel } from "@/components/transfer/receive-panel";
import { IconBolt, IconChevronLeft, IconClock, IconServer, IconShield } from "@/components/icons";

function TransferPageInner() {
  const sp = useSearchParams();
  const mode = sp.get("mode") ?? undefined;
  const code = sp.get("code") ?? undefined;

  return (
    <div className="fade-rise">
      <Link href="/" className="back-link">
        <IconChevronLeft width={15} height={15} />
        返回仪表台
      </Link>
      <header className="page-head">
        <h1>文本 / 文件互传</h1>
        <p className="lede">
          在线模式：两台设备点对点直传，内容不经过服务器；离线模式：云端暂存 24
          小时自动清除。发送端生成 6 位提取码，接收端输入提取码或扫码即可取回。
        </p>
        <div className="meta-chips">
          <span className="chip accent">
            <IconBolt width={12} height={12} />
            在线直传 · 不落服务器
          </span>
          <span className="chip">
            <IconServer width={12} height={12} />
            离线 24h 自动清除
          </span>
          <span className="chip">
            <IconClock width={12} height={12} />
            免登录
          </span>
          <span className="chip">
            <IconShield width={12} height={12} />
            免费
          </span>
        </div>
      </header>

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
