# 安序智护 Demo

安序智护是一个养老服务产品概念 Demo：老人可以与真实 OpenHex Agent 流式对话，并把 Agent 明确确认创建的外部工单幂等镜像到当前浏览器的 Case Store；Phase 4、紧急风险、家属请求和工作人员后续处理仍使用浏览器内的 Mock Data。Carelink 会核验天津养老政策，并通过已绑定的 OpenHex 会话提供定时提醒。

## 快速开始

环境要求：Node.js 20.12 或更高版本、已发布的 OpenHex Agent，以及对应工作区的 slug 和工作区 API Key。

```bash
cp .env.example .env.local
npm ci
npx vercel dev
```

`npm run dev` 只启动 Vite，不提供 `/api/openhex/chat-token` 和 Carelink Functions；需要真实对话或政策提醒时必须使用 `vercel dev`。应用使用 `BrowserRouter`，本地请通过开发服务器访问，不支持直接双击 `index.html` 或使用 `file://` 打开。

```bash
npm test
npm run build
```

## 运行边界

- OpenHex 消息、流式回复和会话历史是真实服务数据；工作区密钥只存在于 Vercel 服务端。
- 只有已完成的 Agent 回复同时明确建单成功并包含 `CASE-YYYYMMDD-NNN` 工单号时，才会镜像 `caseSource: 'OPENHEX'` 的本地 Case。
- OpenHex Case 镜像、Phase 4、家属端和工作人员端状态均保存在当前浏览器，不提供跨设备同步，也不回写飞书。
- Carelink Python 服务部署在 Railway，政策、订阅和去重记录保存在 `/data/policies.sqlite3` Volume；Vercel 负责浏览器同源 API、Cron 和 OpenHex 编排。

## 环境变量

| 变量 | 位置 | 说明 |
| --- | --- | --- |
| `VITE_OPENHEX_AGENT_ID` | 浏览器 | 已发布 Agent UUID |
| `VITE_OPENHEX_API_BASE_URL` | 浏览器 | 可选，默认 `https://api.openhex.tech` |
| `VITE_OPENHEX_IDLE_TIMEOUT_MS` | 浏览器 | 可选，连续无事件超时，默认 `300000` |
| `OPENHEX_WORKSPACE_SLUG` | 服务端 | OpenHex 工作区 slug |
| `OPENHEX_WORKSPACE_KEY` | 服务端 | `sk_…` 工作区密钥，禁止使用 `VITE_` 前缀 |
| `OPENHEX_AGENT_ID` | Vercel 服务端 | 后台政策推送使用的已发布 Agent UUID |
| `CARELINK_API_BASE_URL` | Vercel 服务端 | Railway Carelink HTTPS 域名 |
| `CARELINK_API_KEY` | Vercel 服务端 | Railway API 密钥 |
| `CRON_SECRET` | Vercel 服务端 | Vercel Cron Bearer 密钥 |

## 文档

首页照片位于 `public/images/life/`，顺序与裁切配置在 `src/data/lifePhotos.ts`。替换方法和素材来源见 [照片说明](./public/images/life/README.md)。

- [文档与 AI 导航](./docs/README.md)
- [产品能力](./docs/product-capabilities.md)
- [系统架构](./docs/architecture.md)
- [OpenHex 接入与排障](./docs/openhex-integration.md)
- [Carelink 政策提醒](./docs/carelink-integration.md)
- [测试与验收](./docs/testing.md)
- [线上应用成熟度评估](./docs/production-readiness.md)
- [Vercel Production 部署](./docs/operations/vercel-production.md)

供代码代理使用的仓库约束见 [AGENTS.md](./AGENTS.md)。
