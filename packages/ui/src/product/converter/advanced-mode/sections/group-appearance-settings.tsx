"use client";

import * as React from "react";
import { Image as ImageIcon, Settings2 } from "lucide-react";
import { useConfigStore } from "@subboost/ui/store/config-store";
import { SafeImage } from "@subboost/ui/components/ui/safe-image";
import { Button } from "@subboost/ui/components/ui/button";
import { IconButton } from "@subboost/ui/components/ui/icon-button";
import { Input } from "@subboost/ui/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@subboost/ui/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@subboost/ui/components/ui/select";
import { SwitchField } from "@subboost/ui/components/ui/switch-field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@subboost/ui/components/ui/tabs";
import { BUILTIN_ICON_IDS, iconUrl, legacyGroupAppearance, normalizeGroupAppearance, OASISIC_ICONS, resolveGroupAppearance, splitGroupEmoji, type GroupAppearance, type GroupAppearanceOverride } from "@subboost/core/icons/appearance";
import { ProxyGroupNameEditor } from "./proxy-group-name-editor";

function IconPreview({ id }: { id?: string }) {
  const url = iconUrl(id);
  return <SafeImage src={url} alt="" width={28} height={28} loading="lazy" className="h-7 w-7 shrink-0 rounded-md" fallback={<ImageIcon aria-hidden="true" className="h-5 w-5 text-fg-45" />} />;
}

export function GroupAppearanceSettings({ groupKey, name = "", defaultIconId, emoji = "" }: { groupKey?: string; name?: string; defaultIconId?: string; emoji?: string }) {
  const settings = useConfigStore(s => s.groupAppearance);
  const save = useConfigStore(s => s.setGroupAppearance);
  const revision = useConfigStore(s => s.draftRevision);
  const [draft, setDraft] = React.useState<GroupAppearance | null>(null);
  const [query, setQuery] = React.useState("");
  const [openedRevision, setOpenedRevision] = React.useState(revision);
  const effective = settings ?? legacyGroupAppearance();
  const current = resolveGroupAppearance(settings, groupKey ?? "", name, defaultIconId);
  const g = draft?.groups[groupKey ?? ""] ?? {};
  const change = (patch: Partial<GroupAppearanceOverride>) => setDraft(d => d && groupKey ? { ...d, groups: { ...d.groups, [groupKey]: { ...d.groups[groupKey], ...patch } } } : d);
  const preview = resolveGroupAppearance(draft ?? effective, groupKey ?? "", name, defaultIconId);
  const validDraft = draft ? normalizeGroupAppearance(draft) : undefined;
  const choices = OASISIC_ICONS.filter(i => `${i.label} ${i.id} ${i.category}`.toLowerCase().includes(query.toLowerCase()));
  const builtinId = groupKey?.startsWith("module:") ? groupKey.slice(7) : "";
  return <>
    <IconButton variant="ghost" className="pointer-events-auto relative z-10 h-7 w-7 shrink-0" label={groupKey ? `设置 ${name} 外观` : "全局外观设置"} onClick={e => {
      e.stopPropagation(); setOpenedRevision(revision); setDraft(structuredClone(effective)); setQuery("");
    }}>
      {groupKey ? <IconPreview key={current.icon} id={current.icon ? current.iconId : undefined} /> : <Settings2 className="h-4 w-4" />}
    </IconButton>
    <Dialog open={draft !== null && revision === openedRevision} onOpenChange={open => { if (!open) setDraft(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{groupKey ? `${name} · 外观` : "全局外观设置"}</DialogTitle>
          <DialogDescription>{groupKey ? "图片与表情可分别设置；全局总开关关闭时保留本组选择。" : "总开关控制所有组，关闭后仍保留每组设置。"}</DialogDescription>
        </DialogHeader>
        {draft && (groupKey ? <Tabs defaultValue="image">
          <TabsList><TabsTrigger value="image">图片</TabsTrigger><TabsTrigger value="emoji">表情</TabsTrigger></TabsList>
          <TabsContent value="image" className="space-y-3">
            <SwitchField label="本组图片" checked={g.imageEnabled !== false} onCheckedChange={imageEnabled => change({ imageEnabled })} />
            <Select value={g.iconMode ?? "auto"} onValueChange={value => change({ iconMode: value as "auto" | "manual" })}>
              <SelectTrigger aria-label="图标匹配方式"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">自动匹配</SelectItem><SelectItem value="manual">手动指定</SelectItem></SelectContent>
            </Select>
            {g.iconMode === "manual" ? <>
              <Input aria-label="搜索图标" placeholder="搜索品牌、名称或分类" value={query} onChange={e => setQuery(e.target.value)} />
              <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto">
                {choices.map(i => <Button key={i.id} variant={g.iconId === i.id ? "secondary" : "ghost"} className="h-auto flex-col gap-1 py-2 text-xs" onClick={() => change({ iconId: i.id })} aria-pressed={g.iconId === i.id} title={i.label}>
                  <IconPreview id={i.id} /><span className="w-full truncate">{i.label}</span>
                </Button>)}
                {choices.length === 0 && <p className="col-span-4 text-sm text-fg-50">没有匹配的图标</p>}
              </div>
            </> : <p className="text-sm text-fg-50">{preview.iconId ? `匹配：${preview.iconId}` : "暂无可靠匹配，将不输出图片"}{builtinId && BUILTIN_ICON_IDS[builtinId] ? " · 改名后自动重新匹配" : ""}</p>}
          </TabsContent>
          <TabsContent value="emoji" className="space-y-3">
            <SwitchField label="本组表情" checked={g.emojiEnabled !== false} onCheckedChange={emojiEnabled => change({ emojiEnabled })} />
            <ProxyGroupNameEditor emojiOnly value={{ emoji: g.emoji ?? (splitGroupEmoji(name).emoji || emoji), name: splitGroupEmoji(name).label }} onChange={value => change({ emoji: value.emoji })} />
          </TabsContent>
          <div className="mt-3 flex items-center gap-2 text-sm text-fg-60"><IconPreview key={preview.icon} id={preview.icon ? preview.iconId : undefined} /><span>输出预览：{preview.name}</span></div>
        </Tabs> : <div className="space-y-3">
          <SwitchField label="图片总开关" checked={draft.imagesEnabled} onCheckedChange={imagesEnabled => setDraft({ ...draft, imagesEnabled })} />
          <SwitchField label="表情总开关" checked={draft.emojisEnabled} onCheckedChange={emojisEnabled => setDraft({ ...draft, emojisEnabled })} />
        </div>)}
        {draft && !validDraft && <p role="alert" className="text-sm text-fg-60">表情内容过长或包含逗号、换行，请修改后保存。</p>}
        <DialogFooter><Button variant="ghost" onClick={() => setDraft(null)}>取消</Button><Button disabled={!validDraft} onClick={() => { if (validDraft && revision === openedRevision) save(validDraft); setDraft(null); }}>保存</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
