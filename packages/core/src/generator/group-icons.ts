import catalog from "./oasisic-icons.json";
import { stripLeadingGroupEmoji } from "../proxy-group-name";

// Snapshot of Oasisic-Icons' brand catalog; the pinned revision keeps URLs stable.
const ICON_BASE = "https://raw.githubusercontent.com/xiangwan6667/Oasisic-Icons/272c0720b884db4f7664b736cf00f4d549a9e527/";

type IconEntry = { id: string; name: string; path: string };
const icons: IconEntry[] = catalog.map(([id, name, path]) => ({ id, name, path }));
const iconsById = new Map(icons.map((icon) => [icon.id, icon]));

/** Default selections confirmed for the built-in modules. Keys are stable module IDs. */
export const BUILTIN_GROUP_ICONS: Readonly<Record<string, string>> = {
  select: "Proxy",
  auto: "Auto",
  ad: "Reject",
  private: "Direct",
  cn: "China",
  global: "Global",
  final: "Final",
  ai: "GeneralAI",
  gemini: "GoogleAI",
  youtube: "YouTube",
  google: "Google",
  microsoft: "Microsoft",
  apple: "Apple",
  telegram: "Telegram",
  twitter: "X",
  meta: "Meta",
  discord: "Discord",
  "social-other": "Reddit",
  netflix: "Netflix",
  disney: "DisneyPlus",
  "streaming-west": "HBOMax",
  "streaming-asia": "Bahamut",
  steam: "Steam",
  "gaming-pc": "EpicGames",
  "gaming-console": "PlayStation",
  github: "GitHub",
  cloud: "Cloudflare",
  "dev-tools": "Docker",
  storage: "Dropbox",
  payment: "PayPal",
  crypto: "Binance",
  "google-scholar": "GoogleScholar",
  education: "Wikipedia",
  news: "BBC",
  shopping: "Amazon",
  adult: "Play",
};

export function getGroupIconUrl(id: string): string | undefined {
  const icon = iconsById.get(id);
  if (!icon) return undefined;
  return ICON_BASE + icon.path.split("/").map(encodeURIComponent).join("/");
}

export function getBuiltinGroupIcon(moduleId: string): string | undefined {
  const id = Object.hasOwn(BUILTIN_GROUP_ICONS, moduleId) ? BUILTIN_GROUP_ICONS[moduleId] : undefined;
  return id ? getGroupIconUrl(id) : undefined;
}

/** Missing entries use automatic matching; an empty selection explicitly hides an icon. */
export function normalizeGroupIconOverrides(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, id]) => {
    const match = /^(module|custom):(.{1,256})$/.exec(key);
    return match && (match[1] === "custom" || Object.hasOwn(BUILTIN_GROUP_ICONS, match[2])) &&
      typeof id === "string" && (id === "" || iconsById.has(id));
  }));
}

export function resolveGroupIcon(
  overrides: Record<string, string> | undefined,
  key: string,
  automaticIcon: string | undefined,
): string | undefined {
  const selected = overrides && Object.hasOwn(overrides, key) ? overrides[key] : undefined;
  if (selected === "") return undefined;
  return typeof selected === "string" ? getGroupIconUrl(selected) ?? automaticIcon : automaticIcon;
}
const aliases: Record<string, readonly string[]> = {
  OpenAI: ["ChatGPT"],
  GoogleAI: ["Gemini", "Google Gemini", "Bard"],
  YouTube: ["油管"],
  Google: ["谷歌"],
  GoogleScholar: ["谷歌学术", "Google 学术"],
  Binance: ["币安", "Binance 国际版"],
  Amazon: ["亚马逊"],
  Microsoft: ["微软"],
  Apple: ["苹果"],
  Telegram: ["电报", "纸飞机"],
  X: ["Twitter", "推特"],
  Facebook: ["脸书"],
  Netflix: ["奈飞", "网飞"],
  Discord: ["迪斯科德"],
};

function termsFor(icon: IconEntry): readonly string[] {
  return [icon.id, icon.name, ...(aliases[icon.id] ?? [])];
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

export function searchGroupIcons(query: string): readonly IconEntry[] {
  const search = normalize(query);
  return icons.filter((icon) => [...termsFor(icon), icon.path].some((term) => normalize(term).includes(search)));
}

function termPositions(text: string, term: string): number[] {
  const positions: number[] = [];
  let index = text.indexOf(term);
  while (index !== -1) {
    const before = text[index - 1] ?? "";
    const after = text[index + term.length] ?? "";
    if (!(/[a-z0-9]/.test(term[0]) && /[a-z0-9]/.test(before)) &&
        !(/[a-z0-9]/.test(term[term.length - 1]) && /[a-z0-9]/.test(after))) positions.push(index);
    index = text.indexOf(term, index + 1);
  }
  return positions;
}

// null means that multiple equally plausible brands were found.
function findIcon(text: string): IconEntry | null | undefined {
  const input = normalize(stripLeadingGroupEmoji(text));
  if (!input) return undefined;
  const exact = icons.filter((icon) => termsFor(icon).some((term) => normalize(term) === input));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  const found: Array<{ icon: IconEntry; start: number; end: number }> = [];
  for (const icon of icons) {
    for (const rawTerm of termsFor(icon)) {
      const term = normalize(rawTerm);
      // Short identifiers such as X, US, or 123 are too ambiguous inside a name.
      if (term.length < 3 && /^[a-z0-9]+$/.test(term)) continue;
      if (!term) continue;
      for (const start of termPositions(input, term)) found.push({ icon, start, end: start + term.length });
    }
  }
  const matches = new Map<string, IconEntry>();
  for (const candidate of found) {
    const covered = found.some((other) => other.start <= candidate.start && other.end >= candidate.end &&
      other.end - other.start > candidate.end - candidate.start);
    if (!covered) matches.set(candidate.icon.id, candidate.icon);
  }
  return matches.size === 1 ? matches.values().next().value : matches.size > 1 ? null : undefined;
}

/** Match only an unambiguous brand, preferring the group name over its description. */
export function matchGroupIcon(name: string, description = ""): string | undefined {
  const byName = findIcon(name);
  const match = byName === undefined ? findIcon(description) : byName;
  return match ? getGroupIconUrl(match.id) : undefined;
}
