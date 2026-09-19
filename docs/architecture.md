# 系统架构

## 总览

```mermaid
flowchart LR
  Browser[React / HashRouter] --> Pages[三角色页面]
  Pages --> AgentUI[OpenHex 对话]
  Pages --> MockUI[Mock Case 交互]
  AgentUI --> Token[/POST /api/openhex/chat-token/]
  Token --> Workspace[OpenHex Workspace API]
  AgentUI -->|访客令牌 + SSE| Agent[已发布 OpenHex Agent]
  Toolbar[演示工具栏政策提醒] --> CareApi[Vercel Carelink API]
  Cron[Vercel Cron] --> CareApi
  CareApi --> Railway[Railway Carelink]
  Railway --> PolicyDB[(SQLite /data Volume)]
  CareApi -->|短时访客令牌 + conversationId| Agent
  MockUI --> Store[Zustand Demo Store]
  Store --> Decision[本地 Decision Engine]
  Store --> Machine[Case State Machine]
  Store --> Local[(localStorage)]
  AgentUI --> Session[(SDK conversation persist)]
  AgentUI -->|明确建单回执 + 工单号| Store
  AgentUI --> Diagnostics[(sessionStorage 脱敏诊断)]
```

## 前端层次

- `app/`：路由和角色同步。
- `pages/`：页面编排，不直接实现业务判断。
- `components/conversation/`：真实 Agent 与 Mock 对话展示。
- `components/cases/`：Case 通用显示。
- `components/layout/`：应用框架、角色切换和演示工具栏。
- `domain/`：无 UI 的数据类型、状态迁移和本地决策规则。
- `store/`：持久化 Mock 业务状态和非持久化 UI 状态。
- `services/`：外部边界，包括令牌、语音和诊断。
- `services/carelink/`：独立 Python 服务，负责官方政策抓取核验、订阅、批次租约和去重。
- `api/carelink/`、`api/cron/`：Vercel 同源入口与定时编排，负责安全访问 Railway 和 OpenHex。

## 两条数据流

### OpenHex

```mermaid
sequenceDiagram
  participant U as 老人
  participant B as 浏览器
  participant V as Vercel Function
  participant O as OpenHex
  U->>B: 输入或语音草稿
  B->>V: POST /api/openhex/chat-token
  V->>O: startVisitorSession
  O-->>V: 30 分钟访客令牌
  V-->>B: token + expiresAt
  B->>O: POST conversation/send
  B->>O: SSE conversation/stream
  O-->>B: 事件与流式文本
  B-->>U: 实时回复
```

### Mock Case

`mockDecisionEngine` 解析老人或家属输入并返回决策；`demoStore` 根据决策创建或更新 Case；状态迁移由 `caseStateMachine` 验证；所有角色从同一个 store 读取，因此能看到同步进度。此链路不访问网络。

### Carelink 政策提醒

浏览器把当前 OpenHex 会话绑定到固定演示档案；Railway 持久化稳定访客引用和会话 ID。Cron 先核验政策，再租赁待推送批次；Vercel 用该访客引用签发短时令牌，查询会话历史标记后发送内部触发消息。前端隐藏触发消息，通过定期、页面聚焦、可见性恢复与手动推送后的快速轮询同步 Agent 回复。详见 [Carelink 接入](./carelink-integration.md)。

### OpenHex 外部工单镜像

`openhexCaseBridge` 从已完成的 Agent 回复中识别明确的建单回执和工单号，并尽可能读取会话历史中的建单工具参数；`demoStore.importOpenhexCase` 按外部工单号幂等地创建或补全 `OPENHEX` 来源的服务 Case。三角色页面仍从同一浏览器的 `demoStore` 读取。此流程不直接运行本地意图引擎，也不调用飞书；不同设备之间尚无共享 Case 后端。

## 状态与所有权

| 状态 | 所有者 | 持久化 |
| --- | --- | --- |
| OpenHex messages / conversationId | SDK hook | SDK localStorage namespace |
| Mock cases / role / local messages | `demoStore` | `anxu-eldercare-demo-state` |
| OpenHex / Phase 4 模式 | `demoUiStore` | 否，刷新后按 Agent 配置恢复默认 |
| 最近诊断事件 | `openhexDiagnostics` | 当前标签页 sessionStorage |
| 稳定访客身份 | Vercel Function | HttpOnly `ohx_ref` Cookie |
| 短时令牌缓存 | `openhexToken` 模块 | 内存，过期前 60 秒刷新 |
| 当前会话 ID | `demoUiStore` | 内存，仅供订阅按钮绑定 |
| 政策、订阅、批次、去重历史 | Railway Carelink | `/data/policies.sqlite3` Volume |

全局重置由 `demoReset` 协调：清空共享业务 Store、UI 模式、SDK 对话和历史缓存、令牌缓存、诊断与预留的传感器状态，并通过同源 `POST /api/openhex/demo-reset` 解除 Carelink 订阅、清除王阿姨的演示推送记录并使 HttpOnly 访客 Cookie 过期。政策缓存和抓取日志保留。静态预览中接口不可用时，本地对话仍会清空并从新会话开始。

## 视觉架构

`src/styles.css` 保留原有组件结构规则；`src/styles/tokens.css` 定义颜色、字体、间距、圆角和层级；`src/styles/redesign.css` 负责新版页面布局、角色层次、响应式和交互状态。新样式不得绕过设计令牌新增随机颜色或阴影。
