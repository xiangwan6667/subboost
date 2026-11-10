"use client";

import * as React from "react";
import { ImagePlus } from "lucide-react";
import { getGroupIconUrl, searchGroupIcons } from "@subboost/core/generator/group-icons";
import { Button } from "@subboost/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@subboost/ui/components/ui/dialog";
import { Input } from "@subboost/ui/components/ui/input";
import { SafeImage } from "@subboost/ui/components/ui/safe-image";
import { useConfigStore } from "@subboost/ui/store/config-store";

export function GroupIconPicker({ targetKey, groupName, automaticIconUrl }: {
  targetKey: string;
  groupName: string;
  automaticIconUrl?: string;
}) {
  const selection = useConfigStore((state) => state.groupIconOverrides?.[targetKey]);
  const setGroupIconOverride = useConfigStore((state) => state.setGroupIconOverride);
  const showGroupIcons = useConfigStore((state) => state.showGroupIcons);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [limit, setLimit] = React.useState(48);
  const matches = searchGroupIcons(query);

  function choose(id: string | null) {
    setGroupIconOverride(targetKey, id);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) { setQuery(""); setLimit(48); } }}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm"
          className="pointer-events-auto h-7 shrink-0 gap-1 px-2 text-fg-60"
          aria-label={`选择 ${groupName} 图标`} title="选择图标"
          onClick={(event) => event.stopPropagation()}>
          <ImagePlus className="h-3.5 w-3.5" />
          <span className="text-xs">图标</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>选择图标 · {groupName}</DialogTitle>
          <DialogDescription>
            {showGroupIcons ? "手动选择优先于自动匹配，点击图标即可保存。" : "图标显示已关闭，您的选择仍会保存。"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={selection === undefined ? "secondary" : "outline"}
            aria-pressed={selection === undefined} onClick={() => choose(null)} className="gap-2">
            <SafeImage src={automaticIconUrl} alt="" fallback={null} referrerPolicy="no-referrer" className="h-6 w-6 object-contain" />
            恢复自动匹配
          </Button>
          <Button type="button" variant={selection === "" ? "secondary" : "outline"}
            aria-pressed={selection === ""} onClick={() => choose("")}>不显示图标</Button>
        </div>
        <Input aria-label="搜索图标" placeholder="搜索名称或关键词，例如 Google、币安、美国"
          value={query} onChange={(event) => { setQuery(event.target.value); setLimit(48); }} />
        <p className="text-xs text-fg-60" aria-live="polite">{matches.length} 个可选图标</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {matches.slice(0, limit).map((icon) => (
            <Button key={icon.id} type="button" variant={selection === icon.id ? "secondary" : "outline"}
              className="h-auto min-w-0 flex-col gap-2 px-2 py-3"
              aria-label={`选择 ${icon.name} 图标`} aria-pressed={selection === icon.id}
              onClick={() => choose(icon.id)}>
              <SafeImage src={getGroupIconUrl(icon.id)} alt="" loading="lazy" referrerPolicy="no-referrer"
                className="h-9 w-9 rounded-lg object-contain" fallback={<ImagePlus className="h-9 w-9 text-fg-40" />} />
              <span className="w-full truncate text-center text-xs" title={icon.name}>{icon.name}</span>
            </Button>
          ))}
        </div>
        {matches.length === 0 && <p className="py-4 text-center text-sm text-fg-60">没有匹配的图标，请尝试其他关键词。</p>}
        {matches.length > limit && <Button type="button" variant="outline" onClick={() => setLimit((value) => value + 48)}>显示更多图标</Button>}
      </DialogContent>
    </Dialog>
  );
}
