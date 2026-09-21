# Carelink 政策提醒接入

## 业务范围

固定演示对象为 `E001 / 王阿姨 / 82 岁 / 天津市户籍`。用户必须先在老人端创建 OpenHex 对话，再在演示工具栏启用每日提醒；每次只保留一个绑定会话，重新绑定会替换旧会话。

Carelink 政策提醒属于真实 OpenHex 对话，不创建或修改本地 Mock Case。政策来源在 Agent 回复中以 `[政策标题](https://政府原文)` 展示，浏览器只把 `https:` Markdown 标题链接渲染为新标签页链接。

## 调度与数据流

```mermaid
sequenceDiagram
  participant C as Vercel Cron / 手动检查
  participant R as Railway Carelink
  participant O as OpenHex
  participant B as 老人端浏览器
  C->>R: crawl（刷新并核验）
  C->>R: claim（SQLite 租约）
  R-->>C: batch + subscription
  C->>O: startVisitorSession(sp_user_ref)
  C->>O: messages(conversationId) 对账批次标记
  alt 尚未发送
    C->>O: send([CARELINK_POLICY_PUSH:batch])
  end
  C->>R: complete（写入去重历史）
  O-->>B: Agent 政策说明
  B->>O: 定期/聚焦/可见性恢复/手动后同步历史
```

Vercel Cron 使用 UTC：`0 0 * * *` 对应北京时间 08:00–08:59 抓取，`0 1 * * *` 对应 09:00–09:59 推送。Hobby 调度可能在该小时内浮动，不承诺分钟级准时。

## 幂等与失败语义

- `deliveryId` 标识政策版本及提醒次数；批次 ID 由接收人和 delivery IDs 稳定计算。
- `claim` 使用 10 分钟租约和 SQLite 写锁；并发任务只能有一个得到批次。
- Vercel 发送前查询 OpenHex 历史中的 `[CARELINK_POLICY_PUSH:<batchId>]`。存在时不重发，直接补做完成确认。
- 只有 OpenHex `chat.send` 返回接受结果后才 `complete`。任一步失败调用 `fail`，不写入 `sent`，后续任务可重试。
- 手动检查有 60 秒冷却；全局重置解除订阅并清除该演示用户的 proposals、sent 和批次，不删除政策与抓取日志。

## 订阅与批次生命周期

| 操作 | 状态变化 | 失败处理 |
| --- | --- | --- |
| `subscribe` | 以 `E001` 保存稳定访客引用和当前 `conversationId`；重新绑定替换旧会话 | 不暴露完整访客引用，只返回启用状态、地区、时间和会话尾号 |
| `claim` | 筛选王阿姨适用且未发送的政策，创建或领取带 10 分钟租约的批次 | SQLite `BEGIN IMMEDIATE` 保证并发 Cron 与手动任务不会同时领取 |
| OpenHex 对账 | 按批次标记查询已绑定会话历史 | 已存在标记时跳过重发，继续完成确认 |
| `complete` | OpenHex 接受消息后确认批次，并把 delivery IDs 写入已发送记录 | 只有确认接受后才能调用 |
| `fail` | 释放或记录失败批次，不写入已发送记录 | 后续任务可以重新领取并再次对账 |
| `reset-recipient` | 删除演示订阅、proposals、sent 和批次运行记录 | 保留已核验政策和抓取日志 |

浏览器公开类型只承载脱敏状态：`PolicySubscriptionStatus`、`ManualPolicyPushResult` 和 `PolicyPushOutcome`。结果枚举为 `sent | no_new | busy | not_subscribed | cooldown | failed`，不得携带 API Key、完整访客引用或内部消息正文。

## 密钥与隐私

| 位置 | 变量 |
| --- | --- |
| Railway | `POLICY_API_KEY`、`POLICY_DB_PATH=/data/policies.sqlite3`、平台注入的 `PORT` |
| Vercel Server | `CARELINK_API_BASE_URL`、`CARELINK_API_KEY`、`CRON_SECRET`、`OPENHEX_AGENT_ID`、既有 OpenHex 工作区变量 |
| 浏览器 | 只有非敏感订阅状态、Agent ID 和短时访客令牌 |

`CARELINK_API_KEY`、`CRON_SECRET`、工作区密钥、完整访客标识和内部批次内容不得进入浏览器日志、诊断或公开响应。Railway API 的异常统一映射为通用错误。

## Railway 运维

1. Railway 服务连接当前 GitHub 仓库的 `main`。仓库根目录 `railway.toml` 指向 `Dockerfile.carelink`，Docker 构建只复制 `services/carelink/`；不要再把 Root Directory 配置成唯一部署前提。
2. 如需从 `services/carelink/` 单独创建服务，可使用目录内的 `railway.toml` 与 `Dockerfile`，两种入口运行同一个 Python 服务。
3. 挂载 `/data` Volume，公开 HTTPS 域名，健康检查 `/health`，并设置 `POLICY_DB_PATH=/data/policies.sqlite3`。
4. 设置 Railway 变量，并将公开域名和相同 API Key 配置到 Vercel；GitHub `main` 更新后由 Railway 自动部署。
5. 先验证 `/health`，再人工触发 crawl、绑定会话和 manual-push。当前生产拓扑使用一个 500 MB `/data` Volume，定时抓取由 Vercel 负责，容器以 `--refresh-hours 0` 避免双重调度。

## 当前生产调度

| 组件 | 当前状态 |
| --- | --- |
| Railway Carelink | GitHub `main` 自动部署，`/health` 检查 Python 服务和政策数量 |
| `/api/cron/carelink-crawl` | Vercel Cron `0 0 * * *`，北京时间 08:00–08:59 |
| `/api/cron/carelink-push` | Vercel Cron `0 1 * * *`，北京时间 09:00–09:59 |
| SQLite | `/data/policies.sqlite3`，Volume 跨部署和重启保留 |

上游来源与同步方式见 `services/carelink/UPSTREAM.md`，服务内接口见 `services/carelink/openapi.json`。
