import { describe, expect, it } from "vitest";
import { dropProxyGroup, moveProxyGroupToPosition, normalizeProxyGroupEditorOrder, sortProxyGroupsForEditor } from "./proxy-group-editor-order";

describe("independent editor group order", () => {
  it("normalizes each category independently and rejects unrelated or unsafe keys", () => {
    expect(normalizeProxyGroupEditorOrder({
      core: ["auto", "select", "auto", "youtube", 1],
      service: ["youtube", "google", "auto"],
      custom: ["custom-1", "custom-2", "custom-1", "", " x "],
      missing: ["select"], constructor: ["select"],
    })).toEqual({ core: ["auto", "select"], service: ["youtube", "google"], custom: ["custom-1", "custom-2"] });
    for (const value of [null, [], "bad", { core: "auto" }]) {
      expect(normalizeProxyGroupEditorOrder(value)).toEqual({});
    }
  });

  it("keeps disabled groups sortable, appends new groups, and ignores deleted IDs without changing objects", () => {
    const groups = [{ id: "one", enabled: true }, { id: "two", enabled: false }, { id: "new", enabled: true }];
    const sorted = sortProxyGroupsForEditor(groups, ["deleted", "two", "one", "two"]);
    expect(sorted.map((group) => group.id)).toEqual(["two", "one", "new"]);
    expect(sorted[0]).toBe(groups[1]);
    expect(groups.map((group) => group.id)).toEqual(["one", "two", "new"]);
    expect(sortProxyGroupsForEditor(groups)).toEqual(groups);
  });

  it("moves to a category-local number with bounded positions", () => {
    const ids = ["one", "two", "three"];
    expect(moveProxyGroupToPosition(ids, "one", 3)).toEqual(["two", "three", "one"]);
    expect(moveProxyGroupToPosition(ids, "three", 0)).toEqual(["three", "one", "two"]);
    expect(moveProxyGroupToPosition(ids, "one", 99)).toEqual(["two", "three", "one"]);
    for (const [id, position] of [["one", 1], ["absent", 2], ["one", Number.NaN], ["one", Infinity]] as const) {
      expect(moveProxyGroupToPosition(ids, id, position)).toBeNull();
    }
    expect(ids).toEqual(["one", "two", "three"]);
  });

  it("drops before or after a target and rejects foreign-category IDs", () => {
    const ids = ["one", "two", "three"];
    expect(dropProxyGroup(ids, "one", "three", false)).toEqual(["two", "one", "three"]);
    expect(dropProxyGroup(ids, "one", "three", true)).toEqual(["two", "three", "one"]);
    expect(dropProxyGroup(ids, "three", "one", false)).toEqual(["three", "one", "two"]);
    expect(dropProxyGroup(ids, "one", "one", true)).toBeNull();
    expect(dropProxyGroup(ids, "one", "two", false)).toBeNull();
    expect(dropProxyGroup(ids, "foreign", "one", true)).toBeNull();
    expect(dropProxyGroup(ids, "one", "foreign", true)).toBeNull();
  });
});
