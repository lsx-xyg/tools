"use client";

import { useState } from "react";
import { ToolHead } from "@/components/tool-head";
import { IconGlobe, IconLoader, IconSearch } from "@/components/icons";

type RrType = "A" | "AAAA" | "CNAME" | "MX" | "NS" | "TXT" | "SOA" | "SRV" | "PTR" | "CAA";

const TYPES: RrType[] = ["A", "AAAA", "CNAME", "MX", "NS", "TXT", "SOA", "SRV", "PTR", "CAA"];

interface DnsAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DnsResult {
  Status: number;
  Answer?: DnsAnswer[];
  Authority?: DnsAnswer[];
}

const TYPE_NAMES: Record<number, string> = {
  1: "A",
  2: "NS",
  5: "CNAME",
  6: "SOA",
  15: "MX",
  16: "TXT",
  28: "AAAA",
  33: "SRV",
  12: "PTR",
  257: "CAA",
};

const DOH_PROVIDERS = [
  { key: "alidns", label: "阿里 DNS", url: "https://dns.alidns.com/resolve" },
  { key: "dnspod", label: "DNSPod", url: "https://doh.pub/dns-query" },
  { key: "cloudflare", label: "Cloudflare", url: "https://cloudflare-dns.com/dns-query" },
] as const;

export default function DnsLookupPage() {
  const [domain, setDomain] = useState("");
  const [type, setType] = useState<RrType>("A");
  const [provider, setProvider] = useState<(typeof DOH_PROVIDERS)[number]["key"]>("alidns");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DnsResult | null>(null);
  const [err, setErr] = useState("");

  const doh = DOH_PROVIDERS.find((p) => p.key === provider) ?? DOH_PROVIDERS[0];

  const query = async () => {
    const name = domain.trim();
    if (!name) {
      setErr("请输入域名。");
      return;
    }
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      const url = `${doh.url}?name=${encodeURIComponent(name)}&type=${type}`;
      const res = await fetch(url, { headers: { Accept: "application/dns-json" } });
      if (!res.ok) throw new Error(`DoH 接口返回 ${res.status}`);
      const data = (await res.json()) as DnsResult;
      if (data.Status !== 0) {
        setErr(`DNS 响应状态码 ${data.Status}（0 = NOERROR；3 = 域名不存在；2 = SERVFAIL）。`);
      } else if (!data.Answer?.length) {
        setResult(data);
        setErr(`查询成功，但该域名没有 ${type} 记录。`);
      } else {
        setResult(data);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "查询失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fade-rise">
      <ToolHead
        title="DNS 解析查询"
        lede="通过公共 DoH 查询域名解析记录（A / AAAA / CNAME / MX / TXT 等）"
        chip={
          <span>
            <IconGlobe width={12} height={12} />
            {doh.label}
          </span>
        }
      />

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <span className="label">域名</span>
          <span className="right subtle">支持任意公网域名</span>
        </div>
        <div className="panel-body">
          <div className="vc-token-row" style={{ alignItems: "stretch" }}>
            <input
              className="input"
              placeholder="如 example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") query();
              }}
              disabled={busy}
            />
            <select className="input" style={{ maxWidth: 132 }} value={provider} onChange={(e) => setProvider(e.target.value as (typeof DOH_PROVIDERS)[number]["key"])} disabled={busy} title="DoH 服务源">
              {DOH_PROVIDERS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
            <select className="input" style={{ maxWidth: 116 }} value={type} onChange={(e) => setType(e.target.value as RrType)} disabled={busy}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button type="button" className="btn-primary" onClick={query} disabled={busy}>
              {busy ? <IconLoader width={14} height={14} /> : <IconSearch width={14} height={14} />}
              查询
            </button>
          </div>
        </div>
      </div>

      {err && <div className="vc-log-error">{err}</div>}

      {result?.Answer && result.Answer.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span className="label">
              {domain.trim()} · {type} 记录
            </span>
            <span className="right subtle">{result.Answer.length} 条</span>
          </div>
          <div className="panel-body">
            <table className="mi-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>类型</th>
                  <th>TTL</th>
                  <th>数据</th>
                </tr>
              </thead>
              <tbody>
                {result.Answer.map((a, i) => (
                  <tr key={i}>
                    <td className="mono">{a.name}</td>
                    <td>{TYPE_NAMES[a.type] || `TYPE ${a.type}`}</td>
                    <td className="mono">{a.TTL}s</td>
                    <td className="mono">{a.data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="vc-note">
        <strong>说明：</strong>查询通过公共 DNS-over-HTTPS（默认阿里 DNS，可切换 DNSPod / Cloudflare）完成，不经过您的本地 DNS 缓存，可观察公网解析结果。
        DNS 解析为尽力而为的服务，查询结果以您所用公共递归 DNS 的缓存为准。
      </div>
    </div>
  );
}
