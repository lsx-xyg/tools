/**
 * 文本 Diff：基于 jsdiff 的行级对比，返回高亮片段与统计。
 * 全部本地计算。
 */
import { diffLines, type Change } from "diff";

export interface DiffStat {
  added: number;
  removed: number;
}

export function diffText(oldText: string, newText: string): { chunks: Change[]; stat: DiffStat } {
  const chunks = diffLines(oldText, newText);
  const stat: DiffStat = { added: 0, removed: 0 };
  for (const c of chunks) {
    if (!c.added && !c.removed) continue;
    const n = c.value.split("\n").filter((l) => l.trim() !== "").length;
    if (c.added) stat.added += n;
    else stat.removed += n;
  }
  return { chunks, stat };
}
