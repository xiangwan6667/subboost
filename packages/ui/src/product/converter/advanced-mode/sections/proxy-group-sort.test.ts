import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import type { InputProps } from "@subboost/ui/components/ui/input";
import type { IconButtonProps } from "@subboost/ui/components/ui/icon-button";
import { ProxyGroupDragHandle, ProxyGroupSortControls, SortableProxyGroupCard, type ProxyGroupSorting } from "./proxy-group-sort";

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useState: <T,>(initial: T) => [initial, vi.fn()],
  useRef: <T,>(initial: T) => ({ current: initial }),
}));

function findElement<P>(node: React.ReactNode, prop: string, value: unknown): React.ReactElement<P> {
  let found: React.ReactElement<P> | undefined;
  const visit = (children: React.ReactNode) => React.Children.forEach(children, (child) => {
    if (!React.isValidElement<Record<string, unknown>>(child)) return;
    if (child.props[prop] === value) found = child as React.ReactElement<P>;
    visit(child.props.children as React.ReactNode);
  });
  visit(node);
  if (!found) throw new Error(`Missing control: ${String(value)}`);
  return found;
}

function sorting(overrides: Partial<ProxyGroupSorting> = {}): ProxyGroupSorting {
  return { category: "custom", id: "second", name: "Second", ids: ["first", "second", "third"], onChange: vi.fn(), ...overrides };
}

describe("proxy group editor sorting controls", () => {
  it("uses a category-specific drag payload so the right preview cannot consume it", () => {
    const config = sorting();
    const handle = ProxyGroupDragHandle({ sorting: config });
    const transfer = { effectAllowed: "", setData: vi.fn(), setDragImage: vi.fn() };
    const event = { stopPropagation: vi.fn(), dataTransfer: transfer, currentTarget: { closest: () => null } };
    handle.props.onDragStart(event as unknown as React.DragEvent<HTMLButtonElement>);
    expect(transfer.setData).toHaveBeenCalledExactlyOnceWith("application/x-subboost-editor-group-custom", "second");
    expect(transfer.effectAllowed).toBe("move");
    handle.props.onKeyDown({ key: "ArrowUp", preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLButtonElement>);
    expect(config.onChange).toHaveBeenCalledExactlyOnceWith(["second", "first", "third"]);
  });

  it("commits a number once on Enter and cancels with Escape", () => {
    const config = sorting();
    const controls = ProxyGroupSortControls({ sorting: config });
    const input = findElement<InputProps>(controls, "aria-label", "Second 在当前分类中的顺序");
    input.props.onChange?.({ target: { value: "3" } } as React.ChangeEvent<HTMLInputElement>);
    input.props.onKeyDown?.({ key: "Enter", preventDefault: vi.fn(), currentTarget: { blur: vi.fn() } } as unknown as React.KeyboardEvent<HTMLInputElement>);
    input.props.onBlur?.({} as React.FocusEvent<HTMLInputElement>);
    expect(config.onChange).toHaveBeenCalledExactlyOnceWith(["first", "third", "second"]);
    input.props.onChange?.({ target: { value: "1" } } as React.ChangeEvent<HTMLInputElement>);
    input.props.onKeyDown?.({ key: "Escape", preventDefault: vi.fn(), currentTarget: { blur: vi.fn() } } as unknown as React.KeyboardEvent<HTMLInputElement>);
    input.props.onBlur?.({} as React.FocusEvent<HTMLInputElement>);
    expect(config.onChange).toHaveBeenCalledTimes(1);
  });

  it("moves with arrow buttons and bounds the first and last positions", () => {
    const config = sorting();
    const controls = ProxyGroupSortControls({ sorting: config });
    const up = findElement<IconButtonProps>(controls, "label", "上移 Second");
    const down = findElement<IconButtonProps>(controls, "label", "下移 Second");
    up.props.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
    down.props.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
    expect(config.onChange).toHaveBeenNthCalledWith(1, ["second", "first", "third"]);
    expect(config.onChange).toHaveBeenNthCalledWith(2, ["first", "third", "second"]);
    expect(findElement<IconButtonProps>(ProxyGroupSortControls({ sorting: sorting({ id: "first" }) }), "label", "上移 Second").props.disabled).toBe(true);
    expect(findElement<IconButtonProps>(ProxyGroupSortControls({ sorting: sorting({ id: "third" }) }), "label", "下移 Second").props.disabled).toBe(true);
  });

  it("accepts same-category drops before or after a card and ignores other drag payloads", () => {
    const config = sorting();
    const card = SortableProxyGroupCard({ sorting: config, children: null });
    const event = {
      clientY: 90, currentTarget: { getBoundingClientRect: () => ({ top: 0, height: 100 }) },
      dataTransfer: { getData: vi.fn((type: string) => type === "application/x-subboost-editor-group-custom" ? "first" : "") },
      preventDefault: vi.fn(), stopPropagation: vi.fn(),
    };
    card.props.onDrop(event as unknown as React.DragEvent<HTMLDivElement>);
    expect(config.onChange).toHaveBeenCalledExactlyOnceWith(["second", "first", "third"]);
    event.clientY = 10;
    event.dataTransfer.getData = vi.fn(() => "third");
    card.props.onDrop(event as unknown as React.DragEvent<HTMLDivElement>);
    expect(config.onChange).toHaveBeenLastCalledWith(["first", "third", "second"]);
    event.dataTransfer.getData = vi.fn(() => "foreign");
    card.props.onDrop(event as unknown as React.DragEvent<HTMLDivElement>);
    event.dataTransfer.getData = vi.fn(() => "");
    card.props.onDrop(event as unknown as React.DragEvent<HTMLDivElement>);
    expect(config.onChange).toHaveBeenCalledTimes(2);
  });
});
