import { describe, expect, it } from "vitest";
import { generateClashConfig, generateClashYaml } from "./index";
import { loadMihomoYaml } from "../config/yaml-schema";

describe("group appearance", () => {
  const generate = (imagesEnabled: boolean, emojisEnabled: boolean) => generateClashConfig({
    nodes: [], userConfig: { enabledGroups: ["select", "auto", "cloud", "final"] },
    groupAppearance: { imagesEnabled, emojisEnabled, groups: {} },
  } as Parameters<typeof generateClashConfig>[0]);
  it("leaves legacy names and icons unchanged when absent", () => {
    const c = generateClashConfig({ nodes: [], userConfig: { enabledGroups: ["select", "final"] } });
    expect(c["proxy-groups"]?.some(g => g.name === "🚀 节点选择" && !g.icon)).toBe(true);
  });
  it("preserves plain legacy names when saving unedited legacy appearance",()=>{
    const options = {nodes:[], customProxyGroups:[{id:"c",name:"Netflix",emoji:"🧩",groupType:"select" as const}]};
    const old=generateClashConfig(options);
    const saved=generateClashConfig({...options,groupAppearance:{imagesEnabled:false,emojisEnabled:true,groups:{}}});
    expect(JSON.parse(JSON.stringify(saved))).toEqual(JSON.parse(JSON.stringify(old)));
  });
  it.each([[false,true,false],[true,false,false],[true,true,true]])("respects crypto emoji masters=%s group=%s",(master,group,visible)=>{
    const options: Parameters<typeof generateClashConfig>[0]={
      nodes:[],userConfig:{enabledGroups:["select","crypto","final"]},
      groupAppearance:{imagesEnabled:true,emojisEnabled:master,groups:{"module:crypto":{emojiEnabled:group}}},
    };
    const output=generateClashConfig(options);
    const crypto=output["proxy-groups"]!.find(g=>g.name.includes("加密货币"))!;
    expect(crypto.name).toBe(visible ? "₿ 加密货币" : "加密货币");
    expect(crypto.icon).toContain("/Binance/Binance.png");
    expect(output.rules!.some(r=>r.endsWith(`,${crypto.name}`))).toBe(true);
  });
  it.each([[true,true],[true,false],[false,true],[false,false]])("combines masters %s / %s", (image, emoji) => {
    const c = generate(image, emoji);
    const group = c["proxy-groups"]!.find(g => g.name.includes("云服务"))!;
    expect(Boolean(group.icon)).toBe(image);
    expect(group.name.startsWith("☁️")).toBe(emoji);
    if (image) expect(group.icon).toContain("/Cloudflare/Cloudflare.png");
    const names = new Set(["DIRECT", "REJECT", ...c["proxy-groups"]!.map(g=>g.name)]);
    for (const g of c["proxy-groups"]!) for (const p of g.proxies ?? []) expect(names.has(p)).toBe(true);
    for (const rule of c.rules ?? []) expect(names.has(rule.split(",").filter(p => p !== "no-resolve").at(-1)!)).toBe(true);
  });
  it("keeps custom, listener and dialer references valid in emitted YAML", () => {
    const options: Parameters<typeof generateClashYaml>[0] = {
      nodes: [{name:"relay",type:"ss",server:"example.com",port:443,cipher:"aes-128-gcm",password:"secret"},{name:"target",type:"ss",server:"target.example.com",port:443,cipher:"aes-128-gcm",password:"secret"}],
      userConfig: {dnsYaml:"",enabledGroups:["select","auto","final"],customRules:[{id:"rule",type:"DOMAIN",value:"example.org",target:"🇯🇵 日本中转"}]},
      customProxyGroups:[{id:"c",name:"💎 Binance",emoji:"💎",groupType:"select"}],
      dialerProxyGroups:[{id:"d",name:"🇯🇵 日本中转",type:"select",relayNodes:["💎 Binance"],targetNodes:["target"]}],
      groupListeners:[{id:"l",target:{kind:"dialer",id:"d"},port:17891}],
      groupAppearance:{imagesEnabled:true,emojisEnabled:false,groups:{"custom:c":{emojiEnabled:true,imageEnabled:false}}},
    };
    const yaml=generateClashYaml(options);
    const config=loadMihomoYaml(yaml) as ReturnType<typeof generateClashConfig>;
    expect(config.proxies?.find(p=>p.name==="target")?.["dialer-proxy"]).toBe("日本中转");
    expect(config["proxy-groups"]?.find(g=>g.name==="日本中转")?.proxies).toContain("Binance");
    expect(config["proxy-groups"]?.find(g=>g.name==="Binance")?.icon).toBeUndefined();
    expect(config.listeners?.[0].proxy).toBe("日本中转");
    expect(options.customProxyGroups?.[0].name).toBe("💎 Binance");
    expect(options.dialerProxyGroups?.[0].name).toBe("🇯🇵 日本中转");
  });
});
