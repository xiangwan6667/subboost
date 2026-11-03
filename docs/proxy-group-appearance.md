# 代理组图片与表情

高级模式的「分流代理组」标题旁打开全局外观设置；内置组、自定义组和中转组名称左侧打开单组设置。复用现有弹窗、开关、下拉框、标签页和表情选择器，修改后点击保存生效，取消或关闭弹窗不改变配置。

图片和表情各有总开关与单组开关。总开关关闭时仍保留每组选择。新建内置模板默认图片开启、表情关闭；旧模板、旧订阅和旧本地草稿没有 `groupAppearance` 字段时保留旧外观。原始名称、表情和引用保存在编辑配置中，生成时才分配显示名称并统一处理规则、组成员、监听器和 dialer-proxy 引用；重名时追加编号，节点名称保持原值。

自动匹配使用内置模块稳定 ID 的默认映射；覆盖模块名称或自定义、中转组改名后，以新名称重新匹配。支持品牌英文名称、目录中的中文名称、常用别名及国家地区名称。多个独立品牌或不可靠匹配留空；手动图标优先，切回自动模式时保留手动选择但不应用它。

目录来自自有 [Oasisic-Icons fork](https://github.com/xiangwan6667/Oasisic-Icons)，固定快照为 `4091601e4eb12e8ba7620008703a8754e6608204`。内置 JSON 保存该快照的 299 个 canonical 图标；生成的 URL 使用完整提交 SHA，生成过程不访问网络。图片失败由 SafeImage 显示占位，不影响 YAML 生成。

云服务使用 Cloudflare。加密货币使用 Binance 全球版黑底金标；谷歌学术使用保留原 SVG 蓝色的白底图标，主体 448×448、四周留白 32px。两张均由用户确认，512×512 RGBA、r=115 圆角外透明、无损 PNG。素材原件、处理方法、权利说明及像素保真测试保存在图标 fork 的 [sources](https://github.com/xiangwan6667/Oasisic-Icons/tree/4091601e4eb12e8ba7620008703a8754e6608204/sources) 中。

## 配置字段

`groupAppearance` 是可选字段，贯通本地草稿、登录交接、模板上传/导入、订阅保存/编辑及服务端刷新。

```json
{
  "groupAppearance": {
    "imagesEnabled": true,
    "emojisEnabled": false,
    "groups": {
      "module:cloud": { "imageEnabled": true, "iconMode": "auto" },
      "custom:example": {
        "imageEnabled": true,
        "emojiEnabled": true,
        "iconMode": "manual",
        "iconId": "Binance",
        "emoji": "💎"
      }
    }
  }
}
```

组键为 `module:<id>`、`custom:<id>` 或 `dialer:<id>`。单组开关缺省为开启，最终仍受总开关控制。图标只能选择固定目录 ID，不能注入任意图片 URL。表情关闭不删除原始数据。

## 默认映射

| 模块 | 图标 |
|---|---|
| select / auto / ad / private | Proxy / Auto / AD / Direct |
| cn / global / final | China / Global / Final |
| ai / gemini / youtube / google | GeneralAI / GoogleAI / YouTube / Google |
| microsoft / apple / telegram / twitter | Microsoft / Apple / Telegram / X |
| meta / discord / social-other | Meta / Discord / Reddit |
| netflix / disney / streaming-west / streaming-asia | Netflix / DisneyPlus / HBOMax / Bahamut |
| steam / gaming-pc / gaming-console | Steam / EpicGames / PlayStation |
| github / cloud / dev-tools / storage | GitHub / Cloudflare / Docker / Dropbox |
| payment / crypto / google-scholar | PayPal / Binance / GoogleScholar |
| education / news / shopping / adult | Wikipedia / BBC / Amazon / Play |
