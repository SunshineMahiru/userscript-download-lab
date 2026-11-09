# 适配器接口与数据结构

本文定义引擎与站点之间的边界。引擎负责取、判、存；适配器只负责描述某个站点长什么样。

## 一、设计依据

**资源是描述，不是访问。** 1EdTech 的 OneRoster 标准对 Resource 的定义是「一份足够详尽、使得该资源本身可以被获取的描述」，并明确说明它「不提供对资源本身的访问」。这句话正好划出本项目的分工线：适配器产出描述，引擎执行获取。

**分层参照。** yt-dlp 把站点差异压缩到子类的单个方法里，核心不感知站点；本项目把这个位置扩展成一组函数，因为课程站点的差异比视频站点更分散——章节定位、列表分页、状态查询、序列识别分布在四个位置。

**能力声明。** OneRoster 的集合接口支持分页、过滤与排序，但并非每个实现都提供。适配器因此需要显式声明自己支持哪些能力，引擎据此决定走完整流程还是简化流程。

## 二、职责边界

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| 适配器 | 从页面与地址里识别章节；拼接口地址；从响应里取字段 | 发请求、重试、写 DOM、决定下载方式 |
| 引擎 | 调度请求、归一错误、规整文件名、执行下载、合成序列 | 知道任何站点的域名、字段名、参数 |
| 界面 | 呈现进度与失败原因 | 决定业务规则 |

判断一行代码归属的单一标准：**它是否知道某个具体站点的存在**。知道，就属于适配器。

## 三、接口定义

### 必需成员

```js
{
  id: "fixture",              // 适配器标识，用于日志与测试定位
  version: 1,                 // 接口版本，引擎据此判断兼容性
  match: ["http://127.0.0.1:8080/*"],   // 生效范围，与脚本管理器的 match 语义一致

  capabilities: { /* 见第四节 */ },

  // 章节定位。拿不到返回 null，引擎据此提示「当前页不是章节页」
  readChapter(context) -> Chapter | null,

  // 列表请求。cursor 为 null 表示第一页
  listingRequest(chapter, cursor) -> RequestSpec | null,

  // 解析列表响应。返回一页引用与下一页游标
  parseListing(text, cursor) -> { refs: ResourceRef[], nextCursor: string | null },

  // 单个资源的状态请求
  statusRequest(chapter, ref) -> RequestSpec,

  // 从状态响应里取最终地址。取不到返回 null，引擎据此记为「无可下载地址」
  parseStatus(payload, ref) -> Resource | null,
}
```

### 可选成员

| 成员 | 启用条件 | 缺失时的行为 |
| --- | --- | --- |
| `parseMedia(payload, ref)` | `capabilities.media` | 只按 `parseStatus` 给出的单一地址处理，不列多码率 |
| `readSeries(context)` | `capabilities.series` | 幻灯片合成入口不可用，面板提示「未检测到序列」 |
| `probeAuth(payload)` | `capabilities.authProbe` | 登录态过期只能靠 HTTP 状态码间接判断 |
| `parseListing` 返回 `nextCursor` | `capabilities.paging` | 只取第一页 |

### 上下文对象

`readChapter` 与 `readSeries` 收到同一个上下文，避免二次读取页面：

```js
Context = {
  url: string,              // 当前页面地址
  document: Document,       // 当前文档
  inlinePayloads: string[], // 页面内联脚本的文本，按出现顺序
  entries: PerformanceEntry[] | null,  // 资源加载记录，环境不支持时为 null
}
```

引擎负责采集这四样，适配器只做判断与提取。

### 适配器的选定

引擎持有一个适配器列表，按顺序用 `match` 匹配当前地址，取第一个命中的。本仓库只注册一个参考适配器，`match` 指向合成站点。真实站点的适配器不进入仓库，由使用者在自己的副本里注册，因此引擎必须容忍零命中：零命中时面板提示「当前页面没有可用适配器」，不抛错。

## 四、能力声明

```js
capabilities = {
  listing: boolean,    // 必为 true
  paging: boolean,     // 列表分页
  status: boolean,     // 单资源状态查询，必为 true
  media: boolean,      // 视频与音频的多码率或分片
  series: boolean,     // 幻灯片图片序列
  authProbe: boolean,  // 登录态探测
}
```

引擎启动时校验：`listing` 或 `status` 为 false 直接抛错，不做降级。其余能力缺失时按第三节的表格处理，界面提示对应功能不可用。

