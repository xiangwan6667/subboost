import { describe, expect, it } from "vitest";
import { BUILTIN_GROUP_ICONS, getBuiltinGroupIcon, getGroupIconUrl, matchGroupIcon, normalizeGroupIconOverrides, resolveGroupIcon, searchGroupIcons } from "./group-icons";
import { PROXY_GROUP_MODULES } from "./proxy-group-modules";
import { generateClashConfig } from "./index";
import { buildGenerateOptionsFromConfig } from "../subscription/config-utils";
import { stripLeadingGroupEmoji } from "../proxy-group-name";

describe("manual group icons", () => {
  it.each(["台湾", "台湾节点", "台灣節點", "臺灣家寬", "Taiwan Nodes", "🇹🇼 台湾节点"])(
    "matches the Taiwan icon for %s", (name) => {
      expect(matchGroupIcon(name)).toBe(getGroupIconUrl("CN-Taiwan"));
    },
  );

  it("finds Taiwan by Chinese alias in the manual picker and in group descriptions", () => {
    expect(searchGroupIcons("台湾").map((icon) => icon.id)).toContain("CN-Taiwan");
    expect(matchGroupIcon("自定义分组", "台湾家宽")).toBe(getGroupIconUrl("CN-Taiwan"));
  });

  it("searches the existing catalog with Chinese aliases and normalized brand names", () => {
    expect(searchGroupIcons("币安").map((icon) => icon.id)).toEqual(["Binance"]);
    expect(searchGroupIcons("谷歌学术").map((icon) => icon.id)).toEqual(["GoogleScholar"]);
    expect(searchGroupIcons("ＡＭＡＺＯＮ").map((icon) => icon.id)).toContain("Amazon");
    expect(searchGroupIcons("missing-brand")).toEqual([]);
  });
  it("rejects unknown icons and unsafe keys while preserving automatic and hidden selections", () => {
    const input = { "module:select": "Google", "custom:one": "", "module:missing": "Google", "custom:two": "invalid", "__proto__": "Google" };
    expect(normalizeGroupIconOverrides(input)).toEqual({ "module:select": "Google", "custom:one": "" });
    expect(normalizeGroupIconOverrides(null)).toEqual({});
    expect(normalizeGroupIconOverrides([])).toEqual({});
    expect(resolveGroupIcon({ "module:select": "invalid" }, "module:select", "fallback")).toBe("fallback");
  });

  it.each([[true, true], [true, false], [false, true], [false, false]])(
    "preserves manual choices through refresh and renaming with emoji=%s and icons=%s",
    (showGroupEmoji, showGroupIcons) => {
      const overrides = { "module:select": "Google", "module:final": "", "custom:one": "Amazon" };
      const generated = generateClashConfig(buildGenerateOptionsFromConfig({
        enabledGroups: ["select", "final"], dnsYaml: "", showGroupEmoji, showGroupIcons,
        proxyGroupNameOverrides: { select: "🚀 已改名" }, groupIconOverrides: overrides,
        customProxyGroups: [{ id: "one", name: "🐱 GitHub", emoji: "🐱", groupType: "select" }],
      }, { nodes: [{ name: "Node", type: "ss", server: "example.test", port: 443, cipher: "aes-128-gcm", password: "x" }] }));
      const group = (name: string) => generated["proxy-groups"]?.find((item) => item.name === (showGroupEmoji ? name : stripLeadingGroupEmoji(name)));
      expect(group("🚀 已改名")?.icon).toBe(showGroupIcons ? getGroupIconUrl("Google") : undefined);
      expect(group("🐱 GitHub")?.icon).toBe(showGroupIcons ? getGroupIconUrl("Amazon") : undefined);
      expect(generated["proxy-groups"]?.filter((item) => item.icon).length).toBe(showGroupIcons ? 2 : 0);
      expect(overrides).toEqual({ "module:select": "Google", "module:final": "", "custom:one": "Amazon" });
    },
  );
});

describe("approved preset icons", () => {
  it("covers all modules, including hidden-by-default modules, using the selected brands", () => {
    expect(Object.keys(BUILTIN_GROUP_ICONS).sort()).toEqual(PROXY_GROUP_MODULES.map((group) => group.id).sort());
    expect(BUILTIN_GROUP_ICONS).toMatchObject({
      ad: "Reject", "social-other": "Reddit", "gaming-pc": "EpicGames", shopping: "Amazon",
      crypto: "Binance", "google-scholar": "GoogleScholar", adult: "Play",
    });
    expect(PROXY_GROUP_MODULES.every((group) => getBuiltinGroupIcon(group.id))).toBe(true);
    expect(getBuiltinGroupIcon("unknown")).toBeUndefined();
  });

  it("pins all icon URLs to one immutable catalog revision", () => {
    const urls = PROXY_GROUP_MODULES.map((group) => getBuiltinGroupIcon(group.id));
    expect(urls.every((url) => /^https:\/\/raw\.githubusercontent\.com\/xiangwan6667\/Oasisic-Icons\/[a-f0-9]{40}\//.test(url ?? ""))).toBe(true);
    expect(new Set(urls.map((url) => new URL(url!).pathname.split("/")[3])).size).toBe(1);
    expect(getGroupIconUrl("unknown")).toBeUndefined();
  });

  it("recognizes the maintained brands and the additional named groups shown in the reference", () => {
    expect(matchGroupIcon("谷歌学术")).toContain("/Google/GoogleScholar/GoogleScholar.png");
    expect(matchGroupIcon("Google Scholar")).toContain("/Google/GoogleScholar/GoogleScholar.png");
    expect(matchGroupIcon("币安")).toContain("/Payment/Binance/Binance.png");
    expect(matchGroupIcon("亚马逊")).toContain("/Amazon/Amazon/Amazon.png");
    expect(matchGroupIcon("EMBY")).toContain("/Media/Emby/Emby.png");
    expect(matchGroupIcon("TikTok")).toContain("/ByteDance/TikTok/TikTok.png");
    expect(matchGroupIcon("Abema")).toMatch(/\/[^/]+\/[^/]+\.png$/);
    expect(matchGroupIcon("美国节点")).toBeDefined();
  });

  it.each([[true, true], [true, false], [false, true], [false, false]])(
    "uses stable module IDs after renaming with emoji=%s and icons=%s",
    (showGroupEmoji, showGroupIcons) => {
      const renamed = "🚀 我的选择";
      const config = generateClashConfig(buildGenerateOptionsFromConfig({
        enabledGroups: PROXY_GROUP_MODULES.map((group) => group.id),
        dnsYaml: "", showGroupEmoji, showGroupIcons,
        proxyGroupNameOverrides: { select: renamed },
      }, {
        nodes: [{ name: "Node", type: "ss", server: "example.test", port: 443, cipher: "aes-128-gcm", password: "x" }],
      }));
      for (const preset of PROXY_GROUP_MODULES) {
        const name = preset.id === "select" ? renamed : preset.name;
        const group = config["proxy-groups"]?.find((item) => item.name === (showGroupEmoji ? name : stripLeadingGroupEmoji(name)));
        expect(group, preset.id).toBeDefined();
        expect(group?.icon, preset.id).toBe(showGroupIcons ? getBuiltinGroupIcon(preset.id) : undefined);
      }
    },
  );
});
