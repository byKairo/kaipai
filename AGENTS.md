# 楷排项目规则

- 正式实现位于根目录 `app/`、`lib/`。不要修改 `archive/legacy/` 的旧源码；`public/kaipai_v091.html` 与 `work/` 只作参考。
- 产品、网络和存储边界以 `ARCHITECTURE.md` 为准。云端 AI 请求经过项目服务端；本机回环 API 按用户要求由浏览器直连，Skill 准备和审核仍使用服务端。不能声称所有内容只留在浏览器或完整功能支持纯静态部署。
- 左侧栏使用 React 状态、props 和事件回调。不要重新引入整块 HTML 注入、元素查询或手动绑定事件来维护 UI 状态；编辑器、焦点与滚动等必要 DOM 交互除外。
- 修改排版转换、文档数据或存储时运行 `npm test`、`npm run typecheck`。改动页面集成还要完成生产构建与对应浏览器交互验证。
- 输出快照不替代语义断言；更新基线前必须解释并核对实际输出变化。
- CSS 不要继续在文件末尾堆覆盖层；优先修改所属组件规则。保留兼容回退，禁止批量删除 `!important`；运行 `node scripts/css-audit.cjs` 检查重复声明。
- 同一目录不要同时运行 Next.js 开发服务和生产构建。

## 正式发布

- 生产只通过 `byKairo/kaipai` 的 `main` 分支 GitHub Actions 发布。不要从本机执行 Wrangler 发布或绕过 `verify-github-release.cjs`；本机构建、测试和预览照常可用。
- 发布后读取 `/api/release`，确认返回的 `commit` 等于 GitHub Actions 的提交 SHA；配置保存或流程已启动都不代表部署完成。
- 保留 `cloudflare/asset-history/` 的历史代码及其 SHA-256 清单；构建会同步当前线上公开资源，发布前检查旧页面依赖。不要删除旧文件来减小发布包。
- 工作区未提交改动不是生产版本。同步 GitHub 时保留用户尚未发布的修改，不能将整个工作区当作上一版生产源码。
