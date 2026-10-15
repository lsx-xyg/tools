"use client";

import { useEffect, useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconShield } from "@/components/icons";
import { MergeTab } from "@/components/pdf/merge-tab";
import { SplitTab } from "@/components/pdf/split-tab";
import { RotateTab } from "@/components/pdf/rotate-tab";
import { CompressTab } from "@/components/pdf/compress-tab";
import { ToImageTab } from "@/components/pdf/to-image-tab";
import { Img2PdfTab } from "@/components/pdf/img2pdf-tab";
import { OrganizeTab } from "@/components/pdf/organize-tab";
import { PageNumTab } from "@/components/pdf/page-num-tab";
import { WatermarkTab } from "@/components/pdf/watermark-tab";
import { SecurityTab } from "@/components/pdf/security-tab";
import { ScanPdfTab } from "@/components/pdf/scan-tab";

const TABS = [
  { id: "merge", label: "合并" },
  { id: "split", label: "拆分提取" },
  { id: "rotate", label: "旋转" },
  { id: "compress", label: "压缩" },
  { id: "toimage", label: "转图片" },
  { id: "img2pdf", label: "图片转PDF" },
  { id: "scan", label: "扫描件合成" },
  { id: "organize", label: "删页组织" },
  { id: "pagenum", label: "页码" },
  { id: "watermark", label: "水印" },
  { id: "security", label: "加密解密" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const COMPONENTS: Record<TabId, () => React.ReactElement> = {
  merge: MergeTab,
  split: SplitTab,
  rotate: RotateTab,
  compress: CompressTab,
  toimage: ToImageTab,
  img2pdf: Img2PdfTab,
  scan: ScanPdfTab,
  organize: OrganizeTab,
  pagenum: PageNumTab,
  watermark: WatermarkTab,
  security: SecurityTab,
};

function isValidTab(p: string | null): p is TabId {
  return p !== null && TABS.some((t) => t.id === p);
}

export default function PdfPage() {
  /* 首帧固定 merge，保证服务端/客户端一致（避免 hydration mismatch）；
     挂载后再读 URL ?tab= 深链切换，仅极短闪烁 */
  const [tab, setTab] = useState<TabId>("merge");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("tab");
    if (isValidTab(p)) setTab(p);
  }, []);

  const switchTab = (id: TabId) => {
    setTab(id);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url.toString());
  };

  const Active = COMPONENTS[tab];

  return (
    <div className="fade-rise">
      <ToolHead
        title="PDF 工具箱"
        lede="合并 · 拆分提取 · 逐页旋转 · 压缩 · 转图片 · 图片转 PDF · 删页重排 · 页码 · 水印 · 加密解密，全部浏览器本地完成"
        chip={
          <span>
            <IconShield width={12} height={12} />
            浏览器本地 · 文件不上传
          </span>
        }
      />

      <div className="hp-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            data-active={tab === t.id}
            onClick={() => switchTab(t.id)}
            type="button"
            className="hp-tab"
          >
            {t.label}
          </button>
        ))}
      </div>

      <Active key={tab} />
    </div>
  );
}
