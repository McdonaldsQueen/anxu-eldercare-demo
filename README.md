# 安序智护 Demo

安序智护是一个养老服务产品概念 Demo。老人页的自然语言对话由 OpenHex 已发布 Agent 提供；陪诊和紧急事件 Case、家属同步以及服务人员处理流程仍使用浏览器内的 Mock Data。

## 环境要求

- Node.js 20.12 或更高版本
- 一个已发布的 OpenHex Agent
- 对应服务工作区的 slug 与工作区 API Key（当前为 `sk_…` 格式）
- Vercel CLI（仅本地联调 Serverless Function 时需要）

复制环境变量模板：

```bash
cp .env.example .env.local
```

填写以下变量：

| 变量 | 运行位置 | 说明 |
| --- | --- | --- |
| `VITE_OPENHEX_AGENT_ID` | 浏览器 | 已发布 Agent 的 UUID，可公开 |
| `VITE_OPENHEX_API_BASE_URL` | 浏览器 | 可选，默认 `https://api.openhex.tech` |
| `OPENHEX_WORKSPACE_SLUG` | 服务端 | 服务工作区 slug |
| `OPENHEX_WORKSPACE_KEY` | 服务端 | 工作区 API Key，绝不能使用 `VITE_` 前缀 |

## 本地运行

安装依赖并启动完整的 Vercel 本地环境：

```bash
npm ci
npx vercel dev
```

`npm run dev` 只启动 Vite 前端，不会提供 `/api/openhex/chat-token`，因此只能用于不发送真实对话的界面开发。

质量检查：

```bash
npm test
npm run build
```

## Vercel 部署

完整的生产发布、验收、故障处理和回滚流程见 [Vercel Production 部署手册](./VERCEL_PRODUCTION_DEPLOYMENT.md)。

1. 在 Vercel 中导入本 GitHub 仓库，Framework Preset 选择 Vite。
2. 在 Production、Preview 和需要使用的 Development 环境中配置上表四个变量。
3. 保持 Build Command 为 `npm run build`，Output Directory 为 `dist`。
4. 部署后在老人页发送消息，确认可以看到流式回复；刷新页面后应恢复同一段对话。
5. 在浏览器构建产物和网络请求中确认不存在任何 `sk_…` 工作区密钥。

`api/openhex/chat-token.ts` 使用 HttpOnly Cookie 为每个浏览器保存稳定访客引用，并签发 30 分钟有效的短时令牌。项目按低流量 Demo 设计；公开推广前应在 Vercel Firewall 为该接口增加速率限制。

本地 Vercel Dev 未注入服务端变量时，令牌接口会使用 Node.js 原生能力读取项目根目录的 `.env.local`；线上部署仍以 Vercel 项目环境变量为准。

GitHub Actions 只执行测试与构建，不再发布到 GitHub Pages，因为静态 Pages 无法安全保存工作区 API Key 或运行令牌签发接口。
