# 实验四：错误码谱系与提示映射

## 问题

下载失败的原因分散在四个层面：脚本管理器的下载接口、HTTP 传输、响应内容、适配器能力。用户看到的通常只有一句「下载失败」，无法判断该去管理器设置里改白名单，还是重新登录，还是这个文件本来就不能下。

需要一套分类，让失败原因能对应到具体动作上。

## 方法

按来源分四类，命名规则不同：

- **管理器类**沿用脚本管理器给出的原值，不自造同义词。这些码本身就是管理器的公开接口，改写会让用户搜不到对应文档。
- **传输类**由状态码归一：403 → `http-403`，404 → `http-404`，5xx → `http-5xx`，超时 → `timeout`，连接失败 → `network`。
- **内容类**描述响应本身的问题：`empty` 表示没取到内容，`not-a-file` 表示拿到的是错误页或 JSON 而不是二进制。
- **适配器类**描述配置或页面不匹配：`chapter-not-found`、`capability-missing`。

每类配一条可操作提示。提示写「去做什么」，不写「哪里错了」。

## 缺陷判定的取舍

`not-a-file` 靠响应类型判定，不靠体积。理由是错误页可能比正常文件还大：一个带完整样式的 403 页面有几十 KB，而一张小图标只有 1 KB。按体积判断会在两个方向上同时出错。

## 数据

测试实际触发到的码：

| 类别 | 码 | 触发场景 | 测试位置 |
| --- | --- | --- | --- |
| 传输 | `http-403` | 签名过期的资源 | `tests/engine.test.mjs` |
| 传输 | `http-404` | 状态码归一 | `tests/errors.test.mjs` |
| 传输 | `http-5xx` | 500 与 502 都归为同一码 | `tests/errors.test.mjs` |
| 传输 | `http-418` | 未归类的状态码保留原值 | `tests/errors.test.mjs` |
| 传输 | `timeout` | 管理器的 `ontimeout` 回调 | `tests/errors.test.mjs` |
| 传输 | `network` | 管理器的 `onerror` 回调 | `tests/errors.test.mjs` |
| 内容 | `empty` | 序列前缀不存在；PDF 无页面 | `tests/slides.test.mjs` |
| 内容 | `not-a-file` | 状态有返回但没有可下载地址 | `tests/errors.test.mjs` |
| 适配器 | `chapter-not-found` | 页面没有内联数据 | `tests/engine.test.mjs` |
| 适配器 | `capability-missing` | 适配器声明 `listing: false` | `tests/errors.test.mjs` |
| 适配器 | `transport-missing` | 管理器没有提供请求接口 | `tests/errors.test.mjs` |
| 管理器 | `not_enabled` | 管理器没有提供下载接口 | `tests/errors.test.mjs` |
| 管理器 | `not_permitted` | 管理器拒绝下载，原码透传 | `tests/errors.test.mjs` |
| 管理器 | `not_supported` | 管理器不支持该资源类型 | `tests/boot.test.mjs` |

未被测试触发的码：

| 类别 | 码 | 未触发原因 |
| --- | --- | --- |
| 适配器 | `adapter-missing` | 需要构造一个不传适配器的引擎，当前没有这条用例 |
| 管理器 | `not_whitelisted`、`not_found`、`forbidden`、`not_succeeded` | 只是映射表里的条目，本实现不产生这些码 |

十四种码已被实际触发，剩下的或需要真实管理器才能复现，或根本不由本实现产生。管理器码保持原值的做法在测试里也验了：`not_permitted` 从管理器传出后，引擎记录的就是原码，不是改写过的新码。

## 结论

四类分法的价值在于把提示写准。同一个 403，在传输层意味着「登录态过期」，在管理器层意味着「域名未放行」，处理动作完全不同。合并成一个码就必然二选一，总有一半用户被误导。

管理器码保持原值这一条，在实现上意味着两张表：一张是原样透传的码，一张是自己归一的码。多写一张表，换来的是用户能在管理器文档里搜到对应说明。

## 局限

错误提示的语言只有中文，没有做本地化。超时只在管理器回调这一层验证过：测试直接触发 `ontimeout`，没有真实慢响应的数据。
