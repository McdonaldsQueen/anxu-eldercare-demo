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

浏览器仍以 SSE 为实时主链路。为处理“服务端已经完成并写入历史，但当前 SSE 没有把最终文本归并进 Hook 状态”的边缘情况，老人端在回复期间通过同一访客会话读取 `messages(conversationId)`。只有历史中同时出现本轮用户消息和后续 `result` 事件时，才会把历史视为权威结果并替换 thinking 占位；这不会重发用户消息。发送响应中的 `conversationId` 只保留在内存中用于本轮对账，诊断记录仍只保存尾部摘要。

Agent 回合完成后，老人端识别明确的建单成功回执和 `CASE-YYYYMMDD-NNN` 工单号，再读取会话历史补全可用的工具参数。`openhexCaseBridge` 只把外部工单镜像到当前浏览器的 Case Store；它不根据老人原始需求自行建单，也不操作飞书。若 Agent 提到工单号而 Web 无法确认建单，页面提示人工核对，避免盲目重提。

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