## 五、数据结构

```js
// 章节标识。键名由适配器定义，引擎只透传
Chapter = {
  id: string,
  title: string,
  context: Record<string, string>,
}

// 列表返回的资源引用
ResourceRef = {
  id: string,
  name: string,
  type?: string,        // 站点自报的类型，仅作提示，不参与判定
  meta?: Record<string, unknown>,  // 适配器私有字段，引擎不解读
}

// 解析后的资源，交给下载引擎
Resource = {
  refId: string,
  name: string,         // 已经过文件名规整
  url: string,
  mimeType: string,     // 由地址后缀推断，推断不出时为 application/octet-stream
  kind: "pdf" | "ppt" | "word" | "sheet" | "video" | "audio" | "archive" | "file",
  expiresAt?: number,   // 过期时间戳，毫秒；未知时缺省
}

// 媒体变体，parseMedia 可选返回
MediaVariant = {
  url: string,
  mimeType: string,
  delivery: "direct" | "playlist" | "segment",  // 直链、清单、单分片
  bandwidth?: number,
}

// 幻灯片序列
SlideSeries = {
  prefix: string,
  extension: "png" | "jpeg",
  query: string,
  count?: number,
}

// 请求描述。适配器只描述，不执行
RequestSpec = {
  url: string,
  method?: "GET",               // 目前只支持 GET
  headers?: Record<string, string>,
  responseType?: "text" | "json" | "blob",
}

// 导出结果
ExportOutcome = {
  saved: number,
  failed: Array<{ name: string, code: string, hint: string }>,
}
```

`RequestSpec` 里允许适配器自带请求头，是因为不同站点对 Referer、Accept 的要求不同；引擎不猜测，也不补默认值。

下载阶段沿用该资源的 `statusRequest` 请求头。同一个资源的取址与取文件通常要求相同的上下文，另开一套下载请求头只会让适配器多写一份重复声明。

## 六、错误分类

错误分四类，来源不同，处理方式也不同。管理器一类沿用脚本管理器给出的原值；传输、内容、适配器三类由引擎归一，命名规则见下表。

| 类别 | 典型码 | 产生位置 | 呈现方式 |
| --- | --- | --- | --- |
| 管理器 | `not_permitted`、`not_whitelisted`、`not_enabled`、`not_supported` | 下载调用 | 附处理办法，指向管理器设置 |
| 传输 | `timeout`、`network`、`http-403`、`http-404`、`http-5xx` | 请求层 | 附重试建议与状态码 |
| 内容 | `empty`、`not-a-file`、`expired`、`parse-failed` | 解析层 | 说明响应不符合预期，附响应类型 |
| 适配器 | `chapter-not-found`、`unsupported-page`、`capability-missing` | 适配器校验 | 提示当前页不适用或功能不可用 |

`not-a-file` 指响应是 HTML 或 JSON 错误页而非二进制，靠响应类型判定，不靠大小。

## 七、依赖与版本约定

- jsPDF 经 `@require` 从 CDN 加载，版本固定为 4.2.1；测试使用 npm 的同版本包。两处必须一致，否则 PDF 页面尺寸的断言与线上行为不符。
- 除 jsPDF 外不引入运行时依赖。开发依赖只有 esbuild 与 jsdom。
- 接口版本号写在适配器的 `version` 字段。引擎遇到不认识的版本时报错，不做兼容猜测。

## 八、合成站点需要提供的形态

接口定下之后，站点只需能覆盖这些形态：

| 形态 | 用途 |
| --- | --- |
| 内联 JSON 的章节页 | 验证 `readChapter` 与 `inlinePayloads` |
| 分页列表 | 验证 `paging` 与游标传递 |
| 多候选地址的状态响应 | 验证候选优先级与 `expiresAt` |
| 302 跳转到带签名的地址 | 验证重定向跟随 |
| 签名过期返回 403 | 验证 `expired` 分类 |
| 递增命名的图片序列 | 验证 `readSeries` 与页数探测 |
| 视频清单地址 | 验证 `parseMedia` 与 `delivery: "playlist"` |

## 九、不做什么

- 不定义解密、分片合并、权限绕过相关的任何接口。这些能力不在项目边界内，接口里也不预留位置。
- 不定义跨章节或跨课程的遍历接口。引擎按单章工作。
- 不为适配器提供 DOM 写入能力。界面归引擎。
