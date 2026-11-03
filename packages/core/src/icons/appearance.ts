import catalogue from "./oasisic-catalogue.json";
import type { ClashConfig } from "../types/config";

// Updated only after the corresponding icon repository revision is published.
export const OASISIC_REVISION = "4091601e4eb12e8ba7620008703a8754e6608204";
export const OASISIC_ICONS = catalogue;
export interface GroupAppearanceOverride {
  imageEnabled?: boolean;
  emojiEnabled?: boolean;
  iconMode?: "auto" | "manual";
  iconId?: string;
  emoji?: string;
}
export interface GroupAppearance {
  imagesEnabled: boolean;
  emojisEnabled: boolean;
  groups: Record<string, GroupAppearanceOverride>;
}
export function newGroupAppearance(): GroupAppearance {
  return { imagesEnabled: true, emojisEnabled: false, groups: {} };
}
export function legacyGroupAppearance(): GroupAppearance {
  return { imagesEnabled: false, emojisEnabled: true, groups: {} };
}
const byId = new Map(catalogue.map(i => [i.id, i]));
export const BUILTIN_ICON_IDS: Record<string, string> = {
  select: "Proxy", auto: "Auto", ad: "AD", private: "Direct", cn: "China", global: "Global", final: "Final",
  ai: "GeneralAI", gemini: "GoogleAI", youtube: "YouTube", google: "Google", microsoft: "Microsoft", apple: "Apple",
  telegram: "Telegram", twitter: "X", meta: "Meta", discord: "Discord", "social-other": "Reddit", netflix: "Netflix",
  disney: "DisneyPlus", "streaming-west": "HBOMax", "streaming-asia": "Bahamut", steam: "Steam", "gaming-pc": "EpicGames",
  "gaming-console": "PlayStation", github: "GitHub", cloud: "Cloudflare", "dev-tools": "Docker", storage: "Dropbox",
  payment: "PayPal", crypto: "Binance", "google-scholar": "GoogleScholar", education: "Wikipedia", news: "BBC", shopping: "Amazon", adult: "Play",
};
const aliases: Record<string, string[]> = {
  GoogleScholar: ["谷歌学术", "google scholar"], GoogleAI: ["gemini", "谷歌ai"], Google: ["谷歌"],
  Cloudflare: ["cf", "云服务"], Binance: ["币安", "加密货币"], Telegram: ["电报"], Netflix: ["奈飞", "网飞"],
  YouTube: ["油管"], Microsoft: ["微软"], Apple: ["苹果"], X: ["twitter", "推特"], Wikipedia: ["维基百科"],
  Japan: ["日本", "jp", "🇯🇵"], HongKong: ["香港", "hong kong", "hk", "🇭🇰"], "CN-Taiwan": ["台湾", "taiwan", "tw", "🇹🇼"], Singapore: ["新加坡", "sg", "🇸🇬"],
  US: ["美国", "united states", "usa", "us", "🇺🇸"], UK: ["英国", "united kingdom", "uk", "gb", "🇬🇧"], Korea: ["韩国", "south korea", "kr", "🇰🇷"],
};
const normalize = (s: string) => s.normalize("NFKC").toLowerCase();
function containsAlias(name: string, alias: string): boolean {
  const a = normalize(alias);
  if (/[^\x00-\x7f]/.test(a)) return name.includes(a);
  const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "u").test(name);
}
export function matchGroupIcon(name: string): string | undefined {
  const n = normalize(name);
  const matches = catalogue.flatMap(i => {
    const hits = [i.id, i.label, ...(aliases[i.id] ?? [])].filter(a => containsAlias(n, a));
    const best = hits.sort((a,b) => b.length-a.length)[0];
    return best ? [{ id: i.id, alias: normalize(best), length: best.length }] : [];
  }).sort((a,b) => b.length - a.length);
  // Prefer the specific compound brand (Google Scholar over Google); ties are ambiguous.
  const best = matches[0];
  return best && matches.slice(1).every(other => best.alias.includes(other.alias) && best.length > other.length) ? best.id : undefined;
}
export function iconUrl(id?: string): string | undefined {
  const icon = id ? byId.get(id) : undefined;
  return icon ? `https://raw.githubusercontent.com/xiangwan6667/Oasisic-Icons/${OASISIC_REVISION}/${icon.path}` : undefined;
}
const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });
export function splitGroupEmoji(name: string): { emoji: string; label: string } {
  let offset = 0;
  for (const { segment, index } of graphemes.segment(name.trim())) {
    if (/^\s+$/u.test(segment) || /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(segment)) offset = index + segment.length;
    else break;
  }
  const s = name.trim();
  return { emoji: s.slice(0, offset).trim(), label: s.slice(offset).trim() || s };
}
export function resolveGroupAppearance(settings: GroupAppearance | undefined, key: string, name: string, defaultIconId?: string) {
  const global = settings ?? legacyGroupAppearance();
  const group = global.groups[key] ?? {};
  const parts = splitGroupEmoji(name);
  const emoji = group.emoji ?? parts.emoji;
  const showEmoji = global.emojisEnabled && group.emojiEnabled !== false;
  const id = group.iconMode === "manual" ? group.iconId : defaultIconId ?? matchGroupIcon(name);
  return {
    name: showEmoji && emoji ? `${emoji} ${parts.label}` : parts.label,
    icon: global.imagesEnabled && group.imageEnabled !== false ? iconUrl(id) : undefined,
    iconId: id,
  };
}
export function normalizeGroupAppearance(value: unknown): GroupAppearance | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.imagesEnabled !== "boolean" || typeof v.emojisEnabled !== "boolean" || !v.groups || typeof v.groups !== "object" || Array.isArray(v.groups)) return undefined;
  const groups: GroupAppearance["groups"] = {};
  for (const [key, raw] of Object.entries(v.groups)) {
    if (!/^(module|custom|dialer):.+/.test(key) || !raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const g = raw as GroupAppearanceOverride;
    if ((g.imageEnabled !== undefined && typeof g.imageEnabled !== "boolean") || (g.emojiEnabled !== undefined && typeof g.emojiEnabled !== "boolean") || (g.iconMode !== undefined && g.iconMode !== "auto" && g.iconMode !== "manual") || (g.iconId !== undefined && (typeof g.iconId !== "string" || !byId.has(g.iconId))) || (g.emoji !== undefined && (typeof g.emoji !== "string" || g.emoji.length > 64 || /[,\r\n]/.test(g.emoji)))) return undefined;
    groups[key] = { ...g };
  }
  return { imagesEnabled: v.imagesEnabled, emojisEnabled: v.emojisEnabled, groups };
}

