import Link from "next/link";
import { IconChevronLeft } from "./icons";

/** 工具页统一头部：返回 + 标题 + 说明 */
export function ToolHead({
  title,
  lede,
  chip,
}: {
  title: string;
  lede: string;
  chip?: React.ReactNode;
}) {
  return (
    <div className="transfer-head">
      <Link href="/" className="back-link">
        <IconChevronLeft width={15} height={15} />
        仪表台
      </Link>
      <h1>{title}</h1>
      <p className="lede">
        {lede}
        {chip && <span className="lede-chip">{chip}</span>}
      </p>
    </div>
  );
}
