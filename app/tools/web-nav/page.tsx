import { ToolHead } from "@/components/tool-head";
import { WEB_NAV_CATEGORIES } from "@/lib/web-nav-data";

/* 分类小图标：用轻量 emoji 字符，避免为导航页引入 client 图标依赖 */
const CAT_ICON: Record<string, string> = {
  pdf: "📄",
  transfer: "📁",
  image: "🖼️",
  convert: "🔁",
  dev: "🧰",
  ai: "🤖",
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function WebNavPage() {
  return (
    <div className="fade-rise">
      <ToolHead
        title="好用网站导航"
        lede="精选第三方在线工具，点击直达。本站只做推荐跳转、不做功能"
        chip={<span>纯外链 · 跳转第三方站点</span>}
      />

      <div className="webnav">
        {WEB_NAV_CATEGORIES.map((cat) => (
          <section className="webnav-section" key={cat.id}>
            <h2 className="webnav-cat">
              <span className="webnav-cat-ico" aria-hidden="true">
                {CAT_ICON[cat.icon] ?? "🌐"}
              </span>
              {cat.name}
              <span className="webnav-count">{cat.sites.length}</span>
            </h2>
            <div className="webnav-grid">
              {cat.sites.map((s) => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="webnav-card"
                >
                  <span className="webnav-card-head">
                    <span className="webnav-card-name">{s.name}</span>
                    <span className="webnav-ext" aria-hidden="true">
                      ↗
                    </span>
                  </span>
                  <span className="webnav-card-desc">{s.desc}</span>
                  <span className="webnav-card-host">{hostOf(s.url)}</span>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="count-hint">以上均为第三方网站，跳转后数据与隐私请遵循各站自身声明</p>
    </div>
  );
}
