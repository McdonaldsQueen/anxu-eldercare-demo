# 安序智护文档导航

本文档集同时服务于产品、工程人员和 AI 代码代理。所有内容以仓库当前代码为准，PRD 或外部文档中的历史限制不能自动覆盖当前用户需求。

| 文档 | 回答的问题 |
| --- | --- |
| [产品能力](./product-capabilities.md) | 三个角色能做什么？哪些是真实能力，哪些是 Mock？ |
| [系统架构](./architecture.md) | 模块、状态、数据和请求如何流动？ |
| [OpenHex 接入](./openhex-integration.md) | 鉴权、流式回复、超时、诊断和恢复如何工作？ |
| [Carelink 政策提醒](./carelink-integration.md) | 政策核验、订阅、定时推送、幂等和 Railway 如何工作？ |
| [测试与验收](./testing.md) | 改动后需要跑哪些检查？ |
| [ADR](./adr/) | 为什么选择当前边界和实现？ |
| [Vercel Production](./operations/vercel-production.md) | 如何发布、验收和回滚？ |

## AI 快速入口

1. 先读根目录 `AGENTS.md` 的不可破坏边界。
2. 根据任务只读取对应文档和代码模块，避免把真实 Agent 与 Mock Case 混在一起。
3. 对外部 OpenHex 行为存在疑问时，以官方文档和当前安装的 SDK 类型为准。
4. 修改后同步文档，并运行 `npm test`、`npm run build` 和 `git diff --check`。