export interface AppearanceTarget { key: string; name: string; defaultIconId?: string }
/** Shared whole-set allocation keeps preview and YAML collision suffixes identical. */
export function allocateGroupPresentations(groups: { name: string }[], settings: GroupAppearance, targets: AppearanceTarget[], nodeNames: string[]) {
  const reserved = new Set(["DIRECT", "REJECT", "REJECT-DROP", "PASS", "COMPATIBLE", ...nodeNames]);
  const presentations = new Map(targets.map(t=>[t.name, resolveGroupAppearance(settings,t.key,t.name,t.defaultIconId)]));
  for (const g of groups) {
    const p = presentations.get(g.name) ?? { name: g.name, icon: undefined, iconId: undefined };
    const base = p.name;
    let candidate = base, i = 2;
    while (reserved.has(candidate)) candidate = `${base} (${i++})`;
    reserved.add(candidate); presentations.set(g.name,{ ...p, name: candidate });
  }
  return presentations;
}
/** Resolve names once after generation, then rewrite only typed policy reference fields. */
export function applyGroupAppearance(config: ClashConfig, settings: GroupAppearance | undefined, targets: AppearanceTarget[]): ClashConfig {
  if (!settings) return config;
  const groups = config["proxy-groups"] ?? [];
  const presentations = allocateGroupPresentations(groups,settings,targets,(config.proxies ?? []).map(p => p.name));
  const names = new Map(groups.map(g=>[g.name,presentations.get(g.name)!.name]));
  const ref = (n: string) => names.get(n) ?? n;
  const rules = (config.rules ?? []).map(rule => {
    const parts = rule.split(",");
    const index = parts.at(-1)?.trim() === "no-resolve" ? parts.length-2 : parts.length-1;
    parts[index] = ref(parts[index]);
    return parts.join(",");
  });
  return {
    ...config,
    "proxy-groups": groups.map(g => ({ ...g, name: ref(g.name), icon: presentations.get(g.name)?.icon, ...(g.proxies ? { proxies: g.proxies.map(ref) } : {}) })),
    proxies: (config.proxies ?? []).map(p => typeof p["dialer-proxy"] === "string" ? {...p, "dialer-proxy":ref(p["dialer-proxy"])} : p),
    ...(Array.isArray(config.listeners) ? { listeners: config.listeners.map(l => l && typeof l === "object" && typeof l.proxy === "string" ? { ...l, proxy: ref(l.proxy) } : l) } : {}),
    rules,
  };
}
