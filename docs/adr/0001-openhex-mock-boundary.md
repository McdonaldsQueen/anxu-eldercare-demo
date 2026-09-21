# ADR 0001：隔离 OpenHex 对话与 Mock Case

- 状态：部分被 [ADR 0004](./0004-openhex-confirmed-order-mirror.md) 取代
- 日期：2026-09-16

## 决策

真实 OpenHex 原始输入不进入本地 Mock 决策引擎。Phase 4、本地快捷入口、家属请求和工作人员操作只使用 Mock store，不向 OpenHex 发送消息。

原决策中“OpenHex 不直接创建或修改浏览器内 Case”的绝对限制已由 ADR 0004 收窄：只有 Agent 已完成并明确确认建单成功、同时提供有效外部工单号时，允许把该外部结果幂等镜像为 `OPENHEX` 来源的本地 Case。

## 原因

当前 Demo 没有生产级身份、业务数据库或 Agent 到 Case 的受控写入接口。混合两条链路会让演示数据被误认为真实处理结果，也会增加安全风险和难以复现的状态。

## 后果

演示工具栏必须明确标注对话来源；风险追问只在 Mock 模式显示；未来接入真实 Case 后端时需要新的 API、权限、审计和迁移 ADR。
