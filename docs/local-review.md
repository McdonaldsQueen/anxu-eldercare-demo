# 本地部署与审查

审查日期：2026-09-19。基准：main，提交 5b3f821。

## 部署

- 地址：http://127.0.0.1:4173/
- 模式：生产构建的本地 Vite Preview，仅监听本机；浏览器内 Mock 业务可用。
- 重启：在项目目录执行 `powershell -ExecutionPolicy Bypass -File .\start-local.ps1`。脚本会重新构建并前台运行，Ctrl+C 停止。已有服务占用 4173 时会退出，不会自动换端口。
- 本次后台进程 PID：64588，可通过 `Stop-Process -Id 64588` 停止（先确认该 PID 仍对应本项目 Node 服务）。日志为 `local-server.log` 与 `local-server-error.log`。本次服务未配置开机启动。
- `.env.local` 已从模板创建，未填任何凭据。真实对话需要填写 Agent ID、工作区 slug 和工作区密钥，并按 README 使用 `npx vercel dev`。Preview 不运行 `/api/openhex/chat-token`。
- 业务数据为当前浏览器 localStorage 中的模拟数据，未接入真实养老服务后端。

## 审查发现

### P1：主分支包含合并冲突，无法构建（已本地修复）

`src/components/layout/AppShell.tsx` 原第 28–33 行含 `<<<<<<<`、`=======`、`>>>>>>>`，同时冲突分支引用了未导入的 `ResetDemo`。原版 `npm run build` 失败，App 测试套件无法加载。

清理冲突并保留既有 DemoToolbar 内的重置入口后，81 项测试和生产构建通过。此修复随首页优化一并纳入版本控制。

### P2：家属风险横幅忽略人工最终分类（未修改）

`src/pages/FamilyHomePage.tsx:68` 将等级固定为 P0；第 69 行对原始 FALL 事件固定显示“发生跌倒”。工作人员把风险改为 P2 或将跌倒改判为其他风险时，横幅仍可能显示旧分类，与工单人工结论不一致。应优先使用 `finalPriority` 和 `finalRiskType`，未审核时明确标注建议值。

### P2：所有陪诊工单接单后都写入相同上门时间（浏览器已复现，未修改）

`src/domain/caseStateMachine.ts:41` 将上门时间写死为“明日 13:40”。输入“我后天上午要去医院，但是没人陪我。”，再补充“朝阳医院，上午九点半。”，接单后预约时间为“后日 09:30”，预计上门却为“明日 13:40”。应由工作人员确认上门时间，或按预约时间计算并在改约时同步更新。

### P2：声明的 Node 版本范围与测试依赖不一致（未修改）

`package.json:7` 声明 Node >=20.12，但锁定安装的 Vitest 5.0.0 声明支持 `^22.12.0 || ^24.0.0 || >=26.0.0`。本机 Node 25.9.0 安装时出现 EBADENGINE；README 允许的部分 Node 20 版本也不满足依赖。应统一文档和 engines 到依赖支持的版本，或选择兼容的依赖版本。本机测试实际通过，不代表所有声明版本都兼容。

## 验证范围

- 修复前：63 项非 App 测试通过，App 套件和构建因合并冲突失败。
- 修复后：10 个测试文件、81 项测试全部通过；TypeScript 与 Vite 生产构建通过；git diff --check 通过。
- HTTP 首页返回 200。
- 浏览器验证：老人两轮创建陪诊工单，工作人员接单、开始、完成，家属查看完成结果。
- 家属主页在 375、768、1440px 检查页面宽度；截图保存于 output/playwright。
- 浏览器仅记录 favicon.ico 404；未发现该流程的应用运行异常。
- 未验证真实 OpenHex 对话或语音转写；本次为代码与主要流程审查，不是完整安全审计。
