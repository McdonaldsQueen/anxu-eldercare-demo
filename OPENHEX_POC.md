# OpenHex 体验模式 PoC

本 PoC 只验证已发布 OpenHex Agent 的自然语言理解与多轮上下文。OpenHex 对话保存在聊天组件自己的临时状态中，不调用 `mockDecisionEngine`，也不会读取或写入 Case Store、规则引擎和状态机。

## 环境要求

- Node.js 20 或更高版本。
- 一个已发布的 OpenHex Agent，以及它的 `agentId`。
- 一个 OpenHex 个人 API Key。

当前安装的 `@openhex-ai/agent-sdk` 是 0.5.0。官方快速开始页面写的是 Node.js 18 或更高，但该版本 npm 包的 `engines.node` 实际声明为 `>=20`，因此本项目按 Node.js 20 作为最低版本。

## 配置后端

复制 `server/.env.example` 为 `server/.env`，填写：

```dotenv
OPENHEX_API_KEY=mysta_你的个人APIKey
OPENHEX_AGENT_ID=你的已发布Agent的ID
```

`OPENHEX_API_KEY` 仅由本地 Node 后端读取。`server/.env` 已被 `.gitignore` 中的 `.env` 规则忽略，不要把真实密钥写入任何 `VITE_` 变量、React 代码或提交到 Git。

## 启动

安装依赖后，在项目根目录运行：

```powershell
npm.cmd run dev:all
```

这会同时启动 Vite 前端和 `http://127.0.0.1:8787` 上的本地后端。若系统允许执行 `npm.ps1`，也可以使用 `npm run dev:all`。

也可以分别开两个终端运行 `npm.cmd run dev` 与 `npm.cmd run dev:server`。

## 验证 conversationId 复用

进入老人端聊天，将模式切换为“OpenHex 体验”。首轮回复后，界面会显示完整 `conversationId`。继续发送第二轮消息，显示的 ID 应保持不变；后端终端首轮会打印 `created conversationId=...`，后续轮次会打印 `reused conversationId=...`。点击“新建体验会话”后，下一条消息应获得新的 ID。

## 人工测试清单

1. 不配置 `server/.env` 启动项目，切到 OpenHex 体验并发送消息；确认界面显示可恢复错误，切回 Mock Demo 后原流程仍可使用。
2. 配置有效 Key 和已发布的 `agentId`，发送“请记住暗号 ORBIT-7，只回复收到”；确认出现 Agent 回复和 `conversationId`。
3. 再发送“我刚才让你记住的暗号是什么？”；确认 Agent 能回答 `ORBIT-7`。
4. 对照两轮界面中的 `conversationId` 和后端日志；确认 ID 完全相同，第二轮日志为 `reused`。
5. 点击“新建体验会话”，发送“暗号是什么？”；确认产生新的 `conversationId`，且 Agent 不应依赖上一段会话回答。
6. 在 OpenHex 模式发送普通请求与风险描述；确认老人端 Case 数量、家属端和工作人员端数据没有变化。
7. 切回 Mock Demo，完成既有陪诊或紧急风险流程；确认 Case 创建和三端联动仍与原 Demo 一致。
8. 使用无效 Key 或临时停止后端后发送；确认只显示 OpenHex 错误，已存在的 Mock Demo 对话与 Case 不丢失。
9. 检查浏览器开发者工具的前端资源与请求体；确认没有 `OPENHEX_API_KEY`，聊天请求只包含消息与可选的 `conversationId`。
10. 运行 `git status --short --ignored`；确认 `server/.env` 显示为被忽略文件，不会进入提交。
