import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { newGroupAppearance } from "@subboost/core/icons/appearance";

const h = vi.hoisted(() => ({ values: [] as any[], index: 0, controls: {} as Record<string, any[]>, store: {} as any }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: (initial: any) => {
  const index=h.index++;
  if (!(index in h.values)) h.values[index]=initial;
  return [h.values[index], (value: any)=>{h.values[index]=typeof value === "function" ? value(h.values[index]) : value;}];
}}));
vi.mock("@subboost/ui/store/config-store", () => ({ useConfigStore: (selector: any)=>selector(h.store) }));
function capture(kind: string, props: any) { (h.controls[kind] ??= []).push(props); return React.createElement("div", null, props.children); }
vi.mock("@subboost/ui/components/ui/button", () => ({ Button: (p:any)=>capture("button",p) }));
vi.mock("@subboost/ui/components/ui/icon-button", () => ({ IconButton: (p:any)=>capture("trigger",p) }));
vi.mock("@subboost/ui/components/ui/input", () => ({ Input: (p:any)=>capture("input",p) }));
vi.mock("@subboost/ui/components/ui/safe-image", () => ({ SafeImage: (p:any)=>capture("image",p) }));
vi.mock("@subboost/ui/components/ui/switch-field", () => ({ SwitchField: (p:any)=>capture("switch",p) }));
vi.mock("@subboost/ui/components/ui/dialog", () => Object.fromEntries(["Dialog","DialogContent","DialogHeader","DialogFooter","DialogTitle","DialogDescription"].map(name=>[name,(p:any)=>capture(name,p)])));
vi.mock("@subboost/ui/components/ui/tabs", () => Object.fromEntries(["Tabs","TabsContent","TabsList","TabsTrigger"].map(name=>[name,(p:any)=>capture(name,p)])));
vi.mock("@subboost/ui/components/ui/select", () => Object.fromEntries(["Select","SelectContent","SelectItem","SelectTrigger","SelectValue"].map(name=>[name,(p:any)=>capture(name,p)])));
vi.mock("./proxy-group-name-editor", () => ({ ProxyGroupNameEditor: (p:any)=>capture("emoji",p) }));
import { GroupAppearanceSettings } from "./group-appearance-settings";

describe("appearance dialog drafts", () => {
  beforeEach(()=>{h.values=[]; h.store={groupAppearance:newGroupAppearance(),setGroupAppearance:vi.fn(),draftRevision:0};});
  function render(group=true) {
    h.index=0;h.controls={};
    return renderToStaticMarkup(React.createElement(GroupAppearanceSettings,group ? {groupKey:"custom:a",name:"🇯🇵 日本"} : {}));
  }
  function open(group=true) { render(group); h.controls.trigger[0].onClick({stopPropagation:vi.fn()}); return render(group); }
  const button = (text:string)=>h.controls.button.find(p=>p.children===text);
  it("cancels all edits including closing the dialog and reopens persisted state", ()=>{
    open();h.controls.switch[0].onCheckedChange(false);render();
    button("取消").onClick();expect(h.store.setGroupAppearance).not.toHaveBeenCalled();
    open();expect(h.controls.switch[0].checked).toBe(true);
    h.controls.Dialog[0].onOpenChange(false);expect(h.store.setGroupAppearance).not.toHaveBeenCalled();
  });
  it("saves group switches, manual icon and original emoji without changing the name",()=>{
    open();h.controls.Select[0].onValueChange("manual");render();
    h.controls.input[0].onChange({target:{value:"Binance"}});render();
    h.controls.button.find(p=>p.title==="Binance").onClick();
    h.controls.emoji[0].onChange({emoji:"💎"});h.controls.switch[1].onCheckedChange(false);render();
    button("保存").onClick();
    expect(h.store.setGroupAppearance).toHaveBeenCalledWith(expect.objectContaining({groups:{"custom:a":{iconMode:"manual",iconId:"Binance",emoji:"💎",emojiEnabled:false}}}));
  });
  it("preserves choices when masters change and supports legacy editing",()=>{
    h.store.groupAppearance=undefined;open(false);
    expect(h.controls.switch.map(p=>p.checked)).toEqual([false,true]);
    h.controls.switch[0].onCheckedChange(true);render(false);h.controls.switch[1].onCheckedChange(false);render(false);button("保存").onClick();
    expect(h.store.setGroupAppearance).toHaveBeenCalledWith({imagesEnabled:true,emojisEnabled:false,groups:{}});
  });
  it("keeps group choices and can return to automatic matching",()=>{
    h.store.groupAppearance.groups["custom:a"]={iconMode:"manual",iconId:"Binance"};
    open(false);h.controls.switch[0].onCheckedChange(false);render(false);button("保存").onClick();
    expect(h.store.setGroupAppearance.mock.calls[0][0].groups).toEqual(h.store.groupAppearance.groups);
    h.values=[];open();h.controls.Select[0].onValueChange("auto");render();
    expect(h.controls.Select[0].value).toBe("auto");h.controls.switch[0].onCheckedChange(false);render();button("保存").onClick();
    expect(h.store.setGroupAppearance.mock.calls.at(-1)[0].groups["custom:a"]).toEqual({iconMode:"auto",iconId:"Binance",imageEnabled:false});
  });
  it("shows no match and refuses a stale editor session save",()=>{
    open();h.controls.Select[0].onValueChange("manual");render();h.controls.input[0].onChange({target:{value:"nonexistent"}});
    expect(render()).toContain("没有匹配的图标");
    h.store.draftRevision=1;render();expect(h.controls.Dialog[0].open).toBe(false);button("保存").onClick();expect(h.store.setGroupAppearance).not.toHaveBeenCalled();
  });
  it("prevents saving a prefix that would break YAML policy references",()=>{
    open(); h.controls.emoji[0].onChange({emoji:"a,b"});render();
    expect(button("保存").disabled).toBe(true);
  });
});
