# picgo-plugin-axmipic

[AXmiPic](https://axmipic.gpcn.cc) 图床的 [PicGo](https://picgo.app) / [PicList](https://piclist.cn) 上传器插件。

轻量、可靠的自托管图床服务，后端为单个 Go 二进制。本插件通过 AXmiPic 的 multipart 上传接口上传图片，鉴权使用长期 **API 令牌**。

## 特性

- 在 PicGo 图床列表中显示为「AXmiPic」，提供可视化配置面板
- 仅需 **站点地址** 与 **API 令牌** 两项配置
- 兼容 PicGo GUI、PicGo-Core CLI、PicList，以及基于 PicGo-Core 的编辑器集成
- 零运行时依赖，支持 Node.js 18+

## 安装

### PicGo GUI

「插件设置」→ 搜索 `axmipic` → 安装；或「安装插件」直接输入包名：

```
picgo-plugin-axmipic
```

### PicGo-Core CLI

```bash
picgo install picgo-plugin-axmipic
```

## 获取 API 令牌

1. 登录你的 AXmiPic 站点；
2. 进入用户中心的「令牌」页面，创建一个 API 令牌（明文仅显示一次，请及时保存）；
3. 复制该令牌，填入插件配置。

## 配置

在 PicGo 的图床设置中选择「AXmiPic」，填写：

| 配置项 | 说明 | 必填 |
|--------|------|------|
| 站点地址 | AXmiPic 站点根地址，如 `https://axmipic.gpcn.cc`；自建实例填自己的域名 | 是 |
| API 令牌 | 上一步创建的令牌 | 是 |

对应的 PicGo 配置位于 `picBed.axmipic`：

```json
{
  "picBed": {
    "uploader": "axmipic",
    "axmipic": {
      "baseUrl": "https://axmipic.gpcn.cc",
      "token": "你的 API 令牌"
    }
  }
}
```

## 工作原理

插件对每张图片调用：

```
POST {baseUrl}/api/v1/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

file=<二进制>
```

成功后从响应中取 `data.url` 作为图片地址：

```json
{ "code": 0, "message": "ok", "data": { "url": "https://.../i/....png" } }
```

## 兼容性

| 客户端 | 支持 |
|--------|------|
| PicGo GUI | ✅ |
| PicGo-Core CLI | ✅ |
| PicList | ✅（兼容 PicGo 插件） |
| vs-picgo / Typora / Obsidian（基于 PicGo-Core） | ✅ |

## 开发与测试

本插件为零依赖的 CommonJS 包，无需安装依赖即可运行测试：

```bash
npm test
```

本地联调：

```bash
# PicGo-Core：从本地目录安装
picgo install /path/to/picgo-plugin-axmipic
picgo use uploader
```

## 发布

```bash
npm publish
```

发布后可提交到 [Awesome-PicGo](https://github.com/PicGo/Awesome-PicGo)，以便在 PicGo 插件市场被检索到。

## 许可证

[MIT](LICENSE)
