import type { ProxyGroup } from "../types/config";
import { stripLeadingGroupEmoji } from "../proxy-group-name";
import { getBuiltinGroupIcon, matchGroupIcon, resolveGroupIcon } from "./group-icons";

type Options = {
  showEmoji: boolean;
  showIcons: boolean;
  customGroups: Array<{ id?: string; name: string; description?: string }>;
  presetGroups?: Array<{ name: string; moduleId: string }>;
  iconOverrides?: Record<string, string>;
};

function rewriteRule(rule: unknown, names: Map<string, string>): unknown {
  if (typeof rule !== "string") return rule;
  const parts = rule.split(",");
  const targetIndex = parts.length - (parts[parts.length - 1]?.trim().toLowerCase() === "no-resolve" ? 2 : 1);
  if (targetIndex < 1) return rule;
  const replacement = names.get(parts[targetIndex].trim());
  if (replacement) parts[targetIndex] = replacement;
  return parts.join(",");
}

function rewriteReferences(value: unknown, names: Map<string, string>): unknown {
  if (Array.isArray(value)) return value.map((item) => rewriteReferences(item, names));
  if (!value || typeof value !== "object") return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    (key === "proxy" || key === "dialer-proxy") && typeof item === "string"
      ? names.get(item) ?? item
      : key === "proxies" && record.type === "relay" && Array.isArray(item)
        ? item.map((name) => typeof name === "string" ? names.get(name) ?? name : name)
      : rewriteReferences(item, names),
  ]));
}

function rewriteDns(value: unknown, names: Map<string, string>): unknown {
  if (typeof value === "string") {
    const hash = value.lastIndexOf("#");
    if (hash < 0) return value;
    const suffix = value.slice(hash + 1);
    const amp = suffix.indexOf("&");
    const target = amp < 0 ? suffix : suffix.slice(0, amp);
    const replacement = names.get(target);
    return replacement ? `${value.slice(0, hash + 1)}${replacement}${amp < 0 ? "" : suffix.slice(amp)}` : value;
  }
  if (Array.isArray(value)) return value.map((item) => rewriteDns(item, names));
  if (!value || typeof value !== "object") return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteDns(item, names)]));
}

/** Apply display settings after routing is assembled so every generated reference stays aligned. */
export function applyGroupPresentation(config: Record<string, unknown>, options: Options): Record<string, unknown> {
  const groups = Array.isArray(config["proxy-groups"]) ? config["proxy-groups"] as ProxyGroup[] : [];
  const names = new Map<string, string>();
  if (!options.showEmoji) {
    const used = new Set<string>(["DIRECT", "REJECT", "REJECT-DROP", "PASS", "COMPATIBLE", "GLOBAL"]);
    if (Array.isArray(config.proxies)) {
      for (const node of config.proxies) {
        if (node && typeof node === "object" && typeof node.name === "string") used.add(node.name);
      }
    }
    for (const group of groups) {
      if (stripLeadingGroupEmoji(group.name) === group.name) used.add(group.name);
    }
    for (const group of groups) {
      const base = stripLeadingGroupEmoji(group.name);
      if (base === group.name) continue;
      let name = base;
      for (let number = 2; used.has(name); number += 1) name = `${base} (${number})`;
      used.add(name);
      names.set(group.name, name);
    }
  }

  const descriptions = new Map<string, string>();
  for (const group of options.customGroups) {
    const name = typeof group?.name === "string" ? group.name.trim() : "";
    if (name) descriptions.set(name, typeof group.description === "string" ? group.description : "");
  }
  const nextGroups = groups.map((group) => {
    const { icon: existingIcon, ...rest } = group;
    const preset = options.presetGroups?.find((item) => item.name === group.name);
    const automaticIcon = options.showIcons && !existingIcon
      ? preset
        ? getBuiltinGroupIcon(preset.moduleId)
        : descriptions.has(group.name)
          ? matchGroupIcon(group.name, descriptions.get(group.name))
          : undefined
      : undefined;
    const custom = options.customGroups.find((item) => typeof item?.name === "string" && item.name.trim() === group.name);
    const key = preset ? `module:${preset.moduleId}` : custom?.id ? `custom:${custom.id}` : "";
    const icon = options.showIcons
      ? resolveGroupIcon(options.iconOverrides, key, existingIcon || automaticIcon)
      : undefined;
    return {
      ...rest,
      name: names.get(group.name) ?? group.name,
      ...(Array.isArray(group.proxies) ? { proxies: group.proxies.map((name) => names.get(name) ?? name) } : {}),
      ...(icon ? { icon } : {}),
    };
  });

  const result: Record<string, unknown> = { ...config, "proxy-groups": nextGroups };
  if (names.size === 0) return result;
  for (const key of ["proxies", "listeners", "proxy-providers"]) {
    if (result[key] !== undefined) result[key] = rewriteReferences(result[key], names);
  }
  if (Array.isArray(result.rules)) result.rules = result.rules.map((rule) => rewriteRule(rule, names));
  if (result["sub-rules"] && typeof result["sub-rules"] === "object" && !Array.isArray(result["sub-rules"])) {
    result["sub-rules"] = Object.fromEntries(Object.entries(result["sub-rules"]).map(([key, rules]) => [
      key, Array.isArray(rules) ? rules.map((rule) => rewriteRule(rule, names)) : rules,
    ]));
  }
  if (result.dns !== undefined) result.dns = rewriteDns(result.dns, names);
  return result;
}
