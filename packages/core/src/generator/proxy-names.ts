import type { ParsedNode } from "../types/node";

/**
 * Clash 要求 proxies.name 全局唯一，否则会报 duplicate name。
 * 多机场/多订阅源合并时经常出现同名节点，因此在生成前做一次“稳定重命名”。
 *
 * 规则：保留第一次出现的原名；从第二次起追加 " (2)/(3)..." 后缀。
 */

export function ensureUniqueProxyNames(nodes: ParsedNode[]): ParsedNode[] {
  const used = new Set<string>();
  const counter = new Map<string, number>();

  return nodes.map((node) => {
    const baseRaw = typeof node?.name === "string" ? node.name : String((node as unknown as { name?: unknown })?.name ?? "");
    const base = baseRaw.trim() || "未命名节点";

    if (!used.has(base)) {
      used.add(base);
      counter.set(base, 1);
      return base === node.name ? node : ({ ...(node as unknown as Record<string, unknown>), name: base } as unknown as ParsedNode);
    }

    let i = counter.get(base) || 1;
    let candidate = `${base} (${i + 1})`;
    while (used.has(candidate)) {
      i += 1;
      candidate = `${base} (${i + 1})`;
    }

    counter.set(base, i + 1);
    used.add(candidate);
    return { ...(node as unknown as Record<string, unknown>), name: candidate } as unknown as ParsedNode;
  });
}
