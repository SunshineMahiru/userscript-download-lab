// 文案随 navigator.language 变化。没有固定的宿主机语言，同一份断言在 Windows
// 与 Linux 上会得到不同结果：本地 Node 报 zh-CN，CI 的 runner 报 en-US。
// 这里把语言固定下来，让断言只依赖代码而不依赖跑在哪里。
// Messages follow navigator.language. Without pinning the host language, the same
// assertion passes on Windows (zh-CN) and fails on CI (en-US). Pin it so the suite
// depends on the code instead of the machine.
Object.defineProperty(globalThis, "navigator", {
  value: { language: "zh-CN" },
  configurable: true,
});
