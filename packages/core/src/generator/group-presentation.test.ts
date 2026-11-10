import { describe, expect, it } from "vitest";
import { matchGroupIcon } from "./group-icons";
import { applyGroupPresentation } from "./group-presentation";
import { generateClashConfig } from "./index";
import { buildGenerateOptionsFromConfig } from "../subscription/config-utils";

describe("group icon matching", () => {
  it("uses the name first and falls back to an unambiguous description", () => {
    expect(matchGroupIcon("🐱 GitHub 服务")).toContain("/Microsoft/GitHub/GitHub.png");
    expect(matchGroupIcon("Google Play")).toContain("/Google/GooglePlay/GooglePlay.png");
    expect(matchGroupIcon("我的服务", "使用 Dropbox")).toContain("/CloudStorage/Dropbox/Dropbox.png");
    expect(matchGroupIcon("📲 电报消息")).toContain("/Communication/Telegram/Telegram.png");
    expect(matchGroupIcon("奈飞")).toContain("/Media/Netflix/Netflix.png");
    expect(matchGroupIcon("Gemini")).toContain("/Google/GoogleAI/GoogleAI.png");
    expect(matchGroupIcon("Twitter")).toContain("/SpaceXAI/X/X.png");
    expect(matchGroupIcon("没有匹配项")).toBeUndefined();
    expect(matchGroupIcon("GitHub 和 Discord", "Dropbox")).toBeUndefined();
    expect(matchGroupIcon("mygithubservice")).toBeUndefined();
  });
});

