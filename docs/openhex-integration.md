# OpenHex 接入与排障

## 安全模型

浏览器只持有 30 分钟短时访客令牌。`OPENHEX_WORKSPACE_KEY` 与工作区 slug 由 Vercel Function 读取；密钥不能出现在前端环境变量、构建产物、日志或诊断记录中。

`ohx_ref` Cookie 使用 `HttpOnly`、`SameSite=Lax`、180 天有效期，Production 环境增加 `Secure`。SDK 使用 `anxu-eldercare-agent-chat` 恢复同一浏览器的对话。

全局「重置演示」先向同源 `POST /api/openhex/demo-reset` 请求使 `ohx_ref` 过期，再调用 SDK 的 `chat.clear()`，清除其 `ohx:convo:anxu-eldercare-agent-chat` 持久化键、前端令牌缓存与诊断记录。静态预览没有 API 时仍清除本地会话；下一条消息会创建新对话，不会恢复旧 `conversationId`。重置不会删除 OpenHex 服务端已有的历史记录。

## 超时边界

| 环节 | 边界 | 行为 |
| --- | --- | --- |
| 浏览器获取访客令牌 | 15 秒 | 中止本次请求、清理并发锁，下次可重新获取 |
| SDK 非流式请求 | 默认 30 秒 | 发送、历史等请求应快速返回 |
| Agent 本轮空闲 | 默认配置 300 秒 | 连续没有任何事件才超时，不是总执行时间 |
| SSE 流 | 无总时长上限 | SDK 自动重连，直到结果、停止或空闲超时 |
| 历史对账 | 回复期间每 2 秒 | 发现当前轮 `result` 后立即用权威历史更新界面 |
| 后台政策回复 | 可见页面每 30 秒；手动推送后每 2 秒 | 聚焦、恢复可见性时也立即同步 |

Vercel Function 不代理 Agent 回复，因此 Agent 长任务不受该 Function 执行时长直接限制。首轮冷启动或子 Agent 委派可能较长；界面依次显示连接、唤醒、复杂任务和生成回复状态。

## 四条会话链路

| 链路 | 触发方式 | 前端处理 |
| --- | --- | --- |
| SSE 实时回复 | 用户发送文字或语音草稿 | `useOpenhexChat` 持续更新同一条 Agent 消息 |
| 当前轮历史对账 | 回复期间 SSE 未归并最终结果 | 每 2 秒读取同一会话历史，确认当前用户消息后存在 `result` 才替换占位 |
| 后台政策同步 | Carelink Cron 或手动推送 | 隐藏内部批次消息；页面聚焦、恢复可见性、30 秒轮询及手动后的快速轮询同步 Agent 回复 |
| 外部工单镜像 | 已完成的 Agent 回复明确建单成功 | 解析工单号并读取可用工具参数，幂等写入当前浏览器 Case Store |

浏览器仍以 SSE 为实时主链路。为处理“服务端已经完成并写入历史，但当前 SSE 没有把最终文本归并进 Hook 状态”的边缘情况，老人端在回复期间通过同一访客会话读取 `messages(conversationId)`。只有历史中同时出现本轮用户消息和后续 `result` 事件时，才会把历史视为权威结果并替换 thinking 占位；这不会重发用户消息。发送响应中的 `conversationId` 只保留在内存中用于本轮对账，诊断记录仍只保存尾部摘要。

## 外部工单镜像

Agent 回合完成后，`openhexCaseBridge` 才尝试识别外部工单。以下条件必须同时满足：

1. Agent 回复明确表达已经创建或提交成功，而不是计划创建、询问信息或报告失败。
2. 回复包含符合 `CASE-YYYYMMDD-NNN` 的工单号。
3. 当前消息属于真实 OpenHex 模式，不是内部 Carelink 触发消息或 Phase 4 Mock 对话。

桥接器会尽可能从会话历史中的建单工具参数补全服务类型、医院、预约时间和请求摘要，生成 `ConfirmedOpenhexCase`。`demoStore.importOpenhexCase` 以工单号为幂等键：不存在时创建 `caseSource: 'OPENHEX'` 的本地 Case；已存在且仍待评估时可补全为服务 Case；不会覆盖同号的非 OpenHex Case。

仅出现工单号、信息不完整或无法确认成功时不会盲目建卡，界面提示人工核对。镜像 Case 只存在于当前浏览器的 `anxu-eldercare-demo-state`，不提供跨设备同步，不回写 OpenHex 或飞书；工作人员后续接单、开始和完成仍走本地 store action 与状态机。

官方参考：

- <https://docs.openhex.tech/sdk/chat/>
- <https://docs.openhex.tech/sdk/react/>
- <https://docs.openhex.tech/sdk/errors/>

## 错误与恢复

| 分类 | 用户动作 |
| --- | --- |
| `timeout` | 重新加载页面并通过 SDK 持久化会话同步历史，不自动重复发送 |
| `auth` | 清除令牌缓存，再由用户明确重试 |
| `rate_limit` | 等待冷却后重试 |
| `upstream` | 稍后重新连接 |
| `network` | 检查网络并重试 |
| `cancelled` | 已停止本轮，不自动继续 |

不要在空闲超时后直接调用 `chat.retry()`：发送接口可能已经接受上一条消息，盲目重发会产生重复任务。

## 脱敏诊断

诊断包装记录 `token`、`send`、`stream`、`history`、`interrupt`、首事件、首文本和完成阶段。每条只包含时间、结果、耗时、HTTP 状态和会话 ID 尾部六位。最多保留 20 条在当前标签页的 `sessionStorage`。

禁止记录：

- Authorization、访客令牌、工作区密钥。
- 用户消息、Agent 回复、请求体。
- 完整会话 ID、Cookie 或访客引用。

## 排障顺序

1. 确认 `/api/openhex/chat-token` 是 `POST 200`；地址栏直接访问得到 `405` 是正常行为。
2. 在演示工具栏检查失败发生在 token、send 还是 stream。
3. token 失败时检查 Vercel 环境变量、工作区 slug 和密钥有效性。
4. send 30 秒超时时检查 OpenHex API 可达性和状态码。
5. stream 空闲 300 秒超时时检查 Agent 冷启动、工具调用或子 Agent 是否持续无事件。
6. 刷新同步历史，确认结果是否已在 OpenHex 会话中完成，再决定是否重新发送。

正常情况下历史对账会自动完成第 6 步；只有 token 或 history 请求本身持续失败时才需要手动刷新。

## 后台政策触发

Carelink 使用绑定会话所属的 `sp_user_ref` 签发短时访客令牌，并发送包含唯一 `[CARELINK_POLICY_PUSH:<batchId>]` 标记的内部用户消息。老人端按该前缀隐藏内部消息，但保留 Agent 回复。发送前读取会话历史中的标记，防止发送成功但本地完成确认超时后再次触发。完整流程见 [Carelink 政策提醒](./carelink-integration.md)。
