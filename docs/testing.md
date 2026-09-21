# 测试与验收

## 自动化检查

```bash
npm test
npm run build
git diff --check
(cd services/carelink && python -m unittest -v)
```

| 变更 | 必跑测试 |
| --- | --- |
| OpenHex UI、超时、历史对账或重试 | `App.test.tsx`、`openhexToken.test.ts`、`openhexDiagnostics.test.ts`、`openhexHistorySync.test.ts` |
| OpenHex 外部工单镜像 | `openhexCaseBridge.test.ts`、`demoStore.test.ts`、`App.test.tsx` |
| 令牌 Function | `chatTokenApi.test.ts` |
| Case 状态或 store | `demoStore.test.ts`、`phase4.test.ts` |
| 本地意图解析 | `mockDecisionEngine.test.ts` |
| 家属对话 | `FamilyConversation.test.tsx` |
| 全局重置与访客 Cookie 失效 | `demoReset.test.ts`、`demoResetApi.test.ts`、`App.test.tsx` |
| Carelink 编排和安全渲染 | `carelinkApi.test.ts`、`carelinkPolicy.test.ts`、`policyPush.test.ts`、`SafeMessageText.test.tsx` |
| Python 政策与批次状态 | `services/carelink/test_policy_service.py`、`test_push_service.py` |

## UI 验收

- 375px：老人输入、工具栏、风险追问和工作人员表单不能横向溢出。
- 768px：三角色主页面保持清晰的信息优先级。
- 1440px：内容宽度受限，不出现过宽正文或空洞卡片。
- 键盘：跳转链接、角色切换、工具栏、输入、发送和 Case 操作均有可见焦点。
- 辅助功能：状态变化使用 `aria-live` 或 `role=status/alert`，风险不只靠颜色表达。
- 动效：系统设置降低动态效果时关闭滚动和脉冲动画。

## 路由与部署拓扑验收

- 使用开发服务器或 Vercel 访问，不用 `file://` 打开构建产物。
- `/elder`、`/family`、`/staff` 及详情页刷新后仍由 Vercel rewrites 返回应用入口，再交给 `BrowserRouter`。
- Railway GitHub 部署使用仓库根目录 `railway.toml` 与 `Dockerfile.carelink`；目录内 Docker 配置只用于独立部署入口。
- `/data` Volume 在重新部署后仍保留政策缓存、订阅与去重记录。

## OpenHex Preview 验收

1. 使用真实 Production-like 环境变量部署 Vercel Preview。
2. 首条消息能经历冷启动并流式显示回复。
3. 连续等待超过 3 分钟但不足 5 分钟时不会被旧默认值中止。
4. 刷新页面后恢复同一访客会话；隐私窗口获得独立身份。
5. 超时后显示“重新连接并同步会话”，不会自动重复发送。
6. 演示工具栏可复制脱敏诊断，内容不含消息、令牌、Cookie 或 `sk_…`。
7. 陪诊和紧急 Mock 入口不调用 Agent，三角色流程继续联动。
8. 当 SSE 未归并最终文本时，包含本轮 `result` 的历史会即时替换 thinking 占位，且不会重发消息。
9. 绑定政策提醒后，手动推送无需刷新即可出现；内部 `[CARELINK_POLICY_PUSH:…]` 消息不可见。
10. 政策来源显示标题而非裸链接，只允许 HTTPS 且在新标签页打开。

## Carelink Preview 验收

1. Railway `/health` 返回 `200`，重启后 `/data` 中的去重记录仍存在。
2. 未创建 OpenHex 会话时不能启用提醒；绑定后状态只显示地区、时间和会话尾号。
3. 同一政策连续手动/Cron 触发只发送一次；失败任务不确认并能重试。
4. Vercel Cron 的两个路径已注册，且没有正确 Bearer 密钥时返回 `401`。
5. 浏览器产物、网络响应和日志不包含工作区密钥、Carelink API Key、Cron Secret 或完整访客标识。

## Production 发布门槛

Preview 完成上述验收后，按照 [Vercel Production 部署手册](./operations/vercel-production.md)发布。上线后复查正式域名、令牌接口、真实回复、Mock 流程和构建产物密钥扫描。

## 当前基线

2026-09-21 基于 `main` 提交 `1eaadae` 验证：19 个前端测试文件、118 项测试通过；Carelink 11 项 Python 测试通过；TypeScript 与 Vite Production build 通过。
