# Carelink 政策服务

本目录是 `carelink_python` 的源码快照与安序智护扩展服务。它只从 HTTPS 政府白名单抓取政策，对标题、机构、日期、适用人群、权益变化和行动要求逐条核验，再通过 SQLite 完成订阅、领取、去重和失败重试。上游版本与同步方式见 [UPSTREAM.md](./UPSTREAM.md)。

## 本地验证

需要 Python 3.10 或更高版本，无第三方依赖：

```bash
python -m unittest -v
POLICY_API_KEY=local-secret POLICY_DB_PATH=./data/policies.sqlite3 \
  python policy_service.py serve --host 127.0.0.1 --port 8765 --refresh-hours 0
```

- `GET /health`：健康检查和已核验政策数。
- `GET /openapi.json`：接口摘要。
- `POST /v1/admin/crawl`：刷新并核验政策。
- `/v1/openhex/subscriptions/*`：绑定、查询和解除接收会话。
- `/v1/openhex/push/*`：以租约领取批次、完成确认和失败释放。
- `POST /v1/admin/reset-recipient`：只重置演示订阅与推送记录，保留政策缓存和抓取日志。

所有 POST 接口使用 `X-API-Key: $POLICY_API_KEY`。服务在非本地地址监听时，没有配置密钥会拒绝启动。

## Railway

仓库根目录的 `railway.toml` 会使用 `Dockerfile.carelink` 构建本服务；也可将 Railway Root Directory 设为 `/services/carelink`，继续使用目录内的同名部署配置。环境变量配置如下：

```text
POLICY_API_KEY=<长随机密钥>
POLICY_DB_PATH=/data/policies.sqlite3
```

`PORT` 由 Railway 注入。为服务挂载 `/data` Volume，并生成 HTTPS 公网域名；健康检查路径为 `/health`。定时抓取由 Vercel Cron 触发，因此容器默认 `--refresh-hours 0`，避免双重调度。

## 可靠性边界

- `sources.json` 中未人工审核的 URL 不会进入推送池。
- 抓取失败、跳转离开白名单、引文变化或资格不匹配时一律不推送。
- `claim` 使用 SQLite `BEGIN IMMEDIATE` 与 10 分钟租约，Cron 和手动检查不会同时取得同一批次。
- OpenHex 接受内部触发消息后，Vercel 才调用 `complete`；失败只调用 `fail`，不写入已发送记录。
- `deliveryId`、批次标记和 OpenHex 历史对账共同防止“上游已收到但本地超时”导致的重复推送。
