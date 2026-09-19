# ADR 0003：Carelink 定时政策推送

## 状态

已采用。

## 决策

Python 抓取与 SQLite 去重部署在带持久卷的 Railway；Vercel 负责 Cron、浏览器同源 API 和 OpenHex 会话发送。浏览器显式绑定当前 OpenHex `conversationId`，后台用同一个稳定 `sp_user_ref` 签发短时访客令牌后继续该会话。

OpenHex 没有后台直接插入助手消息的接口，因此系统发送带唯一批次标记的内部用户消息，让 Agent 在同一会话生成提醒。前端隐藏内部消息，只展示 Agent 回复；发送前通过历史标记对账解决不确定超时。

## 结果

工作区密钥和 Carelink 密钥保持在服务端，Railway 重启不丢失去重记录，定时任务和手动任务不会重复领取。代价是依赖 Agent 正确处理结构化提醒，并接受 Vercel Hobby 的小时级调度窗口。
