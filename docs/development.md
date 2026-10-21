# 开发与部署

## 本地运行

```bash
npm install
npm run dev -- --hostname 127.0.0.1 --port 3003
```

打开 <http://127.0.0.1:3003/>。

开发服务运行期间不要同时执行 `npm run build`；生产构建会重写 `.next`，需要先停止开发服务，构建完成后再重新启动。

## 检查与源码位置

```bash
npm test
npm run typecheck
npm run build
node scripts/css-audit.cjs
```

排版测试包含 12 套风格的内容、结构、转义与兼容检查，以及已确认的输出基线。输出基线只能在核对实际变化后显式更新。

## GitHub 自动部署

向 `main` 分支推送提交后，GitHub Actions 会安装依赖，执行测试和类型检查，构建 Cloudflare 版本，然后更新已有 Worker `kaipai`。只修改本地文件不会触发上线，需要提交并推送到 GitHub。构建或检查失败时不会执行发布。

- 网站：https://kaipai.kairostudio.workers.dev/
- 构建记录：https://github.com/byKairo/kaipai/actions
- 流程配置：`.github/workflows/deploy.yml`
- 发布密钥：仓库 Actions Secret `CLOUDFLARE_API_TOKEN`，仅用于部署步骤；不要写入源码。Cloudflare 令牌当前只包含指定账号的 Workers 脚本编辑权限，范围覆盖该账号的 Workers。
- 运行时密钥 `KAIPAI_CREDENTIAL_KEYS` 保存在 Cloudflare Worker Secrets 中，克隆仓库自行部署时需要另行创建，不能复用其他部署的密钥。

本地与 Cloudflare 的依赖分别由根目录和 `cloudflare/` 下的锁定文件管理；部署时生成的 `.cloudflare-deploy/` 不提交到仓库。当前未启用 Cloudflare 原生 Git 构建或其他分支的自动预览。

正式实现位于 `app/`、`lib/`，产品与网络边界见 [ARCHITECTURE.md](../ARCHITECTURE.md)。
