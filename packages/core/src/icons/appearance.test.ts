import { describe, expect, it } from "vitest";
import { applyGroupAppearance, BUILTIN_ICON_IDS, iconUrl, legacyGroupAppearance, matchGroupIcon, newGroupAppearance, normalizeGroupAppearance, resolveGroupAppearance, splitGroupEmoji } from "./appearance";
import { buildDefaultSubBoostTemplateConfig } from "../config/defaults";
import { validateSubBoostTemplateConfig } from "../templates/config-template";
import { buildGenerateOptionsFromConfig } from "../subscription/config-utils";

describe("appearance catalogue and persistence contract", () => {
  it.each([["谷歌学术", "GoogleScholar"], ["Google Scholar", "GoogleScholar"], ["CF 云服务", "Cloudflare"], ["币安", "Binance"], ["🇺🇸 美国中转", "US"], ["United Kingdom", "UK"], ["台湾中转", "CN-Taiwan"], ["Korea", "Korea"], ["日本中转", "Japan"], ["Gemini", "GoogleAI"], ["Hong Kong", "HongKong"], ["Singapore", "Singapore"], ["未知组", undefined], ["netflix / youtube", undefined], ["Cloudflare Netflix", undefined], ["musical", undefined]])("matches %s reliably", (name,id) => {
    expect(matchGroupIcon(name)).toBe(id);
  });
  it("has real icons for every default and no arbitrary URL output", () => {
    for (const id of Object.values(BUILTIN_ICON_IDS)) expect(iconUrl(id)).toMatch(/xiangwan6667\/Oasisic-Icons\/[a-f0-9]{40}\/icons\/.+\.png$/);
    expect(iconUrl("http://evil")).toBeUndefined(); expect(iconUrl()).toBeUndefined();
  });
  it.each(["🇺🇸美国", "👨‍👩‍👧‍👦 家庭", "❤️‍🔥 热门", "1️⃣ 首选"])('preserves complex emoji %s', name => {
    const p=splitGroupEmoji(name); expect(p.emoji).toBeTruthy(); expect(p.label).not.toBe(name);
  });
  it("supports legacy, empty, plain, and emoji-only names", () => {
    expect(splitGroupEmoji("plain name")).toEqual({emoji:"",label:"plain name"});
    expect(splitGroupEmoji("")).toEqual({emoji:"",label:""});
    expect(splitGroupEmoji("🚀").label).toBe("🚀");
    expect(resolveGroupAppearance(undefined,"module:select","🚀 节点选择")).toMatchObject({name:"🚀 节点选择",icon:undefined});
  });
  it("treats the builtin Bitcoin symbol as an appearance prefix without stripping currency text",()=>{
    expect(splitGroupEmoji("₿ 加密货币")).toEqual({emoji:"₿",label:"加密货币"});
    expect(splitGroupEmoji("₿基金")).toEqual({emoji:"",label:"₿基金"});
    expect(splitGroupEmoji("$ Budget")).toEqual({emoji:"",label:"$ Budget"});
    expect(resolveGroupAppearance(newGroupAppearance(),"module:crypto","₿ 加密货币").name).toBe("加密货币");
    expect(resolveGroupAppearance(undefined,"module:crypto","₿ 加密货币").name).toBe("₿ 加密货币");
  });
  it("keeps individual and manual choices across master cycles", () => {
    const s=newGroupAppearance();s.groups["custom:c"]={iconMode:"manual",iconId:"Binance",emoji:"💎",emojiEnabled:true};
    s.emojisEnabled=true;
    expect(resolveGroupAppearance(s,"custom:c","Netflix")).toMatchObject({name:"💎 Netflix",iconId:"Binance"});
    const off={...s,imagesEnabled:false,emojisEnabled:false};
    expect(resolveGroupAppearance(off,"custom:c","YouTube")).toMatchObject({name:"YouTube",icon:undefined,iconId:"Binance"});
    expect(resolveGroupAppearance(s,"custom:c","YouTube").icon).toContain("Binance");
    s.groups["custom:c"].imageEnabled=false;s.groups["custom:c"].emojiEnabled=false;
    expect(resolveGroupAppearance(s,"custom:c","YouTube")).toMatchObject({name:"YouTube",icon:undefined});
    s.groups["custom:c"]={emoji:""};expect(resolveGroupAppearance(s,"custom:c","🚀 Netflix").name).toBe("Netflix");
  });
  it("auto mode follows renamed groups and ignores a remembered manual selection", () => {
    const s=newGroupAppearance();s.groups["custom:c"]={iconMode:"auto",iconId:"Binance"};
    expect(resolveGroupAppearance(s,"custom:c","Netflix").iconId).toBe("Netflix");
    expect(resolveGroupAppearance(s,"custom:c","YouTube").iconId).toBe("YouTube");
    expect(resolveGroupAppearance(s,"custom:c","Unknown").icon).toBeUndefined();
  });
  it("roundtrips templates and server refresh options; missing fields remain legacy", () => {
    const config=buildDefaultSubBoostTemplateConfig("standard");
    config.groupAppearance!.groups["dialer:a"]={imageEnabled:false,emojiEnabled:true,iconMode:"manual",iconId:"Japan",emoji:"🇯🇵"};
    const result=validateSubBoostTemplateConfig(JSON.parse(JSON.stringify(config)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.groupAppearance).toEqual(config.groupAppearance);
    expect(buildGenerateOptionsFromConfig(result.config,{nodes:[]}).groupAppearance).toEqual(config.groupAppearance);
    delete config.groupAppearance;
    const old=validateSubBoostTemplateConfig(config);expect(old.ok && old.config.groupAppearance).toBeUndefined();
    expect(legacyGroupAppearance()).toEqual({imagesEnabled:false,emojisEnabled:true,groups:{}});
    expect(validateSubBoostTemplateConfig({...config,groupAppearance:{broken:true}}).ok).toBe(false);
  });
  it.each([null, true, [], {}, {imagesEnabled:true,emojisEnabled:false,groups:[]}, {imagesEnabled:true,emojisEnabled:false,groups:{bad:{}}}, ...[null,[],{iconMode:"bad"},{iconId:"bad"},{emoji:"a\nb"},{emoji:3},{imageEnabled:1},{emojiEnabled:1}].map(g=>({imagesEnabled:true,emojisEnabled:false,groups:{"custom:c":g}}))])("rejects malformed settings %#", raw => {
    expect(normalizeGroupAppearance(raw)).toBeUndefined();
  });
  it("rewrites only policy reference positions and handles collision suffixes", () => {
    const c=applyGroupAppearance({proxies:[{name:"Auto",type:"direct"}],"proxy-groups":[{name:"⚡ Auto",type:"select",proxies:["Node"]},{name:"🚀 Auto",type:"select",proxies:["⚡ Auto"]}],rules:["DOMAIN,⚡ Auto,🚀 Auto,no-resolve","MATCH,⚡ Auto"],listeners:[{name:"l",type:"mixed",port:1234,proxy:"🚀 Auto"}]},newGroupAppearance(),[{key:"custom:a",name:"⚡ Auto"},{key:"custom:b",name:"🚀 Auto"}]);
    expect(c["proxy-groups"]?.map(g=>g.name)).toEqual(["Auto (2)","Auto (3)"]);
    expect(c.rules).toEqual(["DOMAIN,⚡ Auto,Auto (3),no-resolve","MATCH,Auto (2)"]);
    expect(c.listeners?.[0].proxy).toBe("Auto (3)");
    expect(c["proxy-groups"]?.[1].proxies).toEqual(["Auto (2)"]);
  });
  it("validates optional empty choices and malformed scalar fields",()=>{
    const s=newGroupAppearance();s.groups["custom:a"]={iconMode:"manual",emoji:""};
    expect(normalizeGroupAppearance(s)).toEqual(s);
    expect(normalizeGroupAppearance(undefined)).toBeUndefined();
    for(const patch of [{iconId:42},{emoji:"😀".repeat(40)}]) expect(normalizeGroupAppearance({...s,groups:{"custom:a":patch}})).toBeUndefined();
    expect(resolveGroupAppearance({...s,emojisEnabled:true},"custom:a","Plain")).toMatchObject({name:"Plain",icon:undefined});
    expect(resolveGroupAppearance({...s,emojisEnabled:true},"custom:b","Plain").name).toBe("Plain");
  });
  it("handles empty generated configs and opaque listener fields without rewriting content",()=>{
    const empty={};expect(applyGroupAppearance(empty,undefined,[])).toBe(empty);
    expect(applyGroupAppearance(empty,newGroupAppearance(),[])).toMatchObject({proxies:[],"proxy-groups":[],rules:[]});
    const c=applyGroupAppearance({"proxy-groups":[{name:"Unknown",type:"select"}],listeners:[{name:"l",type:"mixed",port:1234}],rules:["MATCH,DIRECT"]},newGroupAppearance(),[]);
    expect(c["proxy-groups"]?.[0].name).toBe("Unknown");
    expect(c.listeners?.[0]).not.toHaveProperty("proxy");
  });
});
