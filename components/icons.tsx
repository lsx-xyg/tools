import type { SVGProps } from "react";
import {
  Activity,
  ArrowLeftRight,
  Binary,
  CaseSensitive,
  Braces,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardPaste,
  Clock,
  Copy,
  Database,
  Download,
  ExternalLink,
  File,
  FileCheck,
  FileDiff,
  FileText,
  FileType,
  Fingerprint,
  Hash,
  Home,
  KeyRound,
  Link,
  Menu,
  Monitor,
  Moon,
  Plus,
  QrCode,
  RefreshCw,
  Repeat,
  ScanLine,
  Search,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  TextSearch,
  Trash2,
  Upload,
  Wifi,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type P = SVGProps<SVGSVGElement>;

/**
 * 统一包装：所有图标保持本设计系统的尺规
 * （默认 20px 视觉网格、1.7 stroke，与手绘时代一致），
 * 但使用 lucide 的专业矢量路径。
 */
function wrap(C: LucideIcon) {
  return function Icon(p: P) {
    return (
      <C
        {...p}
        width={p.width ?? 20}
        height={p.height ?? 20}
        strokeWidth={p.strokeWidth ?? 1.7}
      />
    );
  };
}

export const IconActivity = wrap(Activity);
export const IconBase = wrap(Binary);
export const IconBase64 = IconBase;
export const IconBolt = wrap(Zap);
export const IconCase = wrap(CaseSensitive);
export const IconCheck = wrap(Check);
export const IconChevronLeft = wrap(ChevronLeft);
export const IconChevronRight = wrap(ChevronRight);
export const IconChevronsLeft = wrap(ChevronsLeft);
export const IconChevronsRight = wrap(ChevronsRight);
export const IconClock = wrap(Clock);
export const IconCopy = wrap(Copy);
export const IconCron = wrap(CalendarClock);
export const IconDatabase = wrap(Database);
export const IconDocText = wrap(FileText);
export const IconDownload = wrap(Download);
export const IconExternal = wrap(ExternalLink);
export const IconFile = wrap(File);
export const IconFileCheck = wrap(FileCheck);
export const IconFileDiff = wrap(FileDiff);
export const IconFingerprint = wrap(Fingerprint);
export const IconFileType = wrap(FileType);
export const IconHash = wrap(Hash);
/** GitHub 品牌 mark（lucide 主包已移除品牌图标，保留手绘路径） */
export const IconGithub = (p: P) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={p.strokeWidth ?? 1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    width={p.width ?? 20}
    height={p.height ?? 20}
    {...p}
  >
    <path d="M12 2.8a9.5 9.5 0 0 0-3 18.5c.5.1.6-.2.6-.5v-1.7c-2.6.6-3.1-1.2-3.1-1.2-.4-1.1-1-1.4-1-1.4-.9-.6 0-.6 0-.6 1 0 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.5-1.1-4.5-4.9 0-1.1.4-2 1-2.7-.1-.2-.4-1.2.1-2.6 0 0 .8-.3 2.7 1a9.3 9.3 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.6.6.7 1 1.6 1 2.7 0 3.8-2.3 4.6-4.5 4.9.3.3.6.9.6 1.8v2.7c0 .3.1.6.6.5A9.5 9.5 0 0 0 12 2.8z" />
  </svg>
);
export const IconHome = wrap(Home);
export const IconJson = wrap(Braces);
export const IconKey = wrap(KeyRound);
export const IconLink = wrap(Link);
export const IconMenu = wrap(Menu);
export const IconMonitor = wrap(Monitor);
export const IconMoon = wrap(Moon);
export const IconPaste = wrap(ClipboardPaste);
export const IconPlus = wrap(Plus);
export const IconQr = wrap(QrCode);
export const IconRefresh = wrap(RefreshCw);
export const IconScan = wrap(ScanLine);
export const IconSearch = wrap(Search);
export const IconServer = wrap(Server);
export const IconShield = wrap(ShieldCheck);
export const IconSliders = wrap(SlidersHorizontal);
export const IconSun = wrap(Sun);
export const IconTextSearch = wrap(TextSearch);
export const IconTransfer = wrap(ArrowLeftRight);
export const IconTrash = wrap(Trash2);
export const IconUpload = wrap(Upload);
export const IconRepeat = wrap(Repeat);
export const IconWifi = wrap(Wifi);
export const IconX = wrap(X);
export const IconZap = wrap(Zap);
