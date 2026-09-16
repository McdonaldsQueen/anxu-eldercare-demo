# Vercel Production 部署手册

本文档记录安序智护 Demo 当前的生产发布流程。最后验证时间：2026-09-16。

## 当前部署信息

| 项目 | 当前配置 |
| --- | --- |
| GitHub 仓库 | `McdonaldsQueen/anxu-eldercare-demo` |
| 发布分支 | `main` |
| Vercel Scope | `lemon-nekos-projects` |
| Vercel Project | `anxu-eldercare-demo` |
| Framework Preset | Vite |
| 构建命令 | `npm run build` |
| 前端产物 | `dist` |
| Serverless Function | `api/openhex/chat-token.ts` |
| 正式域名 | <https://anxu-eldercare-demo.vercel.app> |
| Node.js | 项目要求 `>=20.12`，Vercel 当前配置为 24.x |

当前采用 **GitHub 主线 + 手动 Vercel CLI Production 部署**。不要假设推送 `main` 后一定会自动上线；只有在后续明确启用 Vercel Git Integration 后，Git 推送才可作为自动发布入口。

## 生产环境变量

Vercel Production 必须配置以下变量：

| 变量 | 运行位置 | 保密要求 |
| --- | --- | --- |
| `VITE_OPENHEX_AGENT_ID` | 浏览器 | Agent UUID，可以进入前端构建 |
| `VITE_OPENHEX_API_BASE_URL` | 浏览器 | 默认 `https://api.openhex.tech` |
| `OPENHEX_WORKSPACE_SLUG` | 服务端 | 不使用 `VITE_` 前缀 |
| `OPENHEX_WORKSPACE_KEY` | 服务端 | `sk_…`，必须以 Vercel Secret 保存 |

检查 Production 环境变量名称：

```bash
npx vercel@59.17.0 env ls production \
  --scope lemon-nekos-projects
```

注意：

- 不要把真实值写入本文档、README、Git 提交或前端变量。
- `.env.local` 仅用于本地开发，已被 `.gitignore` 排除。
- `OPENHEX_WORKSPACE_KEY` 绝不能添加 `VITE_` 前缀，否则会进入浏览器构建产物。
- 增加或修改环境变量后必须重新部署，已有 Deployment 不会自动重新构建。

## 发布前检查

### 1. 同步主线

```bash
git switch main
git fetch origin main
git status --short --branch
```

确认：

- 当前位于 `main`。
- 本地与 `origin/main` 一致。
- 没有未确认的工作区改动。
- `.env.local`、`.vercel/` 和真实密钥没有进入 Git。

### 2. 安装依赖并验证

```bash
npm ci
npm test
npm run build
git diff --check
```

任何测试、类型检查或构建失败都应先修复，不要继续发布。

### 3. 检查 Vercel 登录与项目关联

```bash
npx vercel@59.17.0 whoami
npx vercel@59.17.0 project inspect anxu-eldercare-demo \
  --scope lemon-nekos-projects
```

项目根目录的 `.vercel/project.json` 应关联到 `anxu-eldercare-demo`。该目录只保存本地项目关联信息，不提交 Git。

## 发起 Production 部署

当前已验证可用的命令：

```bash
npx vercel@59.17.0 --prod --yes \
  --scope lemon-nekos-projects
```

Vercel 会依次执行：

1. 读取 `.vercel/project.json` 中的项目关联。
2. 上传当前工作区代码。
3. 安装依赖。
4. 执行 `npm run build`。
5. 构建 `api/openhex/chat-token.ts` Serverless Function。
6. 创建 Production Deployment。
7. 将正式域名 alias 更新到新 Deployment。

发布成功时，CLI 输出应包含：

```text
status: ok
readyState: READY
target: production
Aliased: https://anxu-eldercare-demo.vercel.app
```

记录 CLI 返回的 Deployment URL 和 Inspector URL，方便排查与回滚。

## 线上验收

### 1. 页面可用性

访问：

<https://anxu-eldercare-demo.vercel.app/#/elder>

确认页面加载的是本次发布版本，且没有 Vercel 构建错误页。

### 2. 访客令牌接口

令牌接口只接受 `POST`。以下命令只输出状态码，不打印短时令牌：

```bash
curl -sS -o /dev/null \
  -w 'status=%{http_code}\n' \
  -X POST \
  https://anxu-eldercare-demo.vercel.app/api/openhex/chat-token
```

预期结果为 `status=200`。直接在地址栏打开接口会发送 `GET`，返回 `405` 属于正常行为。

### 3. OpenHex 对话

在老人端完成以下检查：

- 能收到真实 OpenHex Agent 回复。
- 回复按流式文本显示。
- 回复期间不能重复提交。
- 失败时可以重试，输入草稿不会丢失。
- 刷新后仍恢复同一浏览器访客会话。
- 隐私窗口获得独立访客身份。
- 浏览器源码、构建产物和网络请求中不存在 `OPENHEX_WORKSPACE_KEY`。

### 4. Phase 4 与 Mock Case 回归

- 生产环境配置了 Agent ID 时，老人端默认进入 OpenHex Agent。
- Phase 4 业务模式只操作本地 Mock Case，不应把模拟消息发送给 OpenHex。
- 陪诊、紧急 Case、家属请求和工作人员处理流程可以正常联动。
- Mock schema 升级可能重置浏览器中旧版本的 Mock Case，这是预期行为。

## 常见故障

### `Not authorized`

先确认登录身份和项目权限：

```bash
npx vercel@59.17.0 whoami
npx vercel@59.17.0 project inspect anxu-eldercare-demo \
  --scope lemon-nekos-projects
```

本项目曾在 Vercel CLI 59.19.0 遇到一次部署认证异常，而 59.17.0 可以正常发布。因此当前流程固定使用 `vercel@59.17.0`；升级 CLI 前应先在非关键发布中验证。

### 页面正常，但 OpenHex 无法连接

依次检查：

1. 四个 Production 环境变量是否存在。
2. `VITE_OPENHEX_AGENT_ID` 是否为已发布 Agent UUID。
3. `OPENHEX_WORKSPACE_SLUG` 是否属于对应工作区。
4. `OPENHEX_WORKSPACE_KEY` 是否仍有效。
5. `POST /api/openhex/chat-token` 是否返回 `200`。
6. 修改环境变量后是否重新部署。

浏览器只能得到 30 分钟有效的访客令牌；工作区密钥只允许存在于 Vercel 服务端。

### 无法匿名访问正式域名

项目可能启用了 Vercel Deployment Protection。先在 Vercel Dashboard 检查 Protection 设置，再决定是否允许匿名公网访问。不要仅为绕过验收而公开受保护的部署。

## 回滚

如果新版本出现生产问题：

1. 打开 Vercel Project 的 Deployments 页面。
2. 找到最近一个已验证的 `READY` Production Deployment。
3. 检查该版本对应的 Git commit 和环境变量。
4. 使用 Vercel Dashboard 将该 Deployment 重新 Promote 为 Production。
5. 重新验证首页和 `POST /api/openhex/chat-token`。

回滚 Vercel Deployment 不会自动回滚 GitHub `main`。如代码本身需要回退，应另外创建明确的 Git revert 提交，避免强制改写主线历史。

