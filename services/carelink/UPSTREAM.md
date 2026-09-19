# 上游同步记录

- 上游仓库：`https://github.com/McdonaldsQueen/carelink_python.git`
- 导入提交：`7bc716e581c64f6e585095008e7798cc178ecd71`
- 导入方式：源码快照，不使用 Git Submodule。
- 本仓库扩展：订阅绑定、推送批次租约、幂等确认、失败重试、演示重置、Railway 容器配置。

后续同步时，从上游目标提交下载源码快照，仅对原始抓取、核验、筛选文件做三方比较；不得直接覆盖本仓库新增的订阅和批次逻辑。同步后必须运行 `python -m unittest -v` 并记录新的上游 SHA。
