"use client";

import { useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconGlobe, IconLoader, IconSearch } from "@/components/icons";

interface IpResult {
  ip: string;
  success: boolean;
  type: string;
  continent?: string;
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  org?: string;
  isp?: string;
  timezone?: { id?: string; abbr?: string; is_dst?: boolean; offset?: number; utc?: string };
  connection?: { asn?: number; org?: string; isp?: string };
  error?: { info?: string };
}

const API = "https://ipwho.is";

function formatTimezone(tz?: IpResult["timezone"]): string {
  if (!tz) return "—";
  const parts: string[] = [];
  if (tz.id) parts.push(tz.id);
  if (tz.abbr) parts.push(tz.abbr);
  if (typeof tz.offset === "number") {
    const hours = tz.offset / 3600;
    const sign = hours >= 0 ? "+" : "-";
    parts.push(`UTC${sign}${Math.abs(hours)}`);
  }
  return parts.join(" · ") || "—";
}

export default function IpLookupPage() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IpResult | null>(null);
  const [err, setErr] = useState("");

  const query = async (ip?: string) => {
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      const url = ip ? `${API}/${encodeURIComponent(ip.trim())}` : API;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`接口返回 ${res.status}`);
      const data = (await res.json()) as IpResult;
      if (data.success === false || data.error) {
        setErr(data.error?.info || "查询失败，请检查 IP 地址格式。");
      } else {
        setResult(data);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "查询失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  const items = result
    ? [
        { label: "IP 地址", value: result.ip, mono: true },
        { label: "IP 类型", value: result.type === "ipv4" ? "IPv4" : result.type === "ipv6" ? "IPv6" : result.type },
        { label: "大洲", value: result.continent },
        { label: "国家 / 地区", value: result.country ? `${result.country}${result.country_code ? ` (${result.country_code})` : ""}` : "—" },
        { label: "省份 / 州", value: result.region },
        { label: "城市", value: result.city },
        { label: "经纬度", value: result.latitude != null && result.longitude != null ? `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}` : "—" },
        { label: "运营商", value: result.connection?.isp || result.isp || result.connection?.org || result.org || "—" },
        { label: "ASN", value: result.connection?.asn ? `AS${result.connection.asn}` : "—" },
        { label: "时区", value: formatTimezone(result.timezone) },
      ]
    : [];

  return (
    <div className="fade-rise">
      <ToolHead
        title="IP 归属地查询"
        lede="查询 IP 地址的归属地、运营商与时区信息 — 留空查询本机出口 IP"
        chip={
          <span>
            <IconGlobe width={12} height={12} />
            免费接口
          </span>
        }
      />

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <span className="label">IP 地址</span>
          <span className="right subtle">支持 IPv4 / IPv6</span>
        </div>
        <div className="panel-body">
          <div className="vc-token-row" style={{ alignItems: "stretch" }}>
            <input
              className="input"
              placeholder="留空查询本机 IP，或输入目标 IP（如 8.8.8.8）"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") query(input || undefined);
              }}
              disabled={busy}
            />
            <button type="button" className="btn-primary" onClick={() => query(input || undefined)} disabled={busy}>
              {busy ? <IconLoader width={14} height={14} /> : <IconSearch width={14} height={14} />}
              查询
            </button>
          </div>
        </div>
      </div>

      {err && <div className="vc-log-error">{err}</div>}

      {result && (
        <div className="panel">
          <div className="panel-head">
            <span className="label">查询结果</span>
          </div>
          <div className="panel-body">
            <table className="mi-table">
              <tbody>
                {items.map((it) => (
                  <tr key={it.label}>
                    <th className="ip-label">{it.label}</th>
                    <td className={it.mono ? "mono" : ""}>{it.value || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="vc-note" style={{ marginTop: 8 }}>
              数据来源：ipwho.is 免费接口，归属地信息仅供参考，运营商位置可能与实际不符。
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
