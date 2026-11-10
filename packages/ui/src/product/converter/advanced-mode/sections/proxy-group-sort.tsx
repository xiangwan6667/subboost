"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { IconButton } from "@subboost/ui/components/ui/icon-button";
import { Input } from "@subboost/ui/components/ui/input";
import { cn } from "@subboost/ui/lib/utils";
import { dropProxyGroup, moveProxyGroupToPosition } from "@subboost/ui/store/config-store/proxy-group-editor-order";

export type ProxyGroupSorting = {
  category: string;
  id: string;
  name: string;
  ids: readonly string[];
  onChange: (ids: string[]) => void;
};

function dragType(category: string) {
  return `application/x-subboost-editor-group-${category}`;
}

export function ProxyGroupDragHandle({ sorting }: { sorting: ProxyGroupSorting }) {
  const canSort = sorting.ids.length > 1;
  return (
    <IconButton label={`拖动排序 ${sorting.name}`} title="拖动排序（仅当前分类，也可用上下方向键）"
      variant="ghost" draggable={canSort} disabled={!canSort}
      className="pointer-events-auto h-6 w-5 cursor-grab text-fg-40 active:cursor-grabbing"
      onClick={(event) => event.stopPropagation()}
      onDragStart={(event) => {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(dragType(sorting.category), sorting.id);
        const card = event.currentTarget.closest("[data-proxy-group-sort-id]");
        if (card) event.dataTransfer.setDragImage(card, 12, 12);
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        const index = sorting.ids.indexOf(sorting.id);
        const next = moveProxyGroupToPosition(sorting.ids, sorting.id, index + (event.key === "ArrowUp" ? 0 : 2));
        if (next) sorting.onChange(next);
      }}>
      <GripVertical className="h-3.5 w-3.5" />
    </IconButton>
  );
}

export function SortableProxyGroupCard({ sorting, children, className }: {
  sorting?: ProxyGroupSorting;
  children: React.ReactNode;
  className?: string;
}) {
  const [dropAfter, setDropAfter] = React.useState<boolean | null>(null);
  return (
    <div
      role="group"
      aria-label={sorting ? `${sorting.name} 编辑卡片` : undefined}
      data-proxy-group-sort-id={sorting?.id}
      className={cn(className, dropAfter !== null && (dropAfter ? "border-b-indigo-400" : "border-t-indigo-400"))}
      onDragOver={(event) => {
        if (!sorting || !event.dataTransfer.types.includes(dragType(sorting.category))) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        const rect = event.currentTarget.getBoundingClientRect();
        setDropAfter(event.clientY >= rect.top + rect.height / 2);
      }}
      onDragLeave={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropAfter(null);
      }}
      onDragEnd={() => setDropAfter(null)}
      onDrop={(event) => {
        setDropAfter(null);
        if (!sorting) return;
        const sourceId = event.dataTransfer.getData(dragType(sorting.category));
        if (!sourceId || !sorting.ids.includes(sourceId)) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const next = dropProxyGroup(sorting.ids, sourceId, sorting.id, event.clientY >= rect.top + rect.height / 2);
        if (next) sorting.onChange(next);
      }}
    >
      {children}
    </div>
  );
}

export function ProxyGroupSortControls({ sorting }: { sorting: ProxyGroupSorting }) {
  const index = sorting.ids.indexOf(sorting.id);
  const [draft, setDraft] = React.useState<string | null>(null);
  const draftRef = React.useRef<string | null>(null);
  const move = (position: number) => {
    const next = moveProxyGroupToPosition(sorting.ids, sorting.id, position);
    if (next) sorting.onChange(next);
  };
  const clearDraft = () => {
    draftRef.current = null;
    setDraft(null);
  };
  const commit = () => {
    const value = draftRef.current?.trim() ?? "";
    clearDraft();
    if (/^-?\d+$/.test(value)) move(Number(value));
  };
  return (
    <div role="group" aria-label={`${sorting.name} 排序`} className="pointer-events-auto flex shrink-0 items-center gap-0.5"
      onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <span className="text-[10px] text-fg-40 whitespace-nowrap">顺序:</span>
      <Input aria-label={`${sorting.name} 在当前分类中的顺序`} value={draft ?? String(index + 1)}
        onChange={(event) => { draftRef.current = event.target.value; setDraft(event.target.value); }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); commit(); event.currentTarget.blur(); }
          if (event.key === "Escape") { event.preventDefault(); clearDraft(); event.currentTarget.blur(); }
        }}
        inputMode="numeric" title={`当前分类内排序位置（1–${sorting.ids.length}）`}
        className="h-6 w-10 text-[10px] bg-ink/10 border-ink/10 text-center px-1" />
      <div className="flex flex-col">
        <IconButton label={`上移 ${sorting.name}`} variant="ghost" disabled={index <= 0}
          onClick={() => move(index)}
          className="h-3 w-4 text-fg-30 hover:text-indigo-300 disabled:opacity-30">
          <ChevronUp className="h-2.5 w-2.5" />
        </IconButton>
        <IconButton label={`下移 ${sorting.name}`} variant="ghost" disabled={index < 0 || index >= sorting.ids.length - 1}
          onClick={() => move(index + 2)}
          className="h-3 w-4 text-fg-30 hover:text-indigo-300 disabled:opacity-30">
          <ChevronDown className="h-2.5 w-2.5" />
        </IconButton>
      </div>
    </div>
  );
}
