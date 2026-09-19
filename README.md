# 安序智护 Demo

安序智护是一个养老服务产品概念 Demo：老人可以与真实 OpenHex Agent 对话，陪诊、紧急事件、家属同步和服务人员处理流程则使用浏览器内的 Mock Data。

## 快速开始

环境要求：Node.js 20.12 或更高版本、已发布的 OpenHex Agent，以及对应工作区的 slug 和工作区 API Key。

```bash
cp .env.example .env.local
npm ci
npx vercel dev
```

`npm run dev` 只启动 Vite，不提供 `/api/openhex/chat-token`；需要真实对话时必须使用 `vercel dev`。

```bash
npm test
npm run build
```

## 环境变量

| 变量 | 位置 | 说明 |
| --- | --- | --- |
| `VITE_OPENHEX_AGENT_ID` | 浏览器 | 已发布 Agent UUID |
| `VITE_OPENHEX_API_BASE_URL` | 浏览器 | 可选，默认 `https://api.openhex.tech` |
| `VITE_OPENHEX_IDLE_TIMEOUT_MS` | 浏览器 | 可选，连续无事件超时，默认 `300000` |
| `OPENHEX_WORKSPACE_SLUG` | 服务端 | OpenHex 工作区 slug |
| `OPENHEX_WORKSPACE_KEY` | 服务端 | `sk_…` 工作区密钥，禁止使用 `VITE_` 前缀 |

## 文档

首页照片位于 `public/images/life/`，顺序与裁切配置在 `src/data/lifePhotos.ts`。替换方法和素材来源见 [照片说明](./public/images/life/README.md)。

- [文档与 AI 导航](./docs/README.md)
- [产品能力](./docs/product-capabilities.md)
- [系统架构](./docs/architecture.md)
- [OpenHex 接入与排障](./docs/openhex-integration.md)
- [测试与验收](./docs/testing.md)
- [Vercel Production 部署](./docs/operations/vercel-production.md)

供代码代理使用的仓库约束见 [AGENTS.md](./AGENTS.md)。
