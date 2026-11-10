import { PROXY_GROUP_MODULES } from "@subboost/core/generator/proxy-group-modules";

/** Local editor preferences; independent from the generated proxyGroupOrder. */
export type ProxyGroupEditorOrder = Record<string, string[]>;

export function normalizeProxyGroupEditorOrder(value: unknown): ProxyGroupEditorOrder {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries: Array<[string, string[]]> = [];
  for (const [category, raw] of Object.entries(value)) {
    if ((category !== "custom" && !PROXY_GROUP_MODULES.some((module) => module.category === category)) || !Array.isArray(raw)) continue;
    const allowed = category === "custom" ? null : new Set(
      PROXY_GROUP_MODULES.filter((module) => module.category === category).map((module) => module.id),
    );
    const ids = [...new Set(raw.filter((id): id is string =>
      typeof id === "string" && id.length > 0 && id.length <= 256 && id.trim() === id &&
      (allowed === null || allowed.has(id)),
    ))];
    entries.push([category, ids]);
  }
  return Object.fromEntries(entries);
}

export function sortProxyGroupsForEditor<T extends { id: string }>(groups: readonly T[], order: readonly string[] = []): T[] {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const result: T[] = [];
  for (const id of [...order, ...groups.map((group) => group.id)]) {
    const group = byId.get(id);
    if (!group) continue;
    result.push(group);
    byId.delete(id);
  }
  return result;
}

export function moveProxyGroupToPosition(ids: readonly string[], id: string, position: number): string[] | null {
  const from = ids.indexOf(id);
  if (from < 0 || !Number.isFinite(position)) return null;
  const to = Math.max(0, Math.min(ids.length - 1, Math.floor(position) - 1));
  if (from === to) return null;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

export function dropProxyGroup(ids: readonly string[], id: string, targetId: string, after: boolean): string[] | null {
  if (id === targetId || !ids.includes(id) || !ids.includes(targetId)) return null;
  const next = ids.filter((key) => key !== id);
  next.splice(next.indexOf(targetId) + (after ? 1 : 0), 0, id);
  return next.every((key, index) => key === ids[index]) ? null : next;
}