describe("independent group display options", () => {
  it.each([
    [true, true], [true, false], [false, true], [false, false],
  ])("keeps references valid with emoji=%s and icons=%s", (showEmoji, showIcons) => {
    const input = {
      proxies: [{ name: "Node", "dialer-proxy": "🐱 GitHub" }],
      "proxy-groups": [
        { name: "🚀 选择", type: "select", proxies: ["🐱 GitHub"] },
        { name: "🐱 GitHub", type: "select", proxies: ["Node"] },
        { name: "🚀 Google", type: "select", proxies: ["Node"] },
      ],
      rules: ["DOMAIN,example.test,🐱 GitHub", "MATCH,🚀 选择"],
      listeners: [{ proxy: "🐱 GitHub" }],
      "proxy-providers": { upstream: { proxy: "🚀 选择" } },
      dns: { nameserver: ["https://dns.example/dns-query#🐱 GitHub"] },
    };
    const result = applyGroupPresentation(input, {
      showEmoji, showIcons, customGroups: [{ name: "🐱 GitHub" }],
    });
    const names = showEmoji ? ["🚀 选择", "🐱 GitHub", "🚀 Google"] : ["选择", "GitHub", "Google"];
    const groups = result["proxy-groups"] as Array<{ name: string; proxies: string[]; icon?: string }>;
    expect(groups.map((group) => group.name)).toEqual(names);
    expect(groups[0].proxies).toEqual([names[1]]);
    expect(Boolean(groups[1].icon)).toBe(showIcons);
    expect(groups[0].icon).toBeUndefined();
    // Without module metadata, a name alone must not be treated as a preset.
    expect(groups[2].icon).toBeUndefined();
    expect(result.rules).toEqual([`DOMAIN,example.test,${names[1]}`, `MATCH,${names[0]}`]);
    expect(result.listeners).toEqual([{ proxy: names[1] }]);
    expect(result.proxies).toEqual([{ name: "Node", "dialer-proxy": names[1] }]);
    expect(result["proxy-providers"]).toEqual({ upstream: { proxy: names[0] } });
    expect(result.dns).toEqual({ nameserver: [`https://dns.example/dns-query#${names[1]}`] });
    expect(input["proxy-groups"][1].name).toBe("🐱 GitHub");
  });

  it("avoids collisions with node names, reserved targets and other groups", () => {
    const result = applyGroupPresentation({
      proxies: [{ name: "GitHub" }],
      "proxy-groups": [
        { name: "🐱 GitHub", type: "select", proxies: ["GitHub"] },
        { name: "🐶 GitHub", type: "select", proxies: ["🐱 GitHub"] },
        { name: "🎯 DIRECT", type: "select", proxies: [] },
      ],
      rules: ["MATCH,🐶 GitHub"],
    }, { showEmoji: false, showIcons: false, customGroups: [] });
    const groups = result["proxy-groups"] as Array<{ name: string; proxies: string[] }>;
    expect(groups.map((group) => group.name)).toEqual(["GitHub (2)", "GitHub (3)", "DIRECT (2)"]);
    expect(groups[0].proxies).toEqual(["GitHub"]);
    expect(groups[1].proxies).toEqual(["GitHub (2)"]);
    expect(result.rules).toEqual(["MATCH,GitHub (3)"]);
  });

  it("updates relay references without changing binary or date-valued fields", () => {
    const bytes = new Uint8Array([1, 2]);
    const date = new Date("2026-01-01T00:00:00Z");
    const result = applyGroupPresentation({
      proxies: [{ name: "relay", type: "relay", proxies: ["🐱 GitHub"], bytes, date }],
      "proxy-groups": [{ name: "🐱 GitHub", type: "select", proxies: [] }],
    }, { showEmoji: false, showIcons: false, customGroups: [] });
    expect(result.proxies).toEqual([{ name: "relay", type: "relay", proxies: ["GitHub"], bytes, date }]);
  });

  it("removes emoji prefixes without stripping ordinary punctuation", () => {
    const result = applyGroupPresentation({
      "proxy-groups": [
        { name: "--- Group", type: "select" },
        { name: "🇭🇰 Hong Kong", type: "select" },
        { name: "1️⃣ First", type: "select" },
        { name: "₿ 加密货币", type: "select" },
      ],
    }, { showEmoji: false, showIcons: false, customGroups: [] });
    expect((result["proxy-groups"] as Array<{ name: string }>).map((group) => group.name))
      .toEqual(["--- Group", "Hong Kong", "First", "加密货币"]);
  });

  it("ignores malformed custom group metadata while matching icons", () => {
    const result = applyGroupPresentation({ "proxy-groups": [{ name: "Unknown", type: "select" }] }, {
      showEmoji: true,
      showIcons: true,
      customGroups: [null, { name: 1 }] as unknown as Array<{ name: string }>,
    });
    expect(result["proxy-groups"]).toEqual([{ name: "Unknown", type: "select" }]);
  });

  it("keeps saved settings in server regeneration and bound listeners", () => {
    const nodes = [{ name: "Node", type: "ss" as const, server: "example.test", port: 443, cipher: "aes-128-gcm", password: "x" }];
    const options = buildGenerateOptionsFromConfig({
      enabledGroups: ["select", "final"], dnsYaml: "", showGroupEmoji: false, showGroupIcons: true,
      customProxyGroups: [{ id: "github", name: "🐱 GitHub", emoji: "🐱", groupType: "select" }],
      groupListeners: [{ id: "listener", target: { kind: "custom", id: "github" }, port: 7891 }],
    }, { nodes });
    const result = generateClashConfig(options);
    const group = result["proxy-groups"]?.find((item) => item.name === "GitHub");
    expect(group?.icon).toContain("/Microsoft/GitHub/GitHub.png");
    expect(result.listeners).toContainEqual(expect.objectContaining({ port: 7891, proxy: "GitHub" }));
  });

  it("uses the approved preset icon when a legacy custom group shares its name", () => {
    const result = generateClashConfig({
      nodes: [{ name: "Node", type: "ss", server: "example.test", port: 443, cipher: "aes-128-gcm", password: "x" }],
      userConfig: { dnsYaml: "", enabledGroups: ["select", "final"], showGroupIcons: true },
      customProxyGroups: [{ id: "duplicate", name: "🚀 节点选择", emoji: "🚀", description: "GitHub", groupType: "select" }],
    });
    const groups = result["proxy-groups"]?.filter((group) => group.name === "🚀 节点选择") ?? [];
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((group) => group.icon?.endsWith("/System/Proxy/Proxy.png"))).toBe(true);
  });
});
