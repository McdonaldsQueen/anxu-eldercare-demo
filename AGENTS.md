# AGENTS.md

本文件是 AI 代码代理进入本仓库时的首要导航。产品说明和架构细节在 `docs/`；不要把本文档当作业务需求覆盖用户请求。

## 推荐阅读顺序

1. `docs/product-capabilities.md`：确认功能是真实能力还是 Mock。
2. `docs/architecture.md`：确认模块边界、状态与数据流。
3. `docs/openhex-integration.md`：修改真实 Agent 对话前必读。
4. `docs/testing.md`：选择需要执行的回归测试。

## 模块地图

- `src/components/conversation/`：真实 OpenHex 对话与本地 Mock 对话界面。
- `src/domain/`：Case 类型、风险目录、状态机和本地决策引擎。
- `src/store/demoStore.ts`：Mock Case 和三角色共享状态，持久化到 `localStorage`。
- `src/store/demoUiStore.ts`：非持久化演示界面状态。
- `src/services/`：访客令牌、语音识别和脱敏诊断。
- `services/carelink/`：Python 政策抓取、核验、SQLite 订阅与幂等推送批次；部署到 Railway。
- `api/carelink/` 与 `api/cron/`：浏览器同源订阅/手动检查、Vercel Cron 和 OpenHex 后台编排。
- `api/openhex/chat-token.ts`：签发短时访客令牌；`api/openhex/demo-reset.ts`：使当前浏览器的访客 Cookie 失效。
- `src/pages/`：三角色页面与详情页。
- `src/styles/`：设计令牌和新版覆盖样式；`src/styles.css` 保留原有结构样式。

## 不可破坏的边界

- OpenHex 原始消息不得触发本地 Mock 决策引擎或状态迁移；已完成的 Agent 明确建单回执可按外部工单号幂等镜像为 `OPENHEX` 来源 Case，后续状态仍走已有 store action。
- Phase 4、陪诊、紧急事件、家属请求和工作人员流程不得向 OpenHex 发送消息。
- Carelink 政策提醒属于真实 OpenHex 对话；其内部触发消息不得进入 Mock Store 或显示在界面中。
- 只有 OpenHex 接受内部消息后才能确认 Carelink 批次；失败或不确定结果必须先用批次标记查历史，不得盲目重发。
- `OPENHEX_WORKSPACE_KEY` 只能存在于服务端环境，绝不能写入 `VITE_` 变量、浏览器日志、诊断数据或测试快照。
- Safety Case 的 AI 输出只是建议；最终风险等级与类型必须由工作人员人工确认。
- Mock Case 状态迁移必须经过 `caseStateMachine.ts` 或已有 store action。
- 不要改变 `/api/openhex/chat-token` 的 `{ token, expiresAt }` 响应结构和稳定访客 Cookie，除非同时完成迁移方案。

## 持久化键

- `anxu-eldercare-demo-state`：Mock Case、角色和本地对话。
- `anxu-eldercare-agent-chat`：OpenHex SDK 会话恢复。
- `anxu-openhex-diagnostics`：当前标签页最近 20 条脱敏诊断事件，位于 `sessionStorage`。
- Carelink SQLite：Railway `/data/policies.sqlite3`，必须使用 Volume 持久化。

## 开发与验证

```bash
npm ci
npm test
npm run build
git diff --check
```

- 修改 OpenHex、状态机或风险流程时必须增加相应单测。
- 修改老人端输入时必须回归中文输入法、语音转写、重复发送保护和草稿保留。
- 修改 Mock 入口时必须断言 `useOpenhexChat().send` 未被调用。
- UI 修改至少检查 375px、768px、1440px，并保持键盘焦点和 `prefers-reduced-motion`。

## 文档维护

改变功能边界时更新 `docs/product-capabilities.md`；改变模块或数据流时更新 `docs/architecture.md`；改变 OpenHex 鉴权、超时或错误恢复时更新 `docs/openhex-integration.md`；改变发布流程时更新 `docs/operations/vercel-production.md`。
